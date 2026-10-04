"""
SEO endpoints.

* GET /api/sitemap.xml — dynamic sitemap that includes every active product,
  niche, category, concern and blog from MongoDB. Auto-updates the moment a
  new SKU or blog is published in the admin panel.
* GET /api/seo/product-feed.json — lightweight JSON product feed for AI
  crawlers (ChatGPT/Claude/Perplexity) that prefer structured data over
  rendering JavaScript.

The site domain is read from the ``PUBLIC_SITE_URL`` env var; fall back to
``https://celestaglow.com`` if unset.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List
from xml.sax.saxutils import escape

from fastapi import APIRouter, Response

router = APIRouter()
db = None


def set_db(database):
    global db
    db = database


def _site_url() -> str:
    return (os.environ.get("PUBLIC_SITE_URL") or "https://celestaglow.com").rstrip("/")


def _iso_date(value) -> str:
    """Return YYYY-MM-DD for sitemap <lastmod>. Accepts ISO string or datetime."""
    try:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).date().isoformat()
        if isinstance(value, str) and value:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).date().isoformat()


def _url_entry(loc: str, lastmod: str, changefreq: str, priority: str) -> str:
    return (
        "  <url>\n"
        f"    <loc>{escape(loc)}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>\n"
    )


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml():
    """Dynamic XML sitemap built from the live catalog."""
    base = _site_url()
    today = datetime.now(timezone.utc).date().isoformat()

    parts: List[str] = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>\n')
    parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')

    # ---- 1. Static pages ----
    static_pages = [
        ("/",                    "daily",   "1.0"),
        ("/anti-aging",          "daily",   "0.9"),
        ("/skincare",            "daily",   "0.9"),
        ("/cosmetics",           "daily",   "0.9"),
        ("/shop",                "daily",   "0.9"),
        ("/about",               "monthly", "0.7"),
        ("/contact",             "monthly", "0.7"),
        ("/consultation",        "monthly", "0.7"),
        ("/blog",                "daily",   "0.8"),
        ("/track-order",         "monthly", "0.5"),
        ("/refund-policy",       "yearly",  "0.4"),
        ("/shipping-policy",     "yearly",  "0.4"),
        ("/terms",               "yearly",  "0.4"),
        ("/privacy",             "yearly",  "0.4"),
    ]
    for path, freq, prio in static_pages:
        parts.append(_url_entry(f"{base}{path}", today, freq, prio))

    # ---- 2. Products (every active SKU) ----
    if db is not None:
        try:
            products = await db.products.find(
                {"is_active": True},
                {"_id": 0, "slug": 1, "updated_at": 1, "created_at": 1, "niche": 1}
            ).to_list(length=5000)
            for p in products:
                slug = p.get("slug")
                if not slug:
                    continue
                lastmod = _iso_date(p.get("updated_at") or p.get("created_at"))
                parts.append(_url_entry(f"{base}/product/{slug}", lastmod, "weekly", "0.9"))
        except Exception:
            pass

        # ---- 3. Categories ----
        try:
            cats = await db.categories.find(
                {"is_active": True},
                {"_id": 0, "slug": 1, "updated_at": 1}
            ).to_list(length=200)
            for c in cats:
                slug = c.get("slug")
                if not slug:
                    continue
                parts.append(_url_entry(f"{base}/category/{slug}", _iso_date(c.get("updated_at")), "weekly", "0.7"))
        except Exception:
            pass

        # ---- 4. Concerns ----
        try:
            concs = await db.concerns.find(
                {"is_active": True},
                {"_id": 0, "slug": 1, "updated_at": 1}
            ).to_list(length=200)
            for c in concs:
                slug = c.get("slug")
                if not slug:
                    continue
                parts.append(_url_entry(f"{base}/concern/{slug}", _iso_date(c.get("updated_at")), "weekly", "0.6"))
        except Exception:
            pass

        # ---- 5. Subcategories ----
        try:
            subs = await db.subcategories.find(
                {"is_active": True},
                {"_id": 0, "slug": 1, "parent_category": 1, "updated_at": 1}
            ).to_list(length=500)
            for s in subs:
                slug = s.get("slug")
                parent = s.get("parent_category")
                if not slug or not parent:
                    continue
                parts.append(_url_entry(
                    f"{base}/category/{parent}?sub={slug}",
                    _iso_date(s.get("updated_at")), "weekly", "0.5"
                ))
        except Exception:
            pass

        # ---- 6. Blog posts ----
        try:
            blogs = await db.blogs.find(
                {"status": "published"},
                {"_id": 0, "slug": 1, "updated_at": 1, "created_at": 1}
            ).to_list(length=2000)
            for b in blogs:
                slug = b.get("slug")
                if not slug:
                    continue
                parts.append(_url_entry(
                    f"{base}/blog/{slug}",
                    _iso_date(b.get("updated_at") or b.get("created_at")),
                    "monthly", "0.6"
                ))
        except Exception:
            pass

    parts.append("</urlset>\n")
    return Response(content="".join(parts), media_type="application/xml")


@router.get("/seo/product-feed.json", include_in_schema=False)
async def product_feed_json():
    """AI-crawler-friendly JSON product feed. ChatGPT, Claude and Perplexity
    bots prefer structured JSON over rendering React. Returns active SKUs with
    canonical URL, price, description and key attributes."""
    base = _site_url()
    feed = {"site": base, "generated_at": datetime.now(timezone.utc).isoformat(), "products": []}
    if db is None:
        return feed
    try:
        products = await db.products.find(
            {"is_active": True},
            {
                "_id": 0,
                "slug": 1, "name": 1, "brand": 1, "tagline": 1, "description": 1,
                "key_ingredients": 1, "size": 1, "images": 1,
                "prepaid_price": 1, "mrp": 1, "stock_qty": 1,
                "niche": 1, "category": 1, "subcategory": 1, "concerns": 1,
                "reviews_count": 1, "rating": 1, "is_to_be_launched": 1,
            }
        ).to_list(length=5000)
    except Exception:
        products = []
    for p in products:
        slug = p.get("slug")
        if not slug:
            continue
        feed["products"].append({
            "url": f"{base}/product/{slug}",
            "name": p.get("name", ""),
            "brand": p.get("brand") or "Celesta Glow",
            "tagline": p.get("tagline", ""),
            "description": (p.get("description") or "")[:600],
            "key_ingredients": p.get("key_ingredients", ""),
            "size": p.get("size", ""),
            "image": (p.get("images") or [None])[0],
            "price_inr": p.get("prepaid_price"),
            "mrp_inr": p.get("mrp"),
            "availability": "OutOfStock" if (p.get("stock_qty") or 0) <= 0 else (
                "PreOrder" if p.get("is_to_be_launched") else "InStock"
            ),
            "niche": p.get("niche"),
            "category": p.get("category"),
            "subcategory": p.get("subcategory"),
            "concerns": p.get("concerns") or [],
            "rating": p.get("rating") or 4.7,
            "reviews_count": p.get("reviews_count") or 0,
        })
    return feed
