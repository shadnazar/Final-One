"""Public + admin endpoints for the "Shop by Brand" rails.

Public:
  GET  /api/brands/public?niche=<>           — top brands for a niche (logo + count)
  GET  /api/brands/public/{brand}            — full brand detail (used by /brands/<slug>)

Admin:
  POST /api/admin/brands/{brand}/logo        — upload / set brand logo
  POST /api/admin/brands/{brand}/banner      — upload / set brand banner
  GET  /api/admin/brands/assets              — list all brand assets

Brand assets live in their own collection `brand_assets` keyed by lowercase
brand slug so the same brand under skincare + cosmetics shares one logo.
"""
from __future__ import annotations
import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorClient

from services.image_optimizer import optimize_cloudinary_url
from services.cloudinary_service import upload_image, ensure_configured

router = APIRouter(tags=["brands-public"])

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def _brand_slug(b: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (b or "").lower()).strip("-")


def _verify_admin(x_admin_token: Optional[str]):
    """Local minimal verify — accepts active session or password sha256."""
    import hashlib
    from server import admin_sessions
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin auth required")
    if x_admin_token in admin_sessions:
        return True
    # password fallback
    from services.admin_auth import get_cached_active_admin_hash
    if hashlib.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=401, detail="Admin auth required")


@router.get("/brands/public")
async def public_brands(niche: Optional[str] = None, limit: int = 18):
    """Return up to `limit` brands for a niche, sorted by product count.
    Each row carries the admin-curated logo if one exists, else a fallback
    product image so the banner is never empty."""
    match = {"is_active": True, "brand": {"$nin": [None, "", "nan", "NaN"]}}
    if niche:
        match["niche"] = niche
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$brand",
            "count": {"$sum": 1},
            "preview_image": {"$first": {"$arrayElemAt": ["$images", 0]}},
        }},
        {"$sort": {"count": -1}},
        {"$limit": int(limit)},
    ]
    rows = await db.products.aggregate(pipeline).to_list(length=None)
    # Pull all admin-uploaded brand assets in one query
    slugs = [_brand_slug(r["_id"]) for r in rows]
    assets_map = {}
    if slugs:
        async for a in db.brand_assets.find({"slug": {"$in": slugs}}, {"_id": 0}):
            assets_map[a["slug"]] = a
    out = []
    for r in rows:
        bslug = _brand_slug(r["_id"])
        asset = assets_map.get(bslug) or {}
        logo = asset.get("logo") or r.get("preview_image")
        version = asset.get("updated_at")
        out.append({
            "brand": r["_id"],
            "slug": bslug,
            "count": r["count"],
            "logo": optimize_cloudinary_url(logo, 400, version) if logo else None,
            "banner": optimize_cloudinary_url(asset.get("banner"), 1200, version) if asset.get("banner") else None,
        })
    return {"brands": out, "niche": niche, "total": len(out)}


@router.get("/brands/public/{slug}")
async def public_brand_detail(slug: str):
    """Brand detail — used by /brands/<slug> landing page."""
    asset = await db.brand_assets.find_one({"slug": slug}, {"_id": 0}) or {}
    brand_name = asset.get("brand")
    # If no asset row, infer brand_name from products
    if not brand_name:
        async for p in db.products.aggregate([
            {"$match": {"is_active": True, "brand": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$brand"}},
        ]):
            if _brand_slug(p["_id"]) == slug:
                brand_name = p["_id"]
                break
    if not brand_name:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {
        "brand": brand_name,
        "slug": slug,
        "logo": optimize_cloudinary_url(asset.get("logo"), 400, asset.get("updated_at")) if asset.get("logo") else None,
        "banner": optimize_cloudinary_url(asset.get("banner"), 1600, asset.get("updated_at")) if asset.get("banner") else None,
        "description": asset.get("description") or "",
    }


# ----------- ADMIN -----------

@router.post("/admin/brands/{slug}/logo")
async def upload_brand_logo(
    slug: str,
    brand: str = Form(...),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    if not await ensure_configured(db):
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    content = await file.read()
    res = await upload_image(db, content, folder="celesta-glow/brand-logos", public_id=f"{slug}-logo")
    url = res.get("url")
    await db.brand_assets.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug, "brand": brand, "logo": url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    # Trigger an incremental snapshot so the upload is backed up within seconds
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "logo": url}


@router.post("/admin/brands/{slug}/banner")
async def upload_brand_banner(
    slug: str,
    brand: str = Form(...),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    if not await ensure_configured(db):
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    content = await file.read()
    res = await upload_image(db, content, folder="celesta-glow/brand-banners", public_id=f"{slug}-banner")
    url = res.get("url")
    await db.brand_assets.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug, "brand": brand, "banner": url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "banner": url}


@router.get("/admin/brands/assets")
async def list_brand_assets(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    rows = await db.brand_assets.find({}, {"_id": 0}).sort("brand", 1).to_list(length=None)
    return {"assets": rows, "total": len(rows)}



# ----------- ADMIN — metadata + bulk listing -----------

@router.get("/admin/brands/list")
async def admin_brand_directory(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    """Combined directory: every brand that either has products OR a
    brand_asset row. This powers the Admin → Shop by Brand page.

    Each row carries: slug, name, product_count, logo, banner, description,
    niches (where the brand has SKUs), and whether a brand_asset row exists.
    """
    _verify_admin(x_admin_token)
    # 1) Aggregate products by brand → counts + niches
    product_pipeline = [
        {"$match": {"is_active": True, "brand": {"$nin": [None, "", "nan", "NaN"]}}},
        {"$group": {
            "_id": "$brand",
            "count": {"$sum": 1},
            "niches": {"$addToSet": "$niche"},
            "preview_image": {"$first": {"$arrayElemAt": ["$images", 0]}},
        }},
        {"$sort": {"count": -1}},
    ]
    product_brands = await db.products.aggregate(product_pipeline).to_list(length=None)
    # 2) Pull every brand_asset row (so brands without products still appear)
    assets = {a["slug"]: a async for a in db.brand_assets.find({}, {"_id": 0})}
    # 3) Merge
    seen = set()
    out = []
    for r in product_brands:
        brand_name = r["_id"]
        s = _brand_slug(brand_name)
        seen.add(s)
        a = assets.get(s, {})
        out.append({
            "slug": s,
            "brand": brand_name,
            "count": r["count"],
            "niches": [n for n in (r.get("niches") or []) if n],
            "logo": a.get("logo") or r.get("preview_image"),
            "banner": a.get("banner"),
            "description": a.get("description") or "",
            "has_asset": bool(a),
            "updated_at": a.get("updated_at"),
        })
    # Brands with only a brand_asset row (no live products yet)
    for s, a in assets.items():
        if s in seen:
            continue
        out.append({
            "slug": s,
            "brand": a.get("brand") or s,
            "count": 0,
            "niches": [],
            "logo": a.get("logo"),
            "banner": a.get("banner"),
            "description": a.get("description") or "",
            "has_asset": True,
            "updated_at": a.get("updated_at"),
        })
    return {"brands": out, "total": len(out)}


@router.patch("/admin/brands/{slug}")
async def update_brand_asset(
    slug: str,
    payload: dict,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Update brand metadata (description, display name). Used by the
    Admin → Shop by Brand page. Does NOT touch the `brand` field on products."""
    _verify_admin(x_admin_token)
    allowed = {"brand", "description", "sort_order"}
    set_doc = {k: v for k, v in (payload or {}).items() if k in allowed}
    if not set_doc:
        raise HTTPException(status_code=400, detail="No editable fields provided")
    set_doc["slug"] = slug
    set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.brand_assets.update_one({"slug": slug}, {"$set": set_doc}, upsert=True)
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    row = await db.brand_assets.find_one({"slug": slug}, {"_id": 0})
    return {"success": True, "brand": row}


@router.post("/admin/brands")
async def create_brand_asset(
    payload: dict,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Create a brand_asset row for a NEW brand (no products yet). Admin can
    then upload a logo/banner before any product is tagged with it. Existing
    products can be tagged via the Admin Products page using the brand name."""
    _verify_admin(x_admin_token)
    name = (payload.get("brand") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="`brand` (name) is required")
    s = _brand_slug(name)
    if not s:
        raise HTTPException(status_code=400, detail="Brand name produced an empty slug")
    existing = await db.brand_assets.find_one({"slug": s}, {"_id": 0})
    if existing:
        # Idempotent — return the existing row so the admin UI just opens it.
        return {"success": True, "created": False, "brand": existing}
    doc = {
        "slug": s,
        "brand": name,
        "description": (payload.get("description") or "").strip(),
        "logo": None,
        "banner": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.brand_assets.insert_one(dict(doc))
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "created": True, "brand": doc}


@router.delete("/admin/brands/{slug}")
async def delete_brand_asset(
    slug: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Remove a brand_asset row. Products keep their `brand` field — they just
    fall back to using the product's first image as the rail tile."""
    _verify_admin(x_admin_token)
    res = await db.brand_assets.delete_one({"slug": slug})
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "deleted": res.deleted_count}
