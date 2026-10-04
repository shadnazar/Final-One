"""
Meta Conversions API (CAPI) — server-side event forwarder.

Why: Browser Pixel loses ~30-40% of iOS traffic (ITP, ad-blockers, 3rd-party
cookie deprecation). CAPI ships the same events server-to-server so Meta
still counts them for optimization + attribution. Events fire in parallel
with the browser Pixel and Meta dedups them by (event_name, event_id).

Docs: https://developers.facebook.com/docs/marketing-api/conversions-api/

Config (from .env):
    META_PIXEL_ID              = 690863659974240
    META_CAPI_ACCESS_TOKEN     = EAAO...      (long-lived, keep secret)
    META_CAPI_API_VERSION      = v25.0
    META_CAPI_TEST_EVENT_CODE  = TEST12345    (blank in prod, only for debug)

All PII fields (em, ph, fn, ln, ct, st, zp, external_id) MUST be SHA-256
hashed AFTER normalization (lowercase, no whitespace). Non-PII fields
(client_ip_address, client_user_agent, fbp, fbc) go through raw.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_PIXEL_ID = os.environ.get("META_PIXEL_ID") or ""
_ACCESS_TOKEN = os.environ.get("META_CAPI_ACCESS_TOKEN") or ""
_API_VERSION = os.environ.get("META_CAPI_API_VERSION") or "v25.0"
_TEST_CODE = (os.environ.get("META_CAPI_TEST_EVENT_CODE") or "").strip() or None

_ENABLED = bool(_PIXEL_ID and _ACCESS_TOKEN)


def is_enabled() -> bool:
    return _ENABLED


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _norm_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    return _sha256(email.strip().lower())


def _norm_phone(phone: Optional[str], country_code: str = "91") -> Optional[str]:
    """Meta expects digits only, country code prepended, no `+` or spaces."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    # If the number is 10 digits (typical Indian mobile), prepend the country code.
    if len(digits) == 10:
        digits = country_code + digits
    return _sha256(digits)


def _norm_lower(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return _sha256(re.sub(r"\s+", "", value).lower())


def _norm_zip(zipcode: Optional[str]) -> Optional[str]:
    if not zipcode:
        return None
    # Meta: strip spaces + lowercase (Indian pincodes are digits only anyway)
    return _sha256(str(zipcode).strip().lower())


def build_user_data(
    *,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    pincode: Optional[str] = None,
    country: str = "in",
    external_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbp: Optional[str] = None,
    fbc: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the Meta CAPI `user_data` object. Hashed fields are lists (per spec)."""
    user: Dict[str, Any] = {}

    def _list(v: Optional[str]) -> Optional[List[str]]:
        return [v] if v else None

    hashed_map = {
        "em": _list(_norm_email(email)),
        "ph": _list(_norm_phone(phone)),
        "fn": _list(_norm_lower(first_name)),
        "ln": _list(_norm_lower(last_name)),
        "ct": _list(_norm_lower(city)),
        "st": _list(_norm_lower(state)),
        "zp": _list(_norm_zip(pincode)),
        "country": _list(_sha256(country.strip().lower())) if country else None,
        "external_id": _list(_sha256(str(external_id).strip().lower())) if external_id else None,
    }
    for k, v in hashed_map.items():
        if v:
            user[k] = v

    # Non-hashed fields
    if client_ip:
        user["client_ip_address"] = client_ip
    if client_user_agent:
        user["client_user_agent"] = client_user_agent
    if fbp:
        user["fbp"] = fbp
    if fbc:
        user["fbc"] = fbc

    return user


async def send_event(
    *,
    event_name: str,
    event_id: str,
    user_data: Dict[str, Any],
    custom_data: Optional[Dict[str, Any]] = None,
    event_source_url: Optional[str] = None,
    event_time: Optional[int] = None,
    action_source: str = "website",
) -> Dict[str, Any]:
    """Fire a single CAPI event. Returns Meta's response dict (or {} on failure).

    This is fire-and-forget from the caller's perspective — we swallow all
    exceptions so a downed Meta endpoint can NEVER break checkout.
    """
    if not _ENABLED:
        return {"skipped": True, "reason": "capi_disabled"}

    event: Dict[str, Any] = {
        "event_name": event_name,
        "event_time": int(event_time or time.time()),
        "event_id": event_id,
        "action_source": action_source,
        "user_data": user_data or {},
    }
    if custom_data:
        event["custom_data"] = custom_data
    if event_source_url:
        event["event_source_url"] = event_source_url

    payload: Dict[str, Any] = {"data": [event]}
    if _TEST_CODE:
        payload["test_event_code"] = _TEST_CODE

    url = f"https://graph.facebook.com/{_API_VERSION}/{_PIXEL_ID}/events"

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                url,
                params={"access_token": _ACCESS_TOKEN},
                json=payload,
            )
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"text": resp.text}
            if resp.status_code >= 400:
                logger.warning(
                    "[meta_capi] %s event_id=%s failed status=%s body=%s",
                    event_name, event_id, resp.status_code, body,
                )
                return {"success": False, "status": resp.status_code, "body": body}
            logger.info(
                "[meta_capi] %s event_id=%s ok events_received=%s",
                event_name, event_id, body.get("events_received"),
            )
            return {"success": True, "body": body}
    except Exception as e:  # pragma: no cover — best-effort
        logger.warning("[meta_capi] %s event_id=%s exception: %s", event_name, event_id, e)
        return {"success": False, "error": str(e)}


# ---- Convenience helpers for the standard events ----

async def track_purchase(
    *,
    order_id: str,
    value: float,
    currency: str = "INR",
    contents: Optional[List[Dict[str, Any]]] = None,
    num_items: Optional[int] = None,
    user_data: Dict[str, Any],
    event_source_url: Optional[str] = None,
    content_name: Optional[str] = None,
) -> Dict[str, Any]:
    custom: Dict[str, Any] = {"currency": currency, "value": round(float(value or 0), 2), "order_id": order_id}
    if contents:
        custom["contents"] = contents
        custom["content_ids"] = [c.get("id") for c in contents if c.get("id")]
        custom["content_type"] = "product"
    if num_items:
        custom["num_items"] = num_items
    if content_name:
        custom["content_name"] = content_name
    return await send_event(
        event_name="Purchase",
        event_id=order_id,
        user_data=user_data,
        custom_data=custom,
        event_source_url=event_source_url,
    )


async def track_lead(
    *,
    event_id: str,
    source: str,
    user_data: Dict[str, Any],
    event_source_url: Optional[str] = None,
    value: Optional[float] = None,
) -> Dict[str, Any]:
    custom: Dict[str, Any] = {"lead_source": source, "content_category": "Skincare"}
    if value is not None:
        custom["value"] = round(float(value), 2)
        custom["currency"] = "INR"
    return await send_event(
        event_name="Lead",
        event_id=event_id,
        user_data=user_data,
        custom_data=custom,
        event_source_url=event_source_url,
    )


async def track_initiate_checkout(
    *,
    event_id: str,
    value: float,
    num_items: int,
    contents: Optional[List[Dict[str, Any]]],
    user_data: Dict[str, Any],
    event_source_url: Optional[str] = None,
) -> Dict[str, Any]:
    custom: Dict[str, Any] = {"currency": "INR", "value": round(float(value or 0), 2), "num_items": num_items}
    if contents:
        custom["contents"] = contents
        custom["content_ids"] = [c.get("id") for c in contents if c.get("id")]
        custom["content_type"] = "product"
    return await send_event(
        event_name="InitiateCheckout",
        event_id=event_id,
        user_data=user_data,
        custom_data=custom,
        event_source_url=event_source_url,
    )


async def track_add_to_cart(
    *,
    event_id: str,
    slug: str,
    value: float,
    quantity: int,
    user_data: Dict[str, Any],
    event_source_url: Optional[str] = None,
    content_name: Optional[str] = None,
) -> Dict[str, Any]:
    custom = {
        "currency": "INR",
        "value": round(float(value or 0), 2),
        "content_ids": [slug],
        "content_type": "product",
        "num_items": quantity,
    }
    if content_name:
        custom["content_name"] = content_name
    return await send_event(
        event_name="AddToCart",
        event_id=event_id,
        user_data=user_data,
        custom_data=custom,
        event_source_url=event_source_url,
    )


async def track_view_content(
    *,
    event_id: str,
    slug: str,
    value: float,
    user_data: Dict[str, Any],
    event_source_url: Optional[str] = None,
    content_name: Optional[str] = None,
) -> Dict[str, Any]:
    custom = {
        "currency": "INR",
        "value": round(float(value or 0), 2),
        "content_ids": [slug],
        "content_type": "product",
    }
    if content_name:
        custom["content_name"] = content_name
    return await send_event(
        event_name="ViewContent",
        event_id=event_id,
        user_data=user_data,
        custom_data=custom,
        event_source_url=event_source_url,
    )
