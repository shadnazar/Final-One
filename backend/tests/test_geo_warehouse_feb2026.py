"""Backend tests for Feb-2026 batch: geo proxy, warehouse admin, sale-mode landing banners."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip()
                break

ADMIN = {"X-Admin-Token": "celestaglow2024"}


# --- geo proxy ---
def test_autocomplete_kozhikode():
    r = requests.get(f"{BASE}/api/geo/autocomplete", params={"q": "kozhikode"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    preds = data.get("predictions") or []
    assert len(preds) >= 1
    p = preds[0]
    for k in ("place_id", "description", "main_text", "secondary_text"):
        assert k in p, f"missing {k}"
    assert p["place_id"]


def test_reverse_geocode_kerala():
    r = requests.get(f"{BASE}/api/geo/reverse-geocode", params={"lat": 11.2588, "lng": 75.7804}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("state") == "Kerala"
    assert data.get("city") or data.get("locality")


def test_place_details_from_autocomplete():
    r = requests.get(f"{BASE}/api/geo/autocomplete", params={"q": "kozhikode"}, timeout=15)
    place_id = r.json()["predictions"][0]["place_id"]
    r2 = requests.get(f"{BASE}/api/geo/place-details", params={"place_id": place_id}, timeout=15)
    assert r2.status_code == 200, r2.text
    d = r2.json()
    assert d.get("lat") and d.get("lng")
    assert d.get("formatted")


# --- warehouse admin ---
def test_warehouse_put_get_persists():
    payload = {
        "name": "TEST Warehouse",
        "address": "TEST 123, MG Road",
        "pincode": "560001",
        "phone": "9998887777",
        "maps_link": "https://maps.google.com/?q=TEST",
    }
    r = requests.put(f"{BASE}/api/admin/warehouse", json=payload, headers=ADMIN, timeout=10)
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{BASE}/api/admin/warehouse", headers=ADMIN, timeout=10)
    assert r2.status_code == 200
    d = r2.json()
    for k, v in payload.items():
        assert d.get(k) == v, f"{k}: got {d.get(k)} expected {v}"


def test_warehouse_requires_admin_token():
    r = requests.get(f"{BASE}/api/admin/warehouse", timeout=10)
    assert r.status_code in (401, 403)


# --- sale-mode landing banners ---
def test_sale_mode_landing_banner_fields_persist():
    payload = {
        "landing_banner_anti_aging_desktop": "https://example.com/d.jpg",
        "landing_banner_anti_aging_mobile": "https://example.com/m.jpg",
    }
    r = requests.put(f"{BASE}/api/admin/sale-mode", json=payload, headers=ADMIN, timeout=10)
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{BASE}/api/sale-mode", timeout=10)
    assert r2.status_code == 200
    d = r2.json()
    assert d.get("landing_banner_anti_aging_desktop") == payload["landing_banner_anti_aging_desktop"]
    assert d.get("landing_banner_anti_aging_mobile") == payload["landing_banner_anti_aging_mobile"]


def test_sale_mode_banner_upload_field_whitelist():
    # Invalid field should be rejected
    r = requests.post(
        f"{BASE}/api/admin/sale-mode/banner",
        params={"field": "not_a_real_field"},
        headers=ADMIN,
        timeout=10,
    )
    assert r.status_code in (400, 422), f"expected reject, got {r.status_code} {r.text}"
    # Valid field name (no file → likely 400/422 for missing file, but not 'unknown field')
    r2 = requests.post(
        f"{BASE}/api/admin/sale-mode/banner",
        params={"field": "landing_banner_anti_aging_desktop"},
        headers=ADMIN,
        timeout=10,
    )
    # Missing file → 422, but the field itself must be accepted
    assert r2.status_code != 400 or "field" not in (r2.text.lower())


# --- cleanup ---
def test_zzz_cleanup_landing_banners():
    requests.put(
        f"{BASE}/api/admin/sale-mode",
        json={"landing_banner_anti_aging_desktop": "", "landing_banner_anti_aging_mobile": ""},
        headers=ADMIN,
        timeout=10,
    )
