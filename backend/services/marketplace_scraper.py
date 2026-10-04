"""Image fallback sources when the brand's own storefront has no match.

We confirmed that Nykaa / Amazon / Flipkart return 403/503 from cloud IPs (their
WAFs block datacenter ASNs). Bing image search DOES return content from this
network, so that's our primary fallback. We add Yahoo Images as a secondary.

Every candidate URL is HEAD-verified before being accepted (content-type image/*,
size > 3 KB, HTTP 200).
"""
from __future__ import annotations
import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote_plus, unquote

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

UA_DESKTOP = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": UA_DESKTOP,
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


# ============================================================
# Verification
# ============================================================

async def verify_image_url(url: str, client: httpx.AsyncClient) -> bool:
    """Confirm URL serves a real image (≥3 KB, content-type image/*)."""
    if not url or not url.startswith(("http://", "https://")):
        return False
    try:
        try:
            r = await client.head(url, timeout=4.0, headers=DEFAULT_HEADERS, follow_redirects=True)
            if r.status_code in (200, 204):
                ctype = r.headers.get("content-type", "").lower()
                if ctype.startswith("image/"):
                    clen = r.headers.get("content-length")
                    if not clen or not clen.isdigit() or int(clen) >= 3000:
                        return True
        except Exception:
            pass
        # HEAD blocked or unhelpful — try a small range GET
        r = await client.get(
            url,
            timeout=5.0,
            headers={**DEFAULT_HEADERS, "Range": "bytes=0-4095"},
            follow_redirects=True,
        )
        if r.status_code not in (200, 206):
            return False
        ctype = r.headers.get("content-type", "").lower()
        if ctype.startswith("image/"):
            return len(r.content) > 1000
        # Some CDNs lie about content-type — sniff magic bytes
        b = r.content[:12] if r.content else b""
        if b.startswith(b"\xff\xd8\xff"):  # JPEG
            return True
        if b.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG
            return True
        if b.startswith(b"GIF8"):  # GIF
            return True
        if b.startswith(b"RIFF") and b[8:12] == b"WEBP":  # WEBP
            return True
        return False
    except Exception:
        return False


def _looks_relevant(scraped_title: str, expected_brand: str, expected_name: str) -> bool:
    """At least 2 meaningful tokens must overlap (skip stop-words)."""
    if not scraped_title:
        return True
    stop = {"and", "the", "for", "of", "with", "ml", "g", "gm", "in", "a", "an", "to", "on"}
    bag = {t for t in re.findall(r"[a-z0-9]+", scraped_title.lower()) if t not in stop and len(t) >= 2}
    want = {t for t in re.findall(r"[a-z0-9]+", (expected_brand + " " + expected_name).lower()) if t not in stop and len(t) >= 2}
    if not want:
        return True
    return len(bag & want) >= 2


# ============================================================
# Source A: Bing Images  (primary fallback — works from cloud IPs)
# ============================================================

_BING_MURL = re.compile(r'"murl":"([^"]+)"')
_BING_TURL = re.compile(r'"turl":"([^"]+)"')
_BING_T = re.compile(r'"t":"([^"]+)"')


async def fetch_from_bing(query: str, brand: str, name: str, client: httpx.AsyncClient) -> list:
    """Returns a list of (image_url, title) tuples, in Bing's relevance order."""
    out = []
    try:
        r = await client.get(
            "https://www.bing.com/images/search",
            params={"q": query, "form": "HDRSC2", "first": 1, "qft": "+filterui:photo-photo"},
            timeout=8.0,
            headers=DEFAULT_HEADERS,
            follow_redirects=True,
        )
        if r.status_code != 200:
            return out
        soup = BeautifulSoup(r.text, "lxml")
        # Each result card is <a class="iusc" m='{"murl":"...","t":"title",...}'>
        for a in soup.find_all("a", attrs={"m": True}):
            m_attr = a.get("m", "")
            murl_match = _BING_MURL.search(m_attr)
            if not murl_match:
                continue
            img_url = murl_match.group(1)
            title_match = _BING_T.search(m_attr)
            title = title_match.group(1) if title_match else ""
            # Decode escaped slashes
            img_url = img_url.replace("\\/", "/")
            title = title.replace("\\/", "/")
            if _looks_relevant(title, brand, name):
                out.append((img_url, title))
            if len(out) >= 6:
                break
    except Exception as e:
        logger.debug(f"[bing] err for {query!r}: {e}")
    return out


# ============================================================
# Source B: Yahoo Images  (secondary fallback)
# ============================================================

async def fetch_from_yahoo(query: str, brand: str, name: str, client: httpx.AsyncClient) -> list:
    out = []
    try:
        r = await client.get(
            "https://images.search.yahoo.com/search/images",
            params={"p": query, "ei": "UTF-8"},
            timeout=8.0,
            headers=DEFAULT_HEADERS,
            follow_redirects=True,
        )
        if r.status_code != 200:
            return out
        # Yahoo embeds image data in data-img attribute or in <img class="process">
        soup = BeautifulSoup(r.text, "lxml")
        for li in soup.select("li.ld"):
            img = li.find("img")
            if img and img.get("data-src"):
                url = img["data-src"]
                title = img.get("alt", "")
                if _looks_relevant(title, brand, name):
                    out.append((url, title))
            if len(out) >= 4:
                break
    except Exception as e:
        logger.debug(f"[yahoo] err for {query!r}: {e}")
    return out


# ============================================================
# Source C: Unsplash placeholder (last resort)
# ============================================================

def unsplash_placeholder(query: str) -> str:
    return f"https://source.unsplash.com/600x600/?{quote_plus(query)}"


# ============================================================
# Public: cascade with verification
# ============================================================

async def find_product_image(
    brand: str,
    name: str,
    brand_site_scrape: Optional[dict] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> dict:
    """Cascade for product images.

    NOTE: From cloud datacenter IPs, public image search engines (Bing, Yahoo, DDG)
    return either anti-bot pages or completely irrelevant/NSFW results — they are
    actively poisoned. So we DO NOT use them. Instead:
      1. Use brand-site Shopify match (already passed in via `brand_site_scrape`).
      2. If brand-site has no match, return `source='needs_manual'` so admin
         can upload the image from the admin UI.

    Returned dict: { image, source, verified, title }
        source ∈ {'brand-site', 'needs_manual'}
    """
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=10)

    try:
        # 1) Brand official site result
        if brand_site_scrape and brand_site_scrape.get("image"):
            img = brand_site_scrape["image"]
            if await verify_image_url(img, client):
                return {
                    "image": img,
                    "source": "brand-site",
                    "verified": True,
                    "title": brand_site_scrape.get("title", ""),
                }

        # 2) No usable image — flag for manual upload (no garbage placeholder)
        return {
            "image": "",
            "source": "needs_manual",
            "verified": False,
            "title": "",
        }
    finally:
        if own_client:
            await client.aclose()


def _shorten_query(name: str) -> str:
    name = re.sub(r"\b\d+\.?\d*\s?(ML|GM?|L|OZ|FL\s?OZ)\b", "", name or "", flags=re.I)
    name = re.sub(r"\s+", " ", name).strip()
    return " ".join(name.split()[:6])
