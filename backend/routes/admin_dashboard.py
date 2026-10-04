"""Admin dashboard summary stats — Today/Yesterday/7d/30d widgets.

Powers the top-row widget panel: Today's Sales, Today's Orders, AOV,
Conversion, Pending Orders, Low Stock SKUs, Pending Reviews, Pending Consultations.
"""
import os
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"])

logger = logging.getLogger(__name__)
_db = None
_admin_sessions = None


def set_db(db):
    global _db
    _db = db


def set_admin_sessions(s):
    global _admin_sessions
    _admin_sessions = s


def _verify(token: Optional[str]):
    if not token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if _admin_sessions is not None and token in _admin_sessions:
        return True
    # Use the centralised active-admin-hash cache — once a custom admin
    # password is saved in admin_settings, the env-seed is INERT.
    from services.admin_auth import get_cached_active_admin_hash
    if hashlib.sha256(token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


def _start_of_day_ist_utc(d: datetime) -> str:
    """Return the UTC ISO timestamp of the *IST* start-of-day for `d` (UTC input).

    The store operates in India — admins reading the dashboard expect "today"
    to mean midnight IST, not midnight UTC. Because created_at is stored as a
    UTC ISO string, we convert IST-midnight back to UTC and hand that string
    to Mongo. This fixes the classic "orders between 00:00 and 05:30 IST
    disappear from today's count" bug.
    """
    ist = timezone(timedelta(hours=5, minutes=30))
    ist_now = d.astimezone(ist)
    ist_midnight = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return ist_midnight.astimezone(timezone.utc).isoformat()


# Legacy alias — kept so other callers in this file don't break.
_start_of_day_utc = _start_of_day_ist_utc


@router.get("/summary")
async def dashboard_summary(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    """All key dashboard metrics in one call."""
    _verify(x_admin_token)
    now = datetime.now(timezone.utc)
    today_start = _start_of_day_utc(now)
    yesterday_start = _start_of_day_utc(now - timedelta(days=1))
    seven_days_ago = _start_of_day_utc(now - timedelta(days=7))
    thirty_days_ago = _start_of_day_utc(now - timedelta(days=30))

    # ---- Today ----
    today_orders_count = await _db.orders.count_documents({"created_at": {"$gte": today_start}})
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    today_agg = await _db.orders.aggregate(today_pipeline).to_list(1)
    today_sales = today_agg[0]["total"] if today_agg else 0
    today_aov = round(today_sales / today_orders_count, 2) if today_orders_count else 0

    # ---- Yesterday (for comparison) ----
    yest_pipeline = [
        {"$match": {"created_at": {"$gte": yesterday_start, "$lt": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    yest_agg = await _db.orders.aggregate(yest_pipeline).to_list(1)
    yesterday_sales = yest_agg[0]["total"] if yest_agg else 0
    yesterday_orders = yest_agg[0]["count"] if yest_agg else 0

    # ---- 7-day + 30-day totals ----
    seven_agg = await _db.orders.aggregate([
        {"$match": {"created_at": {"$gte": seven_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    thirty_agg = await _db.orders.aggregate([
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    sales_7d = seven_agg[0]["total"] if seven_agg else 0
    orders_7d = seven_agg[0]["count"] if seven_agg else 0
    sales_30d = thirty_agg[0]["total"] if thirty_agg else 0
    orders_30d = thirty_agg[0]["count"] if thirty_agg else 0

    # ---- 30-day revenue line chart ----
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$addFields": {"day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$day", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_rows = await _db.orders.aggregate(daily_pipeline).to_list(60)
    daily_chart = [{"day": r["_id"], "sales": r["total"], "orders": r["count"]} for r in daily_rows]

    # ---- COD vs Prepaid (last 30 days) ----
    pm_agg = await _db.orders.aggregate([
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": {"$ifNull": ["$payment_method", "Unknown"]}, "count": {"$sum": 1}, "total": {"$sum": "$amount"}}},
    ]).to_list(10)
    payment_split = [{"method": r["_id"], "count": r["count"], "total": r["total"]} for r in pm_agg]

    # ---- Top 5 SKUs (last 30 days, by qty) ----
    sku_pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.slug", "qty": {"$sum": "$items.quantity"}, "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}}}},
        {"$sort": {"qty": -1}},
        {"$limit": 5}
    ]
    top_skus_rows = await _db.orders.aggregate(sku_pipeline).to_list(10)
    top_skus = []
    for r in top_skus_rows:
        prod = await _db.products.find_one({"slug": r["_id"]}, {"_id": 0, "name": 1, "short_name": 1, "images": 1}) or {}
        top_skus.append({
            "slug": r["_id"],
            "name": prod.get("short_name") or prod.get("name") or r["_id"],
            "qty": r["qty"],
            "revenue": round(r["revenue"], 2),
            "image": (prod.get("images") or [None])[0],
        })

    # ---- Action items ----
    pending_orders = await _db.orders.count_documents({"status": {"$in": ["confirmed", "processing", "pending"]}})
    pending_reviews = await _db.reviews.count_documents({"approved": {"$ne": True}}) if hasattr(_db, "reviews") else 0
    try:
        pending_reviews = await _db.reviews.count_documents({"approved": {"$ne": True}})
    except Exception:
        pending_reviews = 0
    try:
        pending_consultations = await _db.consultations.count_documents({"status": {"$in": ["new", "pending"]}})
    except Exception:
        pending_consultations = 0

    # Low stock (≤ 5 units OR explicitly flagged)
    low_stock = await _db.products.count_documents({"$and": [
        {"is_active": {"$ne": False}},
        {"$or": [
            {"stock_qty": {"$lte": 5, "$gte": 0}},
            {"is_low_stock": True},
        ]},
    ]})

    # ---- Conversion estimate ----
    # If we have visitor analytics, compute real conversion. Otherwise approximate.
    try:
        visits_today = await _db.analytics_events.count_documents({"event": "page_view", "ts": {"$gte": today_start}})
    except Exception:
        visits_today = 0
    conversion_today = round((today_orders_count / visits_today * 100), 2) if visits_today else 0

    # ---- Recent activity feed (last 10 audit + new orders) ----
    feed = []
    try:
        for r in await _db.order_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(8):
            feed.append({"type": r.get("event", "audit"), "order_id": r.get("order_id"), "note": r.get("note"), "ts": r.get("created_at")})
    except Exception:
        pass
    new_orders = await _db.orders.find({}, {"_id": 0, "order_id": 1, "name": 1, "amount": 1, "created_at": 1}).sort("created_at", -1).to_list(5)
    for o in new_orders:
        feed.append({"type": "new_order", "order_id": o.get("order_id"), "customer": o.get("name"), "amount": o.get("amount"), "ts": o.get("created_at")})
    feed.sort(key=lambda x: x.get("ts") or "", reverse=True)
    feed = feed[:10]

    return {
        "today": {
            "sales": round(today_sales, 2),
            "orders": today_orders_count,
            "aov": today_aov,
            "conversion": conversion_today,
            "visits": visits_today,
        },
        "yesterday": {"sales": round(yesterday_sales, 2), "orders": yesterday_orders},
        "last_7d": {"sales": round(sales_7d, 2), "orders": orders_7d},
        "last_30d": {"sales": round(sales_30d, 2), "orders": orders_30d},
        "action_items": {
            "pending_orders": pending_orders,
            "low_stock_skus": low_stock,
            "pending_reviews": pending_reviews,
            "pending_consultations": pending_consultations,
        },
        "daily_chart_30d": daily_chart,
        "payment_split_30d": payment_split,
        "top_skus_30d": top_skus,
        "activity_feed": feed,
    }
