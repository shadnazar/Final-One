"""
Iteration 6 - Subcategories CRUD after generic seeds wipe.
DB starts at 0 subcategories. Verifies CRUD + parent validation + niche
auto-derivation from parent + duplicate-slug guard + cascade-clear on delete.
"""
import os
import time
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://weather-preview-6.preview.emergentagent.com').rstrip('/')
ADMIN = os.environ.get('ADMIN_PASSWORD', 'celestaglow2024')
H = {"Content-Type": "application/json", "X-Admin-Token": ADMIN}

TS = int(time.time())
TEST_SUB = f"test-iter6-matte-{TS}"


def teardown_module(_):
    requests.delete(f"{BASE_URL}/api/admin/subcategories/{TEST_SUB}", headers=H, timeout=10)


# 1. After agent's wipe, public list should be []
def test_public_list_is_empty_after_wipe():
    r = requests.get(f"{BASE_URL}/api/subcategories", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 0, f"Expected 0 subcategories, got {len(data)}: {data[:3]}"


# 2. Admin list should also be []
def test_admin_list_is_empty_after_wipe():
    r = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10)
    assert r.status_code == 200
    assert r.json() == []


# 3. Admin list requires token
def test_admin_list_requires_token():
    r = requests.get(f"{BASE_URL}/api/admin/subcategories", timeout=10)
    assert r.status_code == 401


# 4. Reject when parent_category does not exist
def test_create_rejects_invalid_parent():
    r = requests.post(
        f"{BASE_URL}/api/admin/subcategories",
        json={
            "slug": f"TEST_invalid_{TS}",
            "name": "Invalid",
            "parent_category": "this-does-not-exist-xyz",
        },
        headers=H, timeout=10,
    )
    assert r.status_code == 400, r.text
    assert "parent" in r.text.lower() or "category" in r.text.lower()


# 5. Create real subcategory under existing category, niche auto-derived
def test_create_success_with_niche_autoderive():
    cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
    # Pick a cosmetics category if available
    parent = None
    for c in cats:
        if (c.get("niche") or c.get("group")) == "cosmetics":
            parent = c["slug"]
            parent_niche = c.get("niche") or c.get("group")
            break
    if not parent:
        parent = cats[0]["slug"]
        parent_niche = cats[0].get("niche") or cats[0].get("group") or "skincare"

    r = requests.post(
        f"{BASE_URL}/api/admin/subcategories",
        json={
            "slug": TEST_SUB,
            "name": "Matte",
            "parent_category": parent,
            "tagline": "Velvet finish",
        },
        headers=H, timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert body.get("slug") == TEST_SUB

    # GET via admin list, verify niche is auto-derived from parent
    items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    match = next((i for i in items if i["slug"] == TEST_SUB), None)
    assert match is not None
    assert match["parent_category"] == parent
    assert match["niche"] == parent_niche, f"expected niche={parent_niche}, got {match['niche']}"
    assert match["name"] == "Matte"


# 6. Duplicate slug returns 400
def test_create_duplicate_slug_400():
    cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
    parent = cats[0]["slug"]
    r = requests.post(
        f"{BASE_URL}/api/admin/subcategories",
        json={"slug": TEST_SUB, "name": "Dup", "parent_category": parent},
        headers=H, timeout=10,
    )
    assert r.status_code == 400


# 7. Filter by category returns only that category's subcategories
def test_list_filter_by_category():
    items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    parent_of_test = next(i for i in items if i["slug"] == TEST_SUB)["parent_category"]
    r = requests.get(f"{BASE_URL}/api/subcategories", params={"category": parent_of_test}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert all(s["parent_category"] == parent_of_test for s in data)
    assert any(s["slug"] == TEST_SUB for s in data)


# 8. Other category that has no subcategories returns []
def test_list_filter_unseeded_category_empty():
    cats = requests.get(f"{BASE_URL}/api/categories", timeout=10).json()
    # foundation-concealer if exists, else any category that's not parent of TEST_SUB
    items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    parent_of_test = next(i for i in items if i["slug"] == TEST_SUB)["parent_category"]
    target = None
    for c in cats:
        if c["slug"] == "foundation-concealer":
            target = c["slug"]; break
    if not target:
        for c in cats:
            if c["slug"] != parent_of_test:
                target = c["slug"]; break
    r = requests.get(f"{BASE_URL}/api/subcategories", params={"category": target}, timeout=10)
    assert r.status_code == 200
    assert r.json() == [], f"Expected [] for category={target}, got {r.json()}"


# 9. PUT updates name & sort_order
def test_update_subcategory():
    items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    match = next(i for i in items if i["slug"] == TEST_SUB)
    parent = match["parent_category"]
    r = requests.put(
        f"{BASE_URL}/api/admin/subcategories/{TEST_SUB}",
        json={
            "slug": TEST_SUB,
            "name": "Matte Renamed",
            "parent_category": parent,
            "sort_order": 7,
        },
        headers=H, timeout=10,
    )
    assert r.status_code == 200, r.text
    items2 = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    m2 = next(i for i in items2 if i["slug"] == TEST_SUB)
    assert m2["name"] == "Matte Renamed"
    assert m2["sort_order"] == 7


# 10. PUT for unknown slug → 404
def test_update_404_unknown():
    r = requests.put(
        f"{BASE_URL}/api/admin/subcategories/zzz-nope-xyz",
        json={"slug": "zzz-nope-xyz", "name": "x", "parent_category": "x"},
        headers=H, timeout=10,
    )
    assert r.status_code == 404


# 11. DELETE removes it
def test_delete_subcategory():
    r = requests.delete(f"{BASE_URL}/api/admin/subcategories/{TEST_SUB}", headers=H, timeout=10)
    assert r.status_code == 200
    items = requests.get(f"{BASE_URL}/api/admin/subcategories", headers=H, timeout=10).json()
    assert not any(i["slug"] == TEST_SUB for i in items)


# 12. DELETE unknown → 404
def test_delete_404_unknown():
    r = requests.delete(f"{BASE_URL}/api/admin/subcategories/zzz-nope-xyz", headers=H, timeout=10)
    assert r.status_code == 404
