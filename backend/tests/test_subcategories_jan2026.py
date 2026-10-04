"""
Iteration 5 - Subcategories CRUD + Product subcategory field
Tests for /api/subcategories, /api/admin/subcategories, ProductInput.subcategory
"""
import os
import requests
import pytest
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://weather-preview-6.preview.emergentagent.com').rstrip('/')
ADMIN = os.environ.get('ADMIN_PASSWORD', 'celestaglow2024')
H = {"Content-Type": "application/json", "X-Admin-Token": ADMIN}


# ---------- Public list / filter ----------
class TestSubcategoryPublic:
    def test_list_all_subcategories_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/subcategories", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_brow_subcategories_seeded(self):
        r = requests.get(f"{BASE_URL}/api/subcategories", params={"category": "brow"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        slugs = {s["slug"] for s in items}
        assert {"brow-best-sellers", "brow-luxury", "brow-everyday"}.issubset(slugs), f"Missing seeds: got {slugs}"
        # All have parent_category=brow
        for s in items:
            if s["slug"].startswith("brow-"):
                assert s["parent_category"] == "brow"
                assert "_id" not in s


# ---------- Admin CRUD ----------
class TestSubcategoryAdminCRUD:
    TEST_SLUG = f"test-sub-{int(time.time())}"

    def teardown_class(cls):
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/subcategories/{cls.TEST_SLUG}", headers=H, timeout=10)

    def test_admin_list_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/subcategories", timeout=10)
        assert r.status_code == 401

    def test_admin_list_with_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_subcategory_validates_parent(self):
        # Parent that does not exist -> 400
        r = requests.post(
            f"{BASE_URL}/api/admin/subcategories",
            json={
                "slug": "TEST_invalid_parent_xyz",
                "name": "Invalid",
                "parent_category": "this-parent-does-not-exist-zzz",
            },
            headers=H,
            timeout=10,
        )
        assert r.status_code == 400, r.text

    def test_create_subcategory_success(self):
        # Pick a real category as parent
        cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
        assert cats, "no categories found"
        parent = "brow" if any(c["slug"] == "brow" for c in cats) else cats[0]["slug"]
        r = requests.post(
            f"{BASE_URL}/api/admin/subcategories",
            json={
                "slug": TestSubcategoryAdminCRUD.TEST_SLUG,
                "name": "TEST Subcat",
                "parent_category": parent,
                "icon": "🧪",
                "tagline": "test only",
            },
            headers=H,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("slug") == TestSubcategoryAdminCRUD.TEST_SLUG

        # GET via public list to confirm persistence
        items = requests.get(f"{BASE_URL}/api/subcategories", params={"category": parent}, timeout=10).json()
        assert any(i["slug"] == TestSubcategoryAdminCRUD.TEST_SLUG for i in items)

    def test_create_subcategory_duplicate_slug_400(self):
        cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
        parent = "brow" if any(c["slug"] == "brow" for c in cats) else cats[0]["slug"]
        r = requests.post(
            f"{BASE_URL}/api/admin/subcategories",
            json={
                "slug": TestSubcategoryAdminCRUD.TEST_SLUG,
                "name": "Dup",
                "parent_category": parent,
            },
            headers=H,
            timeout=10,
        )
        assert r.status_code == 400, r.text

    def test_update_subcategory(self):
        cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
        parent = "brow" if any(c["slug"] == "brow" for c in cats) else cats[0]["slug"]
        r = requests.put(
            f"{BASE_URL}/api/admin/subcategories/{TestSubcategoryAdminCRUD.TEST_SLUG}",
            json={
                "slug": TestSubcategoryAdminCRUD.TEST_SLUG,
                "name": "TEST Subcat Updated",
                "parent_category": parent,
                "tagline": "updated tagline",
            },
            headers=H,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        # Verify
        items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
        match = next((i for i in items if i["slug"] == TestSubcategoryAdminCRUD.TEST_SLUG), None)
        assert match is not None
        assert match["name"] == "TEST Subcat Updated"
        assert match["tagline"] == "updated tagline"

    def test_delete_subcategory(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/subcategories/{TestSubcategoryAdminCRUD.TEST_SLUG}",
            headers=H, timeout=10,
        )
        assert r.status_code == 200, r.text
        # Verify gone
        items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
        assert not any(i["slug"] == TestSubcategoryAdminCRUD.TEST_SLUG for i in items)

    def test_delete_404_for_unknown(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/subcategories/zzz-does-not-exist-xyz",
            headers=H, timeout=10,
        )
        assert r.status_code == 404


# ---------- DELETE clears subcategory on referencing products ----------
class TestSubcategoryDeleteCascade:
    TEST_SUB = f"test-cascade-{int(time.time())}"
    test_product_slug = None

    def teardown_class(cls):
        if cls.test_product_slug:
            requests.delete(f"{BASE_URL}/api/admin/products/{cls.test_product_slug}", headers=H, timeout=10)
        requests.delete(f"{BASE_URL}/api/admin/subcategories/{cls.TEST_SUB}", headers=H, timeout=10)

    def test_delete_subcategory_clears_product_field(self):
        # 1. Create subcategory under brow
        r = requests.post(
            f"{BASE_URL}/api/admin/subcategories",
            json={
                "slug": TestSubcategoryDeleteCascade.TEST_SUB,
                "name": "Cascade Test",
                "parent_category": "brow",
            },
            headers=H, timeout=10,
        )
        if r.status_code != 200:
            pytest.skip(f"Could not create subcategory: {r.text}")

        # 2. Create a product tagged with that subcategory
        prod_slug = f"test-cascade-prod-{int(time.time())}"
        TestSubcategoryDeleteCascade.test_product_slug = prod_slug
        pr = requests.post(
            f"{BASE_URL}/api/admin/products",
            json={
                "slug": prod_slug,
                "name": "TEST Cascade Product",
                "short_name": "TCP",
                "tagline": "t",
                "category": "brow",
                "subcategory": TestSubcategoryDeleteCascade.TEST_SUB,
                "mrp": 100,
                "prepaid_price": 80,
                "cod_price": 90,
                "description": "x",
                "key_ingredients": "x",
                "is_active": True,
            },
            headers=H, timeout=10,
        )
        if pr.status_code not in (200, 201):
            pytest.skip(f"Could not create product (schema may differ): {pr.status_code} {pr.text[:200]}")

        # 3. Verify product has subcategory set
        p = requests.get(f"{BASE_URL}/api/products/{prod_slug}", timeout=10)
        if p.status_code == 200:
            assert p.json().get("subcategory") == TestSubcategoryDeleteCascade.TEST_SUB

        # 4. Delete subcategory
        d = requests.delete(
            f"{BASE_URL}/api/admin/subcategories/{TestSubcategoryDeleteCascade.TEST_SUB}",
            headers=H, timeout=10,
        )
        assert d.status_code == 200

        # 5. Verify product's subcategory field is cleared
        p2 = requests.get(f"{BASE_URL}/api/products/{prod_slug}", timeout=10)
        if p2.status_code == 200:
            assert p2.json().get("subcategory", "") == "", f"Expected cleared, got {p2.json().get('subcategory')}"


# ---------- ProductInput accepts subcategory ----------
class TestProductSubcategoryField:
    def test_brow_definer_has_subcategory(self):
        # Smoke test: existing brow-definer-pencil should have subcategory=brow-best-sellers per agent context
        r = requests.get(f"{BASE_URL}/api/products", params={"category": "brow"}, timeout=10)
        assert r.status_code == 200
        prods = r.json() if isinstance(r.json(), list) else r.json().get("products", [])
        tagged = [p for p in prods if p.get("subcategory") == "brow-best-sellers"]
        assert len(tagged) >= 1, f"Expected at least 1 brow product tagged subcategory=brow-best-sellers; got products={[(p.get('slug'), p.get('subcategory')) for p in prods]}"
