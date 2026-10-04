"""Admin — Image Gallery editor (Feb-2026)
=====================================================
Dedicated tool for managing per-product image galleries WITH alt keywords
so Google can rank them. The main /admin/products screen already lets the
merchant reorder images inline, but that flow gets crowded when the SKU
count is high. This route gives a focused "find product → edit gallery →
save" loop.

Endpoints:
  GET   /api/admin/image-gallery/products?q=…   → search products
  GET   /api/admin/image-gallery/{slug}         → full gallery
  PUT   /api/admin/image-gallery/{slug}         → replace gallery
  DELETE /api/admin/image-gallery/{slug}/{idx}  → remove one image
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

router = APIRouter(prefix="/admin/image-gallery", tags=["admin-image-gallery"])
_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


class GalleryItem(BaseModel):
    url: str
    alt: Optional[str] = ""


class GalleryPayload(BaseModel):
    image_gallery: List[GalleryItem]
    # Optional: rebuild flat `images` mirror so legacy consumers keep working
    sync_images: bool = True


@router.get("/products")
async def search_products(
    q: str = Query("", description="Search term (name/slug/brand)"),
    niche: Optional[str] = Query(None, description="Filter by niche (anti-aging/skincare/cosmetics)"),
    limit: int = Query(30, ge=1, le=100),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    q = (q or "").strip()
    filt: Dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"slug": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    if niche:
        # Match either the legacy top-level `niche` field or `active_niches[]`
        filt["$and"] = filt.get("$and", []) + [{
            "$or": [
                {"niche": {"$regex": f"^{niche}$", "$options": "i"}},
                {"active_niches": {"$regex": f"^{niche}$", "$options": "i"}},
            ]
        }]
    items: List[Dict[str, Any]] = []
    cursor = _db.products.find(
        filt,
        {"_id": 0, "slug": 1, "name": 1, "brand": 1, "images": 1, "image_gallery": 1, "is_active": 1, "niche": 1, "active_niches": 1},
    ).limit(limit)
    async for p in cursor:
        gal = p.get("image_gallery") or []
        items.append({
            "slug": p.get("slug"),
            "name": p.get("name"),
            "brand": p.get("brand"),
            "niche": p.get("niche"),
            "active_niches": p.get("active_niches") or [],
            "primary_image": (p.get("images") or [None])[0],
            "gallery_count": len(gal) if isinstance(gal, list) else 0,
            "flat_count": len(p.get("images") or []),
            "is_active": p.get("is_active", True),
        })
    return {"items": items, "total": len(items)}


@router.get("/{slug}")
async def get_gallery(
    slug: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    p = await _db.products.find_one({"slug": slug}, {"_id": 0, "slug": 1, "name": 1, "images": 1, "image_gallery": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    gallery = p.get("image_gallery")
    if not isinstance(gallery, list) or not gallery:
        # Materialise from `images` so the merchant can immediately add alt text
        gallery = [{"url": u, "alt": ""} for u in (p.get("images") or [])]
    return {"slug": p["slug"], "name": p["name"], "image_gallery": gallery}


@router.put("/{slug}")
async def replace_gallery(
    slug: str,
    payload: GalleryPayload,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    p = await _db.products.find_one({"slug": slug}, {"_id": 0, "slug": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    gallery = [{"url": g.url, "alt": (g.alt or "").strip()} for g in payload.image_gallery if g.url]
    updates: Dict[str, Any] = {
        "image_gallery": gallery,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.sync_images:
        updates["images"] = [g["url"] for g in gallery]
    await _db.products.update_one({"slug": slug}, {"$set": updates})
    return {"success": True, "slug": slug, "count": len(gallery)}


@router.delete("/{slug}/{idx}")
async def delete_image(
    slug: str,
    idx: int,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    p = await _db.products.find_one({"slug": slug}, {"_id": 0, "images": 1, "image_gallery": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    gallery = list(p.get("image_gallery") or [])
    images = list(p.get("images") or [])
    if 0 <= idx < len(gallery):
        gallery.pop(idx)
    if 0 <= idx < len(images):
        images.pop(idx)
    await _db.products.update_one(
        {"slug": slug},
        {"$set": {
            "image_gallery": gallery,
            "images": images,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True, "slug": slug, "count": len(gallery)}
