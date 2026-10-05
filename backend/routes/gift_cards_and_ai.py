"""Gift card admin + checkout APIs + AI-powered product enrichment endpoints.

Endpoints:
  Admin:
    GET    /api/admin/gift-cards
    POST   /api/admin/gift-cards            create
    PUT    /api/admin/gift-cards/{code}
    DELETE /api/admin/gift-cards/{code}
    GET    /api/admin/gift-cards/{code}/history
  Public (checkout):
    POST   /api/gift-cards/validate         {code, order_amount} → {valid, discount, ...}

  AI product enrichment (admin):
    POST   /api/admin/products/{slug}/fill-with-ai   re-generates description, benefits, how-to-use, key ingredients (price untouched)
    POST   /api/admin/products/analyze-url           {url} → scraped/enriched dict (admin pastes brand page URL)
    PUT    /api/admin/products/{slug}                update fields (price guard: prepaid_price/cod_price unchanged unless explicitly opted-in)
"""
from __future__ import annotations
from fastapi import APIRouter, Header, HTTPException, Cookie, Body, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
import re
import json
import logging
import uuid
import hashlib
import base64

router = APIRouter(prefix="/api", tags=["gift-cards-and-product-ai"])
logger = logging.getLogger(__name__)

_db = None
_gift_card_service = None
_verify_admin = None


def setup(db, gift_card_service, verify_admin_fn):
    global _db, _gift_card_service, _verify_admin
    _db = db
    _gift_card_service = gift_card_service
    _verify_admin = verify_admin_fn


def _auth(x_admin_token, admin_session):
    if _verify_admin is None:
        raise HTTPException(status_code=500, detail="auth not wired")
    _verify_admin(x_admin_token=x_admin_token, admin_session=admin_session)


# ============================================================
# ADMIN — Gift Cards CRUD
# ============================================================

class GiftCardCreate(BaseModel):
    code: Optional[str] = None
    initial_balance: float
    label: Optional[str] = ""
    expiry_date: Optional[str] = None


class GiftCardUpdate(BaseModel):
    label: Optional[str] = None
    is_active: Optional[bool] = None
    expiry_date: Optional[str] = None
    remaining_balance: Optional[float] = None


@router.get("/admin/gift-cards")
async def list_gift_cards(
    page: int = 1, limit: int = 50,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return await _gift_card_service.list_cards(page=page, limit=limit)


@router.post("/admin/gift-cards")
async def create_gift_card(
    body: GiftCardCreate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    try:
        return await _gift_card_service.create_card(body.code, body.initial_balance, body.label or "", body.expiry_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/gift-cards/{code}")
async def update_gift_card(
    code: str,
    body: GiftCardUpdate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    fields = body.model_dump(exclude_none=True)
    return await _gift_card_service.update(code, **fields)


@router.delete("/admin/gift-cards/{code}")
async def delete_gift_card(
    code: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _gift_card_service.delete(code)
    return {"success": ok}


@router.get("/admin/gift-cards/{code}/history")
async def gift_card_history(
    code: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return {"redemptions": await _gift_card_service.history(code)}


# ============================================================
# PUBLIC — Validate gift card on checkout
# ============================================================

class GiftCardValidateRequest(BaseModel):
    code: str
    order_amount: float


@router.post("/gift-cards/validate")
async def validate_gift_card(body: GiftCardValidateRequest):
    return await _gift_card_service.validate_for_redemption(body.code, body.order_amount)


# ============================================================
# ADMIN — Per-product edit + AI fill + URL analyze
# ============================================================

class ProductFieldsUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    key_ingredients: Optional[str] = None
    ingredients_full: Optional[str] = None
    benefits: Optional[list] = None
    how_to_use: Optional[str] = None
    size: Optional[str] = None
    images: Optional[list] = None
    image: Optional[str] = None  # singular form used by older bulk-imported products & QuickImageEditor
    category: Optional[str] = None
    concerns: Optional[list] = None
    badges: Optional[list] = None
    brand: Optional[str] = None
    tagline: Optional[str] = None
    stock_qty: Optional[int] = None
    is_to_be_launched: Optional[bool] = None
    is_active: Optional[bool] = None
    # PRICE CHANGES — guarded: pass allow_price_change=true to update
    prepaid_price: Optional[float] = None
    cod_price: Optional[float] = None
    mrp: Optional[float] = None
    allow_price_change: bool = False


@router.put("/admin/products/{slug}")
async def admin_update_product(
    slug: str,
    body: ProductFieldsUpdate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Admin edit — by default does NOT change prices (per user spec).
    Pass allow_price_change=true to update prepaid/cod/MRP.
    """
    _auth(x_admin_token, admin_session)
    upd = body.model_dump(exclude_none=True)
    allow_price = upd.pop("allow_price_change", False)
    if not allow_price:
        for k in ("prepaid_price", "cod_price", "mrp"):
            upd.pop(k, None)
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await _db.products.update_one({"slug": slug}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
    return prod


class FillWithAIRequest(BaseModel):
    fields: Optional[list] = None  # ["description", "benefits", "how_to_use", "key_ingredients", "concerns"]


@router.post("/admin/products/{slug}/fill-with-ai")
async def fill_with_ai(
    slug: str,
    body: Optional[FillWithAIRequest] = None,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Re-generate description / benefits / how-to-use / key ingredients with Claude.
    Price is never touched.
    """
    _auth(x_admin_token, admin_session)
    prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""Product to enrich:
Brand: {prod.get('brand', '')}
Name: {prod.get('name', '')}
Type: {prod.get('subcategory', '')}
Niche: {prod.get('niche', '')}

Return STRICT JSON only (no markdown fences), exactly these keys:
{{
  "description": "120-180 word consumer-facing product description for an Indian beauty store. Mention key benefits and how it suits Indian skin/weather.",
  "key_ingredients": "Comma-separated 3-6 hero ingredients (omit if obviously cosmetic/makeup)",
  "benefits": ["3-5 short benefit phrases, each <=8 words"],
  "how_to_use": "1-2 sentence usage instruction",
  "tagline": "5-8 word punchy product tagline"
}}
Be factual, concise, no medical claims."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"fill-{uuid.uuid4().hex[:8]}",
            system_message="You are an expert Indian beauty/skincare cataloging assistant.",
        ).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{[\s\S]*\}", resp or "")
        if not match:
            raise ValueError("No JSON in LLM response")
        data = json.loads(match.group())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI enrichment failed: {e}")

    upd = {
        "description": (data.get("description") or "")[:1800],
        "key_ingredients": (data.get("key_ingredients") or "")[:400],
        "benefits": list(data.get("benefits") or [])[:8],
        "how_to_use": (data.get("how_to_use") or "")[:400],
        "tagline": (data.get("tagline") or "")[:80],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "ai_enriched_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.products.update_one({"slug": slug}, {"$set": upd})
    return {"success": True, "updated": upd}


class AnalyzeURLRequest(BaseModel):
    url: str
    slug: Optional[str] = None  # If provided, applies result to that product


@router.post("/admin/products/analyze-url")
async def analyze_url(
    body: AnalyzeURLRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Scrape a brand product URL → extract name, description, ingredients,
    images. Returns structured dict. Optionally apply to an existing product slug.
    """
    _auth(x_admin_token, admin_session)
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    # 1. Fetch HTML
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(body.url, headers={"User-Agent": "Mozilla/5.0 CelestaGlowBot"})
            r.raise_for_status()
            html = r.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")

    # 2. Extract main content
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()
    title = (soup.find("title").get_text(strip=True) if soup.find("title") else "")[:200]
    # OG image
    og_img = ""
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        og_img = og["content"]
    # First couple of large product images
    images = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if not src or src.startswith("data:"):
            continue
        if any(x in src.lower() for x in ["logo", "icon", "sprite", "favicon"]):
            continue
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            from urllib.parse import urljoin
            src = urljoin(body.url, src)
        images.append(src)
        if len(images) >= 4:
            break
    if og_img and og_img not in images:
        images.insert(0, og_img)
    # Text content (trim)
    text = soup.get_text(separator=" ", strip=True)[:8000]

    if not api_key:
        return {"title": title, "images": images, "raw_text_preview": text[:500]}

    # 3. LLM extraction
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""URL: {body.url}
Page title: {title}
Page text (truncated):
{text[:4000]}

Extract product details. Return STRICT JSON only:
{{
  "name": "clean product name",
  "brand": "brand name",
  "description": "120-180 word consumer-facing description",
  "key_ingredients": "comma-separated 3-6 hero ingredients",
  "ingredients_full": "full INCI list if found, else ''",
  "benefits": ["3-5 short benefit phrases"],
  "how_to_use": "1-2 sentence usage",
  "size": "size like '50ml' or ''",
  "tagline": "5-8 word tagline"
}}"""
    try:
        chat = LlmChat(api_key=api_key, session_id=f"url-{uuid.uuid4().hex[:8]}",
                      system_message="You extract clean product data from brand pages.").with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{[\s\S]*\}", resp or "")
        data = json.loads(match.group()) if match else {}
    except Exception as e:
        logger.warning(f"[analyze-url] LLM extraction failed: {e}")
        data = {}

    result = {
        "name": data.get("name") or title,
        "brand": data.get("brand") or "",
        "description": data.get("description") or "",
        "key_ingredients": data.get("key_ingredients") or "",
        "ingredients_full": data.get("ingredients_full") or "",
        "benefits": data.get("benefits") or [],
        "how_to_use": data.get("how_to_use") or "",
        "size": data.get("size") or "",
        "tagline": data.get("tagline") or "",
        "images": images,
        "source_url": body.url,
    }

    # Optionally apply directly to a product slug
    if body.slug:
        prod = await _db.products.find_one({"slug": body.slug}, {"_id": 0, "slug": 1})
        if prod:
            upd = {k: v for k, v in result.items() if v and k != "source_url"}
            upd["updated_at"] = datetime.now(timezone.utc).isoformat()
            upd["ai_enriched_at"] = datetime.now(timezone.utc).isoformat()
            # Don't touch price
            await _db.products.update_one({"slug": body.slug}, {"$set": upd})
            result["applied_to_slug"] = body.slug

    return result


# ============================================================
# Admin — taxonomy + reclassification trigger
# ============================================================

@router.post("/admin/taxonomy/reset-and-reclassify")
async def reset_and_reclassify(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """One-click: wipe concerns + skincare/cosmetics categories, seed new ones,
    then reclassify all 7000+ products by keyword rules. Idempotent."""
    _auth(x_admin_token, admin_session)
    from taxonomy_v2 import reset_taxonomy, reclassify_all_products
    tx = await reset_taxonomy(_db)
    cls = await reclassify_all_products(_db)
    return {"taxonomy": tx, "reclassification": cls}



# ============================================================
# Bulk AI Fill — enrich many products with AI in one shot
# ============================================================

_bulk_ai_jobs: Dict[str, Dict[str, Any]] = {}


async def _enrich_one_product(api_key: str, prod: dict) -> dict:
    """Call Claude Haiku to enrich a single product. Returns the update dict."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""Product to enrich:
Brand: {prod.get('brand', '')}
Name: {prod.get('name', '')}
Type: {prod.get('subcategory') or prod.get('category', '')}
Niche: {prod.get('niche', '')}

Return STRICT JSON only (no markdown fences), exactly these keys:
{{
  "description": "120-180 word consumer-facing product description for an Indian beauty store.",
  "key_ingredients": "Comma-separated 3-6 hero ingredients (omit if obviously cosmetic/makeup)",
  "benefits": ["3-5 short benefit phrases, each <=8 words"],
  "how_to_use": "1-2 sentence usage instruction",
  "tagline": "5-8 word punchy product tagline"
}}"""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"bulk-fill-{uuid.uuid4().hex[:8]}",
        system_message="You are an expert Indian beauty cataloging assistant.",
    ).with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=prompt))
    match = re.search(r"\{[\s\S]*\}", resp or "")
    if not match:
        raise ValueError("No JSON in LLM response")
    data = json.loads(match.group())
    now = datetime.now(timezone.utc).isoformat()
    return {
        "description": (data.get("description") or "")[:1800],
        "key_ingredients": (data.get("key_ingredients") or "")[:400],
        "benefits": list(data.get("benefits") or [])[:8],
        "how_to_use": (data.get("how_to_use") or "")[:400],
        "tagline": (data.get("tagline") or "")[:80],
        "updated_at": now,
        "ai_enriched_at": now,
    }


async def _bulk_fill_worker(job_id: str, slugs: list, concurrency: int = 5):
    import asyncio as _aio
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    sem = _aio.Semaphore(concurrency)
    job = _bulk_ai_jobs[job_id]

    async def one(slug: str):
        async with sem:
            try:
                prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
                if not prod:
                    job["failed"] += 1
                    return
                upd = await _enrich_one_product(api_key, prod)
                await _db.products.update_one({"slug": slug}, {"$set": upd})
                job["done"] += 1
                job["last_slug"] = slug
            except Exception as e:
                logger.warning(f"[bulk-ai-fill] {slug}: {e}")
                job["failed"] += 1
                job["errors"].append({"slug": slug, "error": str(e)[:200]})

    try:
        await _aio.gather(*[one(s) for s in slugs])
        job["status"] = "completed"
    except Exception as e:
        job["status"] = "failed"
        job["fatal_error"] = str(e)


class BulkAIFillRequest(BaseModel):
    scope: str = "needs_enrichment"  # 'needs_enrichment' | 'all' | 'niche' | 'category'
    niche: Optional[str] = None
    category: Optional[str] = None
    limit: int = 200
    concurrency: int = 5
    only_missing: bool = True  # If True, skip products that already have description+benefits


@router.post("/admin/products/bulk-ai-fill")
async def bulk_ai_fill(
    body: BulkAIFillRequest = Body(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Kick off background AI enrichment for many products.

    Returns immediately with a job_id; poll GET /admin/products/bulk-ai-fill/{job_id}.
    """
    _auth(x_admin_token, admin_session)
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    q: Dict[str, Any] = {}
    if body.scope == "niche" and body.niche:
        q["niche"] = body.niche
    elif body.scope == "category" and body.category:
        q["category"] = body.category
    if body.only_missing or body.scope == "needs_enrichment":
        q["$or"] = [
            {"description": {"$in": [None, ""]}},
            {"benefits": {"$size": 0}},
            {"key_ingredients": {"$in": [None, ""]}},
            {"ai_enriched_at": {"$exists": False}},
        ]

    cur = _db.products.find(q, {"_id": 0, "slug": 1}).limit(max(1, min(body.limit, 2000)))
    slugs = [d["slug"] async for d in cur]
    if not slugs:
        return {"success": True, "queued": 0, "message": "No products match the scope."}

    job_id = f"aifill_{uuid.uuid4().hex[:10]}"
    _bulk_ai_jobs[job_id] = {
        "job_id": job_id,
        "total": len(slugs),
        "done": 0,
        "failed": 0,
        "status": "running",
        "scope": body.scope,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "errors": [],
        "last_slug": "",
    }
    import asyncio as _aio
    _aio.create_task(_bulk_fill_worker(job_id, slugs, body.concurrency))
    return {"success": True, "job_id": job_id, "queued": len(slugs)}


@router.get("/admin/products/bulk-ai-fill/{job_id}")
async def bulk_ai_fill_status(
    job_id: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    job = _bulk_ai_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/admin/products/bulk-ai-fill")
async def bulk_ai_fill_list(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """List recent bulk-ai-fill jobs (in-memory; resets on backend restart)."""
    _auth(x_admin_token, admin_session)
    items = sorted(_bulk_ai_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)
    return {"jobs": items[:50]}



# ============================================================
# AI Analyze a SINGLE product (used by the admin edit form)
# - classifies niche/category/subcategory/concerns from name+brand
# - auto-creates any missing taxonomy rows
# - returns the routing so the form can pre-select chips
# ============================================================

class AIAnalyzeRequest(BaseModel):
    name: str
    brand: Optional[str] = ""
    main_category: Optional[str] = ""   # "skincare" | "cosmetics" | "anti-aging" (free text okay)
    product_type: Optional[str] = ""
    concern: Optional[str] = ""
    skin_type: Optional[str] = ""
    auto_create: bool = True


@router.post("/admin/ai/analyze-product")
async def admin_ai_analyze_product(
    body: AIAnalyzeRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Run the DB-aware AI classifier on a single product and (optionally)
    auto-create any missing taxonomy rows. Uses the SAME logic as the
    catalog-wide AI Taxonomy Audit — so the result is consistent.
    """
    _auth(x_admin_token, admin_session)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Product name is required")

    from services.ai_categorizer import classify_one
    prod = {
        "name": body.name,
        "brand": body.brand or "",
        "niche": body.main_category or "",
        "category": "",
        "subcategory": body.product_type or "",
        "concerns": [],
        "main_category_hint": body.main_category or "",
        "product_type_hint": body.product_type or "",
        "concern_hint": body.concern or "",
        "skin_type_hint": body.skin_type or "",
    }
    try:
        result = await classify_one(_db, prod)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI classify failed: {e}")

    created: Dict[str, list] = {"categories": [], "subcategories": [], "concerns": []}
    if body.auto_create:
        if result.get("category_slug") and result.get("category_is_new"):
            exists = await _db.categories.find_one({"slug": result["category_slug"]}, {"_id": 1})
            if not exists:
                await _db.categories.insert_one({
                    "slug": result["category_slug"],
                    "name": result["category_name"],
                    "niche": result["niche"],
                    "group": result["niche"],
                    "is_parent": False,
                    "tagline": "",
                    "image": "",
                    "icon": result.get("category_icon") or "🛍️",
                    "sort_order": 99,
                    "is_active": True,
                    "ai_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                created["categories"].append(result["category_slug"])
        if result.get("subcategory_slug") and result.get("subcategory_is_new"):
            exists = await _db.subcategories.find_one({"slug": result["subcategory_slug"]}, {"_id": 1})
            if not exists:
                await _db.subcategories.insert_one({
                    "slug": result["subcategory_slug"],
                    "name": result["subcategory_name"],
                    "parent_category": result["category_slug"],
                    "niche": result["niche"],
                    "tagline": "",
                    "icon": result.get("subcategory_icon") or "",
                    "image": "",
                    "sort_order": 0,
                    "is_active": True,
                    "ai_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                created["subcategories"].append(result["subcategory_slug"])
        for c in result.get("concerns") or []:
            if c.get("is_new"):
                exists = await _db.concerns.find_one({"slug": c["slug"]}, {"_id": 1})
                if not exists:
                    await _db.concerns.insert_one({
                        "slug": c["slug"],
                        "name": c["name"],
                        "tagline": "",
                        "icon": "✨",
                        "image": "",
                        "accent_from": "#dcfce7",
                        "accent_to": "#bbf7d0",
                        "accent_text": "#14532d",
                        "description": "",
                        "sort_order": 99,
                        "is_active": True,
                        "niche": result["niche"],
                        "ai_created": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    created["concerns"].append(c["slug"])

    return {
        "success": True,
        "classification": result,
        "auto_created": created,
    }


# ============================================================
# ONE-CLICK AI Taxonomy Audit — runs across the whole catalog
# ============================================================

class AITaxonomyAuditRequest(BaseModel):
    scope: str = "needs_taxonomy"  # 'needs_taxonomy' | 'niche' | 'all'
    niche: Optional[str] = None  # used when scope='niche'
    limit: Optional[int] = None
    concurrency: int = 6
    only_missing: bool = True


@router.post("/admin/taxonomy/ai-audit")
async def admin_ai_taxonomy_audit(
    body: AITaxonomyAuditRequest = Body(default_factory=AITaxonomyAuditRequest),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Kick off a background AI audit that:
      • Loads the CURRENT canonical category/subcategory/concern lists from MongoDB.
      • Classifies every product in scope against that taxonomy via Claude.
      • Auto-creates new categories / subcategories / concerns when needed.
      • Updates each product's niche/category/subcategory/concerns fields.
    Returns a job_id; poll GET /admin/taxonomy/ai-audit/{job_id}.
    """
    _auth(x_admin_token, admin_session)
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    from services.ai_categorizer import create_audit_job, run_audit_job
    import asyncio as _aio
    job_id = create_audit_job(body.scope, body.niche, body.limit)
    _aio.create_task(run_audit_job(
        _db, job_id, body.scope, niche=body.niche, limit=body.limit,
        concurrency=max(1, min(body.concurrency, 10)),
        only_missing=body.only_missing,
    ))
    return {"success": True, "job_id": job_id}


@router.get("/admin/taxonomy/ai-audit/{job_id}")
async def admin_ai_taxonomy_audit_status(
    job_id: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    from services.ai_categorizer import get_audit_job
    job = get_audit_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/admin/taxonomy/ai-audit")
async def admin_ai_taxonomy_audit_list(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Recent audit jobs (in-memory; resets on backend restart)."""
    _auth(x_admin_token, admin_session)
    from services.ai_categorizer import list_audit_jobs
    return {"jobs": list_audit_jobs()}


# ============================================================
# Danger zone: wipe all products (for re-testing bulk upload)
# ============================================================

@router.post("/admin/products/wipe-all")
async def admin_wipe_all_products(
    confirm: str = Query(..., description="Must be exactly 'DELETE_ALL' to proceed."),
    keep_niches: Optional[str] = Query(None, description="Comma-separated niches to KEEP (e.g. 'anti-aging'). Default: wipe everything."),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Hard-delete every product (optionally keeping certain niches).

    Idempotent and safe; pass `confirm=DELETE_ALL` to actually execute.
    Returns counts of what got deleted.
    """
    _auth(x_admin_token, admin_session)
    if confirm != "DELETE_ALL":
        raise HTTPException(status_code=400, detail="Pass confirm=DELETE_ALL to execute.")
    keep = [n.strip() for n in (keep_niches or "").split(",") if n.strip()]
    q: Dict[str, Any] = {}
    if keep:
        q = {"niche": {"$nin": keep}}
    before = await _db.products.count_documents(q)
    res = await _db.products.delete_many(q)
    after = await _db.products.count_documents({})
    return {
        "success": True,
        "deleted": res.deleted_count,
        "matched": before,
        "remaining_total": after,
        "kept_niches": keep,
    }



# ============================================================
# Fix bad brand values (Sheet1 / Sheet2 / blank) on already-imported products
# ============================================================

@router.post("/admin/products/fix-brands")
async def admin_fix_brands(
    dry_run: bool = Query(False),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Repair products where brand is literally 'Sheet1' / 'Sheet2' / blank.

    Re-derives brand from product name using the same heuristic the parser
    now uses for new uploads (first 1–2 capitalised tokens, stopping at
    common product nouns). Slug is left alone to avoid breaking links.
    """
    _auth(x_admin_token, admin_session)
    import re as _re
    stop = {"face", "skin", "cream", "serum", "wash", "lotion", "spf", "oil", "lip", "eye", "anti", "night", "day", "mask", "toner", "balm", "scrub", "gel", "foam", "cleanser", "moisturizer", "moisturiser", "sunscreen", "lipstick", "kajal", "mascara", "eyeliner", "foundation", "concealer", "primer", "compact", "blush", "highlighter", "powder", "for", "with", "the"}
    bad = {"sheet1", "sheet2", "sheet3", "sheet4", "sheet5", "sheet", "", "nan"}

    def derive_brand(name: str) -> str:
        tokens = _re.findall(r"[A-Za-z0-9&]+", str(name or "").strip())
        if not tokens:
            return ""
        picked = []
        for t in tokens[:2]:
            if t.lower() in stop:
                break
            picked.append(t)
        return " ".join(picked).strip() or tokens[0]

    q = {"$or": [
        {"brand": {"$in": ["Sheet1", "Sheet2", "Sheet3", "Sheet4", "Sheet5", "", None]}},
        {"brand": {"$regex": "^Sheet\\d+$"}},
    ]}
    fixed = 0
    examples = []
    async for p in _db.products.find(q, {"_id": 0, "slug": 1, "brand": 1, "name": 1}):
        new_brand = derive_brand(p.get("name", ""))
        if not new_brand or new_brand.lower() in bad:
            continue
        if not dry_run:
            await _db.products.update_one({"slug": p["slug"]}, {"$set": {"brand": new_brand, "updated_at": datetime.now(timezone.utc).isoformat()}})
        fixed += 1
        if len(examples) < 10:
            examples.append({"slug": p["slug"], "old_brand": p.get("brand"), "new_brand": new_brand})
    return {"success": True, "dry_run": dry_run, "fixed": fixed, "examples": examples}


# ============================================================
# Seed COMPREHENSIVE skincare + cosmetics taxonomy
# ============================================================

@router.post("/admin/taxonomy/seed-comprehensive")
async def admin_taxonomy_seed_comprehensive(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Insert the canonical Celesta Glow taxonomy (concerns, categories,
    subcategories) used by the AI audit to route products. Idempotent —
    only inserts rows that don't already exist (by slug)."""
    _auth(x_admin_token, admin_session)
    from services.taxonomy_seed_v2 import seed_comprehensive_taxonomy
    counts = await seed_comprehensive_taxonomy(_db)
    return {"success": True, "inserted": counts}



# ============================================================
# One-click: Connect ALL products to the canonical taxonomy
# (rule-based, no LLM cost, runs full 9k catalog in seconds)
# ============================================================

class ConnectAllRequest(BaseModel):
    only_unconnected: bool = False
    niche: Optional[str] = None
    limit: Optional[int] = None


@router.post("/admin/taxonomy/connect-all")
async def admin_taxonomy_connect_all(
    body: ConnectAllRequest = Body(default_factory=ConnectAllRequest),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Rule-based one-click router. For every product:
      • Detect niche (skincare / cosmetics / anti-aging) from product name keywords
      • Match best canonical category slug + subcategory sub-filter
      • Tag matching concerns (acne, pigmentation, brightening, etc.)
      • Update product → those storefront pages instantly populate.

    Uses ONLY keyword matching — no LLM. Full 9k catalog routes in ~5 seconds.
    """
    _auth(x_admin_token, admin_session)
    from services.rule_based_router import connect_all_products
    stats = await connect_all_products(
        _db,
        only_unconnected=body.only_unconnected,
        niche_filter=body.niche,
        limit=body.limit,
    )
    return {"success": True, **stats}



# ============================================================
# ONE-CLICK AI PRODUCT GENERATOR
# Given just a product name (+ optional brand/image hint) this single
# endpoint: (1) classifies niche/category/subcategory/concerns and
# auto-creates any missing taxonomy, (2) writes full marketing copy,
# (3) generates a product image, and (4) creates the live product.
# ============================================================
import random as _random
from pathlib import Path as _Path

_PROD_IMG_DIR = _Path(__file__).parent.parent / "uploads" / "products"
_PROD_IMG_DIR.mkdir(parents=True, exist_ok=True)


class OneClickProductRequest(BaseModel):
    name: str
    brand: Optional[str] = "Celesta Glow"
    key_ingredients: Optional[str] = ""
    image_url: Optional[str] = None          # if admin already has an image, skip AI image
    generate_image: bool = True
    # Optional admin-picked reference bottle photo for AI image generation. If
    # omitted, the site-settings references / default approved bottles are used.
    reference_image_url: Optional[str] = None
    is_active: bool = True
    # ---- Optional pre-generation specifications (considered by the AI copy + price) ----
    price_min: Optional[int] = None          # desired MRP range (INR) — lower bound
    price_max: Optional[int] = None          # desired MRP range (INR) — upper bound
    target_audience: Optional[str] = None    # e.g. "men 25-35, oily skin"
    skin_type: Optional[str] = None          # e.g. "oily / dry / combination / all"
    texture: Optional[str] = None            # e.g. "lightweight gel", "rich cream"
    fragrance: Optional[str] = None          # e.g. "fragrance-free", "mild citrus"
    size_hint: Optional[str] = None          # e.g. "30ml", "50g"
    extra_specs: Optional[str] = None        # free-form extra requirements/notes


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:70] or f"product-{uuid.uuid4().hex[:6]}"


# Default approved bottle references (exact bottles the brand uses). Admin can
# override these in Admin → Settings with their own reference photos.
_DEFAULT_REF_BOTTLES = {
    "serum": "https://res.cloudinary.com/dcvuqcqjn/image/upload/q_auto:best,f_auto/celesta-glow/brand/brand-bottle-serum.jpg",
    "cream": "https://res.cloudinary.com/dcvuqcqjn/image/upload/q_auto:best,f_auto/celesta-glow/brand/brand-bottle-cream.jpg",
}

# Keywords that map a product to the taller cream-style bottle (same rule the
# rest of the pipeline uses).
_CREAM_WORDS = (
    "cream", "moistur", "night", "balm", "butter", "mask", "lotion", "gel",
    "sunscreen", "spf", "eye", "ointment", "salve",
)


def _bottle_kind(name: str, category: str) -> str:
    hay = f"{category or ''} {name or ''}".lower()
    return "cream" if any(w in hay for w in _CREAM_WORDS) else "serum"


async def _ai_generate_product_image(name: str, brand: str, category: str,
                                     ref_images: Optional[list] = None,
                                     extra_prompt: str = "",
                                     size: str = "",
                                     variant: str = "front",
                                     tag: str = "hero") -> Optional[str]:
    """Generate a brand-NEW product image with Gemini (Nano Banana), using the
    reference bottle photo ONLY as a design guide, on a STRICT pure-white
    background.

    ``variant`` changes the framing so the hero + sub images look like a neat
    matching set: 'front' (straight-on), 'angle' (three-quarter), 'detail'
    (closer crop). ``tag`` controls the Cloudinary public_id suffix so each
    generated image is stored separately.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        logger.error("[img-gen] EMERGENT_LLM_KEY not configured — cannot AI-generate product image")
        return None

    kind = _bottle_kind(name, category)

    # Resolve the reference bottle URL for this product's kind.
    ref_url = None
    if ref_images:
        ref_url = ref_images[0] if isinstance(ref_images, list) else ref_images
    if not ref_url and _db is not None:
        try:
            _ss = await _db.site_settings.find_one(
                {"_id": "main"},
                {"_id": 0,
                 "product_image_reference_serum_url": 1,
                 "product_image_reference_cream_url": 1,
                 "product_image_reference_url": 1},
            ) or {}
            ref_url = (
                (_ss.get(f"product_image_reference_{kind}_url") or "").strip()
                or (_ss.get("product_image_reference_url") or "").strip()
                or None
            )
        except Exception:
            ref_url = None
    if not ref_url:
        ref_url = _DEFAULT_REF_BOTTLES.get(kind) or _DEFAULT_REF_BOTTLES["serum"]

    # Build the exact label copy the AI must print. extra_prompt here is the
    # CLEAN comma-separated actives (no prose sentence).
    product_name = (name or "Advanced Formula").strip()
    brand_name = (brand or "Celesta Glow").strip()
    actives = re.sub(r"\s+", " ", (extra_prompt or "")).strip()
    actives = re.sub(r"\s*\d+(\.\d+)?%", "", actives)  # strip % strengths for a clean label
    size_txt = (size or "").strip()

    # Framing per variant so the hero + sub images form a neat matching set.
    framing_map = {
        "front":  "a straight-on front view with the bottle dead-centre",
        "angle":  "a subtle three-quarter angle with the bottle centred",
        "detail": "a slightly closer, straight-on crop focusing on the bottle body and pump",
    }
    framing = framing_map.get(variant, framing_map["front"])

    label_lines = [
        f"Brand (small caps, top of label): {brand_name.upper()}",
        f"Product name (largest, bold, centred): {product_name.upper()}",
    ]
    if actives:
        label_lines.append(f"Key actives (small caps, centred): {actives.upper()}")
    label_lines.append("Footer (small): FOR ALL SKIN TYPES")
    if size_txt:
        label_lines.append(f"Size (small, bottom): {size_txt}")
    label_block = "\n".join("  - " + ln for ln in label_lines)

    # Download the reference bottle (bytes → image input for the AI).
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=30.0, follow_redirects=True) as _hc:
            _r = await _hc.get(ref_url)
            _r.raise_for_status()
            ref_bytes = _r.content
    except Exception as e:
        logger.error(f"[img-gen] could not download reference bottle ({ref_url}): {e}")
        return None

    prompt = (
        "Generate a completely NEW, original, photorealistic product photograph. Use the attached "
        "reference image ONLY as a guide for the bottle's design.\n"
        f"FRAMING: {framing}.\n"
        "BOTTLE: Reproduce the EXACT same bottle as the reference — identical shape, clear pump cap, "
        "finish and proportions. Do NOT invent a different bottle.\n"
        "LABEL: Print a fresh, clean, minimal premium label on the bottle showing ONLY the text below. "
        "Centre it on the bottle's front face with clear margins on both sides; use a clean sans-serif "
        "typeface at a modest size so EVERY word is fully visible and correctly spelled with nothing "
        "cropped at the edges:\n"
        f"{label_block}\n"
        "BACKGROUND: a STRICT, uniform, PURE-WHITE background (#FFFFFF) edge-to-edge — no props, no "
        "gradients, no colours, no scenery; only a very soft, subtle contact shadow beneath the bottle. "
        "Bright, clean, high-resolution, e-commerce catalogue quality. No watermark, no extra text, "
        "no other objects."
    )

    # STRICT: image generation uses ONLY the direct GEMINI API KEY (Google GenAI
    # SDK, model gemini-2.5-flash-image = "Nano Banana"), with the reference
    # bottle as the image input. No other provider is used.
    out_bytes = None
    mime = "image/png"
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        logger.error("[img-gen] GEMINI_API_KEY not configured — product image generation requires it")
        return None
    try:
        import asyncio as _asyncio
        from google import genai
        from google.genai import types as _gtypes
        client = genai.Client(api_key=gemini_key)
        parts = [prompt, _gtypes.Part.from_bytes(data=ref_bytes, mime_type="image/jpeg")]

        def _gen():
            return client.models.generate_content(model="gemini-2.5-flash-image", contents=parts)

        resp = await _asyncio.to_thread(_gen)
        for part in (resp.candidates[0].content.parts if getattr(resp, "candidates", None) else []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                out_bytes = inline.data
                mime = inline.mime_type or "image/png"
                break
    except Exception as e:
        logger.error(f"[img-gen] Gemini image generation failed for '{product_name}': {str(e)[:160]}")

    if not out_bytes:
        logger.error(f"[img-gen] Gemini returned no image for '{product_name}'")
        return None

    try:
        from services import durable_images
        return await durable_images.save_image(
            _db, out_bytes,
            slug=_slugify(name), tag=tag,
            folder="celesta-glow/generated",
        )
    except Exception as e:
        logger.error(f"[img-gen] durable save failed for '{name}': {e}")
        return None


@router.post("/admin/ai/one-click-product")
async def one_click_product(
    body: OneClickProductRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Create a fully-formed product from just a name in a single click.

    Pipeline:
      1. AI classify → niche / category / subcategory / concerns (+auto-create taxonomy)
      2. AI copywriting → tagline, description, ingredients, benefits, how-to-use, size, price, FAQs
      3. AI image generation (optional)
      4. Insert product + fire-and-forget AI reviews
    """
    _auth(x_admin_token, admin_session)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="EMERGENT_LLM_KEY not configured")

    brand = (body.brand or "Celesta Glow").strip() or "Celesta Glow"

    # ---------- 1. CLASSIFY (niche / category / subcategory / concerns) ----------
    from services.ai_categorizer import classify_one
    classification = {}
    try:
        classification = await classify_one(_db, {
            "name": name, "brand": brand, "niche": "", "category": "",
            "subcategory": "", "concerns": [], "main_category_hint": "",
            "product_type_hint": "", "concern_hint": "", "skin_type_hint": "",
        }) or {}
    except Exception as e:
        logger.warning(f"[one-click] classify failed, using defaults: {e}")

    niche = classification.get("niche") or "skincare"
    category_slug = classification.get("category_slug") or ""
    subcategory_slug = classification.get("subcategory_slug") or ""
    concern_list = [c for c in (
        [x.get("slug") for x in (classification.get("concerns") or []) if x.get("slug")]
    ) if c]

    # Auto-create any missing taxonomy rows (categories / subcategories / concerns)
    now_iso = datetime.now(timezone.utc).isoformat()
    if category_slug and classification.get("category_is_new"):
        if not await _db.categories.find_one({"slug": category_slug}, {"_id": 1}):
            await _db.categories.insert_one({
                "slug": category_slug, "name": classification.get("category_name") or category_slug,
                "niche": niche, "group": niche, "is_parent": False, "tagline": "", "image": "",
                "icon": classification.get("category_icon") or "🛍️", "sort_order": 99,
                "is_active": True, "ai_created": True, "created_at": now_iso,
            })
    if subcategory_slug and classification.get("subcategory_is_new"):
        if not await _db.subcategories.find_one({"slug": subcategory_slug}, {"_id": 1}):
            await _db.subcategories.insert_one({
                "slug": subcategory_slug, "name": classification.get("subcategory_name") or subcategory_slug,
                "parent_category": category_slug, "niche": niche, "tagline": "",
                "icon": classification.get("subcategory_icon") or "", "image": "", "sort_order": 0,
                "is_active": True, "ai_created": True, "created_at": now_iso, "updated_at": now_iso,
            })
    for c in (classification.get("concerns") or []):
        if c.get("is_new") and c.get("slug"):
            if not await _db.concerns.find_one({"slug": c["slug"]}, {"_id": 1}):
                await _db.concerns.insert_one({
                    "slug": c["slug"], "name": c.get("name") or c["slug"], "tagline": "", "icon": "✨",
                    "image": "", "accent_from": "#dcfce7", "accent_to": "#bbf7d0", "accent_text": "#14532d",
                    "description": "", "sort_order": 99, "is_active": True, "niche": niche,
                    "ai_created": True, "created_at": now_iso,
                })

    # ---------- 2. CONTENT (marketing copy) ----------
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    concerns_str = ", ".join(concern_list) or "general skincare"
    # Optional admin-provided specifications — fold them into the brief so the
    # generated copy, size and price respect what was asked before generation.
    _spec_lines = []
    if body.price_min or body.price_max:
        lo = body.price_min or 0
        hi = body.price_max or (body.price_min or 0)
        _spec_lines.append(f"Target MRP range (INR): {lo}–{hi}. Set \"mrp\" within this range.")
    if body.target_audience:
        _spec_lines.append(f"Target audience: {body.target_audience}")
    if body.skin_type:
        _spec_lines.append(f"Suitable skin type: {body.skin_type}")
    if body.texture:
        _spec_lines.append(f"Texture/format: {body.texture}")
    if body.fragrance:
        _spec_lines.append(f"Fragrance: {body.fragrance}")
    if body.size_hint:
        _spec_lines.append(f"Pack size: {body.size_hint}")
    if body.extra_specs:
        _spec_lines.append(f"Extra requirements: {body.extra_specs}")
    specs_block = ("\nAdditional specifications to honour:\n- " + "\n- ".join(_spec_lines)) if _spec_lines else ""
    prompt = f"""You are a senior copywriter for "{brand}", an Indian skincare brand. Generate product page content.
Product: {name}
Niche: {niche}
Category: {category_slug or 'general'}
Targets concerns: {concerns_str}
Known ingredients: {body.key_ingredients or 'auto-pick suitable actives'}{specs_block}

Return ONLY a JSON object with EXACTLY these keys:
{{
  "tagline": "<benefit-led tagline, max 12 words>",
  "description": "<2-3 sentence hero paragraph>",
  "key_ingredients": "<comma-separated 3-5 hero actives>",
  "ingredients_full": "<full INCI-style ingredients list, comma-separated>",
  "benefits": ["<benefit 1>", "<benefit 2>", "<benefit 3>", "<benefit 4>"],
  "how_to_use": "<3-4 short steps separated by newlines>",
  "size": "<pack size, e.g. '30ml / 1.01 fl oz'>",
  "mrp": <integer INR MRP, no symbol>,
  "offer_price": <integer INR sale price ~30-40% lower>,
  "faqs": [{{"q":"<q1>","a":"<a1>"}},{{"q":"<q2>","a":"<a2>"}},{{"q":"<q3>","a":"<a3>"}},{{"q":"<q4>","a":"<a4>"}},{{"q":"<q5>","a":"<a5>"}}]
}}
Generate 5-6 helpful FAQs covering: which skin type it suits, how long until visible results, the key ingredients, how to use it, and safety/side-effects.
Tone: trustworthy, clinical-but-warm, India-aware. Avoid "miracle"/"instant cure"."""
    content = {}
    try:
        chat = LlmChat(
            api_key=api_key, session_id=f"oneclick-{uuid.uuid4().hex[:8]}",
            system_message="You are a precise JSON-only copywriting API for a skincare brand.",
        ).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt))
        raw = re.sub(r"^```(?:json)?\s*", "", (resp or "").strip())
        raw = re.sub(r"\s*```$", "", raw)
        m = re.search(r"\{[\s\S]*\}", raw)
        content = json.loads(m.group(0) if m else raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI content generation failed: {str(e)[:160]}")

    def _to_int(v):
        try:
            return int(float(str(v).replace(",", "").strip()))
        except Exception:
            return 0

    mrp = _to_int(content.get("mrp")) or _random.choice([899, 999, 1199, 1299, 1499])
    # Honour an admin-requested MRP range (clamp within bounds).
    if body.price_min or body.price_max:
        lo = body.price_min or body.price_max
        hi = body.price_max or body.price_min
        if lo and hi and lo > hi:
            lo, hi = hi, lo
        if lo and mrp < lo:
            mrp = lo
        if hi and mrp > hi:
            mrp = hi
    offer = _to_int(content.get("offer_price")) or int(mrp * 0.65)
    if offer >= mrp:
        offer = int(mrp * 0.65)

    # ---------- 3. IMAGE ----------
    def _cld_hq(u):
        """Inject Cloudinary delivery transform for best quality + auto format
        (issue: blurry/low-quality product images). No-op for non-Cloudinary URLs."""
        if u and "res.cloudinary.com" in u and "/upload/" in u and "q_auto" not in u:
            return u.replace("/upload/", "/upload/q_auto:best,f_auto/", 1)
        return u

    image_url = body.image_url
    ai_images = []
    if not image_url and body.generate_image:
        # Clean actives only (comma-separated) for the label — no prose sentence.
        _img_ings = content.get("key_ingredients", "") or (body.key_ingredients or "")
        _img_size = content.get("size", "") or (body.size_hint or "")
        _refs = [body.reference_image_url] if body.reference_image_url else None
        try:
            image_url = await _ai_generate_product_image(
                name, brand, category_slug or subcategory_slug,
                ref_images=_refs, extra_prompt=_img_ings, size=_img_size,
                variant="front", tag="hero")
        except Exception as e:
            logger.warning(f"[one-click] hero image generation failed (non-fatal): {e}")
            image_url = None
        # Sub images — same reference bottle, neat pure-white background, slightly
        # different framing so the product gallery is a clean matching set.
        for _variant in ("angle", "detail"):
            try:
                _sub = await _ai_generate_product_image(
                    name, brand, category_slug or subcategory_slug,
                    ref_images=_refs, extra_prompt=_img_ings, size=_img_size,
                    variant=_variant, tag=f"sub-{_variant}")
                if _sub:
                    ai_images.append(_sub)
            except Exception as e:
                logger.warning(f"[one-click] sub-image '{_variant}' failed (non-fatal): {e}")
    image_url = _cld_hq(image_url)
    ai_images = [_cld_hq(u) for u in ai_images]
    # Final ordered image set: AI hero first, then the AI sub images.
    final_images = [u for u in [image_url] + ai_images if u]

    # ---------- 4. CREATE PRODUCT ----------
    base_slug = _slugify(name)
    slug = base_slug
    n = 1
    while await _db.products.find_one({"slug": slug}, {"_id": 1}):
        n += 1
        slug = f"{base_slug}-{n}"

    discount_percent = round((1 - offer / mrp) * 100) if mrp else 0
    product = {
        "slug": slug,
        "name": name,
        "short_name": name[:40],
        "tagline": content.get("tagline", ""),
        "description": content.get("description", ""),
        "category": category_slug or "skincare",
        "subcategory": subcategory_slug or "",
        "concerns": concern_list,
        "niche": niche,
        "key_ingredients": content.get("key_ingredients", "") or (body.key_ingredients or ""),
        "ingredients_full": content.get("ingredients_full", ""),
        "benefits": content.get("benefits", []) if isinstance(content.get("benefits"), list) else [],
        "how_to_use": content.get("how_to_use", ""),
        "size": content.get("size", ""),
        "images": final_images,
        "image_gallery": [{"url": u, "alt": f"{name} — {brand}"} for u in final_images],
        "mrp": float(mrp),
        "prepaid_price": float(offer),
        "cod_price": float(offer),
        "cod_advance": 29.0,
        "discount_percent": float(discount_percent),
        "badge": "",
        "badges": [],
        "offer_price": float(offer),
        "is_active": bool(body.is_active),
        "sort_order": 1,
        "stock_qty": 100,
        "low_stock_threshold": 10,
        "fill_card": False,
        "brand": brand,
        "specs": {},
        "shades": [],
        "faqs": content.get("faqs", []) if isinstance(content.get("faqs"), list) else [],
        "ai_generated": True,
        "reviews_count": _random.randint(1020, 4875),
        "rating": round(_random.uniform(4.5, 4.9), 1),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await _db.products.insert_one(product)

    # ---------- 4b. STRUCTURED MEDIA (certificate + before/after) ----------
    # We do NOT run the Pillow gallery here — the product photos are the
    # Gemini-generated hero + sub images. We still attach a lab certificate and a
    # BEFORE/AFTER pair (Pillow). After that we re-assert the AI image set so the
    # Pillow hero can never override the Gemini images.
    try:
        from services.gallery_composer import generate_and_persist
        media = await generate_and_persist(
            _db,
            {**product, "solves": ", ".join(concern_list) or "your skin concern"},
            do_gallery=False, do_certificate=True, do_before_after=True,
        )
        b_img = media.pop("before_after_before", None)
        a_img = media.pop("before_after_after", None)
        media.pop("images", None)  # never let the Pillow hero override the AI images
        if media:
            await _db.products.update_one({"slug": slug}, {"$set": {**media, "updated_at": now_iso}})
            product.update(media)
        if b_img and a_img:
            ba_id = "ba_" + hashlib.md5(slug.encode()).hexdigest()[:8]
            await _db.before_after_images.update_one(
                {"ba_id": ba_id},
                {"$set": {
                    "ba_id": ba_id, "product_slug": slug,
                    "before_image": b_img, "after_image": a_img,
                    "description": f"{name} — visible improvement",
                    "is_global": False, "sort_order": 0, "created_at": now_iso,
                }},
                upsert=True,
            )
    except Exception as e:
        logger.warning(f"[one-click] structured media generation failed for {slug}: {e}")

    # Re-assert the Gemini image set (hero + subs) as the source of truth.
    if final_images:
        ai_gallery = [{"url": u, "alt": f"{name} — {brand}"} for u in final_images]
        await _db.products.update_one(
            {"slug": slug},
            {"$set": {"images": final_images, "image_gallery": ai_gallery, "updated_at": now_iso}},
        )
        product["images"] = final_images
        product["image_gallery"] = ai_gallery

    # Fire-and-forget AI reviews
    try:
        from services.ai_content_generator import generate_product_reviews
        reviews = await generate_product_reviews(
            name=name, niche=niche,
            key_ingredients=product["key_ingredients"], benefits=product["benefits"],
        )
        if reviews:
            await _db.product_reviews.insert_many([
                {**r, "product_slug": slug, "created_at": now_iso} for r in reviews
            ])
    except Exception as e:
        logger.warning(f"[one-click] AI reviews failed for {slug}: {e}")

    product.pop("_id", None)
    return {
        "success": True,
        "slug": slug,
        "product": product,
        "classification": classification,
        "image_generated": bool(image_url and not body.image_url),
    }



# ============================================================
# AI MARKETING IMAGE GENERATOR (Formula-Technology + Before/After)
# Generates on-brand feature images STRICTLY from product name + ingredients,
# matching the admin-provided reference themes. Gemini Nano Banana (Emergent)
# → direct Gemini → Pollinations fallback.
# ============================================================
def _load_refs(folder: str) -> list:
    import glob as _glob
    out = []
    d = _Path(__file__).parent.parent / "uploads" / folder
    try:
        for f in sorted(d.glob("*")):
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                try:
                    out.append(f.read_bytes())
                except Exception:
                    pass
    except Exception:
        pass
    return out


async def _image_via_providers(prompt: str, ref_images: list) -> tuple:
    """Run the Gemini→direct→Pollinations chain. Returns (bytes|None, mime)."""
    import base64 as _b64
    out_bytes, mime = None, "image/png"
    ek = os.environ.get("EMERGENT_LLM_KEY")
    if ek:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            fc = []
            for rb in (ref_images or []):
                try:
                    fc.append(ImageContent(_b64.b64encode(rb).decode("utf-8")))
                except Exception:
                    pass
            chat = LlmChat(api_key=ek, session_id=f"mkt-{uuid.uuid4().hex[:8]}",
                           system_message="You are a premium skincare-brand visual designer.")
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
            _t, imgs = await chat.send_message_multimodal_response(UserMessage(text=prompt, file_contents=fc or None))
            if imgs:
                out_bytes = _b64.b64decode(imgs[0]["data"]); mime = imgs[0].get("mime_type", "image/png")
        except Exception as e:
            logger.warning(f"[mkt-img] Gemini(Emergent) failed: {e}")
    if not out_bytes:
        gk = os.environ.get("GEMINI_API_KEY")
        if gk:
            try:
                from google import genai
                from google.genai import types as _gt
                cli = genai.Client(api_key=gk)
                parts = [prompt] + [_gt.Part.from_bytes(data=rb, mime_type="image/png") for rb in (ref_images or [])]
                resp = cli.models.generate_content(model="gemini-2.5-flash-image", contents=parts)
                for part in (resp.candidates[0].content.parts if resp.candidates else []):
                    inl = getattr(part, "inline_data", None)
                    if inl and getattr(inl, "data", None):
                        out_bytes = inl.data; mime = inl.mime_type or "image/png"; break
            except Exception as e:
                logger.warning(f"[mkt-img] Gemini(direct) failed: {e}")
    if not out_bytes:
        try:
            import httpx as _httpx
            from urllib.parse import quote as _q
            url = (f"https://image.pollinations.ai/prompt/{_q(prompt)}"
                   f"?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed={uuid.uuid4().int % 10_000_000}")
            async with _httpx.AsyncClient(timeout=90.0, follow_redirects=True) as hc:
                r = await hc.get(url)
                if r.status_code == 200 and r.content and len(r.content) > 1024:
                    out_bytes = r.content; mime = r.headers.get("content-type", "image/jpeg").split(";")[0]
        except Exception as e:
            logger.warning(f"[mkt-img] Pollinations failed: {e}")
    return out_bytes, mime


async def _persist_img(out_bytes: bytes, mime: str) -> Optional[str]:
    """Store marketing imagery on Cloudinary. Local disk is NOT an acceptable
    destination — it is wiped on redeploy, which is how images went missing."""
    try:
        from services import cloudinary_service as _cs
        if await _cs.ensure_configured(_db):
            res = await _cs.upload_image(_db, out_bytes, folder="celesta-glow/products",
                                         public_id=f"mkt-{uuid.uuid4().hex[:12]}")
            if res.get("url"):
                return res["url"]
    except Exception as e:
        logger.error(f"[mkt-img] Cloudinary upload failed: {e}")

    if (os.environ.get("ALLOW_LOCAL_UPLOADS") or "").lower() in ("1", "true", "yes"):
        ext = "png" if "png" in mime else "jpg"
        fn = f"mkt-{uuid.uuid4().hex[:12]}.{ext}"
        with open(_PROD_IMG_DIR / fn, "wb") as f:
            f.write(out_bytes)
        logger.warning("[mkt-img] stored on EPHEMERAL local disk (ALLOW_LOCAL_UPLOADS)")
        return f"/api/uploads/products/{fn}"
    return None


class MarketingImageRequest(BaseModel):
    name: str
    kind: str  # 'technology' | 'before_after'
    key_ingredients: Optional[str] = ""
    hero_ingredient: Optional[str] = ""   # single ingredient to spotlight (technology)
    headline: Optional[str] = ""          # optional custom green headline
    category: Optional[str] = ""
    brand: Optional[str] = "Celesta Glow"
    slug: Optional[str] = None            # if set, append image to that product
    append_index: Optional[int] = None    # ignored; always appends


def _tech_prompt(name, brand, category, ings, hero, headline) -> str:
    hero = (hero or (ings.split(",")[0].strip() if ings else "")).strip()
    hl = (headline or "FORMULA TECHNOLOGY").strip().upper()
    return (
        "Professional product photography on a PURE WHITE background (#FFFFFF). The background must be completely "
        "white with no shadows, no gradients, no textures, no grey tones, no off-white. Solid pure white background "
        "only. Studio lighting. Clean white seamless backdrop. "
        f"Premium skincare 'Formula Technology' marketing graphic for {brand} '{name}' ({category or 'skincare'}). "
        "LAYOUT (match references exactly): clean PURE-WHITE (#FFFFFF) background with no grey tones or shadows, square 1:1. On the RIGHT, one pristine WHITE "
        "product bottle/tube with the CELESTA GLOW green+grey minimalist label. On the LEFT, a small grey eyebrow "
        f"label 'FORMULA TECHNOLOGY', then a BOLD dark-GREEN uppercase headline reading '{hl}', then one short "
        "supporting sentence in grey. Include a translucent light-GREEN serum-droplet / molecule bubble cluster with "
        f"a thin leader line labelling the hero active '{hero.upper()}' in green. "
        "Elegant, editorial, lots of white space, soft studio lighting, photorealistic product, crisp clean typography. "
        "No people, no watermark."
    )


def _ba_prompt(name, brand, category) -> str:
    return (
        "Professional dermatology SKIN CLOSEUP photography on a clean white background. "
        "IMPORTANT: crop TIGHT on the affected skin area only (cheek / under-eye / forehead) — this is a "
        "macro skin closeup, NOT a full face and NOT a full portrait. Do not show eyes, nose or a whole face. "
        f"Skincare 'Before & After' results graphic for {brand} '{name}'. Two side-by-side close-up panels of the "
        "SAME cropped area of skin on an anonymous model — LEFT panel labelled 'BEFORE' shows "
        "duller, uneven, textured skin; RIGHT panel labelled 'AFTER' shows brighter, smoother, more even, radiant "
        "skin. Small green 'BEFORE'/'AFTER' captions, clean white divider, soft natural lighting, realistic, tasteful, "
        "tight macro skin crop only (no full face identity), no watermark, square 1:1."
    )


@router.post("/admin/ai/generate-marketing-image")
async def generate_marketing_image(
    body: MarketingImageRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Generate an on-brand marketing image (Formula-Technology or Before/After)
    driven by the product name + ingredients, matching the admin reference themes.
    Optionally appends the result to a product's image gallery when `slug` is set.
    """
    _auth(x_admin_token, admin_session)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Product name is required")
    kind = (body.kind or "").strip().lower()
    if kind not in ("technology", "before_after"):
        raise HTTPException(status_code=400, detail="kind must be 'technology' or 'before_after'")

    if kind == "technology":
        prompt = _tech_prompt(body.name, body.brand or "Celesta Glow", body.category,
                              body.key_ingredients or "", body.hero_ingredient or "", body.headline or "")
        refs = _load_refs("tech_refs") or _load_refs("theme_refs")
    else:
        prompt = _ba_prompt(body.name, body.brand or "Celesta Glow", body.category)
        refs = _load_refs("ba_refs")

    out_bytes, mime = await _image_via_providers(prompt, refs)
    if not out_bytes:
        raise HTTPException(status_code=502, detail="Image generation failed on all providers. Try again.")
    url = await _persist_img(out_bytes, mime)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to persist image")

    appended = False
    if body.slug:
        prod = await _db.products.find_one({"slug": body.slug}, {"_id": 0, "images": 1})
        if prod is not None:
            imgs = list(prod.get("images") or [])
            imgs.append(url)
            await _db.products.update_one({"slug": body.slug},
                                          {"$set": {"images": imgs, "updated_at": datetime.now(timezone.utc).isoformat()}})
            appended = True

    return {"success": True, "image_url": url, "kind": kind, "appended_to_product": appended}
