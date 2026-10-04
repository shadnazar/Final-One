"""Tests for splash removal + other_brands_in_stock toggle + cart validate guard."""
import os
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"
ADMIN_HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def test_product(mongo_db):
    """Insert non-Celesta-Glow product for guard testing."""
    products = mongo_db["products"]
    slug = "zz-test-brand-guard"
    products.delete_many({"slug": slug})
    import uuid
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "name": "ZZ Test Brand Guard",
        "short_name": "ZZ Test",
        "brand": "CompetitorBrand",
        "mrp": 500,
        "prepaid_price": 400,
        "cod_price": 420,
        "stock_qty": 10,
        "is_active": True,
        "is_to_be_launched": False,
        "niche": "skincare",
        "category": "serums",
        "images": [],
    }
    products.insert_one(doc)
    yield doc
    products.delete_many({"slug": slug})


def test_splash_asset_not_served():
    """Deleted splash image should NOT be served as image (SPA may return index.html)."""
    r = requests.get(f"{BASE_URL}/splash-celesta-glow.png", timeout=15)
    ct = r.headers.get("content-type", "")
    assert "image" not in ct.lower(), f"Splash asset still served: {ct}"


def test_put_site_settings_toggle_off():
    r = requests.put(
        f"{BASE_URL}/api/admin/site-settings",
        json={"other_brands_in_stock": False},
        headers=ADMIN_HEADERS,
        timeout=15,
    )
    assert r.status_code == 200, r.text


def test_get_site_settings_reflects_off():
    r = requests.get(f"{BASE_URL}/api/site-settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("other_brands_in_stock") is False, data


def test_put_site_settings_toggle_on():
    r = requests.put(
        f"{BASE_URL}/api/admin/site-settings",
        json={"other_brands_in_stock": True},
        headers=ADMIN_HEADERS,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    # confirm
    g = requests.get(f"{BASE_URL}/api/site-settings", timeout=15).json()
    assert g.get("other_brands_in_stock") is True


def _set_toggle(value: bool):
    requests.put(
        f"{BASE_URL}/api/admin/site-settings",
        json={"other_brands_in_stock": value},
        headers=ADMIN_HEADERS,
        timeout=15,
    )


def test_validate_cart_non_house_brand_toggle_off(test_product):
    _set_toggle(False)
    payload = {"items": [{"product_slug": test_product["slug"], "quantity": 1}]}
    r = requests.post(f"{BASE_URL}/api/cart/validate", json=payload, timeout=15)
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", body)
    assert detail.get("reason") == "other_brands_out_of_stock", detail
    assert "message" in detail
    assert detail.get("redirect_to") == "/"
    offending = detail.get("offending_items", [])
    assert any(item.get("slug") == test_product["slug"] for item in offending), detail


def test_validate_cart_non_house_brand_toggle_on(test_product):
    _set_toggle(True)
    payload = {"items": [{"product_slug": test_product["slug"], "quantity": 1}]}
    r = requests.post(f"{BASE_URL}/api/cart/validate", json=payload, timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"


def test_validate_cart_house_brand_toggle_off():
    """Guard shouldn't fire for Celesta-Glow products even when toggle off."""
    _set_toggle(False)
    # Grab a real house-brand product
    prods = requests.get(f"{BASE_URL}/api/products", timeout=15).json()
    items = prods if isinstance(prods, list) else prods.get("products", prods.get("items", []))
    house = None
    for p in items:
        b = (p.get("brand") or "").lower().replace(" ", "").replace("-", "")
        if "celestaglow" in b:
            house = p
            break
    if not house:
        pytest.skip("No Celesta-Glow branded product available to test")
    payload = {"items": [{"product_slug": house["slug"], "quantity": 1}]}
    r = requests.post(f"{BASE_URL}/api/cart/validate", json=payload, timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"


def test_final_leave_toggle_off():
    """Merchant wants toggle=false as default post-test."""
    _set_toggle(False)
    g = requests.get(f"{BASE_URL}/api/site-settings", timeout=15).json()
    assert g.get("other_brands_in_stock") is False
