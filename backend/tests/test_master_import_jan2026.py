"""Backend tests for master-import bulk system, cart pricing, OOS filter, admin order export, delhivery sync.
Iter for Jan-2026 Celesta Glow review request."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ecom-launch-27.preview.emergentagent.com').rstrip('/')
ADMIN_TOKEN = "celestaglow2024"
HDR = {"X-Admin-Token": ADMIN_TOKEN}


# -------- public products listings (niche filter + paginated) --------
class TestProductsPublic:
    def test_cosmetics_paginated(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"niche": "cosmetics", "page": 1, "limit": 20}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "total" in data
        assert data["total"] > 1000, f"expected many cosmetics products, got {data['total']}"
        assert len(data["items"]) <= 20
        for p in data["items"]:
            assert p.get("niche") == "cosmetics"

    def test_skincare_paginated(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"niche": "skincare", "page": 1, "limit": 20}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 500, f"expected many skincare, got {data['total']}"

    def test_antiaging_preserved(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"niche": "anti-aging", "page": 1, "limit": 20}, timeout=30)
        assert r.status_code == 200
        # back-compat may return list when no pagination; we forced page so dict
        data = r.json()
        total = data["total"] if isinstance(data, dict) else len(data)
        assert total >= 1, f"anti-aging products were wiped! total={total}"

    def test_oos_hidden_from_public(self):
        """No public product should have stock_qty=0 (unless TBL)."""
        r = requests.get(f"{BASE_URL}/api/products", params={"page": 1, "limit": 50}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for p in data["items"]:
            if p.get("is_to_be_launched"):
                continue
            stock = p.get("stock_qty") or 0
            shade_stock = sum((s.get("stock_qty") or 0) for s in (p.get("shades") or []))
            assert stock > 0 or shade_stock > 0, f"OOS product leaked: {p.get('slug')}"


# -------- Cart pricing --------
class TestCartPricing:
    def _get_low_priced_product(self, niche=None):
        params = {"page": 1, "limit": 50, "sort": "price_asc"}
        if niche:
            params["niche"] = niche
        r = requests.get(f"{BASE_URL}/api/products", params=params, timeout=30)
        items = r.json()["items"]
        for p in items:
            if p.get("prepaid_price") and not p.get("is_to_be_launched") and (p.get("stock_qty") or 0) > 0 and not (p.get("shades") or []):
                return p
        return items[0] if items else None

    def test_cart_below_999(self):
        prod = self._get_low_priced_product()
        assert prod, "no product available"
        body = {"items": [{"product_slug": prod["slug"], "quantity": 1}], "payment_method": "prepaid"}
        r = requests.post(f"{BASE_URL}/api/cart/validate", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        if d["subtotal"] < 999 and d["subtotal"] > 0:
            assert d["tax_charges"] == 99, f"expected tax=99, got {d['tax_charges']}"
            assert d["delivery_fee"] == 49, f"expected delivery=49, got {d['delivery_fee']}"
            assert d["packaging_fee"] == 10, f"expected packaging=10, got {d['packaging_fee']}"
            assert d["charges_savings"] == 0
            assert d["free_shipping_remaining"] > 0

    def test_cart_above_999(self):
        # Pick a product priced >= 999 OR stack multiple
        prod = self._get_low_priced_product()
        assert prod
        qty = max(1, (1000 // max(1, int(prod["prepaid_price"]))) + 1)
        body = {"items": [{"product_slug": prod["slug"], "quantity": qty}], "payment_method": "prepaid"}
        r = requests.post(f"{BASE_URL}/api/cart/validate", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        if d["subtotal"] >= 999:
            assert d["tax_charges"] == 50, f"expected tax=50 (50% off 99), got {d['tax_charges']}"
            assert d["delivery_fee"] == 0, f"expected free delivery, got {d['delivery_fee']}"
            assert d["packaging_fee"] == 10
            assert d["charges_savings"] == 99, f"expected savings=99, got {d['charges_savings']}"

    def test_order_amount_mismatch_rejected(self):
        prod = None
        r = requests.get(f"{BASE_URL}/api/products", params={"page": 1, "limit": 30, "sort": "price_asc"}, timeout=30)
        for p in r.json()["items"]:
            if p.get("prepaid_price") and not p.get("is_to_be_launched") and (p.get("stock_qty") or 0) > 0 and not (p.get("shades") or []):
                prod = p
                break
        assert prod
        bad = {
            "name": "Test User", "phone": "9999999999", "email": "t@t.com",
            "pincode": "110001", "house_number": "1", "area": "Test", "state": "Delhi",
            "items": [{"product_slug": prod["slug"], "quantity": 1, "price": prod["prepaid_price"]}],
            "amount": 1,  # absurdly wrong
            "payment_method": "prepaid",
        }
        r2 = requests.post(f"{BASE_URL}/api/orders", json=bad, timeout=30)
        # Server should reject amount mismatch OR MOQ
        assert r2.status_code in (400, 422), f"Server accepted bogus amount! status={r2.status_code} body={r2.text[:200]}"


# -------- Admin endpoints --------
class TestAdminAuth:
    def test_product_groups_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/product-groups", timeout=20)
        assert r.status_code in (401, 403)

    def test_margin_bulk_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk", json={"scope": "all", "delta_percent": 1}, timeout=20)
        assert r.status_code in (401, 403)

    def test_orders_export_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/orders/export", timeout=20)
        assert r.status_code in (401, 403)


class TestAdminProductGroups:
    def test_list_groups_cosmetics(self):
        r = requests.get(f"{BASE_URL}/api/admin/product-groups", params={"niche": "cosmetics"}, headers=HDR, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and "total" in d
        assert d["total"] > 0, "no cosmetics groups found"
        # all items should have group_id
        for g in d["items"]:
            assert g.get("group_id"), f"missing group_id: {g}"
            assert g.get("niche") == "cosmetics"

    def test_get_group_products(self):
        r = requests.get(f"{BASE_URL}/api/admin/product-groups", params={"niche": "cosmetics", "limit": 1}, headers=HDR, timeout=30)
        groups = r.json()["items"]
        if not groups:
            pytest.skip("no groups")
        gid = groups[0]["group_id"]
        r2 = requests.get(f"{BASE_URL}/api/admin/product-groups/{gid}", params={"limit": 80}, headers=HDR, timeout=30)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "group" in d and "items" in d
        assert d["group"]["group_id"] == gid
        assert len(d["items"]) <= 80

    def test_get_group_404(self):
        r = requests.get(f"{BASE_URL}/api/admin/product-groups/nonexistent-grp-xxx", headers=HDR, timeout=20)
        assert r.status_code == 404


class TestMarginBulk:
    def test_invalid_scope(self):
        r = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk",
                          json={"scope": "invalid_xyz", "delta_percent": 5}, headers=HDR, timeout=20)
        assert r.status_code == 400

    def test_niche_required_for_niche_scope(self):
        r = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk",
                          json={"scope": "niche", "delta_percent": 5}, headers=HDR, timeout=20)
        assert r.status_code == 400

    def test_factor_must_be_positive(self):
        r = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk",
                          json={"scope": "all", "delta_percent": -150}, headers=HDR, timeout=20)
        assert r.status_code == 400

    def test_margin_symmetry_on_group(self):
        """Apply +5% then -5% (approx symmetry) on a small group."""
        r = requests.get(f"{BASE_URL}/api/admin/product-groups", params={"niche": "cosmetics", "limit": 1}, headers=HDR, timeout=30)
        groups = r.json().get("items") or []
        if not groups:
            pytest.skip("no groups to test")
        gid = groups[0]["group_id"]
        # snapshot
        r0 = requests.get(f"{BASE_URL}/api/admin/product-groups/{gid}", params={"limit": 80}, headers=HDR, timeout=30)
        before = {p["slug"]: p.get("prepaid_price") for p in r0.json()["items"]}
        # +5%
        r1 = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk",
                           json={"scope": "group", "group_id": gid, "delta_percent": 5}, headers=HDR, timeout=60)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("affected", 0) > 0
        # -4.7619% ≈ revert (1/1.05 - 1)*100 = -4.7619; use -5 then +5 instead?
        # Easier: apply -4.7619 to revert
        rr = requests.post(f"{BASE_URL}/api/admin/products/margin-bulk",
                           json={"scope": "group", "group_id": gid, "delta_percent": -4.7619}, headers=HDR, timeout=60)
        assert rr.status_code == 200
        # Verify prices are within 5% of original (rounding tolerance)
        r2 = requests.get(f"{BASE_URL}/api/admin/product-groups/{gid}", params={"limit": 80}, headers=HDR, timeout=30)
        for p in r2.json()["items"]:
            orig = before.get(p["slug"]) or 0
            now = p.get("prepaid_price") or 0
            if orig > 10:
                ratio = abs(now - orig) / orig
                assert ratio < 0.05, f"price drifted too much for {p['slug']}: {orig} -> {now}"


class TestMasterImport:
    def test_upload_invalid_extension(self):
        files = {"file": ("test.txt", io.BytesIO(b"not an excel"), "text/plain")}
        r = requests.post(f"{BASE_URL}/api/admin/master-import/upload", files=files, headers=HDR, timeout=30)
        assert r.status_code == 400

    def test_upload_empty_xlsx(self):
        files = {"file": ("empty.xlsx", io.BytesIO(b""), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        params = {"wipe_first": "false"}
        r = requests.post(f"{BASE_URL}/api/admin/master-import/upload", files=files, params=params, headers=HDR, timeout=30)
        assert r.status_code == 400


class TestOrdersExport:
    def test_export_dealer_html(self):
        r = requests.get(f"{BASE_URL}/api/admin/orders/export",
                         params={"niche": "cosmetics", "sheet_type": "dealer"}, headers=HDR, timeout=60)
        assert r.status_code == 200, r.text
        assert "text/html" in r.headers.get("content-type", "")
        assert "Celesta Glow" in r.text

    def test_export_inhouse_html(self):
        r = requests.get(f"{BASE_URL}/api/admin/orders/export",
                         params={"niche": "cosmetics", "sheet_type": "inhouse"}, headers=HDR, timeout=60)
        assert r.status_code == 200
        assert "<table" in r.text.lower() or "no orders" in r.text.lower()

    def test_export_all_niches(self):
        for niche in ["all", "skincare", "anti-aging"]:
            r = requests.get(f"{BASE_URL}/api/admin/orders/export",
                             params={"niche": niche, "sheet_type": "dealer"}, headers=HDR, timeout=60)
            assert r.status_code == 200, f"export failed for niche={niche}"


class TestDelhiverySync:
    def test_sync_returns_not_configured(self):
        r = requests.post(f"{BASE_URL}/api/admin/orders/sync-delhivery", headers=HDR, timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Either success=False (not configured) OR success=True if key is set
        if d.get("success") is False:
            assert "not configured" in (d.get("error") or "").lower()
