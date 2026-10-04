"""Admin revenue & orders v3 endpoints.

Adds the things requested in the Feb 2026 admin push:
  * Day-wise & month-wise revenue filters
  * Two revenue lines split explicitly:
      - placed_revenue:   sum(amount) over all paid orders within window
      - delivered_revenue: same but ONLY where delivery_status == 'Delivered'
  * Returns subtracted from delivered_revenue
  * Daily/Monthly bucket aggregation (Mongo $facet for one round-trip)
  * Audit-friendly export sheet — includes EVERY field admin needs.
"""
from __future__ import annotations
import os
import io
import csv as _csv
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
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

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

router = APIRouter(prefix="/admin/revenue", tags=["admin-revenue"])

DELIVERED_STATUSES = {"Delivered", "DELIVERED", "delivered"}
RETURNED_STATUSES = {"RTO", "Returned", "RETURNED", "returned", "rto"}


def _parse_window(period: str, date_from: Optional[str], date_to: Optional[str]):
    """Return (start_iso, end_iso, bucket) where bucket is 'day' or 'month'."""
    now = datetime.now(timezone.utc)
    if date_from or date_to:
        start = date_from or (now - timedelta(days=30)).date().isoformat()
        end = date_to or now.date().isoformat()
        return f"{start}T00:00:00", f"{end}T23:59:59.999", ("month" if period == "month" else "day")
    if period == "today":
        d = now.date().isoformat()
        return f"{d}T00:00:00", f"{d}T23:59:59.999", "day"
    if period == "yesterday":
        d = (now - timedelta(days=1)).date().isoformat()
        return f"{d}T00:00:00", f"{d}T23:59:59.999", "day"
    if period == "week":
        s = (now - timedelta(days=6)).date().isoformat()
        e = now.date().isoformat()
        return f"{s}T00:00:00", f"{e}T23:59:59.999", "day"
    if period == "month":
        s = now.replace(day=1).date().isoformat()
        e = now.date().isoformat()
        return f"{s}T00:00:00", f"{e}T23:59:59.999", "day"
    if period == "ytd":
        s = now.replace(month=1, day=1).date().isoformat()
        e = now.date().isoformat()
        return f"{s}T00:00:00", f"{e}T23:59:59.999", "month"
    if period == "year":
        s = (now - timedelta(days=365)).date().isoformat()
        e = now.date().isoformat()
        return f"{s}T00:00:00", f"{e}T23:59:59.999", "month"
    # default — last 30 days
    s = (now - timedelta(days=29)).date().isoformat()
    e = now.date().isoformat()
    return f"{s}T00:00:00", f"{e}T23:59:59.999", "day"


@router.get("/summary")
async def revenue_summary(
    admin: bool = Depends(verify_admin),
    period: str = Query("month", description="today|yesterday|week|month|ytd|year"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
):
    """Returns:
        {
          window: {from, to, bucket},
          totals: {
            orders_placed, placed_revenue, placed_avg_order_value,
            orders_delivered, delivered_revenue, delivered_avg_order_value,
            orders_returned, returned_value,
            orders_pending, orders_in_transit,
            cod_count, prepaid_count,
          },
          series: [{label, orders_placed, placed_revenue,
                    orders_delivered, delivered_revenue}]
        }
    """
    start, end, bucket = _parse_window(period, date_from, date_to)
    base_match = {"created_at": {"$gte": start, "$lte": end}}

    # Single $facet aggregation: totals + per-bucket series in one round-trip.
    bucket_fmt = "%Y-%m" if bucket == "month" else "%Y-%m-%d"

    pipeline = [
        {"$match": base_match},
        {"$addFields": {
            "_amount": {"$ifNull": ["$amount", 0]},
            "_delivered": {"$in": ["$delivery_status", list(DELIVERED_STATUSES)]},
            "_returned": {"$in": ["$delivery_status", list(RETURNED_STATUSES)]},
            "_dt": {"$ifNull": ["$created_at", ""]},
        }},
        {"$addFields": {
            "_dt_parsed": {"$dateFromString": {
                "dateString": "$_dt",
                "onError": None, "onNull": None,
            }},
        }},
        {"$facet": {
            "totals": [
                {"$group": {
                    "_id": None,
                    "orders_placed": {"$sum": 1},
                    "placed_revenue": {"$sum": "$_amount"},
                    "orders_delivered": {"$sum": {"$cond": ["$_delivered", 1, 0]}},
                    "delivered_revenue": {"$sum": {"$cond": ["$_delivered", "$_amount", 0]}},
                    "orders_returned": {"$sum": {"$cond": ["$_returned", 1, 0]}},
                    "returned_value": {"$sum": {"$cond": ["$_returned", "$_amount", 0]}},
                    "cod_count": {"$sum": {"$cond": [{"$eq": [{"$toUpper": {"$ifNull": ["$payment_method", ""]}}, "COD"]}, 1, 0]}},
                    "prepaid_count": {"$sum": {"$cond": [{"$eq": [{"$toUpper": {"$ifNull": ["$payment_method", ""]}}, "PREPAID"]}, 1, 0]}},
                }},
            ],
            "series": [
                {"$match": {"_dt_parsed": {"$ne": None}}},
                {"$group": {
                    "_id": {"$dateToString": {"date": "$_dt_parsed", "format": bucket_fmt}},
                    "orders_placed": {"$sum": 1},
                    "placed_revenue": {"$sum": "$_amount"},
                    "orders_delivered": {"$sum": {"$cond": ["$_delivered", 1, 0]}},
                    "delivered_revenue": {"$sum": {"$cond": ["$_delivered", "$_amount", 0]}},
                }},
                {"$sort": {"_id": 1}},
            ],
            "by_status": [
                {"$group": {
                    "_id": {"$ifNull": ["$delivery_status", "Unknown"]},
                    "n": {"$sum": 1},
                }},
            ],
        }},
    ]

    rows = await db.orders.aggregate(pipeline).to_list(1)
    f = rows[0] if rows else {}
    totals = (f.get("totals") or [{}])[0]
    series = [
        {
            "label": s["_id"],
            "orders_placed": s["orders_placed"],
            "placed_revenue": round(s["placed_revenue"], 2),
            "orders_delivered": s["orders_delivered"],
            "delivered_revenue": round(s["delivered_revenue"], 2),
        }
        for s in (f.get("series") or [])
    ]
    by_status = {s["_id"]: s["n"] for s in (f.get("by_status") or [])}

    placed = totals.get("placed_revenue", 0) or 0
    placed_n = totals.get("orders_placed", 0) or 0
    delivered = totals.get("delivered_revenue", 0) or 0
    delivered_n = totals.get("orders_delivered", 0) or 0
    return {
        "window": {"from": start[:10], "to": end[:10], "bucket": bucket, "period": period},
        "totals": {
            "orders_placed": placed_n,
            "placed_revenue": round(placed, 2),
            "placed_aov": round(placed / placed_n, 2) if placed_n else 0,
            "orders_delivered": delivered_n,
            "delivered_revenue": round(delivered, 2),
            "delivered_aov": round(delivered / delivered_n, 2) if delivered_n else 0,
            "orders_returned": totals.get("orders_returned", 0),
            "returned_value": round(totals.get("returned_value", 0) or 0, 2),
            "cod_count": totals.get("cod_count", 0),
            "prepaid_count": totals.get("prepaid_count", 0),
            "delivery_rate": round((delivered_n / placed_n * 100) if placed_n else 0, 1),
        },
        "by_status": by_status,
        "series": series,
    }


@router.get("/export-full")
async def export_full(
    admin: bool = Depends(verify_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    fmt: str = "xlsx",
):
    """Export EVERY field admin might need — no field restrictions.
    Includes: customer info, full address, items breakdown, shipping, payment,
    Delhivery tracking, delivered_at, returned_at, referral, source page."""
    query = {}
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = f"{date_from}T00:00:00"
        if date_to:
            date_q["$lte"] = f"{date_to}T23:59:59.999"
        query["created_at"] = date_q
    if status and status != "all":
        query["status"] = status
    if payment_method and payment_method != "all":
        query["payment_method"] = payment_method

    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(50000).to_list(50000)

    headers = [
        "Order ID", "Created At", "Status", "Delivery Status",
        "Customer Name", "Phone", "Email",
        "House/Building", "Area/Street", "City", "State", "Pincode",
        "Items Detail", "Items Count", "Brands",
        "Payment Method", "Subtotal MRP", "Coupon Code", "Coupon Discount",
        "Shipping Fee", "Total Paid",
        "AWB Number", "Shipping Provider", "Tracking URL",
        "Estimated Delivery", "Delivered At", "Returned At",
        "Referral Used", "Source Page", "Notes",
    ]

    def _row(o):
        items = o.get("items") or []
        prod_str = " | ".join(
            f"{(it.get('short_name') or it.get('name') or it.get('slug') or '?')}"
            + (f" ({it.get('shade_name')})" if it.get('shade_name') else "")
            + f" x{it.get('quantity', 1)} @{it.get('price', 0)}"
            for it in items
        ) or "—"
        item_count = sum(int(it.get('quantity') or 1) for it in items) if items else 1
        brands = " | ".join(sorted({it.get('brand', '') for it in items if it.get('brand')}))
        mrp_total = sum(float(it.get('mrp', it.get('price', 0)) or 0) * int(it.get('quantity') or 1) for it in items)
        return [
            o.get("order_id", ""),
            (o.get("created_at") or "")[:19].replace("T", " "),
            o.get("status", ""),
            o.get("delivery_status", ""),
            o.get("name", ""),
            o.get("phone", ""),
            o.get("email", ""),
            o.get("house_number", ""),
            o.get("area", ""),
            o.get("city", ""),
            o.get("state", ""),
            o.get("pincode", ""),
            prod_str,
            item_count,
            brands,
            o.get("payment_method", ""),
            f"{mrp_total:.2f}",
            o.get("coupon_code", ""),
            f"{float(o.get('coupon_discount') or 0):.2f}",
            f"{float(o.get('shipping_fee') or 0):.2f}",
            f"{float(o.get('amount') or 0):.2f}",
            o.get("awb_number", ""),
            o.get("shipping_provider", ""),
            o.get("tracking_url", ""),
            (o.get("estimated_delivery") or "")[:10],
            (o.get("delivered_at") or "")[:19].replace("T", " "),
            (o.get("returned_at") or "")[:19].replace("T", " "),
            o.get("referral_code_used", ""),
            o.get("source_page", ""),
            o.get("notes", ""),
        ]

    fname = f"celesta-orders-full-{(date_from or 'all')}_to_{(date_to or 'today')}"

    if fmt.lower() == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Orders"
        ws.append(headers)
        for o in orders:
            ws.append(_row(o))
        # Auto-width
        for col_idx, header in enumerate(headers, 1):
            col_letter = ws.cell(row=1, column=col_idx).column_letter
            ws.column_dimensions[col_letter].width = max(12, min(48, len(header) + 4))
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{fname}.xlsx"'},
        )

    buf = io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(headers)
    for o in orders:
        writer.writerow(_row(o))
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'},
    )


# ========== Delhivery sync ==========

@router.post("/delhivery/sync")
async def delhivery_sync_now(admin: bool = Depends(verify_admin), limit: int = 100):
    """Poll Delhivery for the status of every order with an AWB but no
    final state yet. Stores delivery_status / estimated_delivery / delivered_at
    / returned_at / tracking_url on each order. Runs synchronously (max 100 at a time)."""
    try:
        from services.delhivery_service import DelhiveryService
        svc = DelhiveryService()
    except Exception:
        raise HTTPException(503, "Delhivery service not configured")

    cur = db.orders.find(
        {
            "awb_number": {"$nin": [None, ""]},
            "delivery_status": {"$nin": list(DELIVERED_STATUSES) + list(RETURNED_STATUSES)},
        },
        {"_id": 0, "order_id": 1, "awb_number": 1},
    ).sort("created_at", -1).limit(limit)
    orders = await cur.to_list(limit)
    if not orders:
        return {"checked": 0, "updated": 0}

    updated = 0
    samples = []
    for o in orders:
        try:
            info = await svc.track_shipment(o["awb_number"])
        except Exception as e:
            samples.append({"order_id": o["order_id"], "error": str(e)[:120]})
            continue
        if not info or not info.get("success"):
            continue
        new_status = info.get("status") or "Unknown"
        upd = {
            "delivery_status": new_status,
            "tracking_url": f"https://www.delhivery.com/track/package/{o['awb_number']}",
        }
        if info.get("expected_delivery"):
            upd["estimated_delivery"] = info["expected_delivery"]
        now = datetime.now(timezone.utc).isoformat()
        if new_status in DELIVERED_STATUSES:
            upd["delivered_at"] = info.get("delivered_date") or now
            upd["status"] = "delivered"
        elif new_status in RETURNED_STATUSES:
            upd["returned_at"] = now
            upd["status"] = "returned"
        await db.orders.update_one({"order_id": o["order_id"]}, {"$set": upd})
        updated += 1
        if len(samples) < 5:
            samples.append({"order_id": o["order_id"], "new_status": new_status})
    return {"checked": len(orders), "updated": updated, "samples": samples}
