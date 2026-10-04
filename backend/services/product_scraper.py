"""Product scraper service — multi-method, free-AI primary.

Order of attempts (each method's output is merged; we keep the best of all):
  1. Direct fetch + JSON-LD (instant, works on Shopify, WooCommerce, our own site)
  2. Direct fetch + site-specific selectors (Amazon / Flipkart / Nykaa)
  3. AI extraction from raw HTML using Emergent LLM (Claude — FREE for the user)
  4. AI URL-only mode (when fetch is blocked: ask AI to infer from the URL alone)

The AI is the always-available safety net, since it works even when sites block
our scraper (Amazon often does). The user pays nothing for AI calls — they're on
the Emergent LLM key.
"""
import os
import re
import json
import logging
from typing import Dict, Optional, Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
}


def _fetch(url: str, timeout: int = 15) -> Optional[str]:
    try:
        r = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and r.text:
            return r.text
        logging.warning(f"[scraper] {url} → status={r.status_code}")
    except Exception as e:
        logging.warning(f"[scraper] fetch error: {e}")
    return None


def _parse_price(s: Any) -> Optional[float]:
    if s is None:
        return None
    s = str(s).replace(",", "").replace("\xa0", " ")
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def _domain(url: str) -> str:
    return (urlparse(url).hostname or "").lower().replace("www.", "")


def _merge(base: Dict, addon: Dict) -> Dict:
    """Merge addon into base, preferring base values for keys already set."""
    if not addon:
        return base
    for k, v in addon.items():
        if v in (None, "", []):
            continue
        if k == "reviews":
            base.setdefault("reviews", []).extend(v)
        elif not base.get(k):
            base[k] = v
    return base


def _extract_ld_json(soup: BeautifulSoup) -> Dict:
    out = {}
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type", "")
            if isinstance(t, list):
                t = next((x for x in t if "Product" in str(x)), "")
            if "Product" in str(t):
                out["name"] = node.get("name") or out.get("name")
                out["description"] = node.get("description") or out.get("description")
                imgs = node.get("image") or []
                if isinstance(imgs, str):
                    imgs = [imgs]
                if imgs:
                    out["images"] = imgs
                offers = node.get("offers") or {}
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                if isinstance(offers, dict):
                    p = offers.get("price") or offers.get("lowPrice")
                    if p is not None:
                        out["price"] = _parse_price(p)
                    hp = offers.get("highPrice")
                    if hp:
                        out["mrp"] = _parse_price(hp)
                rating = node.get("aggregateRating") or {}
                if isinstance(rating, dict):
                    if rating.get("ratingValue"):
                        try:
                            out["rating"] = float(rating["ratingValue"])
                        except Exception:
                            pass
                    cnt = rating.get("reviewCount") or rating.get("ratingCount")
                    if cnt:
                        try:
                            out["reviews_count"] = int(cnt)
                        except Exception:
                            pass
                brand = node.get("brand")
                if isinstance(brand, dict):
                    out["brand"] = brand.get("name")
                elif isinstance(brand, str):
                    out["brand"] = brand
                reviews = node.get("review") or []
                if isinstance(reviews, dict):
                    reviews = [reviews]
                if reviews:
                    out.setdefault("reviews", [])
                    for rv in reviews[:20]:
                        if not isinstance(rv, dict):
                            continue
                        author = rv.get("author")
                        if isinstance(author, dict):
                            author = author.get("name")
                        body = rv.get("reviewBody") or rv.get("description")
                        rating_v = rv.get("reviewRating", {})
                        if isinstance(rating_v, dict):
                            rating_v = rating_v.get("ratingValue")
                        if body:
                            out["reviews"].append({
                                "author": str(author or "Verified Buyer"),
                                "text": str(body),
                                "rating": float(rating_v) if rating_v else None,
                            })
    return out


def _extract_amazon(soup: BeautifulSoup) -> Dict:
    out = {}
    title = soup.find(id="productTitle")
    if title:
        out["name"] = title.get_text(strip=True)
    price_node = soup.select_one(".a-price .a-offscreen")
    if price_node:
        out["price"] = _parse_price(price_node.get_text())
    mrp_node = soup.select_one(".basisPrice .a-offscreen, .priceBlockStrikePriceString")
    if mrp_node:
        out["mrp"] = _parse_price(mrp_node.get_text())
    img = soup.select_one("#landingImage")
    if img and img.get("src"):
        out["images"] = [img["src"]]
    rating_node = soup.select_one("span.a-icon-alt")
    if rating_node:
        m = re.search(r"(\d+(?:\.\d+)?)", rating_node.get_text())
        if m:
            out["rating"] = float(m.group(1))
    feats = []
    for li in soup.select("#feature-bullets li span.a-list-item"):
        t = li.get_text(strip=True)
        if t and len(t) > 8:
            feats.append(t)
    if feats:
        out["benefits"] = feats[:8]
    reviews = []
    for rv in soup.select('div[data-hook="review"]')[:15]:
        author = rv.select_one("span.a-profile-name")
        body = rv.select_one('span[data-hook="review-body"] span')
        if body:
            reviews.append({
                "author": author.get_text(strip=True) if author else "Verified Buyer",
                "text": body.get_text(strip=True),
                "rating": None,
            })
    if reviews:
        out["reviews"] = reviews
    return out


def _extract_flipkart(soup: BeautifulSoup) -> Dict:
    out = {}
    title = soup.select_one("span.B_NuCI, h1._6EBuvT span.VU-ZEz, h1 span")
    if title:
        out["name"] = title.get_text(strip=True)
    price = soup.select_one("div._30jeq3, div.Nx9bqj")
    if price:
        out["price"] = _parse_price(price.get_text())
    mrp = soup.select_one("div._3I9_wc, div.yRaY8j")
    if mrp:
        out["mrp"] = _parse_price(mrp.get_text())
    img = soup.select_one("img._396cs4, img._53J4C-, img.DByuf4")
    if img and img.get("src"):
        out["images"] = [img["src"]]
    rating_node = soup.select_one("div._3LWZlK, div.XQDdHH")
    if rating_node:
        m = re.search(r"(\d+(?:\.\d+)?)", rating_node.get_text())
        if m:
            out["rating"] = float(m.group(1))
    return out


def _extract_nykaa(soup: BeautifulSoup) -> Dict:
    out = {}
    title = soup.select_one("h1.css-1gc4x7i, h1[class*='product-title']")
    if title:
        out["name"] = title.get_text(strip=True)
    price = soup.select_one("span.css-1jczs19, span[class*='product-price']")
    if price:
        out["price"] = _parse_price(price.get_text())
    img = soup.select_one("img[alt*='Nykaa'], img[class*='css-1q9hg33']")
    if img and img.get("src"):
        out["images"] = [img["src"]]
    return out


def _ai_extract(content: str, source_url: str, mode: str = "html") -> Optional[Dict]:
    """AI extraction (FREE — uses Emergent LLM key).

    mode='html'      : pass cleaned HTML text from a fetched page
    mode='url-only'  : fetch failed; ask AI to infer from URL slug + domain alone
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        logging.warning("[scraper] emergentintegrations not available")
        return None
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logging.warning("[scraper] EMERGENT_LLM_KEY missing")
        return None

    if mode == "url-only":
        prompt = f"""You are a product analyst. We could not fetch this URL (the site blocked us).
Based ONLY on the URL structure (domain, path, slug, query params), infer what the product likely is.
URL: {source_url}

Return ONLY a JSON object. Mark fields as null if you cannot reasonably infer them.
{{
  "name": "best-guess product name from URL slug (string)",
  "description": "short description if inferable, else null",
  "price": null,
  "mrp": null,
  "rating": null,
  "reviews_count": null,
  "images": null,
  "benefits": null,
  "key_ingredients": null,
  "size": null,
  "brand": "brand inferred from domain or path"
}}

Reply with ONLY the JSON object."""
    else:
        prompt = f"""Extract product details from this e-commerce page.
URL: {source_url}

Return ONLY a JSON object with these keys (omit unknown ones, or set them to null):
{{
  "name": "product name (string)",
  "description": "1-2 sentence description",
  "price": numeric current selling price (no currency symbol),
  "mrp": numeric MRP / strikethrough price,
  "rating": numeric rating like 4.5,
  "reviews_count": numeric review count,
  "images": ["image url 1", "image url 2"],
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "key_ingredients": "comma separated ingredients summary",
  "size": "size like 30ml",
  "brand": "brand name",
  "reviews": [{{"author":"Name","text":"review text","rating":5}}]
}}

Page content (cleaned):
{content[:18000]}

Reply with ONLY the JSON object, no markdown, no explanation."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"scrape-{abs(hash(source_url)) % 10**8}",
            system_message="You are a precise product data extractor. Always reply with only valid JSON, no commentary.",
        ).with_model("gemini", "gemini-2.5-flash")
        resp = chat.send_message_sync(UserMessage(text=prompt))
        clean = re.sub(r"^```(?:json)?\s*|\s*```\s*$", "", resp.strip(), flags=re.MULTILINE | re.DOTALL)
        # Find the first {…} block to be safe
        m = re.search(r"\{.*\}", clean, re.DOTALL)
        if m:
            clean = m.group(0)
        return json.loads(clean)
    except Exception as e:
        logging.warning(f"[scraper] AI extraction failed: {e}")
        return None


def scrape_product(url: str) -> Dict:
    """Multi-method scrape — every layer adds to the result. AI is always the
    primary safety net (free for the user)."""
    out = {"_methods": []}
    domain = _domain(url)
    out["source_url"] = url
    out["source_domain"] = domain

    html = _fetch(url)

    # 1 — JSON-LD (works on most modern e-com sites)
    if html:
        soup = BeautifulSoup(html, "lxml")
        ld = _extract_ld_json(soup)
        if ld:
            _merge(out, ld)
            out["_methods"].append("json-ld")

        # 2 — Site-specific selectors fill gaps
        site_data = {}
        if "amazon" in domain:
            site_data = _extract_amazon(soup)
        elif "flipkart" in domain:
            site_data = _extract_flipkart(soup)
        elif "nykaa" in domain:
            site_data = _extract_nykaa(soup)
        if site_data:
            _merge(out, site_data)
            out["_methods"].append(f"selectors:{domain.split('.')[0]}")

        # 3 — AI extraction from HTML (always run if name still missing or sparse)
        needs_ai = (not out.get("name") or not out.get("price") or
                    not out.get("description") or not out.get("images"))
        if needs_ai:
            soup_clean = BeautifulSoup(html, "lxml")
            for t in soup_clean(["script", "style", "noscript", "iframe", "svg"]):
                t.decompose()
            text = soup_clean.get_text(separator="\n", strip=True)
            ai_data = _ai_extract(text, url, mode="html")
            if ai_data:
                _merge(out, ai_data)
                out["_methods"].append("ai:html")

    # 4 — URL-only AI fallback if everything else failed
    if not out.get("name"):
        ai_data = _ai_extract("", url, mode="url-only")
        if ai_data:
            _merge(out, ai_data)
            out["_methods"].append("ai:url-only")

    if not out.get("name"):
        return {
            "success": False,
            "error": "All methods failed (fetch blocked + AI could not infer). "
                     "Please paste fields manually or try a different URL.",
            "_methods": out.get("_methods", []),
            "source_domain": domain,
        }

    out["success"] = True
    return out


def scrape_reviews(url: str, max_reviews: int = 20) -> Dict:
    """Scrape reviews specifically. Reuses scrape_product since reviews live
    inside the product page on every site we support."""
    data = scrape_product(url)
    if not data.get("success"):
        return data
    reviews = data.get("reviews", [])[:max_reviews]
    return {
        "success": True,
        "source_url": url,
        "source_domain": data.get("source_domain"),
        "count": len(reviews),
        "reviews": reviews,
        "_methods": data.get("_methods", []),
    }
