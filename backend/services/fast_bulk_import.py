"""Fast bulk import for ULTRA_GRANULAR_MASTER_LIST.xlsx format.

Differences vs services/bulk_import_service.py:
  • Reads from a SINGLE flat sheet with columns:
      Brand, Item Name, Main Category, Product Type, Concern/Need,
      Skin Type Filter, Market Segment, MRP, Dealer Price,
      Your Profit, Website Listing Price
  • Skips LLM enrichment + image scraping for speed (9700+ rows)
  • Maps the Excel columns directly to product fields:
      Main Category → niche       (cosmetics | skincare)
      Product Type  → category    (slug)
      Concern/Need  → concerns    (list)
      Market Segment→ badges/collection (Best Seller / Luxury / Standard / Daily/Budget)
  • Auto-assigns to a product_group (80 per group, grouped by niche)
  • Dedup by slug — re-uploads skip duplicates
  • Uses Website Listing Price as both prepaid_price and cod_price
"""
from __future__ import annotations
import asyncio
import io
import logging
import math
import os
import random
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Map Main Category → niche slug
NICHE_MAP = {
    "cosmetics": "cosmetics",
    "skincare": "skincare",
    "skin care": "skincare",
}

# Map Excel "Product Type" → category slug used by the storefront (taxonomy_v2).
# All slugs MUST exist in the `categories` collection (taxonomy_v2 active).
PRODUCT_TYPE_TO_CATEGORY = {
    # Skincare — cleanse & prep
    "Cleanser": "cleansers",
    "Face Wash": "cleansers",
    "Face Scrub": "exfoliators",
    "Exfoliator": "exfoliators",
    "Toner": "toners-mists",
    "Face Mist": "toners-mists",
    # Skincare — treat
    "Serum/Ampoule": "serums-treatments",
    "Serum": "serums-treatments",
    "Essence": "essences-ampoules",
    "Ampoule": "essences-ampoules",
    "Spot Treatment": "spot-treatments",
    # Skincare — moisturize
    "Moisturizer/Cream": "moisturizers",
    "Moisturizer": "moisturizers",
    "Day Cream": "moisturizers",
    "Night Cream": "moisturizers",
    "Face Oil": "face-oils",
    # Skincare — protect
    "Sunscreen": "sunscreens",
    # Skincare — targeted care
    "Eye Cream": "eye-care",
    "Eye Care": "eye-care",
    "Lip Balm": "lip-care",
    "Lip Care": "lip-care",
    # Skincare — masks & body
    "Mask": "masks-packs",
    "Sheet Mask": "masks-packs",
    "Hair Oil": "body-skincare",
    "Hair Care": "body-skincare",
    "Shampoo": "body-skincare",
    "Conditioner": "body-skincare",
    "Body Wash": "body-skincare",
    "Body Lotion": "body-skincare",
    "Body Care": "body-skincare",
    "Body Scrub": "body-skincare",
    "Body Butter": "body-skincare",
    # Cosmetics — Face
    "Face Makeup": "face-makeup",
    "Foundation": "foundation",
    "Concealer": "concealer",
    "Face Primer": "face-primer",
    "Primer": "face-primer",
    "Compact Powder": "compact",
    "Compact": "compact",
    "Loose Powder": "loose-powder",
    "Setting Powder": "loose-powder",
    "Blush": "blush",
    "BB Cream": "bb-cc-cream",
    "CC Cream": "bb-cc-cream",
    "Tinted Moisturizer": "tinted-moisturizer",
    "Bronzer": "bronzer",
    "Contour": "contour",
    "Highlighter": "highlighter",
    "Setting Spray": "setting-spray",
    "Makeup Fixer": "setting-spray",
    "Makeup Remover": "makeup-remover",
    # Cosmetics — Lips
    "Lipstick": "lipstick",
    "Lip Color": "lipstick",
    "Liquid Lipstick": "liquid-lipstick",
    "Lip Crayon": "lip-crayon",
    "Lip Gloss": "lip-gloss",
    "Lip Liner": "lip-liner",
    "Lip Tint": "lip-tint",
    # Cosmetics — Eyes
    "Eye Makeup": "eye-shadow",
    "Kajal": "kajal",
    "Eyeliner": "eyeliner",
    "Mascara": "mascara",
    "Eyeshadow": "eye-shadow",
    "Eye Shadow": "eye-shadow",
    "Eye Brow": "eye-brow",
    "Brow": "eye-brow",
    "False Lashes": "false-lashes",
    "False Eyelashes": "false-lashes",
    # Cosmetics — Nails
    "Nail Polish": "nail-polish",
    "Nail Enamel": "nail-polish",
    "Nail": "nail-polish",
    # Cosmetics — Tools & Brushes
    "Makeup Brush": "makeup-brush",
    "Brush": "makeup-brush",
    "Beauty Sponge": "beauty-sponge",
    "Sponge": "beauty-sponge",
    # Cosmetics — Kits
    "Makeup Kit": "makeup-kits",
    "Combo": "makeup-kits",
    # Misc → niche default fallback handled in compose_product_doc()
    "Perfume": "body-skincare",
    "Deodorant": "body-skincare",
    "Fragrance": "body-skincare",
    # "General" intentionally omitted → niche-aware fallback
}

# Map Excel "Concern/Need" → site concern slug
CONCERN_MAP = {
    "Aging": "anti-aging",
    "Anti-Aging": "anti-aging",
    "Pigmentation/Dark Spots": "pigmentation",
    "Acne/Blemishes": "acne-blemishes",
    "Tan/Sun Damage": "sun-damage",
    "General": None,  # No concern
}

# Map Excel "Skin Type Filter" → additional concern slug
SKIN_TYPE_MAP = {
    "Oily/Acne": "oily-skin",
    "Dry": "dryness",
    "Sensitive": "sensitive-skin",
    "General": None,
    "All Skin Types": None,
}

# Map "Market Segment" → badge
SEGMENT_TO_BADGE = {
    "Best Seller": "bestseller",
    "Luxury": "luxury",
    "Standard": "standard",
    "Daily/Budget": "daily",
}


def _slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s[:140] or f"item-{uuid.uuid4().hex[:6]}"


def _safe_int(v, default=0):
    try:
        if pd.isna(v):
            return default
        return int(round(float(v)))
    except Exception:
        return default


def _parse_size(name: str) -> str:
    m = re.search(r"\b(\d+\.?\d*)\s?(ML|GM?|L|OZ|FL\s?OZ)\b", name or "", flags=re.I)
    return f"{m.group(1)} {m.group(2).upper().replace('GM', 'G')}" if m else ""


def _detect_shade_from_name(name: str) -> Optional[str]:
    """Lipsticks / nail polish / eyeshadow rows often have shade in the name itself."""
    n = (name or "").upper()
    # Common shade word pool
    palette = [
        "RED", "PINK", "NUDE", "MAUVE", "BROWN", "BERRY", "ROSE", "CORAL",
        "PEACH", "MAROON", "PLUM", "BURGUNDY", "FUCHSIA", "MAGENTA", "WINE",
        "BLACK", "BLUE", "GREEN", "GOLD", "SILVER", "BRONZE", "COPPER",
        "ORANGE", "PURPLE", "WHITE", "BEIGE", "TAN", "NEUTRAL",
    ]
    found = [w for w in palette if re.search(rf"\b{w}\b", n)]
    return found[0].title() if found else None


def parse_master_excel(content: bytes) -> List[dict]:
    """Parse the ULTRA_GRANULAR_MASTER_LIST.xlsx format.

    Handles two column-naming variants seen in the wild:
      a) Single "Skin Type Filter" column      (original spec)
      b) Separate "Skin Type" + "Filter" cols  (ULTRA_GRANULAR_MASTER_LIST.xlsx Jan 2026)
    Also reads ALL sheets in the workbook (some uploads split rows across sheets).
    """
    xls = pd.ExcelFile(io.BytesIO(content))
    frames = []
    for sheet_name in xls.sheet_names:
        try:
            df_sheet = pd.read_excel(xls, sheet_name=sheet_name, dtype=object)
            df_sheet.columns = [str(c).strip() for c in df_sheet.columns]
            # Skip sheets that don't have an "Item Name" column
            if "Item Name" not in df_sheet.columns:
                continue
            frames.append(df_sheet)
        except Exception as e:
            logger.warning(f"[fast-import] skip sheet '{sheet_name}': {e}")
    if not frames:
        return []
    df = pd.concat(frames, ignore_index=True, sort=False)
    df.columns = [str(c).strip() for c in df.columns]
    rows: List[dict] = []
    for _, r in df.iterrows():
        name = r.get("Item Name")
        if pd.isna(name) or not str(name).strip():
            continue
        brand = str(r.get("Brand") or "").strip()
        # Fallback brand extraction (Excel missing Brand col):
        # First 1–2 capitalised tokens of the product name (stop on common nouns)
        if not brand:
            tokens = re.findall(r"[A-Za-z0-9&]+", str(name).strip())
            if tokens:
                stop = {"face", "skin", "cream", "serum", "wash", "lotion", "spf", "oil", "lip", "eye", "anti", "night", "day", "mask", "toner", "balm", "scrub", "gel", "foam", "cleanser", "moisturizer", "moisturiser", "sunscreen", "lipstick", "kajal", "mascara", "eyeliner", "foundation", "concealer", "primer", "compact", "blush", "highlighter", "powder", "for", "with", "the"}
                picked = []
                for t in tokens[:2]:
                    if t.lower() in stop:
                        break
                    picked.append(t)
                brand = " ".join(picked).strip() or tokens[0]
        main_cat = str(r.get("Main Category") or "").strip().lower()
        product_type = str(r.get("Product Type") or "").strip()
        concern_raw = str(r.get("Concern/Need") or "").strip()
        # Accept both old "Skin Type Filter" combined column and new separate "Skin Type" col
        skin_type = str(
            r.get("Skin Type Filter") or r.get("Skin Type") or ""
        ).strip()
        # "Filter" col (Best Seller / Luxury / Standard) acts as a fallback for Market Segment
        filter_col = str(r.get("Filter") or "").strip()
        segment = str(r.get("Market Segment") or "").strip() or filter_col
        mrp = _safe_int(r.get("MRP"))
        dealer = _safe_int(r.get("Dealer Price"))
        listing = _safe_int(r.get("Website Listing Price"))
        profit = _safe_int(r.get("Your Profit"))
        # If no price at all, treat as a placeholder row — still import with synthetic price
        if mrp <= 0 and listing <= 0:
            # Synthetic placeholder price so admin can edit later (avoid dropping rows silently)
            listing = 499
            mrp = 549
        # Fallback listing price = MRP * 0.95 if missing
        if listing <= 0 and mrp > 0:
            listing = int(round(mrp * 0.95))
        if mrp <= 0:
            mrp = int(round(listing * 1.1))
        rows.append({
            "brand": brand,
            "name": str(name).strip(),
            "main_category": main_cat,
            "product_type": product_type,
            "concern": concern_raw,
            "skin_type": skin_type,
            "segment": segment,
            "mrp": mrp,
            "dealer_price": dealer,
            "listing_price": listing,
            "profit": profit,
        })
    return rows


def compose_product_doc(row: dict, group_id: str, group_index: int, ai: Optional[dict] = None) -> dict:
    """Build product doc from one Excel row — no LLM, no scraping (speed).

    When `ai` (from AICategorizer) is provided, override niche/category/
    subcategory/concerns with the canonical AI routing.
    """
    name = row["name"].strip().title()
    brand = (row["brand"] or "").title()
    slug_base = f"{row['brand']}-{row['name']}"
    slug = _slugify(slug_base)

    if ai:
        niche = ai["niche"]
        category = ai["category_slug"]
        subcategory_slug = ai.get("subcategory_slug") or ""
        # AI concerns override Excel ones
        ai_concerns = [c["slug"] for c in (ai.get("concerns") or []) if c.get("slug")]
        # Also keep Excel-derived concerns as fallback if AI returned none
        concerns = ai_concerns or []
    else:
        niche = NICHE_MAP.get(row["main_category"], "skincare")
        default_cat = "moisturizers" if niche == "skincare" else "face-makeup"
        pt = row["product_type"]
        category = PRODUCT_TYPE_TO_CATEGORY.get(pt)
        if not category and pt:
            category = _slugify(pt)
        if not category:
            category = default_cat
        subcategory_slug = ""
        concerns = []

    # Always merge in Excel-cell concerns (don't lose this signal)
    c1 = CONCERN_MAP.get(row["concern"]) if row["concern"] else None
    if not c1 and row["concern"] and row["concern"] not in ("General", ""):
        c1 = _slugify(row["concern"])
    if c1 and c1 not in concerns:
        concerns.append(c1)
    c2 = SKIN_TYPE_MAP.get(row["skin_type"]) if row["skin_type"] else None
    if not c2 and row["skin_type"] and row["skin_type"] not in ("General", "All Skin Types", ""):
        c2 = _slugify(row["skin_type"])
    if c2 and c2 not in concerns:
        concerns.append(c2)

    segment_slug = SEGMENT_TO_BADGE.get(row["segment"], "")
    badges = [segment_slug] if segment_slug else []

    listing = int(row["listing_price"])
    mrp = int(row["mrp"])
    discount_pct = int(round((mrp - listing) / mrp * 100)) if mrp > listing > 0 else 0

    # Detect shade hint from name (we'll store it for future shade-group logic)
    shade_hint = _detect_shade_from_name(row["name"])

    # Seeded trust signals (deterministic per slug)
    rng = random.Random(slug)
    average_rating = round(rng.uniform(4.3, 4.9), 1)
    reviews_count = rng.randint(120, 580)

    # Auto-generated 3-paragraph description (no LLM, fast template)
    desc = (
        f"{brand}'s {name} brings dermatologist-favoured formulation to your daily routine. "
        f"Crafted for Indian skin and weather, this {row['product_type'].lower()} delivers visible results "
        f"with consistent use. Suitable across skin types with proven {(', '.join(concerns) if concerns else 'all-round')} benefits."
    )

    now = datetime.now(timezone.utc).isoformat()
    return {
        "slug": slug,
        "name": name,
        "short_name": name[:60],
        "tagline": (row["segment"] or "").strip(),
        "description": desc,
        "category": category,
        "subcategory": subcategory_slug or row["product_type"],
        "concerns": concerns,
        "niche": niche,
        "key_ingredients": "",
        "ingredients_full": "",
        "benefits": [],
        "how_to_use": "Use as directed on the product label.",
        "size": _parse_size(row["name"]),
        "image_source": "needs_manual",
        "image_verified": False,
        "needs_image": True,
        "images": [],
        "mrp": mrp,
        "prepaid_price": listing,
        "cod_price": listing,
        "cod_advance": 0,
        "discount_percent": discount_pct,
        "badge": (badges[0] if badges else ""),
        "badges": badges,
        "market_segment": row["segment"],
        "shade_hint": shade_hint,
        "is_active": True,
        "sort_order": 99,
        "is_to_be_launched": False,
        "preorder_enabled": False,
        "stock_qty": 100,
        "low_stock_threshold": 10,
        "fill_card": False,
        "brand": brand,
        "specs": {},
        "shades": [],
        "ean_code": "",
        "dealer_price": int(row["dealer_price"]),
        "applied_margin_pct": 0,
        "customer_discount_pct": 0,
        "reviews_count": reviews_count,
        "average_rating": average_rating,
        "rating": average_rating,
        "view_count": 0,
        "product_group_id": group_id,
        "product_group_index": group_index,
        "created_at": now,
        "updated_at": now,
        "imported_at": now,
        "import_source": "fast-master-list",
        # Raw Excel hints — used later by the AI taxonomy audit for better classification
        "main_category_hint": row.get("main_category", ""),
        "product_type_hint": row.get("product_type", ""),
        "concern_hint": row.get("concern", ""),
        "skin_type_hint": row.get("skin_type", ""),
    }


# ============================================================
# Service interface
# ============================================================

class FastBulkImportService:
    """Lightweight, fast bulk import — no LLM, no scraping.

    Designed for the ULTRA_GRANULAR_MASTER_LIST.xlsx that has 9700+ rows.
    Groups products into product_groups of ~80 each (sized via env / default 80).
    """
    def __init__(self, db):
        self.db = db
        self.group_size = 80

    async def wipe_niches(self, niches: List[str]) -> dict:
        """Delete all products in the given niches (and their related collections)."""
        result = await self.db.products.delete_many({"niche": {"$in": niches}})
        # Also wipe product groups for these niches
        await self.db.product_groups.delete_many({"niche": {"$in": niches}})
        return {"deleted": result.deleted_count}

    async def ensure_categories_and_concerns(
        self, rows: List[dict], ai_results: Optional[Dict[int, dict]] = None,
    ) -> dict:
        """Auto-create any missing categories/concerns/subcategories.

        When `ai_results` is provided (keyed by id(row)), unmapped product
        types get routed to canonical site categories AND a sub-filter row is
        created under `subcategories` linked via parent_category.
        """
        ai_results = ai_results or {}
        cats_needed: Dict[str, dict] = {}
        concerns_needed: Dict[str, dict] = {}
        subcats_needed: Dict[str, dict] = {}

        for r in rows:
            ai = ai_results.get(id(r))
            if ai:
                niche = ai["niche"]
                cat_slug = ai["category_slug"]
                cat_name = ai["category_name"]
                cat_icon = ai["icon"]
                sub_slug = ai.get("subcategory_slug") or ""
                sub_name = ai.get("subcategory_name") or ""
                sub_icon = ai.get("subcategory_icon") or ""
                # Also create concerns produced by the AI
                for c in ai.get("concerns") or []:
                    s = c.get("slug")
                    if s and s not in concerns_needed:
                        concerns_needed[s] = {
                            "slug": s,
                            "name": c.get("name") or s.title(),
                            "tagline": "",
                            "icon": "✨",
                            "image": "",
                            "accent_from": "#dcfce7",
                            "accent_to": "#bbf7d0",
                            "accent_text": "#14532d",
                            "description": "",
                            "sort_order": 99,
                            "is_active": True,
                            "niche": niche,
                            "ai_created": True,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
            else:
                niche = NICHE_MAP.get(r["main_category"], "skincare")
                pt = r["product_type"]
                cat_slug = PRODUCT_TYPE_TO_CATEGORY.get(pt) or (_slugify(pt) if pt else None)
                cat_name = pt.title() if pt else (cat_slug.replace("-", " ").title() if cat_slug else "")
                cat_icon = "💄" if niche == "cosmetics" else "🧴"
                sub_slug = ""
                sub_name = ""
                sub_icon = ""

            if cat_slug and cat_slug not in cats_needed:
                cats_needed[cat_slug] = {
                    "slug": cat_slug,
                    "name": cat_name or cat_slug.replace("-", " ").title(),
                    "niche": niche,
                    "group": niche,
                    "is_parent": False,
                    "tagline": "",
                    "image": "",
                    "icon": cat_icon or "🛍️",
                    "sort_order": 99,
                    "is_active": True,
                    "ai_created": bool(ai),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

            if sub_slug and cat_slug and sub_slug not in subcats_needed:
                subcats_needed[sub_slug] = {
                    "slug": sub_slug,
                    "name": sub_name or sub_slug.replace("-", " ").title(),
                    "parent_category": cat_slug,
                    "niche": niche,
                    "tagline": "",
                    "icon": sub_icon or "",
                    "image": "",
                    "sort_order": 0,
                    "is_active": True,
                    "accent_from": "#dcfce7",
                    "accent_to": "#bbf7d0",
                    "accent_text": "#14532d",
                    "ai_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

            # Static-rule concerns from the Excel cells (always done, AI or not)
            c1 = CONCERN_MAP.get(r["concern"]) if r["concern"] else None
            if not c1 and r["concern"] and r["concern"] not in ("General", ""):
                c1 = _slugify(r["concern"])
            if c1 and c1 not in concerns_needed:
                concerns_needed[c1] = {
                    "slug": c1,
                    "name": (r["concern"] or c1).title(),
                    "tagline": "",
                    "icon": "✨",
                    "image": "",
                    "accent_from": "#dcfce7",
                    "accent_to": "#bbf7d0",
                    "accent_text": "#14532d",
                    "description": "",
                    "sort_order": 99,
                    "is_active": True,
                    "niche": niche,
                    "ai_created": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            c2 = SKIN_TYPE_MAP.get(r["skin_type"]) if r["skin_type"] else None
            if not c2 and r["skin_type"] and r["skin_type"] not in ("General", "All Skin Types", ""):
                c2 = _slugify(r["skin_type"])
            if c2 and c2 not in concerns_needed:
                concerns_needed[c2] = {
                    "slug": c2,
                    "name": (r["skin_type"] or c2).title(),
                    "tagline": "",
                    "icon": "🌸",
                    "image": "",
                    "accent_from": "#dcfce7",
                    "accent_to": "#bbf7d0",
                    "accent_text": "#14532d",
                    "description": "",
                    "sort_order": 99,
                    "is_active": True,
                    "niche": niche,
                    "ai_created": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

        # Find existing
        existing_cats = set()
        async for c in self.db.categories.find({}, {"_id": 0, "slug": 1}):
            existing_cats.add(c["slug"])
        existing_concerns = set()
        async for c in self.db.concerns.find({}, {"_id": 0, "slug": 1}):
            existing_concerns.add(c["slug"])
        existing_subcats = set()
        async for c in self.db.subcategories.find({}, {"_id": 0, "slug": 1}):
            existing_subcats.add(c["slug"])

        new_cats = [c for s, c in cats_needed.items() if s not in existing_cats]
        new_concerns = [c for s, c in concerns_needed.items() if s not in existing_concerns]
        new_subcats = [c for s, c in subcats_needed.items() if s not in existing_subcats]

        if new_cats:
            try:
                await self.db.categories.insert_many(new_cats, ordered=False)
            except Exception as e:
                logger.warning(f"[fast-import] insert_many categories failed: {e}")
        if new_concerns:
            try:
                await self.db.concerns.insert_many(new_concerns, ordered=False)
            except Exception as e:
                logger.warning(f"[fast-import] insert_many concerns failed: {e}")
        if new_subcats:
            try:
                await self.db.subcategories.insert_many(new_subcats, ordered=False)
            except Exception as e:
                logger.warning(f"[fast-import] insert_many subcategories failed: {e}")
        return {
            "categories_created": [c["slug"] for c in new_cats],
            "concerns_created": [c["slug"] for c in new_concerns],
            "subcategories_created": [c["slug"] for c in new_subcats],
        }

    async def import_from_bytes(self, content: bytes, batch_size: int = 500, use_ai: bool = False) -> dict:
        """Parse Excel and bulk-insert all rows. Returns counts.

        FAST PATH (default): no LLM during import — just rule-based niche
        routing + auto-create of categories/concerns from Excel cells. The
        raw Excel hints are persisted so the admin can run a ONE-CLICK
        "AI Taxonomy Audit" afterwards to re-route products into the
        canonical storefront taxonomy and create new subcategories.

        Set use_ai=True if you want inline AI categorisation (slower).
        """
        rows = parse_master_excel(content)
        if not rows:
            return {"imported": 0, "skipped": 0, "failed": 0, "total": 0}

        # Optional inline AI taxonomy classification — disabled by default.
        ai_results: Dict[int, dict] = {}
        if use_ai and os.environ.get("EMERGENT_LLM_KEY"):
            ai_rows: List[dict] = []
            for r in rows:
                pt = r.get("product_type") or ""
                if (pt and pt not in PRODUCT_TYPE_TO_CATEGORY) or (
                    r.get("concern") and r.get("concern") not in ("General", "") and r.get("concern") not in CONCERN_MAP
                ):
                    ai_rows.append(r)
            if ai_rows:
                try:
                    from services.ai_categorizer import DBAwareCategorizer
                    cat = DBAwareCategorizer(self.db)
                    await cat.load_taxonomy()
                    sem = asyncio.Semaphore(6)

                    async def one(rr):
                        async with sem:
                            return await cat.classify({
                                "brand": rr.get("brand", ""),
                                "name": rr.get("name", ""),
                                "main_category_hint": rr.get("main_category", ""),
                                "product_type_hint": rr.get("product_type", ""),
                                "concern_hint": rr.get("concern", ""),
                                "skin_type_hint": rr.get("skin_type", ""),
                            })

                    classified = await asyncio.gather(*[one(r) for r in ai_rows])
                    for r, res in zip(ai_rows, classified):
                        # Adapt DBAwareCategorizer output to the older shape used downstream
                        ai_results[id(r)] = {
                            "niche": res["niche"],
                            "category_slug": res["category_slug"],
                            "category_name": res["category_name"],
                            "icon": res.get("category_icon") or "🛍️",
                            "subcategory_slug": res.get("subcategory_slug") or "",
                            "subcategory_name": res.get("subcategory_name") or "",
                            "subcategory_icon": res.get("subcategory_icon") or "",
                            "concerns": [{"slug": c["slug"], "name": c["name"]} for c in res.get("concerns") or []],
                        }
                    logger.info(f"[fast-import] inline-AI classified {len(ai_results)} unique rows")
                except Exception as e:
                    logger.warning(f"[fast-import] inline-AI classify failed: {e}")

        # Self-heal: create any missing categories/concerns BEFORE inserting
        auto_created = await self.ensure_categories_and_concerns(rows, ai_results)

        # Sort rows by (niche, product_type, brand, name) for stable group assignment
        rows.sort(key=lambda r: (
            NICHE_MAP.get(r["main_category"], "skincare"),
            r["product_type"] or "",
            r["brand"] or "",
            r["name"] or "",
        ))

        # Pre-fetch existing slugs for fast dedup
        existing = set()
        cur = self.db.products.find({}, {"_id": 0, "slug": 1})
        async for d in cur:
            existing.add(d["slug"])

        # Assign group IDs per niche, ~80 per group
        niche_counters: Dict[str, int] = {}
        groups_to_create: Dict[str, dict] = {}  # group_id → meta

        docs: List[dict] = []
        skipped = 0
        for row in rows:
            niche = NICHE_MAP.get(row["main_category"], "skincare")
            ctr = niche_counters.get(niche, 0)
            group_no = ctr // self.group_size + 1
            group_id = f"grp-{niche}-{group_no:03d}"
            group_index = ctr % self.group_size

            # Track group meta for later upsert
            if group_id not in groups_to_create:
                groups_to_create[group_id] = {
                    "group_id": group_id,
                    "niche": niche,
                    "name": f"{niche.title()} – Group {group_no}",
                    "group_no": group_no,
                    "size": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            groups_to_create[group_id]["size"] += 1
            niche_counters[niche] = ctr + 1

            doc = compose_product_doc(row, group_id, group_index, ai=ai_results.get(id(row)))
            if doc["slug"] in existing:
                skipped += 1
                continue
            existing.add(doc["slug"])
            docs.append(doc)

        # Bulk insert in batches
        imported = 0
        failed = 0
        for i in range(0, len(docs), batch_size):
            batch = docs[i:i + batch_size]
            try:
                if batch:
                    await self.db.products.insert_many(batch, ordered=False)
                    imported += len(batch)
            except Exception as e:
                logger.warning(f"[fast-import] batch {i//batch_size} partial failure: {e}")
                # Try inserting one by one to maximize survival
                for d in batch:
                    try:
                        await self.db.products.insert_one(d)
                        imported += 1
                    except Exception:
                        failed += 1

        # Upsert groups
        for g in groups_to_create.values():
            await self.db.product_groups.update_one(
                {"group_id": g["group_id"]},
                {"$set": g},
                upsert=True,
            )

        # Ensure product indexes for fast filtering
        try:
            await self.db.products.create_index("niche")
            await self.db.products.create_index("category")
            await self.db.products.create_index("brand")
            await self.db.products.create_index("product_group_id")
            await self.db.products.create_index("stock_qty")
        except Exception:
            pass

        return {
            "imported": imported,
            "skipped": skipped,
            "failed": failed,
            "total": len(rows),
            "groups_created": len(groups_to_create),
            "by_niche": niche_counters,
            "auto_created": auto_created,
        }
