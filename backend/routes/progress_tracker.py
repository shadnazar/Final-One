"""
Celesta Glow — AI Skin Progress Tracker + Razorpay auto-pay subscription.

Customer (email-OTP authenticated) endpoints (mounted under /api):
- GET  /tracker/status                 -> full tracker state: enrolment, plan, days left,
                                           eligibility, today's AI tasks, recent logs, subscription
- POST /tracker/enroll                 -> activate tracker (FREE 1 month if a qualifying order
                                           >= TRACKER_FREE_ORDER_MIN exists, else needs subscription)
- POST /tracker/log                    -> upload daily selfie (Cloudinary) + notes; every 3rd day
                                           an AI improvement suggestion is generated
- GET  /tracker/logs                   -> all daily logs (photos + notes + suggestions)
- POST /tracker/subscribe              -> create a Razorpay recurring subscription (auto-pay ₹499/mo)
- POST /tracker/subscribe/verify       -> verify first subscription payment, mark plan 'paid'

Admin endpoints (X-Admin-Token):
- GET  /admin/trackers                 -> list every customer tracker (with log counts)
- GET  /admin/trackers/{email}         -> full detail incl. photos, notes, AI suggestions, tasks
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import json
import re
import base64
import logging
import hashlib
import secrets
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()
db = None


def set_db(database):
    global db
    db = database


# ---- config ----
TRACKER_PRICE = int(os.environ.get("TRACKER_MONTHLY_PRICE", "499"))
TRACKER_FREE_ORDER_MIN = int(os.environ.get("TRACKER_FREE_ORDER_MIN", "499"))
FREE_DAYS = 30


# ---- razorpay client (lazy) ----
def _rzp():
    kid = os.environ.get("RAZORPAY_KEY_ID")
    ks = os.environ.get("RAZORPAY_KEY_SECRET")
    if not kid or not ks:
        return None
    try:
        import razorpay
        return razorpay.Client(auth=(kid, ks))
    except Exception as e:
        logger.warning(f"[tracker] razorpay init failed: {e}")
        return None


async def _user(authorization: Optional[str]):
    """Reuse the customer-auth session resolver."""
    from routes.customer_auth import _get_session_user
    return await _get_session_user(authorization)


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


def _parse_dt(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


async def _qualifying_order(email: str):
    """Return the first paid/confirmed order for this user worth >= the free threshold."""
    customer = await db.customers.find_one({"email": email}, {"_id": 0}) or {}
    phone = customer.get("phone")
    ors = [{"email": email}]
    if phone:
        ors.append({"phone": phone})
    cursor = db.orders.find({"$or": ors}, {"_id": 0}).sort("created_at", -1).limit(100)
    async for o in cursor:
        amt = o.get("amount") or o.get("total_amount") or 0
        try:
            amt = float(amt)
        except Exception:
            amt = 0
        if amt >= TRACKER_FREE_ORDER_MIN:
            return o
    return None


def _access(tracker: dict):
    """Return (has_access, plan, expires_at, days_left)."""
    if not tracker:
        return False, None, None, 0
    now = _now()
    plan = tracker.get("plan")
    if plan == "free":
        exp = _parse_dt(tracker.get("free_until"))
    elif plan == "paid":
        exp = _parse_dt(tracker.get("paid_until"))
    else:
        exp = None
    if tracker.get("subscription_status") == "active" and plan == "paid":
        # active auto-pay — treat as always-on until cancelled
        return True, plan, _iso(exp) if exp else None, 30
    if exp and exp > now:
        return True, plan, _iso(exp), max(0, (exp - now).days)
    return False, plan, _iso(exp) if exp else None, 0


# =============================================================
# AI helpers
# =============================================================
async def _generate_daily_tasks(tracker: dict, day_number: int) -> list:
    """AI-generate the day's routine + do/don't tasks. Robust static fallback."""
    concerns = ", ".join(tracker.get("concerns") or []) or "healthy glowing skin"
    skin_type = tracker.get("skin_type") or "all skin types"
    age = tracker.get("age") or "adult"
    products = ", ".join(tracker.get("product_names") or []) or "your Celesta Glow products"
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if api_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            prompt = f"""You are a dermatology coach for the Celesta Glow skin tracker.
Create Day {day_number} tasks for a {age} person with {skin_type} skin working on: {concerns}.
They use: {products}.
Return ONLY JSON:
{{
  "focus": "<one-line focus for today, max 10 words>",
  "tasks": [
     {{"type":"use","title":"<what to apply / step>","detail":"<short how, max 16 words>"}},
     {{"type":"care","title":"<a care habit>","detail":"<short why, max 16 words>"}},
     {{"type":"do","title":"<a do>","detail":"<short, max 14 words>"}},
     {{"type":"dont","title":"<a don't>","detail":"<short, max 14 words>"}}
  ]
}}
Give 4-6 tasks. Warm, practical, India-aware. No medical claims."""
            chat = LlmChat(api_key=api_key, session_id=f"tracker-{tracker.get('email','x')[:6]}-{day_number}",
                           system_message="You are a precise JSON-only skincare coaching API.").with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            raw = re.sub(r"^```(?:json)?\s*", "", (resp or "").strip())
            raw = re.sub(r"\s*```$", "", raw)
            m = re.search(r"\{[\s\S]*\}", raw)
            data = json.loads(m.group(0) if m else raw)
            tasks = data.get("tasks") or []
            if tasks:
                return [{"focus": data.get("focus", "")}] + tasks
        except Exception as e:
            logger.warning(f"[tracker] AI task gen failed (day {day_number}): {e}")
    # -------- static fallback --------
    return [
        {"focus": "Consistency builds visible results"},
        {"type": "use", "title": "Cleanse AM & PM", "detail": "Use a gentle cleanser on damp skin, pat dry."},
        {"type": "use", "title": "Apply your serum", "detail": "2-3 drops on clean skin before moisturiser."},
        {"type": "care", "title": "Sunscreen every morning", "detail": "SPF 50, reapply if outdoors."},
        {"type": "do", "title": "Drink 2-3L water", "detail": "Hydration supports the skin barrier."},
        {"type": "dont", "title": "Don't over-exfoliate", "detail": "Max 2x a week to avoid irritation."},
    ]


async def _ai_suggestion(tracker: dict, photo_b64: str, day_number: int) -> dict:
    """Run the skin analyzer on the latest photo and compare with the baseline."""
    try:
        from services.ai_skin_analyzer import AISkinAnalyzer
        analyzer = AISkinAnalyzer()
        raw = photo_b64.split(",", 1)[1] if photo_b64.startswith("data:") and "," in photo_b64 else photo_b64
        analysis = await analyzer.analyze_face_image(raw, "front")

        def _s(k):
            try:
                return float(analysis.get(k, 6))
            except Exception:
                return 6.0
        keys = ["beauty_score", "aging_score", "acne_score", "dullness_score", "pigmentation_score", "texture_score"]
        score = round(sum(_s(k) for k in keys) / len(keys) * 10)
        baseline = tracker.get("baseline_score")
        delta = (score - baseline) if isinstance(baseline, (int, float)) else 0
        tip = analysis.get("personalized_tip") or "Keep going — consistency is the key to visible change."
        trend = "improving" if delta > 0 else ("steady" if delta == 0 else "needs attention")
        return {
            "score": score,
            "baseline_score": baseline,
            "delta": delta,
            "trend": trend,
            "suggestion": f"Day {day_number}: your skin looks {trend}. {tip}",
            "analysis": analysis,
        }
    except Exception as e:
        logger.warning(f"[tracker] AI suggestion failed: {e}")
        return {
            "score": None, "delta": 0, "trend": "steady",
            "suggestion": f"Day {day_number}: great job logging your progress! Stay consistent with your routine.",
        }


# =============================================================
# Customer endpoints
# =============================================================
class EnrollRequest(BaseModel):
    order_id: Optional[str] = None
    skin_type: Optional[str] = None
    age: Optional[str] = None
    concerns: List[str] = []


class LogRequest(BaseModel):
    photo_base64: Optional[str] = None
    notes: Optional[str] = None
    mood: Optional[str] = None


async def _today_tasks(tracker: dict):
    """Fetch (or generate + cache) today's tasks for the tracker."""
    started = _parse_dt(tracker.get("started_at")) or _now()
    day_number = max(1, (_now() - started).days + 1)
    date_key = _now().strftime("%Y-%m-%d")
    existing = await db.tracker_tasks.find_one({"email": tracker["email"], "date": date_key}, {"_id": 0})
    if existing:
        return day_number, existing.get("tasks", [])
    tasks = await _generate_daily_tasks(tracker, day_number)
    await db.tracker_tasks.update_one(
        {"email": tracker["email"], "date": date_key},
        {"$set": {"email": tracker["email"], "date": date_key, "day_number": day_number,
                  "tasks": tasks, "created_at": _iso(_now())}},
        upsert=True,
    )
    return day_number, tasks


@router.get("/tracker/status")
async def tracker_status(authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    email = session["email"]
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0})
    qualifying = await _qualifying_order(email)

    if not tracker:
        return {
            "enrolled": False,
            "eligible_free": bool(qualifying),
            "qualifying_order_id": qualifying.get("order_id") if qualifying else None,
            "price": TRACKER_PRICE,
            "free_order_min": TRACKER_FREE_ORDER_MIN,
        }

    has_access, plan, expires_at, days_left = _access(tracker)
    day_number, tasks = (0, [])
    if has_access:
        day_number, tasks = await _today_tasks(tracker)
    logs = await db.tracker_logs.find({"email": email}, {"_id": 0}).sort("created_at", -1).limit(60).to_list(60)
    return {
        "enrolled": True,
        "has_access": has_access,
        "plan": plan,
        "status": tracker.get("status"),
        "expires_at": expires_at,
        "days_left": days_left,
        "started_at": tracker.get("started_at"),
        "day_number": day_number,
        "today_focus": (tasks[0].get("focus") if tasks and isinstance(tasks[0], dict) and "focus" in tasks[0] else ""),
        "today_tasks": [t for t in tasks if "title" in t],
        "logs": logs,
        "logs_count": len(logs),
        "subscription_status": tracker.get("subscription_status"),
        "eligible_free": bool(qualifying),
        "price": TRACKER_PRICE,
        "free_order_min": TRACKER_FREE_ORDER_MIN,
    }


@router.post("/tracker/enroll")
async def tracker_enroll(req: EnrollRequest, authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    email = session["email"]
    existing = await db.trackers.find_one({"email": email}, {"_id": 0})
    if existing:
        has_access, *_ = _access(existing)
        if has_access:
            return {"success": True, "already": True, "message": "Tracker already active."}

    qualifying = await _qualifying_order(email)
    now = _now()

    # product names from the qualifying order (used to personalise AI tasks)
    product_names = []
    if qualifying:
        for it in (qualifying.get("items") or []):
            nm = it.get("name") or it.get("short_name")
            if nm:
                product_names.append(nm)

    base = {
        "email": email,
        "customer_id": session.get("customer_id"),
        "skin_type": req.skin_type,
        "age": req.age,
        "concerns": req.concerns,
        "product_names": product_names[:8],
        "updated_at": _iso(now),
    }

    # FREE for everyone, always. First month is free; after 30 days the plan
    # shows ₹499/month as *information only* — we never block access or ask to pay.
    base.update({
        "plan": "free",
        "status": "active",
        "started_at": _iso(now),
        "free_until": _iso(now + timedelta(days=FREE_DAYS)),
        "qualifying_order_id": qualifying.get("order_id") if qualifying else None,
        "created_at": _iso(now),
    })
    await db.trackers.update_one({"email": email}, {"$set": base}, upsert=True)
    return {"success": True, "plan": "free", "needs_subscription": False,
            "free_until": base["free_until"],
            "message": "Your free 1-month AI Skin Tracker is active! Upload a photo to get your first analysis."}


@router.post("/tracker/log")
async def tracker_log(req: LogRequest, authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    email = session["email"]
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0})
    if not tracker:
        raise HTTPException(status_code=400, detail="Enroll in the tracker first.")
    has_access, *_ = _access(tracker)
    if not has_access:
        raise HTTPException(status_code=402, detail="Your tracker has expired. Subscribe to continue.")

    started = _parse_dt(tracker.get("started_at")) or _now()
    now = _now()
    day_number = max(1, (now - started).days + 1)

    photo_url = None
    if req.photo_base64:
        try:
            from services import cloudinary_service
            await cloudinary_service.ensure_configured(db)
            raw = req.photo_base64
            if raw.startswith("data:") and "," in raw:
                raw = raw.split(",", 1)[1]
            file_bytes = base64.b64decode(raw)
            pid = f"tracker/{hashlib.md5(email.encode()).hexdigest()[:8]}/day{day_number}-{int(now.timestamp())}"
            up = await cloudinary_service.upload_image(db, file_bytes, folder="celesta-tracker", public_id=pid)
            photo_url = up.get("url")
        except Exception as e:
            logger.warning(f"[tracker] photo upload failed: {e}")
            raise HTTPException(status_code=502, detail="Photo upload failed. Please try again.")

    # set baseline score on first photo
    ai = None
    is_third = (day_number % 3 == 0)
    log_count = await db.tracker_logs.count_documents({"email": email})
    if req.photo_base64 and log_count == 0:
        # baseline analysis (store score, no comparison yet)
        b = await _ai_suggestion({**tracker, "baseline_score": None}, req.photo_base64, day_number)
        if b.get("score") is not None:
            await db.trackers.update_one({"email": email}, {"$set": {"baseline_score": b["score"]}})
            tracker["baseline_score"] = b["score"]
    # every 3rd day -> AI improvement suggestion
    if req.photo_base64 and (is_third or log_count == 0):
        ai = await _ai_suggestion(tracker, req.photo_base64, day_number)

    doc = {
        "id": hashlib.md5(f"{email}{now.timestamp()}".encode()).hexdigest(),
        "email": email,
        "day_number": day_number,
        "date": now.strftime("%Y-%m-%d"),
        "photo_url": photo_url,
        "notes": req.notes,
        "mood": req.mood,
        "ai_suggestion": ai.get("suggestion") if ai else None,
        "ai_score": ai.get("score") if ai else None,
        "ai_delta": ai.get("delta") if ai else None,
        "ai_trend": ai.get("trend") if ai else None,
        "created_at": _iso(now),
    }
    await db.tracker_logs.insert_one(dict(doc))
    doc.pop("_id", None)
    await db.trackers.update_one({"email": email}, {"$set": {"last_log_at": _iso(now)}})
    return {"success": True, "log": doc, "ai_suggestion": doc["ai_suggestion"]}


@router.get("/tracker/logs")
async def tracker_logs(authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    logs = await db.tracker_logs.find({"email": session["email"]}, {"_id": 0}).sort("created_at", -1).to_list(365)
    return {"success": True, "logs": logs, "count": len(logs)}


# =============================================================
# AI Skin Scan — mandatory photo, full report (routine + diet + control)
# =============================================================
CONCERN_MAP = {
    "aging": "aging", "acne": "acne-breakouts", "dullness": "brightening-glow",
    "pigmentation": "pigmentation", "texture": "texture-pores", "hydration": "dryness",
}


async def _recommend_products(concern_slugs: list, limit: int = 4) -> list:
    """Pick active catalog products that target the detected concerns."""
    out, seen = [], set()
    try:
        if concern_slugs:
            cursor = db.products.find(
                {"is_active": True, "is_variation": {"$ne": True},
                 "concerns": {"$in": concern_slugs}},
                {"_id": 0, "slug": 1, "name": 1, "images": 1, "category": 1,
                 "prepaid_price": 1, "mrp": 1},
            ).limit(limit * 2)
            async for p in cursor:
                if p.get("slug") in seen:
                    continue
                seen.add(p.get("slug"))
                imgs = p.get("images") or []
                out.append({
                    "slug": p.get("slug"), "name": p.get("name"),
                    "image": imgs[0] if imgs else None,
                    "category": p.get("category"),
                    "price": p.get("prepaid_price") or p.get("mrp"),
                })
                if len(out) >= limit:
                    break
        if len(out) < limit:
            cursor = db.products.find(
                {"is_active": True, "is_variation": {"$ne": True}},
                {"_id": 0, "slug": 1, "name": 1, "images": 1,
                 "category": 1, "prepaid_price": 1, "mrp": 1}
            ).limit(limit * 2)
            async for p in cursor:
                if p.get("slug") in seen:
                    continue
                seen.add(p.get("slug"))
                imgs = p.get("images") or []
                out.append({
                    "slug": p.get("slug"), "name": p.get("name"),
                    "image": imgs[0] if imgs else None,
                    "category": p.get("category"),
                    "price": p.get("prepaid_price") or p.get("mrp"),
                })
                if len(out) >= limit:
                    break
    except Exception as e:
        logger.warning(f"[tracker] product recommend failed: {e}")
    return out


async def _generate_full_routine(scores: dict, concerns: list, skin_type: str, age: str, products: list) -> dict:
    """Gemini → a complete personalised report: AM/PM routine, diet, what to
    control/avoid, weekly treatments. Robust static fallback."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    prod_line = ", ".join([p.get("name") for p in products if p.get("name")]) or "Celesta Glow cleanser, serum, moisturizer and SPF"
    concern_line = ", ".join(concerns) or "healthy glowing skin"
    if api_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            prompt = f"""You are a dermatology coach for Celesta Glow.
Skin type: {skin_type or 'normal'}. Age: {age or 'adult'}. Concerns: {concern_line}.
AI skin scores (higher=better, 0-100): {json.dumps(scores)}.
Recommend using these products where they fit: {prod_line}.
Return ONLY JSON:
{{
 "summary":"<2 warm sentences on skin state & plan>",
 "am_routine":[{{"step":"<name>","product":"<which product>","how":"<short how, <=14 words>"}}],
 "pm_routine":[{{"step":"<name>","product":"<which product>","how":"<short how, <=14 words>"}}],
 "diet":["<food/drink to eat for this skin, <=12 words>", "..."],
 "control":["<habit/trigger to control or avoid, <=12 words>", "..."],
 "natural_remedies":["<safe home/natural remedy for this skin, <=14 words>", "..."],
 "weekly":["<weekly treatment, <=12 words>"]
}}
3-5 items in each AM/PM, 4-6 diet, 4-6 control, 3-5 natural_remedies, 1-3 weekly. India-aware, practical, no medical claims."""
            chat = LlmChat(api_key=api_key, session_id=f"scan-{secrets_hex()}",
                           system_message="You are a precise JSON-only skincare coaching API.").with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            raw = re.sub(r"^```(?:json)?\s*", "", (resp or "").strip())
            raw = re.sub(r"\s*```$", "", raw)
            m = re.search(r"\{[\s\S]*\}", raw)
            data = json.loads(m.group(0) if m else raw)
            if data.get("am_routine") and data.get("pm_routine"):
                return data
        except Exception as e:
            logger.warning(f"[tracker] full routine gen failed: {e}")
    # -------- static fallback --------
    return {
        "summary": "Your skin is responding well. Stay consistent with a simple AM/PM routine and the diet tips below.",
        "am_routine": [
            {"step": "Cleanse", "product": "Gentle Cleanser", "how": "Lukewarm water, gently massage, pat dry."},
            {"step": "Serum", "product": "Advanced Face Serum", "how": "2-3 drops on damp skin."},
            {"step": "Moisturise", "product": "Day Cream", "how": "Lock in hydration."},
            {"step": "Protect", "product": "SPF 50 Sunscreen", "how": "Two-finger quantity, reapply midday."},
        ],
        "pm_routine": [
            {"step": "Cleanse", "product": "Gentle Cleanser", "how": "Remove sunscreen & grime."},
            {"step": "Treat", "product": "Advanced Retinol Night Cream", "how": "Pea-size, 2-3 nights/week."},
            {"step": "Moisturise", "product": "Night Cream", "how": "Seal the barrier overnight."},
        ],
        "diet": ["Drink 2-3L water daily", "Vitamin-C fruits (amla, orange, guava)",
                 "Omega-3: walnuts, flax, fish", "Green leafy vegetables", "Cut excess sugar & dairy"],
        "control": ["Don't skip sunscreen", "Avoid over-exfoliating (max 2x/week)",
                    "Don't pop pimples", "Limit late nights & stress", "Avoid very hot showers"],
        "natural_remedies": ["Cool aloe vera gel to calm redness", "Green tea compress for puffiness",
                             "Honey mask once a week for hydration", "Rose water as a gentle toner"],
        "weekly": ["Clay mask once a week", "Gentle exfoliation 1-2x/week"],
    }


def secrets_hex():
    return secrets.token_hex(3)


SCAN_KEYS = [
    ("pores", "texture_score"), ("acne", "acne_score"), ("dark_spots", "pigmentation_score"),
    ("even_tone", "dullness_score"), ("fine_lines", "aging_score"), ("hydration", "beauty_score"),
]


class ScanRequest(BaseModel):
    photo_base64: str                      # MANDATORY
    skin_type: Optional[str] = None
    age: Optional[str] = None
    concerns: List[str] = []
    notes: Optional[str] = None
    # Collected on the tracker's own scanning page (post-OTP-login) so the
    # 30-day plan can be built and started in the same submit.
    goals: List[str] = []
    gender: Optional[str] = None
    start_plan: bool = True                # begin the saved 30-day routine plan


@router.post("/tracker/scan")
async def tracker_scan(req: ScanRequest, authorization: Optional[str] = Header(None)):
    """MANDATORY photo scan. Validates a human face, runs Gemini analysis, builds
    a full personalised report (scores + AM/PM routine + recommended products +
    diet + what to control) and SAVES it for the user dashboard AND admin reports."""
    session = await _user(authorization)
    email = session["email"]

    if not req.photo_base64 or not req.photo_base64.strip():
        raise HTTPException(status_code=400, detail="A photo is required to scan your skin. Please upload a clear selfie.")

    # auto-enroll (free) if not yet enrolled
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0})
    now = _now()
    if not tracker:
        tracker = {
            "email": email, "customer_id": session.get("customer_id"),
            "skin_type": req.skin_type, "age": req.age, "concerns": req.concerns,
            "plan": "free", "status": "active", "started_at": _iso(now),
            "free_until": _iso(now + timedelta(days=FREE_DAYS)), "created_at": _iso(now),
            "updated_at": _iso(now),
        }
        await db.trackers.update_one({"email": email}, {"$set": tracker}, upsert=True)

    raw = req.photo_base64
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]

    from services.ai_skin_analyzer import AISkinAnalyzer
    analyzer = AISkinAnalyzer()
    is_human = await analyzer.is_human_face(raw)
    if not is_human:
        raise HTTPException(status_code=422, detail="That doesn't look like a face — please upload a clear selfie of your face.")
    analysis = await analyzer.analyze_face_image(raw, "front")

    def _s(k):
        try:
            return float(analysis.get(k, 6))
        except Exception:
            return 6.0
    scores = {label: round(_s(src) * 10) for label, src in SCAN_KEYS}
    overall = round(sum(scores.values()) / len(scores))

    # detected concerns -> taxonomy slugs
    primary = (analysis.get("primary_concern") or "").lower()
    concern_slugs = []
    if primary in CONCERN_MAP:
        concern_slugs.append(CONCERN_MAP[primary])
    for label, src in SCAN_KEYS:
        if _s(src) <= 5:
            mapped = {"acne": "acne-breakouts", "dark_spots": "pigmentation",
                      "even_tone": "brightening-glow", "fine_lines": "aging",
                      "pores": "texture-pores", "hydration": "dryness"}.get(label)
            if mapped and mapped not in concern_slugs:
                concern_slugs.append(mapped)
    if not concern_slugs:
        concern_slugs = req.concerns or ["brightening-glow"]

    products = await _recommend_products(concern_slugs, limit=4)
    routine = await _generate_full_routine(scores, concern_slugs, req.skin_type or tracker.get("skin_type"),
                                           req.age or tracker.get("age"), products)

    # upload photo to cloudinary (best-effort)
    photo_url = None
    try:
        from services import cloudinary_service
        await cloudinary_service.ensure_configured(db)
        import base64 as _b64
        pid = f"tracker/{hashlib.md5(email.encode()).hexdigest()[:8]}/scan-{int(now.timestamp())}"
        up = await cloudinary_service.upload_image(db, _b64.b64decode(raw), folder="celesta-tracker", public_id=pid)
        photo_url = up.get("url")
    except Exception as e:
        logger.warning(f"[tracker] scan photo upload failed: {e}")

    scan_id = hashlib.md5(f"{email}{now.timestamp()}".encode()).hexdigest()
    report = {
        "id": scan_id, "email": email, "customer_id": session.get("customer_id"),
        "name": session.get("name"), "created_at": _iso(now), "date": now.strftime("%Y-%m-%d"),
        "photo_url": photo_url, "skin_score": overall, "scores": scores,
        "primary_concern": primary, "concerns": concern_slugs,
        "skin_type": req.skin_type or tracker.get("skin_type"),
        "age": req.age or tracker.get("age"),
        "personalized_tip": analysis.get("personalized_tip"),
        "summary": routine.get("summary"),
        "am_routine": routine.get("am_routine", []), "pm_routine": routine.get("pm_routine", []),
        "diet": routine.get("diet", []), "control": routine.get("control", []),
        "natural_remedies": routine.get("natural_remedies", []),
        "weekly": routine.get("weekly", []),
        "recommended_products": products, "notes": req.notes,
    }
    await db.skin_scans.insert_one(dict(report))
    report.pop("_id", None)

    # baseline on first scan
    if tracker.get("baseline_score") is None:
        await db.trackers.update_one({"email": email}, {"$set": {"baseline_score": overall}})

    # ALSO save into db.routines so the existing Admin → Routine Reports shows it
    try:
        await db.routines.insert_one({
            "id": scan_id, "source": "tracker_scan", "email": email,
            "name": session.get("name"), "skin_type": report["skin_type"], "age": report["age"],
            "concerns": concern_slugs, "photo_url": photo_url, "skin_score": overall,
            "skin_score_factors": [{"label": k.replace("_", " ").title(), "score": v} for k, v in scores.items()],
            "am": [{"slot": {"label": s.get("step")}, "product_name": s.get("product")} for s in routine.get("am_routine", [])],
            "pm": [{"slot": {"label": s.get("step")}, "product_name": s.get("product")} for s in routine.get("pm_routine", [])],
            "diet": routine.get("diet", []), "control": routine.get("control", []),
            "natural_remedies": routine.get("natural_remedies", []),
            "weekly": routine.get("weekly", []),
            "recommended_products": products,
            "specialist_notes": [report.get("summary")] if report.get("summary") else [],
            "created_at": _iso(now),
        })
    except Exception as e:
        logger.warning(f"[tracker] routine mirror save failed: {e}")

    # progress log entry (photo + score) for the timeline
    try:
        started = _parse_dt(tracker.get("started_at")) or now
        day_number = max(1, (now - started).days + 1)
        await db.tracker_logs.insert_one({
            "id": scan_id, "email": email, "day_number": day_number,
            "date": now.strftime("%Y-%m-%d"), "photo_url": photo_url,
            "ai_suggestion": report.get("summary"), "ai_score": overall,
            "ai_trend": "scan", "created_at": _iso(now), "scan_id": scan_id,
        })
        await db.trackers.update_one({"email": email}, {"$set": {"last_log_at": _iso(now)}})
    except Exception as e:
        logger.warning(f"[tracker] scan log save failed: {e}")

    # ---- Start (or resume) the saved 30-day routine plan --------------------
    # The plan used to be kicked off from the Routine page before login, which
    # forced an anonymous selfie upload. It now begins HERE, right after the
    # logged-in user submits their scanning details, and is persisted against
    # their email so it survives logout and is resumed on the progress page.
    plan = None
    if req.start_plan:
        try:
            plan = await _ensure_routine_plan(
                email=email,
                goals=req.goals,
                gender=req.gender,
                age=report.get("age"),
                photo_url=photo_url,
                analysis=analysis,
                skin_score=overall,
                routine=routine,
                now=now,
            )
        except Exception as e:
            logger.error(f"[tracker] 30-day plan start failed: {e}", exc_info=True)

    return {"success": True, "report": report, "plan": plan}


async def _ensure_routine_plan(*, email, goals, gender, age, photo_url, analysis,
                               skin_score, routine, now):
    """Create the user's 30-day routine plan, or return the active one.

    Idempotent: one active plan per account, so a repeat scan updates the
    latest reading instead of silently starting a second 30-day cycle.
    """
    existing = await db.routine_plans.find_one(
        {"email": email, "status": "active"}, {"_id": 0}
    )
    if existing:
        await db.routine_plans.update_one(
            {"plan_id": existing["plan_id"]},
            {"$set": {
                "latest_scan_score": skin_score,
                "latest_scan_at": _iso(now),
                "goals": goals or existing.get("goals", []),
                "updated_at": _iso(now),
            }},
        )
        existing.update({"latest_scan_score": skin_score, "latest_scan_at": _iso(now)})
        return existing

    plan_id = uuid.uuid4().hex[:12]
    plan = {
        "plan_id": plan_id,
        "email": email,
        "status": "active",
        "goals": goals or [],
        "gender": gender or "",
        "age": age or "",
        "before_photo": photo_url,
        "baseline_score": skin_score,
        "latest_scan_score": skin_score,
        "latest_scan_at": _iso(now),
        "current_day": 1,
        "total_days": FREE_DAYS,
        "am_routine": routine.get("am_routine", []),
        "pm_routine": routine.get("pm_routine", []),
        "diet": routine.get("diet", []),
        "control": routine.get("control", []),
        "weekly": routine.get("weekly", []),
        "primary_concern": (analysis or {}).get("primary_concern"),
        "started_at": _iso(now),
        "created_at": _iso(now),
        "updated_at": _iso(now),
    }
    await db.routine_plans.insert_one(dict(plan))
    plan.pop("_id", None)
    return plan


@router.get("/tracker/plan")
async def tracker_plan(authorization: Optional[str] = Header(None)):
    """The logged-in user's active 30-day routine plan (resumed on load)."""
    session = await _user(authorization)
    plan = await db.routine_plans.find_one(
        {"email": session["email"], "status": "active"}, {"_id": 0}
    )
    return {"plan": plan}


@router.get("/tracker/scans")
async def tracker_scans(authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    scans = await db.skin_scans.find({"email": session["email"]}, {"_id": 0}).sort("created_at", -1).to_list(120)
    return {"success": True, "scans": scans, "count": len(scans), "latest": scans[0] if scans else None}


# =============================================================
# Daily routine — the "use every day" loop (ticks + daily photo)
# =============================================================
class DayCompleteRequest(BaseModel):
    completed: dict = {}                 # {"am-0": true, "pm-1": true, ...}
    photo_base64: Optional[str] = None
    notes: Optional[str] = None
    mood: Optional[str] = None


@router.get("/tracker/day")
async def tracker_day(authorization: Optional[str] = Header(None)):
    """Today's personalised routine checklist derived from the latest scan,
    plus today's completion state and a 30-day subscription nudge flag."""
    session = await _user(authorization)
    email = session["email"]
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0}) or {}
    latest = await db.skin_scans.find_one({"email": email}, {"_id": 0}, sort=[("created_at", -1)])

    started = _parse_dt(tracker.get("started_at")) or _now()
    now = _now()
    day_number = max(1, (now - started).days + 1)
    date_key = now.strftime("%Y-%m-%d")

    am = (latest or {}).get("am_routine") or []
    pm = (latest or {}).get("pm_routine") or []
    today_doc = await db.tracker_days.find_one({"email": email, "date": date_key}, {"_id": 0}) or {}
    streak = await db.tracker_days.count_documents({"email": email, "any_done": True})

    return {
        "success": True,
        "has_scan": bool(latest),
        "day_number": day_number,
        "date": date_key,
        "am_routine": am,
        "pm_routine": pm,
        "diet": (latest or {}).get("diet", []),
        "control": (latest or {}).get("control", []),
        "natural_remedies": (latest or {}).get("natural_remedies", []),
        "summary": (latest or {}).get("summary"),
        "skin_score": (latest or {}).get("skin_score"),
        "completed": today_doc.get("completed", {}),
        "today_photo": today_doc.get("photo_url"),
        "today_notes": today_doc.get("notes"),
        "streak": streak,
        "subscription_due": day_number > FREE_DAYS,
        "free_days": FREE_DAYS,
        "price": TRACKER_PRICE,
    }


@router.post("/tracker/day/complete")
async def tracker_day_complete(req: DayCompleteRequest, authorization: Optional[str] = Header(None)):
    """Save today's ticked tasks + optional daily photo & notes. Never blocks
    (free forever to use); it only records progress for the dashboard + admin."""
    session = await _user(authorization)
    email = session["email"]
    now = _now()
    date_key = now.strftime("%Y-%m-%d")
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0}) or {}
    started = _parse_dt(tracker.get("started_at")) or now
    day_number = max(1, (now - started).days + 1)

    photo_url = None
    if req.photo_base64:
        try:
            from services import cloudinary_service
            await cloudinary_service.ensure_configured(db)
            import base64 as _b64
            raw = req.photo_base64.split(",", 1)[1] if req.photo_base64.startswith("data:") and "," in req.photo_base64 else req.photo_base64
            pid = f"tracker/{hashlib.md5(email.encode()).hexdigest()[:8]}/day{day_number}-{int(now.timestamp())}"
            up = await cloudinary_service.upload_image(db, _b64.b64decode(raw), folder="celesta-tracker", public_id=pid)
            photo_url = up.get("url")
        except Exception as e:
            logger.warning(f"[tracker] day photo upload failed: {e}")

    any_done = any(bool(v) for v in (req.completed or {}).values())
    set_doc = {
        "email": email, "date": date_key, "day_number": day_number,
        "completed": req.completed or {}, "notes": req.notes, "mood": req.mood,
        "any_done": any_done, "updated_at": _iso(now),
    }
    if photo_url:
        set_doc["photo_url"] = photo_url
    await db.tracker_days.update_one(
        {"email": email, "date": date_key},
        {"$set": set_doc, "$setOnInsert": {"created_at": _iso(now)}},
        upsert=True,
    )

    if photo_url:
        try:
            await db.tracker_logs.insert_one({
                "id": hashlib.md5(f"{email}{now.timestamp()}day".encode()).hexdigest(),
                "email": email, "day_number": day_number, "date": date_key,
                "photo_url": photo_url, "ai_trend": "daily", "notes": req.notes,
                "created_at": _iso(now),
            })
        except Exception:
            pass
    await db.trackers.update_one({"email": email}, {"$set": {"last_log_at": _iso(now)}})
    streak = await db.tracker_days.count_documents({"email": email, "any_done": True})
    return {"success": True, "date": date_key, "day_number": day_number,
            "photo_url": photo_url, "streak": streak,
            "subscription_due": day_number > FREE_DAYS}




# =============================================================
# Razorpay recurring subscription (auto-pay)
# =============================================================
async def _ensure_plan():
    """Return a Razorpay monthly ₹TRACKER_PRICE plan id, creating + caching it once."""
    cfg = await db.admin_settings.find_one({"type": "tracker_plan"}, {"_id": 0}) or {}
    if cfg.get("plan_id") and cfg.get("amount") == TRACKER_PRICE:
        return cfg["plan_id"]
    client = _rzp()
    if not client:
        raise HTTPException(status_code=503, detail="Payments not configured.")
    plan = client.plan.create({
        "period": "monthly",
        "interval": 1,
        "item": {
            "name": "Celesta Glow AI Skin Tracker",
            "amount": TRACKER_PRICE * 100,
            "currency": "INR",
            "description": "Monthly AI skin progress tracking subscription",
        },
    })
    await db.admin_settings.update_one(
        {"type": "tracker_plan"},
        {"$set": {"type": "tracker_plan", "plan_id": plan["id"], "amount": TRACKER_PRICE,
                  "created_at": _iso(_now())}},
        upsert=True,
    )
    return plan["id"]


@router.post("/tracker/subscribe")
async def tracker_subscribe(authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    email = session["email"]
    client = _rzp()
    if not client:
        raise HTTPException(status_code=503, detail="Payments not configured.")
    plan_id = await _ensure_plan()
    sub = client.subscription.create({
        "plan_id": plan_id,
        "customer_notify": 1,
        "quantity": 1,
        "total_count": 12,  # auto-charge monthly for up to 12 months
        "notes": {"email": email, "product": "ai_skin_tracker"},
    })
    await db.trackers.update_one(
        {"email": email},
        {"$set": {"email": email, "customer_id": session.get("customer_id"),
                  "razorpay_subscription_id": sub["id"], "subscription_status": "created",
                  "updated_at": _iso(_now())}},
        upsert=True,
    )
    return {
        "success": True,
        "subscription_id": sub["id"],
        "key_id": os.environ.get("RAZORPAY_KEY_ID"),
        "short_url": sub.get("short_url"),
        "amount": TRACKER_PRICE,
        "customer_email": email,
    }


class SubVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


@router.post("/tracker/subscribe/verify")
async def tracker_subscribe_verify(req: SubVerifyRequest, authorization: Optional[str] = Header(None)):
    session = await _user(authorization)
    email = session["email"]
    client = _rzp()
    if not client:
        raise HTTPException(status_code=503, detail="Payments not configured.")
    try:
        client.utility.verify_payment_signature({
            "razorpay_payment_id": req.razorpay_payment_id,
            "razorpay_subscription_id": req.razorpay_subscription_id,
            "razorpay_signature": req.razorpay_signature,
        })
    except Exception as e:
        logger.warning(f"[tracker] subscription signature verify failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed.")

    now = _now()
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0}) or {}
    upd = {
        "email": email,
        "plan": "paid",
        "status": "active",
        "subscription_status": "active",
        "razorpay_subscription_id": req.razorpay_subscription_id,
        "last_payment_id": req.razorpay_payment_id,
        "paid_until": _iso(now + timedelta(days=31)),
        "updated_at": _iso(now),
    }
    if not tracker.get("started_at"):
        upd["started_at"] = _iso(now)
        upd["created_at"] = _iso(now)
    await db.trackers.update_one({"email": email}, {"$set": upd}, upsert=True)
    return {"success": True, "plan": "paid", "message": "Subscription active — your AI tracker is unlocked!"}


# =============================================================
# Admin endpoints
# =============================================================
def _verify_admin(token: Optional[str]):
    from routes import products
    products.verify_auth(x_admin_token=token)


@router.get("/admin/trackers")
async def admin_list_trackers(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    trackers = await db.trackers.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    out = []
    for t in trackers:
        has_access, plan, expires_at, days_left = _access(t)
        count = await db.tracker_logs.count_documents({"email": t["email"]})
        out.append({
            **t,
            "has_access": has_access,
            "days_left": days_left,
            "logs_count": count,
        })
    return {"trackers": out, "count": len(out)}


@router.get("/admin/trackers/{email}")
async def admin_tracker_detail(email: str, x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    email = email.lower().strip()
    tracker = await db.trackers.find_one({"email": email}, {"_id": 0})
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    logs = await db.tracker_logs.find({"email": email}, {"_id": 0}).sort("created_at", 1).to_list(365)
    tasks = await db.tracker_tasks.find({"email": email}, {"_id": 0}).sort("date", -1).to_list(120)
    has_access, plan, expires_at, days_left = _access(tracker)
    return {
        "tracker": {**tracker, "has_access": has_access, "days_left": days_left, "expires_at": expires_at},
        "logs": logs,
        "tasks": tasks,
    }
