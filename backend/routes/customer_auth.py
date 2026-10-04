"""
Customer Authentication — Email OTP based login.
- POST /api/auth/send-otp   -> sends a 6-digit OTP to the given email (Gmail SMTP)
- POST /api/auth/verify-otp -> verifies OTP, returns session token, creates/updates customer doc
- GET  /api/auth/me         -> returns current user based on bearer token
- POST /api/auth/logout     -> clears server-side session
- GET  /api/auth/orders     -> orders for current session user (by email OR phone)
- POST /api/auth/cart       -> save cart for the logged-in user
- GET  /api/auth/cart       -> load saved cart for the logged-in user
"""
import os
import smtplib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["customer-auth"])

# Will be injected by server.py
_db = None

def init_auth_router(db):
    global _db
    _db = db


# =============================================================
# Models
# =============================================================
class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str
    phone: Optional[str] = None
    name: Optional[str] = None


class SaveCartRequest(BaseModel):
    items: List[Dict[str, Any]] = Field(default_factory=list)


# =============================================================
# Helpers
# =============================================================
async def _send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP via the unified email service — auto-routes to Gmail for the
    first 250 emails/day (IST), then switches to SendGrid. The caller doesn't
    need to know which provider did the work."""
    from services import email_service
    text = (
        f"Your Celesta Glow login code is: {otp}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n"
        f"— Celesta Glow"
    )

    html = f"""<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f8fafc; margin:0; padding:32px 16px;">
  <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.08);">
    <div style="background:linear-gradient(135deg,#047857,#0f766e); padding:24px 28px; color:#ffffff;">
      <h1 style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.01em;">Celesta Glow</h1>
      <p style="margin:4px 0 0; opacity:0.85; font-size:13px;">India's #1 Complete Anti-Aging Solution</p>
    </div>
    <div style="padding:32px 28px 28px;">
      <h2 style="font-size:18px; margin:0 0 8px; color:#0f172a;">Your login code</h2>
      <p style="font-size:14px; color:#475569; margin:0 0 20px;">Enter this 6-digit code on the Celesta Glow site to sign in.</p>
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#064e3b; font-size:30px; font-weight:900; letter-spacing:10px; text-align:center; padding:18px 0; border-radius:12px; font-family:'SF Mono','Menlo',monospace;">
        {otp}
      </div>
      <p style="font-size:12px; color:#94a3b8; margin:18px 0 0; text-align:center;">This code expires in <b>10 minutes</b>.<br/>If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body></html>"""

    result = await email_service.send_email(
        to=to_email,
        subject=f"Your Celesta Glow login code: {otp}",
        text=text,
        html=html,
    )
    if result.get("success"):
        logger.info(f"[OTP] sent to {to_email} via {result.get('channel')}")
        return True
    logger.warning(f"[OTP] failed for {to_email}: {result.get('reason')}")
    return False


async def _get_session_user(authorization: Optional[str]):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    session = await _db.customer_sessions.find_one({"token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    # expire after 30 days
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            # Make timezone-naive datetime from MongoDB timezone-aware
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    return session


# =============================================================
# Endpoints
# =============================================================
@router.post("/send-otp")
async def send_otp(req: SendOtpRequest):
    email = req.email.lower().strip()
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    await _db.customer_otps.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "otp": otp,
            "expires_at": expires,
            "created_at": datetime.now(timezone.utc),
            "attempts": 0,
        }},
        upsert=True,
    )

    sent = await _send_otp_email(email, otp)
    if not sent:
        # SMTP not configured — still return success so dev works, but log.
        logger.warning(f"[OTP] Email NOT sent to {email} — SMTP not configured. OTP: {otp}")
        return {"success": True, "email": email, "delivered": False,
                "message": "OTP generated (email delivery unavailable — check server logs)"}
    return {"success": True, "email": email, "delivered": True,
            "message": "A 6-digit code has been sent to your email. It expires in 10 minutes."}


@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    email = req.email.lower().strip()
    otp = req.otp.strip()

    record = await _db.customer_otps.find_one({"email": email})
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please request a new code.")

    expires_at = record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        # Make timezone-naive datetime from MongoDB timezone-aware
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new code.")

    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")

    if str(record.get("otp")) != otp:
        await _db.customer_otps.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    # Consume OTP
    await _db.customer_otps.delete_one({"email": email})

    # Upsert customer doc
    now = datetime.now(timezone.utc)
    update_doc = {"email": email, "last_login_at": now}
    if req.phone:
        update_doc["phone"] = req.phone[-10:]
    if req.name:
        update_doc["name"] = req.name

    existing = await _db.customers.find_one({"email": email})
    if existing:
        await _db.customers.update_one({"email": email}, {"$set": update_doc})
        customer_id = existing.get("customer_id") or existing.get("_id")
        customer = {**existing, **update_doc, "customer_id": customer_id}
        customer.pop("_id", None)
    else:
        customer_id = f"CUST{secrets.token_hex(4).upper()}"
        customer = {
            "customer_id": customer_id,
            "email": email,
            "phone": update_doc.get("phone"),
            "name": update_doc.get("name"),
            "created_at": now,
            "last_login_at": now,
        }
        await _db.customers.insert_one(dict(customer))
        customer.pop("_id", None)

    # Create session token (30-day)
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    await _db.customer_sessions.insert_one({
        "token": token,
        "email": email,
        "customer_id": customer.get("customer_id"),
        "created_at": now,
        "expires_at": expires,
    })

    return {
        "success": True,
        "token": token,
        "expires_at": expires.isoformat(),
        "user": {
            "customer_id": customer.get("customer_id"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
            "name": customer.get("name"),
        },
    }


@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    customer = await _db.customers.find_one({"email": session["email"]}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"user": {
        "customer_id": customer.get("customer_id"),
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "name": customer.get("name"),
        "addresses": customer.get("addresses", []),
    }}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class AddressItem(BaseModel):
    label: Optional[str] = "Home"
    name: str
    phone: str
    house_number: str
    area: str
    pincode: str
    state: str
    is_default: Optional[bool] = False


@router.patch("/me")
async def update_profile(req: ProfileUpdate, authorization: Optional[str] = Header(None)):
    """B5 AC-1 fix: customer can edit name + phone from /account → Profile tab."""
    session = await _get_session_user(authorization)
    upd = {}
    if req.name is not None:
        upd["name"] = req.name.strip()[:80]
    if req.phone is not None:
        ph = "".join(c for c in req.phone if c.isdigit())[-10:]
        if len(ph) != 10:
            raise HTTPException(status_code=400, detail="Phone must be 10 digits")
        upd["phone"] = ph
    if upd:
        upd["updated_at"] = datetime.now(timezone.utc).isoformat()
        await _db.customers.update_one({"email": session["email"]}, {"$set": upd})
    customer = await _db.customers.find_one({"email": session["email"]}, {"_id": 0})
    return {"success": True, "user": {k: customer.get(k) for k in ("customer_id", "email", "phone", "name", "addresses")}}


@router.get("/addresses")
async def list_addresses(authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    customer = await _db.customers.find_one({"email": session["email"]}, {"_id": 0, "addresses": 1}) or {}
    return {"addresses": customer.get("addresses", [])}


@router.post("/addresses")
async def add_address(addr: AddressItem, authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    addr_dict = addr.model_dump()
    addr_dict["id"] = f"addr_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    addr_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    if addr.is_default:
        # Unset any existing default
        await _db.customers.update_one(
            {"email": session["email"]},
            {"$set": {"addresses.$[].is_default": False}}
        )
    await _db.customers.update_one(
        {"email": session["email"]},
        {"$push": {"addresses": addr_dict}},
        upsert=True,
    )
    return {"success": True, "address": addr_dict}


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    await _db.customers.update_one(
        {"email": session["email"]},
        {"$pull": {"addresses": {"id": address_id}}}
    )
    return {"success": True}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await _db.customer_sessions.delete_one({"token": token})
    return {"success": True}


@router.get("/orders")
async def my_orders(authorization: Optional[str] = Header(None)):
    """Return all orders linked to logged-in user's email OR phone."""
    session = await _get_session_user(authorization)
    email = session["email"]
    customer = await _db.customers.find_one({"email": email}, {"_id": 0}) or {}
    phone = customer.get("phone")

    query = {"$or": [{"email": email}]}
    if phone:
        query["$or"].append({"phone": phone})

    cursor = _db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(100)
    orders = []
    async for o in cursor:
        awb = o.get("awb_number")
        orders.append({
            "order_id": o.get("order_id"),
            "status": o.get("status"),
            "total_amount": o.get("amount"),
            "payment_method": o.get("payment_method"),
            "created_at": o.get("created_at"),
            "items": o.get("items") or [],
            "awb_number": awb,
            "tracking_url": f"https://www.delhivery.com/track/package/{awb}" if awb else None,
            "delivery_timeline": o.get("delivery_timeline"),
        })
    return {"success": True, "orders": orders, "count": len(orders)}


@router.post("/cart")
async def save_cart(req: SaveCartRequest, authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    await _db.customer_carts.update_one(
        {"email": session["email"]},
        {"$set": {
            "email": session["email"],
            "items": req.items,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"success": True, "count": len(req.items)}


@router.get("/cart")
async def get_cart(authorization: Optional[str] = Header(None)):
    session = await _get_session_user(authorization)
    cart = await _db.customer_carts.find_one({"email": session["email"]}, {"_id": 0})
    return {"success": True, "items": (cart or {}).get("items", [])}
