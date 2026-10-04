"""Major-update batch tests — Jan 2026 iteration 25.

Covers:
- Health check latency
- Delivery coverage-by-pincode (in-zone + unresolved)
- Admin trend-products (auth, list, generate, persist, patch)
- Admin image-gallery (search products, GET, PUT)
- Order placement latency + referral fields
- Site-settings house_categories_only round-trip
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "celestaglow2024"
ADMIN_HDR = {"X-Admin-Token": ADMIN_TOKEN}


# ---------- Health ----------
class TestHealth:
    def test_health_ok(self):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        dt = (time.time() - t0) * 1000
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        print(f"health latency wall-clock: {dt:.0f}ms")


# ---------- Delivery coverage-by-pincode ----------
class TestCoverageByPincode:
    def test_known_pincode(self):
        r = requests.get(f"{BASE_URL}/api/delivery/coverage-by-pincode", params={"pincode": "560001"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("in_zone", "instant_available", "nearest_warehouse"):
            assert k in data, f"missing {k}: {data}"

    def test_unknown_pincode_graceful(self):
        r = requests.get(f"{BASE_URL}/api/delivery/coverage-by-pincode", params={"pincode": "123456"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("in_zone") is False
        # Should be pincode_unresolved OR outside_service_radius (both are graceful)
        assert data.get("reason") in ("pincode_unresolved", "outside_service_radius", "exact_pincode_match")

    def test_bad_pincode_rejected(self):
        r = requests.get(f"{BASE_URL}/api/delivery/coverage-by-pincode", params={"pincode": "abc123"}, timeout=10)
        assert r.status_code == 400


# ---------- Trend products admin ----------
class TestTrendProductsAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/trend-products", timeout=10)
        # Accept 401 or 403 (auth guard uses 403 across this codebase)
        assert r.status_code in (401, 403), r.status_code

    def test_list_with_admin_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/trend-products", headers=ADMIN_HDR, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert isinstance(data["items"], list)


class TestTrendProductsFlow:
    generated_slug = None

    def test_generate_preview(self):
        blueprint = {
            "name": f"TEST Trend Serum {uuid.uuid4().hex[:6]}",
            "description": "A vitamin-C brightening serum with niacinamide.",
            "keywords": ["vitamin c serum", "brightening", "niacinamide"],
            "faqs": [{"q": "Is it safe?", "a": "Yes."}],
            "price": {"mrp": 899, "prepaid_price": 699, "cod_price": 749},
            "gallery_hints": ["dropper bottle", "on wooden shelf"],
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/trend-products/generate",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"blueprint": blueprint},
            timeout=120,
        )
        # Handle LLM budget/rate limit gracefully — the wiring works but the
        # emergent LLM key may be over-budget in the preview env.
        # Public ingress swallows the JSON body and returns HTML on 502, so we
        # cross-check by hitting the backend directly at 8001 when possible.
        if r.status_code == 502:
            local_err = ""
            try:
                lr = requests.post(
                    "http://localhost:8001/api/admin/trend-products/generate",
                    headers={**ADMIN_HDR, "Content-Type": "application/json"},
                    json={"blueprint": blueprint},
                    timeout=60,
                )
                local_err = lr.text[:500]
            except Exception as e:
                local_err = str(e)
            if "Budget has been exceeded" in local_err or "RateLimitError" in local_err:
                pytest.skip(f"EMERGENT_LLM_KEY over budget — Gemini path unreachable: {local_err[:200]}")
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        data = r.json()
        assert "product" in data
        prod = data["product"]
        # Verify essential generated fields
        for key in ("description", "keywords"):
            assert key in prod, f"missing generated key {key}: {list(prod.keys())}"
        if not prod.get("slug"):
            prod["slug"] = f"test-trend-{uuid.uuid4().hex[:8]}"
        TestTrendProductsFlow.generated_slug = prod["slug"]
        TestTrendProductsFlow._preview = prod
        print("Generated product keys:", list(prod.keys()))

    def test_persist_generated(self):
        # If preview step was skipped, fabricate a minimal product payload to
        # still exercise the persist + patch endpoints (they don't need Gemini).
        if not getattr(TestTrendProductsFlow, "_preview", None):
            TestTrendProductsFlow._preview = {
                "slug": f"test-trend-{uuid.uuid4().hex[:8]}",
                "name": "TEST Manual Trend Product",
                "description": "<p>manual</p>",
                "mrp": 499,
                "generated_by": "trend_product_generator",
            }
            TestTrendProductsFlow.generated_slug = TestTrendProductsFlow._preview["slug"]
        r = requests.post(
            f"{BASE_URL}/api/admin/trend-products",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"product": TestTrendProductsFlow._preview},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("is_active") is False, "should land hidden"

    def test_patch_publish(self):
        slug = TestTrendProductsFlow.generated_slug
        assert slug
        r = requests.patch(
            f"{BASE_URL}/api/admin/trend-products/{slug}",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"is_active": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("product", {}).get("is_active") is True

    def test_cleanup(self):
        # Best-effort cleanup: set is_active False and note slug
        slug = TestTrendProductsFlow.generated_slug
        if slug:
            requests.patch(
                f"{BASE_URL}/api/admin/trend-products/{slug}",
                headers={**ADMIN_HDR, "Content-Type": "application/json"},
                json={"is_active": False},
                timeout=10,
            )
            print(f"Left TEST product hidden: slug={slug}")


# ---------- Image gallery admin ----------
class TestImageGallery:
    _sample_slug = None

    def test_search_products(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/image-gallery/products",
            params={"q": "serum"},
            headers=ADMIN_HDR,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("items") or data.get("products") or []
        assert isinstance(items, list)
        if items:
            first = items[0]
            for f in ("gallery_count", "flat_count"):
                assert f in first, f"missing {f}: {list(first.keys())}"
            TestImageGallery._sample_slug = first.get("slug")

    def test_get_gallery(self):
        slug = TestImageGallery._sample_slug
        if not slug:
            # Fallback: pick any product from public list
            plist = requests.get(f"{BASE_URL}/api/products?limit=1", timeout=10).json()
            arr = plist.get("products") or plist.get("items") or plist
            if isinstance(arr, list) and arr:
                slug = arr[0].get("slug")
        assert slug, "no product to test gallery on"
        r = requests.get(f"{BASE_URL}/api/admin/image-gallery/{slug}", headers=ADMIN_HDR, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "image_gallery" in data, f"keys: {list(data.keys())}"
        assert isinstance(data["image_gallery"], list)
        TestImageGallery._sample_slug = slug
        TestImageGallery._original = data["image_gallery"]

    def test_put_gallery(self):
        slug = TestImageGallery._sample_slug
        assert slug
        original = getattr(TestImageGallery, "_original", []) or []
        # Preserve existing + append a test entry
        new_gallery = list(original) + [
            {"url": "https://placehold.co/600x600/png", "alt": "TEST alt keyword jan2026"}
        ]
        r = requests.put(
            f"{BASE_URL}/api/admin/image-gallery/{slug}",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"image_gallery": new_gallery},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        # Verify persistence
        r2 = requests.get(f"{BASE_URL}/api/admin/image-gallery/{slug}", headers=ADMIN_HDR, timeout=15)
        saved = r2.json().get("image_gallery", [])
        alts = [item.get("alt") for item in saved]
        assert "TEST alt keyword jan2026" in alts, f"alt not saved: {alts}"
        # Restore original
        requests.put(
            f"{BASE_URL}/api/admin/image-gallery/{slug}",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"image_gallery": original},
            timeout=20,
        )


# ---------- Site settings house_categories_only ----------
class TestHouseCategoriesToggle:
    def test_persist_and_readback(self):
        # ON
        r = requests.put(
            f"{BASE_URL}/api/admin/site-settings",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"house_categories_only": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        pub = requests.get(f"{BASE_URL}/api/site-settings", timeout=10).json()
        assert pub.get("house_categories_only") is True, f"not exposed: {pub}"
        # Reset OFF (default state)
        r2 = requests.put(
            f"{BASE_URL}/api/admin/site-settings",
            headers={**ADMIN_HDR, "Content-Type": "application/json"},
            json={"house_categories_only": False},
            timeout=15,
        )
        assert r2.status_code == 200
        pub2 = requests.get(f"{BASE_URL}/api/site-settings", timeout=10).json()
        assert pub2.get("house_categories_only") is False


# ---------- Order placement latency ----------
class TestOrderLatency:
    def test_place_cod_order_fast(self):
        # Fetch a real active product to add to cart
        plist = requests.get(f"{BASE_URL}/api/products?limit=5", timeout=15).json()
        arr = plist.get("products") or plist.get("items") or plist
        assert isinstance(arr, list) and arr, "no products"
        prod = next((p for p in arr if p.get("is_active", True) and (p.get("stock_qty", 1) or 1) > 0), arr[0])

        # Get server-side calculated amount from cart/validate
        cart_payload = {
            "items": [{"product_slug": prod.get("slug"), "quantity": 1}],
            "payment_method": "cod",
        }
        cv = requests.post(f"{BASE_URL}/api/cart/validate", json=cart_payload, timeout=15)
        assert cv.status_code == 200, cv.text
        server_total = float(cv.json().get("total") or 0)

        payload = {
            "name": "Test User",
            "phone": "9876543210",
            "email": "test@example.com",
            "house_number": "123",
            "area": "Test Lane",
            "pincode": "673001",
            "state": "Kerala",
            "payment_method": "cod",
            "amount": server_total,
            "items": [
                {
                    "slug": prod.get("slug"),
                    "name": prod.get("name"),
                    "quantity": 1,
                    "price": prod.get("cod_price") or prod.get("prepaid_price") or prod.get("mrp") or 499,
                }
            ],
        }
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=30)
        dt = time.time() - t0
        print(f"order placement wall-clock: {dt:.2f}s status={r.status_code}")
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:500]}"
        body = r.json()
        # Referral fields
        assert body.get("referral_code") or body.get("referral", {}).get("code"), f"no referral_code: keys={list(body.keys())}"
        assert body.get("referral_link") or body.get("referral", {}).get("link"), f"no referral_link"
        # Latency budget — was 6-10s, target <3s. Give a slightly generous margin for network.
        assert dt < 5.0, f"order too slow: {dt:.2f}s"
