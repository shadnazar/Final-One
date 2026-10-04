"""Payment policy admin toggles.

Currently exposes one flag: `cod_restriction_enabled`.
  • DISABLED (default): COD works for every order — legacy behaviour.
  • ENABLED: COD is restricted to Celesta Glow's own anti-aging products
    OR customers whose delivery pincode is inside a warehouse coverage zone
    (instant-delivery available). All other carts must go prepaid.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()
_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


_SETTING_TYPE = "payment_policy"


class PaymentPolicyPatch(BaseModel):
    cod_restriction_enabled: Optional[bool] = None


async def _get() -> dict:
    doc = await _db.admin_settings.find_one({"type": _SETTING_TYPE}, {"_id": 0}) or {}
    return {
        "cod_restriction_enabled": bool(doc.get("cod_restriction_enabled", False)),
    }


@router.get("/payment-policy")
async def public_get(response: Response):
    """Public read — customers' checkout pages fetch this to decide whether
    to gate the COD radio. 60 s edge cache so we don't stampede Mongo."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return await _get()


@router.put("/admin/payment-policy")
async def admin_set(
    patch: PaymentPolicyPatch,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if _verify_admin is not None:
        _verify_admin(x_admin_token)
    updates = {k: v for k, v in patch.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await _db.admin_settings.update_one(
        {"type": _SETTING_TYPE},
        {"$set": {"type": _SETTING_TYPE, **updates}},
        upsert=True,
    )
    return await _get()
