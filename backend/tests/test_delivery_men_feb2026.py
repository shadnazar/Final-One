"""Backend tests for Delivery Men roster + order delivery-assign (Feb-2026)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_TOKEN = "celestaglow2024"
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}
BAD_HEADERS = {"X-Admin-Token": "wrong", "Content-Type": "application/json"}
TIMEOUT = 45


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    for i in ids:
        try:
            requests.delete(f"{BASE_URL}/api/admin/delivery-men/{i}", headers=HEADERS, timeout=TIMEOUT)
        except Exception:
            pass


class TestDeliveryMen:
    def test_auth_required_list(self):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-men", timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.text

    def test_auth_required_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-men", headers=BAD_HEADERS, timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.text

    def test_create_valid_10_digit(self, created_ids):
        payload = {"name": "TEST_Rider_A", "whatsapp_number": "9876500001"}
        r = requests.post(f"{BASE_URL}/api/admin/delivery-men", json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Rider_A"
        assert data["whatsapp_number"] == "919876500001"  # 91 prepended
        assert data["active"] is True
        assert "id" in data
        created_ids.append(data["id"])

    def test_create_reject_empty_name(self):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-men",
                          json={"name": "", "whatsapp_number": "9876500002"},
                          headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 422, r.text

    def test_create_reject_short_number(self):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-men",
                          json={"name": "TEST_Bad", "whatsapp_number": "12345"},
                          headers=HEADERS, timeout=TIMEOUT)
        # Either 422 (pydantic min_length=8) or 400 (invalid after cleaning)
        assert r.status_code in (400, 422), r.text

    def test_list_contains_created(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-men", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if created_ids:
            assert any(d.get("id") == created_ids[0] for d in arr)

    def test_patch_updates_fields(self, created_ids):
        assert created_ids, "Need created id"
        mid = created_ids[0]
        r = requests.patch(f"{BASE_URL}/api/admin/delivery-men/{mid}",
                           json={"name": "TEST_Rider_A_Updated", "active": False},
                           headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST_Rider_A_Updated"
        assert r.json()["active"] is False

    def test_patch_404_unknown(self):
        r = requests.patch(f"{BASE_URL}/api/admin/delivery-men/nonexistent_{uuid.uuid4().hex[:6]}",
                           json={"active": True}, headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 404, r.text

    def test_delete_404_unknown(self):
        r = requests.delete(f"{BASE_URL}/api/admin/delivery-men/nonexistent_{uuid.uuid4().hex[:6]}",
                            headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 404, r.text

    def test_delete_valid(self, created_ids):
        # Create a new one specifically to delete
        r = requests.post(f"{BASE_URL}/api/admin/delivery-men",
                          json={"name": "TEST_ToDelete", "whatsapp_number": "9876500099"},
                          headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200
        mid = r.json()["id"]
        r = requests.delete(f"{BASE_URL}/api/admin/delivery-men/{mid}", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200
        # Verify not in list
        arr = requests.get(f"{BASE_URL}/api/admin/delivery-men", headers=HEADERS, timeout=TIMEOUT).json()
        assert not any(d.get("id") == mid for d in arr)


class TestDeliveryAssign:
    def _find_order_id(self):
        # Attempt to get orders via admin endpoint
        for path in ("/api/admin/orders", "/api/orders"):
            try:
                r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=TIMEOUT)
                if r.status_code == 200:
                    data = r.json()
                    orders = data if isinstance(data, list) else data.get("orders", [])
                    if orders:
                        oid = orders[0].get("order_id") or orders[0].get("id")
                        if oid:
                            return oid
            except Exception:
                continue
        return None

    def test_assign_404_unknown_order(self):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/NOPE_{uuid.uuid4().hex[:6]}/delivery-assign",
                           json={"delivery_type": "instant"}, headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 404, r.text

    def test_assign_reject_invalid_type(self):
        oid = self._find_order_id() or "ANY"
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{oid}/delivery-assign",
                           json={"delivery_type": "express"}, headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 400, r.text

    def test_assign_auth_required(self):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/ANY/delivery-assign",
                           json={"delivery_type": "instant"}, timeout=TIMEOUT)
        assert r.status_code in (401, 403), r.text

    def test_assign_success_if_order_exists(self, created_ids):
        oid = self._find_order_id()
        if not oid:
            pytest.skip("No orders in DB — cannot verify assign path")
        assert created_ids, "Need a delivery man"
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{oid}/delivery-assign",
                           json={"delivery_man_id": created_ids[0], "delivery_type": "instant"},
                           headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("assigned_delivery_man_id") == created_ids[0]
        assert body.get("delivery_type") == "instant"
