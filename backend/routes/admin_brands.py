"""Admin: brand grouping, brand-wise pricing, user-journey enhancements.

Feb 2026 P2/P3 batch:
  * GET  /admin/brands/by-niche           — brands grouped under each niche
  * GET  /admin/brands/{brand}/products   — products of a brand (lean)
  * POST /admin/brands/{brand}/price-bulk — apply markup/discount across a brand
  * GET  /tracking/{order_id}             — PUBLIC order-tracking page data
  * GET  /admin/live-visitors             — adds `currently_viewing` per visitor
"""
from __future__ import annotations
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

from services.admin_auth import is_admin_password
from fastapi import Header

async def verify_admin(x_admin_token: str = Header(None)):
    if not x_admin_token:
        raise HTTPException(status_code=403, detail="Admin token required")
    ok = await is_admin_password(x_admin_token, db)
    if not ok:
        raise HTTPException(status_code=403, detail="Invalid admin token")
    return True

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

router = APIRouter(tags=["admin-brands"])


# ============================================================
# BRANDS BY NICHE — for the master-list grouping page
# ============================================================

@router.get("/admin/brands/by-niche")
async def brands_by_niche(admin: bool = Depends(verify_admin)):
    """Group all brands under each niche with product counts. Used by the
    admin Master List page to show:
        Skincare → [Plum (124), Minimalist (89), …]
        Cosmetics → [Lakme (456), Maybelline (321), …]
    """
    pipeline = [
        {"$match": {"is_active": True, "brand": {"$nin": [None, "", "nan", "NaN"]}}},
        {"$group": {
            "_id": {
                "niche": {"$ifNull": ["$niche", "__null__"]},
                "brand": "$brand",
            },
            "count": {"$sum": 1},
            "categories": {"$addToSet": "$category"},
            "image": {"$first": {"$arrayElemAt": ["$images", 0]}},
        }},
        {"$group": {
            "_id": "$_id.niche",
            "brands": {"$push": {
                "brand": "$_id.brand",
                "count": "$count",
                "categories": "$categories",
                "preview_image": "$image",
            }},
            "total": {"$sum": "$count"},
        }},
        {"$sort": {"total": -1}},
    ]
    rows = await db.products.aggregate(pipeline).to_list(50)
    out = []
    for r in rows:
        brands = sorted(r["brands"], key=lambda b: -b["count"])
        out.append({
            "niche": r["_id"],
            "total_products": r["total"],
            "brand_count": len(brands),
            "brands": brands,
        })
    return {"niches": out}


@router.get("/admin/brands/{brand}/products")
async def brand_products(
    brand: str,
    admin: bool = Depends(verify_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Lean product list for a single brand — used by the brand-detail panel
    in Master List page. Returns only fields needed by the inline price editor."""
    skip = (page - 1) * limit
    base = {"brand": brand, "is_active": True}
    total = await db.products.count_documents(base)
    projection = {
        "_id": 0, "slug": 1, "name": 1, "brand": 1, "niche": 1,
        "category": 1, "subcategory": 1, "images": {"$slice": 1},
        "mrp": 1, "prepaid_price": 1, "cod_price": 1,
        "discount_percent": 1, "stock_qty": 1, "shades": 1,
    }
    cursor = db.products.find(base, projection).sort([("name", 1)]).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    return {"brand": brand, "total": total, "page": page, "limit": limit, "items": items}


# ============================================================
# BRAND-WISE BULK PRICE UPDATE
# ============================================================

@router.post("/admin/brands/{brand}/price-bulk")
async def brand_bulk_price_update(
    brand: str,
    admin: bool = Depends(verify_admin),
    markup_percent: Optional[float] = Query(None, description="+10 = raise by 10%"),
    discount_percent: Optional[float] = Query(None, description="20 = discount 20% off MRP"),
    set_mrp_multiplier: Optional[float] = Query(None, description="e.g. 1.25 to set MRP = current MRP × 1.25"),
    fixed_listing_price: Optional[float] = Query(None, description="Set every product's listing price to this exact value"),
    dry_run: bool = Query(False),
):
    """Apply a bulk price transformation to every product of a brand.

    Mutually-exclusive modes (use one):
      * markup_percent      — adjust listing price up/down by % of current listing
      * discount_percent    — set listing_price = mrp * (1 - discount%/100)
      * set_mrp_multiplier  — set mrp = current_mrp * multiplier
      * fixed_listing_price — set every product's listing_price to this value

    `dry_run=true` returns a preview without writing.
    """
    modes = [
        markup_percent is not None,
        discount_percent is not None,
        set_mrp_multiplier is not None,
        fixed_listing_price is not None,
    ]
    if sum(modes) != 1:
        raise HTTPException(400, "Provide exactly one of: markup_percent, discount_percent, set_mrp_multiplier, fixed_listing_price")

    cursor = db.products.find(
        {"brand": brand, "is_active": True},
        {"_id": 0, "slug": 1, "mrp": 1, "prepaid_price": 1, "cod_price": 1},
    )
    products = await cursor.to_list(10000)
    preview: list[dict] = []
    updated = 0
    for p in products:
        old_mrp = int(round(float(p.get("mrp") or 0)))
        old_listing = int(round(float(p.get("prepaid_price") or 0)))
        new_mrp = old_mrp
        new_listing = old_listing
        if markup_percent is not None:
            new_listing = int(round(old_listing * (1 + markup_percent / 100)))
        elif discount_percent is not None:
            new_listing = int(round(old_mrp * (1 - discount_percent / 100)))
        elif set_mrp_multiplier is not None:
            new_mrp = int(round(old_mrp * set_mrp_multiplier))
            # Maintain discount ratio
            if old_mrp > 0:
                ratio = old_listing / old_mrp
                new_listing = int(round(new_mrp * ratio))
            else:
                new_listing = new_mrp
        elif fixed_listing_price is not None:
            new_listing = int(round(fixed_listing_price))

        new_listing = max(0, new_listing)
        new_mrp = max(new_mrp, new_listing)
        new_discount = int(round((new_mrp - new_listing) / new_mrp * 100)) if new_mrp > 0 else 0

        if new_mrp == old_mrp and new_listing == old_listing:
            continue

        preview.append({
            "slug": p["slug"], "old_mrp": old_mrp, "new_mrp": new_mrp,
            "old_listing": old_listing, "new_listing": new_listing,
            "discount_pct": new_discount,
        })
        if not dry_run:
            await db.products.update_one(
                {"slug": p["slug"]},
                {"$set": {
                    "mrp": new_mrp,
                    "prepaid_price": new_listing,
                    "cod_price": new_listing,
                    "discount_percent": new_discount,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            updated += 1

    return {
        "brand": brand,
        "scanned": len(products),
        "would_update" if dry_run else "updated": len(preview) if dry_run else updated,
        "preview_sample": preview[:30],
        "dry_run": dry_run,
    }


# ============================================================
# PUBLIC ORDER TRACKING — customer-facing
# ============================================================

@router.get("/tracking/{order_id}")
async def public_order_tracking(order_id: str):
    """Public endpoint — no auth needed. Customer pastes their order_id and
    sees status + ETA + tracking link. Phone partial-mask + only the fields
    a customer should see (no internal notes / coupon / shipping_fee detail).
    """
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")

    def _mask_phone(p):
        if not p:
            return ""
        digits = re.sub(r"\D", "", p)
        if len(digits) >= 4:
            return "•" * (len(digits) - 4) + digits[-4:]
        return p

    items_view = [
        {
            "name": it.get("short_name") or it.get("name") or "",
            "shade": it.get("shade_name") or "",
            "qty": int(it.get("quantity") or 1),
            "image": (it.get("image") or "").strip(),
        }
        for it in (o.get("items") or [])
    ]

    return {
        "order_id": o.get("order_id"),
        "placed_at": o.get("created_at"),
        "status": o.get("status"),
        "delivery_status": o.get("delivery_status"),
        "estimated_delivery": o.get("estimated_delivery"),
        "delivered_at": o.get("delivered_at"),
        "tracking_url": o.get("tracking_url"),
        "awb_number": o.get("awb_number"),
        "shipping_provider": o.get("shipping_provider"),
        "customer_name": o.get("name", "").split(" ")[0] if o.get("name") else "",
        "customer_phone_mask": _mask_phone(o.get("phone")),
        "address": {
            "city": o.get("city"),
            "state": o.get("state"),
            "pincode": o.get("pincode"),
        },
        "items": items_view,
        "total_paid": o.get("amount"),
        "payment_method": o.get("payment_method"),
    }


# ============================================================
# USER JOURNEY ENHANCEMENT — admin live-visitors with journey
# (the public POST /visitor/ping endpoint already captures recent_pages
#  via routes/visitor_tracking.py — this is just the admin reader.)
# ============================================================

@router.get("/admin/live-visitors")
async def admin_live_visitors(admin: bool = Depends(verify_admin),
                               minutes: int = 5):
    """Live visitors with their currently-viewing page + recent journey."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes))
    cur = db.visitor_pings.find(
        {"last_seen": {"$gte": cutoff}},
        {"_id": 0, "ip_hash": 0, "user_agent": 0},
    ).sort("last_seen", -1).limit(500)
    visitors = await cur.to_list(500)
    return {"count": len(visitors), "minutes": minutes, "visitors": visitors}
