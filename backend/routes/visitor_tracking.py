"""
Visitor presence ("who's online right now") — minimal real-time analytics.

How it works:
- Frontend pings POST /api/visitor/ping every 60s with a stable session id +
  the current page path + page title.
- Each ping upserts a doc in `visitor_pings` keyed by session_id.
- A TTL index expires docs 5 minutes after `last_seen` so the collection is
  self-cleaning; admin queries simply `find({})`.

Why this isn't Google Analytics:
- Lets the merchant see "Sara is on /product/vitamin-c-serum right now" in
  their own admin panel without exporting from a 3rd-party dashboard.
- Stays anonymous unless the customer has logged in — we attach the email/
  phone only if the page sent it (best-effort, never required).
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, Header, HTTPException, Request, Body
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# Set by main app at startup
_db: Optional[AsyncIOMotorDatabase] = None
_verify_admin = None


def init_visitor_tracking(db: AsyncIOMotorDatabase, verify_admin):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin


async def ensure_indexes():
    """Create the TTL index. Idempotent — safe to call on every startup."""
    if _db is None:
        return
    try:
        await _db.visitor_pings.create_index(
            "last_seen", expireAfterSeconds=300, name="visitor_ping_ttl"
        )
        await _db.visitor_pings.create_index("session_id", name="session_id_uq")
    except Exception as e:
        logger.warning(f"visitor index creation skipped: {e}")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PingPayload(BaseModel):
    session_id: str = Field(..., min_length=4, max_length=80)
    path: str = ""
    title: str = ""
    niche: Optional[str] = None
    product_slug: Optional[str] = None
    referrer: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None


@router.post("/visitor/ping")
async def visitor_ping(payload: PingPayload, request: Request):
    """Anonymous-by-default presence ping. Idempotent — every call refreshes
    the TTL countdown so the visitor stays "live" as long as they keep
    pinging."""
    if _db is None:
        return {"success": False}

    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")[:200]
    now = _now()

    # Cap path/title length to avoid bloated docs from long URL params.
    safe_path  = (payload.path  or "")[:300]
    safe_title = (payload.title or "")[:140]

    set_doc = {
        "session_id":     payload.session_id,
        "path":           safe_path,
        "title":          safe_title,
        "niche":          payload.niche,
        "product_slug":   payload.product_slug,
        "referrer":       (payload.referrer or "")[:300],
        "customer_email": (payload.customer_email or None),
        "customer_phone": (payload.customer_phone or None),
        "customer_name":  (payload.customer_name or None),
        "last_seen":      now,
        "ip_hash":        hash(ip) % 10**8 if ip else None,  # crude city-bucket
        "user_agent":     ua,
    }
    on_insert = {"first_seen": now}

    await _db.visitor_pings.update_one(
        {"session_id": payload.session_id},
        {"$set": set_doc,
         "$setOnInsert": on_insert,
         "$inc": {"ping_count": 1},
         "$push": {"recent_pages": {
             "$each": [{"path": safe_path, "title": safe_title, "at": now.isoformat()}],
             "$slice": -25,  # keep last 25 page views per session
         }}},
        upsert=True,
    )
    return {"success": True}


@router.get("/admin/visitors/active")
async def admin_active_visitors(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Admin: list visitors active in the last 5 minutes."""
    if _verify_admin is None:
        raise HTTPException(status_code=500, detail="visitor module not initialised")
    _verify_admin(x_admin_token=x_admin_token)
    if _db is None:
        return {"success": True, "count": 0, "visitors": []}

    cutoff = _now() - timedelta(minutes=5)
    cur = _db.visitor_pings.find(
        {"last_seen": {"$gte": cutoff}},
        {"_id": 0, "ip_hash": 0, "user_agent": 0},
    ).sort("last_seen", -1).limit(200)
    rows: List[Dict] = await cur.to_list(length=200)

    # Bucket per page and per niche for the summary.
    by_page: Dict[str, int] = {}
    by_niche: Dict[str, int] = {}
    for r in rows:
        p = r.get("path") or "/"
        by_page[p] = by_page.get(p, 0) + 1
        n = r.get("niche") or "—"
        by_niche[n] = by_niche.get(n, 0) + 1

    # ISO-format the timestamps so the frontend can do "2 min ago".
    for r in rows:
        ls = r.get("last_seen")
        fs = r.get("first_seen")
        if isinstance(ls, datetime):
            r["last_seen"] = ls.isoformat()
        if isinstance(fs, datetime):
            r["first_seen"] = fs.isoformat()

    return {
        "success": True,
        "count":   len(rows),
        "visitors": rows,
        "by_page":  sorted(by_page.items(),  key=lambda kv: -kv[1])[:25],
        "by_niche": sorted(by_niche.items(), key=lambda kv: -kv[1]),
    }
