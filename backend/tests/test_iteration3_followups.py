"""Iteration 3 follow-up tests:
 - AI generate-product-content returns mrp/offer_price/brand_suggestion + size in 'NNml/NNg / N.NN fl oz/oz' format
 - URL scraper /api/admin/scrape/product no longer 500s; returns JSON 200 even when site blocks
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_PASSWORD", "celestaglow2024")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}

SIZE_RE = re.compile(r"^\d+\s?(ml|g)\s?\/\s?\d+\.?\d*\s?(fl\s?oz|oz)$", re.IGNORECASE)


# ===== AI content generation =====
class TestAIGenerateContent:
    def test_returns_new_keys_with_valid_values(self):
        payload = {
            "name": "Vitamin C Brightening Serum",
            "niche": "skincare",
            "category": "serum",
            "brand": "",
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/ai/generate-product-content",
            json=payload, headers=HEADERS, timeout=60,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True

        # NEW keys
        assert "mrp" in data and isinstance(data["mrp"], int) and data["mrp"] > 0, f"bad mrp: {data.get('mrp')}"
        assert "offer_price" in data and isinstance(data["offer_price"], int) and data["offer_price"] > 0, \
            f"bad offer_price: {data.get('offer_price')}"
        assert data["offer_price"] < data["mrp"], \
            f"offer_price ({data['offer_price']}) must be < mrp ({data['mrp']})"
        assert isinstance(data.get("brand_suggestion"), str) and len(data["brand_suggestion"].strip()) > 0, \
            f"bad brand_suggestion: {data.get('brand_suggestion')!r}"

        # Size format
        size = data.get("size", "")
        assert SIZE_RE.match(size or ""), f"size {size!r} does not match 'NNml / N.NN fl oz' regex"

        # Pre-existing keys still present
        for k in ("tagline", "description", "key_ingredients", "ingredients_full", "benefits", "how_to_use", "faqs"):
            assert k in data, f"missing pre-existing key {k}"


# ===== URL scraper =====
class TestURLScraper:
    def test_scraper_does_not_500_on_blocked_site(self):
        # Pick a target most likely to block (Amazon)
        r = requests.post(
            f"{BASE_URL}/api/admin/scrape/product",
            json={"url": "https://www.amazon.in/dp/B07GPSJB1V"},
            headers=HEADERS, timeout=45,
        )
        # Must be JSON, must be 200 (graceful) — never 500
        assert r.status_code == 200, f"expected 200 even on block, got {r.status_code}: {r.text[:300]}"
        ct = r.headers.get("content-type", "")
        assert "application/json" in ct, f"non-JSON response: {ct} body={r.text[:200]}"
        body = r.json()
        # Either a successful scrape OR a structured failure — both fine
        assert isinstance(body, dict)
        if body.get("success") is False:
            assert "error" in body or "message" in body, f"failure body lacks error key: {body}"

    def test_scraper_handles_invalid_url_gracefully(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/scrape/product",
            json={"url": "https://this-domain-definitely-does-not-exist-zzz-99.example/x"},
            headers=HEADERS, timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert isinstance(body, dict)
