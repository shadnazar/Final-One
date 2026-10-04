"""Iteration 16 (Feb-2026) — Global Flat 50% OFF sale-mode tests."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    yield sess
    # Cleanup: force disable at end
    try:
        sess.put(f"{BASE_URL}/api/admin/sale-mode",
                 json={"enabled": False, "discount_percent": 50,
                       "badge_label": "FLAT 50% OFF"},
                 headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    except Exception:
        pass


def test_get_sale_mode_defaults(s):
    r = s.get(f"{BASE_URL}/api/sale-mode", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["enabled", "discount_percent", "applies_to_niches", "badge_label",
              "banner_text", "urgency_line", "zero_shipping", "zero_tax",
              "banner_image_desktop", "banner_image_mobile"]:
        assert k in d, f"missing field: {k}"
    assert "anti-aging" in d["applies_to_niches"]


def test_put_admin_sale_mode_unauth(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode", json={"enabled": True}, timeout=15)
    assert r.status_code in (401, 403)


def test_put_admin_sale_mode_bad_token(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": True},
              headers={"X-Admin-Token": "wrong"}, timeout=15)
    assert r.status_code in (401, 403)


def test_toggle_enabled_true_and_persistence(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": True},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    # GET should show enabled
    r2 = s.get(f"{BASE_URL}/api/sale-mode", timeout=15)
    assert r2.json()["enabled"] is True


def test_update_discount_and_badge(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"discount_percent": 60, "badge_label": "MEGA 60% OFF"},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["discount_percent"] == 60
    assert d["badge_label"] == "MEGA 60% OFF"
    # persist
    d2 = s.get(f"{BASE_URL}/api/sale-mode", timeout=15).json()
    assert d2["discount_percent"] == 60
    assert d2["badge_label"] == "MEGA 60% OFF"


def test_banner_upload_bad_field(s):
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
           b"\xcf\xc0\x00\x00\x00\x03\x00\x01\x5b\xc2\x02\xfd\x00\x00\x00\x00IEND\xaeB`\x82")
    files = {"file": ("t.png", io.BytesIO(png), "image/png")}
    r = s.post(f"{BASE_URL}/api/admin/sale-mode/banner?field=bogus",
               files=files,
               headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=30)
    assert r.status_code == 400


def test_banner_upload_desktop(s):
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
           b"\xcf\xc0\x00\x00\x00\x03\x00\x01\x5b\xc2\x02\xfd\x00\x00\x00\x00IEND\xaeB`\x82")
    files = {"file": ("t.png", io.BytesIO(png), "image/png")}
    r = s.post(f"{BASE_URL}/api/admin/sale-mode/banner?field=banner_image_desktop",
               files=files,
               headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=45)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["banner_image_desktop"].startswith("http"), d["banner_image_desktop"]
    assert "cloudinary" in d["banner_image_desktop"].lower() or "res." in d["banner_image_desktop"]


def test_regression_endpoints(s):
    for path in ["/api/concerns", "/api/categories"]:
        r = s.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}"


def test_restore_disabled(s):
    r = s.put(f"{BASE_URL}/api/admin/sale-mode",
              json={"enabled": False, "discount_percent": 50, "badge_label": "FLAT 50% OFF"},
              headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15)
    assert r.status_code == 200
    assert r.json()["enabled"] is False
