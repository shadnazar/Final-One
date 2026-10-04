"""
Iter 9 — Celesta Glow security hardening + niche FAQ tests.

Covers:
- POST /api/orders server-side amount recalculation (reject mismatch / accept correct)
- POST /api/orders server-side coupon validation (invalid coupon ignored)
- POST /api/orders server-side referral discount validation
- POST /api/verify-payment returns 503 when Razorpay not configured
- GET /api/faqs/{niche} returns 8+ detailed FAQs
- POST /api/faqs/{niche}/refresh requires admin token (401 without)
- Existing endpoints still work: /api/products, /api/cart/validate, /api/admin/orders
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://shop-glow.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "celestaglow2024"


# ---------- Shared fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    """Login and return admin session token."""
    r = session.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    return data.get("token")


# Standard valid address payload
def _base_order_payload(amount, items=None, payment_method="COD", **kwargs):
    return {
        "name": "TEST_Customer",
        "phone": "9999999999",
        "house_number": "12A",
        "area": "MG Road",
        "pincode": "560001",
        "state": "Karnataka",
        "payment_method": payment_method,
        "amount": amount,
        "items": items or [{"slug": "anti-aging-serum", "name": "Anti Aging Serum", "quantity": 1}],
        **kwargs,
    }


# =====================================================
# Existing endpoints sanity
# =====================================================
class TestExistingEndpoints:
    def test_get_products(self, session):
        r = session.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        slugs = [p.get("slug") for p in data]
        assert "anti-aging-serum" in slugs, "seed product missing"

    def test_cart_validate(self, session):
        # cart/validate exists in products router
        payload = {"items": [{"slug": "anti-aging-serum", "quantity": 1}]}
        r = session.post(f"{BASE_URL}/api/cart/validate", json=payload)
        assert r.status_code in (200, 400, 422), f"unexpected status {r.status_code}: {r.text}"

    def test_admin_orders_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/admin/orders")
        assert r.status_code == 401

    def test_admin_orders_with_auth(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"X-Admin-Token": admin_token},
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# =====================================================
# Order security: amount mismatch / coupon / referral
# =====================================================
class TestOrderAmountSecurity:
    def test_reject_amount_mismatch(self, session):
        """Client sends 99999 but server-side actual = 1099 (COD price for anti-aging-serum)."""
        payload = _base_order_payload(amount=99999, payment_method="COD")
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 400, f"expected 400 amount mismatch, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "mismatch" in detail.lower(), f"detail did not mention mismatch: {detail}"

    def test_accept_correct_amount_cod(self, session):
        """COD: anti-aging-serum cod_price=1099, subtotal=1099, >=499 so shipping=0 -> final=1099."""
        payload = _base_order_payload(amount=1099, payment_method="COD")
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        order = r.json()
        assert "order_id" in order
        assert order["order_id"].startswith("CG")
        assert abs(float(order["amount"]) - 1099) <= 1.0

    def test_accept_correct_amount_prepaid(self, session):
        """Prepaid: anti-aging-serum prepaid_price=999, >=499 so free shipping -> 999."""
        payload = _base_order_payload(amount=999, payment_method="ONLINE")
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        order = r.json()
        assert abs(float(order["amount"]) - 999) <= 1.0

    def test_invalid_coupon_is_ignored(self, session):
        """Client sends invalid coupon w/ discount — server must ignore discount,
        so client_amount that assumes discount must mismatch and be rejected."""
        # Pretend a fake 500-off coupon. Server should NOT apply it -> server_final=1099 (COD)
        # Client sends amount=599 (1099-500). That mismatches -> 400.
        payload = _base_order_payload(
            amount=599,
            payment_method="COD",
            coupon_code="FAKE_NONEXISTENT_COUPON_XYZ",
            coupon_discount=500,
        )
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 400, f"expected 400 (coupon ignored => mismatch), got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "mismatch" in detail.lower()

    def test_invalid_coupon_correct_amount_accepts(self, session):
        """Invalid coupon ignored: if client sends the correct full amount, order succeeds
        and coupon is not recorded."""
        payload = _base_order_payload(
            amount=1099,
            payment_method="COD",
            coupon_code="FAKE_NONEXISTENT_COUPON_XYZ",
            coupon_discount=0,
        )
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        order = r.json()
        # Server overrode coupon_code to None because invalid
        assert not order.get("coupon_code"), f"invalid coupon should be cleared, got {order.get('coupon_code')}"

    def test_invalid_referral_is_ignored(self, session):
        """Invalid referral code => server_referral_discount=0. Client trying to claim
        50-off via fake referral with amount=1049 should be rejected (mismatch)."""
        payload = _base_order_payload(
            amount=1049,
            payment_method="COD",
            referral_code="FAKEREFERRAL_XYZ_999",
            referral_discount=50,
        )
        r = session.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 400, f"expected 400 (referral ignored => mismatch), got {r.status_code}: {r.text}"


# =====================================================
# Razorpay verify-payment 503
# =====================================================
class TestPaymentVerification:
    def test_verify_payment_returns_503_when_not_configured(self, session):
        payload = {
            "razorpay_order_id": "order_fake",
            "razorpay_payment_id": "pay_fake",
            "razorpay_signature": "sig_fake",
        }
        r = session.post(f"{BASE_URL}/api/verify-payment", json=payload)
        assert r.status_code == 503, f"expected 503 razorpay not configured, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "").lower()
        assert "razorpay" in detail or "not configured" in detail

    def test_create_razorpay_order_returns_503(self, session):
        r = session.post(f"{BASE_URL}/api/create-razorpay-order", json={"amount": 999})
        assert r.status_code == 503


# =====================================================
# Niche FAQs
# =====================================================
class TestNicheFAQs:
    def _get_faqs(self, session, niche):
        r = session.get(f"{BASE_URL}/api/faqs/{niche}", timeout=90)
        assert r.status_code == 200, f"{niche} -> {r.status_code}: {r.text[:300]}"
        return r.json()

    def test_skincare_faqs(self, session):
        data = self._get_faqs(session, "skincare")
        assert data.get("niche") == "skincare"
        faqs = data.get("faqs", [])
        assert len(faqs) >= 8, f"expected 8+ FAQs, got {len(faqs)}"
        assert all("q" in f and "a" in f for f in faqs)
        # Detailed answers (>= 100 chars) — guard against shallow generic FAQs
        assert all(len(f["a"]) >= 100 for f in faqs), "answers too short / not detailed"

    def test_cosmetics_faqs(self, session):
        data = self._get_faqs(session, "cosmetics")
        faqs = data.get("faqs", [])
        assert len(faqs) >= 8, f"expected 8+ FAQs, got {len(faqs)}"
        assert all(len(f["a"]) >= 100 for f in faqs)

    def test_antiaging_faqs(self, session):
        data = self._get_faqs(session, "anti-aging")
        faqs = data.get("faqs", [])
        assert len(faqs) >= 4, f"expected 4+ FAQs for anti-aging, got {len(faqs)}"

    def test_refresh_requires_admin_token(self, session):
        r = session.post(f"{BASE_URL}/api/faqs/skincare/refresh")
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code}"

    def test_refresh_with_invalid_token(self, session):
        r = session.post(
            f"{BASE_URL}/api/faqs/skincare/refresh",
            headers={"X-Admin-Token": "wrong-token-xyz"},
        )
        assert r.status_code == 401
