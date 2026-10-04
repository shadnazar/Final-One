"""Comprehensive Celesta Glow taxonomy seed.

Seeds the user-specified canonical taxonomy:
  • Skincare CONCERNS — grouped (Acne, Pigmentation, Dryness, Oil, Aging,
    Sensitivity, Texture, Brightening, Under-eye, Hydration, Conditions,
    Sun-protection, Men's).
  • Skincare CATEGORIES (top-level "Product Types") with their proper
    SUBCATEGORIES (sub-filters that show under each category page).
  • Cosmetics CATEGORIES with subcategories.

Idempotent — only inserts rows that don't already exist (by slug).
Run via admin endpoint `/api/admin/taxonomy/seed-comprehensive` so the AI
audit then has a rich canonical list to route products into.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- SKINCARE concerns ----------------
# (slug, name, group, icon)
SKINCARE_CONCERNS = [
    # Acne & breakouts
    ("acne-breakouts", "Acne & Breakouts", "Acne", "💢"),
    ("pimples", "Pimples", "Acne", "🔴"),
    ("cystic-acne", "Cystic Acne", "Acne", "💢"),
    ("whiteheads", "Whiteheads", "Acne", "⚪"),
    ("blackheads", "Blackheads", "Acne", "⚫"),
    ("hormonal-acne", "Hormonal Acne", "Acne", "🌙"),
    ("acne-scars", "Acne Scars", "Acne", "🩹"),
    ("bacne", "Bacne (Body Acne)", "Acne", "🫀"),
    # Pigmentation
    ("dark-spots", "Dark Spots", "Pigmentation", "⚫"),
    ("hyperpigmentation", "Hyperpigmentation", "Pigmentation", "🟤"),
    ("melasma", "Melasma", "Pigmentation", "🟫"),
    ("post-acne-marks", "Post-acne Marks", "Pigmentation", "🌑"),
    ("uneven-skin-tone", "Uneven Skin Tone", "Pigmentation", "🎭"),
    ("tanning", "Tanning", "Pigmentation", "🏖️"),
    ("sun-damage", "Sun Damage", "Pigmentation", "☀️"),
    # Dryness
    ("dry-skin", "Dry Skin", "Dryness", "🏜️"),
    ("flaky-skin", "Flaky Skin", "Dryness", "❄️"),
    ("dehydrated-skin", "Dehydrated Skin", "Dryness", "💧"),
    ("rough-texture", "Rough Texture", "Dryness", "🪨"),
    ("tight-skin-barrier", "Tight Skin Barrier", "Dryness", "🛡️"),
    # Oil
    ("oily-skin", "Oily Skin", "Oil Control", "💧"),
    ("excess-sebum", "Excess Sebum", "Oil Control", "🛢️"),
    ("greasy-tzone", "Greasy T-Zone", "Oil Control", "✨"),
    ("enlarged-pores", "Enlarged Pores", "Oil Control", "🕳️"),
    # Aging
    ("fine-lines", "Fine Lines", "Aging", "🪞"),
    ("wrinkles", "Wrinkles", "Aging", "🌊"),
    ("sagging-skin", "Sagging Skin", "Aging", "🪂"),
    ("loss-of-elasticity", "Loss of Elasticity", "Aging", "🎈"),
    ("crows-feet", "Crow’s Feet", "Aging", "🦅"),
    ("neck-aging", "Neck Aging", "Aging", "👔"),
    # Sensitivity
    ("sensitive-skin", "Sensitive Skin", "Sensitivity", "🌸"),
    ("redness", "Redness", "Sensitivity", "🟥"),
    ("irritation", "Irritation", "Sensitivity", "⚠️"),
    ("burning-sensation", "Burning Sensation", "Sensitivity", "🔥"),
    ("damaged-barrier", "Damaged Skin Barrier", "Sensitivity", "🛡️"),
    ("allergic-reactions", "Allergic Reactions", "Sensitivity", "🤧"),
    # Texture & pores
    ("open-pores", "Open Pores", "Texture", "🕳️"),
    ("bumpy-skin", "Bumpy Skin", "Texture", "🪨"),
    ("uneven-texture", "Uneven Texture", "Texture", "📐"),
    ("congested-skin", "Congested Skin", "Texture", "🚧"),
    # Brightening
    ("dull-skin", "Dull Skin", "Brightening", "🌫️"),
    ("lack-of-glow", "Lack of Glow", "Brightening", "✨"),
    ("tired-looking-skin", "Tired-looking Skin", "Brightening", "😴"),
    ("brightening", "Brightening", "Brightening", "💡"),
    # Under-eye
    ("dark-circles", "Dark Circles", "Under-Eye", "🌑"),
    ("puffy-eyes", "Puffy Eyes", "Under-Eye", "👁️"),
    ("eye-bags", "Eye Bags", "Under-Eye", "👜"),
    ("under-eye-fine-lines", "Fine Lines Under Eyes", "Under-Eye", "🪞"),
    # Barrier / hydration
    ("weak-barrier", "Weak Barrier", "Hydration", "🛡️"),
    ("moisture-loss", "Moisture Loss", "Hydration", "💧"),
    ("skin-repair", "Skin Repair", "Hydration", "🩹"),
    ("hydration", "Hydration", "Hydration", "💦"),
    # Conditions
    ("eczema", "Eczema", "Skin Conditions", "🩹"),
    ("psoriasis", "Psoriasis", "Skin Conditions", "🩹"),
    ("rosacea", "Rosacea", "Skin Conditions", "🌹"),
    ("fungal-acne", "Fungal Acne", "Skin Conditions", "🍄"),
    ("dermatitis", "Dermatitis", "Skin Conditions", "🩹"),
    # Sun
    ("uv-damage", "UV Damage", "Sun Protection", "☀️"),
    ("photoaging", "Photoaging", "Sun Protection", "📸"),
    ("sunburn", "Sunburn", "Sun Protection", "🔥"),
    ("sun-protection", "Sun Protection", "Sun Protection", "🧴"),
    # Men's
    ("razor-bumps", "Razor Bumps", "Men", "🪒"),
    ("ingrown-hair", "Ingrown Hair", "Men", "🪒"),
    ("post-shave-irritation", "Post-shave Irritation", "Men", "🪒"),
]

# ---------------- SKINCARE CATEGORIES + SUBCATEGORIES ----------------
# {category_slug: {"name": ..., "icon": ..., "subs": [(slug, name), ...]}}
SKINCARE_CATEGORIES = {
    "cleansers": {"name": "Cleansers", "icon": "🧼", "subs": [
        ("face-wash", "Face Wash"),
        ("gel-cleanser", "Gel Cleanser"),
        ("foam-cleanser", "Foam Cleanser"),
        ("cream-cleanser", "Cream Cleanser"),
        ("oil-cleanser", "Oil Cleanser"),
        ("micellar-water", "Micellar Water"),
        ("cleansing-balm", "Cleansing Balm"),
    ]},
    "exfoliators": {"name": "Exfoliators", "icon": "✨", "subs": [
        ("face-scrub", "Face Scrub"),
        ("chemical-exfoliant", "Chemical Exfoliant"),
        ("aha-exfoliant", "AHA Exfoliant"),
        ("bha-exfoliant", "BHA Exfoliant"),
        ("peeling-solution", "Peeling Solution"),
        ("enzyme-peel", "Enzyme Peel"),
    ]},
    "toners-mists": {"name": "Toners & Mists", "icon": "💦", "subs": [
        ("toner", "Toner"),
        ("face-mist", "Face Mist"),
        ("hydrating-mist", "Hydrating Mist"),
        ("exfoliating-toner", "Exfoliating Toner"),
    ]},
    "serums-treatments": {"name": "Serums & Treatments", "icon": "🧪", "subs": [
        ("vitamin-c-serum", "Vitamin C Serum"),
        ("hyaluronic-acid-serum", "Hyaluronic Acid Serum"),
        ("niacinamide-serum", "Niacinamide Serum"),
        ("retinol-serum", "Retinol Serum"),
        ("salicylic-acid-serum", "Salicylic Acid Serum"),
        ("peptide-serum", "Peptide Serum"),
        ("brightening-serum", "Brightening Serum"),
        ("anti-acne-serum", "Anti-Acne Serum"),
    ]},
    "moisturizers": {"name": "Moisturizers", "icon": "💧", "subs": [
        ("gel-moisturizer", "Gel Moisturizer"),
        ("cream-moisturizer", "Cream Moisturizer"),
        ("lotion", "Lotion"),
        ("night-cream", "Night Cream"),
        ("barrier-repair-cream", "Barrier Repair Cream"),
    ]},
    "sunscreens": {"name": "Sunscreens", "icon": "☀️", "subs": [
        ("gel-sunscreen", "Gel Sunscreen"),
        ("cream-sunscreen", "Cream Sunscreen"),
        ("mineral-sunscreen", "Mineral Sunscreen"),
        ("tinted-sunscreen", "Tinted Sunscreen"),
        ("spray-sunscreen", "Spray Sunscreen"),
        ("stick-sunscreen", "Stick Sunscreen"),
    ]},
    "masks-packs": {"name": "Masks & Packs", "icon": "🧖", "subs": [
        ("clay-mask", "Clay Mask"),
        ("sheet-mask", "Sheet Mask"),
        ("sleeping-mask", "Sleeping Mask"),
        ("peel-off-mask", "Peel-off Mask"),
        ("mud-mask", "Mud Mask"),
        ("hydrating-mask", "Hydrating Mask"),
    ]},
    "spot-treatments": {"name": "Spot Treatments", "icon": "🎯", "subs": [
        ("acne-patch", "Acne Patch"),
        ("spot-corrector", "Spot Corrector"),
        ("pimple-gel", "Pimple Gel"),
        ("scar-treatment", "Scar Treatment"),
    ]},
    "eye-care": {"name": "Eye Care", "icon": "👁️", "subs": [
        ("eye-cream", "Eye Cream"),
        ("eye-gel", "Eye Gel"),
        ("under-eye-patch", "Under Eye Patch"),
    ]},
    "lip-care": {"name": "Lip Care", "icon": "💋", "subs": [
        ("lip-balm", "Lip Balm"),
        ("lip-mask", "Lip Mask"),
        ("lip-scrub", "Lip Scrub"),
        ("lip-oil", "Lip Oil"),
    ]},
    "face-oils": {"name": "Face Oils", "icon": "🫒", "subs": [
        ("facial-oil", "Facial Oil"),
        ("overnight-oil", "Overnight Oil"),
        ("glow-oil", "Glow Oil"),
    ]},
    "essences-ampoules": {"name": "Essences & Ampoules", "icon": "💎", "subs": [
        ("essence", "Essence"),
        ("ampoule", "Ampoule"),
        ("booster", "Booster"),
    ]},
    "skin-repair-barrier": {"name": "Skin Repair & Barrier Care", "icon": "🛡️", "subs": [
        ("cica-cream", "Cica Cream"),
        ("ceramide-cream", "Ceramide Cream"),
        ("recovery-balm", "Recovery Balm"),
    ]},
    "brightening-products": {"name": "Brightening Products", "icon": "💡", "subs": [
        ("pigmentation-cream", "Pigmentation Cream"),
        ("dark-spot-corrector", "Dark Spot Corrector"),
        ("glow-cream", "Glow Cream"),
    ]},
    "anti-aging-products": {"name": "Anti-Aging Products", "icon": "⏳", "subs": [
        ("retinol-cream", "Retinol Cream"),
        ("firming-cream", "Firming Cream"),
        ("wrinkle-treatment", "Wrinkle Treatment"),
    ]},
    "body-skincare": {"name": "Body Skincare", "icon": "🛁", "subs": [
        ("body-lotion", "Body Lotion"),
        ("body-butter", "Body Butter"),
        ("body-wash", "Body Wash"),
        ("body-scrub", "Body Scrub"),
        ("body-oil", "Body Oil"),
        ("hand-cream", "Hand Cream"),
        ("foot-cream", "Foot Cream"),
    ]},
    "specialized-products": {"name": "Specialized Skin Care", "icon": "🔬", "subs": [
        ("pore-minimizer", "Pore Minimizer"),
        ("makeup-remover-skincare", "Makeup Remover"),
        ("cleansing-wipes", "Cleansing Wipes"),
        ("facial-roller", "Facial Roller"),
        ("ice-globes", "Ice Globes"),
        ("led-mask-devices", "LED Mask Devices"),
    ]},
}

# ---------------- COSMETICS CATEGORIES + SUBCATEGORIES ----------------
COSMETICS_CATEGORIES = {
    # Face family
    "face-primer": {"name": "Face Primer", "icon": "🎨", "subs": [
        ("pore-blurring-primer", "Pore Blurring"),
        ("hydrating-primer", "Hydrating"),
        ("mattifying-primer", "Mattifying"),
        ("colour-correcting-primer", "Colour Correcting"),
    ]},
    "concealer": {"name": "Concealer", "icon": "🖌️", "subs": [
        ("liquid-concealer", "Liquid"),
        ("stick-concealer", "Stick"),
        ("colour-corrector", "Colour Corrector"),
        ("under-eye-concealer", "Under-Eye"),
    ]},
    "foundation": {"name": "Foundation", "icon": "🧴", "subs": [
        ("matte-foundation", "Matte"),
        ("dewy-foundation", "Dewy"),
        ("liquid-foundation", "Liquid"),
        ("powder-foundation", "Powder"),
        ("stick-foundation", "Stick"),
        ("waterproof-foundation", "Waterproof"),
    ]},
    "compact": {"name": "Compact", "icon": "🪞", "subs": [
        ("pressed-powder", "Pressed Powder"),
        ("oil-control-compact", "Oil Control"),
    ]},
    "contour": {"name": "Contour", "icon": "🌗", "subs": [
        ("powder-contour", "Powder Contour"),
        ("cream-contour", "Cream Contour"),
        ("stick-contour", "Stick Contour"),
    ]},
    "loose-powder": {"name": "Loose Powder", "icon": "🌸", "subs": [
        ("translucent-powder", "Translucent"),
        ("setting-powder", "Setting"),
        ("finishing-powder", "Finishing"),
    ]},
    "blush": {"name": "Blush", "icon": "🌹", "subs": [
        ("powder-blush", "Powder Blush"),
        ("cream-blush", "Cream Blush"),
        ("liquid-blush", "Liquid Blush"),
        ("blush-stick", "Stick Blush"),
    ]},
    "bb-cc-cream": {"name": "BB & CC Cream", "icon": "🧪", "subs": [
        ("bb-cream", "BB Cream"),
        ("cc-cream", "CC Cream"),
    ]},
    "highlighters": {"name": "Highlighters", "icon": "✨", "subs": [
        ("liquid-highlighter", "Liquid"),
        ("powder-highlighter", "Powder"),
        ("stick-highlighter", "Stick"),
    ]},
    "setting-spray": {"name": "Setting Spray", "icon": "💨", "subs": [
        ("matte-finish-spray", "Matte Finish"),
        ("dewy-finish-spray", "Dewy Finish"),
    ]},
    "makeup-remover": {"name": "Makeup Remover", "icon": "🧽", "subs": [
        ("micellar-water-remover", "Micellar Water"),
        ("oil-remover", "Cleansing Oil"),
        ("wipes-remover", "Cleansing Wipes"),
    ]},
    "tinted-moisturizer": {"name": "Tinted Moisturizer", "icon": "💧", "subs": [
        ("sheer-tint", "Sheer Tint"),
        ("medium-coverage-tint", "Medium Coverage"),
    ]},
    "bronzer": {"name": "Bronzer", "icon": "🌞", "subs": [
        ("matte-bronzer", "Matte"),
        ("shimmer-bronzer", "Shimmer"),
    ]},
    # Lips family
    "lipstick": {"name": "Lipstick", "icon": "💋", "subs": [
        ("matte-lipstick", "Matte"),
        ("creamy-lipstick", "Creamy"),
        ("satin-lipstick", "Satin"),
        ("nude-lipstick", "Nude"),
        ("red-lipstick", "Red"),
        ("luxury-lipstick", "Luxury"),
    ]},
    "liquid-lipstick": {"name": "Liquid Lipstick", "icon": "💄", "subs": [
        ("matte-liquid", "Matte"),
        ("transfer-proof", "Transfer-proof"),
        ("glossy-liquid", "Glossy"),
    ]},
    "lip-crayon": {"name": "Lip Crayon", "icon": "🖍️", "subs": [
        ("matte-crayon", "Matte"),
        ("creamy-crayon", "Creamy"),
    ]},
    "lip-gloss": {"name": "Lip Gloss", "icon": "💧", "subs": [
        ("clear-gloss", "Clear"),
        ("tinted-gloss", "Tinted"),
        ("plumping-gloss", "Plumping"),
    ]},
    "lip-liner": {"name": "Lip Liner", "icon": "✏️", "subs": [
        ("nude-liner", "Nude"),
        ("red-liner", "Red"),
        ("brown-liner", "Brown"),
    ]},
    "lip-tint": {"name": "Lip Tint", "icon": "🍒", "subs": [
        ("water-tint", "Water Tint"),
        ("velvet-tint", "Velvet Tint"),
        ("gel-tint", "Gel Tint"),
    ]},
    # Eyes
    "kajal": {"name": "Kajal", "icon": "👁️", "subs": [
        ("waterproof-kajal", "Waterproof"),
        ("smudge-proof-kajal", "Smudge-proof"),
        ("coloured-kajal", "Coloured"),
    ]},
    "eyeliner": {"name": "Eyeliner", "icon": "🖋️", "subs": [
        ("liquid-eyeliner", "Liquid"),
        ("gel-eyeliner", "Gel"),
        ("pencil-eyeliner", "Pencil"),
        ("waterproof-eyeliner", "Waterproof"),
    ]},
    "mascara": {"name": "Mascara", "icon": "👀", "subs": [
        ("volume-mascara", "Volume"),
        ("length-mascara", "Length"),
        ("curling-mascara", "Curling"),
        ("waterproof-mascara", "Waterproof"),
    ]},
    "eye-shadow": {"name": "Eye Shadow", "icon": "🎨", "subs": [
        ("shimmer-shadow", "Shimmer"),
        ("matte-shadow", "Matte"),
        ("palette-shadow", "Palette"),
        ("single-shadow", "Single Pan"),
    ]},
    "eye-brow": {"name": "Eye Brow Enhancers", "icon": "🪶", "subs": [
        ("brow-pencil", "Brow Pencil"),
        ("brow-gel", "Brow Gel"),
        ("brow-powder", "Brow Powder"),
    ]},
    "false-lashes": {"name": "False Eyelashes", "icon": "👁️", "subs": [
        ("magnetic-lashes", "Magnetic"),
        ("strip-lashes", "Strip"),
        ("individual-lashes", "Individual"),
    ]},
    # Nails
    "nail-polish": {"name": "Nail Polish", "icon": "💅", "subs": [
        ("matte-nail", "Matte"),
        ("glossy-nail", "Glossy"),
        ("gel-nail", "Gel"),
        ("nail-art", "Nail Art"),
    ]},
    # Tools
    "makeup-brush": {"name": "Makeup Brushes", "icon": "🖌️", "subs": [
        ("face-brush", "Face Brush"),
        ("eye-brush", "Eye Brush"),
        ("blush-brush", "Blush Brush"),
        ("brush-set", "Brush Set"),
    ]},
    "beauty-sponge": {"name": "Sponges & Applicators", "icon": "🧽", "subs": [
        ("beauty-blender", "Beauty Blender"),
        ("powder-puff", "Powder Puff"),
        ("silicone-applicator", "Silicone"),
    ]},
    "accessories": {"name": "Accessories", "icon": "🎀", "subs": [
        ("eyelash-curler", "Eyelash Curler"),
        ("pencil-sharpener", "Pencil Sharpener"),
        ("makeup-mirror", "Makeup Mirror"),
    ]},
    "makeup-kits": {"name": "Kits & Combos", "icon": "🎁", "subs": [
        ("starter-kit", "Starter Kit"),
        ("bridal-kit", "Bridal Kit"),
        ("travel-kit", "Travel Kit"),
    ]},
}


async def seed_comprehensive_taxonomy(db) -> dict:
    """Idempotently seed the canonical taxonomy. Returns counts of insertions.

    Respects taxonomy tombstones: admin deletions survive every redeploy.
    """
    from services.taxonomy_tombstones import get_tombstoned_slugs
    counts = {"concerns": 0, "categories": 0, "subcategories": 0}
    tombs_concerns = await get_tombstoned_slugs(db, "concern")
    tombs_categories = await get_tombstoned_slugs(db, "category")
    tombs_subcategories = await get_tombstoned_slugs(db, "subcategory")

    # ----- Concerns -----
    existing_concern_slugs = set()
    async for c in db.concerns.find({}, {"_id": 0, "slug": 1}):
        existing_concern_slugs.add(c["slug"])
    to_insert = []
    for i, (slug, name, group, icon) in enumerate(SKINCARE_CONCERNS):
        if slug in existing_concern_slugs or slug in tombs_concerns:
            continue
        to_insert.append({
            "slug": slug,
            "name": name,
            "tagline": "",
            "icon": icon,
            "image": "",
            "accent_from": "#dcfce7",
            "accent_to": "#bbf7d0",
            "accent_text": "#14532d",
            "description": "",
            "sort_order": i,
            "is_active": True,
            "niche": "skincare",
            "concern_group": group,
            "seeded_by": "comprehensive_v1",
            "created_at": _now(),
        })
    if to_insert:
        await db.concerns.insert_many(to_insert, ordered=False)
        counts["concerns"] = len(to_insert)

    # ----- Skincare categories + their subs -----
    existing_cat_slugs = set()
    async for c in db.categories.find({}, {"_id": 0, "slug": 1}):
        existing_cat_slugs.add(c["slug"])
    existing_sub_slugs = set()
    async for c in db.subcategories.find({}, {"_id": 0, "slug": 1}):
        existing_sub_slugs.add(c["slug"])

    cats_to_insert = []
    subs_to_insert = []
    for order, (slug, info) in enumerate(SKINCARE_CATEGORIES.items()):
        if slug not in existing_cat_slugs and slug not in tombs_categories:
            cats_to_insert.append({
                "slug": slug,
                "name": info["name"],
                "tagline": "",
                "icon": info["icon"],
                "image": "",
                "sort_order": order,
                "is_active": True,
                "group": "skincare",
                "niche": "skincare",
                "is_parent": False,
                "seeded_by": "comprehensive_v1",
                "created_at": _now(),
            })
        for sub_order, (sub_slug, sub_name) in enumerate(info["subs"]):
            if sub_slug in existing_sub_slugs or sub_slug in tombs_subcategories:
                continue
            subs_to_insert.append({
                "slug": sub_slug,
                "name": sub_name,
                "parent_category": slug,
                "niche": "skincare",
                "tagline": "",
                "icon": "",
                "image": "",
                "sort_order": sub_order,
                "is_active": True,
                "accent_from": "#dcfce7",
                "accent_to": "#bbf7d0",
                "accent_text": "#14532d",
                "seeded_by": "comprehensive_v1",
                "created_at": _now(),
                "updated_at": _now(),
            })

    for order, (slug, info) in enumerate(COSMETICS_CATEGORIES.items()):
        if slug not in existing_cat_slugs and slug not in tombs_categories:
            cats_to_insert.append({
                "slug": slug,
                "name": info["name"],
                "tagline": "",
                "icon": info["icon"],
                "image": "",
                "sort_order": 100 + order,
                "is_active": True,
                "group": "cosmetics",
                "niche": "cosmetics",
                "is_parent": False,
                "seeded_by": "comprehensive_v1",
                "created_at": _now(),
            })
        for sub_order, (sub_slug, sub_name) in enumerate(info["subs"]):
            if sub_slug in existing_sub_slugs or sub_slug in tombs_subcategories:
                continue
            subs_to_insert.append({
                "slug": sub_slug,
                "name": sub_name,
                "parent_category": slug,
                "niche": "cosmetics",
                "tagline": "",
                "icon": "",
                "image": "",
                "sort_order": sub_order,
                "is_active": True,
                "accent_from": "#fef3c7",
                "accent_to": "#fde68a",
                "accent_text": "#78350f",
                "seeded_by": "comprehensive_v1",
                "created_at": _now(),
                "updated_at": _now(),
            })

    if cats_to_insert:
        await db.categories.insert_many(cats_to_insert, ordered=False)
        counts["categories"] = len(cats_to_insert)
    if subs_to_insert:
        await db.subcategories.insert_many(subs_to_insert, ordered=False)
        counts["subcategories"] = len(subs_to_insert)

    logger.info(f"[taxonomy_seed_v2] inserted {counts}")
    return counts
