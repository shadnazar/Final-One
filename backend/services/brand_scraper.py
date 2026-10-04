"""Robust brand-site image scraper using Shopify /products.json (most Indian D2C brands).

Strategy:
  1. Try `<site>/products.json?limit=250&page=N` (Shopify storefront API, always JSON).
     - Cache the full product list per brand site so subsequent rows reuse.
     - Fuzzy-match by Jaccard similarity on title tokens.
  2. If not Shopify, fall back to the older suggest/search HTML scrape.
  3. Returns dict with `image`, `url`, `description`, `ingredients`, `title`.
"""
from __future__ import annotations
import asyncio
import logging
import re
from typing import Optional, List
from urllib.parse import urljoin, quote_plus

import httpx
from bs4 import BeautifulSoup

from services.brand_websites import get_brand_site, is_shopify, normalize_brand

logger = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0 Safari/537.36"
)

# Cache: brand_site_url → [(title_lower_tokens, product_dict)]
_SHOPIFY_CACHE: dict[str, list] = {}
_SHOPIFY_CACHE_LOCK = asyncio.Lock()


_STOP = {"and", "the", "for", "of", "with", "ml", "g", "gm", "ltr", "l", "oz", "a", "an", "in"}


def _tokens(s: str) -> set:
    return {t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if t and t not in _STOP}


def _clean(text: Optional[str]) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _short_query(product_name: str) -> str:
    name = (product_name or "").strip()
    name = re.sub(r"\b\d+\.?\d*\s?(ML|GM?|L|OZ|FL\s?OZ)\b", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip()
    return " ".join(name.split()[:8])


async def _load_shopify_catalog(site: str, client: httpx.AsyncClient) -> List[dict]:
    """Fetch and cache the FULL product catalog from a Shopify storefront.

    Pages through /products.json?limit=250&page=N until an empty page is returned
    (Shopify caps each page at 250). Caches in-process for the lifetime of the
    pod. Returns a list of {title, handle, image, body_html, vendor, tags}.
    """
    async with _SHOPIFY_CACHE_LOCK:
        if site in _SHOPIFY_CACHE:
            return _SHOPIFY_CACHE[site]

    catalog: list = []
    try:
        for page in range(1, 21):  # safety cap: 5000 products max
            r = await client.get(
                f"{site}/products.json",
                params={"limit": 250, "page": page},
                timeout=15.0,
                headers={"User-Agent": UA, "Accept": "application/json"},
                follow_redirects=True,
            )
            if r.status_code != 200:
                break
            try:
                data = r.json()
            except Exception:
                break
            products = data.get("products") or []
            if not products:
                break
            for p in products:
                image = ""
                imgs = p.get("images") or []
                if imgs:
                    image = imgs[0].get("src") or ""
                elif p.get("image"):
                    image = p["image"].get("src", "")
                catalog.append({
                    "title": p.get("title", ""),
                    "handle": p.get("handle", ""),
                    "vendor": p.get("vendor", ""),
                    "body_html": p.get("body_html", ""),
                    "image": image,
                    "tags": p.get("tags") or [],
                })
            if len(products) < 250:
                break
    except Exception as e:
        logger.debug(f"[shopify-catalog] {site} err={e}")

    async with _SHOPIFY_CACHE_LOCK:
        _SHOPIFY_CACHE[site] = catalog
    logger.info(f"[shopify-catalog] {site}: cached {len(catalog)} products")
    return catalog


def _fuzzy_match(catalog: list, product_name: str, min_score: float = 0.45) -> Optional[dict]:
    """Pick the best title match from a Shopify catalog using Jaccard token overlap."""
    qt = _tokens(product_name)
    if not qt:
        return None
    best = None
    best_score = 0.0
    for p in catalog:
        tt = _tokens(p.get("title", ""))
        if not tt:
            continue
        inter = qt & tt
        if not inter:
            continue
        union = qt | tt
        score = len(inter) / len(union) if union else 0
        # Bonus for exact substring match
        if product_name.lower() in p.get("title", "").lower():
            score += 0.2
        if score > best_score:
            best_score = score
            best = p
    if best and best_score >= min_score:
        return best
    return None


async def _generic_search_first_product(site: str, query: str, client: httpx.AsyncClient) -> Optional[str]:
    try:
        r = await client.get(
            f"{site}/search",
            params={"q": query},
            timeout=8.0,
            headers={"User-Agent": UA},
            follow_redirects=True,
        )
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/product" in href.lower() and not href.startswith("#"):
                return urljoin(site, href)
    except Exception:
        return None
    return None


async def _scrape_page(url: str, client: httpx.AsyncClient) -> dict:
    try:
        r = await client.get(url, timeout=10.0, headers={"User-Agent": UA}, follow_redirects=True)
        if r.status_code != 200:
            return {}
        soup = BeautifulSoup(r.text, "lxml")
        og_img = soup.find("meta", property="og:image")
        image = og_img["content"] if og_img and og_img.get("content") else ""
        og_desc = soup.find("meta", property="og:description")
        desc = og_desc["content"] if og_desc and og_desc.get("content") else ""
        ingredients = ""
        for h in soup.find_all(re.compile("^h[2-6]$")):
            txt = (h.get_text() or "").lower()
            if "ingredient" in txt:
                nxt = h.find_next(["p", "div", "ul"])
                if nxt:
                    ingredients = _clean(nxt.get_text(" ", strip=True))[:1500]
                break
        return {"image": image, "description": _clean(desc), "ingredients": ingredients}
    except Exception:
        return {}


async def fetch_brand_product(brand_sheet: str, product_name: str) -> dict:
    """Top-level: returns the best match from the brand's official storefront.

    Result dict keys: image, url, title, description, ingredients (any may be missing).
    Tries multiple URL variants per brand (because mamaearth.in redirects to mamaearth.com etc).
    """
    site = get_brand_site(brand_sheet)
    if not site:
        return {}

    # Build candidate site URLs (cover common Shopify-hosting variants)
    sites_to_try = [site]
    if "://www." not in site:
        sites_to_try.append(site.replace("://", "://www."))
    # Try .com variant if site is .in (Mamaearth, Aqualogica, Dot&Key etc. host catalogue on .com)
    if site.endswith(".in"):
        sites_to_try.append(site[:-3] + ".com")
    elif site.endswith(".in/"):
        sites_to_try.append(site[:-4] + ".com")

    async with httpx.AsyncClient() as client:
        # Strategy A: Shopify /products.json across all site variants
        for candidate in sites_to_try:
            try:
                catalog = await _load_shopify_catalog(candidate, client)
                if not catalog:
                    continue
                match = _fuzzy_match(catalog, product_name)
                if match:
                    return {
                        "image": match.get("image", ""),
                        "url": f"{candidate}/products/{match.get('handle','')}" if match.get("handle") else "",
                        "title": match.get("title", ""),
                        "description": _clean(match.get("body_html", ""))[:1500],
                        "ingredients": "",
                    }
            except Exception as e:
                logger.debug(f"[brand-shopify] {candidate} err={e}")

        # Strategy B: Generic /search?q= → first product page → OG image
        try:
            product_url = await _generic_search_first_product(site, _short_query(product_name), client)
            if product_url:
                page = await _scrape_page(product_url, client)
                page["url"] = product_url
                return page
        except Exception:
            pass

    return {}


# Allow external callers (re-fetch endpoint) to clear the cache for a brand
def clear_cache(site: Optional[str] = None):
    if site is None:
        _SHOPIFY_CACHE.clear()
    else:
        _SHOPIFY_CACHE.pop(site, None)
