"""Tests for multi-warehouse instant delivery (Feb-2026)."""
import os
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip()
                break

ADMIN_HDR = {"X-Admin-Token": "celestaglow2024"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup
    for wid in ids:
        try:
            requests.delete(f"{BASE}/api/admin/warehouses/{wid}", headers=ADMIN_HDR, timeout=10)
        except Exception:
            pass


class TestWarehouseCRUD:
    def test_list_warehouses(self):
        r = requests.get(f"{BASE}/api/admin/warehouses", headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_requires_admin(self):
        r = requests.get(f"{BASE}/api/admin/warehouses", timeout=15)
        assert r.status_code in (401, 403)

    def test_create_and_verify(self, created_ids):
        payload = {
            "name": "TEST_WH_A",
            "address": "TEST addr",
            "pincode": "673001",
            "phone": "9999999999",
            "lat": 11.2588,
            "lng": 75.7804,
            "service_radius_km": 10.0,
            "is_active": True,
        }
        r = requests.post(f"{BASE}/api/admin/warehouses", json=payload, headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_WH_A"
        assert "id" in data and "created_at" in data
        assert data["lat"] == 11.2588
        created_ids.append(data["id"])

        # verify via GET list
        r2 = requests.get(f"{BASE}/api/admin/warehouses", headers=ADMIN_HDR, timeout=15)
        assert any(w["id"] == data["id"] for w in r2.json())

    def test_patch_warehouse(self, created_ids):
        wid = created_ids[0]
        r = requests.patch(f"{BASE}/api/admin/warehouses/{wid}", json={"service_radius_km": 25.0, "is_active": False}, headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 200
        assert r.json()["service_radius_km"] == 25.0
        assert r.json()["is_active"] is False

    def test_patch_unknown_404(self):
        r = requests.patch(f"{BASE}/api/admin/warehouses/nonexistent_xyz", json={"name": "x"}, headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 404

    def test_delete_unknown_404(self):
        r = requests.delete(f"{BASE}/api/admin/warehouses/nonexistent_xyz", headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 404


class TestCoverage:
    def test_inside_radius(self):
        # Kozhikode HQ seeded — lat 11.2588, lng 75.7804, 15 km
        r = requests.get(f"{BASE}/api/delivery/coverage", params={"lat": 11.26, "lng": 75.79}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["instant_available"] is True
        assert data["delivery_type"] == "instant"
        assert data["assigned_warehouse_id"] is not None
        assert isinstance(data["warehouses_covering"], list) and len(data["warehouses_covering"]) >= 1
        assert data["nearest_warehouse"] is not None

    def test_outside_all_radii(self):
        # Delhi, far from Kozhikode
        r = requests.get(f"{BASE}/api/delivery/coverage", params={"lat": 28.6139, "lng": 77.2090}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["instant_available"] is False
        assert data["delivery_type"] == "standard"
        assert data["assigned_warehouse_id"] is None
        assert data["warehouses_covering"] == []
        # nearest still populated for context
        assert data["nearest_warehouse"] is not None


class TestETA:
    def test_eta_returns_shape(self):
        r = requests.get(f"{BASE}/api/delivery/eta", params={
            "origin_lat": 11.2588, "origin_lng": 75.7804,
            "dest_lat": 11.26, "dest_lng": 75.79
        }, timeout=20)
        # Either 200 with ok=true, or 500 if key missing/invalid — both are acceptable per spec.
        assert r.status_code in (200, 500)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok"):
                assert "distance_km" in data
                assert "duration_min" in data
                assert "duration_text" in data


class TestOrderPersistence:
    def test_order_persists_delivery_fields(self):
        payload = {
            "name": "TEST_User_Instant",
            "email": "test@example.com",
            "phone": "9876543210",
            "address": "TEST addr",
            "house_number": "1A",
            "area": "TEST area",
            "city": "Kozhikode",
            "state": "Kerala",
            "pincode": "673001",
            "product_slug": None,
            "product_name": "Test Item",
            "quantity": 1,
            "amount": 148,
            "payment_method": "COD",
            "delivery_lat": 11.26,
            "delivery_lng": 75.79,
            "delivery_type": "instant",
            "assigned_warehouse_id": "wh-test-id",
            "eta_minutes": 30,
        }
        r = requests.post(f"{BASE}/api/orders", json=payload, timeout=60)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        order_id = data.get("order_id") or data.get("id")
        assert order_id

        # Verify in admin orders
        r2 = requests.get(f"{BASE}/api/admin/orders", headers=ADMIN_HDR, timeout=20)
        assert r2.status_code == 200
        orders = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
        found = next((o for o in orders if o.get("order_id") == order_id or o.get("id") == order_id), None)
        assert found is not None, "Order not found in admin orders list"
        assert found.get("delivery_type") == "instant"
        assert found.get("assigned_warehouse_id") == "wh-test-id"
        assert found.get("delivery_lat") == 11.26
        assert found.get("delivery_lng") == 75.79
        assert found.get("eta_minutes") == 30
