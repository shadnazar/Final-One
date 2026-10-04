"""Fast backend tests for Feb-2026 extras: shop-by-category tiles, leads, sale campaigns."""
import os
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
ADMIN = {"X-Admin-Token": "celestaglow2024"}
TILE_SLUG = f"test-tile-{uuid.uuid4().hex[:6]}"
CAMPAIGN_SLUG = f"test-camp-{uuid.uuid4().hex[:6]}"
FAST_TEST_SLUG = "fast-test-50"


# --- Shop by category tiles ---
class TestTiles:
    def test_public_list(self):
        r = requests.get(f"{BASE}/api/shop-by-category?niche=skincare", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_crud_no_token(self):
        r = requests.post(f"{BASE}/api/admin/shop-by-category", json={"slug": "x", "name": "X"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_crud(self):
        payload = {"slug": TILE_SLUG, "name": "Test Tile", "niche": "skincare", "sort_order": 1, "is_active": True}
        r = requests.post(f"{BASE}/api/admin/shop-by-category", json=payload, headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == TILE_SLUG

        r = requests.put(f"{BASE}/api/admin/shop-by-category/{TILE_SLUG}",
                         json={**payload, "name": "Updated"}, headers=ADMIN, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "Updated"

        r = requests.delete(f"{BASE}/api/admin/shop-by-category/{TILE_SLUG}", headers=ADMIN, timeout=15)
        assert r.status_code == 200


# --- Leads ---
class TestLeads:
    lead_id = None

    def test_create_partner(self):
        r = requests.post(f"{BASE}/api/leads",
                          json={"type": "partner", "name": "Test Partner", "phone": "9876543210", "email": "x@y.com"},
                          timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["success"] is True
        assert j["id"].startswith("lead_")
        TestLeads.lead_id = j["id"]

    def test_create_invest(self):
        r = requests.post(f"{BASE}/api/leads",
                          json={"type": "invest", "name": "Test Investor", "phone": "9876543210"},
                          timeout=15)
        assert r.status_code == 200

    def test_create_skin_concern(self):
        r = requests.post(f"{BASE}/api/leads",
                          json={"type": "skin_concern", "name": "Test Skin", "phone": "9876543210", "concern": "acne"},
                          timeout=15)
        assert r.status_code == 200

    def test_invalid_type(self):
        r = requests.post(f"{BASE}/api/leads",
                          json={"type": "bogus", "name": "Test", "phone": "9876543210"}, timeout=15)
        assert r.status_code == 400

    def test_short_phone(self):
        r = requests.post(f"{BASE}/api/leads",
                          json={"type": "partner", "name": "X", "phone": "12345"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_admin_list_no_token(self):
        r = requests.get(f"{BASE}/api/admin/leads", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_list(self):
        r = requests.get(f"{BASE}/api/admin/leads", headers=ADMIN, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "leads" in j and "total" in j and "counts" in j
        for t in ("partner", "invest", "skin_concern"):
            assert t in j["counts"]

    def test_admin_filter(self):
        r = requests.get(f"{BASE}/api/admin/leads?type=partner", headers=ADMIN, timeout=15)
        assert r.status_code == 200
        for lead in r.json()["leads"]:
            assert lead["type"] == "partner"

    def test_patch_status(self):
        if not TestLeads.lead_id:
            pytest.skip("no lead id")
        r = requests.patch(f"{BASE}/api/admin/leads/{TestLeads.lead_id}",
                           json={"status": "contacted"}, headers=ADMIN, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"


# --- Sale campaigns ---
class TestSaleCampaigns:
    def test_admin_list(self):
        r = requests.get(f"{BASE}/api/admin/sale-campaigns", headers=ADMIN, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_fields(self):
        # First cleanup potential leftover
        requests.delete(f"{BASE}/api/admin/sale-campaigns/{CAMPAIGN_SLUG}", headers=ADMIN, timeout=15)
        r = requests.post(f"{BASE}/api/admin/sale-campaigns",
                          json={"slug": CAMPAIGN_SLUG, "title": "Test Sale", "discount_percent": 50, "is_active": True},
                          headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text

        r = requests.get(f"{BASE}/api/admin/sale-campaigns", headers=ADMIN, timeout=15)
        rows = r.json()
        found = [x for x in rows if x["slug"] == CAMPAIGN_SLUG]
        assert found, "campaign not present"
        assert "orders_count" in found[0]
        assert "revenue" in found[0]

    def test_public_get_nonexistent(self):
        r = requests.get(f"{BASE}/api/sale/definitely-not-a-real-slug-xyz-12345", timeout=15)
        assert r.status_code == 404

    def test_public_get_existing(self):
        r = requests.get(f"{BASE}/api/sale/{CAMPAIGN_SLUG}", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "featured" in j
        assert isinstance(j["featured"], list)

    def test_create_fast_test_50(self):
        # Ensure the fast-test-50 exists for FE tests
        requests.delete(f"{BASE}/api/admin/sale-campaigns/{FAST_TEST_SLUG}", headers=ADMIN, timeout=15)
        r = requests.post(f"{BASE}/api/admin/sale-campaigns",
                          json={"slug": FAST_TEST_SLUG, "title": "Fast Test 50 Off",
                                "discount_percent": 50, "is_active": True},
                          headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text

    def test_cleanup(self):
        requests.delete(f"{BASE}/api/admin/sale-campaigns/{CAMPAIGN_SLUG}", headers=ADMIN, timeout=15)


# --- Regression ---
class TestRegression:
    def test_concerns(self):
        r = requests.get(f"{BASE}/api/concerns", timeout=15)
        assert r.status_code == 200

    def test_categories(self):
        r = requests.get(f"{BASE}/api/categories", timeout=15)
        assert r.status_code == 200
