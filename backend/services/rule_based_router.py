"""Rule-based product router.

Connects every product in the catalog to the canonical taxonomy seeded by
`taxonomy_seed_v2.py` — by matching the product NAME (+ brand + Excel hints
+ existing category) against keyword lists, NO LLM required.

This is the engine behind the admin "🔗 Connect Products to Taxonomy" button.
Runs the full 9k catalog in a few seconds.
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# Keyword maps — order matters: more specific BEFORE generic
# Each tuple: (category_slug, [keywords])
# ============================================================

# SKINCARE — order: most specific to most generic
SKINCARE_RULES: List[Tuple[str, List[str]]] = [
    # Sunscreens
    ("sunscreens", ["sunscreen", "spf", "uv shield", "sun block", "sun protection cream"]),
    # Eye / Lip
    ("eye-care", ["eye cream", "under eye", "eye gel", "eye serum", "eye contour", "dark circle"]),
    ("lip-care", ["lip balm", "lip mask", "lip scrub", "lip oil", "lip treatment", "lip plumper", "lip butter"]),
    # Treatments
    ("spot-treatments", ["acne patch", "pimple patch", "spot corrector", "spot treatment", "pimple gel", "pimple treatment", "acne spot"]),
    ("essences-ampoules", ["essence", "ampoule", "booster"]),
    # Serums (specific actives)
    ("serums-treatments", ["serum", "treatment", "drops", "concentrate"]),
    # Masks
    ("masks-packs", ["sheet mask", "clay mask", "sleeping mask", "peel off mask", "peel-off", "mud mask", "face mask", "face pack", "hydrating mask"]),
    # Exfoliators
    ("exfoliators", ["scrub", "exfoliant", "exfoliator", "peel", "peeling", "polish"]),
    # Toners / mists
    ("toners-mists", ["toner", "mist", "tonic", "hydrating water"]),
    # Cleansers / face wash
    ("cleansers", ["face wash", "facewash", "cleanser", "cleansing", "micellar", "cleansing balm", "cleansing oil", "foam wash"]),
    # Face oils
    ("face-oils", ["face oil", "facial oil", "glow oil", "overnight oil"]),
    # Body
    ("body-skincare", ["body lotion", "body butter", "body wash", "body scrub", "body oil", "hand cream", "foot cream", "body cream", "shower gel"]),
    # Repair / barrier
    ("skin-repair-barrier", ["cica", "ceramide", "barrier repair", "recovery balm"]),
    # Brightening / anti-aging products (these are also "categories" the user wants)
    ("anti-aging-products", ["retinol cream", "firming cream", "wrinkle", "anti-aging cream", "anti aging cream"]),
    ("brightening-products", ["pigmentation cream", "dark spot cream", "glow cream", "brightening cream", "whitening cream"]),
    # Moisturizers — keep LAST because many products have "cream" in the name
    ("moisturizers", ["moisturizer", "moisturiser", "day cream", "night cream", "face cream", "hydrating cream", "gel cream"]),
]

# COSMETICS — order: specific to generic
COSMETICS_RULES: List[Tuple[str, List[str]]] = [
    # Eyes
    ("kajal", ["kajal", "kohl"]),
    ("eyeliner", ["eye liner", "eyeliner", "liquid liner", "gel liner"]),
    ("mascara", ["mascara"]),
    ("eye-shadow", ["eye shadow", "eyeshadow", "shadow palette"]),
    ("eye-brow", ["eye brow", "eyebrow", "brow pencil", "brow gel", "brow powder"]),
    ("false-lashes", ["false lash", "false eyelash", "magnetic lash", "strip lash"]),
    # Lips
    ("lip-liner", ["lip liner", "lip pencil"]),
    ("liquid-lipstick", ["liquid lipstick", "liquid lip color", "liquid lip colour", "matte liquid lip"]),
    ("lip-crayon", ["lip crayon", "lip stylo", "lip stick crayon"]),
    ("lip-gloss", ["lip gloss", "plumping gloss"]),
    ("lip-tint", ["lip tint", "lip stain"]),
    ("lipstick", ["lipstick", "lip color", "lip colour", "lip bullet"]),
    # Face — specific products (ORDER MATTERS — specific to generic)
    ("concealer", ["concealer"]),
    ("face-primer", ["primer", "pore primer", "makeup primer", "base primer"]),
    ("compact", ["compact powder", "cushion compact", "compact"]),
    ("foundation", ["foundation", "skin tint"]),
    ("contour", ["contour"]),
    ("loose-powder", ["loose powder", "setting powder", "translucent powder", "finishing powder"]),
    ("blush", ["blush", "blusher", "cheek tint"]),
    ("highlighters", ["highlighter", "illuminator", "luminizer"]),
    ("bb-cc-cream", ["bb cream", "cc cream"]),
    ("tinted-moisturizer", ["tinted moisturizer", "tinted moisturiser", "tinted cream"]),
    ("bronzer", ["bronzer"]),
    ("setting-spray", ["setting spray", "makeup fixer", "fixer spray"]),
    ("makeup-remover", ["makeup remover", "cleansing wipes", "make-up remover"]),
    # Nails
    ("nail-polish", ["nail polish", "nail paint", "nail lacquer", "nail enamel"]),
    # Tools
    ("makeup-brush", ["makeup brush", "brush set", "foundation brush", "powder brush"]),
    ("beauty-sponge", ["beauty blender", "beauty sponge", "powder puff"]),
    ("accessories", ["eyelash curler", "pencil sharpener", "makeup mirror"]),
    ("makeup-kits", ["makeup kit", "bridal kit", "starter kit", "makeup set"]),
]

# SUBCATEGORIES — finer sub-filters under each category.
# Map: parent_category → [(sub_slug, [keywords])]
SUB_RULES: Dict[str, List[Tuple[str, List[str]]]] = {
    "cleansers": [
        ("gel-cleanser", ["gel cleanser", "gel face wash", "gel wash"]),
        ("foam-cleanser", ["foam cleanser", "foaming wash", "foam wash"]),
        ("cream-cleanser", ["cream cleanser", "cream wash"]),
        ("oil-cleanser", ["oil cleanser", "cleansing oil"]),
        ("micellar-water", ["micellar"]),
        ("cleansing-balm", ["cleansing balm"]),
        ("face-wash", ["face wash", "facewash"]),
    ],
    "exfoliators": [
        ("aha-exfoliant", ["aha", "glycolic", "lactic"]),
        ("bha-exfoliant", ["bha", "salicylic exfoliant"]),
        ("enzyme-peel", ["enzyme"]),
        ("peeling-solution", ["peeling solution"]),
        ("chemical-exfoliant", ["chemical exfoliant", "acid peel"]),
        ("face-scrub", ["scrub", "polish"]),
    ],
    "serums-treatments": [
        ("vitamin-c-serum", ["vitamin c", "vit-c", "vitc"]),
        ("hyaluronic-acid-serum", ["hyaluronic", "ha serum"]),
        ("niacinamide-serum", ["niacinamide"]),
        ("retinol-serum", ["retinol", "retinaldehyde", "bakuchiol"]),
        ("salicylic-acid-serum", ["salicylic"]),
        ("peptide-serum", ["peptide"]),
        ("brightening-serum", ["brightening", "glow", "whitening"]),
        ("anti-acne-serum", ["anti-acne", "acne serum"]),
    ],
    "moisturizers": [
        ("night-cream", ["night cream", "overnight"]),
        ("gel-moisturizer", ["gel moisturizer", "gel cream"]),
        ("cream-moisturizer", ["cream moisturizer"]),
        ("lotion", ["lotion"]),
        ("barrier-repair-cream", ["barrier", "ceramide"]),
    ],
    "sunscreens": [
        ("gel-sunscreen", ["gel sunscreen", "gel spf"]),
        ("cream-sunscreen", ["cream sunscreen"]),
        ("mineral-sunscreen", ["mineral sunscreen", "physical sunscreen", "zinc oxide"]),
        ("tinted-sunscreen", ["tinted sunscreen", "tinted spf"]),
        ("spray-sunscreen", ["spray sunscreen"]),
        ("stick-sunscreen", ["stick sunscreen", "sunscreen stick"]),
    ],
    "masks-packs": [
        ("clay-mask", ["clay mask", "mud mask"]),
        ("sheet-mask", ["sheet mask"]),
        ("sleeping-mask", ["sleeping mask", "overnight mask"]),
        ("peel-off-mask", ["peel off", "peel-off"]),
        ("hydrating-mask", ["hydrating mask"]),
    ],
    "lipstick": [
        ("matte-lipstick", ["matte"]),
        ("creamy-lipstick", ["creamy", "cream lipstick"]),
        ("satin-lipstick", ["satin"]),
        ("nude-lipstick", ["nude"]),
        ("red-lipstick", ["red"]),
        ("luxury-lipstick", ["luxe", "luxury"]),
    ],
    "liquid-lipstick": [
        ("matte-liquid", ["matte"]),
        ("transfer-proof", ["transfer proof", "long stay", "long lasting"]),
        ("glossy-liquid", ["glossy", "shine"]),
    ],
    "lip-gloss": [
        ("clear-gloss", ["clear"]),
        ("tinted-gloss", ["tinted", "tint"]),
        ("plumping-gloss", ["plump"]),
    ],
    "foundation": [
        ("matte-foundation", ["matte"]),
        ("dewy-foundation", ["dewy", "glow"]),
        ("liquid-foundation", ["liquid"]),
        ("powder-foundation", ["powder"]),
        ("stick-foundation", ["stick"]),
        ("waterproof-foundation", ["waterproof"]),
    ],
    "eyeliner": [
        ("liquid-eyeliner", ["liquid"]),
        ("gel-eyeliner", ["gel"]),
        ("pencil-eyeliner", ["pencil"]),
        ("waterproof-eyeliner", ["waterproof"]),
    ],
    "mascara": [
        ("volume-mascara", ["volume", "voluminous"]),
        ("length-mascara", ["length", "lengthen"]),
        ("curling-mascara", ["curl"]),
        ("waterproof-mascara", ["waterproof"]),
    ],
    "kajal": [
        ("waterproof-kajal", ["waterproof"]),
        ("smudge-proof-kajal", ["smudge proof", "smudge-free"]),
        ("coloured-kajal", ["color", "colour"]),
    ],
    "blush": [
        ("powder-blush", ["powder"]),
        ("cream-blush", ["cream", "creamy"]),
        ("liquid-blush", ["liquid"]),
        ("blush-stick", ["stick"]),
    ],
    "nail-polish": [
        ("matte-nail", ["matte"]),
        ("glossy-nail", ["glossy", "shine"]),
        ("gel-nail", ["gel"]),
    ],
}

# CONCERN keyword maps
CONCERN_RULES: List[Tuple[str, List[str]]] = [
    # Acne family
    ("hormonal-acne", ["hormonal acne"]),
    ("cystic-acne", ["cystic"]),
    ("acne-scars", ["acne scar", "scar"]),
    ("blackheads", ["blackhead"]),
    ("whiteheads", ["whitehead"]),
    ("bacne", ["bacne", "body acne", "back acne"]),
    ("pimples", ["pimple"]),
    ("acne-breakouts", ["acne", "breakout"]),
    # Pigmentation
    ("melasma", ["melasma"]),
    ("post-acne-marks", ["post-acne mark", "post acne mark"]),
    ("hyperpigmentation", ["hyperpigmentation"]),
    ("dark-spots", ["dark spot", "spot corrector", "blemish"]),
    ("tanning", ["tanning", "tan removal", "de-tan"]),
    ("sun-damage", ["sun damage"]),
    ("uneven-skin-tone", ["uneven skin tone", "uneven tone"]),
    # Dryness
    ("dehydrated-skin", ["dehydrated"]),
    ("flaky-skin", ["flaky", "flake"]),
    ("rough-texture", ["rough texture"]),
    ("dry-skin", ["dry skin", "for dry"]),
    # Oil
    ("greasy-tzone", ["t-zone", "tzone"]),
    ("enlarged-pores", ["enlarged pore", "minimise pore", "minimize pore"]),
    ("excess-sebum", ["excess sebum", "sebum control"]),
    ("oily-skin", ["oily skin", "for oily", "oil control"]),
    # Aging
    ("crows-feet", ["crow's feet", "crows feet"]),
    ("sagging-skin", ["sagging", "firming"]),
    ("fine-lines", ["fine line"]),
    ("wrinkles", ["wrinkle", "anti-aging", "anti aging"]),
    ("loss-of-elasticity", ["elasticity"]),
    # Sensitivity
    ("redness", ["redness"]),
    ("irritation", ["irritation"]),
    ("damaged-barrier", ["damaged barrier", "barrier repair"]),
    ("allergic-reactions", ["allergic"]),
    ("sensitive-skin", ["sensitive skin", "for sensitive"]),
    # Texture
    ("open-pores", ["open pore"]),
    ("bumpy-skin", ["bumpy"]),
    ("uneven-texture", ["uneven texture"]),
    # Brightening
    ("dull-skin", ["dull skin"]),
    ("brightening", ["brightening", "brighten", "glow", "radiance", "whitening"]),
    # Under-eye
    ("dark-circles", ["dark circle"]),
    ("puffy-eyes", ["puffy", "puffiness"]),
    ("eye-bags", ["eye bag"]),
    # Hydration
    ("moisture-loss", ["moisture loss"]),
    ("hydration", ["hydrating", "hydration", "moisturizing", "moisturising"]),
    ("skin-repair", ["repair", "rejuvenat"]),
    ("weak-barrier", ["weak barrier"]),
    # Conditions
    ("eczema", ["eczema"]),
    ("psoriasis", ["psoriasis"]),
    ("rosacea", ["rosacea"]),
    ("fungal-acne", ["fungal acne"]),
    ("dermatitis", ["dermatitis"]),
    # Sun
    ("sun-protection", ["spf", "sunscreen", "uv protection", "sun protect"]),
    ("photoaging", ["photoaging"]),
    ("sunburn", ["sunburn"]),
    # Men's
    ("razor-bumps", ["razor bump"]),
    ("ingrown-hair", ["ingrown"]),
    ("post-shave-irritation", ["post-shave", "after shave"]),
]


def _match(haystack: str, rules: List[Tuple[str, List[str]]]) -> Optional[str]:
    """Return the first slug whose keyword appears in haystack."""
    hl = haystack.lower()
    for slug, keywords in rules:
        for kw in keywords:
            if kw in hl:
                return slug
    return None


def _match_all(haystack: str, rules: List[Tuple[str, List[str]]], limit: int = 4) -> List[str]:
    """Return ALL slug matches up to `limit` (used for concerns)."""
    hl = haystack.lower()
    out: List[str] = []
    seen = set()
    for slug, keywords in rules:
        if slug in seen:
            continue
        for kw in keywords:
            if kw in hl:
                out.append(slug)
                seen.add(slug)
                break
        if len(out) >= limit:
            break
    return out


def detect_niche(haystack: str, current_niche: str = "") -> str:
    """Return one of skincare | cosmetics | anti-aging."""
    hl = haystack.lower()
    if current_niche == "anti-aging":
        return "anti-aging"
    aging_keywords = ["anti-aging", "anti aging", "retinol", "wrinkle", "peptide", "collagen", "firming", "bakuchiol"]
    if any(k in hl for k in aging_keywords):
        # but only if it's not a clearly-cosmetic product
        cosmetic_words = ["lipstick", "kajal", "mascara", "eyeliner", "blush", "nail polish", "foundation", "concealer", "lip gloss"]
        if not any(c in hl for c in cosmetic_words):
            return "anti-aging"
    # cosmetics check first since it's more specific
    cos_match = _match(hl, COSMETICS_RULES)
    if cos_match:
        return "cosmetics"
    return "skincare"


def classify_product(prod: dict) -> dict:
    """Determine canonical niche/category/subcategory/concerns for a product.

    Inputs we care about (in priority order):
      product["name"], product["brand"], product["product_type_hint"],
      product["concern_hint"], product["category"] (legacy), product["niche"].
    """
    name = prod.get("name") or ""
    brand = prod.get("brand") or ""
    pt_hint = prod.get("product_type_hint") or ""
    cat_hint = prod.get("main_category_hint") or ""
    concern_hint = prod.get("concern_hint") or ""
    skin_hint = prod.get("skin_type_hint") or ""
    cur_niche = (prod.get("niche") or "").lower()

    # IMPORTANT: do NOT include the existing `category` in the haystack — legacy
    # slugs like "foundation-concealer" pollute keyword matching and pull pure
    # concealer/blush products into "foundation".
    haystack = " ".join([name, name, name, brand, pt_hint, cat_hint, concern_hint, skin_hint])

    niche = detect_niche(haystack, cur_niche)
    rules = COSMETICS_RULES if niche == "cosmetics" else SKINCARE_RULES
    cat_slug = _match(haystack, rules)
    if not cat_slug:
        # Fall back: pick a sensible default by niche
        cat_slug = "moisturizers" if niche != "cosmetics" else "lipstick"

    # Subcategory under that category
    sub_slug = ""
    if cat_slug in SUB_RULES:
        sub_slug = _match(haystack, SUB_RULES[cat_slug]) or ""

    # Concerns — match against the concern keyword list
    concerns = _match_all(haystack, CONCERN_RULES, limit=4)
    # Always tag sunscreens with sun-protection
    if cat_slug == "sunscreens" and "sun-protection" not in concerns:
        concerns.append("sun-protection")
    # Always tag anti-aging niche with the obvious concerns
    if niche == "anti-aging":
        for c in ("fine-lines", "wrinkles", "anti-aging" if "anti-aging" in [x[0] for x in CONCERN_RULES] else None):
            if c and c not in concerns:
                concerns.append(c)
                if len(concerns) >= 4:
                    break

    return {
        "niche": niche,
        "category": cat_slug,
        "subcategory": sub_slug,
        "concerns": concerns,
    }


async def connect_all_products(
    db,
    only_unconnected: bool = False,
    niche_filter: Optional[str] = None,
    limit: Optional[int] = None,
) -> dict:
    """Route every product in the DB to the canonical taxonomy in one pass.

    Returns stats: {scanned, updated, skipped, by_niche, by_top_category}.
    """
    # Load the canonical slug sets from DB so we never assign a non-existent slug.
    valid_cat_slugs = {c["slug"] async for c in db.categories.find({}, {"_id": 0, "slug": 1})}
    valid_sub_slugs = {s["slug"] async for s in db.subcategories.find({}, {"_id": 0, "slug": 1})}
    valid_concern_slugs = {c["slug"] async for c in db.concerns.find({}, {"_id": 0, "slug": 1})}

    q: Dict[str, Any] = {}
    if niche_filter:
        q["niche"] = niche_filter
    if only_unconnected:
        q["$or"] = [
            {"category": {"$in": [None, ""]}},
            {"concerns": {"$size": 0}},
            {"connected_at": {"$exists": False}},
        ]

    proj = {
        "_id": 0, "slug": 1, "name": 1, "brand": 1, "niche": 1, "category": 1,
        "main_category_hint": 1, "product_type_hint": 1, "concern_hint": 1, "skin_type_hint": 1,
    }

    cursor = db.products.find(q, proj)
    if limit:
        cursor = cursor.limit(limit)

    scanned = 0
    updated = 0
    skipped = 0
    by_niche: Dict[str, int] = {"anti-aging": 0, "skincare": 0, "cosmetics": 0}
    by_cat: Dict[str, int] = {}
    bulk_ops: List[dict] = []

    async for p in cursor:
        scanned += 1
        out = classify_product(p)
        # Drop slugs that don't exist in the canonical sets (safety)
        cat = out["category"] if out["category"] in valid_cat_slugs else ""
        sub = out["subcategory"] if out["subcategory"] in valid_sub_slugs else ""
        concerns = [c for c in out["concerns"] if c in valid_concern_slugs]
        if not cat:
            skipped += 1
            continue
        by_niche[out["niche"]] = by_niche.get(out["niche"], 0) + 1
        by_cat[cat] = by_cat.get(cat, 0) + 1
        bulk_ops.append({
            "filter": {"slug": p["slug"]},
            "update": {"$set": {
                "niche": out["niche"],
                "category": cat,
                "subcategory": sub,
                "concerns": concerns,
                "connected_at": _now(),
                "connected_by": "rule_based_router_v1",
                "updated_at": _now(),
            }},
        })
        if len(bulk_ops) >= 500:
            await _flush_bulk(db, bulk_ops)
            updated += len(bulk_ops)
            bulk_ops = []
    if bulk_ops:
        await _flush_bulk(db, bulk_ops)
        updated += len(bulk_ops)

    # Sort by_cat by count
    top_cats = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:25]
    return {
        "scanned": scanned,
        "updated": updated,
        "skipped": skipped,
        "by_niche": by_niche,
        "top_categories": [{"slug": s, "count": c} for s, c in top_cats],
    }


async def _flush_bulk(db, ops: List[dict]) -> None:
    from pymongo import UpdateOne
    requests = [UpdateOne(op["filter"], op["update"]) for op in ops]
    if requests:
        await db.products.bulk_write(requests, ordered=False)
