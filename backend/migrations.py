"""
Idempotent migrations that run on startup.
- Sets TBL (To Be Launched) status on products
- Adds sample product images
- Initializes banner_carousel in site_settings
- Auto-flips TBL products whose launch_date has passed
"""
import logging
from datetime import datetime, timezone, timedelta

# Default sample images sourced from the vision expert (Pexels/Unsplash CDN — public)
PRODUCT_IMAGE_MAP = {
    "anti-aging-serum": [
        "https://images.unsplash.com/photo-1575257950302-bf479291b409?auto=format&fit=crop&w=1000&q=80",
    ],
    "anti-aging-cream": [
        "https://images.pexels.com/photos/10221858/pexels-photo-10221858.jpeg?auto=compress&cs=tinysrgb&w=1000",
    ],
    "under-eye-cream": [
        "https://images.unsplash.com/photo-1654967102743-53295f5a7142?auto=format&fit=crop&w=1000&q=80",
    ],
    "sunscreen": [
        "https://images.pexels.com/photos/11753640/pexels-photo-11753640.jpeg?auto=compress&cs=tinysrgb&w=1000",
    ],
    "cleanser": [
        "https://images.unsplash.com/photo-1612705166160-97d3b2e8e212?auto=format&fit=crop&w=1000&q=80",
    ],
}

DEFAULT_BANNERS = [
    {
        "id": "banner-1",
        "image": "https://images.unsplash.com/photo-1581182815808-b6eb627a8798?auto=format&fit=crop&w=1920&q=80",
        "title": "Clinically Proven Anti-Aging",
        "subtitle": "Visible results in 4 weeks",
        "cta_text": "Shop Now",
        "cta_link": "/shop",
        "sort_order": 1,
    },
    {
        "id": "banner-2",
        "image": "https://images.pexels.com/photos/3762871/pexels-photo-3762871.jpeg?auto=compress&cs=tinysrgb&w=1920",
        "title": "Glow That Speaks",
        "subtitle": "Dermatologist tested · Cruelty free",
        "cta_text": "Explore Range",
        "cta_link": "/shop",
        "sort_order": 2,
    },
    {
        "id": "banner-3",
        "image": "https://images.pexels.com/photos/5468629/pexels-photo-5468629.jpeg?auto=compress&cs=tinysrgb&w=1920",
        "title": "Free Skin Analysis",
        "subtitle": "Personalized routine in 60 seconds",
        "cta_text": "Get Started",
        "cta_link": "/consultation",
        "sort_order": 3,
    },
]

# Combo sample images — admin can replace these via Admin > Banners/Combos
COMBO_IMAGE_MAP = {
    "complete-anti-aging-kit": "https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "day-night-duo": "https://images.pexels.com/photos/4465815/pexels-photo-4465815.jpeg?auto=compress&cs=tinysrgb&w=1200",
    "glow-essentials": "https://images.pexels.com/photos/3737576/pexels-photo-3737576.jpeg?auto=compress&cs=tinysrgb&w=1200",
}

# Default landscape feature image for the homepage hero side panel (replaces 3-product card grid)
DEFAULT_HOMEPAGE_FEATURE_IMAGE = "https://images.pexels.com/photos/3762871/pexels-photo-3762871.jpeg?auto=compress&cs=tinysrgb&w=1600"
DEFAULT_HOMEPAGE_FEATURE_TITLE = "Complete Skin Renewal System"
DEFAULT_HOMEPAGE_FEATURE_SUBTITLE = "5 clinically-formulated products. One radiant transformation."

# ============================================================
# Per-niche home customization defaults — used to seed
# site_settings.niche_settings on first run.
# Admin can edit everything via /admin/niches.
# ============================================================
DEFAULT_NICHE_SETTINGS = {
    "anti-aging": {
        "brand_name": "Celesta Glow",
        "hero": {
            "image_desktop": "https://customer-assets.emergentagent.com/job_cg3-render/artifacts/uscaqcsg_217BA6A6-1F87-44A3-AD2C-F750B48A11EF.png",
            "image_mobile": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80",
            "eyebrow": "Anti-Aging",
            "title_line1": "Visible firming",
            "title_line2": "& youthful glow.",
            "subtitle": "Clinical-grade Retinol, Vitamin C and Peptides — formulated for Indian skin to reduce fine lines and brighten in 4 weeks.",
            "cta1_label": "Shop the routine",
            "cta1_link": "/categories",
            "cta2_label": "Free Skin Analysis",
            "cta2_link": "/skin-analysis",
            "accent": "#0f766e",
            "accent_dark": "#115e59",
            "accent_bg": "#d1fae5",
        },
        "bestsellers": {
            "enabled": True,
            "eyebrow": "Trending now",
            "title_prefix": "Anti-Aging",
            "title_highlight": "Bestsellers",
            "limit": 10,
            "sort_by": "reviews_count",  # reviews_count | rating | sort_order | price_asc | price_desc
        },
        "cta_section": {
            "enabled": True,
            "eyebrow": "Build your routine",
            "title": "Not sure where to start?",
            "subtitle": "Tell us your skin type — we'll build a personalized AM & PM ritual in 2 seconds.",
            "button_label": "Start Routine Builder",
            "button_link": "/routine",
            "bg_from": "#047857",
            "bg_via": "#065f46",
            "bg_to": "#115e59",
        },
        "show_complete_kit": True,
        "show_reviews": True,
        "show_dermatologist": True,
        "show_faq": True,
        "show_concern_strip": False,
    },
    "skincare": {
        "brand_name": "Celesta Glow",
        "hero": {
            "image_desktop": "https://customer-assets.emergentagent.com/job_cg3-render/artifacts/v5vv0e5r_546BA64A-4E90-4675-B7DB-3D2EFDB10675.png",
            "image_mobile": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
            "eyebrow": "Skincare",
            "title_line1": "Skincare for every",
            "title_line2": "skin type & concern.",
            "subtitle": "From acne to dullness, dryness to dark spots — pick your concern and we'll show you the routine.",
            "cta1_label": "Pick your concern",
            "cta1_link": "/categories",
            "cta2_label": "Free Skin Analysis",
            "cta2_link": "/skin-analysis",
            "accent": "#0e7490",
            "accent_dark": "#155e75",
            "accent_bg": "#cffafe",
        },
        "bestsellers": {
            "enabled": True,
            "eyebrow": "Trending now",
            "title_prefix": "Skincare",
            "title_highlight": "Bestsellers",
            "limit": 10,
            "sort_by": "reviews_count",
        },
        "cta_section": {
            "enabled": True,
            "eyebrow": "Build your routine",
            "title": "Not sure where to start?",
            "subtitle": "Take the 2-minute Skin Analysis and we'll build a personalized routine.",
            "button_label": "Start Routine Builder",
            "button_link": "/routine",
            "bg_from": "#0e7490",
            "bg_via": "#155e75",
            "bg_to": "#115e59",
        },
        "show_concern_strip": True,
        "concern_strip_title": "Shop by Concern",
        "concern_strip_subtitle": "Pick your skin problem",
        "show_reviews": False,
        "show_dermatologist": False,
        "show_faq": False,
        "show_complete_kit": False,
    },
    "cosmetics": {
        "brand_name": "Celesta Beauty",
        "hero": {
            "image_desktop": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1664&q=80",
            "image_mobile": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80",
            "eyebrow": "Cosmetics",
            "title_line1": "Beauty meets",
            "title_line2": "skincare actives.",
            "subtitle": "Buildable colour, weightless wear, skin-loving actives. Pick your category and shop the look.",
            "cta1_label": "Shop categories",
            "cta1_link": "/categories",
            "cta2_label": "Free Skin Analysis",
            "cta2_link": "/skin-analysis",
            "accent": "#be185d",
            "accent_dark": "#831843",
            "accent_bg": "#fce7f3",
        },
        "bestsellers": {
            "enabled": True,
            "eyebrow": "Most-loved",
            "title_prefix": "Makeup",
            "title_highlight": "Bestsellers",
            "limit": 10,
            "sort_by": "reviews_count",
        },
        "cta_section": {
            "enabled": False,
            "eyebrow": "Complete the look",
            "title": "Glow + Color in one routine.",
            "subtitle": "Pair our skincare actives with our makeup for a healthy-skin finish.",
            "button_label": "Start Routine Builder",
            "button_link": "/routine",
            "bg_from": "#be185d",
            "bg_via": "#9d174d",
            "bg_to": "#831843",
        },
        "show_category_strip": True,
        "category_strip_title": "Shop by Category",
        "category_strip_subtitle": "Lip · Eye · Brow · Face",
        "show_reviews": False,
        "show_dermatologist": False,
        "show_faq": False,
        "show_complete_kit": False,
    },
}


async def auto_flip_launched_products_FORWARD_DECL_REMOVED(db):
    pass  # placeholder


# All products default to LIVE (orderable). Admin can manually flip individual products
# to TBL via the admin product editor when needed.
LIVE_PRODUCT_SLUGS = None  # None = all live; set to a set of slugs to restrict


async def migrate_products_tbl_and_images(db):
    """Set TBL status, launch dates, sample images on products. Idempotent — only adds missing data."""
    now = datetime.now(timezone.utc)
    default_launch = (now + timedelta(days=25)).isoformat()

    products = await db.products.find({}, {"_id": 0}).to_list(200)
    updated = 0
    for p in products:
        slug = p.get("slug")
        update = {}

        # Helper: a slug is "live" if LIVE_PRODUCT_SLUGS is None (all live) or contains the slug
        is_live = (LIVE_PRODUCT_SLUGS is None) or (slug in LIVE_PRODUCT_SLUGS)

        # TBL fields — only set if missing (idempotent)
        if "is_to_be_launched" not in p:
            update["is_to_be_launched"] = not is_live
        if "launch_date" not in p:
            update["launch_date"] = None if is_live else default_launch
        if "preorder_enabled" not in p:
            update["preorder_enabled"] = not is_live
        if "preorder_count" not in p:
            update["preorder_count"] = 0

        # Sample images — only set if currently empty
        if not p.get("images") and slug in PRODUCT_IMAGE_MAP:
            update["images"] = PRODUCT_IMAGE_MAP[slug]

        # Auto-flip TBL → launched if launch_date passed
        existing_launched = p.get("is_to_be_launched")
        existing_date = p.get("launch_date")
        if existing_launched and existing_date:
            try:
                ld = datetime.fromisoformat(existing_date.replace("Z", "+00:00"))
                if ld <= now:
                    update["is_to_be_launched"] = False
                    update["launch_date"] = None
            except Exception:
                pass

        if update:
            update["updated_at"] = now.isoformat()
            await db.products.update_one({"slug": slug}, {"$set": update})
            updated += 1

    if updated:
        logging.info(f"[migration] TBL/images updated for {updated} products")
    return updated


async def migrate_banner_carousel(db):
    """Ensure site_settings has banner_carousel + homepage feature image + niche_settings. Idempotent."""
    settings = await db.site_settings.find_one({"_id": "main"}, {"_id": 0}) or {}
    update = {}

    if not (isinstance(settings.get("banner_carousel"), list) and len(settings.get("banner_carousel", [])) > 0):
        update["banner_carousel"] = DEFAULT_BANNERS
        update["carousel_autoplay_ms"] = 2000

    if not settings.get("homepage_feature_image"):
        update["homepage_feature_image"] = DEFAULT_HOMEPAGE_FEATURE_IMAGE
    if not settings.get("homepage_feature_title"):
        update["homepage_feature_title"] = DEFAULT_HOMEPAGE_FEATURE_TITLE
    if not settings.get("homepage_feature_subtitle"):
        update["homepage_feature_subtitle"] = DEFAULT_HOMEPAGE_FEATURE_SUBTITLE

    # Seed/merge niche_settings — never overwrite existing customizations,
    # but add any missing top-level niche keys so all 3 niches always exist.
    existing_ns = settings.get("niche_settings") or {}
    if not isinstance(existing_ns, dict):
        existing_ns = {}
    needs_seed = any(k not in existing_ns for k in DEFAULT_NICHE_SETTINGS.keys())
    if needs_seed:
        merged = {**existing_ns}
        for k, v in DEFAULT_NICHE_SETTINGS.items():
            if k not in merged:
                merged[k] = v
        update["niche_settings"] = merged

    if not update:
        return 0
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.site_settings.update_one({"_id": "main"}, {"$set": update}, upsert=True)
    logging.info(f"[migration] Initialized site settings: keys={list(update.keys())}")
    return len(update)


async def migrate_product_inventory(db):
    """Add stock_qty + low_stock_threshold to products if missing. Idempotent."""
    now = datetime.now(timezone.utc).isoformat()
    products = await db.products.find({}, {"_id": 0, "slug": 1, "stock_qty": 1, "low_stock_threshold": 1}).to_list(200)
    updated = 0
    for p in products:
        upd = {}
        if "stock_qty" not in p or p.get("stock_qty") is None:
            upd["stock_qty"] = 100
        if "low_stock_threshold" not in p or p.get("low_stock_threshold") is None:
            upd["low_stock_threshold"] = 10
        if upd:
            upd["updated_at"] = now
            await db.products.update_one({"slug": p["slug"]}, {"$set": upd})
            updated += 1
    if updated:
        logging.info(f"[migration] inventory fields added to {updated} products")
    return updated


async def migrate_concern_category_niche(db):
    """Backfill niche field on concerns + categories. Idempotent."""
    now = datetime.now(timezone.utc).isoformat()
    AGING_CONCERN_SLUGS = {"early-aging", "anti-aging", "fine-lines", "wrinkles", "firming"}
    c_updated = 0
    async for c in db.concerns.find(
        {"$or": [{"niche": {"$exists": False}}, {"niche": None}, {"niche": ""}]},
        {"_id": 0, "slug": 1}
    ):
        slug = c.get("slug", "")
        niche = "anti-aging" if slug in AGING_CONCERN_SLUGS else "skincare"
        await db.concerns.update_one({"slug": slug}, {"$set": {"niche": niche, "updated_at": now}})
        c_updated += 1
    cat_updated = 0
    async for c in db.categories.find(
        {"$or": [{"niche": {"$exists": False}}, {"niche": None}, {"niche": ""}]},
        {"_id": 0, "slug": 1, "group": 1}
    ):
        slug = c.get("slug", "")
        group = c.get("group", "skincare")
        niche = "cosmetics" if group == "cosmetics" else "skincare"
        await db.categories.update_one({"slug": slug}, {"$set": {"niche": niche, "updated_at": now}})
        cat_updated += 1
    if c_updated or cat_updated:
        logging.info(f"[migration] niche backfill: concerns={c_updated}, categories={cat_updated}")
    return c_updated + cat_updated


async def migrate_combos_tbl_and_images(db):
    """Set TBL + sample images on combos. Idempotent — only adds missing data.
    Combos default to LIVE (admin can flip to TBL manually)."""
    now = datetime.now(timezone.utc)
    combos = await db.combos.find({}, {"_id": 0}).to_list(100)
    updated = 0
    for c in combos:
        cid = c.get("combo_id")
        update = {}
        if "is_to_be_launched" not in c:
            # Combos default to LIVE — admin can manually flip via admin panel
            update["is_to_be_launched"] = False
        if "launch_date" not in c:
            update["launch_date"] = None
        if "preorder_enabled" not in c:
            update["preorder_enabled"] = False
        if not c.get("image") and cid in COMBO_IMAGE_MAP:
            update["image"] = COMBO_IMAGE_MAP[cid]

        # Auto-flip TBL → launched if launch_date passed
        if c.get("is_to_be_launched") and c.get("launch_date"):
            try:
                ld = datetime.fromisoformat(str(c["launch_date"]).replace("Z", "+00:00"))
                if ld <= now:
                    update["is_to_be_launched"] = False
                    update["launch_date"] = None
            except Exception:
                pass

        if update:
            update["updated_at"] = now.isoformat()
            await db.combos.update_one({"combo_id": cid}, {"$set": update})
            updated += 1
    if updated:
        logging.info(f"[migration] TBL/images updated for {updated} combos")
    return updated


async def auto_flip_launched_products(db):
    """On every read-heavy startup, flip TBL → launched for any product whose launch_date passed."""
    now = datetime.now(timezone.utc)
    cursor = db.products.find(
        {"is_to_be_launched": True, "launch_date": {"$ne": None, "$exists": True}},
        {"_id": 0, "slug": 1, "launch_date": 1}
    )
    flipped = 0
    async for p in cursor:
        try:
            ld = datetime.fromisoformat(str(p.get("launch_date", "")).replace("Z", "+00:00"))
            if ld <= now:
                await db.products.update_one(
                    {"slug": p["slug"]},
                    {"$set": {
                        "is_to_be_launched": False,
                        "launch_date": None,
                        "updated_at": now.isoformat()
                    }}
                )
                flipped += 1
        except Exception:
            continue
    if flipped:
        logging.info(f"[migration] Auto-flipped {flipped} TBL products to launched")
    return flipped


async def migrate_minimum_reviews_count(db):
    """Ensure every product has reviews_count >= 1000 so product cards never look empty.
    Idempotent — only bumps products below the threshold."""
    import random
    updated = 0
    async for p in db.products.find(
        {"$or": [
            {"reviews_count": {"$exists": False}},
            {"reviews_count": None},
            {"reviews_count": {"$lt": 1000}},
        ]},
        {"_id": 0, "slug": 1, "reviews_count": 1}
    ):
        new_count = random.randint(1020, 4875)
        await db.products.update_one(
            {"slug": p["slug"]},
            {"$set": {"reviews_count": new_count}}
        )
        updated += 1
    if updated:
        logging.info(f"[migration] bumped reviews_count >= 1000 for {updated} products")
    return updated


async def migrate_coupons_show_on_cart(db):
    """Ensure auto-generated coupons (WELCOME50, monthly codes) have show_on_cart=True
    so they appear on the cart page. Backfill missing descriptions too."""
    cursor = db.coupons.find({}, {"_id": 0})
    backfilled = 0
    async for c in cursor:
        patch = {}
        if c.get("show_on_cart") is None:
            patch["show_on_cart"] = True
        if not c.get("description"):
            dv = c.get("discount_value", 0)
            if c.get("discount_type") == "percentage":
                desc = f"{int(dv)}% OFF"
            else:
                desc = f"Flat ₹{int(dv)} OFF"
            if c.get("min_order_amount"):
                desc += f" on orders above ₹{int(c['min_order_amount'])}"
            patch["description"] = desc
        if patch:
            await db.coupons.update_one({"code": c["code"]}, {"$set": patch})
            backfilled += 1
    if backfilled:
        logging.info(f"[migration] coupons: backfilled show_on_cart/description on {backfilled} coupons")


async def migrate_repair_anti_aging_serum(db):
    """Repair the `anti-aging-serum` product doc ONLY when it exactly matches
    the "Gentle Cleanser overwrite" corruption pattern and the repair has
    never run before.

    History:
      - A bad admin edit copied Gentle Cleanser fields onto the anti-aging-serum
        slug and that state was baked into the Cloudinary catalog snapshot.
      - We used to force-restore the doc on every boot. That silently wiped
        every legitimate admin change (name, price, images) after deploy.

    New behaviour (safe):
      - Skip entirely if the one-time flag is set on admin_settings.
      - Otherwise repair ONLY if the doc's name/short_name literally contains
        "Gentle Cleanser" — the exact corruption fingerprint. Any other value
        means the admin has intentionally renamed the product and we must not
        touch it.
      - After a successful repair, persist the flag so the migration never
        runs again on this DB.
    """
    flags_doc = await db.admin_settings.find_one({"type": "migration_flags"}, {"_id": 0}) or {}
    if flags_doc.get("anti_aging_serum_repaired"):
        return  # already ran once — never touch admin data again
    doc = await db.products.find_one({"slug": "anti-aging-serum"}, {"_id": 0})
    if not doc:
        return
    name = str(doc.get("name") or "")
    short = str(doc.get("short_name") or "")
    # Exact corruption fingerprint: both name and short_name contain "Gentle Cleanser"
    is_corrupted = ("Gentle Cleanser" in name) and ("Gentle Cleanser" in short)
    if not is_corrupted:
        # Doc is either canonical or has been legitimately edited — set the
        # flag so we never touch it again.
        await db.admin_settings.update_one(
            {"type": "migration_flags"},
            {"$set": {"anti_aging_serum_repaired": True, "reason": "doc_not_corrupted"}},
            upsert=True,
        )
        return
    from datetime import datetime, timezone as _tz
    patch = {
        "name": "Celesta Glow Advanced Face Serum",
        "short_name": "Anti-Aging Serum",
        "tagline": "Anti-Aging + Brightening Formula",
        "category": "serum",
        "key_ingredients": "Niacinamide + Alpha Arbutin + Vitamin C",
        "benefits": [
            "Reduces Dullness & Dark Spots",
            "Supports Firm, Youthful Skin",
            "Brightens & Evens Skin Tone",
            "Lightweight Daily Use Formula",
        ],
        "size": "30ml / 1.01 fl oz",
        "mrp": 1699,
        "prepaid_price": 999,
        "cod_price": 1099,
        "cod_advance": 29,
        "discount_percent": 41,
        "badge": "Bestseller",
        "rating": 4.8,
        "reviews_count": max(int(doc.get("reviews_count") or 0), 2847),
        "skin_type": "All Skin Types",
        "sort_order": 1,
        "is_active": True,
        "niche": "anti-aging",
        "updated_at": datetime.now(_tz.utc).isoformat(),
    }
    await db.products.update_one({"slug": "anti-aging-serum"}, {"$set": patch})
    await db.admin_settings.update_one(
        {"type": "migration_flags"},
        {"$set": {"anti_aging_serum_repaired": True, "reason": "corruption_repaired_once"}},
        upsert=True,
    )
    logging.info("[migration] repaired corrupted anti-aging-serum document (one-time, flag persisted)")


async def run_all_migrations(db):
    """Run all migrations on startup. Safe to run repeatedly."""
    try:
        await migrate_products_tbl_and_images(db)
        await migrate_combos_tbl_and_images(db)
        await migrate_banner_carousel(db)
        await migrate_product_inventory(db)
        await migrate_concern_category_niche(db)
        await migrate_minimum_reviews_count(db)
        await migrate_coupons_show_on_cart(db)
        await migrate_repair_anti_aging_serum(db)
        await auto_flip_launched_products(db)
        logging.info("[migration] All migrations completed successfully")
    except Exception as e:
        logging.error(f"[migration] Failed: {e}", exc_info=True)
