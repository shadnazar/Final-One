"""Iteration 2 backend regression tests for Celesta Glow.

Covers:
- POST /api/routines/save (public)
- GET /api/admin/routines (admin)
- GET /api/admin/retention/reorder (admin + employee+retention)
- GET /api/admin/retention/customers (admin + employee+retention)
- POST /api/admin/employees returns login_url + login_message honoring Origin
- AI /api/admin/ai/generate-product-content uses Emergent LLM key
- Employee retention permission gate
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://design-cgu.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_PASSWORD", "celestaglow2024")
ORIGIN = "https://design-cgu.preview.emergentagent.com"

ADMIN_HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ---------- Routines ----------
class TestRoutines:
    saved_id = None

    def test_save_routine_public(self):
        payload = {
            "skin_type": "oily",
            "age": "25-30",
            "concerns": ["acne"],
            "am": [],
            "pm": [],
            "phone": "9876543210",
            "name": "TEST_Routine_User",
        }
        r = requests.post(f"{BASE_URL}/api/routines/save", json=payload, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
        TestRoutines.saved_id = data["id"]

    def test_list_routines_admin(self):
        assert TestRoutines.saved_id, "save test must run first"
        r = requests.get(f"{BASE_URL}/api/admin/routines", headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "routines" in data and "count" in data
        assert isinstance(data["routines"], list)
        # saved routine should be present
        ids = [x.get("id") for x in data["routines"]]
        assert TestRoutines.saved_id in ids

    def test_list_routines_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/routines", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Retention ----------
class TestRetention:
    def test_reorder_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/retention/reorder", headers=ADMIN_HEADERS, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "customers" in data and "count" in data
        assert isinstance(data["customers"], list)

    def test_retention_customers_15(self):
        r = requests.get(f"{BASE_URL}/api/admin/retention/customers?days=15", headers=ADMIN_HEADERS, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # whatever shape, should be a dict / list
        assert isinstance(data, (list, dict))

    def test_reorder_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/retention/reorder", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Employees ----------
class TestEmployees:
    username = f"testemp_{uuid.uuid4().hex[:6]}"
    password = None
    token = None

    def test_create_employee_with_login_url(self):
        payload = {
            "username": TestEmployees.username,
            "name": "Test Employee",
            "permissions": {"products": True, "retention": True},
        }
        headers = {**ADMIN_HEADERS, "Origin": ORIGIN}
        r = requests.post(f"{BASE_URL}/api/admin/employees", json=payload, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("password"), "employee password must be returned"
        # Save password/username FIRST so dependent tests can run even if login_url assertion fails
        TestEmployees.password = data["password"]
        assert "login_message" in data and TestEmployees.username in data["login_message"]
        # Known issue: K8s ingress appears to strip/overwrite Origin, so login_url ends up
        # with the internal cluster URL (*.emergentcf.cloud) instead of the public one
        # (*.emergentagent.com). This is tracked as a frontend integration blocker.
        login_url = data.get("login_url", "")
        assert login_url.endswith("/employee/login"), f"login_url must end with /employee/login, got {login_url}"
        assert login_url == f"{ORIGIN}/employee/login", (
            f"BUG: login_url should use public Origin {ORIGIN} but got '{login_url}'. "
            "The Origin header sent by the admin UI appears to be overwritten by the K8s ingress. "
            "Recommend: set PUBLIC_APP_URL=https://design-cgu.preview.emergentagent.com in backend/.env."
        )

    def test_employee_login_returns_token(self):
        assert TestEmployees.password, "create test must run first"
        r = requests.post(
            f"{BASE_URL}/api/employee/login",
            json={"username": TestEmployees.username, "password": TestEmployees.password},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") and data.get("token")
        TestEmployees.token = data["token"]
        # validate permissions came back with retention & products
        perms = data.get("employee", {}).get("permissions", {})
        assert perms.get("retention") is True
        assert perms.get("products") is True

    def test_employee_can_access_retention_customers(self):
        assert TestEmployees.token, "login test must run first"
        headers = {"X-Employee-Token": TestEmployees.token}
        r = requests.get(f"{BASE_URL}/api/admin/retention/customers?days=15", headers=headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_employee_can_access_retention_reorder(self):
        assert TestEmployees.token, "login test must run first"
        headers = {"X-Employee-Token": TestEmployees.token}
        r = requests.get(f"{BASE_URL}/api/admin/retention/reorder", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        assert "customers" in r.json()

    def test_employee_can_post_retention_note(self):
        assert TestEmployees.token, "login test must run first"
        headers = {"X-Employee-Token": TestEmployees.token, "Content-Type": "application/json"}
        payload = {
            "order_id": "TEST_NONEXISTENT_ORDER",
            "status": "callback",
            "note": "TEST note from automated test",
        }
        r = requests.post(f"{BASE_URL}/api/admin/retention/note", json=payload, headers=headers, timeout=15)
        # The route only requires permission; endpoint likely accepts and upserts the note (even for synthetic order_id).
        # We just want to assert it's not an auth failure.
        assert r.status_code not in (401, 403), f"Employee with retention perm was blocked: {r.status_code} {r.text}"

    def test_cleanup_delete_employee(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/employees/{TestEmployees.username}",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert r.status_code == 200, r.text


# ---------- AI Studio ----------
class TestAIStudio:
    def test_generate_product_content(self):
        payload = {
            "name": "Niacinamide Serum",
            "niche": "skincare",
            "key_ingredients": "Niacinamide, Vitamin C",
            "concerns": ["acne"],
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/ai/generate-product-content",
            json=payload,
            headers=ADMIN_HEADERS,
            timeout=90,
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("success") is True
        # Required keys (non-empty strings/lists)
        for k in ("tagline", "description", "key_ingredients", "ingredients_full", "benefits"):
            assert k in data, f"missing {k}"
            assert data[k], f"{k} empty"
