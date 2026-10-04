"""Backend tests for Celesta Glow Jan 2026 iteration 10:
- B5 Admin Power Pack: internal notes, audit log, bulk status, HTML invoice
- B8 Rate limiting middleware (per-IP token bucket)
- B1 Shade swatches on /api/products?niche=cosmetics
- Customer profile/addresses CRUD (session bypassed via direct DB insertion)
- Regression: amount-validation on /api/orders, /api/faqs/skincare reachable

Run order is intentional — rate-limit tests pollute buckets for ~60s, so
they execute AFTER all other admin-login and orders tests.
"""
import os
import time
import secrets
import requests
import pytest
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE = "http://localhost:8001"
ADMIN_PW = "celestaglow2024"
ADMIN_HDR = {"X-Admin-Token": ADMIN_PW}
EXISTING_ORDER = "CG109147"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def customer_session(mongo_db):
    """Insert a synthetic customer + session directly into Mongo (skip OTP)."""
    email = f"test_jan2026_{secrets.token_hex(3)}@example.com"
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    mongo_db.customers.insert_one({
        "customer_id": f"CUST{secrets.token_hex(4).upper()}",
        "email": email,
        "name": "Test Jan2026",
        "phone": "9000000000",
        "created_at": now,
        "addresses": [],
    })
    mongo_db.customer_sessions.insert_one({
        "token": token,
        "email": email,
        "created_at": now,
        "expires_at": now + timedelta(days=1),
    })
    yield {"token": token, "email": email, "headers": {"Authorization": f"Bearer {token}"}}
    mongo_db.customer_sessions.delete_one({"token": token})
    mongo_db.customers.delete_one({"email": email})


# ---------------------------------------------------------------------------
# B1 — Shades on cosmetics
# ---------------------------------------------------------------------------
class TestShades:
    def test_cosmetics_products_have_shades(self):
        r = requests.get(f"{BASE}/api/products", params={"niche": "cosmetics"}, timeout=10)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list) and len(products) > 0
        # At least the curated shade-enabled SKUs must have a non-empty shades array
        shade_required_slugs = {"matte-velvet-lipstick", "matte-finish-foundation",
                                 "lip-cheek-tint", "brow-definer-pencil"}
        seen = {p["slug"]: p for p in products if p["slug"] in shade_required_slugs}
        assert len(seen) >= 2, f"Expected curated shade SKUs in response, got {list(seen.keys())}"
        for slug, p in seen.items():
            assert p.get("requires_shades") is True, f"{slug} requires_shades flag missing"
            shades = p.get("shades") or []
            assert len(shades) >= 1, f"{slug} has no shades populated"
            for sh in shades:
                assert "id" in sh and "name" in sh and "hex" in sh, f"{slug} shade missing required keys"


# ---------------------------------------------------------------------------
# B5 — Admin power pack
# ---------------------------------------------------------------------------
class TestAdminPowerPack:
    def test_add_internal_note(self):
        body = {"note": "TEST_NOTE auto-test", "author": "pytest"}
        r = requests.post(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/notes",
                          json=body, headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d["note"]["note"] == "TEST_NOTE auto-test"
        assert d["note"]["author"] == "pytest"

    def test_list_notes_after_add(self):
        r = requests.get(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/notes",
                         headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["order_id"] == EXISTING_ORDER
        notes = data.get("notes", [])
        assert any(n.get("note") == "TEST_NOTE auto-test" for n in notes), \
            "Just-added note not present in list"

    def test_audit_log_contains_note_event(self):
        r = requests.get(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/audit-log",
                         headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200
        events = r.json().get("events", [])
        assert isinstance(events, list)
        assert any(e.get("event") == "note_added" for e in events), \
            "audit-log should contain at least one note_added event"

    def test_notes_require_admin_token(self):
        r = requests.get(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/notes", timeout=10)
        assert r.status_code == 401

    def test_notes_bad_admin_token(self):
        r = requests.get(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/notes",
                         headers={"X-Admin-Token": "wrong_pw"}, timeout=10)
        assert r.status_code == 403

    def test_invoice_html(self):
        r = requests.get(f"{BASE}/api/admin/orders/{EXISTING_ORDER}/invoice",
                         headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/html")
        body = r.text
        assert EXISTING_ORDER in body
        assert "CELESTA GLOW" in body
        assert "TOTAL" in body

    def test_invoice_unknown_order_404(self):
        r = requests.get(f"{BASE}/api/admin/orders/CG999999/invoice",
                         headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 404

    def test_bulk_status_skip_counting(self, mongo_db):
        # Set EXISTING_ORDER to "processing" via bulk -> then bulk again same target should skip
        body = {"order_ids": [EXISTING_ORDER, "CG_DOES_NOT_EXIST"], "new_status": "processing"}
        r1 = requests.post(f"{BASE}/api/admin/orders/bulk-status",
                           json=body, headers=ADMIN_HDR, timeout=10)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        # First call: either updated=1 (status changed) or skipped=1 (already processing).
        # Either way, missing order is silently dropped (neither counted).
        assert d1["updated"] + d1["skipped"] == 1, d1
        assert d1["total"] == 2

        # Second call with same target — should skip the existing order
        r2 = requests.post(f"{BASE}/api/admin/orders/bulk-status",
                           json=body, headers=ADMIN_HDR, timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["skipped"] == 1, f"Expected order at same status to be skipped; got {d2}"
        assert d2["updated"] == 0

    def test_bulk_status_invalid_target(self):
        r = requests.post(f"{BASE}/api/admin/orders/bulk-status",
                          json={"order_ids": [EXISTING_ORDER], "new_status": "fly_to_moon"},
                          headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Customer profile / addresses (uses synthetic session)
# Note: routes are mounted at /api/auth/* (router prefix is /auth)
# ---------------------------------------------------------------------------
class TestCustomerProfileAddresses:
    """Routes:
      PATCH /api/auth/me
      GET   /api/auth/addresses
      POST  /api/auth/addresses
      DELETE /api/auth/addresses/{id}
    The review-request paths /api/customer/* are NOT the real mount points,
    we test the actual paths.
    """

    def test_get_me(self, customer_session):
        r = requests.get(f"{BASE}/api/auth/me", headers=customer_session["headers"], timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == customer_session["email"]

    def test_patch_me(self, customer_session):
        r = requests.patch(f"{BASE}/api/auth/me",
                           json={"name": "New Name", "phone": "9876543210"},
                           headers=customer_session["headers"], timeout=10)
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user["name"] == "New Name"
        assert user["phone"] == "9876543210"
        # Re-GET to verify persistence
        r2 = requests.get(f"{BASE}/api/auth/me", headers=customer_session["headers"], timeout=10)
        assert r2.json()["user"]["name"] == "New Name"

    def test_patch_me_invalid_phone(self, customer_session):
        r = requests.patch(f"{BASE}/api/auth/me",
                           json={"phone": "123"},
                           headers=customer_session["headers"], timeout=10)
        assert r.status_code == 400

    def test_address_crud_round_trip(self, customer_session):
        h = customer_session["headers"]
        # Start fresh — list addresses
        r0 = requests.get(f"{BASE}/api/auth/addresses", headers=h, timeout=10)
        assert r0.status_code == 200
        start_count = len(r0.json().get("addresses", []))

        # Add address
        addr = {"label": "Home", "name": "Test User", "phone": "9000000000",
                "house_number": "12B", "area": "MG Rd", "pincode": "560001",
                "state": "Karnataka", "is_default": True}
        r1 = requests.post(f"{BASE}/api/auth/addresses", json=addr, headers=h, timeout=10)
        assert r1.status_code == 200, r1.text
        addr_id = r1.json()["address"]["id"]

        # List — must contain new id
        r2 = requests.get(f"{BASE}/api/auth/addresses", headers=h, timeout=10)
        addrs = r2.json()["addresses"]
        assert len(addrs) == start_count + 1
        assert any(a["id"] == addr_id for a in addrs)

        # Delete — list must shrink
        r3 = requests.delete(f"{BASE}/api/auth/addresses/{addr_id}", headers=h, timeout=10)
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE}/api/auth/addresses", headers=h, timeout=10)
        assert len(r4.json()["addresses"]) == start_count

    def test_unauthenticated_addresses_401(self):
        r = requests.get(f"{BASE}/api/auth/addresses", timeout=10)
        assert r.status_code == 401

    def test_customer_path_alias_does_not_exist(self):
        """Document deviation: review-request mentions /api/customer/me but the
        code mounts under /api/auth — this test records that fact."""
        r = requests.get(f"{BASE}/api/customer/me", timeout=10)
        assert r.status_code == 404  # path not found


# ---------------------------------------------------------------------------
# Regression — amount validation + FAQs (kept light, iteration_9 covered deep)
# ---------------------------------------------------------------------------
class TestRegression:
    def test_faqs_skincare_reachable(self):
        r = requests.get(f"{BASE}/api/faqs/skincare", timeout=10)
        assert r.status_code == 200

    def test_amount_mismatch_rejected(self):
        bad = {
            "name": "Test", "phone": "9000000000", "house_number": "1",
            "area": "x", "pincode": "560001", "state": "KA",
            "payment_method": "prepaid",
            "amount": 1.0,  # Definitely mismatched against any real cart
            "items": [{"slug": "matte-velvet-lipstick", "name": "Matte Velvet Lipstick",
                        "quantity": 1, "price": 499}],
        }
        r = requests.post(f"{BASE}/api/orders", json=bad, timeout=15)
        assert r.status_code == 400
        assert "Amount mismatch" in r.text or "mismatch" in r.text.lower()


# ---------------------------------------------------------------------------
# B8 — Rate limiting (run LAST: pollutes buckets for ~60s)
# ---------------------------------------------------------------------------
class TestRateLimiting:
    def test_zz_admin_login_5_per_60s(self):
        """Path key /api/admin/login limit=5/60s — 6th wrong should be 429."""
        url = f"{BASE}/api/admin/login"
        statuses = []
        for _ in range(6):
            r = requests.post(url, json={"password": "wrong-pw"}, timeout=10)
            statuses.append(r.status_code)
        # First 5 must be 401, 6th must be 429
        assert statuses[:5] == [401] * 5, f"Expected 5x401, got {statuses}"
        assert statuses[5] == 429, f"Expected 429 on 6th attempt, got {statuses}"

    def test_zz_orders_10_per_60s(self):
        """Path key /api/orders limit=10/60s — 11th should be 429.
        Use intentionally bad payloads (400) — middleware runs BEFORE validation,
        so even 400-replies consume tokens."""
        url = f"{BASE}/api/orders"
        statuses = []
        for _ in range(11):
            r = requests.post(url, json={}, timeout=10)
            statuses.append(r.status_code)
        assert statuses[10] == 429, f"Expected 429 on 11th attempt, got tail={statuses[-3:]}"

    def test_zz_unmounted_customer_otp_route_returns_404_not_429(self):
        """rate_limit.LIMITS lists /api/customer/send-otp but routes are mounted
        at /api/auth/send-otp — verify the mis-pathed limit key is dead-code
        (request 404s long before 429)."""
        r = requests.post(f"{BASE}/api/customer/send-otp",
                          json={"email": "t@e.com"}, timeout=10)
        assert r.status_code == 404
