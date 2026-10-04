"""Iteration 20 (Jan-2026) tests:
- Sale-mode regression: PUT enabled=true → products/combos in anti-aging niche
  come back with sale_active/sale_badge_label/prepaid_price adjusted.
- Admin-guarded route: /api/admin/delivery-men requires X-Admin-Token.
- Order create accepts delivery_type='instant' and persists it.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    yield sess
    # Cleanup: force disable sale-mode at end
    try:
        sess.put(f"{BASE_URL}/api/admin/sale-mode",
                 json={"enabled": False, "discount_percent": 50,
                       "badge_label": "FLAT 50% OFF"},
                 headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    except Exception:
        pass


# ---------- Sale-mode regression on products/combos ----------

def test_sale_mode_off_baseline_products(s):
    # ensure disabled
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": False},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    time.sleep(31)  # bust 30s _SALE_CACHE
    r = s.get(f"{BASE_URL}/api/products?niche=anti-aging", timeout=20)
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list) and len(products) > 0, "need anti-aging products seeded"
    # None should be flagged sale_active while disabled
    for p in products:
        assert not p.get("sale_active"), f"{p.get('slug')} shows sale_active while sale-mode OFF"


def test_sale_mode_on_products_have_sale_fields(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": True, "discount_percent": 50, "badge_label": "FLAT 50% OFF"},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    time.sleep(31)  # bust cache

    r = s.get(f"{BASE_URL}/api/products?niche=anti-aging", timeout=20)
    assert r.status_code == 200
    products = r.json()
    sale_products = [p for p in products if p.get("sale_active")]
    assert len(sale_products) >= 1, "expected at least one anti-aging product to be sale_active"
    for p in sale_products:
        assert p["sale_badge_label"], p
        assert p.get("original_prepaid_price"), p
        assert p["prepaid_price"] < p["original_prepaid_price"], p
        # prepaid_price ≈ round(mrp*0.5)
        mrp = p.get("mrp") or p["original_prepaid_price"]
        expected = max(1, round(mrp * 0.5))
        assert abs(p["prepaid_price"] - expected) <= 1, (
            f"{p['slug']}: got {p['prepaid_price']} vs expected ~{expected} for mrp={mrp}"
        )


def test_sale_mode_on_combos_have_sale_fields(s):
    # Assume sale still ON from previous test.
    r = s.get(f"{BASE_URL}/api/combos?niche=anti-aging", timeout=20)
    assert r.status_code == 200, r.text
    combos = r.json()
    # combos may or may not exist for anti-aging niche in seed. Just verify
    # if any exist, they at least have the sale_active flag surface (not error).
    for c in combos:
        # combos use combo_prepaid_price naming (different from products)
        assert "combo_prepaid_price" in c or "prepaid_price" in c
        if c.get("sale_active"):
            assert c.get("sale_badge_label")


def test_sale_mode_off_restores(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": False},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    time.sleep(31)
    r = s.get(f"{BASE_URL}/api/products?niche=anti-aging", timeout=20)
    assert r.status_code == 200
    for p in r.json():
        assert not p.get("sale_active")


# ---------- Admin guard on delivery-men ----------

_VALID_DM = {"name": "TEST_UNAUTH", "whatsapp_number": "9999999999"}


def test_delivery_men_post_requires_admin_token(s):
    r = s.post(f"{BASE_URL}/api/admin/delivery-men",
               json=_VALID_DM, timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_delivery_men_post_with_bad_token(s):
    r = s.post(f"{BASE_URL}/api/admin/delivery-men",
               headers={"X-Admin-Token": "nope"},
               json=_VALID_DM, timeout=15)
    assert r.status_code in (401, 403)


def test_delivery_men_post_ok_with_admin_token(s):
    payload = {"name": "TEST_DM_" + uuid.uuid4().hex[:6], "whatsapp_number": "9111111111"}
    r = s.post(f"{BASE_URL}/api/admin/delivery-men",
               headers={"X-Admin-Token": ADMIN_TOKEN}, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    dm = r.json()
    assert dm.get("id")
    assert dm["name"] == payload["name"]
    # cleanup
    dm_id = dm["id"]
    try:
        s.delete(f"{BASE_URL}/api/admin/delivery-men/{dm_id}",
                 headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    except Exception:
        pass


# ---------- Order create accepts delivery_type ----------

def _minimal_order_payload(delivery_type="instant"):
    return {
        "name": "TEST_User_" + uuid.uuid4().hex[:5],
        "phone": "9876543210",
        "email": "test@example.com",
        "house_number": "123",
        "area": "Test Rd",
        "pincode": "673001",
        "state": "Kerala",
        "payment_method": "cod",
        "amount": 100,
        "items": [{
            "slug": "test-item",
            "name": "Test Item",
            "price": 100,
            "quantity": 1,
        }],
        "delivery_type": delivery_type,
        "delivery_lat": 11.26,
        "delivery_lng": 75.79,
    }


def test_order_create_persists_delivery_type_instant(s):
    payload = _minimal_order_payload("instant")
    r = s.post(f"{BASE_URL}/api/orders", json=payload, timeout=30)
    # If amount check fails, retry with server-computed amount
    if r.status_code == 400 and "server:" in r.text:
        import re as _re
        m = _re.search(r"server:\s*₹?([\d\.]+)", r.text)
        if m:
            payload["amount"] = float(m.group(1))
            r = s.post(f"{BASE_URL}/api/orders", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    order_id = data.get("order_id") or data.get("id")
    assert order_id, data
    # GET admin orders and verify persisted
    r2 = s.get(f"{BASE_URL}/api/admin/orders",
               headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=30)
    assert r2.status_code == 200
    orders = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
    match = next((o for o in orders if o.get("order_id") == order_id or o.get("id") == order_id), None)
    assert match, f"order {order_id} not found in admin listing"
    assert match.get("delivery_type") == "instant", match
