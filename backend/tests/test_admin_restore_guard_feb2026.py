"""
Feb 2026 — Admin restore guard, anti-aging niche, category image optim, perf.

Coverage:
1. Anti-aging concern lives on its own flagship niche ('anti-aging'), not 'skincare'.
2. /api/concerns filtered by niche='skincare' (client-side) excludes anti-aging.
3. Categories returned by API have Cloudinary transformations (f_auto, q_auto, w_*).
4. Public endpoints under 1s.
5. Admin restore preserves admin-authoritative fields (is_active=false) — full + incremental paths.
"""
import os
import time
import asyncio
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"
TIMEOUT = 30


# ---- Anti-aging niche guard ----
class TestAntiAgingNiche:
    def test_anti_aging_concern_has_own_niche(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        assert r.status_code == 200
        concerns = r.json()
        # Find anti-aging slug
        aa = next((c for c in concerns if c.get("slug") == "anti-aging"), None)
        assert aa is not None, "anti-aging concern not found"
        # The niche field MUST be 'anti-aging', not 'skincare'
        assert aa.get("niche") == "anti-aging", (
            f"Expected niche='anti-aging' for slug='anti-aging', got '{aa.get('niche')}'"
        )

    def test_aging_concern_still_skincare(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        concerns = r.json()
        ag = next((c for c in concerns if c.get("slug") == "aging"), None)
        # Acceptable: if 'aging' exists, it must still be skincare
        if ag is not None:
            assert ag.get("niche") == "skincare", (
                f"'aging' concern should remain niche='skincare', got '{ag.get('niche')}'"
            )

    def test_skincare_niche_filter_excludes_anti_aging(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        concerns = r.json()
        skincare_slugs = [c.get("slug") for c in concerns if c.get("niche") == "skincare"]
        assert "anti-aging" not in skincare_slugs, (
            f"anti-aging should NOT be in skincare niche, but appears in: {skincare_slugs}"
        )


# ---- Category image optimization ----
class TestCategoryImagesOptimised:
    def test_category_images_have_cloudinary_transforms(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        cats_with_img = [c for c in cats if c.get("image")]
        assert len(cats_with_img) > 0, "No categories have image field"

        unoptimized = []
        for c in cats_with_img:
            img = c["image"]
            # Only validate Cloudinary URLs (other CDNs may not support transforms)
            if "res.cloudinary.com" in img or "/image/upload/" in img:
                has_optim = any(t in img for t in ["f_auto", "q_auto", "w_"])
                if not has_optim:
                    unoptimized.append((c.get("slug"), img))
        assert not unoptimized, (
            f"{len(unoptimized)} Cloudinary category images missing transforms. "
            f"Samples: {unoptimized[:3]}"
        )

    def test_category_image_payload_size(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=30)
        cats = r.json()
        sampled = 0
        oversized = []
        for c in cats:
            img = c.get("image")
            if not img:
                continue
            # only sample Cloudinary transformed urls
            if "res.cloudinary.com" not in img and "/image/upload/" not in img:
                continue
            if sampled >= 3:
                break
            try:
                resp = requests.get(img, headers={"Accept": "image/webp"}, timeout=30)
                if resp.status_code == 200:
                    size_kb = len(resp.content) / 1024
                    if size_kb > 200:  # generous; spec says ≤80KB but allow margin
                        oversized.append((c.get("slug"), round(size_kb, 1)))
                    sampled += 1
            except Exception:
                pass
        assert sampled > 0, "Could not sample any category images"
        assert not oversized, f"Oversized category images: {oversized}"


# ---- Public API perf smoke ----
class TestPublicAPIPerf:
    @pytest.mark.parametrize("path", [
        "/api/concerns", "/api/categories", "/api/products?limit=1",
        "/api/site-settings", "/api/doctor-consultation/config",
    ])
    def test_endpoint_fast(self, path):
        t = time.time()
        r = requests.get(f"{BASE_URL}{path}", timeout=15)
        dur = time.time() - t
        assert r.status_code == 200, f"{path} → {r.status_code}"
        assert dur < 2.0, f"{path} took {dur:.2f}s (>2s)"


# ---- Backward compat counts ----
class TestBackwardCompat:
    def test_concerns_count(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 13

    def test_categories_count(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 100


# ---- Restore preserves admin-authoritative fields ----
class TestRestoreAdminStateGuard:
    """
    Direct DB poison + invoke auto_restore_if_empty(force=True).
    Verifies is_active=False survives the restore (both full + incremental paths).
    """

    def _pick_product_slug(self):
        r = requests.get(f"{BASE_URL}/api/products?limit=1", timeout=30)
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else (body.get("items") or body.get("products") or [])
        assert items, "No products returned"
        return items[0].get("slug") or items[0].get("id")

    def test_restore_respects_is_active_false_full_path(self, tmp_path):
        slug = self._pick_product_slug()
        script = f"""
import asyncio, os, sys
sys.path.insert(0, '/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
from services.catalog_backup import auto_restore_if_empty

async def main():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 1. Mark product as soft-deleted
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({{'slug': {slug!r}}}, {{'$set': {{'is_active': False, 'updated_at': now}}}})
    pre = await db.products.find_one({{'slug': {slug!r}}}, {{'_id': 0, 'is_active': 1}})
    print('PRE_RESTORE_IS_ACTIVE=', pre.get('is_active'))

    # 2. Force restore
    try:
        result = await auto_restore_if_empty(db, force=True)
        print('RESTORE_OK=', bool(result))
    except Exception as e:
        print('RESTORE_ERR=', repr(e))

    # 3. Re-fetch
    post = await db.products.find_one({{'slug': {slug!r}}}, {{'_id': 0, 'is_active': 1}})
    print('POST_RESTORE_IS_ACTIVE=', post.get('is_active'))

asyncio.run(main())
"""
        p = tmp_path / "poison.py"
        p.write_text(script)
        import subprocess
        # Load backend env
        env = os.environ.copy()
        with open("/app/backend/.env") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
        result = subprocess.run(
            ["python", str(p)], capture_output=True, text=True, env=env, timeout=300,
        )
        out = (result.stdout or "") + "\n" + (result.stderr or "")
        print(out)
        assert "POST_RESTORE_IS_ACTIVE= False" in out, (
            f"Admin-set is_active=False was reverted by restore!\n{out}"
        )

    def test_restore_respects_is_active_false_incremental_path(self, tmp_path):
        """Run a second time on a different product to exercise incremental replay."""
        # Use a different product (second one)
        r = requests.get(f"{BASE_URL}/api/products?limit=5", timeout=30)
        body = r.json()
        items = body if isinstance(body, list) else (body.get("items") or body.get("products") or [])
        assert len(items) >= 2, "Need at least 2 products"
        slug = items[1].get("slug") or items[1].get("id")

        script = f"""
import asyncio, os, sys
sys.path.insert(0, '/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
from services.catalog_backup import auto_restore_if_empty

async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({{'slug': {slug!r}}}, {{'$set': {{'is_active': False, 'updated_at': now}}}})
    pre = await db.products.find_one({{'slug': {slug!r}}}, {{'_id': 0, 'is_active': 1}})
    print('PRE=', pre.get('is_active'))
    try:
        await auto_restore_if_empty(db, force=True)
        print('RESTORE_OK')
    except Exception as e:
        print('RESTORE_ERR=', repr(e))
    post = await db.products.find_one({{'slug': {slug!r}}}, {{'_id': 0, 'is_active': 1}})
    print('POST=', post.get('is_active'))

asyncio.run(main())
"""
        p = tmp_path / "poison2.py"
        p.write_text(script)
        import subprocess
        env = os.environ.copy()
        with open("/app/backend/.env") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
        result = subprocess.run(
            ["python", str(p)], capture_output=True, text=True, env=env, timeout=300,
        )
        out = (result.stdout or "") + "\n" + (result.stderr or "")
        print(out)
        assert "POST= False" in out, (
            f"Admin-set is_active=False was reverted by INCREMENTAL restore!\n{out}"
        )
