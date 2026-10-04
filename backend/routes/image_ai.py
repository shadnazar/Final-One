"""AI image processing — uses Gemini Nano Banana via Emergent LLM key to remove background."""
import os
import base64
import logging
import uuid
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Form, File, UploadFile
from pydantic import BaseModel
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter()
logger = logging.getLogger(__name__)

# Admin token (imported from env, mirrors server.py)
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "celestaglow2024")

# Shared admin/employee sessions + db (set by server.py)
_admin_sessions: dict = {}
_db = None


def set_admin_sessions(sessions: dict):
    global _admin_sessions
    _admin_sessions = sessions


def set_db(db):
    """Called by server.py so this module can reach Cloudinary via the service layer."""
    global _db
    _db = db


def _verify_admin_token(x_admin_token: Optional[str]):
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if x_admin_token in _admin_sessions:
        return True
    import hashlib as _h
    from services.admin_auth import get_cached_active_admin_hash
    if _h.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


class RemoveBGRequest(BaseModel):
    image_url: str
    mode: Optional[str] = "white"  # "white" | "transparent"


# Upload directory (served by FastAPI via /uploads mount in server.py, or use static)
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "ai_bg"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/admin/ai/remove-bg")
async def remove_background(
    request: RemoveBGRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Remove background from a product image using Gemini Nano Banana.

    Returns a base64 data URL of the processed PNG that the admin UI can
    preview and then save by replacing the product's image URL.
    """
    _verify_admin_token(x_admin_token)

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    # 1. Download the source image
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(request.image_url)
            resp.raise_for_status()
            source_bytes = resp.content
    except Exception as e:
        logger.error(f"Failed to download image: {e}")
        raise HTTPException(status_code=400, detail=f"Could not download image: {str(e)[:120]}")

    if len(source_bytes) > 8 * 1024 * 1024:  # 8 MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")

    src_b64 = base64.b64encode(source_bytes).decode("utf-8")

    # 2. Instruct Gemini Nano Banana to remove background
    bg_desc = (
        "a SOLID, uniform, PURE WHITE background — exactly #FFFFFF (255,255,255) "
        "filling every pixel edge-to-edge, with absolutely NO grey, no off-white, "
        "no gradient, no vignette and no studio backdrop"
        if request.mode == "white"
        else "completely transparent background (alpha channel)"
    )
    prompt = (
        "Edit this image: isolate the main product in the foreground and replace the "
        f"entire background with {bg_desc}. Keep the product crisp, centered, and "
        "photorealistic with natural lighting. Do not add any new elements, shadows, text, "
        "or decorations. The final image must be ONLY the product on a flawless pure-white background."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"bg-remove-{uuid.uuid4().hex[:8]}",
            system_message="You are a professional product-photography background removal tool.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=prompt, file_contents=[ImageContent(src_b64)])
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)[:160]}")

    if not images:
        raise HTTPException(status_code=502, detail="AI did not return an edited image")

    out_img = images[0]
    out_bytes = base64.b64decode(out_img["data"])
    mime = out_img.get("mime_type", "image/png")

    # === Durable storage via Cloudinary ===
    # We NEVER save these to local disk in production — that disk is wiped on
    # every redeploy and the image URL becomes a 404. Same class of bug that
    # bit the product uploads. Cloudinary is the single source of truth.
    public_url = None
    storage = "none"
    if _db is not None:
        try:
            from services import cloudinary_service as _cs
            if await _cs.ensure_configured(_db):
                res = await _cs.upload_image(
                    _db, out_bytes,
                    folder="celesta-glow/ai-bg",
                    public_id=f"bg-{uuid.uuid4().hex[:12]}",
                )
                if res.get("url"):
                    public_url = res["url"]
                    storage = "cloudinary"
        except Exception as exc:
            logger.error(f"AI-BG Cloudinary upload failed: {exc}")

    # Fallback to local disk ONLY if explicitly allowed (dev/preview). In prod
    # we'd rather fail loudly than return a URL that dies on next redeploy.
    allow_local = (os.environ.get("ALLOW_LOCAL_UPLOADS") or "").lower() in ("1", "true", "yes")
    if not public_url:
        if not allow_local:
            # Still return the data URL — the admin UI uses that for instant preview,
            # but we refuse to hand back a persisted URL that will break on redeploy.
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI image storage is not configured. Cloudinary credentials are "
                    "missing — the cleaned image would be lost on the next deploy. "
                    "Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET and redeploy."
                ),
            )
        # Dev-only fallback: local disk
        ext = "png" if "png" in mime else "jpg"
        filename = f"bg-{uuid.uuid4().hex[:12]}.{ext}"
        out_path = UPLOAD_DIR / filename
        with open(out_path, "wb") as f:
            f.write(out_bytes)
        public_url = f"/api/uploads/ai_bg/{filename}"
        storage = "local"

    return {
        "success": True,
        "image_url": public_url,
        "storage": storage,
        "mime_type": mime,
        "size_bytes": len(out_bytes),
        # Also return a data URL fallback for instant preview without cache issues
        "data_url": f"data:{mime};base64,{base64.b64encode(out_bytes).decode('utf-8')}",
    }


# ==================== AI PRODUCT CONTENT GENERATION ====================

class GenerateContentRequest(BaseModel):
    name: str
    niche: Optional[str] = "skincare"
    category: Optional[str] = ""
    concerns: Optional[list] = []
    brand: Optional[str] = "Celesta Glow"
    key_ingredients: Optional[str] = ""


@router.post("/admin/ai/generate-product-content")
async def generate_product_content(
    request: GenerateContentRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Generate full product page content (tagline, description, benefits, how_to_use,
    key_ingredients, ingredients_full, faqs) using Gemini text via Emergent LLM key.

    Returns a structured dict the admin UI can prefill into the product editor.
    """
    _verify_admin_token(x_admin_token)

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    concerns_str = ", ".join(request.concerns or []) or "general skincare"
    brand = request.brand or "Celesta Glow"
    prompt = f"""You are a senior copywriter for "{brand}", an Indian skincare/cosmetics brand. Generate compelling, dermatologist-friendly product page content for the product below.

Product: {request.name}
Niche: {request.niche}
Category: {request.category or 'general'}
Targets concerns: {concerns_str}
Known ingredients (if any): {request.key_ingredients or 'auto-pick suitable actives'}

Return ONLY a JSON object (no markdown, no commentary) with EXACTLY these keys:
{{
  "tagline": "<one short benefit-led tagline, max 12 words>",
  "description": "<2-3 sentence paragraph for the product hero>",
  "key_ingredients": "<comma-separated 3-5 hero actives>",
  "ingredients_full": "<full INCI-style ingredients list (realistic, comma-separated)>",
  "benefits": ["<benefit 1>", "<benefit 2>", "<benefit 3>", "<benefit 4>"],
  "how_to_use": "<3-4 short steps separated by newlines, e.g. 1. Cleanse...\\n2. Apply...>",
  "size": "<typical pack size for this product in INDIAN units, format strictly as 'NNml / N.NN fl oz' for liquids or 'NNg / N.NN oz' for solids — e.g. '30ml / 1.01 fl oz' or '50g / 1.76 oz'>",
  "mrp": <integer Indian MRP in ₹ — typical realistic price for this product type in India, NO currency symbol>,
  "offer_price": <integer ₹ sale price, ~30-40% lower than mrp, NO currency symbol>,
  "brand_suggestion": "<short brand name suggestion if input brand is empty, otherwise repeat input brand>",
  "faqs": [
    {{"q": "<question 1>", "a": "<short answer>"}},
    {{"q": "<question 2>", "a": "<short answer>"}},
    {{"q": "<question 3>", "a": "<short answer>"}},
    {{"q": "<question 4>", "a": "<short answer>"}},
    {{"q": "<question 5>", "a": "<short answer>"}}
  ]
}}

Generate 4-6 genuinely helpful FAQs based on the product name, concern, skin type and description — e.g. "What skin type is this for?", "How long to see results?", "What are the key ingredients?", "Can I use this daily?".
Tone: trustworthy, clinical-but-warm, India-aware (no foreign units except inside the size field which dual-prints both). Avoid hype words like "miracle", "instant cure".
"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"prodgen-{uuid.uuid4().hex[:8]}",
            system_message="You are a precise JSON-only copywriting API for a skincare brand.",
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        msg = UserMessage(text=prompt)
        text_resp = await chat.send_message(msg)
    except Exception as e:
        logger.error(f"AI content generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI content generation failed: {str(e)[:160]}")

    # Parse JSON from response (strip markdown fences if any)
    import json
    import re

    raw = (text_resp or "").strip()
    # Strip ```json ... ``` fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except Exception:
        # Try to extract first JSON object via regex
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise HTTPException(status_code=502, detail="AI returned non-JSON content")
        try:
            data = json.loads(m.group(0))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to parse AI JSON: {str(e)[:100]}")

    # Normalize keys
    return {
        "success": True,
        "tagline": data.get("tagline", ""),
        "description": data.get("description", ""),
        "key_ingredients": data.get("key_ingredients", ""),
        "ingredients_full": data.get("ingredients_full", ""),
        "benefits": data.get("benefits", []) if isinstance(data.get("benefits"), list) else [],
        "how_to_use": data.get("how_to_use", ""),
        "size": data.get("size", ""),
        "mrp": int(data.get("mrp") or 0) if str(data.get("mrp", "")).strip().replace("-", "").isdigit() else 0,
        "offer_price": int(data.get("offer_price") or 0) if str(data.get("offer_price", "")).strip().replace("-", "").isdigit() else 0,
        "brand_suggestion": data.get("brand_suggestion", "") or brand,
        "faqs": data.get("faqs", []) if isinstance(data.get("faqs"), list) else [],
    }



# ==================== AI BANNER GENERATION (category / concern hero images) ====================
# Admins upload an optional reference image + type a prompt; Nano Banana returns
# a freshly-generated banner ready to drop onto the category / concern card.

@router.post("/admin/ai/generate-banner")
async def generate_banner(
    prompt: str = Form(..., description="Describe the banner / hero image you want"),
    reference: Optional[UploadFile] = File(None, description="Optional reference image to guide style/composition"),
    aspect: Optional[str] = Form("square", description="square | landscape | portrait"),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Generate a brand-new banner image for category / concern / hero use.

    Flow:
      1. Admin sends a text prompt + (optional) reference image.
      2. We pipe both into Gemini Nano Banana (image-out modality).
      3. The first returned image is uploaded to Cloudinary and the URL is
         returned so the admin can preview + one-click "Use this image".
    """
    _verify_admin_token(x_admin_token)

    prompt = (prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    if len(prompt) > 1500:
        raise HTTPException(status_code=400, detail="Prompt too long (max 1500 chars)")

    # ---- Build aspect / composition hint ----
    aspect_map = {
        "square":    {"hint": "perfectly square 1:1 framing",                                "w": 1024, "h": 1024},
        "landscape": {"hint": "wide 16:9 landscape framing suited for a hero banner",        "w": 1280, "h": 720},
        "portrait":  {"hint": "tall 3:4 portrait framing",                                   "w": 768,  "h": 1024},
    }
    cfg = aspect_map.get((aspect or "square").lower(), aspect_map["square"])
    aspect_hint = cfg["hint"]

    # ---- Optional reference image (raw bytes for Gemini SDK; for Pollinations
    # we can only pass a text "style hint", since their free API is text-to-image.) ----
    ref_bytes: Optional[bytes] = None
    ref_mime: Optional[str] = None
    if reference is not None:
        raw = await reference.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Reference image too large (max 8 MB)")
        if raw:
            ref_bytes = raw
            ref_mime = reference.content_type or "image/jpeg"

    # Compose final prompt
    full_prompt = (
        f"{prompt}. Photorealistic, high-end skincare / beauty editorial style. "
        f"{aspect_hint}. Clean composition, soft natural lighting, vibrant but tasteful colours. "
        "No text, no logos, no watermarks, no captions, no UI."
    )
    if ref_bytes:
        # Pollinations is text-only, so the user's reference image only serves as a
        # mental anchor here. The prompt is augmented with a style note.
        full_prompt = "Premium product banner inspired by reference imagery. " + full_prompt

    # ---- Provider selection ----
    # 1. Pollinations.ai  (FREE, no key, no quota — DEFAULT)
    # 2. Direct Google Gemini ("gemini-2.5-flash-image") if GEMINI_API_KEY is
    #    present AND has paid quota (free tier 429s instantly).
    # 3. Emergent LLM key fallback (paid via Emergent).
    out_bytes: Optional[bytes] = None
    mime: str = "image/png"

    # --- 1. Pollinations.ai (free, instant, no key) ---
    try:
        import httpx as _httpx
        from urllib.parse import quote as _q
        # `nologo=true` strips the Pollinations watermark. `enhance=true` improves
        # composition. `model=flux` is FLUX-Schnell — high quality, free.
        url = (
            f"https://image.pollinations.ai/prompt/{_q(full_prompt)}"
            f"?width={cfg['w']}&height={cfg['h']}&model=flux&nologo=true&enhance=true&seed={uuid.uuid4().int % 10_000_000}"
        )
        async with _httpx.AsyncClient(timeout=90.0, follow_redirects=True) as _hc:
            r = await _hc.get(url)
            if r.status_code == 200 and r.content and len(r.content) > 1024:
                out_bytes = r.content
                mime = r.headers.get("content-type", "image/jpeg").split(";")[0]
            else:
                logger.warning(f"[banner-ai] Pollinations returned {r.status_code} / {len(r.content)} bytes — will try Gemini fallback")
    except Exception as e:
        logger.warning(f"[banner-ai] Pollinations failed (will try Gemini): {e}")

    # --- 2. Direct Google Gemini (only if Pollinations failed AND a key is set) ---
    if not out_bytes:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            try:
                from google import genai
                from google.genai import types as _gtypes
                _client = genai.Client(api_key=gemini_key)
                parts: list = [full_prompt]
                if ref_bytes:
                    parts.append(_gtypes.Part.from_bytes(data=ref_bytes, mime_type=ref_mime))
                resp = _client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=parts,
                )
                for part in (resp.candidates[0].content.parts if resp.candidates else []):
                    inline = getattr(part, "inline_data", None)
                    if inline and getattr(inline, "data", None):
                        out_bytes = inline.data
                        mime = inline.mime_type or "image/png"
                        break
            except Exception as e:
                logger.warning(f"[banner-ai] Direct Gemini fallback failed: {e}")

    # --- 3. Emergent LLM key fallback ---
    if not out_bytes:
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if emergent_key:
            try:
                file_contents = []
                if ref_bytes:
                    file_contents.append(ImageContent(base64.b64encode(ref_bytes).decode("utf-8")))
                chat = LlmChat(
                    api_key=emergent_key,
                    session_id=f"banner-{uuid.uuid4().hex[:8]}",
                    system_message="You are a skincare-brand visual designer that produces photorealistic, premium banner images.",
                )
                chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
                msg = UserMessage(text=full_prompt, file_contents=file_contents or None)
                _text, images = await chat.send_message_multimodal_response(msg)
                if images:
                    out_bytes = base64.b64decode(images[0]["data"])
                    mime = images[0].get("mime_type", "image/png")
            except Exception as e:
                logger.warning(f"[banner-ai] Emergent fallback failed: {e}")

    if not out_bytes:
        raise HTTPException(
            status_code=502,
            detail="All image-gen providers failed. Try a different prompt, or set GEMINI_API_KEY / EMERGENT_LLM_KEY with quota."
        )

    # ---- Push to Cloudinary (no local-disk fallback in prod) ----
    public_url = None
    storage = "none"
    if _db is not None:
        try:
            from services import cloudinary_service as _cs
            if await _cs.ensure_configured(_db):
                res = await _cs.upload_image(
                    _db, out_bytes,
                    folder="celesta-glow/ai-banner",
                    public_id=f"banner-{uuid.uuid4().hex[:12]}",
                )
                if res.get("url"):
                    public_url = res["url"]
                    storage = "cloudinary"
        except Exception as exc:
            logger.error(f"[banner-ai] Cloudinary upload failed: {exc}")

    allow_local = (os.environ.get("ALLOW_LOCAL_UPLOADS") or "").lower() in ("1", "true", "yes")
    if not public_url:
        if not allow_local:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Cloudinary not configured — generated banner would die on the next "
                    "redeploy. Set CLOUDINARY_* env vars and try again."
                ),
            )
        ext = "png" if "png" in mime else "jpg"
        filename = f"banner-{uuid.uuid4().hex[:12]}.{ext}"
        out_path = UPLOAD_DIR / filename
        with open(out_path, "wb") as f:
            f.write(out_bytes)
        public_url = f"/api/uploads/ai_bg/{filename}"
        storage = "local"

    return {
        "success": True,
        "image_url": public_url,
        "storage": storage,
        "mime_type": mime,
        "size_bytes": len(out_bytes),
    }
