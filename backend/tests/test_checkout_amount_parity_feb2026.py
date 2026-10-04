"""Regression: /api/orders MUST accept the same amount /api/cart/validate computed.

Bug history (Feb 2026): create_order used cod_price for COD orders and
combo.prepaid_price for combos, while cart/validate always uses prepaid_price
and combo.combo_prepaid_price. With a ₹100 COD premium × 6 items the cart
total drifted ₹600 from the order total → "Amount mismatch" at checkout.

Fix: create_order now delegates the whole math to validate_cart() so the two
endpoints can never drift again. These tests pin the parity contract.
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
API = f"{BASE}/api"

CUSTOMER = {
    "name": "Parity Test",
    "phone": "9999999999",
    "house_number": "H-1",
    "area": "Mumbai",
    "pincode": "400001",
    "state": "MH",
}


@pytest.fixture(scope="module")
def products():
    r = requests.get(f"{API}/products?limit=10", timeout=10)
    r.raise_for_status()
    data = r.json()
    items = data.get("items") if isinstance(data, dict) else data
    # Need products with stock > 6 and clear prepaid/cod prices
    return [p for p in items if (p.get("stock_qty") or 0) > 6 and p.get("prepaid_price")]


def _cart_total(items, payment_method, coupon=None):
    payload = {
        "items": [{"product_slug": i["slug"], "quantity": i["quantity"]} for i in items],
        "payment_method": payment_method,
    }
    if coupon:
        payload["coupon_code"] = coupon
    r = requests.post(f"{API}/cart/validate", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def _place_order(items, payment_method, amount, coupon=None):
    payload = {
        **CUSTOMER,
        "payment_method": payment_method,
        "items": [{"slug": i["slug"], "quantity": i["quantity"]} for i in items],
        "amount": amount,
    }
    if coupon:
        payload["coupon_code"] = coupon
    return requests.post(f"{API}/orders", json=payload, timeout=10)


@pytest.mark.parametrize("payment_method", ["prepaid", "cod"])
def test_single_item_parity(products, payment_method):
    """Single product: cart total must match /api/orders accepted amount."""
    assert products, "need test products"
    p = products[0]
    items = [{"slug": p["slug"], "quantity": 2}]
    cart = _cart_total(items, payment_method)
    r = _place_order(items, payment_method, cart["total"])
    assert r.status_code == 200, r.text
    assert r.json().get("order_id")


def test_multi_item_cod_parity(products):
    """Multi-product COD: regression for the original ₹600 mismatch."""
    if len(products) < 2:
        pytest.skip("need ≥2 products")
    items = [
        {"slug": products[0]["slug"], "quantity": 2},
        {"slug": products[1]["slug"], "quantity": 3},
    ]
    cart = _cart_total(items, "cod")
    r = _place_order(items, "cod", cart["total"])
    assert r.status_code == 200, r.text


def test_amount_tampering_rejected(products):
    """Sending an amount lower than the server total must be rejected."""
    p = products[0]
    items = [{"slug": p["slug"], "quantity": 2}]
    cart = _cart_total(items, "prepaid")
    r = _place_order(items, "prepaid", cart["total"] - 500)
    assert r.status_code == 400
    assert "mismatch" in r.json().get("detail", "").lower()


def test_amount_rounding_tolerance(products):
    """±₹1 rounding tolerance must be honoured."""
    p = products[0]
    items = [{"slug": p["slug"], "quantity": 1}]
    cart = _cart_total(items, "prepaid")
    r = _place_order(items, "prepaid", cart["total"] + 0.5)
    # within tolerance → accepted
    assert r.status_code == 200, r.text


def test_tiered_delivery_high_cart(products):
    """Cart above ₹2500 must apply ₹19 delivery (and order accepts that total)."""
    p = max(products, key=lambda x: x.get("prepaid_price") or 0)
    qty = max(3, int(2600 / (p["prepaid_price"] or 1)) + 1)
    qty = min(qty, p.get("stock_qty") or qty)
    items = [{"slug": p["slug"], "quantity": qty}]
    cart = _cart_total(items, "prepaid")
    if cart["subtotal"] >= 2500:
        assert cart["delivery_fee"] == 19
    r = _place_order(items, "prepaid", cart["total"])
    assert r.status_code == 200, r.text
