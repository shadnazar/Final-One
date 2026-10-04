"""
Influencer Reels — creator-generated video posts assigned to products.

Public endpoints:
    GET  /api/reels/list?product_slug=X&limit=10  → active reels for a product
                                                    (falls back to global reels
                                                    when the product has none)
    POST /api/reels/{reel_id}/view                → increments the view counter

Admin endpoints (X-Admin-Token header required):
    GET    /api/admin/reels               → list all reels (any state)
    POST   /api/admin/reels               → create a new reel
    PUT    /api/admin/reels/{reel_id}     → update
    DELETE /api/admin/reels/{reel_id}     → soft-delete via is_active=False
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

router = APIRouter()

# Lazy-loaded Mongo handle — env vars aren't populated at module import time
# (dotenv loads in server.py), so we resolve on first use.
_client = None
_db = None


def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ["DB_NAME"]]
    return _db

ADMIN_TOKEN_ENV = "ADMIN_TOKEN"


def _require_admin(token: Optional[str]) -> None:
    """Session-based admin auth — mirrors server.verify_admin_token so the
    same login session used everywhere else in the admin panel works here too.
    Lazy imports dodge the circular dependency with server.py."""
    if not token:
        raise HTTPException(status_code=401, detail="Admin token required")
    import hashlib as _hashlib
    from datetime import datetime, timezone
    from server import admin_sessions
    from services.admin_auth import get_cached_active_admin_hash

    if token in admin_sessions:
        session = admin_sessions[token]
        expires_at = session["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < expires_at:
            return
        del admin_sessions[token]
        raise HTTPException(status_code=401, detail="Session expired, please login again")

    if _hashlib.sha256(token.encode()).hexdigest() == get_cached_active_admin_hash():
        return

    raise HTTPException(status_code=403, detail="Invalid admin token")


# ---------- Models ----------

class ReelIn(BaseModel):
    video_url: str
    thumbnail_url: Optional[str] = None
    creator_name: str
    creator_handle: Optional[str] = None
    caption: Optional[str] = None
    product_slugs: List[str] = Field(default_factory=list)  # empty = global
    is_active: bool = True
    sort_order: int = 0


class ReelUpdate(BaseModel):
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    creator_name: Optional[str] = None
    creator_handle: Optional[str] = None
    caption: Optional[str] = None
    product_slugs: Optional[List[str]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def _serialize(doc: dict) -> dict:
    """Strip Mongo ObjectId and coerce datetime -> ISO for JSON transport."""
    if not doc:
        return doc
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k in ("created_at", "updated_at"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


# ---------- Public ----------

@router.get("/reels/list")
async def list_public_reels(
    product_slug: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """Return active reels for this product, or global reels if none exist.

    Cap raised so brands with lots of creator content aren't silently truncated
    (12 → 1000). The 1000 ceiling still protects the wire from a runaway query.
    """
    if product_slug:
        product_reels = await _get_db().influencer_reels.find(
            {"is_active": True, "product_slugs": product_slug}
        ).sort([("sort_order", 1), ("created_at", -1)]).limit(limit).to_list(length=limit)
        if product_reels:
            return {"items": [_serialize(d) for d in product_reels], "scope": "product"}
    # Fallback: global reels (product_slugs is empty)
    global_reels = await _get_db().influencer_reels.find(
        {"is_active": True, "product_slugs": {"$size": 0}}
    ).sort([("sort_order", 1), ("created_at", -1)]).limit(limit).to_list(length=limit)
    return {"items": [_serialize(d) for d in global_reels], "scope": "global"}


@router.post("/reels/{reel_id}/view")
async def bump_view(reel_id: str):
    """Best-effort view counter. Never fails the caller."""
    try:
        await _get_db().influencer_reels.update_one({"id": reel_id}, {"$inc": {"views": 1}})
    except Exception:
        pass
    return {"ok": True}


# ---------- Admin ----------

@router.get("/admin/reels/analytics")
async def admin_reels_analytics(x_admin_token: Optional[str] = Header(None)):
    """Aggregate reel performance for the admin dashboard.
    Returns: total_reels, active_reels, total_views, top creators (by views),
    top reels (by views)."""
    _require_admin(x_admin_token)
    db_ = _get_db()
    total = await db_.influencer_reels.count_documents({})
    active = await db_.influencer_reels.count_documents({"is_active": True})
    # Total views across all reels
    pipeline_total = [{"$group": {"_id": None, "views": {"$sum": "$views"}}}]
    tvr = await db_.influencer_reels.aggregate(pipeline_total).to_list(1)
    total_views = (tvr[0]["views"] if tvr else 0) or 0
    # Top 5 creators by cumulative views
    pipeline_creators = [
        {"$group": {"_id": "$creator_name", "views": {"$sum": "$views"}, "reels": {"$sum": 1}}},
        {"$sort": {"views": -1}},
        {"$limit": 5},
    ]
    top_creators = [
        {"creator_name": r["_id"], "views": r["views"] or 0, "reels": r["reels"]}
        for r in await db_.influencer_reels.aggregate(pipeline_creators).to_list(5)
    ]
    # Top 5 reels
    top_docs = await db_.influencer_reels.find({}).sort("views", -1).limit(5).to_list(5)
    top_reels = [{
        "id": d["id"], "creator_name": d.get("creator_name"),
        "creator_handle": d.get("creator_handle"),
        "thumbnail_url": d.get("thumbnail_url"),
        "views": d.get("views", 0) or 0,
        "is_active": d.get("is_active", True),
    } for d in top_docs]
    return {"total_reels": total, "active_reels": active, "total_views": total_views,
            "top_creators": top_creators, "top_reels": top_reels}


@router.get("/admin/reels")
async def admin_list_reels(x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    docs = await _get_db().influencer_reels.find({}).sort(
        [("sort_order", 1), ("created_at", -1)]
    ).to_list(length=10000)
    return {"items": [_serialize(d) for d in docs]}


@router.post("/admin/reels")
async def admin_create_reel(reel: ReelIn, x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        **reel.model_dump(),
        "views": 0,
        "created_at": now,
        "updated_at": now,
    }
    await _get_db().influencer_reels.insert_one(doc)
    return {"ok": True, "reel": _serialize(doc)}


@router.put("/admin/reels/{reel_id}")
async def admin_update_reel(
    reel_id: str,
    patch: ReelUpdate,
    x_admin_token: Optional[str] = Header(None),
):
    _require_admin(x_admin_token)
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await _get_db().influencer_reels.update_one({"id": reel_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    doc = await _get_db().influencer_reels.find_one({"id": reel_id})
    return {"ok": True, "reel": _serialize(doc)}


@router.delete("/admin/reels/{reel_id}")
async def admin_delete_reel(reel_id: str, x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    r = await _get_db().influencer_reels.delete_one({"id": reel_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    return {"ok": True}
