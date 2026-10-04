"""Doctor Consultation booking flow (Feb-2026).

A PAID dermatologist consultation booking flow separate from the existing free
AI skin analysis at /api/consultation/*.

Customer flow:
  1. GET  /api/doctor-consultation/config            → price, doctors, reviews
  2. POST /api/doctor-consultation/create-order      → Razorpay order
  3. POST /api/doctor-consultation/verify-payment    → verify + save booking + email

Admin flow (X-Admin-Token header required):
  • GET    /api/doctor-consultation/admin/config
  • PUT    /api/doctor-consultation/admin/config         → edit price / doctors / reviews
  • GET    /api/doctor-consultation/admin/bookings       → list (with filters)
  • GET    /api/doctor-consultation/admin/bookings/{id}  → single booking
  • PATCH  /api/doctor-consultation/admin/bookings/{id}  → update status / notes
  • POST   /api/doctor-consultation/admin/bookings/{id}/files  → upload photo/PDF
  • DELETE /api/doctor-consultation/admin/bookings/{id}/files/{file_id}
"""
from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader
import razorpay
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field

from services import cloudinary_service as _cs
from services.email_service import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/doctor-consultation", tags=["DoctorConsultation"])

# Will be wired by server.py via setup() — keeps this file decoupled from the
# global db handle + admin auth verifier.
_db = None
_verify_admin_token = None
_razorpay_client: Optional[razorpay.Client] = None


def setup(db, verify_admin_token, razorpay_client: Optional[razorpay.Client] = None):
    global _db, _verify_admin_token, _razorpay_client
    _db = db
    _verify_admin_token = verify_admin_token
    _razorpay_client = razorpay_client


# ---------------------------------------------------------------------------
# Defaults — seeded on first read if no admin_settings document exists.
# ---------------------------------------------------------------------------
DEFAULT_CONFIG: Dict[str, Any] = {
    "price": 999,
    "currency": "INR",
    "title": "Dermatologist Consultation",
    "subtitle": "Personalised skincare backed by certified dermatologists",
    "promise": "30-min one-on-one call · Custom prescription · WhatsApp follow-up",
    "disclaimer": "Consultation fee covers the doctor call & report. Medicine cost (if prescribed) is not included.",
    "doctors": [
        {
            "id": "doc-1",
            "name": "Dr. Ananya Sharma",
            "qualification": "MD Dermatology, AIIMS",
            "experience_years": 12,
            "specialty": "Acne, Pigmentation, Anti-aging",
            "bio": "Senior consultant dermatologist with 12+ years treating Indian skin. Featured in Vogue and Femina.",
            "photo": "",
        },
        {
            "id": "doc-2",
            "name": "Dr. Rohit Menon",
            "qualification": "MBBS, DDVL",
            "experience_years": 8,
            "specialty": "Acne scars, Hair loss, Sensitive skin",
            "bio": "Dermatology fellowship from Apollo. Expertise in non-invasive skin treatments.",
            "photo": "",
        },
        {
            "id": "doc-3",
            "name": "Dr. Priya Iyer",
            "qualification": "MD Skin & VD",
            "experience_years": 6,
            "specialty": "Melasma, Dryness, Post-pregnancy care",
            "bio": "Specialises in hormonal-related skin concerns and pregnancy-safe skincare protocols.",
            "photo": "",
        },
    ],
    "reviews": [
        {"id": "r1", "name": "Sneha R.", "city": "Bengaluru", "rating": 5,
         "text": "The doctor explained every product step by step. My acne cleared in 6 weeks!"},
        {"id": "r2", "name": "Anita P.", "city": "Mumbai", "rating": 5,
         "text": "Worth every rupee. Got a custom routine for my pigmentation."},
        {"id": "r3", "name": "Divya K.", "city": "Hyderabad", "rating": 4,
         "text": "Loved the personal touch. PDF report was easy to follow."},
        {"id": "r4", "name": "Meera S.", "city": "Kochi", "rating": 5,
         "text": "Doctor was patient and answered every question. Highly recommended."},
        {"id": "r5", "name": "Reema T.", "city": "Delhi", "rating": 5,
         "text": "Finally found products that suit my sensitive skin. Thank you Celesta!"},
        {"id": "r6", "name": "Lakshmi V.", "city": "Chennai", "rating": 5,
         "text": "Professional, friendly and effective. The follow-up on WhatsApp was a great bonus."},
    ],
}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class CreateOrderRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: EmailStr
    notes: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class BookingPatch(BaseModel):
    status: Optional[str] = None  # new | scheduled | consulted | closed | cancelled
    doctor_id: Optional[str] = None
    scheduled_at: Optional[str] = None
    admin_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_config() -> Dict[str, Any]:
    """Load config from admin_settings, seeding defaults on first call."""
    doc = await _db.admin_settings.find_one(
        {"type": "doctor_consultation_config"}, {"_id": 0}
    )
    if not doc:
        doc = {"type": "doctor_consultation_config", **DEFAULT_CONFIG,
               "created_at": _now(), "updated_at": _now()}
        await _db.admin_settings.insert_one(dict(doc))
        doc.pop("_id", None)
    doc.pop("type", None)
    return doc


def _admin_email() -> str:
    return (os.environ.get("BUSINESS_EMAIL")
            or os.environ.get("ADMIN_EMAIL")
            or "").strip()


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------
@router.get("/config")
async def public_config():
    """Return the customer-facing consultation page config (no admin notes)."""
    cfg = await _get_config()
    return {
        "price": cfg.get("price", 999),
        "currency": cfg.get("currency", "INR"),
        "title": cfg.get("title"),
        "subtitle": cfg.get("subtitle"),
        "promise": cfg.get("promise"),
        "disclaimer": cfg.get("disclaimer"),
        "doctors": cfg.get("doctors", []),
        "reviews": cfg.get("reviews", []),
        "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", ""),
    }


@router.post("/create-order")
async def create_order(payload: CreateOrderRequest):
    if _razorpay_client is None:
        raise HTTPException(503, "Payment gateway not configured")
    cfg = await _get_config()
    amount_paise = int(cfg.get("price", 999)) * 100
    booking_id = f"dc_{uuid.uuid4().hex[:12]}"
    try:
        rzp_order = _razorpay_client.order.create({
            "amount": amount_paise,
            "currency": cfg.get("currency", "INR"),
            "receipt": booking_id,
            "notes": {"booking_id": booking_id, "type": "doctor_consultation"},
        })
    except Exception as exc:
        logger.error(f"[doctor_consultation] razorpay order create failed: {exc}")
        raise HTTPException(502, "Could not create payment order. Please retry.")

    booking_doc = {
        "id": booking_id,
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "email": payload.email.lower().strip(),
        "notes": (payload.notes or "").strip(),
        "amount": cfg.get("price", 999),
        "currency": cfg.get("currency", "INR"),
        "status": "pending_payment",
        "payment_status": "created",
        "razorpay_order_id": rzp_order.get("id"),
        "razorpay_payment_id": None,
        "doctor_id": None,
        "scheduled_at": None,
        "admin_notes": "",
        "files": [],  # list of {file_id, url, public_id, kind, name, uploaded_at}
        "created_at": _now(),
        "updated_at": _now(),
    }
    await _db.doctor_bookings.insert_one(dict(booking_doc))
    booking_doc.pop("_id", None)
    return {
        "booking_id": booking_id,
        "razorpay_order_id": rzp_order.get("id"),
        "amount": amount_paise,
        "currency": cfg.get("currency", "INR"),
        "key_id": os.environ.get("RAZORPAY_KEY_ID", ""),
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
    }


@router.post("/verify-payment")
async def verify_payment(payload: VerifyPaymentRequest):
    if _razorpay_client is None:
        raise HTTPException(503, "Payment gateway not configured")
    try:
        _razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except Exception:
        await _db.doctor_bookings.update_one(
            {"id": payload.booking_id},
            {"$set": {"payment_status": "failed", "updated_at": _now()}},
        )
        raise HTTPException(400, "Payment signature verification failed")

    booking = await _db.doctor_bookings.find_one({"id": payload.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")

    await _db.doctor_bookings.update_one(
        {"id": payload.booking_id},
        {"$set": {
            "payment_status": "paid",
            "status": "new",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "paid_at": _now(),
            "updated_at": _now(),
        }},
    )

    # Fire-and-forget email notifications. Failures are logged, not raised.
    try:
        await _send_booking_emails(booking, payload.razorpay_payment_id)
    except Exception as exc:
        logger.warning(f"[doctor_consultation] email send failed: {exc}")

    return {"success": True, "booking_id": payload.booking_id,
            "message": "Booking confirmed! Our doctor will call you within 24 hours."}


async def _send_booking_emails(booking: Dict[str, Any], payment_id: str):
    cfg = await _get_config()
    price = cfg.get("price", 999)

    # Customer confirmation
    cust_subject = "Your Dermatologist Consultation is Booked — Celesta Glow"
    cust_text = (
        f"Hi {booking.get('name')},\n\n"
        f"Thank you for booking your dermatologist consultation with Celesta Glow.\n\n"
        f"Booking ID: {booking.get('id')}\n"
        f"Amount Paid: ₹{price}\n"
        f"Payment ID: {payment_id}\n\n"
        f"Our certified dermatologist will call you on +91 {booking.get('phone')} within 24 hours.\n"
        f"Please keep your phone handy and have any previous prescriptions ready.\n\n"
        f"{cfg.get('disclaimer','')}\n\n"
        f"— Team Celesta Glow"
    )
    cust_html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #be185d; margin: 0 0 12px;">Consultation Booked ✓</h2>
      <p>Hi <strong>{booking.get('name')}</strong>,</p>
      <p>Thank you for booking your dermatologist consultation with <strong>Celesta Glow</strong>.</p>
      <div style="background:#fdf2f8; border:1px solid #fbcfe8; border-radius:12px; padding:16px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>Booking ID:</strong> {booking.get('id')}</p>
        <p style="margin:4px 0;"><strong>Amount Paid:</strong> ₹{price}</p>
        <p style="margin:4px 0;"><strong>Payment ID:</strong> {payment_id}</p>
      </div>
      <p>Our certified dermatologist will call you on <strong>+91 {booking.get('phone')}</strong> within 24 hours.</p>
      <p style="font-size:13px; color:#6b7280;">{cfg.get('disclaimer','')}</p>
      <p style="margin-top:24px;">— Team Celesta Glow</p>
    </div>
    """
    await send_email(booking.get("email"), cust_subject, cust_text, cust_html)

    # Admin alert
    admin_to = _admin_email()
    if admin_to:
        admin_subject = f"[New Consultation] {booking.get('name')} — ₹{price}"
        admin_text = (
            f"New dermatologist consultation booked.\n\n"
            f"Name : {booking.get('name')}\n"
            f"Phone: +91 {booking.get('phone')}\n"
            f"Email: {booking.get('email')}\n"
            f"Notes: {booking.get('notes') or '-'}\n\n"
            f"Booking ID: {booking.get('id')}\n"
            f"Amount   : ₹{price}\n"
            f"Payment  : {payment_id}\n"
        )
        admin_html = f"<pre style='font-family:Menlo,monospace;font-size:13px;'>{admin_text}</pre>"
        await send_email(admin_to, admin_subject, admin_text, admin_html)


# ---------------------------------------------------------------------------
# Admin endpoints — protected by X-Admin-Token
# ---------------------------------------------------------------------------
def _check_admin(token: Optional[str]):
    if _verify_admin_token is None:
        raise HTTPException(500, "Admin auth not wired")
    _verify_admin_token(token)


@router.get("/admin/config")
async def admin_get_config(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _check_admin(x_admin_token)
    return await _get_config()


@router.put("/admin/config")
async def admin_update_config(
    payload: Dict[str, Any],
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _check_admin(x_admin_token)
    allowed = {"price", "currency", "title", "subtitle", "promise",
               "disclaimer", "doctors", "reviews"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(400, "Nothing to update")
    if "price" in update:
        try:
            update["price"] = max(1, int(update["price"]))
        except Exception:
            raise HTTPException(400, "price must be a positive integer")
    update["updated_at"] = _now()
    await _db.admin_settings.update_one(
        {"type": "doctor_consultation_config"},
        {"$set": update, "$setOnInsert": {"type": "doctor_consultation_config",
                                          "created_at": _now()}},
        upsert=True,
    )
    return await _get_config()


@router.get("/admin/bookings")
async def admin_list_bookings(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    status: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    _check_admin(x_admin_token)
    filt: Dict[str, Any] = {"payment_status": "paid"}
    if status and status != "all":
        filt["status"] = status
    if q:
        q = q.strip()
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q}},
            {"id": {"$regex": q, "$options": "i"}},
        ]
    cursor = _db.doctor_bookings.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    rows: List[Dict[str, Any]] = []
    async for r in cursor:
        rows.append(r)
    total = await _db.doctor_bookings.count_documents(filt)
    return {"bookings": rows, "total": total}


@router.get("/admin/bookings/{booking_id}")
async def admin_get_booking(
    booking_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _check_admin(x_admin_token)
    row = await _db.doctor_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Booking not found")
    return row


@router.patch("/admin/bookings/{booking_id}")
async def admin_patch_booking(
    booking_id: str,
    payload: BookingPatch,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _check_admin(x_admin_token)
    upd: Dict[str, Any] = {}
    if payload.status is not None:
        if payload.status not in {"new", "scheduled", "consulted", "closed", "cancelled"}:
            raise HTTPException(400, "Invalid status")
        upd["status"] = payload.status
    if payload.doctor_id is not None:
        upd["doctor_id"] = payload.doctor_id
    if payload.scheduled_at is not None:
        upd["scheduled_at"] = payload.scheduled_at
    if payload.admin_notes is not None:
        upd["admin_notes"] = payload.admin_notes
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = _now()
    res = await _db.doctor_bookings.update_one({"id": booking_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Booking not found")
    return await _db.doctor_bookings.find_one({"id": booking_id}, {"_id": 0})


# ---------------------------------------------------------------------------
# Booking file uploads (photos + PDF reports) — go to Cloudinary, with the
# booking_id baked into the public_id so they can be recovered even if the DB
# row is wiped.
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB per file
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_PDF_TYPES = {"application/pdf"}


@router.post("/admin/bookings/{booking_id}/files")
async def admin_upload_file(
    booking_id: str,
    file: UploadFile = File(...),
    kind: str = Form("photo"),  # "photo" | "report"
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _check_admin(x_admin_token)
    if kind not in {"photo", "report"}:
        raise HTTPException(400, "kind must be photo or report")

    booking = await _db.doctor_bookings.find_one({"id": booking_id}, {"_id": 0, "id": 1})
    if not booking:
        raise HTTPException(404, "Booking not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 10 MB limit")

    ctype = (file.content_type or "").lower()
    if kind == "photo" and ctype not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f"Only JPEG/PNG/WebP/HEIC images allowed (got {ctype})")
    if kind == "report" and ctype not in ALLOWED_PDF_TYPES:
        raise HTTPException(400, f"Only PDF reports allowed (got {ctype})")

    if not await _cs.ensure_configured(_db):
        raise HTTPException(503, "Cloudinary not configured")

    file_id = uuid.uuid4().hex[:12]
    public_id = f"{booking_id}-{kind}-{file_id}"
    folder = f"celesta-glow/consultations/{booking_id}"
    resource_type = "image" if kind == "photo" else "raw"

    try:
        res = cloudinary.uploader.upload(
            io.BytesIO(raw),
            folder=folder,
            public_id=public_id,
            resource_type=resource_type,
            overwrite=True,
        )
    except Exception as exc:
        logger.error(f"[doctor_consultation] cloudinary upload failed: {exc}")
        raise HTTPException(502, "Upload failed. Please retry.")

    file_doc = {
        "file_id": file_id,
        "kind": kind,
        "name": file.filename or f"{kind}-{file_id}",
        "url": res.get("secure_url") or res.get("url"),
        "public_id": res.get("public_id"),
        "format": res.get("format"),
        "bytes": res.get("bytes"),
        "resource_type": resource_type,
        "uploaded_at": _now(),
    }
    await _db.doctor_bookings.update_one(
        {"id": booking_id},
        {"$push": {"files": file_doc}, "$set": {"updated_at": _now()}},
    )
    return file_doc


@router.delete("/admin/bookings/{booking_id}/files/{file_id}")
async def admin_delete_file(
    booking_id: str,
    file_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    _check_admin(x_admin_token)
    booking = await _db.doctor_bookings.find_one(
        {"id": booking_id, "files.file_id": file_id},
        {"_id": 0, "files.$": 1},
    )
    if not booking or not booking.get("files"):
        raise HTTPException(404, "File not found")
    target = booking["files"][0]
    # Best-effort delete from Cloudinary (don't block on failure)
    try:
        if await _cs.ensure_configured(_db) and target.get("public_id"):
            cloudinary.uploader.destroy(
                target["public_id"],
                resource_type=target.get("resource_type", "image"),
                invalidate=True,
            )
    except Exception as exc:
        logger.warning(f"[doctor_consultation] cloudinary destroy failed: {exc}")
    await _db.doctor_bookings.update_one(
        {"id": booking_id},
        {"$pull": {"files": {"file_id": file_id}}, "$set": {"updated_at": _now()}},
    )
    return {"success": True}
