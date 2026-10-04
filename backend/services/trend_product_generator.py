"""Trend-Based Product Generator
--------------------------------------------------------------------
Given a blueprint (customer-facing name, description, target keywords,
gallery layout hints, FAQs, base product to clone images from), calls
Gemini via the Emergent LLM key to fill in the gaps — punchy title,
long copy, SEO keywords, trust reviews — and emits a ready-to-persist
product document. The admin only reviews & flips the "Publish" toggle.

The generator NEVER writes to Mongo; it just produces the payload. The
route layer decides whether to persist it as `is_active=False` (hidden)
or `is_active=True` (live).
"""
from __future__ import annotations

import os
import json
import uuid
import re
from datetime import datetime, timezone
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage


class TrendProductGenerator:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")

    async def generate(
        self,
        *,
        blueprint: dict,
        base_slug: Optional[str] = None,
        niche: Optional[str] = None,
    ) -> dict:
        """Build a full product doc from a merchant-supplied blueprint.

        blueprint keys we care about (all optional except `name`):
          - name:                 customer-facing product name
          - internal_name:        R&D / concept codename
          - description:          short pitch (used verbatim as description
                                  after we punch it up with the actives list)
          - hero_ingredient:      "PDRN", "Retinol" etc. — drives keywords
          - target_keywords:      list[str]
          - gallery_slides:       list[dict{title, alt}] — describes each frame
          - faqs:                 list[dict{q, a}]
          - price_mrp / price_prepaid / price_cod
          - category / subcategory
        """
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")

        name = (blueprint.get("name") or "").strip()
        if not name:
            raise ValueError("blueprint.name is required")

        # ---- Clone image gallery from the base product if provided ----
        images: list = []
        if base_slug:
            base = await self.db.products.find_one({"slug": base_slug}, {"_id": 0, "images": 1})
            if base and isinstance(base.get("images"), list):
                images = list(base["images"])

        # ---- Ask Gemini to write the marketing copy + reviews + tags ----
        session_id = f"trend-{uuid.uuid4().hex[:10]}"
        chat = LlmChat(
            api_key=self.api_key,
            session_id=session_id,
            system_message=(
                "You are a senior copywriter for Celesta Glow, a premium Indian "
                "skincare brand. You write luxurious yet science-forward product "
                "copy that converts. Never invent clinical numbers you weren't "
                "given; keep tone warm, confident, dermatologist-approved."
            ),
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            "Create a full e-commerce product listing from this blueprint. "
            "Return ONLY minified JSON (no code fences, no prose) matching this schema:\n"
            "{\n"
            '  "short_name": "punchy 4-6 word variant of the product name",\n'
            '  "tagline": "one crisp sentence under 90 chars",\n'
            '  "description": "3-5 paragraph HTML string with <p> tags, no <html>/<body>",\n'
            '  "highlights": ["6 short bullet points, no leading dash"],\n'
            '  "ingredients": ["hero ingredient", "supporting active 1", "supporting active 2", "supporting active 3"],\n'
            '  "keywords": ["12 SEO keywords tuned for Indian skincare shoppers"],\n'
            '  "image_alts": ["short alt text for slide 1", "for slide 2", "..."],\n'
            '  "faqs": [{"q":"...","a":"..."}, ...],\n'
            '  "reviews": [{"name":"first-name-only","rating":5,"text":"trust-review under 240 chars","location":"Indian city"}, x5]\n'
            "}\n\n"
            f"BLUEPRINT: {json.dumps(blueprint, ensure_ascii=False)}\n"
            f"Number of gallery slides to write alt text for: {len(blueprint.get('gallery_slides') or []) or len(images) or 5}"
        )

        raw = await chat.send_message(UserMessage(text=prompt))
        # Strip accidental code fences or markdown wrappers
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", (raw or "").strip(), flags=re.I)
        try:
            ai = json.loads(text)
        except Exception:
            # Fallback: try to grab the first {...} block
            m = re.search(r"\{[\s\S]+\}", text)
            if not m:
                raise ValueError("Gemini did not return valid JSON")
            ai = json.loads(m.group(0))

        # ---- Compose the final product doc ----
        slug = _slugify(name)
        now_iso = datetime.now(timezone.utc).isoformat()
        price_mrp = float(blueprint.get("price_mrp") or 0)
        price_prepaid = float(blueprint.get("price_prepaid") or price_mrp * 0.85)
        price_cod = float(blueprint.get("price_cod") or price_prepaid)

        # Attach alt keywords per image if we have them
        image_alts = list(ai.get("image_alts") or [])
        image_gallery = []
        for i, url in enumerate(images):
            image_gallery.append({
                "url": url,
                "alt": image_alts[i] if i < len(image_alts) else name,
            })

        doc = {
            "slug": slug,
            "name": name,
            "short_name": ai.get("short_name") or name.split("—")[0].strip(),
            "tagline": ai.get("tagline") or "",
            "internal_name": blueprint.get("internal_name") or "",
            "description": ai.get("description") or blueprint.get("description") or "",
            "highlights": ai.get("highlights") or [],
            "ingredients": ai.get("ingredients") or [],
            "keywords": ai.get("keywords") or (blueprint.get("target_keywords") or []),
            "tags": list({*(ai.get("keywords") or []), *(blueprint.get("target_keywords") or [])})[:20],
            "images": images,                    # Legacy flat list — used by cards
            "image_gallery": image_gallery,      # NEW — with alt-keywords per image
            "faqs": ai.get("faqs") or blueprint.get("faqs") or [],
            "reviews_seed": ai.get("reviews") or [],
            "niche": niche or blueprint.get("niche") or "anti-aging",
            "category": blueprint.get("category") or "serums",
            "subcategory": blueprint.get("subcategory") or "",
            "brand": "Celesta Glow",
            "mrp": price_mrp,
            "prepaid_price": price_prepaid,
            "cod_price": price_cod,
            "discount_percent": round(((price_mrp - price_prepaid) / price_mrp) * 100) if price_mrp else 0,
            "stock_qty": int(blueprint.get("stock_qty") or 50),
            "is_active": False,                  # Trend products land HIDDEN
            "is_to_be_launched": False,
            "generated_by": "trend_product_generator",
            "base_slug": base_slug or None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        return doc


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or f"trend-{uuid.uuid4().hex[:8]}"
