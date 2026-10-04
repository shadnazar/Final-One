"""Backend regression tests for Jan-2026 Celesta Glow review:
- Concerns & Categories from taxonomy_v2 (13 concerns + cosmetics/skincare cats)
- Lipstick category pagination (~1003 products)
- Gift card admin CRUD + rolling balance validation (non-mutating)
- Cart /validate gift_card_discount + packaging fee merge (eco+platform=15) + cod_premium=0
- Taxonomy reset-and-reclassify idempotency
- Admin product PUT price-guard (allow_price_change flag)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ecom-shop-18.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"

EXPECTED_CONCERN_SLUGS = {
    "acne-breakouts", "pigmentation", "dryness", "oily-pores", "anti-aging",
    "sensitive-skin", "texture-pores", "brightening", "under-eye",
    "barrier-support", "skin-conditions", "sun-protection", "mens-skincare",
}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


# ============== Concerns (taxonomy_v2) ==============
class TestConcerns:
    def test_concerns_count_and_slugs(self, client):
        r = client.get(f"{BASE_URL}/api/concerns")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        slugs = {c["slug"] for c in items}
        assert len(items) == 13, f"expected 13 concerns, got {len(items)}: {slugs}"
        missing = EXPECTED_CONCERN_SLUGS - slugs
        extra = slugs - EXPECTED_CONCERN_SLUGS
        assert not missing, f"missing concern slugs: {missing}"
        assert not extra, f"unexpected concern slugs: {extra}"


# ============== Categories (taxonomy_v2) ==============
class TestCategories:
    def test_categories_cosmetics_parent_child(self, client):
        r = client.get(f"{BASE_URL}/api/categories?niche=cosmetics")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert len(items) >= 6
        parents = {i["slug"] for i in items if i.get("is_parent")}
        expected_parents = {"face-makeup", "lips", "eyes", "nails", "tools-brushes"}
        assert expected_parents.issubset(parents), f"missing cosmetic parents: {expected_parents - parents}"
        # children must reference a parent
        children = [i for i in items if not i.get("is_parent")]
        assert any(c.get("parent") for c in children), "no children with parent set"

    def test_categories_skincare_parents(self, client):
        r = client.get(f"{BASE_URL}/api/categories?niche=skincare")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        slugs = {i["slug"] for i in items}
        # expected skincare buckets
        expected_any = {"cleansers", "moisturizers", "sunscreens", "serums-treatments"}
        assert expected_any.issubset(slugs), f"missing skincare cats: {expected_any - slugs}"

    def test_category_lipstick_pagination_page1(self, client):
        r = client.get(f"{BASE_URL}/api/categories/lipstick?page=1&limit=24")
        assert r.status_code == 200
        d = r.json()
        assert d.get("total", 0) >= 900, f"lipstick total too low: {d.get('total')}"
        assert d.get("page") == 1
        assert d.get("limit") == 24
        assert d.get("has_next") is True
        assert len(d.get("products", [])) == 24

    def test_category_lipstick_pagination_page2(self, client):
        r1 = client.get(f"{BASE_URL}/api/categories/lipstick?page=1&limit=24")
        r2 = client.get(f"{BASE_URL}/api/categories/lipstick?page=2&limit=24")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("page") == 2
        assert len(d2.get("products", [])) == 24
        # page 2 items != page 1 items
        s1 = {p["slug"] for p in r1.json().get("products", [])}
        s2 = {p["slug"] for p in d2.get("products", [])}
        assert s1.isdisjoint(s2), "pagination overlap between page 1 and 2"


# ============== Gift Cards Admin CRUD ==============
class TestGiftCardAdmin:
    def test_admin_list_includes_seed_codes(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/gift-cards")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("cards", []))
        codes = {c.get("code") for c in items}
        assert "WELCOME500" in codes, f"WELCOME500 missing; got {codes}"
        assert "VIP1000" in codes, f"VIP1000 missing; got {codes}"

    def test_admin_create_test_card(self, admin_client):
        code = f"TEST{int(time.time()) % 100000}"
        r = admin_client.post(f"{BASE_URL}/api/admin/gift-cards", json={
            "code": code, "initial_balance": 200, "label": "pytest"
        })
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # response contains the code we created
        body_code = body.get("code") or body.get("card", {}).get("code")
        assert body_code == code
        # GET list confirms persistence
        lst = admin_client.get(f"{BASE_URL}/api/admin/gift-cards").json()
        items = lst if isinstance(lst, list) else lst.get("items", lst.get("cards", []))
        codes = {c.get("code") for c in items}
        assert code in codes
        # cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/gift-cards/{code}")

    def test_admin_endpoints_reject_no_token(self, client):
        r = client.get(f"{BASE_URL}/api/admin/gift-cards")
        assert r.status_code in (401, 403)


# ============== Gift Card Validate (rolling balance, non-mutating) ==============
class TestGiftCardValidate:
    def test_validate_welcome500_under_balance(self, client):
        r = client.post(f"{BASE_URL}/api/gift-cards/validate",
                        json={"code": "WELCOME500", "order_amount": 300})
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is True
        assert d["discount"] == 300
        assert d["remaining_balance"] == 500
        assert d["remaining_after"] == 200

    def test_validate_does_not_mutate_balance(self, client):
        """Validation called twice should return identical remaining_balance (no consumption)."""
        first = client.post(f"{BASE_URL}/api/gift-cards/validate",
                            json={"code": "WELCOME500", "order_amount": 200}).json()
        second = client.post(f"{BASE_URL}/api/gift-cards/validate",
                             json={"code": "WELCOME500", "order_amount": 200}).json()
        assert first["valid"] and second["valid"]
        assert first["remaining_balance"] == second["remaining_balance"], (
            f"balance mutated on validate: {first} -> {second}"
        )

    def test_validate_nonexistent(self, client):
        r = client.post(f"{BASE_URL}/api/gift-cards/validate",
                        json={"code": "NONEXISTENT_XYZ_999", "order_amount": 300})
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is False


# ============== Cart Validate pricing + gift_card_discount + packaging merge ==============
PRODUCT_SLUG = "anti-aging-serum"  # prepaid_price 999, mrp 1699, stock 100


class TestCartValidatePricing:
    def test_cart_low_value_pricing(self, client):
        # Single low-priced item < ₹999 threshold? anti-aging is 999, so qty=1 hits exactly threshold.
        # Use a tiny qty hack: send no items → totals 0, packaging=0
        r = client.post(f"{BASE_URL}/api/cart/validate", json={
            "items": [], "payment_method": "prepaid"})
        assert r.status_code == 200
        d = r.json()
        assert d["cod_premium"] == 0
        assert d["packaging_fee"] == 0  # cart empty

    def test_cart_above_999_charges(self, client):
        r = client.post(f"{BASE_URL}/api/cart/validate", json={
            "items": [{"product_slug": PRODUCT_SLUG, "quantity": 2}],
            "payment_method": "prepaid"})
        assert r.status_code == 200
        d = r.json()
        assert d["cod_premium"] == 0, "cod_premium must be 0 (COD extra charge removed)"
        assert d["packaging_fee"] == 15, f"packaging_fee should be 15 (eco10+platform5 merged), got {d['packaging_fee']}"
        assert d["tax_charges_original"] == 99
        assert d["tax_charges"] == 50, f"50% off tax expected when >=999, got {d['tax_charges']}"
        assert d["delivery_fee"] == 0, "delivery should be FREE at >=999"
        assert d["subtotal"] == 1998
        assert d["total"] == 1998 + 0 + 50 + 15  # subtotal + delivery + tax + packaging

    def test_cart_with_gift_card_applies_discount(self, client):
        r = client.post(f"{BASE_URL}/api/cart/validate", json={
            "items": [{"product_slug": PRODUCT_SLUG, "quantity": 2}],
            "payment_method": "prepaid",
            "gift_card_code": "WELCOME500"})
        assert r.status_code == 200
        d = r.json()
        assert d["gift_card_discount"] > 0, "gift card discount should be applied"
        assert d["gift_card_discount"] <= 500
        assert d["gift_card"] is not None
        assert d["gift_card"]["code"] == "WELCOME500"
        # total reduced by gift card discount
        expected_before_gc = d["subtotal"] + d["delivery_fee"] + d["tax_charges"] + d["packaging_fee"]
        assert d["total"] == max(0, expected_before_gc - d["gift_card_discount"])


# ============== Taxonomy reset-and-reclassify idempotency ==============
class TestTaxonomyReset:
    def test_reset_and_reclassify_idempotent(self, admin_client):
        r1 = admin_client.post(f"{BASE_URL}/api/admin/taxonomy/reset-and-reclassify", json={})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "taxonomy" in d1
        assert "reclassification" in d1
        # second invocation should also succeed (idempotent)
        r2 = admin_client.post(f"{BASE_URL}/api/admin/taxonomy/reset-and-reclassify", json={})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert "taxonomy" in d2 and "reclassification" in d2

    def test_concerns_count_after_reset(self, client):
        r = client.get(f"{BASE_URL}/api/concerns")
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert len(items) == 13


# ============== Admin product PUT — price guard ==============
class TestProductPriceGuard:
    PRODUCT = PRODUCT_SLUG  # 999/1099/1699

    def _get_prices(self, client):
        r = client.get(f"{BASE_URL}/api/products?slug={self.PRODUCT}&limit=1")
        items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
        assert items, "product not found"
        p = items[0]
        return p["prepaid_price"], p["cod_price"], p["mrp"]

    def test_put_without_allow_price_change_does_not_update_prices(self, client, admin_client):
        before = self._get_prices(client)
        # try to bump prices by ₹500 each — should be ignored
        r = admin_client.put(f"{BASE_URL}/api/admin/products/{self.PRODUCT}", json={
            "prepaid_price": before[0] + 500,
            "cod_price": before[1] + 500,
            "mrp": before[2] + 500,
            "short_name": "Anti-Aging Serum",  # benign field to confirm update path
        })
        assert r.status_code == 200, r.text
        after = self._get_prices(client)
        assert after == before, f"prices changed without allow_price_change flag: {before} -> {after}"

    def test_put_with_allow_price_change_updates_prices(self, client, admin_client):
        before = self._get_prices(client)
        new_prepaid = before[0] + 1
        new_cod = before[1] + 1
        new_mrp = before[2] + 1
        try:
            r = admin_client.put(f"{BASE_URL}/api/admin/products/{self.PRODUCT}", json={
                "prepaid_price": new_prepaid, "cod_price": new_cod, "mrp": new_mrp,
                "allow_price_change": True,
            })
            assert r.status_code == 200, r.text
            after = self._get_prices(client)
            assert after == (new_prepaid, new_cod, new_mrp), (
                f"prices not updated with allow_price_change=True: {before} -> {after}")
        finally:
            # restore original
            admin_client.put(f"{BASE_URL}/api/admin/products/{self.PRODUCT}", json={
                "prepaid_price": before[0], "cod_price": before[1], "mrp": before[2],
                "allow_price_change": True,
            })
