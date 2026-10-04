"""
Backend regression tests for the Jan-2026 Celesta Glow referral/withdrawal
overhaul and the deterministic product sort.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"
ADMIN_HDR = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ---------- fixtures ----------
def _mongo():
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ.get("DB_NAME", "test_database")]


@pytest.fixture(scope="module")
def seeded_referral():
    """Insert a clean referral row directly into Mongo (no public seed endpoint)."""
    phone = f"90000{int(time.time()) % 100000:05d}"
    email = f"test_ref_{int(time.time())}@example.com"
    code = f"CGTEST{int(time.time()) % 100000:05d}"
    doc = {
        "referral_code": code,
        "referrer_phone": phone,
        "referrer_email": email,
        "referrer_name": "Pytest Referrer",
        "referrer_order_id": f"SEED_{int(time.time())}",
        "created_at": "2026-01-01T00:00:00+00:00",
        "total_referrals": 0,
        "successful_purchases": 0,
        "total_earnings": 0,
        "earnings_paid": 0,
        "earnings_pending": 0,
        "earnings_withdrawable": 0,
        "referred_orders": [],
        "status": "active",
    }
    db = _mongo()
    db.referrals.insert_one(dict(doc))
    yield {"code": code, "phone": phone, "email": email}


# ---------- 1. /referral/validate ----------
def test_referral_validate_returns_new_fields(seeded_referral):
    code = seeded_referral["code"]
    r = requests.post(f"{BASE_URL}/api/referral/validate", params={"referral_code": code}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["discount"] == 50
    assert data["min_order_amount"] == 500
    assert data["discount_code"] == "WELCOME50"


def test_referral_validate_bad_code():
    r = requests.post(f"{BASE_URL}/api/referral/validate", params={"referral_code": "CG_NOPE_XX"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["valid"] is False


# ---------- 2. /admin/referrals/test-purchase increments earnings_pending by 50 ----------
def test_test_purchase_increments_by_50(seeded_referral):
    code = seeded_referral["code"]
    # Snapshot BEFORE
    before = requests.get(f"{BASE_URL}/api/admin/referrals/{code}", headers=ADMIN_HDR, timeout=10).json()
    pend_before = int(before.get("earnings_pending", 0))
    total_before = int(before.get("total_earnings", 0))

    r = requests.post(f"{BASE_URL}/api/admin/referrals/test-purchase",
                      params={"referral_code": code}, headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["success"] is True
    assert res["earnings_added"] == 50
    assert res["min_order_met"] is True

    after = requests.get(f"{BASE_URL}/api/admin/referrals/{code}", headers=ADMIN_HDR, timeout=10).json()
    assert int(after.get("earnings_pending", 0)) == pend_before + 50
    assert int(after.get("total_earnings", 0)) == total_before + 50


# ---------- 3. /referral/customer-summary shape ----------
def test_customer_summary_shape(seeded_referral):
    r = requests.get(f"{BASE_URL}/api/referral/customer-summary",
                     params={"phone": seeded_referral["phone"]}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    s = data["summary"]
    for key in ("earnings_withdrawable", "earnings_pending", "earnings_paid",
                "cashback_per_referral", "min_order_amount", "return_window_days",
                "orders", "referral_code", "referral_link"):
        assert key in s, f"missing {key} in summary"
    assert s["cashback_per_referral"] == 50
    assert s["min_order_amount"] == 500
    assert s["return_window_days"] == 7
    assert isinstance(s["orders"], list)


def test_customer_summary_missing_returns_none():
    r = requests.get(f"{BASE_URL}/api/referral/customer-summary",
                     params={"phone": "0000000000"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["success"] is False


# ---------- 4. withdrawal request with zero balance returns 400 ----------
def test_request_withdrawal_zero_balance_returns_400():
    # Fresh referral with no earnings (direct Mongo seed)
    phone = f"91111{int(time.time()) % 100000:05d}"
    code = f"CGZERO{int(time.time()) % 100000:05d}"
    db = _mongo()
    db.referrals.insert_one({
        "referral_code": code, "referrer_phone": phone,
        "referrer_email": f"zero_{int(time.time())}@x.com",
        "referrer_name": "Zero Bal", "status": "active",
        "total_earnings": 0, "earnings_paid": 0, "earnings_pending": 0,
        "earnings_withdrawable": 0, "referred_orders": [],
        "total_referrals": 0, "successful_purchases": 0,
    })
    try:
        r = requests.post(f"{BASE_URL}/api/referral/request-withdrawal", json={
            "referral_code": code, "payout_method": "upi", "payout_destination": "x@paytm"
        }, timeout=10)
        assert r.status_code == 400
    finally:
        db.referrals.delete_one({"referral_code": code})


# ---------- 5. withdrawal happy path + duplicate prevention + admin queue ----------
def test_full_withdrawal_flow(seeded_referral):
    """
    - Force a withdrawable balance by directly flipping an order in DB via the
      admin mark-paid legacy endpoint... we don't have that, so instead we use
      the process_delivery_cashback via PUT /orders/{order_id}/status flow.
    - Simpler: manipulate DB balance directly through admin queue by calling
      the service through an internal test-purchase, then manually fast-forward
      using mark-order-paid endpoint.
    Since we can't easily age 7 days in test, we verify the 400 path + admin
    list endpoint are wired correctly.
    """
    # The admin list endpoint must work (empty or not)
    r = requests.get(f"{BASE_URL}/api/admin/withdrawal-requests", headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["requests"], list)

    # status filter
    r2 = requests.get(f"{BASE_URL}/api/admin/withdrawal-requests",
                      params={"status": "pending"}, headers=ADMIN_HDR, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["success"] is True


def test_admin_withdrawal_endpoints_require_auth():
    r = requests.get(f"{BASE_URL}/api/admin/withdrawal-requests", timeout=10)
    assert r.status_code in (401, 403)


def test_mark_paid_nonexistent_returns_400():
    r = requests.post(f"{BASE_URL}/api/admin/withdrawal-requests/WR_NOPE/mark-paid",
                      json={}, headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 400


def test_withdrawal_happy_path_and_duplicate_block():
    """Seed a referral with earnings_withdrawable=50 directly, request a
    withdrawal, confirm admin list has it, confirm a duplicate is blocked,
    then mark-paid and verify balance moves to earnings_paid."""
    phone = f"92222{int(time.time()) % 100000:05d}"
    code = f"CGHAPPY{int(time.time()) % 100000:05d}"
    db = _mongo()
    db.referrals.insert_one({
        "referral_code": code, "referrer_phone": phone,
        "referrer_email": f"happy_{int(time.time())}@x.com",
        "referrer_name": "Happy Path", "status": "active",
        "total_earnings": 50, "earnings_paid": 0, "earnings_pending": 0,
        "earnings_withdrawable": 50, "referred_orders": [],
        "total_referrals": 1, "successful_purchases": 1,
    })
    try:
        # Request withdrawal
        r = requests.post(f"{BASE_URL}/api/referral/request-withdrawal", json={
            "referral_code": code, "payout_method": "upi",
            "payout_destination": "happy@paytm", "note": "test"
        }, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["amount"] == 50
        req_id = body["request_id"]

        # Duplicate — should 400
        r2 = requests.post(f"{BASE_URL}/api/referral/request-withdrawal", json={
            "referral_code": code, "payout_method": "upi",
            "payout_destination": "happy@paytm"
        }, timeout=10)
        assert r2.status_code == 400

        # Admin list contains it
        lst = requests.get(f"{BASE_URL}/api/admin/withdrawal-requests",
                           params={"status": "pending"}, headers=ADMIN_HDR, timeout=10).json()
        ids = [w["request_id"] for w in lst["requests"]]
        assert req_id in ids

        # Mark paid
        mp = requests.post(
            f"{BASE_URL}/api/admin/withdrawal-requests/{req_id}/mark-paid",
            json={"txn_ref": "TXN123"}, headers=ADMIN_HDR, timeout=10)
        assert mp.status_code == 200, mp.text
        assert mp.json()["success"] is True

        # Balances moved
        after = db.referrals.find_one({"referral_code": code})
        assert after["earnings_paid"] == 50
        assert after["earnings_withdrawable"] == 0
    finally:
        db.referrals.delete_one({"referral_code": code})
        db.withdrawal_requests.delete_many({"referral_code": code})


def test_reject_withdrawal():
    phone = f"93333{int(time.time()) % 100000:05d}"
    code = f"CGREJ{int(time.time()) % 100000:05d}"
    db = _mongo()
    db.referrals.insert_one({
        "referral_code": code, "referrer_phone": phone,
        "referrer_email": f"rej_{int(time.time())}@x.com",
        "referrer_name": "Reject Path", "status": "active",
        "total_earnings": 50, "earnings_paid": 0, "earnings_pending": 0,
        "earnings_withdrawable": 50, "referred_orders": [],
        "total_referrals": 1, "successful_purchases": 1,
    })
    try:
        body = requests.post(f"{BASE_URL}/api/referral/request-withdrawal", json={
            "referral_code": code, "payout_method": "upi", "payout_destination": "r@paytm"
        }, timeout=10).json()
        req_id = body["request_id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/withdrawal-requests/{req_id}/reject",
            json={"reason": "invalid upi"}, headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200
        assert r.json()["success"] is True
        doc = db.withdrawal_requests.find_one({"request_id": req_id})
        assert doc["status"] == "rejected"
    finally:
        db.referrals.delete_one({"referral_code": code})
        db.withdrawal_requests.delete_many({"referral_code": code})


# ---------- 6. /api/products sort determinism ----------
def test_products_sort_is_deterministic():
    url = f"{BASE_URL}/api/products"
    params = {"niche": "cosmetics", "page": 1, "limit": 50, "sort": "sort_order"}
    r1 = requests.get(url, params=params, timeout=15)
    r2 = requests.get(url, params=params, timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200
    items1 = [p["slug"] for p in r1.json().get("items", [])]
    items2 = [p["slug"] for p in r2.json().get("items", [])]
    assert items1 == items2, f"Order differs between calls:\n{items1}\n{items2}"


def test_products_legacy_non_paginated():
    # No page/limit → plain list (back-compat). Cap at 5000.
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 5000


# ---------- 7. cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(seeded_referral):
    yield
    # Best-effort: remove the seeded referral we created
    try:
        from pymongo import MongoClient
        mongo = MongoClient(os.environ.get("MONGO_URL"))
        db_name = os.environ.get("DB_NAME", "test_database")
        mongo[db_name].referrals.delete_one({"referral_code": seeded_referral["code"]})
        mongo[db_name].withdrawal_requests.delete_many({"referral_code": seeded_referral["code"]})
    except Exception:
        pass
