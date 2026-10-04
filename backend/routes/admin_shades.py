"""AI-powered shade color lookup + image upload helpers.

Given a shade name (e.g. "Nude Rose", "Bridal Maroon", "Mauve Mocha"),
returns the closest hex code using Emergent LLM key (gpt-4o-mini).

Includes a fallback table of common Indian cosmetics shade names so the
endpoint stays useful even when the LLM budget is exhausted.
"""
import os
import re
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, UploadFile, File
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/shades", tags=["admin-shades"])

_db = None
_admin_sessions = None


def set_db(db):
    global _db
    _db = db


def set_admin_sessions(s):
    global _admin_sessions
    _admin_sessions = s


def _verify(token: Optional[str]) -> bool:
    if not token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if _admin_sessions is not None and token in _admin_sessions:
        return True
    import hashlib
    from services.admin_auth import get_cached_active_admin_hash
    if hashlib.sha256(token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


# Curated fallback library — keyed by lowercase shade name (or fragment).
# Hand-tuned for Indian cosmetics by category (lipstick / foundation / blush / eye).
FALLBACK_SHADES = {
    # Lipsticks
    "nude": "#c8967e", "nude rose": "#c98a82", "nude pink": "#d49b8d", "nude beige": "#c69680",
    "cherry": "#c83232", "cherry red": "#b81a25", "cherry bomb": "#c83232", "ruby red": "#9b111e",
    "berry": "#9d2356", "berry bliss": "#9d2356", "berry crush": "#7a1f44", "wine": "#722f37", "merlot": "#7b1f30",
    "rose": "#d97783", "rose petal": "#d97783", "rose gold": "#d6a489", "rosy": "#d97a8b",
    "coral": "#e5806f", "coral kiss": "#e5806f", "coral pink": "#ef9a8b", "peach": "#f49b7d", "peach blossom": "#f0a78d",
    "mauve": "#a47887", "mauve mocha": "#8b6271", "mocha": "#7a4a3a", "chocolate": "#5d3a26",
    "bridal red": "#a8232f", "bridal maroon": "#702030", "maroon": "#7c1f26", "burgundy": "#6e1722",
    "plum": "#7b3a55", "plum kiss": "#5d2940", "fuchsia": "#cd2474", "magenta": "#b81a76",
    "orange": "#e87b3a", "tangerine": "#f29b3c", "brick": "#9c4a31", "terracotta": "#a55237",
    "pink": "#e88aa6", "baby pink": "#f7c2cf", "hot pink": "#ed3a73", "pink glow": "#ed7d9d",
    # Foundations / Concealers (Indian undertones)
    "fair": "#f3d4b8", "f1": "#f3d4b8", "f1 - fair": "#f3d4b8", "c1": "#f5d8c0",
    "light": "#e6bd9a", "f2": "#e6bd9a", "f2 - light": "#e6bd9a", "c2": "#e8c1a3",
    "medium": "#d09e7a", "f3": "#d09e7a", "f3 - medium": "#d09e7a", "wheatish": "#cfa386",
    "tan": "#b07c5a", "f4": "#b07c5a", "f4 - tan": "#b07c5a", "honey": "#c19268",
    "deep": "#8a5a3a", "f5": "#8a5a3a", "f5 - deep": "#8a5a3a", "dusky": "#a07350",
    "espresso": "#5a3a26", "ebony": "#3a2618", "caramel": "#a46f47",
    # Blush / cheeks
    "rosewood": "#a86260", "raspberry": "#b03050", "watermelon": "#f55c70", "guava": "#e88880",
    # Eye / kajal / brow
    "jet black": "#111111", "black": "#000000", "smokey": "#3a3a3a", "smokey brown": "#3d2418",
    "taupe": "#6b5841", "medium brown": "#4a3324", "dark brown": "#2b1c13", "soft brown": "#7a5a45",
    "navy": "#1a2a4a", "charcoal": "#2c2c2c", "bronze": "#8c5a2b", "copper": "#b87333",
    "gold": "#d4af37", "champagne": "#ead9b6", "rose gold shimmer": "#d6a489",
    "emerald": "#107c4a", "teal": "#1e6b6b", "purple haze": "#5a3a72",
    # Hair color
    "natural black": "#0d0d0d", "dark brown hair": "#3b2a1c", "burgundy hair": "#5e0f1e", "auburn": "#7c2e1e",
    "honey blonde": "#b08d57", "platinum": "#d3d3d3",
    # Nails
    "classic red": "#c5252e", "pearl white": "#f0eee2", "lavender": "#9a8ec7", "nude nail": "#dab39c",
}


def _lookup_fallback(name: str) -> Optional[str]:
    n = name.lower().strip()
    if n in FALLBACK_SHADES:
        return FALLBACK_SHADES[n]
    # Fragment match — longest key first so "rose gold" beats "rose"
    for key in sorted(FALLBACK_SHADES.keys(), key=lambda x: -len(x)):
        if key in n or n in key:
            return FALLBACK_SHADES[key]
    return None


async def _ai_color_lookup(name: str, category: Optional[str] = None) -> Optional[str]:
    """Ask Emergent LLM (gpt-4o-mini) for the closest hex of a named shade."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        ctx = f" for {category}" if category else ""
        prompt = (
            f'What is the closest hex color code for the cosmetics shade named "{name}"{ctx}? '
            f'This is for an Indian beauty brand serving Indian skin tones (warm undertones, medium-to-deep range). '
            f'Respond with ONLY a single 6-digit hex code starting with #. No explanation. '
            f'Example output: #c98a82'
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"shade-{uuid.uuid4().hex[:8]}",
            system_message="You are an expert cosmetics color matcher. You return ONLY a single hex color code in the format #rrggbb. No other text.",
        ).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt))
        m = re.search(r"#([0-9a-fA-F]{6})", resp)
        if m:
            return "#" + m.group(1).lower()
    except Exception as e:
        logger.warning(f"[shade-ai] LLM lookup failed for '{name}': {e}")
    return None


class ShadeLookupResponse(BaseModel):
    name: str
    hex: str
    source: str  # 'ai' | 'fallback' | 'unknown'


@router.get("/lookup-color", response_model=ShadeLookupResponse)
async def lookup_shade_color(
    name: str = Query(..., min_length=1, max_length=80),
    category: Optional[str] = Query(None),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Return the closest hex code for a named shade.

    Priority: AI (gpt-4o-mini via Emergent LLM key) → curated fallback table → grey default.
    """
    _verify(x_admin_token)
    name_clean = name.strip()

    # Try AI first
    hex_code = await _ai_color_lookup(name_clean, category)
    if hex_code:
        return ShadeLookupResponse(name=name_clean, hex=hex_code, source="ai")

    # Fallback library
    hex_code = _lookup_fallback(name_clean)
    if hex_code:
        return ShadeLookupResponse(name=name_clean, hex=hex_code, source="fallback")

    return ShadeLookupResponse(name=name_clean, hex="#cccccc", source="unknown")


@router.post("/upload-image")
async def upload_shade_image(
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Upload a swatch image for a shade. Stores under /api/uploads/shades/ and returns the public URL.
    Cloudinary path used when configured; local disk otherwise.
    """
    _verify(x_admin_token)

    # Cloudinary if configured
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    if cloud_name:
        try:
            import cloudinary
            import cloudinary.uploader
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=os.environ.get("CLOUDINARY_API_KEY"),
                api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
            )
            contents = await file.read()
            res = cloudinary.uploader.upload(
                contents,
                folder="celesta-glow/shades",
                transformation=[{"width": 400, "height": 400, "crop": "fill"}],
            )
            return {"success": True, "url": res.get("secure_url"), "source": "cloudinary"}
        except Exception as e:
            logger.error(f"[shade-upload] Cloudinary failed: {e}")

    # Local fallback — DEPRECATED: pod-local writes aren't reachable from the
    # public URL in K8s deployments. If Cloudinary is misconfigured we fail
    # loudly instead of silently writing to ephemeral storage. Admin should
    # configure CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.
    raise HTTPException(
        status_code=503,
        detail="Image upload unavailable — Cloudinary is not configured. "
               "Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in admin settings.",
    )


@router.post("/bulk-lookup")
async def bulk_shade_lookup(
    body: dict,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Bulk lookup — pass a list of shade names, returns hex for each."""
    _verify(x_admin_token)
    names = body.get("names", [])
    category = body.get("category")
    if not isinstance(names, list):
        raise HTTPException(status_code=400, detail="names must be a list")
    results = []
    for n in names[:50]:  # cap at 50
        n = str(n).strip()
        if not n:
            continue
        hex_code = _lookup_fallback(n)
        source = "fallback" if hex_code else "unknown"
        if not hex_code:
            ai_hex = await _ai_color_lookup(n, category)
            if ai_hex:
                hex_code = ai_hex
                source = "ai"
            else:
                hex_code = "#cccccc"
        results.append({"name": n, "hex": hex_code, "source": source})
    return {"results": results, "count": len(results)}
