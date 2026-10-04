"""
Backend tests for the Jan 2026 category infrastructure work:
1) POST /api/admin/products without category -> 422
2) POST /api/admin/products with category -> success
3) GET /api/admin/categories -> 31 docs (15 skincare + 16 cosmetics) each with niche
4) Smoke /api/admin/categories CRUD (POST/PUT/DELETE)
"""
import os, time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_HDR = {"X-Admin-Token": "celestaglow2024", "Content-Type": "application/json"}


def _new_slug(prefix="test-cat"):
    return f"TEST_{prefix}_{int(time.time()*1000)}"


# 1. Mandatory category validation on create
def test_create_product_without_category_returns_422():
    payload = {
        "slug": _new_slug("nocat"),
        "name": "TEST No Category",
        "short_name": "TEST",
        "category": "",
        "niche": "skincare",
    }
    r = requests.post(f"{BASE_URL}/api/admin/products", json=payload, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 422, r.text
    body = r.json()
    detail = body.get("detail", "")
    assert "category" in str(detail).lower()


# 2. Create product WITH category succeeds, then cleanup
def test_create_product_with_category_succeeds():
    slug = _new_slug("withcat")
    payload = {
        "slug": slug,
        "name": "TEST With Category",
        "short_name": "TEST",
        "category": "serum",
        "niche": "skincare",
        "mrp": 100, "prepaid_price": 80, "cod_price": 90,
    }
    try:
        r = requests.post(f"{BASE_URL}/api/admin/products", json=payload, headers=ADMIN_HDR, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("slug") == slug

        # GET to confirm persistence
        g = requests.get(f"{BASE_URL}/api/products/{slug}", timeout=10)
        assert g.status_code == 200
        prod = g.json()
        assert prod["category"] == "serum"
        assert prod["niche"] == "skincare"
    finally:
        requests.delete(f"{BASE_URL}/api/admin/products/{slug}", headers=ADMIN_HDR, timeout=10)


# 3. GET /api/admin/categories returns 15 skincare + 16 cosmetics
def test_admin_categories_count_and_niche_field():
    r = requests.get(f"{BASE_URL}/api/admin/categories", headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    # Could be a dict {categories:[...]} or a plain list
    cats = data.get("categories") if isinstance(data, dict) else data
    assert isinstance(cats, list), f"unexpected shape: {data}"

    skincare = [c for c in cats if c.get("niche") == "skincare"]
    cosmetics = [c for c in cats if c.get("niche") == "cosmetics"]

    # All categories should have a niche field set (the bug being fixed)
    no_niche = [c for c in cats if not c.get("niche")]
    assert not no_niche, f"{len(no_niche)} categories missing niche field: {[c.get('name') or c.get('slug') for c in no_niche]}"

    assert len(skincare) >= 15, f"expected >=15 skincare cats, got {len(skincare)}"
    assert len(cosmetics) >= 16, f"expected >=16 cosmetics cats, got {len(cosmetics)}"
    assert len(cats) >= 31, f"expected >=31 total, got {len(cats)}"


# 4. Smoke CRUD on /api/admin/categories
def test_admin_categories_crud_smoke():
    slug = _new_slug("cosmetic-cat").lower()
    create_payload = {
        "slug": slug,
        "name": "TEST Lipstick",
        "niche": "cosmetics",
        "description": "smoke test",
    }
    created_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/admin/categories", json=create_payload, headers=ADMIN_HDR, timeout=10)
        # Tolerate 200/201
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("success") in (True, None)  # some endpoints don't return success

        # Verify it's in the list with niche=cosmetics
        lst = requests.get(f"{BASE_URL}/api/admin/categories", headers=ADMIN_HDR, timeout=10).json()
        cats = lst.get("categories") if isinstance(lst, dict) else lst
        match = next((c for c in cats if c.get("slug") == slug), None)
        assert match is not None, "newly created category not found in list"
        assert match.get("niche") == "cosmetics"
        created_id = match.get("id") or match.get("_id") or slug

        # PUT update — backend requires full payload including slug
        upd = requests.put(
            f"{BASE_URL}/api/admin/categories/{slug}",
            json={"slug": slug, "name": "TEST Lipstick Updated", "niche": "cosmetics"},
            headers=ADMIN_HDR, timeout=10
        )
        if upd.status_code == 404 and created_id and created_id != slug:
            upd = requests.put(
                f"{BASE_URL}/api/admin/categories/{created_id}",
                json={"slug": slug, "name": "TEST Lipstick Updated", "niche": "cosmetics"},
                headers=ADMIN_HDR, timeout=10
            )
        assert upd.status_code == 200, upd.text
    finally:
        # DELETE
        d = requests.delete(f"{BASE_URL}/api/admin/categories/{slug}", headers=ADMIN_HDR, timeout=10)
        if d.status_code == 404 and created_id and created_id != slug:
            requests.delete(f"{BASE_URL}/api/admin/categories/{created_id}", headers=ADMIN_HDR, timeout=10)
