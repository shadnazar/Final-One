"""Admin order management v2 — internal notes, audit log, invoice PDF, bulk actions.

Part of B5 Admin Power Pack.
"""
import os
import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Header, Body, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders-v2"])

_db = None
_admin_sessions = None


def set_db(db):
    global _db
    _db = db


def set_admin_sessions(s):
    global _admin_sessions
    _admin_sessions = s


def _verify(x_admin_token: Optional[str]) -> bool:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if _admin_sessions is not None and x_admin_token in _admin_sessions:
        return True
    # Centralised active-hash cache — env-seed inert after custom password set.
    from services.admin_auth import get_cached_active_admin_hash
    if hashlib.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


class NoteAdd(BaseModel):
    note: str
    author: Optional[str] = "admin"


class BulkStatusUpdate(BaseModel):
    order_ids: List[str]
    new_status: str


@router.post("/{order_id}/notes")
async def add_internal_note(order_id: str, body: NoteAdd, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """B5-C1 fix: append an internal note + audit-log entry."""
    _verify(x_admin_token)
    order = await _db.orders.find_one({"order_id": order_id}, {"_id": 0, "order_id": 1})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    entry = {
        "note": body.note.strip(),
        "author": body.author or "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.orders.update_one({"order_id": order_id}, {"$push": {"internal_notes": entry}})
    await _db.order_audit.insert_one({
        "order_id": order_id,
        "event": "note_added",
        "note": body.note,
        "author": body.author,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "note": entry}


@router.get("/{order_id}/notes")
async def list_internal_notes(order_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify(x_admin_token)
    order = await _db.orders.find_one({"order_id": order_id}, {"_id": 0, "internal_notes": 1})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order_id": order_id, "notes": order.get("internal_notes", [])}


@router.get("/{order_id}/audit-log")
async def get_audit_log(order_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """B5-C2 fix: full audit trail for an order (status changes, notes, refunds, AWB updates)."""
    _verify(x_admin_token)
    entries = await _db.order_audit.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"order_id": order_id, "events": entries}


@router.post("/bulk-status")
async def bulk_update_status(body: BulkStatusUpdate, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """B5-C4 fix: bulk status update, skipping orders already at target status."""
    _verify(x_admin_token)
    target = body.new_status.lower()
    if target not in ("confirmed", "shipped", "delivered", "cancelled", "processing"):
        raise HTTPException(status_code=400, detail="Invalid target status")
    updated = 0
    skipped = 0
    for oid in body.order_ids:
        existing = await _db.orders.find_one({"order_id": oid}, {"_id": 0, "status": 1})
        if not existing:
            continue
        if (existing.get("status") or "").lower() == target:
            skipped += 1
            continue
        await _db.orders.update_one(
            {"order_id": oid},
            {"$set": {"status": target, "status_updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await _db.order_audit.insert_one({
            "order_id": oid,
            "event": "bulk_status_change",
            "old_status": existing.get("status"),
            "new_status": target,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        updated += 1
    return {"success": True, "updated": updated, "skipped": skipped, "total": len(body.order_ids)}


@router.get("/{order_id}/invoice")
async def generate_invoice_html(order_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """B5-C3 fix: server-rendered printable HTML invoice (browser handles PDF print)."""
    _verify(x_admin_token)
    order = await _db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    items_rows = ""
    for it in (order.get("items") or []):
        name = it.get("name") or it.get("short_name") or it.get("slug") or "Product"
        qty = it.get("quantity") or 1
        price = it.get("price") or 0
        line_total = price * qty
        items_rows += f'<tr><td>{name}</td><td style="text-align:center">{qty}</td><td style="text-align:right">₹{price}</td><td style="text-align:right">₹{line_total}</td></tr>'
    if not items_rows:
        items_rows = f'<tr><td>Celesta Glow Products</td><td style="text-align:center">1</td><td style="text-align:right">₹{order.get("amount",0)}</td><td style="text-align:right">₹{order.get("amount",0)}</td></tr>'
    html = f"""<!doctype html><html><head>
    <meta charset="utf-8"><title>Invoice {order_id}</title>
    <style>
      body{{font-family:Arial,sans-serif;max-width:780px;margin:30px auto;padding:0 28px;color:#1f2937;}}
      .brand{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #059669;padding-bottom:14px;margin-bottom:24px;}}
      .brand h1{{color:#059669;margin:0;font-size:28px;letter-spacing:1px;}}
      .meta{{color:#6b7280;font-size:13px;margin-bottom:30px;}}
      .row{{display:flex;justify-content:space-between;margin-bottom:30px;}}
      .row > div{{flex:1;}}
      .row h3{{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.4px;margin:0 0 6px;}}
      table{{width:100%;border-collapse:collapse;margin:20px 0;}}
      th{{background:#f0fdf4;color:#065f46;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;}}
      td{{padding:11px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;}}
      .totals{{margin-top:20px;width:280px;margin-left:auto;}}
      .totals tr td{{border-bottom:none;padding:6px 10px;}}
      .totals tr.grand td{{font-weight:bold;font-size:16px;color:#059669;border-top:2px solid #059669;padding-top:10px;}}
      .footer{{margin-top:50px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;}}
      @media print {{.no-print{{display:none;}}}}
    </style></head><body>
    <div class="brand"><h1>CELESTA GLOW</h1><div style="text-align:right"><div style="font-weight:bold">Tax Invoice</div><div class="meta">{order_id}</div></div></div>
    <div class="meta">Date: {datetime.now(timezone.utc).strftime('%d %b %Y')} · GST: 29ABCDE1234F1Z5</div>
    <div class="row">
      <div><h3>Bill to</h3>
        <div style="font-weight:bold">{order.get('name','')}</div>
        <div>+91 {order.get('phone','')}</div>
        <div>{order.get('email') or ''}</div>
        <div>{order.get('house_number','')}, {order.get('area','')}</div>
        <div>{order.get('state','')} - {order.get('pincode','')}</div>
      </div>
      <div><h3>Payment</h3>
        <div>Method: <b>{order.get('payment_method','')}</b></div>
        <div>Status: <b>{(order.get('status') or 'confirmed').upper()}</b></div>
        {f'<div>AWB: <b>{order.get("awb_number")}</b></div>' if order.get('awb_number') else ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>{items_rows}</tbody>
    </table>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">₹{order.get('amount',0)}</td></tr>
      {f'<tr><td>Coupon ({order.get("coupon_code","")})</td><td style="text-align:right;color:#059669">-₹{order.get("coupon_discount",0)}</td></tr>' if order.get('coupon_code') else ''}
      <tr class="grand"><td>TOTAL</td><td style="text-align:right">₹{order.get('amount',0)}</td></tr>
    </table>
    <div class="footer">Thank you for shopping with Celesta Glow · support@celestaglow.com · +91 9446125745<br/>India's #1 Anti-Aging Skincare Brand</div>
    <script>setTimeout(() => window.print(), 400);</script>
    </body></html>"""
    return HTMLResponse(content=html, status_code=200)
