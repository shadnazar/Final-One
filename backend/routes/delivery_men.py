"""Delivery-men roster (Feb-2026).

Simple admin-configurable list of local delivery riders. Each entry has a
name + WhatsApp number. Used by AdminOrders to compose a WhatsApp handoff
message ("Order X for Y — deliver to Z, maps link, contact") targeted at a
specific rider's number.
"""
from __future__ import annotations
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


class DeliveryManIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    whatsapp_number: str = Field(..., min_length=8, max_length=20)
    active: Optional[bool] = True
    assigned_warehouse_id: Optional[str] = None  # Feb-2026: routes only orders from this warehouse


class DeliveryManPatch(BaseModel):
    name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    active: Optional[bool] = None
    assigned_warehouse_id: Optional[str] = None


def _clean_number(raw: str) -> str:
    """Return the phone as a plain digits string, keeping only country code + number.
    We prepend '91' if the customer forgets and it looks like a 10-digit Indian mobile."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


@router.get("/admin/delivery-men")
async def list_delivery_men(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    docs = await _db.delivery_men.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return docs


@router.post("/admin/delivery-men")
async def create_delivery_man(payload: DeliveryManIn, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    num = _clean_number(payload.whatsapp_number)
    if not num or len(num) < 10:
        raise HTTPException(400, "Invalid WhatsApp number")
    doc = {
        "id": uuid.uuid4().hex[:12],
        "name": payload.name.strip(),
        "whatsapp_number": num,
        "active": bool(payload.active),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.delivery_men.insert_one(dict(doc))
    return doc


@router.patch("/admin/delivery-men/{man_id}")
async def update_delivery_man(man_id: str, payload: DeliveryManPatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    upd = {}
    if payload.name is not None:
        upd["name"] = payload.name.strip()
    if payload.whatsapp_number is not None:
        num = _clean_number(payload.whatsapp_number)
        if not num or len(num) < 10:
            raise HTTPException(400, "Invalid WhatsApp number")
        upd["whatsapp_number"] = num
    if payload.active is not None:
        upd["active"] = bool(payload.active)
    if payload.assigned_warehouse_id is not None:
        # Empty string clears the assignment.
        upd["assigned_warehouse_id"] = payload.assigned_warehouse_id or None
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await _db.delivery_men.update_one({"id": man_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Delivery man not found")
    return await _db.delivery_men.find_one({"id": man_id}, {"_id": 0})


@router.delete("/admin/delivery-men/{man_id}")
async def delete_delivery_man(man_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    res = await _db.delivery_men.delete_one({"id": man_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Delivery man not found")
    return {"success": True}


class OrderDeliveryAssign(BaseModel):
    delivery_man_id: Optional[str] = None  # null → unassign
    delivery_type: Optional[str] = None    # 'standard' | 'instant'


@router.patch("/admin/orders/{order_id}/delivery-assign")
async def assign_delivery(order_id: str, payload: OrderDeliveryAssign, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Assign a delivery man / set instant flag on an order."""
    _verify_admin(x_admin_token)
    upd = {}
    if payload.delivery_man_id is not None:
        upd["assigned_delivery_man_id"] = payload.delivery_man_id or None
    if payload.delivery_type is not None:
        if payload.delivery_type not in ("standard", "instant"):
            raise HTTPException(400, "delivery_type must be standard or instant")
        upd["delivery_type"] = payload.delivery_type
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await _db.orders.update_one({"order_id": order_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    # Audit trail
    try:
        await _db.order_audit.insert_one({
            "order_id": order_id,
            "event": "delivery_assign",
            **upd,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:  # noqa: BLE001
        pass
    return await _db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ---------------------------------------------------------------------------
# Warehouse config — single-record settings doc, seed for Instant Delivery.
# Simple GET/PUT. Fields are optional strings only (no geo logic yet).
# ---------------------------------------------------------------------------
WH_KEY = {"type": "warehouse_config"}


class WarehousePatch(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    maps_link: Optional[str] = None


@router.get("/admin/warehouse")
async def get_warehouse(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    doc = await _db.admin_settings.find_one(WH_KEY, {"_id": 0}) or {}
    return {k: doc.get(k, "") for k in ("name", "address", "pincode", "phone", "maps_link")}


@router.put("/admin/warehouse")
async def put_warehouse(payload: WarehousePatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    upd = {k: (v or "") for k, v in payload.dict().items() if v is not None}
    if upd:
        await _db.admin_settings.update_one(
            WH_KEY, {"$set": upd, "$setOnInsert": WH_KEY}, upsert=True,
        )
    doc = await _db.admin_settings.find_one(WH_KEY, {"_id": 0}) or {}
    return {k: doc.get(k, "") for k in ("name", "address", "pincode", "phone", "maps_link")}
