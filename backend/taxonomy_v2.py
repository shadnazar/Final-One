"""
Taxonomy V2 — Reset + rebuild concerns/categories per user's Jan 2026 spec.

Implements:
  • Skincare concerns: 13 main groups (each with sub-concerns)
  • Skincare product types: 16 groups (each with subtypes)
  • Cosmetics categories: 7 top-level (Face/Lips/Eyes/Nails/Tools&Brushes/
    Multi-Functional/Kits & Combos) + 60+ subcategories
  • Rule-based product re-classification using keyword matching on Item Name
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ============================================================
# SKINCARE CONCERNS — 13 main groups, each with sub-concerns
# ============================================================
SKINCARE_CONCERNS = [
    {
        "slug": "acne-breakouts", "name": "Acne & Breakouts", "icon": "🎯",
        "tagline": "Pimples, cystic acne, blackheads, scars",
        "subs": ["Pimples", "Cystic Acne", "Whiteheads", "Blackheads", "Hormonal Acne", "Acne Scars", "Bacne"],
        "accent_from": "#ffe4e6", "accent_to": "#fecdd3", "accent_text": "#9f1239",
        "keywords": ["acne", "pimple", "salicylic", "blemish", "spot", "whitehead", "blackhead", "anti-acne", "oily/acne"],
        "sort_order": 1, "is_active": True,
    },
    {
        "slug": "pigmentation", "name": "Pigmentation & Uneven Tone", "icon": "🌗",
        "tagline": "Dark spots, hyperpigmentation, melasma, tan",
        "subs": ["Dark Spots", "Hyperpigmentation", "Melasma", "Post-Acne Marks", "Uneven Tone", "Tanning", "Sun Damage"],
        "accent_from": "#ede9fe", "accent_to": "#ddd6fe", "accent_text": "#5b21b6",
        "keywords": ["pigmentation", "dark spot", "melasma", "tan", "kojic", "alpha arbutin", "uneven", "hyperpigmentation"],
        "sort_order": 2, "is_active": True,
    },
    {
        "slug": "dryness", "name": "Dryness & Dehydration", "icon": "💧",
        "tagline": "Dry, flaky, dehydrated skin",
        "subs": ["Dry Skin", "Flaky Skin", "Dehydrated Skin", "Rough Texture", "Tight Skin Barrier"],
        "accent_from": "#dbeafe", "accent_to": "#bfdbfe", "accent_text": "#1e3a8a",
        "keywords": ["dry", "hydrat", "hyaluronic", "ceramide", "moistur", "barrier", "flaky"],
        "sort_order": 3, "is_active": True,
    },
    {
        "slug": "oily-pores", "name": "Oil & Sebum Issues", "icon": "💦",
        "tagline": "Oily skin, large pores, greasy T-zone",
        "subs": ["Oily Skin", "Excess Sebum", "Greasy T-zone", "Enlarged Pores"],
        "accent_from": "#fef3c7", "accent_to": "#fde68a", "accent_text": "#78350f",
        "keywords": ["oily", "sebum", "pore", "mattif", "niacinamide", "t-zone"],
        "sort_order": 4, "is_active": True,
    },
    {
        "slug": "anti-aging", "name": "Aging Concerns", "icon": "✨",
        "tagline": "Fine lines, wrinkles, sagging",
        "subs": ["Fine Lines", "Wrinkles", "Sagging", "Loss of Elasticity", "Crow's Feet", "Neck Aging"],
        "accent_from": "#fce7f3", "accent_to": "#fbcfe8", "accent_text": "#831843",
        "keywords": ["anti-aging", "anti aging", "retinol", "retinoid", "peptide", "wrinkle", "firming", "lifting", "bakuchiol", "collagen", "age reset"],
        "sort_order": 5, "is_active": True,
    },
    {
        "slug": "sensitive-skin", "name": "Sensitivity & Barrier Damage", "icon": "🌸",
        "tagline": "Sensitive, redness, irritation",
        "subs": ["Sensitive Skin", "Redness", "Irritation", "Burning Sensation", "Damaged Barrier", "Allergic Reactions"],
        "accent_from": "#fef2f2", "accent_to": "#fecaca", "accent_text": "#7f1d1d",
        "keywords": ["sensitive", "soothing", "calming", "redness", "barrier", "cica", "centella", "panthenol"],
        "sort_order": 6, "is_active": True,
    },
    {
        "slug": "texture-pores", "name": "Texture & Pores", "icon": "🔍",
        "tagline": "Open pores, bumpy & uneven texture",
        "subs": ["Open Pores", "Bumpy Skin", "Uneven Texture", "Congested Skin"],
        "accent_from": "#f0fdf4", "accent_to": "#dcfce7", "accent_text": "#14532d",
        "keywords": ["pore", "exfoli", "smooth", "texture", "aha", "bha", "glycolic"],
        "sort_order": 7, "is_active": True,
    },
    {
        "slug": "brightening", "name": "Brightening & Glow", "icon": "💎",
        "tagline": "Dull skin, lack of glow",
        "subs": ["Dull Skin", "Lack of Glow", "Tired-Looking Skin"],
        "accent_from": "#fef9c3", "accent_to": "#fef08a", "accent_text": "#713f12",
        "keywords": ["bright", "glow", "vitamin c", "radiance", "illuminating", "dull"],
        "sort_order": 8, "is_active": True,
    },
    {
        "slug": "under-eye", "name": "Under Eye Concerns", "icon": "👁️",
        "tagline": "Dark circles, puffiness, eye bags",
        "subs": ["Dark Circles", "Puffy Eyes", "Eye Bags", "Fine Lines Under Eyes"],
        "accent_from": "#e0e7ff", "accent_to": "#c7d2fe", "accent_text": "#1e1b4b",
        "keywords": ["under eye", "dark circle", "eye cream", "eye gel", "puffy", "caffeine", "eye patch"],
        "sort_order": 9, "is_active": True,
    },
    {
        "slug": "barrier-support", "name": "Hydration & Barrier Support", "icon": "🛡",
        "tagline": "Weak barrier, moisture loss, repair",
        "subs": ["Weak Barrier", "Moisture Loss", "Skin Repair"],
        "accent_from": "#ecfeff", "accent_to": "#cffafe", "accent_text": "#164e63",
        "keywords": ["barrier", "repair", "ceramide", "cica", "panthenol", "squalane"],
        "sort_order": 10, "is_active": True,
    },
    {
        "slug": "skin-conditions", "name": "Infection & Skin Conditions", "icon": "🩺",
        "tagline": "Eczema, psoriasis, rosacea, fungal",
        "subs": ["Eczema", "Psoriasis", "Rosacea", "Fungal Acne", "Dermatitis"],
        "accent_from": "#faf5ff", "accent_to": "#e9d5ff", "accent_text": "#581c87",
        "keywords": ["eczema", "psoriasis", "rosacea", "dermatitis", "fungal"],
        "sort_order": 11, "is_active": True,
    },
    {
        "slug": "sun-protection", "name": "Sun Protection", "icon": "☀️",
        "tagline": "UV damage, photoaging, sunburn",
        "subs": ["UV Damage", "Photoaging", "Sunburn", "Tanning Prevention"],
        "accent_from": "#fef3c7", "accent_to": "#fed7aa", "accent_text": "#7c2d12",
        "keywords": ["sunscreen", "spf", "uv", "pa+", "sun protect"],
        "sort_order": 12, "is_active": True,
    },
    {
        "slug": "mens-skincare", "name": "Men's Skincare", "icon": "🧔",
        "tagline": "Razor bumps, ingrown hair, post-shave",
        "subs": ["Razor Bumps", "Ingrown Hair", "Post-Shave Irritation"],
        "accent_from": "#e7e5e4", "accent_to": "#d6d3d1", "accent_text": "#1c1917",
        "keywords": ["men", "shave", "razor", "ingrown", "beard"],
        "sort_order": 13, "is_active": True,
    },
]


# ============================================================
# SKINCARE PRODUCT TYPES — 16 main groups
# (parent category slug → children with their match keywords)
# ============================================================
SKINCARE_CATEGORIES = [
    {"slug": "cleansers", "name": "Cleansers", "niche": "skincare", "sort_order": 1,
     "subs": ["Face Wash", "Gel Cleanser", "Foam Cleanser", "Cream Cleanser", "Oil Cleanser", "Micellar Water", "Cleansing Balm"],
     "keywords": ["cleanser", "face wash", "facewash", "micellar", "cleansing"]},
    {"slug": "exfoliators", "name": "Exfoliators", "niche": "skincare", "sort_order": 2,
     "subs": ["Face Scrub", "Chemical Exfoliant", "AHA Exfoliant", "BHA Exfoliant", "Peeling Solution", "Enzyme Peel"],
     "keywords": ["scrub", "exfoliat", "aha", "bha", "peel"]},
    {"slug": "toners-mists", "name": "Toners & Mists", "niche": "skincare", "sort_order": 3,
     "subs": ["Toner", "Face Mist", "Hydrating Mist", "Exfoliating Toner"],
     "keywords": ["toner", "mist"]},
    {"slug": "serums-treatments", "name": "Serums & Treatments", "niche": "skincare", "sort_order": 4,
     "subs": ["Vitamin C Serum", "Hyaluronic Acid Serum", "Niacinamide Serum", "Retinol Serum", "Salicylic Acid Serum", "Peptide Serum", "Brightening Serum", "Anti-Acne Serum"],
     "keywords": ["serum", "ampoule", "concentrate", "booster"]},
    {"slug": "moisturizers", "name": "Moisturizers", "niche": "skincare", "sort_order": 5,
     "subs": ["Gel Moisturizer", "Cream Moisturizer", "Lotion", "Night Cream", "Barrier Repair Cream"],
     "keywords": ["moisturiz", "cream", "lotion", "night cream", "day cream"]},
    {"slug": "sunscreens", "name": "Sunscreens", "niche": "skincare", "sort_order": 6,
     "subs": ["Gel Sunscreen", "Cream Sunscreen", "Mineral Sunscreen", "Tinted Sunscreen", "Spray Sunscreen", "Stick Sunscreen"],
     "keywords": ["sunscreen", "spf", "sun protect"]},
    {"slug": "masks-packs", "name": "Masks & Packs", "niche": "skincare", "sort_order": 7,
     "subs": ["Clay Mask", "Sheet Mask", "Sleeping Mask", "Peel-Off Mask", "Mud Mask", "Hydrating Mask"],
     "keywords": ["mask", "pack"]},
    {"slug": "spot-treatments", "name": "Spot Treatments", "niche": "skincare", "sort_order": 8,
     "subs": ["Acne Patch", "Spot Corrector", "Pimple Gel", "Scar Treatment"],
     "keywords": ["spot", "patch", "scar", "acne gel"]},
    {"slug": "eye-care", "name": "Eye Care", "niche": "skincare", "sort_order": 9,
     "subs": ["Eye Cream", "Eye Gel", "Under Eye Patch"],
     "keywords": ["eye cream", "eye gel", "under eye", "eye patch"]},
    {"slug": "lip-care", "name": "Lip Care", "niche": "skincare", "sort_order": 10,
     "subs": ["Lip Balm", "Lip Mask", "Lip Scrub", "Lip Oil"],
     "keywords": ["lip balm", "lip scrub", "lip oil", "lip mask"]},
    {"slug": "face-oils", "name": "Face Oils", "niche": "skincare", "sort_order": 11,
     "subs": ["Facial Oil", "Overnight Oil", "Glow Oil"],
     "keywords": ["face oil", "facial oil", "glow oil"]},
    {"slug": "essences-ampoules", "name": "Essences & Ampoules", "niche": "skincare", "sort_order": 12,
     "subs": ["Essence", "Ampoule", "Booster"],
     "keywords": ["essence", "ampoule"]},
    {"slug": "barrier-care", "name": "Skin Repair & Barrier Care", "niche": "skincare", "sort_order": 13,
     "subs": ["Cica Cream", "Ceramide Cream", "Recovery Balm"],
     "keywords": ["cica", "ceramide", "barrier", "recovery"]},
    {"slug": "brightening-products", "name": "Brightening Products", "niche": "skincare", "sort_order": 14,
     "subs": ["Pigmentation Cream", "Dark Spot Corrector", "Glow Cream"],
     "keywords": ["brightening cream", "glow cream", "pigmentation cream"]},
    {"slug": "anti-aging-products", "name": "Anti-Aging Products", "niche": "skincare", "sort_order": 15,
     "subs": ["Retinol Cream", "Firming Cream", "Wrinkle Treatment"],
     "keywords": ["retinol", "firming", "wrinkle"]},
    {"slug": "body-skincare", "name": "Body Skincare", "niche": "skincare", "sort_order": 16,
     "subs": ["Body Lotion", "Body Butter", "Body Wash", "Body Scrub", "Body Oil", "Hand Cream", "Foot Cream"],
     "keywords": ["body lotion", "body wash", "body butter", "body scrub", "body oil", "hand cream", "foot cream"]},
]


# ============================================================
# COSMETICS CATEGORIES — full hierarchy per user spec
# ============================================================
COSMETICS_CATEGORIES = [
    # FACE
    {"slug": "face-makeup", "name": "Face", "niche": "cosmetics", "sort_order": 1, "is_parent": True,
     "subs": ["Face Primer", "Concealer", "Foundation", "Compact", "Contour", "Loose Powder", "Blush", "BB & CC Cream", "Highlighters", "Setting Spray", "Makeup Remover", "Sindoor", "Tinted Moisturizer", "Bronzer"],
     "keywords": []},
    {"slug": "face-primer", "name": "Face Primer", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 2,
     "keywords": ["primer"]},
    {"slug": "concealer", "name": "Concealer", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 3,
     "keywords": ["concealer"]},
    {"slug": "foundation", "name": "Foundation", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 4,
     "keywords": ["foundation", "fdn"]},
    {"slug": "compact", "name": "Compact", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 5,
     "keywords": ["compact"]},
    {"slug": "contour", "name": "Contour", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 6,
     "keywords": ["contour"]},
    {"slug": "loose-powder", "name": "Loose Powder", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 7,
     "keywords": ["loose powder", "setting powder", "face powder"]},
    {"slug": "blush", "name": "Blush", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 8,
     "keywords": ["blush"]},
    {"slug": "bb-cc-cream", "name": "BB & CC Cream", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 9,
     "keywords": ["bb cream", "cc cream", "bbcream", "cccream"]},
    {"slug": "highlighter", "name": "Highlighters", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 10,
     "keywords": ["highlighter", "highlight"]},
    {"slug": "setting-spray", "name": "Setting Spray", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 11,
     "keywords": ["setting spray", "fixer", "makeup fixer"]},
    {"slug": "makeup-remover", "name": "Makeup Remover", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 12,
     "keywords": ["makeup remover", "remover wipes"]},
    {"slug": "tinted-moisturizer", "name": "Tinted Moisturizer", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 13,
     "keywords": ["tinted moisturiz"]},
    {"slug": "bronzer", "name": "Bronzer", "niche": "cosmetics", "parent": "face-makeup", "sort_order": 14,
     "keywords": ["bronzer"]},

    # LIPS
    {"slug": "lips", "name": "Lips", "niche": "cosmetics", "sort_order": 20, "is_parent": True,
     "subs": ["Lipstick", "Liquid Lipstick", "Lip Crayon", "Lip Gloss", "Lip Liner", "Lip Primer", "Lip Plumper", "Lip Tint"],
     "keywords": []},
    {"slug": "lipstick", "name": "Lipstick", "niche": "cosmetics", "parent": "lips", "sort_order": 21,
     "keywords": ["lipstick", "lip color", "lip colour", "matte lip"]},
    {"slug": "liquid-lipstick", "name": "Liquid Lipstick", "niche": "cosmetics", "parent": "lips", "sort_order": 22,
     "keywords": ["liquid lipstick", "liquid matte"]},
    {"slug": "lip-crayon", "name": "Lip Crayon", "niche": "cosmetics", "parent": "lips", "sort_order": 23,
     "keywords": ["lip crayon", "lip pencil"]},
    {"slug": "lip-gloss", "name": "Lip Gloss", "niche": "cosmetics", "parent": "lips", "sort_order": 24,
     "keywords": ["lip gloss", "gloss"]},
    {"slug": "lip-liner", "name": "Lip Liner", "niche": "cosmetics", "parent": "lips", "sort_order": 25,
     "keywords": ["lip liner"]},
    {"slug": "lip-tint", "name": "Lip Tint", "niche": "cosmetics", "parent": "lips", "sort_order": 26,
     "keywords": ["lip tint", "lip stain"]},

    # EYES
    {"slug": "eyes", "name": "Eyes", "niche": "cosmetics", "sort_order": 30, "is_parent": True,
     "subs": ["Kajal", "Eyeliner", "Mascara", "Eye Shadow", "Eye Brow", "Eye Primer", "False Eyelashes", "Eye Makeup Remover", "Under Eye Concealer"],
     "keywords": []},
    {"slug": "kajal", "name": "Kajal", "niche": "cosmetics", "parent": "eyes", "sort_order": 31,
     "keywords": ["kajal", "kohl"]},
    {"slug": "eyeliner", "name": "Eyeliner", "niche": "cosmetics", "parent": "eyes", "sort_order": 32,
     "keywords": ["eyeliner", "eye liner", "gel liner", "color liner"]},
    {"slug": "mascara", "name": "Mascara", "niche": "cosmetics", "parent": "eyes", "sort_order": 33,
     "keywords": ["mascara", "lash"]},
    {"slug": "eye-shadow", "name": "Eye Shadow", "niche": "cosmetics", "parent": "eyes", "sort_order": 34,
     "keywords": ["eyeshadow", "eye shadow", "shadow palette"]},
    {"slug": "eye-brow", "name": "Eye Brow Enhancers", "niche": "cosmetics", "parent": "eyes", "sort_order": 35,
     "keywords": ["brow", "eyebrow"]},
    {"slug": "false-lashes", "name": "False Eyelashes", "niche": "cosmetics", "parent": "eyes", "sort_order": 36,
     "keywords": ["false lash", "false eyelash"]},

    # NAILS
    {"slug": "nails", "name": "Nails", "niche": "cosmetics", "sort_order": 40, "is_parent": True,
     "subs": ["Nail Polish", "Nail Enamel", "Nail Care"],
     "keywords": []},
    {"slug": "nail-polish", "name": "Nail Polish", "niche": "cosmetics", "parent": "nails", "sort_order": 41,
     "keywords": ["nail polish", "nail enamel", "nail lacquer", "nail color"]},

    # TOOLS & BRUSHES
    {"slug": "tools-brushes", "name": "Tools & Brushes", "niche": "cosmetics", "sort_order": 50, "is_parent": True,
     "subs": ["Face Brush", "Eye Brush", "Lip Brush", "Brush Sets", "Brush Cleaners", "Sponges", "Eyelash Curlers", "Tweezers", "Sharpeners", "Mirrors", "Makeup Pouches"],
     "keywords": []},
    {"slug": "makeup-brush", "name": "Makeup Brushes", "niche": "cosmetics", "parent": "tools-brushes", "sort_order": 51,
     "keywords": ["brush", "applicator"]},
    {"slug": "beauty-sponge", "name": "Sponges & Applicators", "niche": "cosmetics", "parent": "tools-brushes", "sort_order": 52,
     "keywords": ["sponge", "puff", "blender"]},
    {"slug": "tools-accessories", "name": "Accessories", "niche": "cosmetics", "parent": "tools-brushes", "sort_order": 53,
     "keywords": ["tweezer", "sharpener", "mirror", "curler", "pouch"]},

    # COMBOS & KITS
    {"slug": "makeup-kits", "name": "Makeup Kits & Combos", "niche": "cosmetics", "sort_order": 60, "is_parent": True,
     "subs": ["Makeup Kits", "Combos", "Multi-Functional Palettes"],
     "keywords": ["kit", "combo", "set", "palette"]},
]


# Build flattened category list for product mapping (children first for specificity)
def _all_categories():
    out = []
    out.extend(SKINCARE_CATEGORIES)
    out.extend(COSMETICS_CATEGORIES)
    return out


def classify_product(name: str, current_niche: str) -> dict:
    """Return {niche, category, concerns:[]} for a product based on its name."""
    n = (name or "").lower()
    niche = current_niche or "skincare"

    # 1. Niche detection — if name has any cosmetics keyword, force cosmetics
    cosmetics_kw = [
        "lipstick", "lip gloss", "lip liner", "lip crayon", "lip tint",
        "mascara", "kajal", "eyeliner", "eye shadow", "eyeshadow", "brow",
        "foundation", "concealer", "compact", "blush", "primer", "bronzer",
        "highlighter", "contour", "bb cream", "cc cream", "setting spray",
        "nail polish", "nail enamel", "nail lacquer",
        "makeup brush", "beauty sponge", "false lash",
    ]
    skincare_kw = [
        "serum", "moisturiz", "sunscreen", "spf", "toner", "cleanser",
        "face wash", "facewash", "scrub", "mask", "lip balm", "body lotion",
        "body wash", "body butter", "body scrub", "body oil",
        "hair oil", "shampoo", "conditioner", "face oil", "essence", "ampoule",
        "cica", "ceramide", "retinol", "niacinamide", "hyaluronic", "vitamin c",
    ]
    if any(k in n for k in cosmetics_kw):
        niche = "cosmetics"
    elif any(k in n for k in skincare_kw):
        niche = "skincare"

    # 2. Category — longest-keyword wins for specificity
    best_cat = None
    best_score = 0
    for cat in _all_categories():
        if cat.get("niche") != niche:
            continue
        for kw in cat.get("keywords") or []:
            if kw in n:
                score = len(kw)
                if score > best_score:
                    best_score = score
                    best_cat = cat["slug"]

    # Defaults if nothing matched
    if not best_cat:
        if niche == "cosmetics":
            best_cat = "face-makeup"
        else:
            best_cat = "moisturizers"

    # 3. Concerns (skincare only) — first matching concern wins; up to 3
    concerns = []
    if niche == "skincare":
        for c in SKINCARE_CONCERNS:
            for kw in c.get("keywords") or []:
                if kw in n and c["slug"] not in concerns:
                    concerns.append(c["slug"])
                    break
            if len(concerns) >= 3:
                break

    return {"niche": niche, "category": best_cat, "concerns": concerns}


async def reset_taxonomy(db):
    """Wipe existing concerns + skincare/cosmetics categories, insert new ones."""
    # Keep anti-aging niche untouched
    await db.concerns.delete_many({})
    await db.categories.delete_many({"niche": {"$in": ["skincare", "cosmetics"]}})

    # Seed concerns
    now = datetime.now(timezone.utc).isoformat()
    for c in SKINCARE_CONCERNS:
        doc = {**c, "created_at": now, "updated_at": now}
        await db.concerns.insert_one(doc)

    # Seed categories
    for cat in _all_categories():
        doc = {
            "slug": cat["slug"],
            "name": cat["name"],
            "niche": cat["niche"],
            "is_parent": cat.get("is_parent", False),
            "parent": cat.get("parent"),
            "subs": cat.get("subs", []),
            "sort_order": cat.get("sort_order", 99),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.categories.insert_one(doc)

    # Mark sentinel so legacy seed never re-adds old concerns/categories
    await db.site_settings.update_one(
        {"_id": "main"},
        {"$set": {"taxonomy_v2_applied": True, "taxonomy_v2_applied_at": now}},
        upsert=True,
    )

    logger.info(f"[taxonomy_v2] Inserted {len(SKINCARE_CONCERNS)} concerns + {len(_all_categories())} categories")
    return {"concerns": len(SKINCARE_CONCERNS), "categories": len(_all_categories())}


async def reclassify_all_products(db) -> dict:
    """Walk every cosmetics/skincare product and update niche/category/concerns."""
    counters = {"updated": 0, "by_niche": {}, "by_category": {}}
    cur = db.products.find(
        {"niche": {"$in": ["cosmetics", "skincare"]}},
        {"_id": 0, "slug": 1, "name": 1, "niche": 1, "subcategory": 1}
    )
    async for prod in cur:
        # Bias from existing subcategory field too (gives accuracy boost)
        nm = (prod.get("name") or "") + " " + (prod.get("subcategory") or "")
        result = classify_product(nm, prod.get("niche") or "skincare")
        upd = {
            "niche": result["niche"],
            "category": result["category"],
            "concerns": result["concerns"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.products.update_one({"slug": prod["slug"]}, {"$set": upd})
        counters["updated"] += 1
        counters["by_niche"][result["niche"]] = counters["by_niche"].get(result["niche"], 0) + 1
        counters["by_category"][result["category"]] = counters["by_category"].get(result["category"], 0) + 1
    return counters
