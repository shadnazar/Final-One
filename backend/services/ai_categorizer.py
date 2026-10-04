"""DB-aware AI taxonomy classifier + one-click catalogue audit.

WHY a separate audit (not inline during upload)?
- Bulk upload now stays FAST (no LLM per row).
- After upload, admin clicks one button → background job that:
    1. Loads the CURRENT canonical category / subcategory / concern slugs
       from MongoDB and passes them to Claude as the allowed list.
    2. Classifies every product → matches an existing slug OR proposes a
       brand-new one with clear name + slug + icon + parent link.
    3. Auto-creates the missing rows in `categories`, `subcategories`,
       `concerns` collections with proper metadata.
    4. Updates each product's `niche`, `category`, `subcategory`,
       `concerns` fields so it shows up under the right tab/filter.
- Caches by (brand, name) so re-runs are nearly free.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)


def _slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s[:80] or f"item-{uuid.uuid4().hex[:6]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


VALID_NICHES = {"skin-care", "anti-aging", "skincare", "cosmetics"}

# Hand-curated reference of the user-described storefront layout.
# Sent to the LLM as "examples / preferred clusters" — not strict whitelist.
# Skincare flows: Cleanse · Treat · Moisturize · Protect · Targeted Care · Masks.
SKINCARE_CLUSTERS_HINT = """
Skincare clusters (pick the closest CATEGORY; subcategories are sub-filters):
  Cleanse & Prep: Cleansers, Exfoliators, Toners & Mists, Face Wash & Scrubs
  Treat:         Serums & Treatments, Essences & Ampoules, Spot Treatments
  Moisturize:    Moisturizers, Day Cream, Night Cream, Face Oils, Skin Repair & Barrier Care
  Protect:       Sunscreens
  Targeted Care: Eye Care, Lip Care, Brightening Products, Anti-Aging Products
  Masks & Body:  Masks & Packs, Body Skincare, Body Lotion
"""

# Cosmetics families: Face · Lips · Eyes · Nails · Tools · Kits.
COSMETICS_CLUSTERS_HINT = """
Cosmetics clusters (pick the closest CATEGORY; subcategories are sub-filters like matte/glossy/waterproof/mineral/liquid/cream):
  Face:   Face Primer, Concealer, Foundation, Compact, Contour, Loose Powder,
          Blush, BB & CC Cream, Highlighters, Setting Spray, Makeup Remover,
          Tinted Moisturizer, Bronzer
  Lips:   Lipstick, Liquid Lipstick, Lip Crayon, Lip Gloss, Lip Liner, Lip Tint
  Eyes:   Kajal, Eyeliner, Mascara, Eye Shadow, Eye Brow Enhancers, False Eyelashes
  Nails:  Nail Polish
  Tools:  Makeup Brushes, Sponges & Applicators, Accessories
  Kits:   Kits & Combos
"""


# ============================================================
# DB-aware classifier — loads canonical lists from MongoDB
# ============================================================

class DBAwareCategorizer:
    """Loads existing taxonomy from DB once, then classifies products against it.

    The LLM is told:
      • "Here are the EXISTING category slugs — prefer matching one of these."
      • "If nothing fits, propose a NEW slug + name + icon."
    This is what makes the audit predictable: products land on the slugs that
    are already visible on the storefront whenever possible, and new slugs
    only appear when genuinely needed.
    """

    def __init__(self, db, api_key: Optional[str] = None):
        self.db = db
        self.api_key = api_key or os.environ.get("EMERGENT_LLM_KEY", "")
        self._cache: Dict[Tuple, dict] = {}
        self._cache_lock = asyncio.Lock()
        # Loaded by load_taxonomy()
        self.skincare_cats: List[Dict[str, str]] = []
        self.cosmetics_cats: List[Dict[str, str]] = []
        self.antiaging_cats: List[Dict[str, str]] = []
        self.concerns_by_niche: Dict[str, List[Dict[str, str]]] = {"skincare": [], "cosmetics": [], "anti-aging": []}
        self.subcats_by_parent: Dict[str, List[Dict[str, str]]] = {}

    async def load_taxonomy(self) -> None:
        """Snapshot the current taxonomy from MongoDB."""
        self.skincare_cats = []
        self.cosmetics_cats = []
        self.antiaging_cats = []
        async for c in self.db.categories.find({}, {"_id": 0, "slug": 1, "name": 1, "niche": 1, "icon": 1}):
            row = {"slug": c["slug"], "name": c.get("name", c["slug"]), "icon": c.get("icon", "")}
            niche = (c.get("niche") or "").lower()
            if niche == "cosmetics":
                self.cosmetics_cats.append(row)
            elif niche == "anti-aging":
                self.antiaging_cats.append(row)
            else:
                self.skincare_cats.append(row)

        self.concerns_by_niche = {"skincare": [], "cosmetics": [], "anti-aging": []}
        async for c in self.db.concerns.find({}, {"_id": 0, "slug": 1, "name": 1, "niche": 1}):
            niche = (c.get("niche") or "skincare").lower()
            row = {"slug": c["slug"], "name": c.get("name", c["slug"])}
            self.concerns_by_niche.setdefault(niche, []).append(row)

        self.subcats_by_parent = {}
        async for c in self.db.subcategories.find({}, {"_id": 0, "slug": 1, "name": 1, "parent_category": 1}):
            parent = c.get("parent_category") or ""
            self.subcats_by_parent.setdefault(parent, []).append(
                {"slug": c["slug"], "name": c.get("name", c["slug"])}
            )

        logger.info(
            f"[ai-audit] loaded taxonomy: "
            f"{len(self.skincare_cats)} skincare cats, "
            f"{len(self.cosmetics_cats)} cosmetics cats, "
            f"{len(self.antiaging_cats)} anti-aging cats, "
            f"{sum(len(v) for v in self.concerns_by_niche.values())} concerns, "
            f"{sum(len(v) for v in self.subcats_by_parent.values())} subcategories"
        )

    @staticmethod
    def _cache_key(prod: dict) -> Tuple:
        return (
            (prod.get("brand") or "").lower().strip(),
            (prod.get("name") or "").lower().strip(),
        )

    async def classify(self, prod: dict) -> dict:
        key = self._cache_key(prod)
        async with self._cache_lock:
            if key in self._cache:
                return self._cache[key]
        result = await self._classify_uncached(prod)
        async with self._cache_lock:
            self._cache[key] = result
        return result

    async def _classify_uncached(self, prod: dict) -> dict:
        fallback = self._fallback(prod)
        if not self.api_key:
            return fallback
        try:
            prompt = self._build_prompt(prod)
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"audit-{uuid.uuid4().hex[:8]}",
                system_message=(
                    "You are an expert Indian D2C beauty merchandiser organising a "
                    "shopfront. You return STRICT JSON only. Always prefer matching "
                    "an EXISTING slug over inventing a new one — only propose a new "
                    "slug when nothing in the list reasonably fits the product."
                ),
            ).with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            match = re.search(r"\{[\s\S]*\}", resp or "")
            if not match:
                raise ValueError("No JSON in LLM response")
            data = json.loads(match.group())
            return self._sanitize(data, fallback)
        except Exception as e:
            logger.warning(f"[ai-audit] LLM failed for {prod.get('name')!r}: {e}")
            return fallback

    def _build_prompt(self, prod: dict) -> str:
        skin_list = "\n".join(f"  - {c['slug']}  ({c['name']})" for c in self.skincare_cats) or "  (none yet)"
        cos_list = "\n".join(f"  - {c['slug']}  ({c['name']})" for c in self.cosmetics_cats) or "  (none yet)"
        aa_list = "\n".join(f"  - {c['slug']}  ({c['name']})" for c in self.antiaging_cats) or "  (none yet)"
        existing_concerns_by_niche = []
        for niche in ("skincare", "cosmetics", "anti-aging"):
            items = self.concerns_by_niche.get(niche) or []
            if items:
                existing_concerns_by_niche.append(
                    f"  [{niche}] " + ", ".join(c["slug"] for c in items)
                )
        existing_concerns_text = "\n".join(existing_concerns_by_niche) or "  (none yet)"

        return f"""Classify this product into the storefront taxonomy.

PRODUCT
  Brand: {prod.get('brand', '')}
  Name: {prod.get('name', '')}
  Current niche: {prod.get('niche', '') or 'unknown'}
  Current category slug: {prod.get('category', '') or 'unknown'}
  Current subcategory slug: {prod.get('subcategory', '') or 'unknown'}
  Free-form Excel hints — main_category: {prod.get('main_category_hint', '')}, product_type: {prod.get('product_type_hint', '')}, concern: {prod.get('concern_hint', '')}, skin_type: {prod.get('skin_type_hint', '')}

EXISTING SKINCARE CATEGORIES (prefer matching one of these):
{skin_list}

EXISTING COSMETICS CATEGORIES (prefer matching one of these):
{cos_list}

EXISTING ANTI-AGING CATEGORIES:
{aa_list}

EXISTING CONCERN SLUGS (prefer matching):
{existing_concerns_text}

SITE STRUCTURE HINTS (use this to pick the right cluster if no existing slug fits perfectly):
{SKINCARE_CLUSTERS_HINT}
{COSMETICS_CLUSTERS_HINT}

CLASSIFICATION RULES:
  1. niche = "anti-aging" if the product clearly targets fine lines / wrinkles / firming / retinol / peptides / collagen / 30+ skin.
  2. niche = "cosmetics" for makeup (lipstick, kajal, mascara, foundation, blush, nail polish, brushes, etc).
  3. else niche = "skincare".
  4. category_slug: try HARD to match an existing slug for the chosen niche. Only propose a new one when nothing fits.
  5. subcategory_slug: a finer SUB-FILTER under the category — e.g. matte/glossy/waterproof for makeup, gel/cream/foam for skincare, retinol/peptide/vitamin-c for serums, oily/dry/sensitive for moisturisers. Kebab-case. Can be NEW; can also be empty if no sensible filter applies.
  6. concerns: 1–4 concern slugs the product addresses. Prefer existing slugs; create new ONLY when truly needed (e.g. 'lip-pigmentation', 'split-ends').

Return STRICT JSON only (no markdown fences), exactly:
{{
  "niche": "anti-aging | skincare | cosmetics",
  "category_slug": "kebab-case",
  "category_name": "Title Case",
  "category_is_new": true | false,
  "category_icon": "single emoji",
  "subcategory_slug": "kebab-case or empty",
  "subcategory_name": "Title Case or empty",
  "subcategory_is_new": true | false,
  "subcategory_icon": "single emoji or empty",
  "concerns": [
    {{ "slug": "kebab-case", "name": "Title Case", "is_new": true | false }}
  ],
  "reason": "one-line justification"
}}
"""

    def _sanitize(self, data: dict, fallback: dict) -> dict:
        niche = (data.get("niche") or "").strip().lower()
        if niche not in VALID_NICHES:
            niche = fallback["niche"]

        # Pick category — prefer existing slugs for the chosen niche
        existing_for_niche = {
            "skincare": {c["slug"] for c in self.skincare_cats},
            "cosmetics": {c["slug"] for c in self.cosmetics_cats},
            "anti-aging": {c["slug"] for c in self.antiaging_cats},
        }[niche]
        cat_slug = _slugify(data.get("category_slug") or "")
        cat_name = (data.get("category_name") or "").strip() or cat_slug.replace("-", " ").title()
        if not cat_slug:
            cat_slug = fallback["category_slug"]
            cat_name = fallback["category_name"]
        cat_is_new = bool(data.get("category_is_new")) and (cat_slug not in existing_for_niche)
        cat_icon = (data.get("category_icon") or "").strip()[:4] or ("💄" if niche == "cosmetics" else "🧴")

        sub_slug = _slugify(data.get("subcategory_slug") or "")
        sub_name = (data.get("subcategory_name") or "").strip()
        if sub_slug and not sub_name:
            sub_name = sub_slug.replace("-", " ").title()
        existing_subs = {s["slug"] for s in self.subcats_by_parent.get(cat_slug, [])}
        sub_is_new = bool(data.get("subcategory_is_new")) and (sub_slug not in existing_subs)
        sub_icon = (data.get("subcategory_icon") or "").strip()[:4]

        existing_concern_slugs = {c["slug"] for v in self.concerns_by_niche.values() for c in v}
        concerns_out: List[dict] = []
        seen = set()
        for c in (data.get("concerns") or [])[:6]:
            if not isinstance(c, dict):
                slug = _slugify(str(c))
                name = slug.replace("-", " ").title()
                is_new = slug not in existing_concern_slugs
            else:
                slug = _slugify(c.get("slug") or c.get("name") or "")
                name = (c.get("name") or "").strip() or slug.replace("-", " ").title()
                is_new = bool(c.get("is_new")) and slug not in existing_concern_slugs
            if not slug or slug in seen:
                continue
            seen.add(slug)
            concerns_out.append({"slug": slug, "name": name, "is_new": is_new})

        return {
            "niche": niche,
            "category_slug": cat_slug,
            "category_name": cat_name,
            "category_is_new": cat_is_new,
            "category_icon": cat_icon,
            "subcategory_slug": sub_slug,
            "subcategory_name": sub_name,
            "subcategory_is_new": sub_is_new,
            "subcategory_icon": sub_icon,
            "concerns": concerns_out,
            "ai_used": True,
            "reason": (data.get("reason") or "")[:200],
        }

    def _fallback(self, prod: dict) -> dict:
        """Used when LLM is unavailable — keeps current routing."""
        return {
            "niche": prod.get("niche") or "skincare",
            "category_slug": prod.get("category") or "",
            "category_name": (prod.get("category") or "").replace("-", " ").title(),
            "category_is_new": False,
            "category_icon": "",
            "subcategory_slug": prod.get("subcategory") or "",
            "subcategory_name": (prod.get("subcategory") or "").replace("-", " ").title(),
            "subcategory_is_new": False,
            "subcategory_icon": "",
            "concerns": [{"slug": s, "name": s.replace("-", " ").title(), "is_new": False} for s in (prod.get("concerns") or [])],
            "ai_used": False,
            "reason": "LLM unavailable",
        }


# ============================================================
# Background job manager — survives across endpoint calls
# ============================================================

_audit_jobs: Dict[str, Dict[str, Any]] = {}


def get_audit_job(job_id: str) -> Optional[dict]:
    return _audit_jobs.get(job_id)


def list_audit_jobs() -> List[dict]:
    return sorted(_audit_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)[:50]


async def run_audit_job(
    db,
    job_id: str,
    scope: str,
    niche: Optional[str] = None,
    limit: Optional[int] = None,
    concurrency: int = 6,
    only_missing: bool = True,
) -> None:
    """Run the actual audit in background.

    scope: 'all' | 'niche' | 'needs_taxonomy'
    only_missing: when true, only re-routes products with missing category/concerns
    """
    job = _audit_jobs[job_id]
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    try:
        cat = DBAwareCategorizer(db, api_key=api_key)
        await cat.load_taxonomy()
        job["taxonomy_snapshot"] = {
            "skincare_cats": len(cat.skincare_cats),
            "cosmetics_cats": len(cat.cosmetics_cats),
            "concerns": sum(len(v) for v in cat.concerns_by_niche.values()),
            "subcategories": sum(len(v) for v in cat.subcats_by_parent.values()),
        }

        # Build product query
        q: Dict[str, Any] = {}
        if scope == "niche" and niche:
            q["niche"] = niche
        if only_missing and scope != "all":
            q["$or"] = [
                {"category": {"$in": [None, ""]}},
                {"concerns": {"$size": 0}},
                {"concerns": {"$exists": False}},
                {"ai_taxonomy_audited_at": {"$exists": False}},
            ]

        total = await db.products.count_documents(q)
        if limit:
            total = min(total, limit)
        job["total"] = total
        job["status"] = "running"
        logger.info(f"[ai-audit] job={job_id} scope={scope} matched {total} products")

        sem = asyncio.Semaphore(concurrency)
        created_lock = asyncio.Lock()

        async def process(prod: dict):
            async with sem:
                try:
                    classification = await cat.classify(prod)
                except Exception as e:
                    logger.warning(f"[ai-audit] classify failed for {prod.get('slug')}: {e}")
                    job["failed"] += 1
                    job["errors"].append({"slug": prod.get("slug"), "error": str(e)[:160]})
                    return

                async with created_lock:
                    # Auto-create category if new
                    if classification.get("category_slug") and classification.get("category_is_new"):
                        exists = await db.categories.find_one({"slug": classification["category_slug"]}, {"_id": 1})
                        if not exists:
                            await db.categories.insert_one({
                                "slug": classification["category_slug"],
                                "name": classification["category_name"],
                                "niche": classification["niche"],
                                "group": classification["niche"],
                                "is_parent": False,
                                "tagline": "",
                                "image": "",
                                "icon": classification.get("category_icon") or "🛍️",
                                "sort_order": 99,
                                "is_active": True,
                                "ai_created": True,
                                "created_at": _now(),
                            })
                            job["created_categories"].append(classification["category_slug"])
                            # Refresh cache so next products see it
                            niche_l = classification["niche"]
                            new_row = {"slug": classification["category_slug"], "name": classification["category_name"], "icon": classification.get("category_icon") or ""}
                            if niche_l == "cosmetics":
                                cat.cosmetics_cats.append(new_row)
                            elif niche_l == "anti-aging":
                                cat.antiaging_cats.append(new_row)
                            else:
                                cat.skincare_cats.append(new_row)

                    # Auto-create subcategory if new
                    if classification.get("subcategory_slug") and classification.get("subcategory_is_new"):
                        exists = await db.subcategories.find_one({"slug": classification["subcategory_slug"]}, {"_id": 1})
                        if not exists:
                            await db.subcategories.insert_one({
                                "slug": classification["subcategory_slug"],
                                "name": classification["subcategory_name"],
                                "parent_category": classification["category_slug"],
                                "niche": classification["niche"],
                                "tagline": "",
                                "icon": classification.get("subcategory_icon") or "",
                                "image": "",
                                "sort_order": 0,
                                "is_active": True,
                                "accent_from": "#dcfce7",
                                "accent_to": "#bbf7d0",
                                "accent_text": "#14532d",
                                "ai_created": True,
                                "created_at": _now(),
                                "updated_at": _now(),
                            })
                            job["created_subcategories"].append(classification["subcategory_slug"])
                            cat.subcats_by_parent.setdefault(classification["category_slug"], []).append(
                                {"slug": classification["subcategory_slug"], "name": classification["subcategory_name"]}
                            )

                    # Auto-create concerns
                    for c in classification.get("concerns") or []:
                        if c.get("is_new"):
                            exists = await db.concerns.find_one({"slug": c["slug"]}, {"_id": 1})
                            if not exists:
                                await db.concerns.insert_one({
                                    "slug": c["slug"],
                                    "name": c["name"],
                                    "tagline": "",
                                    "icon": "✨",
                                    "image": "",
                                    "accent_from": "#dcfce7",
                                    "accent_to": "#bbf7d0",
                                    "accent_text": "#14532d",
                                    "description": "",
                                    "sort_order": 99,
                                    "is_active": True,
                                    "niche": classification["niche"],
                                    "ai_created": True,
                                    "created_at": _now(),
                                })
                                job["created_concerns"].append(c["slug"])
                                cat.concerns_by_niche.setdefault(classification["niche"], []).append({"slug": c["slug"], "name": c["name"]})

                # Update product
                upd = {
                    "niche": classification["niche"],
                    "category": classification["category_slug"],
                    "subcategory": classification["subcategory_slug"],
                    "concerns": [c["slug"] for c in classification.get("concerns") or []],
                    "ai_taxonomy_audited_at": _now(),
                    "ai_taxonomy_reason": classification.get("reason", ""),
                    "updated_at": _now(),
                }
                try:
                    await db.products.update_one({"slug": prod["slug"]}, {"$set": upd})
                    job["done"] += 1
                    job["last_slug"] = prod["slug"]
                except Exception as e:
                    logger.warning(f"[ai-audit] update failed for {prod.get('slug')}: {e}")
                    job["failed"] += 1

        # Stream in batches of 200 to avoid huge memory
        cursor = db.products.find(q, {"_id": 0, "slug": 1, "brand": 1, "name": 1, "niche": 1, "category": 1, "subcategory": 1, "concerns": 1, "main_category_hint": 1, "product_type_hint": 1, "concern_hint": 1, "skin_type_hint": 1})
        if limit:
            cursor = cursor.limit(limit)
        batch: List[dict] = []
        async for p in cursor:
            batch.append(p)
            if len(batch) >= 200:
                await asyncio.gather(*[process(x) for x in batch])
                batch.clear()
        if batch:
            await asyncio.gather(*[process(x) for x in batch])

        job["status"] = "completed"
        job["completed_at"] = _now()
    except Exception as e:
        logger.exception(f"[ai-audit] fatal: {e}")
        job["status"] = "failed"
        job["fatal_error"] = str(e)


def create_audit_job(scope: str, niche: Optional[str] = None, limit: Optional[int] = None) -> str:
    job_id = f"audit_{uuid.uuid4().hex[:10]}"
    _audit_jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "scope": scope,
        "niche": niche,
        "limit": limit,
        "total": 0,
        "done": 0,
        "failed": 0,
        "created_categories": [],
        "created_subcategories": [],
        "created_concerns": [],
        "errors": [],
        "last_slug": "",
        "created_at": _now(),
    }
    return job_id


# ============================================================
# Lightweight single-product classifier — used by the
# "AI Analyze" button on the product edit form.
# ============================================================

async def classify_one(db, prod: dict) -> dict:
    cat = DBAwareCategorizer(db)
    await cat.load_taxonomy()
    return await cat.classify(prod)
