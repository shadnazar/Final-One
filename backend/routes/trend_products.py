"""Trend-Based Product Generator — admin API layer.

Endpoints:
  POST   /api/admin/trend-products/generate  — preview (LLM only, no persist)
  POST   /api/admin/trend-products           — persist a generated payload
  PATCH  /api/admin/trend-products/{slug}    — flip is_active / edit fields
  GET    /api/admin/trend-products           — list generated ones
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Any, Dict

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from services.trend_product_generator import TrendProductGenerator

router = APIRouter(prefix="/admin/trend-products", tags=["admin-trend-products"])
_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


class GenerateRequest(BaseModel):
    blueprint: Dict[str, Any] = Field(..., description="Merchant blueprint")
    base_slug: Optional[str] = Field(None, description="Existing product to clone images from")
    niche: Optional[str] = Field(None, description="Override niche")


class PersistRequest(BaseModel):
    product: Dict[str, Any]


class PatchRequest(BaseModel):
    is_active: Optional[bool] = None
    is_to_be_launched: Optional[bool] = None
    price_mrp: Optional[float] = None
    price_prepaid: Optional[float] = None
    price_cod: Optional[float] = None
    stock_qty: Optional[int] = None
    niche: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None


@router.post("/generate")
async def generate_preview(
    req: GenerateRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Ask Gemini for the marketing copy + trust reviews. Does NOT persist."""
    if _verify_admin:
        _verify_admin(x_admin_token)
    gen = TrendProductGenerator(_db)
    try:
        product = await gen.generate(
            blueprint=req.blueprint,
            base_slug=req.base_slug,
            niche=req.niche,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        msg = str(exc)
        # LiteLLM surfaces budget/rate-limit errors — surface them as 429
        # with a machine-readable reason so the admin UI can render actionable
        # copy ("Universal Key budget exceeded — top up in Profile → Manage plan").
        low = msg.lower()
        if "budget has been exceeded" in low or "ratelimiterror" in low or "rate limit" in low:
            raise HTTPException(status_code=429, detail={
                "reason": "llm_budget_exceeded",
                "message": "Universal Key budget exceeded. Top up in Profile → Manage plan → Universal Key → Add Balance.",
            })
        raise HTTPException(status_code=502, detail=f"Generator error: {exc}")
    return {"product": product}


@router.post("")
async def persist_product(
    req: PersistRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Persist a generated product. Idempotent on slug — updates if exists."""
    if _verify_admin:
        _verify_admin(x_admin_token)
    p = dict(req.product or {})
    slug = (p.get("slug") or "").strip()
    if not slug:
        raise HTTPException(status_code=400, detail="slug required")
    p["updated_at"] = datetime.now(timezone.utc).isoformat()
    p.setdefault("created_at", p["updated_at"])
    p.setdefault("generated_by", "trend_product_generator")
    p.setdefault("is_active", False)
    await _db.products.update_one({"slug": slug}, {"$set": p}, upsert=True)
    return {"success": True, "slug": slug, "is_active": p.get("is_active", False)}


@router.get("")
async def list_generated(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    items: List[Dict[str, Any]] = []
    cursor = _db.products.find(
        {"generated_by": "trend_product_generator"},
        {"_id": 0}
    ).sort("created_at", -1).limit(200)
    async for p in cursor:
        items.append(p)
    return {"items": items, "total": len(items)}


@router.patch("/{slug}")
async def patch_generated(
    slug: str,
    req: PatchRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin:
        _verify_admin(x_admin_token)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    # Map alias fields to canonical ones
    if "price_mrp" in updates: updates["mrp"] = updates.pop("price_mrp")
    if "price_prepaid" in updates: updates["prepaid_price"] = updates.pop("price_prepaid")
    if "price_cod" in updates: updates["cod_price"] = updates.pop("price_cod")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await _db.products.update_one({"slug": slug}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
    return {"success": True, "product": prod}
