"""Feb-2026 features batch:
  - `shop_by_category_tiles`: admin-managed circular tiles shown on the
    skincare home under 'Shop by Category'. Independent images from
    /admin/categories editor.
  - `leads`: 3 lead-form types on the public site — 'partner', 'invest',
    'skin_concern'. Admin views all leads via /api/admin/leads.
  - `sale_campaigns`: admin creates named sale offers with slug, % off,
    trust copy, hero image, etc. Public site renders the landing at
    /sale/{slug}. Orders placed via a sale campaign are tagged with
    campaign_slug so admin sees per-campaign revenue.
"""
from __future__ import annotations
import io
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field

from services import cloudinary_service as _cs

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


def _now():
    return datetime.now(timezone.utc).isoformat()


def _admin(x_admin_token):
    if not _verify_admin:
        raise HTTPException(500, "Admin auth not wired")
    _verify_admin(x_admin_token)


# --- Shop-by-Category tiles -------------------------------------------------
class TilePayload(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    image: Optional[str] = None
    icon: Optional[str] = None
    niche: str = "skincare"
    route_slug: Optional[str] = None  # target category slug (defaults to slug)
    sort_order: int = 0
    is_active: bool = True


@router.get("/shop-by-category")
async def list_shop_by_category(niche: str = "skincare"):
    cur = _db.shop_by_category_tiles.find({"niche": niche, "is_active": True}, {"_id": 0}).sort("sort_order", 1)
    items = []
    async for r in cur:
        # Route each tile via /category/{route_slug or slug}
        if not r.get("route_slug"):
            r["route_slug"] = r.get("slug")
        items.append(r)
    return items


@router.get("/admin/shop-by-category")
async def admin_list_tiles(x_admin_token: str = Header(None, alias="X-Admin-Token"), niche: Optional[str] = None):
    _admin(x_admin_token)
    q = {}
    if niche:
        q["niche"] = niche
    cur = _db.shop_by_category_tiles.find(q, {"_id": 0}).sort([("niche", 1), ("sort_order", 1)])
    return await cur.to_list(length=None)


@router.post("/admin/shop-by-category")
async def admin_create_tile(payload: TilePayload, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    existing = await _db.shop_by_category_tiles.find_one({"slug": payload.slug, "niche": payload.niche})
    if existing:
        raise HTTPException(400, "Tile with this slug + niche already exists")
    doc = payload.dict()
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await _db.shop_by_category_tiles.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/admin/shop-by-category/{slug}")
async def admin_update_tile(slug: str, payload: TilePayload, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    upd = payload.dict()
    upd["updated_at"] = _now()
    res = await _db.shop_by_category_tiles.update_one({"slug": slug}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Tile not found")
    return await _db.shop_by_category_tiles.find_one({"slug": slug}, {"_id": 0})


@router.delete("/admin/shop-by-category/{slug}")
async def admin_delete_tile(slug: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    res = await _db.shop_by_category_tiles.delete_one({"slug": slug})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tile not found")
    return {"success": True}


@router.post("/admin/shop-by-category/{slug}/image")
async def admin_upload_tile_image(
    slug: str,
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _admin(x_admin_token)
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "Max 8 MB")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only images allowed")
    if not await _cs.ensure_configured(_db):
        raise HTTPException(503, "Cloudinary not configured")
    try:
        res = cloudinary.uploader.upload(
            io.BytesIO(raw),
            folder="celesta-glow/shop-by-category",
            public_id=f"{slug}-{uuid.uuid4().hex[:8]}",
            resource_type="image",
            overwrite=True,
        )
    except Exception as exc:
        logger.error(f"[shop_by_category] upload failed: {exc}")
        raise HTTPException(502, "Upload failed")
    url = res.get("secure_url") or res.get("url")
    await _db.shop_by_category_tiles.update_one(
        {"slug": slug},
        {"$set": {"image": url, "updated_at": _now()}},
    )
    return {"image": url}


# --- Leads (Partner / Invest / Skin Concern) --------------------------------
class LeadPayload(BaseModel):
    type: str  # 'partner' | 'invest' | 'skin_concern'
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: Optional[EmailStr] = None
    message: Optional[str] = Field(None, max_length=1500)
    # Type-specific optional fields
    business_name: Optional[str] = None
    investment_amount: Optional[str] = None
    concern: Optional[str] = None
    city: Optional[str] = None


@router.post("/leads")
async def public_create_lead(payload: LeadPayload):
    if payload.type not in {"partner", "invest", "skin_concern"}:
        raise HTTPException(400, "Invalid lead type")
    phone = "".join(c for c in payload.phone if c.isdigit())
    if len(phone) < 10:
        raise HTTPException(400, "Invalid phone number")
    doc = payload.dict()
    doc["phone"] = phone
    doc["id"] = f"lead_{uuid.uuid4().hex[:12]}"
    doc["status"] = "new"
    doc["created_at"] = _now()
    await _db.leads.insert_one(dict(doc))
    return {"success": True, "id": doc["id"], "message": "Thanks — we'll be in touch shortly."}


@router.get("/admin/leads")
async def admin_list_leads(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    type: Optional[str] = None,
    limit: int = 200,
    skip: int = 0,
):
    _admin(x_admin_token)
    q = {}
    if type:
        q["type"] = type
    cur = _db.leads.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    rows = await cur.to_list(length=None)
    total = await _db.leads.count_documents(q)
    counts = {}
    for t in ("partner", "invest", "skin_concern"):
        counts[t] = await _db.leads.count_documents({"type": t})
    return {"leads": rows, "total": total, "counts": counts}


@router.patch("/admin/leads/{lead_id}")
async def admin_update_lead(
    lead_id: str,
    payload: Dict[str, Any],
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _admin(x_admin_token)
    allowed = {"status", "notes"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = _now()
    res = await _db.leads.update_one({"id": lead_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return await _db.leads.find_one({"id": lead_id}, {"_id": 0})


# --- Sale campaigns ---------------------------------------------------------
class SaleCampaignPayload(BaseModel):
    slug: str = Field(min_length=2, max_length=60)
    title: str
    subtitle: Optional[str] = ""
    hero_image: Optional[str] = ""
    discount_percent: int = Field(50, ge=1, le=95)
    trust_line: Optional[str] = "3,00,000+ happy customers · 4.9★ rating"
    urgency_end_at: Optional[str] = None  # ISO
    zero_shipping: bool = True
    zero_tax: bool = True
    featured_slugs: List[str] = []  # products to spotlight on landing
    kit_bundle: Optional[Dict[str, Any]] = None  # {name, mrp, sale_price, items:[...]}
    cta_label: str = "Shop Now & Save"
    is_active: bool = True


@router.get("/sale/{slug}")
async def public_get_campaign(slug: str):
    row = await _db.sale_campaigns.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Sale campaign not found or inactive")
    # Hydrate featured products
    featured = []
    if row.get("featured_slugs"):
        cur = _db.products.find(
            {"slug": {"$in": row["featured_slugs"]}, "is_active": True},
            {"_id": 0, "slug": 1, "name": 1, "short_name": 1, "brand": 1, "images": 1,
             "mrp": 1, "prepaid_price": 1, "average_rating": 1, "reviews_count": 1, "size": 1},
        )
        featured = await cur.to_list(length=None)
    row["featured"] = featured
    return row


@router.get("/admin/sale-campaigns")
async def admin_list_campaigns(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    cur = _db.sale_campaigns.find({}, {"_id": 0}).sort("created_at", -1)
    rows = await cur.to_list(length=None)
    # Attach revenue + order counts
    for r in rows:
        r["orders_count"] = await _db.orders.count_documents({"campaign_slug": r["slug"]})
        pipeline = [
            {"$match": {"campaign_slug": r["slug"]}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
        ]
        agg = await _db.orders.aggregate(pipeline).to_list(1)
        r["revenue"] = float(agg[0]["total"]) if agg else 0.0
    return rows


@router.post("/admin/sale-campaigns")
async def admin_create_campaign(payload: SaleCampaignPayload, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    if await _db.sale_campaigns.find_one({"slug": payload.slug}):
        raise HTTPException(400, "Slug already exists")
    doc = payload.dict()
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await _db.sale_campaigns.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/admin/sale-campaigns/{slug}")
async def admin_update_campaign(slug: str, payload: SaleCampaignPayload, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    upd = payload.dict()
    upd["updated_at"] = _now()
    res = await _db.sale_campaigns.update_one({"slug": slug}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Campaign not found")
    return await _db.sale_campaigns.find_one({"slug": slug}, {"_id": 0})


@router.delete("/admin/sale-campaigns/{slug}")
async def admin_delete_campaign(slug: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _admin(x_admin_token)
    res = await _db.sale_campaigns.delete_one({"slug": slug})
    if res.deleted_count == 0:
        raise HTTPException(404, "Campaign not found")
    return {"success": True}


@router.post("/admin/sale-campaigns/{slug}/hero")
async def admin_upload_hero(
    slug: str,
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _admin(x_admin_token)
    raw = await file.read()
    if not raw or len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "Empty or over-10MB file")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only images allowed")
    if not await _cs.ensure_configured(_db):
        raise HTTPException(503, "Cloudinary not configured")
    res = cloudinary.uploader.upload(
        io.BytesIO(raw),
        folder=f"celesta-glow/sale-campaigns/{slug}",
        public_id=f"hero-{uuid.uuid4().hex[:8]}",
        overwrite=True,
    )
    url = res.get("secure_url")
    await _db.sale_campaigns.update_one({"slug": slug}, {"$set": {"hero_image": url, "updated_at": _now()}})
    return {"hero_image": url}
