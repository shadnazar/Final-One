"""Bulk product import engine — Excel → enriched products in MongoDB.

Pipeline per row:
  1. Parse Excel row (Item Name, MRP, Dealer Price, Applied Margin %,
     Website Listing Price, Customer Discount %, EAN Code).
  2. Scrape brand site (services/brand_scraper) for title/image/description/ingredients.
  3. Call Claude Sonnet (Emergent LLM key) with name + scraped context →
     JSON { description, key_ingredients, benefits, niche, category, concerns, size,
            how_to_use, image_search_query }.
  4. Compose final product doc, deterministic slug, insert into `products`.

Concurrency: process N rows in parallel per batch (default 5) to avoid LLM rate
limits and to be polite to brand sites. Resumable: items are stored individually
in `import_jobs.items` with status field, so the worker can pick up where it
left off after a pod restart.
"""
from __future__ import annotations
import asyncio
import io
import json
import logging
import random
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import pandas as pd
from emergentintegrations.llm.chat import LlmChat, UserMessage

from services.brand_scraper import fetch_brand_product
from services.brand_websites import normalize_brand
from services.marketplace_scraper import find_product_image

logger = logging.getLogger(__name__)

# Categories present in the seeded catalog. Keep in sync with concerns_seed.
SKINCARE_CATS = {
    "cleanser", "serum", "moisturizer-cream", "sunscreen", "eye-care",
    "facewash-scrubs", "toner", "body-lotion", "lip-balm", "face-masks",
    "exfoliators", "night-cream", "day-cream", "face-mist", "spot-treatment",
    "body-care", "hair-care", "lip-care",
}
COSMETICS_CATS = {
    "brow", "kajal-eyeliner", "blush-highlighter", "lipstick-gloss", "eyeshadow",
    "foundation-concealer", "primer-compact", "nails-accessories", "makeup-kit",
    "makeup-brush", "makeup-fixer", "makeup-remover",
    "mascara", "lip-liner", "setting-powder", "bronzer-contour",
}
VALID_NICHES = {"skin-care", "anti-aging", "skincare", "cosmetics"}
VALID_CONCERNS = {
    "anti-aging", "acne-blemishes", "pigmentation", "dullness", "dark-circles",
    "dryness", "oily-skin", "sensitive-skin",
    "large-pores", "fine-lines", "sun-damage", "uneven-tone", "redness",
    "blackheads", "dehydration",
}

# Track active jobs for pause/cancel signaling
ACTIVE_JOBS: Dict[str, dict] = {}


def _slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s[:120] or f"item-{uuid.uuid4().hex[:6]}"


def _parse_size_from_name(name: str) -> str:
    m = re.search(r"\b(\d+\.?\d*)\s?(ML|GM?|L|OZ|FL\s?OZ)\b", name or "", flags=re.I)
    if not m:
        return ""
    return f"{m.group(1)} {m.group(2).upper().replace('GM', 'G')}"


def parse_excel(content: bytes) -> List[dict]:
    """Parse all sheets in an xlsx and return a flat list of product rows.

    Each row dict has: brand, name, mrp, dealer_price, applied_margin,
    listing_price, customer_discount, ean.

    Brand extraction priority:
      1. An explicit "Brand" column on the sheet if present.
      2. The sheet name — BUT only if it's a real brand (not 'Sheet1' / 'Sheet2' /
         'Sheet3' / numeric-only / blank).
      3. The first 1–2 tokens of the Item Name (e.g. "Lakme 9to5..." → "Lakme").
    """
    xls = pd.ExcelFile(io.BytesIO(content))
    rows: List[dict] = []
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, dtype=object)
        df.columns = [str(c).strip() for c in df.columns]
        # Find canonical column names (case-insensitive substring match)
        def col(*needles):
            for c in df.columns:
                lc = c.lower()
                for n in needles:
                    if n in lc:
                        return c
            return None
        c_name = col("item name", "product name", "name")
        if not c_name:
            continue
        c_brand = col("brand")
        c_mrp = col("mrp")
        c_dealer = col("dealer")
        c_margin = col("applied margin", "margin %")
        c_listing = col("website listing", "listing price", "sell price")
        c_discount = col("customer discount", "discount %")
        c_ean = col("ean")
        # Is the sheet name itself a meaningful brand? (Sheet1/Sheet2/digits → no)
        sheet_str = str(sheet).strip()
        sheet_is_brand = bool(
            sheet_str
            and not re.fullmatch(r"(?i)sheet\d*", sheet_str)
            and not re.fullmatch(r"\d+", sheet_str)
        )
        for _, r in df.iterrows():
            name = r.get(c_name)
            if pd.isna(name) or not str(name).strip():
                continue
            # ---- Brand resolution ----
            brand_val = ""
            if c_brand and not pd.isna(r.get(c_brand)):
                brand_val = str(r.get(c_brand)).strip()
            if not brand_val and sheet_is_brand:
                brand_val = sheet_str
            if not brand_val:
                # Heuristic: first 1–2 capitalised tokens of the product name.
                tokens = re.findall(r"[A-Za-z0-9&]+", str(name).strip())
                if tokens:
                    # Take up to first 2 tokens, but stop on common product nouns
                    stop = {"face", "skin", "cream", "serum", "wash", "lotion", "spf", "oil", "lip", "eye", "anti", "night", "day", "mask", "toner", "balm", "scrub", "gel", "foam", "cleanser", "moisturizer", "moisturiser", "sunscreen", "lipstick", "kajal", "mascara", "eyeliner", "foundation", "concealer", "primer", "compact", "blush", "highlighter", "powder", "for", "with", "the"}
                    picked = []
                    for t in tokens[:2]:
                        if t.lower() in stop:
                            break
                        picked.append(t)
                    brand_val = " ".join(picked).strip() or tokens[0]
            try:
                mrp = float(r.get(c_mrp)) if c_mrp and not pd.isna(r.get(c_mrp)) else 0
            except Exception:
                mrp = 0
            try:
                dealer = float(r.get(c_dealer)) if c_dealer and not pd.isna(r.get(c_dealer)) else 0
            except Exception:
                dealer = 0
            try:
                listing = float(r.get(c_listing)) if c_listing and not pd.isna(r.get(c_listing)) else 0
            except Exception:
                listing = 0
            try:
                margin = float(r.get(c_margin)) if c_margin and not pd.isna(r.get(c_margin)) else 0
            except Exception:
                margin = 0
            try:
                disc = float(r.get(c_discount)) if c_discount and not pd.isna(r.get(c_discount)) else 0
            except Exception:
                disc = 0
            ean = ""
            if c_ean and not pd.isna(r.get(c_ean)):
                ean = str(r.get(c_ean)).strip()
            rows.append({
                "brand": brand_val,
                "name": str(name).strip(),
                "mrp": mrp,
                "dealer_price": dealer,
                "applied_margin": margin,
                "listing_price": listing,
                "customer_discount": disc,
                "ean": ean,
            })
    return rows


def _band_listing_price(dealer: float, mrp: float) -> tuple[float, float]:
    """Apply Band Margin Model if listing_price is missing/zero.

    <300 → 15%, 300-1000 → 10%, >1000 → 7%. Returns (listing, applied_margin_pct).
    """
    if dealer <= 0:
        # Fall back to MRP * 0.85 if dealer missing
        if mrp > 0:
            return round(mrp * 0.85, 2), 15.0
        return 0.0, 0.0
    if dealer < 300:
        pct = 15
    elif dealer <= 1000:
        pct = 10
    else:
        pct = 7
    listing = round(dealer * (1 + pct / 100), 2)
    return listing, float(pct)


def _normalize_pricing(row: dict) -> dict:
    """Ensure listing_price is set. Use Excel column if present, else Band model."""
    listing = row.get("listing_price") or 0
    margin = row.get("applied_margin") or 0
    if listing <= 0:
        listing, margin = _band_listing_price(row.get("dealer_price") or 0, row.get("mrp") or 0)
    return {**row, "listing_price": listing, "applied_margin": margin}


async def _llm_enrich(row: dict, scraped: dict, api_key: str) -> dict:
    """Ask Claude Sonnet to enrich a single product. Returns dict with
    description, key_ingredients, benefits, niche, category, concerns, how_to_use, size.
    """
    system = (
        "You are an expert beauty/skincare cataloging assistant for an Indian e-commerce "
        "store. Given a product name, brand, MRP and (optionally) a scraped description, "
        "produce a clean, structured product listing for the store database. "
        "Be concise, factual and consumer-friendly. Never invent ingredient claims that "
        "could be regulated medical claims."
    )

    cats_skin = sorted(SKINCARE_CATS)
    cats_cos = sorted(COSMETICS_CATS)
    concerns = sorted(VALID_CONCERNS)

    scraped_block = ""
    if scraped:
        st = scraped.get("title") or ""
        sd = scraped.get("description") or ""
        si = scraped.get("ingredients") or ""
        scraped_block = (
            f"\nScraped from brand website:\nTitle: {st}\nDescription: {sd[:600]}\n"
            f"Ingredients: {si[:600]}"
        )

    prompt = f"""Product to catalog:
Brand: {row['brand']}
Name: {row['name']}
MRP: ₹{row['mrp']}
{scraped_block}

Return STRICT JSON only (no markdown fences), exactly these keys:
{{
  "description": "120-180 word consumer-facing description, plain text",
  "key_ingredients": "Comma-separated 4-8 hero ingredients (e.g. 'Niacinamide, Hyaluronic Acid, Vitamin C')",
  "benefits": ["3-5 short benefit phrases, each <=8 words"],
  "how_to_use": "1-2 sentence usage instruction",
  "size": "extracted size like '50ml' / '30g' or '' if unclear",
  "niche": "MUST be one of: anti-aging | skincare | cosmetics",
  "category": "MUST be one of the slugs below",
  "concerns": ["0-3 from: {', '.join(concerns)}"],
  "image_search_query": "2-5 word phrase to search a stock image for this product"
}}

Valid categories for niche='skincare' or 'anti-aging':
{', '.join(cats_skin)}

Valid categories for niche='cosmetics':
{', '.join(cats_cos)}

Rules:
- niche='anti-aging' if the product targets ANY of: wrinkles, fine lines, firming,
  collagen, retinol, retinoids, peptides, anti-age, age-reset, lifting, sagging,
  bakuchiol, eye lift / eye-cream for aging, night-renewal, mature skin,
  vitamin C >=15% serum, neck care, hand-aging.
  Be GENEROUS — products containing retinol/peptides/bakuchiol/collagen-boosting
  ingredients OR explicitly marketed for 30+/40+ skin → anti-aging.
- niche='cosmetics' if it is makeup (lipstick, lip gloss, lip liner, kajal,
  eyeliner, blush, foundation, primer, mascara, nail polish, eyeshadow, brow,
  bronzer, contour, highlighter, setting powder, setting/finishing spray,
  makeup remover, makeup brush, beauty blender).
- Otherwise niche='skincare' (cleanser, sunscreen, moisturizer, face mask, toner,
  body lotion, lip balm, hair serum, body wash, shampoo, conditioner).
- Pick the SINGLE best matching category slug from the list above for the chosen
  niche. Hair care goes to 'hair-care', body wash/scrub to 'body-care', lip balms
  to 'lip-care'.
- Concerns: include 1-3 most relevant ones from the list. For most skincare
  products, at least ONE concern should be assigned (don't return an empty list).
- Bias generously: a vitamin C serum → ['anti-aging', 'pigmentation', 'dullness'].
  A salicylic acid cleanser → ['acne-blemishes', 'blackheads', 'large-pores'].
  A retinol cream → ['anti-aging', 'fine-lines'].
  A sunscreen → ['sun-damage', 'pigmentation'].
  A moisturizer for dry skin → ['dryness', 'dehydration'].
"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"bulk-{uuid.uuid4().hex[:8]}",
            system_message=system,
        ).with_model("gemini", "gemini-2.5-flash")
        msg = UserMessage(text=prompt)
        resp = await chat.send_message(msg)
        match = re.search(r"\{[\s\S]*\}", resp or "")
        if not match:
            raise ValueError("no JSON in LLM response")
        data = json.loads(match.group())
        # Sanitize
        niche = (data.get("niche") or "skincare").strip().lower()
        if niche not in VALID_NICHES:
            niche = "skincare"
        category = (data.get("category") or "").strip().lower()
        valid_cats = COSMETICS_CATS if niche == "cosmetics" else SKINCARE_CATS
        if category not in valid_cats:
            category = "lipstick-gloss" if niche == "cosmetics" else "serum"
        concerns_out = [c for c in (data.get("concerns") or []) if c in VALID_CONCERNS]
        return {
            "description": (data.get("description") or "")[:1500],
            "key_ingredients": (data.get("key_ingredients") or "")[:400],
            "benefits": list(data.get("benefits") or [])[:6],
            "how_to_use": (data.get("how_to_use") or "")[:400],
            "size": (data.get("size") or _parse_size_from_name(row["name"]))[:40],
            "niche": niche,
            "category": category,
            "concerns": concerns_out,
            "image_search_query": (data.get("image_search_query") or "")[:80],
        }
    except Exception as e:
        logger.warning(f"[bulk-enrich-llm] failed for {row['name']!r}: {e}")
        # Minimal fallback so the product still gets imported
        return {
            "description": f"{row['brand'].title()} {row['name'].title()}. Quality beauty product.",
            "key_ingredients": "",
            "benefits": [],
            "how_to_use": "Use as directed.",
            "size": _parse_size_from_name(row["name"]),
            "niche": "cosmetics" if any(t in row["name"].upper() for t in ("LIPSTICK", "KAJAL", "MASCARA", "NAIL", "BLUSH", "EYESHADOW", "FOUNDATION", "CONCEALER", "PRIMER", "EYELINER", "BROW")) else "skincare",
            "category": "lipstick-gloss",
            "concerns": [],
            "image_search_query": f"{row['brand']} {row['name'][:20]}",
        }


def _compose_product_doc(row: dict, enriched: dict, scraped: dict, image_info: Optional[dict] = None) -> dict:
    """Final product document ready for db.products.insert_one.

    Pricing rules:
      • All money fields are stored as INTEGERS (round, no decimals — per business request).
      • No volume / buy-N-get-X discounts at the import layer.

    Trust signals:
      • Each newly imported product gets a randomized realistic rating (4.3-4.9★)
        and review count (80-450). These are SEED values only; real reviews
        replace these later when customers leave feedback.

    Canonical taxonomy enforcement (Feb 2026):
      • The LLM step returns coarse niche/category values from a legacy list.
        We OVERRIDE them by re-running the canonical classifier
        (services.taxonomy_canonical.classify_product) which uses the same
        keyword rules as the live hub. This guarantees imported products land
        on the correct granular sub-tile (Gel Cleanser, Niacinamide Serum,
        Lip Liner, etc.) and respects the Celesta-Glow flagship niche guard.
    """
    from services.taxonomy_canonical import classify_product  # local import to avoid circular

    name = row["name"].title()
    brand = row["brand"].strip().title()
    slug = _slugify(f"{row['brand']}-{row['name']}")[:120]

    # Re-classify through canonical taxonomy. We pass the LLM's niche as a hint
    # but let the keyword classifier have final say. Description + scraped
    # context give the keyword matcher more signal.
    canon = classify_product(
        name=name,
        description=(enriched.get("description") or "") + " " + (scraped.get("title") or ""),
        brand=brand,
        current_niche=enriched.get("niche"),
    )
    canon_niche = canon["niche"] or enriched.get("niche") or "skincare"
    canon_category = canon["category"] or ""
    canon_subcategory = canon["subcategory"] or ""
    canon_concerns = canon["concerns"] or enriched.get("concerns") or []
    needs_review = canon.get("unclassified", False)

    # ROUND to int — no decimals anywhere in pricing
    mrp = int(round(float(row.get("mrp") or 0)))
    listing = int(round(float(row.get("listing_price") or 0)))
    discount_pct = 0
    if mrp > 0 and listing > 0 and listing < mrp:
        discount_pct = int(round((mrp - listing) / mrp * 100))

    # Image — verified result from multi-source cascade
    image = ""
    image_source = "none"
    image_verified = False
    needs_image = True
    if image_info:
        image = image_info.get("image") or ""
        image_source = image_info.get("source") or "none"
        image_verified = bool(image_info.get("verified"))
        needs_image = not (image and image_verified)

    # Seeded trust signals — biased toward 4.3-4.9★ with deterministic-per-slug RNG
    rng = random.Random(slug)
    average_rating = round(rng.uniform(4.3, 4.9), 1)
    reviews_count = rng.randint(80, 450)

    now = datetime.now(timezone.utc).isoformat()
    return {
        "slug": slug,
        "name": name,
        "short_name": name[:50],
        "tagline": "",
        "description": enriched["description"],
        "category": canon_category,
        "subcategory": canon_subcategory,
        "concerns": canon_concerns,
        "niche": canon_niche,
        "needs_review": needs_review,
        "taxonomy_classified_at": now,
        "key_ingredients": enriched["key_ingredients"],
        "ingredients_full": scraped.get("ingredients", "") or enriched["key_ingredients"],
        "benefits": enriched["benefits"],
        "how_to_use": enriched["how_to_use"],
        "size": enriched["size"],
        "image_source": image_source,
        "image_verified": image_verified,
        "needs_image": needs_image,
        "images": [image] if image else [],
        "mrp": mrp,
        "prepaid_price": listing,
        "cod_price": listing,
        "cod_advance": 0,
        "discount_percent": discount_pct,
        "badge": "",
        "badges": [],
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
        "ean_code": row.get("ean") or "",
        "dealer_price": int(round(float(row.get("dealer_price") or 0))),
        "applied_margin_pct": int(round(float(row.get("applied_margin") or 0))),
        "customer_discount_pct": int(round(float(row.get("customer_discount") or 0))),
        "reviews_count": reviews_count,
        "average_rating": average_rating,
        "rating": average_rating,
        "view_count": 0,
        "created_at": now,
        "updated_at": now,
        "imported_at": now,
        "import_source": "bulk-excel",
    }


# ============================================================
# Public service interface used by routes/bulk_import.py
# ============================================================

class BulkImportService:
    def __init__(self, db):
        self.db = db
        self.api_key = __import__("os").environ.get("EMERGENT_LLM_KEY", "")

    # ----------------------------------------------------------
    # Image re-fetch (for products that landed without a real image)
    # ----------------------------------------------------------

    async def refetch_image(self, slug: str) -> dict:
        """Re-run the image cascade for a single product by slug."""
        prod = await self.db.products.find_one({"slug": slug}, {"_id": 0, "brand": 1, "name": 1})
        if not prod:
            return {"success": False, "error": "Product not found"}
        try:
            scraped = await asyncio.wait_for(fetch_brand_product(prod["brand"], prod["name"]), timeout=15.0)
        except Exception:
            scraped = {}
        try:
            image_info = await asyncio.wait_for(
                find_product_image(prod["brand"], prod["name"], brand_site_scrape=scraped),
                timeout=15.0,
            )
        except Exception:
            image_info = {"image": "", "source": "needs_manual", "verified": False}
        if image_info.get("image") and image_info.get("verified"):
            await self.db.products.update_one(
                {"slug": slug},
                {"$set": {
                    "images": [image_info["image"]],
                    "image_source": image_info.get("source") or "brand-site",
                    "image_verified": True,
                    "needs_image": False,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            return {"success": True, "image": image_info["image"], "source": image_info.get("source")}
        return {"success": False, "error": "No image found", "source": image_info.get("source")}

    async def refetch_images_bulk(self, only_needs_image: bool = True, limit: int = 500) -> dict:
        """Re-run image cascade for every imported product still missing a real image.

        Runs in background; returns counts immediately.
        """
        q = {"import_source": "bulk-excel"}
        if only_needs_image:
            q["$or"] = [{"needs_image": True}, {"image_source": {"$in": ["unsplash", "needs_manual", "none"]}}]
        cur = self.db.products.find(q, {"_id": 0, "slug": 1, "brand": 1, "name": 1}).limit(limit)
        targets = await cur.to_list(limit)
        # Kick off background
        asyncio.create_task(self._refetch_worker(targets))
        return {"queued": len(targets)}

    async def _refetch_worker(self, targets: list, concurrency: int = 6):
        sem = asyncio.Semaphore(concurrency)

        async def one(p):
            async with sem:
                try:
                    await self.refetch_image(p["slug"])
                except Exception as e:
                    logger.warning(f"[refetch] {p['slug']} err={e}")

        await asyncio.gather(*[one(t) for t in targets])

    async def create_job(self, filename: str, content: bytes) -> dict:
        rows = parse_excel(content)
        rows = [_normalize_pricing(r) for r in rows]
        job_id = f"imp_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        items = []
        for idx, r in enumerate(rows):
            items.append({
                "idx": idx,
                "brand": r["brand"],
                "name": r["name"],
                "mrp": float(r["mrp"]),
                "listing_price": float(r["listing_price"]),
                "dealer_price": float(r["dealer_price"]),
                "applied_margin": float(r["applied_margin"]),
                "customer_discount": float(r["customer_discount"]),
                "ean": r["ean"],
                "status": "pending",  # pending | processing | done | failed | skipped
                "slug": "",
                "error": "",
            })
        job = {
            "job_id": job_id,
            "filename": filename,
            "total": len(items),
            "done": 0,
            "failed": 0,
            "skipped": 0,
            "status": "queued",  # queued | running | paused | completed | cancelled
            "created_at": now,
            "updated_at": now,
            "items": items,
            "brand_counts": _count_by_brand(items),
        }
        await self.db.import_jobs.insert_one(dict(job))
        # Return WITHOUT the heavy items array and without the _id that insert added
        return {k: v for k, v in job.items() if k != "items"}

    async def list_jobs(self) -> list:
        cur = self.db.import_jobs.find({}, {"_id": 0, "items": 0}).sort("created_at", -1)
        return await cur.to_list(50)

    async def get_job(self, job_id: str) -> Optional[dict]:
        return await self.db.import_jobs.find_one({"job_id": job_id}, {"_id": 0})

    async def get_status(self, job_id: str) -> Optional[dict]:
        """Return summary + last 15 non-pending items (recent activity)."""
        job = await self.db.import_jobs.find_one(
            {"job_id": job_id}, {"_id": 0, "items": 0}
        )
        if not job:
            return None
        # Separately fetch last 15 items that have been touched (status != pending)
        pipeline = [
            {"$match": {"job_id": job_id}},
            {"$unwind": "$items"},
            {"$match": {"items.status": {"$ne": "pending"}}},
            {"$sort": {"items.idx": -1}},
            {"$limit": 15},
            {"$replaceRoot": {"newRoot": "$items"}},
        ]
        try:
            recent = await self.db.import_jobs.aggregate(pipeline).to_list(15)
        except Exception:
            recent = []
        job["items"] = recent
        return job

    async def set_status(self, job_id: str, status: str) -> bool:
        r = await self.db.import_jobs.update_one(
            {"job_id": job_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return r.matched_count > 0

    async def start_job(self, job_id: str, concurrency: int = 5) -> bool:
        """Kick off background processing for a job (idempotent — won't re-run if already running)."""
        job = await self.db.import_jobs.find_one({"job_id": job_id}, {"_id": 0, "status": 1})
        if not job:
            return False
        if job_id in ACTIVE_JOBS:
            return True  # already running
        ACTIVE_JOBS[job_id] = {"cancel": False, "pause": False}
        await self.set_status(job_id, "running")
        asyncio.create_task(self._run_job(job_id, concurrency))
        return True

    async def pause_job(self, job_id: str) -> bool:
        if job_id in ACTIVE_JOBS:
            ACTIVE_JOBS[job_id]["pause"] = True
        return await self.set_status(job_id, "paused")

    async def cancel_job(self, job_id: str) -> bool:
        if job_id in ACTIVE_JOBS:
            ACTIVE_JOBS[job_id]["cancel"] = True
        return await self.set_status(job_id, "cancelled")

    async def _run_job(self, job_id: str, concurrency: int):
        """Worker: process pending items in parallel batches."""
        try:
            sem = asyncio.Semaphore(concurrency)
            while True:
                # Pause / cancel checks
                flags = ACTIVE_JOBS.get(job_id, {})
                if flags.get("cancel"):
                    await self.set_status(job_id, "cancelled")
                    break
                if flags.get("pause"):
                    await self.set_status(job_id, "paused")
                    break

                # Pull a batch of pending items (next N)
                job = await self.db.import_jobs.find_one(
                    {"job_id": job_id}, {"_id": 0, "items": 1}
                )
                if not job:
                    break
                pending = [it for it in job["items"] if it["status"] == "pending"][:concurrency * 2]
                if not pending:
                    await self.set_status(job_id, "completed")
                    break

                tasks = [self._process_item(job_id, it, sem) for it in pending]
                await asyncio.gather(*tasks)
        except Exception as e:
            logger.exception(f"[bulk-import-worker] job {job_id} crashed: {e}")
            await self.set_status(job_id, "failed")
        finally:
            ACTIVE_JOBS.pop(job_id, None)

    async def _process_item(self, job_id: str, item: dict, sem: asyncio.Semaphore):
        async with sem:
            idx = item["idx"]
            try:
                # Mark processing
                await self.db.import_jobs.update_one(
                    {"job_id": job_id, "items.idx": idx},
                    {"$set": {"items.$.status": "processing"}},
                )
                row = {
                    "brand": item["brand"],
                    "name": item["name"],
                    "mrp": item["mrp"],
                    "dealer_price": item["dealer_price"],
                    "applied_margin": item["applied_margin"],
                    "listing_price": item["listing_price"],
                    "customer_discount": item["customer_discount"],
                    "ean": item["ean"],
                }

                # 1. Brand site scrape (best-effort)
                scraped = {}
                try:
                    scraped = await asyncio.wait_for(
                        fetch_brand_product(row["brand"], row["name"]), timeout=15.0
                    )
                except Exception:
                    scraped = {}

                # 1b. Multi-source verified image cascade (brand-site → Nykaa → Amazon → Flipkart → Unsplash)
                image_info = {}
                try:
                    image_info = await asyncio.wait_for(
                        find_product_image(row["brand"], row["name"], brand_site_scrape=scraped),
                        timeout=25.0,
                    )
                except Exception as e:
                    logger.warning(f"[image-cascade] {row['name']!r} failed: {e}")

                # 2. LLM enrich
                enriched = await _llm_enrich(row, scraped, self.api_key)

                # 3. Compose final product doc
                doc = _compose_product_doc(row, enriched, scraped, image_info=image_info)

                # Dedupe by (brand, slug) — skip if already imported
                exists = await self.db.products.find_one(
                    {"slug": doc["slug"]}, {"_id": 1}
                )
                if exists:
                    await self.db.import_jobs.update_one(
                        {"job_id": job_id, "items.idx": idx},
                        {
                            "$set": {
                                "items.$.status": "skipped",
                                "items.$.slug": doc["slug"],
                                "items.$.error": "duplicate slug",
                            },
                            "$inc": {"skipped": 1},
                        },
                    )
                    return

                await self.db.products.insert_one(doc)
                await self.db.import_jobs.update_one(
                    {"job_id": job_id, "items.idx": idx},
                    {
                        "$set": {
                            "items.$.status": "done",
                            "items.$.slug": doc["slug"],
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "$inc": {"done": 1},
                    },
                )
            except Exception as e:
                logger.exception(f"[bulk-import] item {idx} failed: {e}")
                await self.db.import_jobs.update_one(
                    {"job_id": job_id, "items.idx": idx},
                    {
                        "$set": {
                            "items.$.status": "failed",
                            "items.$.error": str(e)[:300],
                        },
                        "$inc": {"failed": 1},
                    },
                )


def _count_by_brand(items: list) -> dict:
    out: dict = {}
    for it in items:
        b = it["brand"]
        out[b] = out.get(b, 0) + 1
    return out
