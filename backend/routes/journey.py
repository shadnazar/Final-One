"""
Celesta Glow — 30-Day AI Skin Journey (progressive, Gemini-powered).

Public (no login needed) endpoints mounted under /api:
- POST /journey/start                      -> verify face, run Gemini skin analysis, create
                                              journey, generate Day-1 tasks. Returns journey.
- GET  /journey/{jid}                       -> full journey state.
- POST /journey/{jid}/day/{day}/submit      -> face-verified proof upload unlocks the next day;
                                              Gemini generates the next day's tasks (or the Day-30
                                              before/after final report).
- POST /journey/{jid}/subscribe             -> Razorpay order for the next 30 days (auto-pay).
- POST /journey/{jid}/subscribe/verify      -> verify payment, extend paid_until_day += 30.

AI uses the merchant's own Gemini key (GEMINI_API_KEY) via google.genai, model
GEMINI_TEXT_MODEL (default gemini-flash-latest). Every AI call has a safe
rule-based fallback so a transient hiccup never blocks a user's day.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import re
import json
import base64
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
db = None
razorpay_client = None

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "journeys")
GEMINI_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-flash-latest")
JOURNEY_DAYS = 30
SUB_PRICE = int(os.environ.get("TRACKER_MONTHLY_PRICE", "499"))
AD_DAYS = {3, 8, 15, 22, 28}  # days that also surface a product spotlight


def set_db(database):
    global db
    db = database


def set_razorpay(client):
    global razorpay_client
    razorpay_client = client


# ----------------------------- Gemini helpers -----------------------------
def _strip_data_url(s: str) -> str:
    if not s:
        return ""
    if "," in s and s.strip().lower().startswith("data:"):
        return s.split(",", 1)[1]
    return s


def _gem_client():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=key)
    except Exception as e:
        logger.warning(f"[journey] gemini client init failed: {e}")
        return None


def _parse_json(text: str):
    if not text:
        return None
    a, b = text.find("{"), text.rfind("}")
    arr_a, arr_b = text.find("["), text.rfind("]")
    try:
        if a != -1 and b > a:
            return json.loads(text[a:b + 1])
    except Exception:
        pass
    try:
        if arr_a != -1 and arr_b > arr_a:
            return json.loads(text[arr_a:arr_b + 1])
    except Exception:
        pass
    return None


def _gem_text(prompt: str, image_b64: Optional[str] = None) -> Optional[str]:
    client = _gem_client()
    if not client:
        return None
    try:
        from google.genai import types as gtypes
        parts: List[Any] = [prompt]
        if image_b64:
            raw = base64.b64decode(_strip_data_url(image_b64))
            parts.append(gtypes.Part.from_bytes(data=raw, mime_type="image/jpeg"))
        resp = client.models.generate_content(model=GEMINI_MODEL, contents=parts)
        return resp.text
    except Exception as e:
        logger.warning(f"[journey] gemini call failed: {e}")
        return None


def is_human_face(image_b64: str) -> bool:
    """Strict Gemini face gate. Fail-CLOSED on a clear 'false'; fail-open on error."""
    out = _gem_text(
        'Does this photo clearly show a REAL, live human face (not an animal, object, '
        'cartoon, screenshot, empty scene or heavy blur)? Respond ONLY JSON: {"is_human": true|false}',
        image_b64,
    )
    if out is None:
        return True  # transient AI error — don't block a genuine user
    m = re.search(r'"is_human"\s*:\s*(true|false)', out.lower())
    if m:
        return m.group(1) == "true"
    return "true" in out.lower() and "false" not in out.lower()


def analyze_skin(image_b64: str) -> Dict[str, Any]:
    out = _gem_text(
        "You are a dermatologist. Analyse this face selfie. Respond ONLY as JSON with keys: "
        '"skin_score" (0-100 int), "primary_concern" (short phrase), '
        '"concerns" (array of up to 4 short concern words), "summary" (1 warm sentence).',
        image_b64,
    )
    data = _parse_json(out or "") or {}
    try:
        score = int(float(data.get("skin_score", 62)))
    except Exception:
        score = 62
    return {
        "skin_score": max(1, min(100, score)),
        "primary_concern": data.get("primary_concern") or "overall skin health",
        "concerns": data.get("concerns") if isinstance(data.get("concerns"), list) else ["hydration", "texture"],
        "summary": data.get("summary") or "Your skin has good potential — a consistent routine will bring visible glow.",
    }


def _fallback_tasks(day: int, goals: List[str]) -> List[Dict[str, Any]]:
    goal = (goals[0] if goals else "healthy skin").lower()
    return [
        {"id": f"t{day}-1", "time": "Morning · 8:00 AM", "title": "Gentle cleanse",
         "desc": "Wash your face with a mild cleanser and pat dry."},
        {"id": f"t{day}-2", "time": "Morning · 8:05 AM", "title": f"Targeted serum for {goal}",
         "desc": "Apply 3–4 drops of your treatment serum on damp skin."},
        {"id": f"t{day}-3", "time": "Morning · 8:08 AM", "title": "Moisturise + SPF",
         "desc": "Lock in hydration and finish with broad-spectrum sunscreen."},
        {"id": f"t{day}-4", "time": "Night · 9:30 PM", "title": "Night repair",
         "desc": "Cleanse again and apply your night treatment before bed."},
    ]


def generate_day_tasks(day: int, goals: List[str], gender: str, age: str,
                       analysis: Dict[str, Any], prev_summary: str = "") -> List[Dict[str, Any]]:
    prompt = (
        f"You are a dermatologist coaching a {age}-year-old {gender} on a {JOURNEY_DAYS}-day skin journey. "
        f"Goals: {', '.join(goals) or 'healthy glowing skin'}. "
        f"Skin analysis: score {analysis.get('skin_score')}, primary concern {analysis.get('primary_concern')}. "
        f"{('Yesterday: ' + prev_summary) if prev_summary else ''} "
        f"Create the plan for DAY {day}. Return ONLY a JSON array of 3-5 task objects, each with: "
        '"id" (unique string), "time" (e.g. "Morning · 8:00 AM"), "title" (short), "desc" (one practical sentence). '
        "Make it progressive and specific to the day and goals. No extra text."
    )
    out = _gem_text(prompt)
    data = _parse_json(out or "")
    tasks: List[Dict[str, Any]] = []
    if isinstance(data, list):
        for i, t in enumerate(data[:6]):
            if isinstance(t, dict) and (t.get("title")):
                tasks.append({
                    "id": str(t.get("id") or f"t{day}-{i+1}"),
                    "time": str(t.get("time") or "Today"),
                    "title": str(t.get("title"))[:80],
                    "desc": str(t.get("desc") or "")[:240],
                    "done": False,
                })
    if not tasks:
        tasks = [{**t, "done": False} for t in _fallback_tasks(day, goals)]
    return tasks


async def _pick_ad():
    if db is None:
        return None
    try:
        doc = await db.products.find_one(
            {"is_active": True, "is_variation": {"$ne": True}},
            {"_id": 0, "slug": 1, "name": 1, "images": 1, "image": 1, "benefits": 1, "tagline": 1},
            sort=[("reviews_count", -1)],
        )
        if not doc:
            return None
        img = (doc.get("images") or [None])[0] or doc.get("image")
        benefit = (doc.get("benefits") or [doc.get("tagline") or "Dermatologist-formulated for Indian skin"])[0]
        return {"slug": doc.get("slug"), "name": doc.get("name"), "image": img, "benefit": benefit}
    except Exception:
        return None


async def _save_photo(jid: str, name: str, image_b64: str) -> str:
    """Persist a journey photo to Cloudinary and return its PERMANENT URL.

    These used to be written to `backend/uploads/journeys/<jid>/` — the pod's
    disposable disk — so a user's before/after proof silently 404'd after the
    next redeploy. Cloudinary is now the source of truth; the local write is
    kept only as a best-effort cache.
    """
    raw = base64.b64decode(_strip_data_url(image_b64))
    try:
        from services import durable_images
        return await durable_images.save_image(
            db, raw, slug=f"journey-{jid}", tag=name,
            folder="celesta-glow/journeys",
        )
    except Exception as exc:
        logging.error(f"[journey] Cloudinary photo save failed ({jid}/{name}): {exc}")

    # Last-resort local cache so the flow still completes in a dev pod.
    folder = os.path.join(UPLOAD_ROOT, jid)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{name}.jpg")
    with open(path, "wb") as f:
        f.write(raw)
    return f"/api/uploads/journeys/{jid}/{name}.jpg"


# ----------------------------- Models -----------------------------
class StartJourney(BaseModel):
    photo: str
    goals: List[str] = []
    gender: str = ""
    age: str = ""


class SubmitDay(BaseModel):
    proof: str
    completed: List[str] = []


class VerifySub(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ----------------------------- Endpoints -----------------------------
@router.post("/journey/start")
async def start_journey(payload: StartJourney):
    photo = _strip_data_url(payload.photo)
    if not photo:
        raise HTTPException(400, "Please upload your selfie to begin.")
    if not is_human_face(photo):
        raise HTTPException(422, "It is not your face, honey 💛 — please upload a clear selfie of your human face to start.")

    analysis = analyze_skin(photo)
    jid = uuid.uuid4().hex[:12]
    before_url = await _save_photo(jid, "before", photo)
    day1 = generate_day_tasks(1, payload.goals, payload.gender, payload.age, analysis)
    ad = await _pick_ad()

    journey = {
        "id": jid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "goals": payload.goals,
        "gender": payload.gender,
        "age": payload.age,
        "analysis": analysis,
        "before_photo": before_url,
        "after_photo": None,
        "status": "active",
        "current_day": 1,
        "total_days": JOURNEY_DAYS,
        "paid_until_day": JOURNEY_DAYS,  # first 30 days free
        "days": {
            "1": {"day": 1, "tasks": day1, "submitted": False, "proof": None,
                  "ai_note": analysis.get("summary"), "ad": ad if 1 in AD_DAYS else None}
        },
        "report": None,
    }
    await db.journeys.insert_one(dict(journey))
    journey.pop("_id", None)
    return journey


@router.get("/journey/{jid}")
async def get_journey(jid: str):
    doc = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Journey not found.")
    return doc


@router.post("/journey/{jid}/day/{day}/submit")
async def submit_day(jid: str, day: int, payload: SubmitDay):
    doc = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Journey not found.")
    if day != doc.get("current_day"):
        raise HTTPException(400, "You can only submit the current active day.")
    dkey = str(day)
    if doc["days"].get(dkey, {}).get("submitted"):
        raise HTTPException(400, "This day is already submitted.")

    proof = _strip_data_url(payload.proof)
    if not proof:
        raise HTTPException(400, "Please upload today's proof photo with your face.")
    if not is_human_face(proof):
        raise HTTPException(422, "It is not your face, honey 💛 — please upload your face with the proof photo to complete the day.")

    proof_url = await _save_photo(jid, f"day{day}", proof)
    # mark day done
    tasks = doc["days"][dkey]["tasks"]
    for t in tasks:
        t["done"] = t["id"] in (payload.completed or []) or True  # final submit completes the day
    done_titles = ", ".join(t["title"] for t in tasks)

    update: Dict[str, Any] = {
        f"days.{dkey}.submitted": True,
        f"days.{dkey}.proof": proof_url,
        f"days.{dkey}.tasks": tasks,
    }

    result: Dict[str, Any] = {"needs_payment": False, "completed_journey": False}

    if day >= JOURNEY_DAYS:
        # ---- Final Day-30 report + before/after ----
        rep = _gem_text(
            f"A {doc.get('age')} {doc.get('gender')} finished a 30-day skin journey for goals "
            f"{', '.join(doc.get('goals') or [])}. Starting skin score was {doc['analysis'].get('skin_score')}. "
            'Respond ONLY JSON: {"final_score": int, "improvement_percent": int, '
            '"summary": "2 motivating sentences", "wins": ["3 short achievements"]}'
        )
        rd = _parse_json(rep or "") or {}
        start_score = doc["analysis"].get("skin_score", 62)
        final_score = int(rd.get("final_score") or min(98, start_score + 28))
        report = {
            "final_score": final_score,
            "start_score": start_score,
            "improvement_percent": int(rd.get("improvement_percent") or max(1, round((final_score - start_score) / max(1, start_score) * 100))),
            "summary": rd.get("summary") or "Incredible consistency! Your skin looks visibly clearer, brighter and healthier than Day 1.",
            "wins": rd.get("wins") if isinstance(rd.get("wins"), list) else ["Completed all 30 days", "Visible glow boost", "Stronger skin barrier"],
            "before_photo": doc["before_photo"],
            "after_photo": proof_url,
        }
        update["after_photo"] = proof_url
        update["status"] = "completed"
        update["report"] = report
        result["completed_journey"] = True
        result["report"] = report
    else:
        next_day = day + 1
        if next_day > doc.get("paid_until_day", JOURNEY_DAYS):
            # locked behind payment — do NOT generate next day yet
            update["status"] = "locked"
            result["needs_payment"] = True
            result["subscription_price"] = SUB_PRICE
        else:
            ndata = generate_day_tasks(next_day, doc.get("goals", []), doc.get("gender", ""),
                                       doc.get("age", ""), doc["analysis"], prev_summary=done_titles)
            ad = await _pick_ad() if next_day in AD_DAYS else None
            update[f"days.{str(next_day)}"] = {
                "day": next_day, "tasks": ndata, "submitted": False, "proof": None,
                "ai_note": f"Great work on Day {day}! Here's your Day {next_day} plan.", "ad": ad,
            }
            update["current_day"] = next_day
            result["current_day"] = next_day

    await db.journeys.update_one({"id": jid}, {"$set": update})
    fresh = await db.journeys.find_one({"id": jid}, {"_id": 0})
    result["journey"] = fresh
    return result


@router.post("/journey/{jid}/subscribe")
async def subscribe(jid: str):
    doc = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Journey not found.")
    if razorpay_client is None:
        raise HTTPException(500, "Payment gateway not configured.")
    try:
        order = razorpay_client.order.create({
            "amount": SUB_PRICE * 100,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {"journey_id": jid, "purpose": "skin-journey-renewal"},
        })
        return {"order": order, "key_id": os.environ.get("RAZORPAY_KEY_ID"), "amount": SUB_PRICE}
    except Exception as e:
        logger.error(f"[journey] subscribe order failed: {e}")
        raise HTTPException(500, "Could not create payment order.")


@router.post("/journey/{jid}/subscribe/verify")
async def subscribe_verify(jid: str, payload: VerifySub):
    doc = await db.journeys.find_one({"id": jid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Journey not found.")
    if razorpay_client is None:
        raise HTTPException(500, "Payment gateway not configured.")
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except Exception:
        raise HTTPException(400, "Payment verification failed.")

    new_until = int(doc.get("paid_until_day", JOURNEY_DAYS)) + JOURNEY_DAYS
    # unlock the next day immediately
    cur = doc.get("current_day", JOURNEY_DAYS)
    next_day = cur + 1
    update: Dict[str, Any] = {"paid_until_day": new_until, "status": "active"}
    if str(next_day) not in doc["days"] and next_day <= new_until:
        ndata = generate_day_tasks(next_day, doc.get("goals", []), doc.get("gender", ""),
                                   doc.get("age", ""), doc["analysis"], prev_summary="renewed subscription")
        ad = await _pick_ad() if next_day in AD_DAYS else None
        update[f"days.{str(next_day)}"] = {
            "day": next_day, "tasks": ndata, "submitted": False, "proof": None,
            "ai_note": f"Welcome back! Your Day {next_day} plan is ready.", "ad": ad,
        }
        update["current_day"] = next_day
    await db.journeys.update_one({"id": jid}, {"$set": update})
    fresh = await db.journeys.find_one({"id": jid}, {"_id": 0})
    return {"ok": True, "journey": fresh}
