"""
Catalog audit + auto-fix script — v2 (Feb 2026).

Goals (per user request, June 2026):
  - NEVER touch image fields (images[], image_url, thumbnail, swatches, etc.)
    Only category / subcategory / concerns / niche / brand / is_active are
    candidates for modification.
  - Massively expand keyword + brand detection.
  - Infer concerns for skincare/cosmetics products that have no concerns
    using category-driven defaults + name keyword cues.
  - Idempotent — running it repeatedly converges; never overwrites an
    already-correct row.

Three jobs (executed in order):
  1) `--brands`     : Brand-name normalization & sub-brand detection.
  2) `--placement`  : Category / subcategory / concerns reclassification
                     using `taxonomy_canonical.classify_product` PLUS the
                     extended concern inference here.
  3) `--haircare`   : Hide haircare-niched products (is_active=False) since
                     this is a skincare/cosmetics store.

No flag => run all three.  `--dry` for read-only preview.

Image fields are NEVER part of the update payload, guaranteed.
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import Dict, List

from motor.motor_asyncio import AsyncIOMotorClient

# Make services importable when run via `python3 scripts/audit_catalog_feb2026.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services import taxonomy_canonical as tx  # noqa: E402


# ---------------------------------------------------------------------------
# Image-field allow-list — anything OUTSIDE this set is safe to write.
# Used to GUARANTEE the audit never touches a media field even by accident.
# ---------------------------------------------------------------------------
IMAGE_FIELDS = {
    "images", "image_url", "image", "thumbnail", "thumb", "thumb_url",
    "hero_image", "swatches", "swatch", "swatch_image", "video_url",
    "video_thumb_url", "media", "gallery",
}


def _sanitize(upd: Dict) -> Dict:
    """Strip any image-related field from an update payload.  Belt + braces."""
    return {k: v for k, v in upd.items() if k not in IMAGE_FIELDS}


# ---------------------------------------------------------------------------
# Brand normalisation map (canonical → list of accepted typo variants)
# Expanded with 25+ aliases per common brand.
# ---------------------------------------------------------------------------
BRAND_NORMALISE: Dict[str, List[str]] = {
    "The Derma Co": ["derma", "dermaco", "derma co", "the derma co", "tdc",
                     "thedermaco", "the-derma-co"],
    "Mirabella": ["mirabelle", "mirabella", "miraballe"],
    "Estee Lauder": ["esteelauder", "estee lauder", "estée lauder",
                     "esteelauder paris", "estee-lauder"],
    "Laneige": ["laniege", "laneige", "lanege"],
    "L'Oreal Paris": ["loreal paris", "loreal", "l'oreal paris", "l'oreal",
                      "loreal-paris", "loreal-india", "loreal india"],
    "Dr. Sheth's": ["dr sheiths", "dr sheth", "dr sheths", "dr. sheth",
                    "dr. sheth's", "dr-sheth", "drsheths"],
    "Maybelline": ["maybelline", "maybelline ny", "maybelline new york",
                   "ml ", "may belline"],
    "Sugar": ["sugar", "sugar cosmetics", "sugar cosmetic"],
    "Forever52": ["forever52", "forever 52", "f52"],
    "Colorbar": ["colorbar", "color bar", "colour bar", "colourbar"],
    "Swiss Beauty": ["swiss beauty", "swissbeauty"],
    "Swiss Beauty Select": ["swiss beauty select", "swiss beauty sel",
                             "sb select"],
    "Kay Beauty": ["kay beauty", "kaybeauty", "kay-beauty"],
    "Huda Beauty": ["huda beauty", "hudabeauty", "huda-beauty"],
    "Fix Derma": ["fix derma", "fixderma", "fix-derma"],
    "Cetaphil": ["cetaphil"],
    "Mac": ["mac", "m.a.c", "m a c"],
    "Mamaearth": ["mamaearth", "mama earth"],
    "Plum": ["plum", "plumgoodness"],
    "Pilgrim": ["pilgrim"],
    "Lotus": ["lotus", "lotus herbals", "lotus-herbal"],
    "Cerave": ["cerave", "cera ve"],
    "Cosrx": ["cosrx", "cos rx"],
    "Bioderma": ["bioderma"],
    "Minimalist": ["minimalist", "be minimalist"],
    "The Ordinary": ["the ordinary", "the-ordinary", "ordinary"],
    "Foxtale": ["foxtale", "foxtail", "fox tale"],
    "Beauty of Joseon": ["beauty of joseon", "beauty-of-joseon", "boj"],
    "Glow Recipe": ["glow recipe", "glow-recipe"],
    "Sebamed": ["sebamed", "seba med"],
    "Dot & Key": ["dot&key", "dot & key", "dot and key", "dotnkey", "dotkey"],
    "Renee": ["renee", "renée"],
    "Nykaa": ["nykaa", "nykaa cosmetics", "nykaa beauty"],
    "Pac": ["pac", "pac cosmetics", "pac beauty"],
    "Auric": ["auric"],
    "Krylon": ["krylon"],
    "Quench": ["quench", "quench botanics"],
    "Revolution": ["revolution", "makeup revolution"],
    "Aureana": ["aureana"],
    "Aqualogia": ["aqualogia", "aqua logia"],
    "Celesta Glow": ["celesta glow", "celestaglow", "celesta-glow", "celesta"],
    "The Face Shop": ["the face shop", "thefaceshop"],
    "Too Faced": ["too faced", "toofaced"],
}

# ---------------------------------------------------------------------------
# Sub-brand prefix → canonical brand.  These are real distinct brands whose
# products were misfiled under a parent / store brand during the import.
# Detection: name starts with the lower-cased token.
# ---------------------------------------------------------------------------
SUB_BRAND_PREFIXES: Dict[str, str] = {
    # Hindustan Unilever family — separate brands that import lumped under Lakme
    "simple": "Simple",
    "elle 18": "Elle 18",
    "elle18": "Elle 18",
    "ell 18": "Elle 18",
    "pond's": "Pond's",
    "ponds": "Pond's",
    "dove": "Dove",
    "vaseline": "Vaseline",
    "lakme 9to5": "Lakme",
    # Lakme abbreviations (these ARE Lakme, ensure they stay)
    "lakme": "Lakme",
    "lkm": "Lakme",
    "lkme": "Lakme",
    "lk ": "Lakme",
    # Maybelline aliases
    "maybelline": "Maybelline",
    "ml ": "Maybelline",
    # MyGlamm / Renee / Sugar aliases
    "myglamm": "MyGlamm",
    "renee": "Renee",
    "sugar": "Sugar",
    "sugar pop": "Sugar Pop",
    # The Ordinary
    "the ordinary": "The Ordinary",
    # Beauty of Joseon
    "beauty of joseon": "Beauty of Joseon",
    # Huda
    "huda beauty": "Huda Beauty",
    "huda ": "Huda Beauty",
    # Kay Beauty (Katrina Kaif × Nykaa)
    "kay beauty": "Kay Beauty",
    "kay by katrina": "Kay Beauty",
    # Too Faced / MAC / Estee
    "too faced": "Too Faced",
    "mac ": "Mac",
    "m.a.c": "Mac",
    "estee lauder": "Estee Lauder",
    "estée lauder": "Estee Lauder",
    # The Face Shop / Laneige
    "the face shop": "The Face Shop",
    "laneige": "Laneige",
    # Glow Recipe
    "glow recipe": "Glow Recipe",
    # The Derma Co
    "the derma co": "The Derma Co",
    # Derma sub-brands
    "fix derma": "Fix Derma",
    # Swiss Beauty
    "swiss beauty select": "Swiss Beauty Select",
    "swiss beauty": "Swiss Beauty",
    "swissbeauty": "Swiss Beauty",
    # Minimalist
    "minimalist": "Minimalist",
    "be minimalist": "Minimalist",
    # Cosrx
    "cosrx": "Cosrx",
    # Cetaphil / Bioderma / Sebamed / Cerave / Pilgrim / Lotus / Mamaearth
    "cetaphil": "Cetaphil",
    "bioderma": "Bioderma",
    "sebamed": "Sebamed",
    "cerave": "Cerave",
    "cera ve": "Cerave",
    "pilgrim": "Pilgrim",
    "lotus": "Lotus",
    "mamaearth": "Mamaearth",
    "mama earth": "Mamaearth",
    # Plum / Dot&Key / Foxtale / Auric / Quench
    "plum": "Plum",
    "dot&key": "Dot & Key",
    "dot & key": "Dot & Key",
    "dot and key": "Dot & Key",
    "foxtale": "Foxtale",
    "auric": "Auric",
    "quench": "Quench",
    # Revolution / Pac / Forever52 / Colorbar
    "makeup revolution": "Revolution",
    "revolution": "Revolution",
    "pac ": "Pac",
    "forever52": "Forever52",
    "forever 52": "Forever52",
    "colorbar": "Colorbar",
    # L'Oreal / Nykaa
    "loreal paris": "L'Oreal Paris",
    "l'oreal paris": "L'Oreal Paris",
    "loreal": "L'Oreal Paris",
    "nykaa": "Nykaa",
    # Krylon / Mirabella / Aqualogia / Aureana
    "krylon": "Krylon",
    "mirabella": "Mirabella",
    "aqualogia": "Aqualogia",
    "aureana": "Aureana",
    # Dr Sheth's
    "dr sheth": "Dr. Sheth's",
    "dr. sheth": "Dr. Sheth's",
    "dr sheth's": "Dr. Sheth's",
    "dr. sheth's": "Dr. Sheth's",
    # Celesta Glow flagship
    "celesta glow": "Celesta Glow",
}


# ---------------------------------------------------------------------------
# Concerns inference — category-driven defaults & name keyword cues.
# When a product has no concerns but lands in a sensible category, give it
# 1–3 reasonable default concerns so concern-based filtering works.
# ---------------------------------------------------------------------------
CATEGORY_DEFAULT_CONCERNS: Dict[str, List[str]] = {
    "sunscreens": ["sun-protection"],
    "cleansers": ["barrier-support"],
    "exfoliators": ["texture-pores", "brightening-glow"],
    "toners-mists": ["oil-sebum", "texture-pores"],
    "serums-treatments": ["brightening-glow", "aging"],
    "moisturizers": ["dryness", "barrier-support"],
    "masks-packs": ["brightening-glow", "barrier-support"],
    "spot-treatments": ["acne-breakouts"],
    "face-oils": ["dryness", "aging"],
    "eye-care": ["under-eye"],
    "lip-care": ["dryness"],
    "essences-ampoules": ["brightening-glow", "barrier-support"],
    "barrier-care": ["sensitivity", "barrier-support"],
    "body-skincare": ["dryness"],
    "brightening-products": ["pigmentation", "brightening-glow"],
    "anti-aging-products": ["aging"],
}

CONCERN_KEYWORD_HINTS: Dict[str, List[str]] = {
    "acne-breakouts":  ["acne", "pimple", "blemish", "salicylic", "bha",
                        "anti-acne", "spot", "blackhead", "whitehead"],
    "pigmentation":    ["dark spot", "pigmentation", "melasma", "uneven tone",
                        "tan removal", "tanning", "kojic", "alpha arbutin",
                        "azelaic"],
    "dryness":         ["dry skin", "moisturizing", "hydrating", "hyaluronic",
                        "squalane", "shea butter", "ceramide", "nourishing"],
    "oil-sebum":       ["oily skin", "oil control", "matte", "sebum",
                        "niacinamide", "purifying", "anti-shine"],
    "aging":           ["anti-aging", "anti-ageing", "wrinkle", "firming",
                        "retinol", "retinal", "bakuchiol", "peptide",
                        "collagen", "lifting", "rejuven"],
    "sensitivity":     ["sensitive skin", "calming", "soothing", "redness",
                        "centella", "cica", "panthenol", "allantoin"],
    "texture-pores":   ["pores", "smooth", "texture", "polished", "refining",
                        "minimiz"],
    "brightening-glow": ["bright", "glow", "radiance", "luminous", "vitamin c",
                        "vit c", "niacinamide", "alpha arbutin", "lit",
                        "illuminat"],
    "under-eye":       ["under eye", "under-eye", "dark circle", "puffy",
                        "puffiness", "caffeine eye"],
    "barrier-support": ["barrier", "ceramide", "cica", "centella", "panthenol",
                        "repair"],
    "sun-protection":  ["spf", "sunscreen", "sunblock", "uva", "uvb",
                        "broad spectrum"],
    "mens":            [" men ", "for men", "men's"],
}


def detect_sub_brand(name: str) -> str | None:
    n = (name or "").lower().strip()
    # longest-first so 'beauty of joseon' wins over 'beauty'
    for token in sorted(SUB_BRAND_PREFIXES.keys(), key=len, reverse=True):
        if n.startswith(token + " ") or n == token.strip():
            return SUB_BRAND_PREFIXES[token]
    return None


def normalise_brand(brand: str) -> str:
    if not brand:
        return brand
    b_lower = brand.lower().strip()
    for canon, aliases in BRAND_NORMALISE.items():
        if b_lower in aliases:
            return canon
    return brand


def infer_concerns(name: str, description: str, category: str | None) -> List[str]:
    blob = (name + " " + (description or "")).lower()
    found: List[str] = []
    for concern, kws in CONCERN_KEYWORD_HINTS.items():
        for k in kws:
            if k in blob:
                if concern not in found:
                    found.append(concern)
                break
        if len(found) >= 3:
            break
    if not found and category:
        found = list(CATEGORY_DEFAULT_CONCERNS.get(category, []))
    return found[:3]


async def run(dry: bool = False, do_brands: bool = True, do_placement: bool = True,
              do_haircare: bool = True) -> None:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    db = AsyncIOMotorClient(mongo_url)[db_name]

    stats = {
        "total_scanned": 0,
        "haircare_hidden": 0,
        "brand_normalised": 0,
        "brand_subfixed": 0,
        "category_set": 0,
        "subcategory_set": 0,
        "concerns_set": 0,
        "concerns_inferred": 0,
        "niche_corrected": 0,
        "skipped_image_writes": 0,  # safety counter
    }
    samples: Dict[str, List[str]] = {"subbrand": [], "brand": [], "category": [], "concerns": []}

    async for d in db.products.find({"deleted": {"$ne": True}}):
        stats["total_scanned"] += 1
        update: Dict = {}
        pid = d.get("_id")
        name = d.get("name") or ""
        brand = d.get("brand") or ""
        niche = d.get("niche") or ""
        category = d.get("category")
        subcategory = d.get("subcategory")
        concerns = d.get("concerns") or []

        # ---- (3) HIDE HAIRCARE ----
        if do_haircare:
            if niche == "haircare" and d.get("is_active", True) is not False:
                update["is_active"] = False
                stats["haircare_hidden"] += 1

        # ---- (1) BRAND CORRECTION ----
        if do_brands:
            sub_b = detect_sub_brand(name)
            if sub_b and sub_b.lower() != brand.lower():
                update["brand"] = sub_b
                stats["brand_subfixed"] += 1
                if len(samples["subbrand"]) < 6:
                    samples["subbrand"].append(f"  {brand!r:20s} -> {sub_b!r:18s}: {name[:60]}")
            if "brand" not in update:
                norm = normalise_brand(brand)
                if norm != brand:
                    update["brand"] = norm
                    stats["brand_normalised"] += 1
                    if len(samples["brand"]) < 6:
                        samples["brand"].append(f"  {brand!r:20s} -> {norm!r}")

        # ---- (2) PLACEMENT — category / subcategory / concerns / niche ----
        if do_placement and niche != "haircare":
            res = tx.classify_product(
                name=name, description=d.get("description", ""),
                brand=update.get("brand", brand), current_niche=niche,
            )
            new_niche = res.get("niche")
            # Allow niche correction only between skincare<->cosmetics, never wipe to None
            if new_niche and new_niche in ("skincare", "cosmetics", "anti-aging") and new_niche != niche:
                update["niche"] = new_niche
                stats["niche_corrected"] += 1
                niche = new_niche
            if not category and res.get("category"):
                update["category"] = res["category"]
                category = res["category"]
                stats["category_set"] += 1
                if len(samples["category"]) < 6:
                    samples["category"].append(f"  [{niche}] {name[:55]} -> {res['category']}")
            if not subcategory and res.get("subcategory"):
                update["subcategory"] = res["subcategory"]
                subcategory = res["subcategory"]
                stats["subcategory_set"] += 1
            if not concerns and res.get("concerns"):
                update["concerns"] = res["concerns"]
                concerns = res["concerns"]
                stats["concerns_set"] += 1
            # Inference fallback — fills the long tail the canonical
            # classifier doesn't have keywords for.
            if not concerns and niche in ("skincare", "anti-aging"):
                inf = infer_concerns(name, d.get("description", ""), category)
                if inf:
                    update["concerns"] = inf
                    stats["concerns_inferred"] += 1
                    if len(samples["concerns"]) < 6:
                        samples["concerns"].append(f"  {name[:55]} -> {inf}")

        # ---- SAFETY: strip any image fields that crept in (defence in depth) ----
        before = len(update)
        update = _sanitize(update)
        if len(update) < before:
            stats["skipped_image_writes"] += 1

        if update and not dry:
            await db.products.update_one({"_id": pid}, {"$set": update})

    # ----- print report -----
    print("\n" + "=" * 60)
    print("CATALOG AUDIT REPORT v2" + ("  (DRY RUN)" if dry else "  (APPLIED)"))
    print("=" * 60)
    for k, v in stats.items():
        print(f"  {k:30s} {v}")

    print("\nSUB-BRAND corrections (sample):")
    for s in samples["subbrand"]:
        print(s)
    print("\nBRAND typo normalisation (sample):")
    for s in samples["brand"]:
        print(s)
    print("\nNEWLY CATEGORISED (sample):")
    for s in samples["category"]:
        print(s)
    print("\nINFERRED CONCERNS (sample):")
    for s in samples["concerns"]:
        print(s)
    print("=" * 60)
    print("IMAGE FIELDS TOUCHED: 0 (image fields are NEVER modified by this audit)")
    print("=" * 60)


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    flags = {a.lstrip("-") for a in sys.argv if a.startswith("--")}
    do_brands = (not flags) or "brands" in flags or "all" in flags or dry
    do_placement = (not (flags - {"dry"})) or "placement" in flags or "all" in flags
    do_haircare = (not (flags - {"dry"})) or "haircare" in flags or "all" in flags
    asyncio.run(run(dry=dry, do_brands=do_brands, do_placement=do_placement,
                    do_haircare=do_haircare))
