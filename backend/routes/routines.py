"""
Routine reports + extended retention endpoints.

Routine reports:
- POST /api/routines/save               -> public; saves a generated routine (+optional photo) to db.routines
- GET  /api/admin/routines              -> admin; lists all saved routines newest-first
- GET  /api/admin/routines/{id}         -> admin; single routine detail

Retention extensions on top of /admin/retention/customers + /admin/retention/note:
- GET  /api/admin/retention/reorder     -> admin; customers 30+ days post-purchase that haven't reordered yet
                                            (pulled from db.orders, joined with retention_notes)
"""
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter()
db = None


def set_db(database):
    global db
    db = database


def _verify_admin_or_employee(x_admin_token: Optional[str], x_employee_token: Optional[str] = None, permission: Optional[str] = None):
    """Allow either admin token or an employee token with the right permission."""
    from routes import products
    products.verify_auth(x_admin_token=x_admin_token, x_employee_token=x_employee_token, permission=permission)


def _verify_admin(token: Optional[str]):
    from routes import products
    products.verify_auth(x_admin_token=token)


# ==================== ROUTINES ====================

class RoutineSlot(BaseModel):
    slot: dict           # {id, label, ...}
    product_slug: Optional[str] = None
    product_name: Optional[str] = None


class RoutineSave(BaseModel):
    skin_type: str
    age: str
    concerns: List[str] = []
    am: List[RoutineSlot] = []
    pm: List[RoutineSlot] = []
    photo_url: Optional[str] = None        # cloudinary URL preferred
    photo_data: Optional[str] = None       # base64 fallback (rarely used) — FRONT scan
    photo_left_data: Optional[str] = None  # base64 LEFT-angle face scan
    photo_right_data: Optional[str] = None # base64 RIGHT-angle face scan
    skin_score: Optional[int] = None
    skin_score_factors: Optional[List[dict]] = None
    specialist_notes: Optional[List[str]] = None
    recommended_products: Optional[List[dict]] = None
    mobile: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/routines/save")
async def save_routine(payload: RoutineSave):
    """Public — save a generated routine. Used by /routine page so admin gets visibility."""
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.routines.insert_one(doc)
    return {"success": True, "id": doc["id"]}


class RoutineAnalyze(BaseModel):
    front: str                         # base64 dataURL or raw base64 (required)
    left: Optional[str] = None
    right: Optional[str] = None
    skin_type: Optional[str] = None
    age: Optional[str] = None
    concerns: List[str] = []


def _strip_data_url(b64: Optional[str]) -> Optional[str]:
    if not b64:
        return None
    if b64.startswith("data:") and "," in b64:
        return b64.split(",", 1)[1]
    return b64


@router.post("/routine/analyze")
async def analyze_routine(payload: RoutineAnalyze):
    """Public — Gemini-powered skin scan for the routine builder.

    1. Validates the FRONT photo actually shows a human face (else 422).
    2. Runs the AI skin analysis and returns scores + recommended concerns
       so the frontend can build a personalised AM/PM routine.
    """
    front = _strip_data_url(payload.front)
    if not front:
        raise HTTPException(status_code=400, detail="Please upload your front selfie first.")

    from services.ai_skin_analyzer import AISkinAnalyzer
    analyzer = AISkinAnalyzer()

    is_human = await analyzer.is_human_face(front)
    if not is_human:
        raise HTTPException(
            status_code=422,
            detail="That doesn't look like a human face, honey 💛 — please upload a clear selfie of your face.",
        )

    analysis = await analyzer.analyze_face_image(front, "front")

    def _s(k):
        try:
            return float(analysis.get(k, 6))
        except Exception:
            return 6.0
    score_keys = ["beauty_score", "aging_score", "acne_score", "dullness_score", "pigmentation_score", "texture_score"]
    avg = sum(_s(k) for k in score_keys) / len(score_keys)
    skin_score = round(avg * 10)

    # Map AI concern -> our concern taxonomy slugs.
    concern_map = {
        "aging": "aging", "acne": "acne-breakouts", "dullness": "brightening-glow",
        "pigmentation": "pigmentation", "texture": "texture-pores",
    }
    primary = (analysis.get("primary_concern") or "").lower()
    rec = []
    if primary in concern_map:
        rec.append(concern_map[primary])
    # add any low-scoring areas as secondary concerns
    if _s("acne_score") <= 5 and "acne-breakouts" not in rec:
        rec.append("acne-breakouts")
    if _s("pigmentation_score") <= 5 and "pigmentation" not in rec:
        rec.append("pigmentation")
    if _s("dullness_score") <= 5 and "brightening-glow" not in rec:
        rec.append("brightening-glow")
    if _s("aging_score") <= 5 and "aging" not in rec:
        rec.append("aging")
    if not rec:
        rec = payload.concerns or ["brightening-glow"]

    return {
        "success": True,
        "is_human": True,
        "skin_score": skin_score,
        "analysis": analysis,
        "primary_concern": primary,
        "skin_type_estimate": analysis.get("skin_type_estimate"),
        "recommended_concerns": rec[:3],
        "personalized_tip": analysis.get("personalized_tip"),
    }


@router.get("/admin/routines")
async def list_routines(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"), limit: int = 200):
    _verify_admin(x_admin_token)
    items = await db.routines.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"routines": items, "count": len(items)}


@router.get("/admin/routines/{rid}")
async def get_routine(rid: str, x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    doc = await db.routines.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Routine not found")
    return doc


# ==================== RETENTION REORDER TAB ====================

@router.get("/admin/retention/reorder")
async def get_reorder_candidates(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    x_employee_token: Optional[str] = Header(None, alias="X-Employee-Token"),
):
    """30-day reorder tab: customers whose last order is between 28-90 days old AND
    haven't already been marked reorder/not_interested in the last 30 days.
    The retention agent calls them, then updates status via /admin/retention/note.
    Customers marked 'reorder' / 'not_interested' will reappear after 30 more days
    so the cycle continues.
    """
    _verify_admin_or_employee(x_admin_token, x_employee_token, permission="retention")
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=90)).isoformat()
    window_end = (now - timedelta(days=28)).isoformat()
    cutoff = (now - timedelta(days=30)).isoformat()

    orders = await db.orders.find({
        "status": {"$in": ["confirmed", "delivered"]},
        "created_at": {"$gte": window_start, "$lte": window_end},
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # group by phone, keep most recent order
    seen = {}
    for o in orders:
        ph = o.get("phone")
        if not ph:
            continue
        if ph not in seen or o.get("created_at", "") > seen[ph].get("created_at", ""):
            seen[ph] = o

    out = []
    for ph, order in seen.items():
        note = await db.retention_notes.find_one({"order_id": order.get("order_id")}, {"_id": 0})
        # Skip rows whose note is fresh (within 30 days) — they're already cycled
        if note and note.get("created_at", "") > cutoff:
            order["retention_note"] = note
            continue
        order["retention_note"] = note
        out.append(order)

    return {"customers": out, "count": len(out)}
