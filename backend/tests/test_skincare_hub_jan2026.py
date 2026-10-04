"""Tests for Jan 2026 skincare-hub iteration:
- Category partial update preserves parent/subs/is_parent
- Product-group rename (PATCH)
- Master-import dedup-by-slug on re-upload
- Category list filters by niche
"""
import os
import io
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return (v or "").rstrip("/")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "celestaglow2024"
HEADERS = {"X-Admin-Token": ADMIN_TOKEN}


# ---------- Category partial-update ----------
class TestCategoryPartialUpdate:
    def test_get_lipstick_baseline(self):
        r = requests.get(f"{API}/categories/lipstick?limit=1", timeout=30)
        assert r.status_code == 200, r.text
        cat = r.json()["category"]
        # Capture original for restore
        TestCategoryPartialUpdate._orig_image = cat.get("image", "")
        TestCategoryPartialUpdate._orig_parent = cat.get("parent")
        TestCategoryPartialUpdate._orig_is_parent = cat.get("is_parent")
        TestCategoryPartialUpdate._orig_subs = cat.get("subs")
        assert cat.get("parent") == "lips", f"Expected parent='lips', got {cat.get('parent')}"
        assert cat.get("is_parent") in (False, None)

    def test_put_image_only_preserves_relations(self):
        new_img = "https://example.com/TEST_lipstick.jpg"
        r = requests.put(f"{API}/admin/categories/lipstick",
                         json={"image": new_img}, headers=HEADERS, timeout=30)
        assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
        # Verify persistence + preservation
        g = requests.get(f"{API}/categories/lipstick?limit=1", timeout=30)
        assert g.status_code == 200
        cat = g.json()["category"]
        assert cat.get("image") == new_img, f"image not saved: {cat.get('image')}"
        assert cat.get("parent") == "lips", f"parent lost! got {cat.get('parent')}"
        # is_parent: lipstick is a CHILD of lips → must remain False/None (not flipped)
        assert cat.get("is_parent") in (False, None), f"is_parent corrupted: {cat.get('is_parent')}"

    def test_put_empty_body_400(self):
        r = requests.put(f"{API}/admin/categories/lipstick",
                         json={}, headers=HEADERS, timeout=30)
        assert r.status_code == 400
        assert "nothing to update" in r.text.lower()

    def test_restore_lipstick_image(self):
        # restore to original (best-effort)
        orig = getattr(TestCategoryPartialUpdate, "_orig_image", "")
        r = requests.put(f"{API}/admin/categories/lipstick",
                         json={"image": orig}, headers=HEADERS, timeout=30)
        assert r.status_code == 200


# ---------- Product-group rename ----------
class TestProductGroupRename:
    @classmethod
    def setup_class(cls):
        r = requests.get(f"{API}/admin/product-groups?niche=cosmetics&limit=5",
                         headers=HEADERS, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        assert items, "no product groups present"
        cls.group = items[0]
        cls.group_id = cls.group["group_id"]
        cls.orig_name = cls.group.get("name", "")

    def test_listing_has_name_field(self):
        assert "name" in self.group
        assert "group_id" in self.group

    def test_rename_success(self):
        new_name = "TEST_RENAMED_GROUP_JAN2026"
        r = requests.patch(f"{API}/admin/product-groups/{self.group_id}",
                           json={"name": new_name}, headers=HEADERS, timeout=30)
        assert r.status_code == 200, r.text
        # Verify via listing
        r2 = requests.get(f"{API}/admin/product-groups?niche=cosmetics&limit=200",
                          headers=HEADERS, timeout=30)
        items = r2.json()["items"]
        found = next((i for i in items if i["group_id"] == self.group_id), None)
        assert found is not None
        assert found["name"] == new_name

    def test_rename_empty_400(self):
        r = requests.patch(f"{API}/admin/product-groups/{self.group_id}",
                           json={"name": "   "}, headers=HEADERS, timeout=30)
        assert r.status_code == 400
        assert "name is required" in r.text.lower()

    def test_rename_nonexistent_404(self):
        r = requests.patch(f"{API}/admin/product-groups/nonexistent-grp-xyz",
                           json={"name": "X"}, headers=HEADERS, timeout=30)
        assert r.status_code == 404

    def test_restore_name(self):
        if self.orig_name:
            r = requests.patch(f"{API}/admin/product-groups/{self.group_id}",
                               json={"name": self.orig_name}, headers=HEADERS, timeout=30)
            assert r.status_code == 200


# ---------- Niche-filtered category list ----------
class TestCategoryListing:
    def test_skincare_niche(self):
        r = requests.get(f"{API}/categories?niche=skincare", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert all(it.get("niche") == "skincare" for it in items)
        # Expected ~16
        assert len(items) >= 10, f"skincare cats too few: {len(items)}"

    def test_cosmetics_niche(self):
        r = requests.get(f"{API}/categories?niche=cosmetics", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert all(it.get("niche") == "cosmetics" for it in items)
        assert len(items) >= 25, f"cosmetics cats too few: {len(items)}"

    def test_cleansers_category_detail(self):
        r = requests.get(f"{API}/categories/cleansers?limit=1", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "category" in body and "total" in body
        assert body["category"]["slug"] == "cleansers"

    def test_moisturizers_product_count(self):
        r = requests.get(f"{API}/products?category=moisturizers&limit=1", timeout=30)
        assert r.status_code == 200
        body = r.json()
        total = body.get("total")
        assert isinstance(total, int)
        # Expected ~942 (allow wide band; if dedup fails it'll explode)
        assert 800 <= total <= 1100, f"moisturizers total off: {total}"


# ---------- Master-import dedup on re-upload ----------
class TestMasterImportDedup:
    MASTER_URL = "https://customer-assets.emergentagent.com/job_ecom-shop-18/artifacts/mm09nng2_ULTRA_GRANULAR_MASTER_LIST.xlsx"

    def test_products_count_before(self):
        r = requests.get(f"{API}/products?limit=1", timeout=30)
        assert r.status_code == 200
        TestMasterImportDedup.before_total = r.json().get("total", 0)
        assert TestMasterImportDedup.before_total > 5000, \
            f"baseline products too low: {TestMasterImportDedup.before_total}"

    def test_reupload_dedups(self):
        dl = requests.get(self.MASTER_URL, timeout=120)
        assert dl.status_code == 200, "could not download master xlsx"
        files = {"file": ("ULTRA_GRANULAR_MASTER_LIST.xlsx", io.BytesIO(dl.content),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/admin/master-import/upload",
                          files=files, headers=HEADERS, timeout=600)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        # wipe must NOT have happened (default false)
        assert body.get("wipe") is None, f"wipe ran by default! {body.get('wipe')}"
        imp = body.get("import", {})
        # Re-upload of same file → imported should be 0 (or near-zero)
        imported = imp.get("imported", -1)
        skipped = imp.get("skipped", 0)
        total = imp.get("total", 0)
        print(f"[reupload] imported={imported} skipped={skipped} total={total}")
        assert imported == 0, f"DEDUP FAILED — imported={imported} on re-upload"
        assert skipped > 5000, f"skip count too low: {skipped}"

    def test_products_count_after_unchanged(self):
        r = requests.get(f"{API}/products?limit=1", timeout=30)
        assert r.status_code == 200
        after = r.json().get("total", 0)
        before = getattr(TestMasterImportDedup, "before_total", 0)
        # Tolerate small drift but not duplication
        assert after <= before + 50, \
            f"product count grew after re-upload: before={before} after={after}"
        assert after < 7900, f"active products >7900 → dedup failed (got {after})"
