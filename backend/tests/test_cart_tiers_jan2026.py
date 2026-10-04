"""
Backend tests for the new tiered delivery + tax structure on /api/cart/validate.

Spec verified:
  a) subtotal < ₹1000  → delivery=49, tax=99, tax_reduction_pct=0, label=None
  b) >= ₹1000           → delivery=39, tax=69, tax_reduction_pct=30, label='30% OFF'
  c) >= ₹1500           → delivery=29, tax=64, tax_reduction_pct=35
  d) >= ₹2000           → delivery=29, tax=59, tax_reduction_pct=40
  e) >= ₹2500           → delivery=19, tax=59, tax_reduction_pct=40
  f) >= ₹5000           → delivery=19, tax=50, tax_reduction_pct=50

Also validates:
  - delivery_fee_original=49 and tax_charges_original=99 always present
  - next_tier object correct for tiers below the top
  - inactive/TBL slugs are dropped from response (so FE can prune)
  - coupon APR26 still applies
  - invalid coupon ignored
  - free-shipping nudge messaging
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
VALIDATE = f"{BASE_URL}/api/cart/validate"

# Cheapest reliable active product picked from /api/products
ACTIVE_SLUG = "anti-aging-serum"  # MRP 1699, sells at ~999 currently


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _validate(session, items, coupon=None, gift_card=None):
    payload = {"items": items}
    if coupon:
        payload["coupon_code"] = coupon
    if gift_card:
        payload["gift_card_code"] = gift_card
    r = session.post(VALIDATE, json=payload, timeout=20)
    assert r.status_code == 200, f"validate failed {r.status_code}: {r.text[:300]}"
    return r.json()


def _subtotal_for(session, qty):
    """Return the active product's per-unit subtotal-contributing price."""
    d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": qty}])
    return d["subtotal"]


# ----- Tier tests -----

def _find_qty_for_subtotal(session, target_low, target_high=None):
    """Binary-ish: increment qty until subtotal lands in [target_low, target_high or infinity)."""
    for q in range(1, 60):
        sub = _subtotal_for(session, q)
        if sub >= target_low and (target_high is None or sub < target_high):
            return q, sub
    raise RuntimeError(f"could not reach subtotal {target_low}")


class TestTiers:
    """Validate the 6 tiered pricing bands."""

    def test_a_below_1000(self, session):
        # qty=1 → subtotal=999 (< 1000)
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 1}])
        assert d["subtotal"] < 1000, f"need <1000 got {d['subtotal']}"
        assert d["delivery_fee"] == 49
        assert d["tax_charges"] == 99
        assert d["tax_reduction_pct"] == 0
        assert d["tax_reduction_label"] is None
        assert d["delivery_fee_original"] == 49
        assert d["tax_charges_original"] == 99
        assert d["next_tier"] is not None
        assert d["next_tier"]["threshold"] == 1000

    def test_b_1000_to_1500(self, session):
        # mix to land in 1000..1500
        d = _validate(session, [
            {"product_slug": "under-eye-cream", "quantity": 1},
            {"product_slug": "sunscreen", "quantity": 1},
        ])
        assert 1000 <= d["subtotal"] < 1500, d["subtotal"]
        assert d["delivery_fee"] == 39
        assert d["tax_charges"] == 69
        assert d["tax_reduction_pct"] == 30
        assert d["tax_reduction_label"] == "30% OFF"
        assert d["next_tier"]["threshold"] == 1500

    def test_c_1500_to_2000(self, session):
        q, sub = _find_qty_for_subtotal(session, 1500, 2000)
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": q}])
        assert 1500 <= d["subtotal"] < 2000, d["subtotal"]
        assert d["delivery_fee"] == 29
        assert d["tax_charges"] == 64
        assert d["tax_reduction_pct"] == 35
        assert d["next_tier"]["threshold"] == 2000

    def test_d_2000_to_2500(self, session):
        # mix to land in 2000..2500
        d = _validate(session, [
            {"product_slug": ACTIVE_SLUG, "quantity": 1},  # 999
            {"product_slug": "under-eye-cream", "quantity": 1},  # 549
            {"product_slug": "sunscreen", "quantity": 1},  # 499
        ])
        assert 2000 <= d["subtotal"] < 2500, d["subtotal"]
        assert d["delivery_fee"] == 29
        assert d["tax_charges"] == 59
        assert d["tax_reduction_pct"] == 40
        assert d["next_tier"]["threshold"] == 2500

    def test_e_2500_to_5000(self, session):
        q, sub = _find_qty_for_subtotal(session, 2500, 5000)
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": q}])
        assert 2500 <= d["subtotal"] < 5000, d["subtotal"]
        assert d["delivery_fee"] == 19
        assert d["tax_charges"] == 59
        assert d["tax_reduction_pct"] == 40
        assert d["next_tier"]["threshold"] == 5000

    def test_f_above_5000(self, session):
        q, sub = _find_qty_for_subtotal(session, 5000)
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": q}])
        assert d["subtotal"] >= 5000, d["subtotal"]
        assert d["delivery_fee"] == 19
        assert d["tax_charges"] == 50
        assert d["tax_reduction_pct"] == 50
        # Top tier → next_tier should be None
        assert d["next_tier"] is None


class TestQtyPruning:
    """Inactive/TBL/unknown slugs must be dropped from items so FE can prune localStorage."""

    def test_unknown_slug_dropped(self, session):
        d = _validate(session, [
            {"product_slug": ACTIVE_SLUG, "quantity": 2},
            {"product_slug": "nonexistent-product-slug", "quantity": 3},
        ])
        slugs = [it["slug"] for it in d["items"]]
        assert ACTIVE_SLUG in slugs
        assert "nonexistent-product-slug" not in slugs
        assert d["item_count"] == 2


class TestRegression:
    """Coupons, gift card, free-shipping nudge."""

    def test_coupon_apr26(self, session):
        d_no = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 2}])
        d_yes = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 2}], coupon="APR26")
        # APR26 should produce a discount > 0
        assert d_yes["discount"] > 0
        assert d_yes["total"] < d_no["total"]

    def test_coupon_welcome50(self, session):
        d_yes = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 2}], coupon="WELCOME50")
        assert d_yes["discount"] >= 0  # coupon may be conditional but must not error

    def test_invalid_coupon(self, session):
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 2}], coupon="BOGUS_CODE_XYZ")
        assert d["discount"] == 0

    def test_invalid_gift_card(self, session):
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 2}], gift_card="FAKE-GC-CODE")
        # Should not 500. Either ignored or error message in gift_card field.
        gc = d.get("gift_card")
        if gc:
            assert "error" in gc or "code" in gc

    def test_free_ship_nudge_below_1000(self, session):
        d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": 1}])
        assert d["subtotal"] < 1000
        assert d["next_tier"] is not None
        assert "spend_more" in d["next_tier"]
        assert d["next_tier"]["spend_more"] > 0

    def test_originals_always_present(self, session):
        for q in [1, 2, 4]:
            d = _validate(session, [{"product_slug": ACTIVE_SLUG, "quantity": q}])
            assert d["delivery_fee_original"] == 49
            assert d["tax_charges_original"] == 99
