"""
Backend tests for Jan 2026 perf/reliability shipment:
- /api/health keep-alive endpoint
- /api/products?search using $text for >=3 chars, $regex fallback otherwise
- /api/categories /api/concerns /api/niches Cache-Control headers
- Filter regression: niche/category/concern/subcategory/tag
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOCAL_URL = "http://localhost:8001"

if not BASE_URL:
    BASE_URL = "https://weather-preview-6.preview.emergentagent.com"


# ---------- Health ----------
class TestHealth:
    def test_health_returns_ok(self):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        dur_ms = (time.time() - t0) * 1000
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("ts"), str) and len(data["ts"]) > 10
        # First request through edge proxy may be slower; assert generous
        assert dur_ms < 5000, f"health too slow: {dur_ms}ms"

    def test_health_fast_warm(self):
        # warm
        requests.get(f"{BASE_URL}/api/health", timeout=10)
        durs = []
        for _ in range(3):
            t0 = time.time()
            r = requests.get(f"{BASE_URL}/api/health", timeout=10)
            assert r.status_code == 200
            durs.append((time.time() - t0) * 1000)
        avg = sum(durs) / len(durs)
        # Should be quick (under 1s avg through edge); local would be <100ms
        assert avg < 2000, f"avg health ms = {avg}"

    def test_health_local_under_100ms(self):
        """Verify FastAPI handler itself is <100ms (no DB hit)."""
        try:
            requests.get(f"{LOCAL_URL}/api/health", timeout=2)  # warm
            t0 = time.time()
            r = requests.get(f"{LOCAL_URL}/api/health", timeout=2)
            dur_ms = (time.time() - t0) * 1000
            assert r.status_code == 200
            assert dur_ms < 100, f"local health = {dur_ms}ms"
        except requests.exceptions.RequestException:
            pytest.skip("localhost:8001 not reachable from test env")


# ---------- Search: $text vs $regex ----------
class TestProductSearch:
    @pytest.mark.parametrize("term", ["serum", "cream", "lakme"])
    def test_search_text_index_3plus(self, term):
        t0 = time.time()
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"search": term, "page": 1, "limit": 10},
            timeout=15,
        )
        dur_ms = (time.time() - t0) * 1000
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict), "paginated dict expected for search"
        assert "items" in body and "total" in body
        assert isinstance(body["items"], list)
        assert isinstance(body["total"], int)
        # Response time sanity (allow generous bound for preview)
        assert dur_ms < 5000, f"search '{term}' = {dur_ms}ms"

    @pytest.mark.parametrize("term", ["la", "a%"])
    def test_search_regex_fallback_short_or_special(self, term):
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"search": term, "page": 1, "limit": 10},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        assert "items" in body and "total" in body

    def test_search_results_have_expected_fields(self):
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"search": "serum", "page": 1, "limit": 5},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        if body["items"]:
            p = body["items"][0]
            assert "slug" in p
            assert "name" in p
            assert "_id" not in p  # excluded


# ---------- Cache headers ----------
class TestCacheHeaders:
    def _hdr(self, url):
        return requests.get(url, timeout=10)

    def test_categories_cache_header_local(self):
        try:
            r = self._hdr(f"{LOCAL_URL}/api/categories")
        except requests.exceptions.RequestException:
            pytest.skip("localhost unreachable")
        assert r.status_code == 200
        cc = r.headers.get("Cache-Control", "")
        assert "max-age=300" in cc, f"got: {cc}"
        assert "stale-while-revalidate=600" in cc, f"got: {cc}"

    def test_concerns_cache_header_local(self):
        try:
            r = self._hdr(f"{LOCAL_URL}/api/concerns")
        except requests.exceptions.RequestException:
            pytest.skip("localhost unreachable")
        assert r.status_code == 200
        cc = r.headers.get("Cache-Control", "")
        assert "max-age=300" in cc, f"got: {cc}"
        assert "stale-while-revalidate=600" in cc, f"got: {cc}"

    def test_niches_cache_header_local(self):
        try:
            r = self._hdr(f"{LOCAL_URL}/api/niches")
        except requests.exceptions.RequestException:
            pytest.skip("localhost unreachable")
        assert r.status_code == 200
        cc = r.headers.get("Cache-Control", "")
        assert "max-age=600" in cc, f"got: {cc}"
        assert "stale-while-revalidate=1200" in cc, f"got: {cc}"


# ---------- Regression: filters still work ----------
class TestProductFilters:
    def test_filter_by_niche(self):
        for niche in ["skincare", "cosmetics", "anti-aging"]:
            r = requests.get(
                f"{BASE_URL}/api/products",
                params={"niche": niche, "page": 1, "limit": 5},
                timeout=15,
            )
            assert r.status_code == 200, f"{niche}: {r.text}"
            body = r.json()
            assert "items" in body
            for it in body["items"]:
                if it.get("niche"):
                    assert it["niche"] == niche

    def test_filter_no_pagination_returns_list(self):
        # Back-compat: no page/limit/search → returns plain list
        r = requests.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list), "back-compat list shape required"

    def test_filter_by_category(self):
        # categories endpoint
        rc = requests.get(f"{BASE_URL}/api/categories", timeout=10)
        assert rc.status_code == 200
        cats = rc.json()
        if not cats:
            pytest.skip("no categories seeded")
        slug = cats[0]["slug"]
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"category": slug, "page": 1, "limit": 5},
            timeout=15,
        )
        assert r.status_code == 200
        assert "items" in r.json()

    def test_filter_by_concern(self):
        rc = requests.get(f"{BASE_URL}/api/concerns", timeout=10)
        assert rc.status_code == 200
        cs = rc.json()
        if not cs:
            pytest.skip("no concerns seeded")
        slug = cs[0]["slug"]
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"concern": slug, "page": 1, "limit": 5},
            timeout=15,
        )
        assert r.status_code == 200
        assert "items" in r.json()

    def test_filter_by_tag(self):
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"tag": "bestseller", "page": 1, "limit": 5},
            timeout=15,
        )
        assert r.status_code == 200
        assert "items" in r.json()

    def test_filter_by_subcategory(self):
        r = requests.get(
            f"{BASE_URL}/api/products",
            params={"subcategory": "foundation", "page": 1, "limit": 5},
            timeout=15,
        )
        assert r.status_code == 200
        assert "items" in r.json()
