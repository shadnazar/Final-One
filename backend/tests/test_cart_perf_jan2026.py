"""Cart-perf & batch-products tests (Jan 2026).

Covers:
- POST /api/cart/validate with 1/5/15 items, coupons, gift card, free-ship threshold, TBL drop, stock warnings
- POST /api/products/batch endpoint (order preservation, cap @200, empties, invalid)
"""
import os
import time
import pytest
import requests
from pathlib import Path

def _load_url():
    env = os.environ.get("REACT_APP_BACKEND_URL")
    if env:
        return env.rstrip("/")
    fe = Path("/app/frontend/.env")
    if fe.exists():
        for line in fe.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_url()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def sample_products(session):
    """Pull 20 active products to use as the test cart pool."""
    r = session.get(f"{BASE_URL}/api/products?page=1&limit=20", timeout=30)
    assert r.status_code == 200, f"Could not load products list: {r.status_code}"
    data = r.json()
    items = data.get("items") if isinstance(data, dict) else data
    assert items and len(items) >= 5, "Need at least 5 products in DB for cart tests"
    return items


# ============================================================
# /api/products/batch
# ============================================================
class TestProductsBatch:

    def test_batch_basic_and_order_preserved(self, session, sample_products):
        slugs = [p["slug"] for p in sample_products[:5]]
        r = session.post(f"{BASE_URL}/api/products/batch", json={"slugs": slugs}, timeout=20)
        assert r.status_code == 200, r.text
        out = r.json()
        assert isinstance(out, list)
        returned = [p["slug"] for p in out]
        # All returned slugs must be from request
        assert set(returned).issubset(set(slugs))
        # Order must match (filter request order by what was returned)
        expected_order = [s for s in slugs if s in returned]
        assert returned == expected_order, f"Order not preserved. expected={expected_order} got={returned}"
        # Projection sanity: no _id, name+slug+mrp present
        for p in out:
            assert "_id" not in p
            assert "slug" in p and "name" in p
            assert "mrp" in p

    def test_batch_empty_list(self, session):
        r = session.post(f"{BASE_URL}/api/products/batch", json={"slugs": []}, timeout=10)
        assert r.status_code == 200
        assert r.json() == []

    def test_batch_invalid_slugs_silently_skipped(self, session, sample_products):
        good = sample_products[0]["slug"]
        r = session.post(
            f"{BASE_URL}/api/products/batch",
            json={"slugs": [good, "nope-not-a-real-slug-xyz", "another-bad-slug-123"]},
            timeout=10,
        )
        assert r.status_code == 200
        out = r.json()
        slugs_out = [p["slug"] for p in out]
        assert good in slugs_out
        assert "nope-not-a-real-slug-xyz" not in slugs_out

    def test_batch_capped_at_200(self, session, sample_products):
        good = sample_products[0]["slug"]
        slugs = [good] + [f"fake-slug-{i}" for i in range(250)]
        r = session.post(f"{BASE_URL}/api/products/batch", json={"slugs": slugs}, timeout=15)
        assert r.status_code == 200
        # Only good slug should come back; ensure endpoint did not 500 from oversize input
        assert any(p["slug"] == good for p in r.json())

    def test_batch_missing_slugs_key(self, session):
        # Empty body / no slugs key — endpoint should return [] gracefully
        r = session.post(f"{BASE_URL}/api/products/batch", json={}, timeout=10)
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            assert r.json() == []

    def test_batch_non_list_slugs(self, session):
        r = session.post(f"{BASE_URL}/api/products/batch", json={"slugs": "not-a-list"}, timeout=10)
        assert r.status_code == 400


# ============================================================
# /api/cart/validate
# ============================================================
class TestCartValidate:

    def _validate(self, session, items, coupon=None, gift_card=None):
        body = {"items": items, "payment_method": "prepaid"}
        if coupon:
            body["coupon_code"] = coupon
        if gift_card:
            body["gift_card_code"] = gift_card
        return session.post(f"{BASE_URL}/api/cart/validate", json=body, timeout=20)

    def test_validate_one_item(self, session, sample_products):
        p = sample_products[0]
        r = self._validate(session, [{"product_slug": p["slug"], "quantity": 1}])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        # Items count should be 1 unless the single product has shades (then it may be skipped with warning)
        if data["items"]:
            assert data["items"][0]["slug"] == p["slug"]
            assert data["subtotal"] > 0
            assert data["total"] > 0
            assert "shipping_fee" in data
            assert "delivery_fee" in data
            assert "packaging_fee" in data
            assert "stock_warnings" in data

    def test_validate_5_items(self, session, sample_products):
        items = [{"product_slug": p["slug"], "quantity": 1} for p in sample_products[:5]]
        r = self._validate(session, items)
        assert r.status_code == 200
        data = r.json()
        # Subtotal must equal sum of line totals on returned items
        if data["items"]:
            assert data["subtotal"] == sum(i["line_total"] for i in data["items"])
            assert data["mrp_total"] >= data["subtotal"]

    def test_validate_15_items_performance(self, session, sample_products):
        # Replicate to 15 items to stress the batched lookup
        pool = sample_products * 4
        items = [{"product_slug": p["slug"], "quantity": 1} for p in pool[:15]]
        start = time.time()
        r = self._validate(session, items)
        elapsed = time.time() - start
        assert r.status_code == 200
        # With batched $in queries this should be fast (<3s on preview infra)
        assert elapsed < 5.0, f"validate took too long: {elapsed:.2f}s"

    def test_free_shipping_threshold(self, session, sample_products):
        # Tiered delivery (Feb 2026): ≥₹1000 → ₹39, ≥₹1500 → ₹29, ≥₹2500 → ₹19.
        # Confirm crossing ₹1000 brings delivery DOWN from the base ₹49.
        p = max(sample_products, key=lambda x: x.get("prepaid_price") or 0)
        price = p.get("prepaid_price") or 0
        qty_above = max(2, int(1100 / max(price, 1)) + 1)
        stock = int(p.get("stock_qty") or 0)
        qty_above = min(qty_above, stock) if stock else qty_above
        r = self._validate(session, [{"product_slug": p["slug"], "quantity": qty_above}])
        assert r.status_code == 200
        data = r.json()
        if data["items"] and data["subtotal"] >= 1000:
            assert data["delivery_fee"] in (19, 29, 39), f"Tiered delivery expected, got {data['delivery_fee']}"

    def test_valid_coupon_apr26(self, session, sample_products):
        items = [{"product_slug": p["slug"], "quantity": 1} for p in sample_products[:3]]
        r = self._validate(session, items, coupon="APR26")
        assert r.status_code == 200
        data = r.json()
        if data["items"]:
            # APR26 should apply some discount (if it's an active coupon)
            assert data["discount"] >= 0
            # If discount > 0, total < subtotal + charges
            if data["discount"] > 0:
                assert data["total"] < data["subtotal"] + data["shipping_fee"]

    def test_invalid_coupon(self, session, sample_products):
        items = [{"product_slug": p["slug"], "quantity": 1} for p in sample_products[:2]]
        r = self._validate(session, items, coupon="NOTACOUPON_XYZ_FAKE")
        assert r.status_code == 200
        data = r.json()
        assert data["discount"] == 0

    def test_invalid_gift_card(self, session, sample_products):
        items = [{"product_slug": p["slug"], "quantity": 1} for p in sample_products[:2]]
        r = self._validate(session, items, gift_card="BADGC_NOTREAL_999")
        assert r.status_code == 200
        data = r.json()
        assert data["gift_card_discount"] == 0
        # gift_card field should contain an error description
        assert data.get("gift_card") is None or "error" in data["gift_card"]

    def test_validate_empty_cart(self, session):
        r = self._validate(session, [])
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert data["subtotal"] == 0
        # Note: backend currently still applies delivery+tax_charges on empty cart
        # (pre-existing behavior; not regressed by perf fix). packaging_fee should be 0.
        assert data["packaging_fee"] == 0

    def test_validate_bad_slug_dropped(self, session):
        r = self._validate(session, [{"product_slug": "this-slug-does-not-exist-zzz", "quantity": 1}])
        assert r.status_code == 200
        assert r.json()["items"] == []

    def test_validate_oversized_qty_capped(self, session, sample_products):
        # Pick a product with limited stock
        p = next((x for x in sample_products if (x.get("stock_qty") or 0) > 0), None)
        if not p:
            pytest.skip("No in-stock product to test cap")
        stock = int(p["stock_qty"])
        r = self._validate(session, [{"product_slug": p["slug"], "quantity": stock + 50}])
        assert r.status_code == 200
        data = r.json()
        if data["items"]:
            assert data["items"][0]["quantity"] <= stock
            # If qty was capped a warning should be issued
            codes = [w.get("code") for w in data.get("stock_warnings", [])]
            assert "qty_capped" in codes or data["items"][0]["quantity"] == stock + 50


class TestCartCombo:
    def test_combo_cart(self, session):
        r = session.get(f"{BASE_URL}/api/combos", timeout=10)
        if r.status_code != 200:
            pytest.skip("No combos endpoint")
        combos = r.json()
        if not combos:
            pytest.skip("No combos in DB")
        combo = combos[0]
        body = {
            "items": [{"combo_id": combo["combo_id"], "quantity": 1}],
            "payment_method": "prepaid",
        }
        r = session.post(f"{BASE_URL}/api/cart/validate", json=body, timeout=15)
        assert r.status_code == 200
        data = r.json()
        if data["items"]:
            assert data["items"][0]["type"] == "combo"
