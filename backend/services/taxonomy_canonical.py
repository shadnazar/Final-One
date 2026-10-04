"""Canonical Celesta Glow taxonomy (Jan 2026 user spec).

Owns:
  • 13 main Skincare CONCERNS (each with `subs` array of sub-concerns)
  • 16 Skincare CATEGORIES (each with `subs` array of sub-categories)
  • Cosmetics CATEGORIES (6 mains: Face / Lips / Eyes / Nails / Tools & Brushes /
    Makeup Kits & Combos — each with their subs)
  • Keyword-based product classifier (niche / category / subcategory / concerns)
    that reads BOTH product name and description for accuracy.
  • Filter-tag heuristics (bestseller / luxury / trending / most_bought).
  • Product deduplication by normalized name.

This module is the single source of truth. The legacy seed (taxonomy_seed_v2.py)
created a flat list of 70+ concerns — once `taxonomy_canonical_applied=true` is
set on `site_settings`, the legacy seeders short-circuit.
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# SKINCARE — 13 main concerns (user's Jan 2026 spec, verbatim)
# Each main is a top-level `concerns` document with sub-concerns
# stored in the `subs` array (NOT as separate documents).
# ============================================================
SKINCARE_CONCERNS = [
    {
        "slug": "acne-breakouts", "name": "Acne & Breakouts", "icon": "🎯",
        "tagline": "Pimples · Cystic · Blackheads · Scars",
        "subs": ["Pimples", "Cystic Acne", "Whiteheads", "Blackheads", "Hormonal Acne", "Acne Scars", "Bacne"],
        "accent_from": "#ffe4e6", "accent_to": "#fecdd3", "accent_text": "#9f1239",
        "keywords": ["acne", "pimple", "salicylic", "blemish", "spot treat", "whitehead", "blackhead",
                     "anti-acne", "anti acne", "breakout", "comedone", "bha", "tea tree", "benzoyl", "azelaic"],
        "sort_order": 1, "is_active": True,
    },
    {
        "slug": "pigmentation", "name": "Pigmentation & Uneven Tone", "icon": "🌗",
        "tagline": "Dark spots · Melasma · Sun damage",
        "subs": ["Dark Spots", "Hyperpigmentation", "Melasma", "Post-Acne Marks", "Uneven Tone", "Tanning", "Sun Damage"],
        "accent_from": "#ede9fe", "accent_to": "#ddd6fe", "accent_text": "#5b21b6",
        "keywords": ["pigmentation", "dark spot", "melasma", "tan removal", "de-tan", "detan",
                     "kojic", "alpha arbutin", "tranexamic", "uneven tone", "hyperpigmentation",
                     "brightening", "fade", "spot corrector"],
        "sort_order": 2, "is_active": True,
    },
    {
        "slug": "dryness", "name": "Dryness & Dehydration", "icon": "💧",
        "tagline": "Dry · Flaky · Dehydrated · Rough",
        "subs": ["Dry Skin", "Flaky Skin", "Dehydrated Skin", "Rough Texture", "Tight Skin Barrier"],
        "accent_from": "#dbeafe", "accent_to": "#bfdbfe", "accent_text": "#1e3a8a",
        "keywords": ["dry skin", "dryness", "hydrat", "hyaluronic", "ceramide", "moistur",
                     "flaky", "intense hydration", "deep hydration", "nourish", "glycerin"],
        "sort_order": 3, "is_active": True,
    },
    {
        "slug": "oil-sebum", "name": "Oil & Sebum Issues", "icon": "💦",
        "tagline": "Oily · T-zone · Large pores",
        "subs": ["Oily Skin", "Excess Sebum", "Greasy T-zone", "Enlarged Pores"],
        "accent_from": "#fef3c7", "accent_to": "#fde68a", "accent_text": "#78350f",
        "keywords": ["oily skin", "oily/acne", "sebum", "mattif", "oil control", "niacinamide",
                     "t-zone", "t zone", "shine control"],
        "sort_order": 4, "is_active": True,
    },
    {
        "slug": "aging", "name": "Aging Concerns", "icon": "✨",
        "tagline": "Fine lines · Wrinkles · Sagging",
        "subs": ["Fine Lines", "Wrinkles", "Sagging Skin", "Loss of Elasticity", "Crow's Feet", "Neck Aging"],
        "accent_from": "#fce7f3", "accent_to": "#fbcfe8", "accent_text": "#831843",
        "keywords": ["anti-aging", "anti aging", "antiaging", "retinol", "retinoid", "retinal",
                     "peptide", "wrinkle", "firming", "lifting", "bakuchiol", "collagen",
                     "age reset", "youth", "anti-wrinkle", "rejuvenat"],
        "sort_order": 5, "is_active": True,
    },
    {
        "slug": "sensitivity", "name": "Sensitivity & Barrier Damage", "icon": "🌸",
        "tagline": "Redness · Irritation · Reactive skin",
        "subs": ["Sensitive Skin", "Redness", "Irritation", "Burning Sensation", "Damaged Barrier", "Allergic Reactions"],
        "accent_from": "#fef2f2", "accent_to": "#fecaca", "accent_text": "#7f1d1d",
        "keywords": ["sensitive", "soothing", "calming", "redness", "cica", "centella",
                     "panthenol", "allantoin", "fragrance-free", "fragrance free", "hypoallergenic", "gentle"],
        "sort_order": 6, "is_active": True,
    },
    {
        "slug": "texture-pores", "name": "Texture & Pores", "icon": "🔍",
        "tagline": "Open pores · Bumpy · Congested",
        "subs": ["Open Pores", "Bumpy Skin", "Uneven Texture", "Congested Skin"],
        "accent_from": "#f0fdf4", "accent_to": "#dcfce7", "accent_text": "#14532d",
        "keywords": ["pore", "exfoliat", "smooth texture", "aha", "bha", "glycolic acid", "lactic acid",
                     "pore minimizer", "pore refining"],
        "sort_order": 7, "is_active": True,
    },
    {
        "slug": "brightening-glow", "name": "Brightening & Glow", "icon": "💎",
        "tagline": "Dull skin · Lack of glow",
        "subs": ["Dull Skin", "Lack of Glow", "Tired-Looking Skin"],
        "accent_from": "#fef9c3", "accent_to": "#fef08a", "accent_text": "#713f12",
        "keywords": ["bright", "glow", "vitamin c", "vit-c", "radiance", "illuminating",
                     "dull skin", "luminous", "ascorbic"],
        "sort_order": 8, "is_active": True,
    },
    {
        "slug": "under-eye", "name": "Under Eye Concerns", "icon": "👁️",
        "tagline": "Dark circles · Puffiness · Eye bags",
        "subs": ["Dark Circles", "Puffy Eyes", "Eye Bags", "Fine Lines Under Eyes"],
        "accent_from": "#e0e7ff", "accent_to": "#c7d2fe", "accent_text": "#1e1b4b",
        "keywords": ["under eye", "dark circle", "eye cream", "eye gel", "eye serum",
                     "puffy eye", "caffeine", "eye patch", "eye mask"],
        "sort_order": 9, "is_active": True,
    },
    {
        "slug": "barrier-support", "name": "Hydration & Barrier Support", "icon": "🛡️",
        "tagline": "Weak barrier · Moisture loss · Repair",
        "subs": ["Weak Barrier", "Moisture Loss", "Skin Repair"],
        "accent_from": "#ecfeff", "accent_to": "#cffafe", "accent_text": "#164e63",
        "keywords": ["barrier repair", "moisture barrier", "skin barrier", "squalane",
                     "phytosphingosine", "recovery balm", "barrier cream"],
        "sort_order": 10, "is_active": True,
    },
    {
        "slug": "skin-conditions", "name": "Infection & Skin Conditions", "icon": "🩺",
        "tagline": "Eczema · Psoriasis · Rosacea",
        "subs": ["Eczema", "Psoriasis", "Rosacea", "Fungal Acne", "Dermatitis"],
        "accent_from": "#faf5ff", "accent_to": "#e9d5ff", "accent_text": "#581c87",
        "keywords": ["eczema", "psoriasis", "rosacea", "dermatitis", "fungal", "atopic",
                     "anti-itch", "anti itch"],
        "sort_order": 11, "is_active": True,
    },
    {
        "slug": "sun-protection", "name": "Sun Protection", "icon": "☀️",
        "tagline": "SPF · UV · Photoaging · Sunburn",
        "subs": ["UV Damage", "Photoaging", "Sunburn", "Tanning Prevention"],
        "accent_from": "#fef3c7", "accent_to": "#fed7aa", "accent_text": "#7c2d12",
        "keywords": ["sunscreen", "spf", "uv protect", "uva", "uvb", "pa+", "sun protect",
                     "broad spectrum", "after sun"],
        "sort_order": 12, "is_active": True,
    },
    {
        "slug": "mens-skincare", "name": "Men's Skincare", "icon": "🧔",
        "tagline": "Razor bumps · Ingrown · Beard",
        "subs": ["Razor Bumps", "Ingrown Hair", "Post-Shave Irritation"],
        "accent_from": "#e7e5e4", "accent_to": "#d6d3d1", "accent_text": "#1c1917",
        "keywords": ["men's", " men ", "shave", "razor", "ingrown", "beard", "post-shave",
                     "for men", "male grooming"],
        "sort_order": 13, "is_active": True,
    },
]


# ============================================================
# SKINCARE — 16 main categories with subs (user's Jan 2026 spec)
# Stored as: db.categories (top-level) + db.subcategories (sub items)
# ============================================================
SKINCARE_CATEGORIES = [
    {"slug": "cleansers", "name": "Cleansers", "icon": "🧼", "sort_order": 1,
     "subs": [("face-wash", "Face Wash"), ("gel-cleanser", "Gel Cleanser"),
              ("foam-cleanser", "Foam Cleanser"), ("cream-cleanser", "Cream Cleanser"),
              ("oil-cleanser", "Oil Cleanser"), ("micellar-water", "Micellar Water"),
              ("cleansing-balm", "Cleansing Balm")],
     "keywords": ["cleanser", "face wash", "facewash", "face-wash", "micellar",
                  "cleansing", "facial wash", "facial foam", "facial cleanser",
                  "purifying wash", "deep cleanse", "gentle wash", "gentle cleanser",
                  "wash gel", "cleansing oil", "cleansing milk", "cleansing balm",
                  "mousse cleanser", "jelly cleanser", "clnsr", "clenser",
                  "cleansing powder", "cleansing water", "fresh canvas"]},
    {"slug": "exfoliators", "name": "Exfoliators", "icon": "✨", "sort_order": 2,
     "subs": [("face-scrub", "Face Scrub"), ("chemical-exfoliant", "Chemical Exfoliant"),
              ("aha-exfoliant", "AHA Exfoliant"), ("bha-exfoliant", "BHA Exfoliant"),
              ("peeling-solution", "Peeling Solution"), ("enzyme-peel", "Enzyme Peel")],
     "keywords": ["face scrub", "scrub", "exfoliat", "peel", "aha", "bha", "enzyme",
                  "glycolic", "lactic acid", "mandelic", "salicylic peel", "polishing",
                  "buffing", "resurfacing", "ahb", "skin polisher", "peel solution"]},
    {"slug": "toners-mists", "name": "Toners & Mists", "icon": "💦", "sort_order": 3,
     "subs": [("toner", "Toner"), ("face-mist", "Face Mist"),
              ("hydrating-mist", "Hydrating Mist"), ("exfoliating-toner", "Exfoliating Toner")],
     "keywords": ["toner", "face mist", "facial mist", "rose mist", "hydration mist",
                  "mist spray", "essence water", "skin tonic", "astringent",
                  "pore tightener", "pore minimizer toner", "ph balanced toner",
                  "refreshing mist", "dewy mist", "setting mist", "dewy setting",
                  "matte setting", "fixer spray", "makeup fixer"]},
    {"slug": "serums-treatments", "name": "Serums & Treatments", "icon": "💎", "sort_order": 4,
     "subs": [("vitamin-c-serum", "Vitamin C Serum"),
              ("hyaluronic-acid-serum", "Hyaluronic Acid Serum"),
              ("niacinamide-serum", "Niacinamide Serum"),
              ("retinol-serum", "Retinol Serum"),
              ("salicylic-acid-serum", "Salicylic Acid Serum"),
              ("peptide-serum", "Peptide Serum"),
              ("brightening-serum", "Brightening Serum"),
              ("anti-acne-serum", "Anti-Acne Serum")],
     "keywords": ["serum", "treatment serum", "booster serum", "concentrate",
                  "vit c serum", "vitamin c", "vitamin-c", "niacinamide",
                  "hyaluronic", "hyaluronic acid", "salicylic", "retinol",
                  "peptide", "ferulic", "glow serum", "youth serum", "anti aging serum"]},
    {"slug": "moisturizers", "name": "Moisturizers", "icon": "🧴", "sort_order": 5,
     "subs": [("gel-moisturizer", "Gel Moisturizer"),
              ("cream-moisturizer", "Cream Moisturizer"),
              ("lotion", "Lotion"), ("night-cream", "Night Cream"),
              ("barrier-repair-cream", "Barrier Repair Cream")],
     "keywords": ["moisturiz", "moisturis", "face cream", "day cream", "night cream",
                  "face lotion", "hydrating cream", "gel cream", "gel-cream",
                  "aqua gel", "water cream", "face emulsion", "facial emulsion",
                  "matte cream", "oil-free cream", "rich cream", "face balm",
                  "day lotion", "night lotion", "nourishing cream",
                  "day creme", "night creme", "creme moistrsr", "moistrsr",
                  "complexion care", "crm moisture", "skin moisture",
                  "milk crm", "milk cream", "bb cream moisturiz"]},
    {"slug": "sunscreens", "name": "Sunscreens", "icon": "☀️", "sort_order": 6,
     "subs": [("gel-sunscreen", "Gel Sunscreen"), ("cream-sunscreen", "Cream Sunscreen"),
              ("mineral-sunscreen", "Mineral Sunscreen"),
              ("tinted-sunscreen", "Tinted Sunscreen"),
              ("spray-sunscreen", "Spray Sunscreen"), ("stick-sunscreen", "Stick Sunscreen")],
     "keywords": ["sunscreen", "sunblock", "spf", "sun protect", "spf50", "spf 50",
                  "spf30", "spf 30", "spf 60", "uv protect", "uv shield",
                  "sun shield", "sun cream", "sun gel", "sun lotion", "sun stick",
                  "after sun", "sunscrn", "sun scrn", "sun expert"]},
    {"slug": "masks-packs", "name": "Masks & Packs", "icon": "🧖", "sort_order": 7,
     "subs": [("clay-mask", "Clay Mask"), ("sheet-mask", "Sheet Mask"),
              ("sleeping-mask", "Sleeping Mask"), ("peel-off-mask", "Peel-Off Mask"),
              ("mud-mask", "Mud Mask"), ("hydrating-mask", "Hydrating Mask")],
     "keywords": ["face mask", "sheet mask", "clay mask", "mud mask", "sleeping mask",
                  "face pack", "peel-off", "detox mask", "rose clay", "kaolin",
                  "bentonite", "charcoal mask", "overnight mask", "wash-off mask"]},
    {"slug": "spot-treatments", "name": "Spot Treatments", "icon": "🎯", "sort_order": 8,
     "subs": [("acne-patch", "Acne Patch"), ("spot-corrector", "Spot Corrector"),
              ("pimple-gel", "Pimple Gel"), ("scar-treatment", "Scar Treatment")],
     "keywords": ["acne patch", "pimple patch", "spot corrector", "pimple gel", "scar treatment",
                  "scar gel", "spot gel", "acne gel", "acne control", "spot control",
                  "blemish gel", "anti-acne gel", "acne stop", "acne spot", "acne care",
                  "blemish", "hydrocolloid patch", "zit patch", "dark spot remover",
                  "spot eraser", "pimple cream"]},
    {"slug": "eye-care", "name": "Eye Care", "icon": "👁️", "sort_order": 9,
     "subs": [("eye-cream", "Eye Cream"), ("eye-gel", "Eye Gel"),
              ("under-eye-patch", "Under Eye Patch")],
     "keywords": ["eye cream", "eye gel", "under eye patch", "eye serum", "under-eye",
                  "dark circle cream", "puffy eye gel", "eye balm", "eye treatment",
                  "anti-aging eye", "wrinkle eye"]},
    {"slug": "lip-care", "name": "Lip Care", "icon": "💋", "sort_order": 10,
     "subs": [("lip-balm", "Lip Balm"), ("lip-mask", "Lip Mask"),
              ("lip-scrub", "Lip Scrub"), ("lip-oil", "Lip Oil")],
     "keywords": ["lip balm", "lip mask", "lip scrub", "lip oil", "lip treatment",
                  "lip butter", "lip therapy", "lip moisturiz", "lip hydrat",
                  "tinted lip balm", "vaseline lip", "petroleum jelly lip"]},
    {"slug": "face-oils", "name": "Face Oils", "icon": "🫒", "sort_order": 11,
     "subs": [("facial-oil", "Facial Oil"), ("overnight-oil", "Overnight Oil"),
              ("glow-oil", "Glow Oil")],
     "keywords": ["face oil", "facial oil", "glow oil", "overnight oil", "elixir oil",
                  "rosehip oil", "jojoba oil face", "argan oil face", "ubtan oil"]},
    {"slug": "essences-ampoules", "name": "Essences & Ampoules", "icon": "💧", "sort_order": 12,
     "subs": [("essence", "Essence"), ("ampoule", "Ampoule"), ("booster", "Booster")],
     "keywords": ["essence", "ampoule", "skin booster", "first treatment essence",
                  "treatment essence", "ferment essence"]},
    {"slug": "barrier-care", "name": "Skin Repair & Barrier Care", "icon": "🛡️", "sort_order": 13,
     "subs": [("cica-cream", "Cica Cream"), ("ceramide-cream", "Ceramide Cream"),
              ("recovery-balm", "Recovery Balm")],
     "keywords": ["cica cream", "cica gel", "ceramide cream", "ceramide", "recovery balm",
                  "barrier cream", "repair balm", "soothing cream", "calming cream",
                  "rescue balm", "centella", "panthenol cream", "redness relief"]},
    {"slug": "brightening-products", "name": "Brightening Products", "icon": "💡", "sort_order": 14,
     "subs": [("pigmentation-cream", "Pigmentation Cream"),
              ("dark-spot-corrector", "Dark Spot Corrector"),
              ("glow-cream", "Glow Cream")],
     "keywords": ["brightening cream", "glow cream", "pigmentation cream", "dark spot cream",
                  "dark spot corrector", "melasma cream", "whitening cream", "fairness cream",
                  "luminizing cream", "radiance cream", "spot correcting", "anti-pigmentation"]},
    {"slug": "anti-aging-products", "name": "Anti-Aging Products", "icon": "⏳", "sort_order": 15,
     "subs": [("retinol-cream", "Retinol Cream"),
              ("firming-cream", "Firming Cream"),
              ("wrinkle-treatment", "Wrinkle Treatment")],
     "keywords": ["retinol cream", "firming cream", "wrinkle cream", "anti-aging cream",
                  "anti-wrinkle", "age-defying", "youth cream", "lift cream",
                  "tightening cream", "collagen cream", "neck firming", "neck cream"]},
    {"slug": "body-skincare", "name": "Body Skincare", "icon": "🛁", "sort_order": 16,
     "subs": [("body-lotion", "Body Lotion"), ("body-butter", "Body Butter"),
              ("body-wash", "Body Wash"), ("body-scrub", "Body Scrub"),
              ("body-oil", "Body Oil"), ("hand-cream", "Hand Cream"),
              ("foot-cream", "Foot Cream")],
     "keywords": ["body lotion", "body wash", "body butter", "body scrub", "body oil",
                  "hand cream", "foot cream", "shower gel", "shower oil", "bath salt",
                  "bath oil", "body milk", "body cream", "body mist", "body spray",
                  "hand lotion", "foot lotion", "elbow cream", "heel balm",
                  "bubble bath", "shower foam", "moisturizing soap"]},
]


# ============================================================
# COSMETICS — 7 main categories with subs (user's Jan 2026 spec)
# Structure: Makeup > {Face, Lips, Eyes, Nails, Tools & Brushes,
#                      Multi-Functional Palettes, Makeup Kits & Combos}
# Each category has a "Complete X Collection" virtual entry handled
# on the frontend by listing all products in the category (no DB row).
# ============================================================
COSMETICS_CATEGORIES = [
    {"slug": "face-makeup", "name": "Face", "icon": "🎭", "sort_order": 20,
     "subs": [("face-primer", "Face Primer"),
              ("concealer", "Concealer"),
              ("foundation", "Foundation"),
              ("compact", "Compact"),
              ("contour", "Contour"),
              ("loose-powder", "Loose Powder"),
              ("blush", "Blush"),
              ("bb-cc-cream", "BB & CC Cream"),
              ("highlighters", "Highlighters"),
              ("setting-spray", "Setting Spray"),
              ("makeup-remover", "Makeup Remover"),
              ("sindoor", "Sindoor"),
              ("tinted-moisturizer", "Tinted Moisturizer"),
              ("bronzer", "Bronzer")],
     "keywords": ["face primer", "primer", "concealer", "foundation",
                  "compact", "compact powder", "contour", "loose powder",
                  "setting powder", "face powder", "blush", "bb cream", "cc cream",
                  "highlighter", "highlighting", "setting spray", "fixer spray",
                  "makeup fixer", "makeup remover", "make-up remover",
                  "make up remover", "sindoor",
                  "tinted moisturiz", "bronzer", "rouge", "banana powder",
                  "translucent powder", "finishing powder", "color corrector",
                  "colour corrector", "blur powder", "bake and blur",
                  "bake powder", "powder mat", "fndtn", "fndn", "fdn",
                  "9to5", "9 to 5", "9-5"]},

    {"slug": "lips", "name": "Lips", "icon": "💋", "sort_order": 21,
     "subs": [("lipstick", "Lipstick"),
              ("liquid-lipstick", "Liquid Lipstick"),
              ("lip-crayon", "Lip Crayon"),
              ("lip-gloss", "Lip Gloss"),
              ("lip-liner", "Lip Liner"),
              ("lip-primer", "Lip Primer"),
              ("lip-plumper", "Lip Plumper"),
              ("lip-tint", "Lip Tint")],
     "keywords": ["lipstick", "lipstik", "liquid lipstick", "matte lip",
                  "lip crayon", "lip pencil", "lip gloss", "lip liner",
                  "lip primer", "lip plumper", "lip tint", "lip stain",
                  "lip color", "lip colour", "lip clr", "lipcolor", "lipclr",
                  "lip & cheek tint", "lippy", "lippie", "powder bullet",
                  "powder bullett", "lip bullet", "color pops", "colour pops",
                  "color crush", "colour crush", "true wear",
                  "plump and shine", "plump & shine", "lip & cheek",
                  "lip&cheek", "lip oil tint",
                  "lip love", "lip-love", "smudge me not", "vinyl ink",
                  "lifter plump", "matte ink", "superstay matte",
                  "ultimatte", "color rivals", "color show", "color sensation",
                  "lustreglass", "moisturecore"]},

    {"slug": "eyes", "name": "Eyes", "icon": "👁️", "sort_order": 22,
     "subs": [("kajal", "Kajal"),
              ("eyeliner", "Eyeliner"),
              ("mascara", "Mascara"),
              ("eye-shadow", "Eye Shadow"),
              ("eyebrow-enhancers", "Eye Brow Enhancers"),
              ("eye-primer", "Eye Primer"),
              ("false-eyelashes", "False Eyelashes"),
              ("eye-makeup-remover", "Eye Makeup Remover"),
              ("under-eye-concealer", "Under Eye Concealer"),
              ("contact-lenses", "Contact Lenses")],
     "keywords": ["kajal", "kohl", "eyeliner", "eye liner", "mascara",
                  "eye drama", "shine line", "gloss artist",
                  "eye shadow", "eyeshadow", "eyebrow", "eye brow",
                  "brow pencil", "brow gel", "brow powder", "brow enhancer",
                  "false lash", "false eyelash", "eye primer",
                  "eye makeup remover", "under eye concealer", "eyeconic",
                  "contact lens"]},

    {"slug": "nails", "name": "Nails", "icon": "💅", "sort_order": 23,
     "subs": [("nail-polish", "Nail Polish"),
              ("nail-enamel", "Nail Enamel"),
              ("nail-art", "Nail Art"),
              ("nail-care", "Nail Care"),
              ("nail-strengthener", "Nail Strengthener"),
              ("cuticle-oil", "Cuticle Oil"),
              ("nail-remover", "Nail Polish Remover")],
     "keywords": ["nail polish", "nail enamel", "nail lacquer", "nail color",
                  "nail colour", "nail paint", "nail art", "nail care",
                  "nail strengthener", "cuticle", "nail remover",
                  "nail pops", "nail gel", "gel finish nail",
                  "nail file", "nail buffer", "nail glitter"]},

    {"slug": "tools-brushes", "name": "Tools & Brushes", "icon": "🖌️", "sort_order": 24,
     "subs": [("face-brush", "Face Brush"),
              ("eye-brush", "Eye Brush"),
              ("lip-brush", "Lip Brush"),
              ("brush-sets", "Brush Sets"),
              ("brush-cleaners", "Brush Cleaners"),
              ("sponges-applicators", "Sponges & Applicators"),
              ("eyelash-curlers", "Eyelash Curlers"),
              ("tweezers", "Tweezers"),
              ("sharpeners", "Sharpeners"),
              ("mirrors", "Mirrors"),
              ("makeup-pouches", "Makeup Pouches")],
     "keywords": ["makeup brush", "face brush", "eye brush", "lip brush",
                  "brush set", "brush cleaner", "beauty sponge", "puff",
                  "blender", "applicator", "eyelash curler", "tweezer",
                  "sharpener", "compact mirror", "makeup pouch", "makeup bag"]},

    {"slug": "multi-palettes", "name": "Multi-Functional Makeup Palettes",
     "icon": "🎨", "sort_order": 25,
     "subs": [("eye-shadow-palette", "Eye Shadow Palette"),
              ("face-palette", "Face Palette"),
              ("lip-palette", "Lip Palette"),
              ("cheek-palette", "Cheek Palette"),
              ("all-in-one-palette", "All-In-One Palette")],
     "keywords": ["palette", "eye shadow palette", "eyeshadow palette",
                  "face palette", "lip palette", "cheek palette",
                  "multi-use palette", "all-in-one palette", "blush palette",
                  "contour palette", "highlighter palette"]},

    {"slug": "makeup-kits", "name": "Makeup Kits & Combos", "icon": "🎁", "sort_order": 26,
     "subs": [("starter-kit", "Starter Kits"),
              ("travel-kit", "Travel Kits"),
              ("bridal-kit", "Bridal Kits"),
              ("gift-set", "Gift Sets"),
              ("combo-set", "Combo Sets")],
     "keywords": ["makeup kit", "makeup set", "starter kit", "travel kit",
                  "bridal kit", "gift set", "gift box", "combo set",
                  "combo pack"]},
]


# ============================================================
# SUBCATEGORY ICONS — unique emoji per sub so the hub tiles
# don't all show the parent's icon. Falls back to parent icon
# if a sub slug isn't listed here.
# ============================================================
SUBCAT_ICONS = {
    # ----- Cosmetics: Face -----
    "face-primer": "🪞", "concealer": "🩹", "foundation": "🧴",
    "compact": "⚪", "contour": "🌗", "loose-powder": "🌸",
    "blush": "🌷", "bb-cc-cream": "💧", "highlighters": "✨",
    "setting-spray": "💨", "makeup-remover": "🧼", "sindoor": "🔴",
    "tinted-moisturizer": "💦", "bronzer": "🌞",
    # ----- Cosmetics: Lips -----
    "lipstick": "💋", "liquid-lipstick": "💄", "lip-crayon": "✏️",
    "lip-gloss": "✨", "lip-liner": "✒️", "lip-primer": "💋",
    "lip-plumper": "🍒", "lip-tint": "🌹",
    # ----- Cosmetics: Eyes -----
    "kajal": "👁️", "eyeliner": "✒️", "mascara": "🪶",
    "eye-shadow": "🌈", "eyebrow-enhancers": "🪡", "eye-primer": "👀",
    "false-eyelashes": "🦋", "eye-makeup-remover": "💧",
    "under-eye-concealer": "🌙", "contact-lenses": "🔮",
    # ----- Cosmetics: Nails -----
    "nail-polish": "💅", "nail-enamel": "💎", "nail-art": "🎨",
    "nail-care": "🌟", "nail-strengthener": "💪", "cuticle-oil": "🪻",
    "nail-remover": "🧴",
    # ----- Cosmetics: Tools & Brushes -----
    "face-brush": "🖌️", "eye-brush": "🖌️", "lip-brush": "🖌️",
    "brush-sets": "🎨", "brush-cleaners": "🧼",
    "sponges-applicators": "🍡", "eyelash-curlers": "🌀",
    "tweezers": "✂️", "sharpeners": "✏️", "mirrors": "🪞",
    "makeup-pouches": "👛",
    # ----- Cosmetics: Multi-Functional Palettes -----
    "eye-shadow-palette": "🎨", "face-palette": "🎭",
    "lip-palette": "💋", "cheek-palette": "🌸",
    "all-in-one-palette": "🌈",
    # ----- Cosmetics: Makeup Kits & Combos -----
    "starter-kit": "🎁", "travel-kit": "🧳", "bridal-kit": "👰",
    "gift-set": "🎀", "combo-set": "📦",
    # ----- Skincare: Cleansers -----
    "face-wash": "🧴", "gel-cleanser": "💧", "foam-cleanser": "🫧",
    "cream-cleanser": "🥛", "oil-cleanser": "🫒",
    "micellar-water": "💦", "cleansing-balm": "🍦",
    # ----- Skincare: Exfoliators -----
    "face-scrub": "🌰", "chemical-exfoliant": "⚗️",
    "aha-exfoliant": "🧪", "bha-exfoliant": "🧬",
    "peeling-solution": "🌊", "enzyme-peel": "🥝",
    # ----- Skincare: Toners & Mists -----
    "toner": "💧", "face-mist": "💨", "hydrating-mist": "💦",
    "exfoliating-toner": "✨",
    # ----- Skincare: Serums -----
    "vitamin-c-serum": "🍊", "hyaluronic-acid-serum": "💧",
    "niacinamide-serum": "🧪", "retinol-serum": "🌟",
    "salicylic-acid-serum": "🎯", "peptide-serum": "🔬",
    "brightening-serum": "✨", "anti-acne-serum": "🛡️",
    # ----- Skincare: Moisturizers -----
    "gel-moisturizer": "💎", "cream-moisturizer": "🥛",
    "lotion": "🧴", "night-cream": "🌙",
    "barrier-repair-cream": "🛡️",
    # ----- Skincare: Sunscreens -----
    "gel-sunscreen": "💧", "cream-sunscreen": "🧴",
    "mineral-sunscreen": "⛰️", "tinted-sunscreen": "🎨",
    "spray-sunscreen": "💨", "stick-sunscreen": "🖊️",
    # ----- Skincare: Masks & Packs -----
    "clay-mask": "🌿", "sheet-mask": "📜", "sleeping-mask": "😴",
    "peel-off-mask": "🍃", "mud-mask": "🌋", "hydrating-mask": "💧",
    # ----- Skincare: Spot Treatments -----
    "acne-patch": "🩹", "spot-corrector": "🎯",
    "pimple-gel": "💊", "scar-treatment": "🌱",
    # ----- Skincare: Eye Care -----
    "eye-cream": "👁️", "eye-gel": "💧", "under-eye-patch": "🌙",
    # ----- Skincare: Lip Care -----
    "lip-balm": "🍯", "lip-mask": "💋", "lip-scrub": "🍓",
    "lip-oil": "✨",
    # ----- Skincare: Face Oils -----
    "facial-oil": "🌹", "overnight-oil": "🌙", "glow-oil": "✨",
    # ----- Skincare: Essences -----
    "essence": "💧", "ampoule": "💉", "booster": "🚀",
    # ----- Skincare: Barrier Care -----
    "cica-cream": "🌿", "ceramide-cream": "🛡️",
    "recovery-balm": "🩹",
    # ----- Skincare: Brightening -----
    "pigmentation-cream": "🌗", "dark-spot-corrector": "🎯",
    "glow-cream": "✨",
    # ----- Skincare: Anti-Aging -----
    "retinol-cream": "🌟", "firming-cream": "💪",
    "wrinkle-treatment": "⏳",
    # ----- Skincare: Body -----
    "body-lotion": "🛁", "body-butter": "🧈", "body-wash": "🚿",
    "body-scrub": "🌰", "body-oil": "💆", "hand-cream": "👐",
    "foot-cream": "🦶",
}
# Featured nav strip + promo sections rendered on /cosmetics page.
# Each entry has `kind`: "tag" (filter by tags array), "subcategory"
# (filter by subcategory slug), "category" (filter by category slug),
# "subcategory-group" (multi-subcategory OR), or "collection" (curated
# handpicked list — admin-managed).
# ============================================================
COSMETICS_FEATURED_NAV = [
    {"slug": "bestseller", "label": "Bestseller", "kind": "tag", "value": "bestseller"},
    {"slug": "new-launch", "label": "New Launch", "kind": "tag", "value": "new_launch"},
    {"slug": "bridal-store", "label": "Bridal Store", "kind": "collection",
     "value": "bridal-store"},
    {"slug": "base-makeup-routine", "label": "Base Makeup Routine", "kind": "collection",
     "value": "base-makeup-routine"},
    {"slug": "foundation", "label": "Foundation", "kind": "subcategory", "value": "foundation"},
    {"slug": "concealer", "label": "Concealer", "kind": "subcategory", "value": "concealer"},
    {"slug": "eye-shadow", "label": "Eye Shadow", "kind": "subcategory", "value": "eye-shadow"},
    {"slug": "eyeliner-kajals", "label": "Eyeliner & Kajals", "kind": "subcategory-group",
     "value": ["eyeliner", "kajal"]},
    {"slug": "mascara", "label": "Mascara", "kind": "subcategory", "value": "mascara"},
    {"slug": "lipstick", "label": "Lipstick", "kind": "subcategory", "value": "lipstick"},
    {"slug": "nail-polish", "label": "Nail Polish", "kind": "subcategory", "value": "nail-polish"},
    {"slug": "tools-brushes", "label": "Tools & Brushes", "kind": "category",
     "value": "tools-brushes"},
]

COSMETICS_PROMO_SECTIONS = [
    {"slug": "best-of-makeup", "title": "Best Of Makeup",
     "subtitle": "Top-rated picks loved by thousands",
     "kind": "tag", "value": "bestseller", "limit": 12},
    {"slug": "brands-you-will-love", "title": "Brands You Will Love",
     "subtitle": "Featured cosmetics brands",
     "kind": "brands", "value": None, "limit": 12},
    {"slug": "find-your-perfect-match", "title": "Find Your Perfect Match",
     "subtitle": "Shade-finder powered by your skin tone",
     "kind": "shade-finder", "value": None, "limit": 0},
]



# ============================================================
# Definitive keyword tiers — these ALWAYS win the niche, even
# if the other niche has more "soft" keyword hits. Solves the
# "Lakme Vit C Superglow Concealer" problem (Vit C + Niacinamide
# beat Concealer in the soft-hit counter, but Concealer is clearly
# a cosmetic).
# ============================================================
_DEFINITE_COSMETICS_KW = [
    "concealer", "foundation", "fndtn", "fndn", " fdn ", "fdn-", " fdn,",
    "compact", "blush", "bronzer", "highlighter", "highliter", "contour",
    "lipstick", "lipstik", "lipstcik", "lipstck", "lipstk", "lipcolor",
    "lipclr", "lip clr", "lip color", "lip colour",
    "color pops", "colour pops", "color crush", "colour crush",
    "true wear", "liquid lip", "liq lip", "matte lip", "lip crayon", "lip gloss",
    "lip liner", "lip plumper", "lip tint", "lippy", "lippie",
    "powder bullet", "plump and shine", "plump & shine",
    "lip & cheek", "lip and cheek", "lip-cheek", "lip&cheek", "cheek tint",
    "lip love", "lip glaze", "lip pen", "smudge me not",
    "mascara", "kajal", "kohl", "eyeliner", "eye liner",
    "eye drama", "shine line", "gloss artist", "eye shadow", "eyeshadow",
    "eye pencil", "eyebrow pencil", "brow pencil", "brow gel", "brow powder",
    "brow enhancer", "fashion brow",
    "false lash", "false eyelash", "fake lash",
    "nail polish", "nailpolish", "nail enamel", "nail enam", "nail lacquer", "nail paint",
    "nail art", "nail color", "nail colour", "nail care",
    "nail strengthener", "nail hardener", "cuticle oil",
    "cuticle conditioner", "nail polish remover", "nail polsh",
    "nail polsh remover", "nail pops", "chrome nail", "stick on nails",
    "sindoor", "bb cream", "cc cream",
    "fit me bb", "fit me cnclr", "fit me cncl", "fit me conceal",
    "fit me loose", "fit me pwd", "fit me fdt", "fit me fdn",
    "loose pwd", "pwd mat+pore",
    "double wear", "skin tnt", "skin tint",
    "cake make-up", "cake makeup", "cake make up",
    "mattreal mousse", "lip mouse", "matte luxe", "matte as hell",
    "lipsitick", "lipstic", "lpstk", "sensational lip", "mattifying lip",
    "sinful plumping", "sinful lip", "delulu liq", "delulu liquid",
    "lifter gloss", "lifter plump", "vinyl sauce", "tattoo liner",
    "liquid matte", "matte ink", "baby lips", "fresh tint",
    "high on cover", "fmc fdtn", "fmc fdn", "cs creamy matte",
    "color lock", "transfer not crayon", "lit lip", "lip stack",
    "superstay crayon", "plumping gloss", "plumping lg",
    "teddy tint", "lip n ckeek", "lip n cheek",
    "ab gel stylist", "be-jewel lip", "be-jewel eye",
    "ts liners", "tattoo studio",
    "im unlimited", "twinkle star",
    "arch arrival", "brow definer",
    "glamor eyes", "lip cream", "mousse muse",
    "nail laquer", "nail luxe", "nail enam",
    " np ", "np bridgerton",
    "lip stick", "eye drama",
    "stay the day", "fnshing mist",
    "setting spray", "fixer spray", "makeup fixer", "makeup remover",
    "make-up remover", "make up remover",
    "tinted moisturiz", "color corrector", "colour corrector",
    "lip primer", "eye primer", "face primer",
    "loose powder", "setting powder", "compact powder", "face powder",
    "banana powder", "translucent powder", "finishing powder",
    "blur powder", "bake powder", "bake and blur", "powder mat",
    "makeup brush", "beauty sponge", "brush set", "brush cleaner",
    "eyelash curler", "eyebrow",
    "eye palette", "lip palette", "blush palette", "contour palette",
    "eye shadow palette", "highlighting palette",
    " palette",  # noun-form
    "contact lens", "sharpner", "sharpener",
    "paint stick", "tv paint", "cream liner",
    "strobe cream", "strobing cream", "stardust glitter", "dazzle dot",
    "mousse shadow", "color splash", "skin tnt",
]

_DEFINITE_SKINCARE_KW = [
    "sunscreen", "sunblock", " spf ", "spf 30", "spf 40", "spf 50",
    "face wash", "facewash", "face cleanse", "facial wash",
    "face scrub", "face mask", "sheet mask", "clay mask", "mud mask",
    "sleeping mask", "body wash", "body lotion", "body butter",
    "body scrub", "body oil", "shower gel", "shower oil",
    "hand cream", "foot cream",
    "acne patch", "pimple patch", "spot corrector", "scar gel", "scar treatment",
    "barrier repair", "cica cream", "ceramide cream", "recovery balm",
    "facial oil", "face oil", "lip balm", "lip mask", "lip scrub", "lip oil",
    "micellar", "cleansing balm", "rosewater", "toner mist", "face mist",
    "deo rollon", "deo roll-on", "deodorant spray", "deodorant",
    "body lovin",
]

_HAIRCARE_KW = [
    "shampoo", "hair oil", "hair serum", "hair spray",
    "hair mask", "hair gel", "hair color", "hair colour", "hair dye",
    "hair pack", "hair fall", "hair growth", "hair tonic", "hair cream",
    "hair tool", "hair brush", "hair wax", "scalp", "anti-dandruff",
    "anti dandruff", "hair conditioner", "hair-conditioner",
    "hair shampoo", "hair&shampoo", "hair styling",
    "head to toe wash", "frizz control", "bond repair hair",
    "hair powder", "onion hair", "argan hair", "scalp serum",
    "loreal excellence", "casting creme", "casting cream",
    "rice water hair", "loreal gg eg", "co-earth argan",
    "co-earth onion", "co-earth almond",
]

# Niche detection — used when product name alone is ambiguous
_COSMETICS_HARD_KW = [
    "lipstick", "lippy", "lippie", "lip love", "lip gloss", "lip liner",
    "lip crayon", "lip tint", "lip stain", "lip plumper", "lip primer",
    "lip color", "lip colour", "lip bullet", "powder bullet", "powder bullett",
    "mascara", "kajal", "kohl", "eyeliner", "eye liner", "eye shadow", "eyeshadow",
    "eye brow", "eyebrow", "brow pencil", "brow gel", "brow powder",
    "false lash", "false eyelash",
    "foundation", "concealer", "compact", "blush", "bronzer", "rouge",
    "highlighter", "highlighting", "contour", "bb cream", "cc cream",
    " bb ", " cc ", "bb mousse", "cc mousse", "9to5", "9-to-5",
    "setting spray", "fixer spray", "makeup fixer", "primer",
    "tinted moisturiz", "color corrector", "colour corrector", "corector",
    "corrector", "loose powder", "setting powder", "face powder",
    "compact powder", "banana powder", "finishing powder", "translucent powder",
    "nail polish", "nail enamel", "nail lacquer", "nail color", "nail colour",
    "nail art", "nail paint",
    "makeup brush", "beauty sponge", "brush set",
    "eyelash curler", "tweezer", "sharpener",
    "matte lip", "liquid lip", "lip pencil", "sindoor", "palette",
]

# Brand-based niche hint — when name starts with these brands, lean cosmetics.
_COSMETICS_BRANDS = {
    "lakme", "lk", "l'oreal", "loreal", "maybelline", "ml", "sugar",
    "faces canada", "faces", "mac", "mars", "miss claire", "huda",
    "colorbar", "nykaa cosmetics", "elle18", "elle 18", "swiss beauty",
    "insight", "blue heaven", "kay beauty", "rimmel", "revlon",
    "chambor", "mamaearth makeup",
}

# ============================================================
# GRANULAR SUBCATEGORY KEYWORDS — priority ordered (first match wins)
# ------------------------------------------------------------
# After classify_product picks the category, this dict drives the
# SUBCATEGORY selection so products land on the right specific tile
# (Gel Cleanser, Foam Cleanser, Niacinamide Serum, etc.) instead of
# all bunching under the generic "face-wash"/null subcategory.
# Each list is ordered MOST SPECIFIC -> MOST GENERIC. The first
# phrase that matches the product text wins.
# ============================================================
_CATEGORY_SUBCATEGORY_KW: dict[str, list[tuple[str, list[str]]]] = {
    # ----- SKINCARE -----
    "cleansers": [
        ("micellar-water", ["micellar water", "micellar", "cleansing water",
                              "swipe right cleansing"]),
        ("cleansing-balm", ["cleansing balm", "balm cleanser", "balm to oil"]),
        ("oil-cleanser", ["oil cleanser", "cleansing oil", "oil cleansing", "oil based cleanser"]),
        ("foam-cleanser", ["foam cleanser", "foaming cleanser", "foaming face wash",
                            "foaming wash", "foam wash", "facial foam", "foaming gentle",
                            "mousse cleanser", "whipped cleanser", "whip cleanser",
                            "foaming clenser", "foaming clnsr", "vit c facial foam"]),
        ("gel-cleanser", ["gel cleanser", "gel face wash", "gel wash", "wash gel",
                          "gel cleansing", "jelly cleanser"]),
        ("cream-cleanser", ["cream cleanser", "creamy cleanser", "milk cleanser",
                             "cleansing milk", "milky cleanser", "lotion cleanser"]),
        ("face-wash", ["face wash", "facewash", "facial wash", "purifying wash",
                       "purifying cleanser", "deep cleanser", "gentle cleanser",
                       "cleansing wash", "ubtan wash", "face cleanser", "facial cleanser",
                       "cleanser", "cleansing", "clnsr", "clenser",
                       "cleansing powder", "head to toe wash", "fresh canvas"]),
    ],
    "exfoliators": [
        ("enzyme-peel", ["enzyme peel", "enzyme mask", "papaya peel", "pineapple peel",
                          "fruit enzyme"]),
        ("peeling-solution", ["peeling solution", "peeling toner", "peeling pad",
                               "peel pad", "exfoliating pad", "ordinary peeling"]),
        ("aha-exfoliant", ["aha exfoliant", "aha toner", "aha peel", "aha serum",
                            "glycolic exfoliant", "glycolic peel", "lactic exfoliant",
                            "mandelic exfoliant", "alpha hydroxy"]),
        ("bha-exfoliant", ["bha exfoliant", "bha toner", "bha peel", "bha serum",
                            "salicylic exfoliant", "salicylic peel", "beta hydroxy",
                            " bha "]),
        ("chemical-exfoliant", ["chemical exfoliant", "chemical peel",
                                 "exfoliating treatment", "exfoliating essence",
                                 "polishing treatment", "resurfacing serum",
                                 "exfoliator serum", "exfoliating toner",
                                 "glow peel", "exfoliant", "exfoliator"]),
        ("face-scrub", ["face scrub", "facial scrub", "polishing scrub",
                         "exfoliating scrub", "skin polisher", "walnut scrub",
                         "coffee scrub face", "sugar scrub face", "scrub"]),
    ],
    "toners-mists": [
        ("hydrating-mist", ["hydrating mist", "hydration mist", "rose mist",
                             "rosewater spray", "rose water spray", "rosewater mist",
                             "rose water mist", "aloe mist", "dewy mist",
                             "dewy setting mist"]),
        ("exfoliating-toner", ["exfoliating toner", "exfoliant toner", "glow toner",
                                "aha toner", "bha toner", "exfoliator toner"]),
        ("face-mist", ["face mist", "facial mist", "mist spray", "skin mist",
                       "setting mist", "matte setting mist", "refreshing mist"]),
        ("toner", ["toner", "tonic", "astringent", "skin tonic", "ph balanced toner"]),
    ],
    "serums-treatments": [
        ("vitamin-c-serum", ["vitamin c serum", "vit c serum", "vit-c serum",
                              "ascorbic serum", "vitamin-c serum"]),
        ("hyaluronic-acid-serum", ["hyaluronic acid serum", "hyaluronic serum",
                                    "ha serum", "hyaluronic acid"]),
        ("niacinamide-serum", ["niacinamide serum", "niacinamide", "nicotinamide serum",
                                "nicotinamide", "vitamin b3 serum"]),
        ("retinol-serum", ["retinol serum", "retinal serum", "retinoid serum",
                            "bakuchiol serum"]),
        ("salicylic-acid-serum", ["salicylic acid serum", "salicylic serum",
                                   "bha serum", "salicylic acid"]),
        ("peptide-serum", ["peptide serum", "peptide complex serum", "peptide booster",
                            "peptide concentrate"]),
        ("brightening-serum", ["brightening serum", "glow serum", "radiance serum",
                                "luminous serum", "kojic serum", "alpha arbutin serum"]),
        ("anti-acne-serum", ["anti-acne serum", "anti acne serum", "acne serum",
                              "blemish serum", "spot serum"]),
        # Generic ingredient fallbacks (no "serum" word required)
        ("vitamin-c-serum", ["vitamin c", "vit c", "vit-c", "ascorbic"]),
        ("hyaluronic-acid-serum", ["hyaluronic"]),
        ("retinol-serum", ["retinol", "retinal", "retinoid"]),
        ("salicylic-acid-serum", ["salicylic"]),
        ("peptide-serum", ["peptide"]),
        ("brightening-serum", ["brightening", "ferulic", "alpha arbutin", "kojic", "tranexamic"]),
    ],
    "moisturizers": [
        ("barrier-repair-cream", ["barrier repair", "barrier cream",
                                   "barrier-repair cream", "recovery moisturizer"]),
        ("night-cream", ["night cream", "night creme", "night moisturizer",
                          "night moisturiser", "overnight cream", "sleeping cream",
                          "night lotion"]),
        ("gel-moisturizer", ["gel moisturizer", "gel moisturiser", "gel cream",
                              "gel-cream", "water cream", "aqua gel", "aqua cream",
                              "oil-free gel", "water gel", "gel moisture",
                              "gel creme", "day gel creme", "ultra light gel",
                              "dewy glaze gel"]),
        ("cream-moisturizer", ["cream moisturizer", "cream moisturiser", "face cream",
                                "day cream", "day creme", "rich cream", "nourishing cream",
                                "matte cream", "hydrating cream", "moisture cream",
                                "moisturizer", "moisturiser", "creme moistrsr",
                                "moistrsr", "complexion care", "milk crm",
                                "milk cream", "crm moisture", "skin moisture",
                                "moisture-riser", "moisture riser", "lumi skin cream",
                                "skin cream", "peach milk", "vit-e creame"]),
        ("lotion", ["face lotion", "facial lotion", "emulsion", "facial emulsion",
                    "day lotion", "lotion"]),
    ],
    "sunscreens": [
        ("stick-sunscreen", ["sun stick", "stick sunscreen", "sunscreen stick",
                              "spf stick"]),
        ("spray-sunscreen", ["spray sunscreen", "sun spray", "sunscreen spray",
                              "spf spray"]),
        ("mineral-sunscreen", ["mineral sunscreen", "mineral spf", "zinc oxide sunscreen",
                                "physical sunscreen", "mineral sun"]),
        ("tinted-sunscreen", ["tinted sunscreen", "tinted spf", "tinted sun",
                               "tinted sunscrn"]),
        ("gel-sunscreen", ["gel sunscreen", "sun gel", "sunscreen gel"]),
        ("cream-sunscreen", ["cream sunscreen", "sun cream", "sunscreen cream",
                              "sunblock cream", "sunscreen lotion", "sun lotion",
                              "sunblock", "sunscreen", "sunscrn", "sun scrn",
                              "sun expert", "spf"]),
    ],
    "masks-packs": [
        ("sheet-mask", ["sheet mask", "masksheet", "mask sheet"]),
        ("clay-mask", ["clay mask", "kaolin mask", "rose clay", "clay pack"]),
        ("mud-mask", ["mud mask", "bentonite mask", "mud pack"]),
        ("sleeping-mask", ["sleeping mask", "overnight mask", "night mask"]),
        ("peel-off-mask", ["peel-off mask", "peel off mask", "peeloff mask"]),
        ("hydrating-mask", ["hydrating mask", "hydration mask", "moisture mask",
                             "wash-off mask", "wash off mask"]),
    ],
    "spot-treatments": [
        ("acne-patch", ["acne patch", "pimple patch", "hydrocolloid patch",
                         "zit patch", "pimple master", "spot patch",
                         "blemish patch"]),
        ("pimple-gel", ["pimple gel", "anti-acne gel", "anti acne gel",
                         "blemish gel", "acne control gel"]),
        ("scar-treatment", ["scar gel", "scar cream", "scar treatment",
                             "scar serum", "scar fade"]),
        ("spot-corrector", ["spot corrector", "spot control", "spot gel",
                             "spot eraser", "spot remover", "spot treatment",
                             "dark spot remover", "anti-acne spot"]),
    ],
    "eye-care": [
        ("under-eye-patch", ["under eye patch", "eye patch", "under-eye patch",
                              "eye mask patch", "eye gel patch"]),
        ("eye-gel", ["eye gel"]),
        ("eye-cream", ["eye cream", "eye balm", "eye treatment", "eye serum",
                       "under eye cream", "under-eye cream"]),
    ],
    "lip-care": [
        ("lip-oil", ["lip oil"]),
        ("lip-scrub", ["lip scrub"]),
        ("lip-mask", ["lip mask", "lip sleeping mask"]),
        ("lip-balm", ["lip balm", "lip butter", "lip therapy", "lip moisturiz",
                      "lip hydrat", "tinted lip balm", "baby lips", "lip glowy"]),
    ],
    "face-oils": [
        ("overnight-oil", ["overnight oil", "night oil", "night face oil"]),
        ("glow-oil", ["glow oil", "luminous oil", "radiance oil"]),
        ("facial-oil", ["facial oil", "face oil", "elixir oil", "rosehip oil",
                         "jojoba oil face", "argan oil face"]),
    ],
    "essences-ampoules": [
        ("ampoule", ["ampoule"]),
        ("booster", ["booster", "skin booster"]),
        ("essence", ["essence", "ferment essence", "treatment essence"]),
    ],
    "barrier-care": [
        ("recovery-balm", ["recovery balm", "rescue balm", "repair balm"]),
        ("ceramide-cream", ["ceramide cream", "ceramide moisturizer", "ceramide"]),
        ("cica-cream", ["cica cream", "cica gel", "centella cream", "panthenol cream"]),
    ],
    "brightening-products": [
        ("dark-spot-corrector", ["dark spot corrector", "dark spot cream",
                                  "dark spot remover", "spot correcting cream"]),
        ("glow-cream", ["glow cream", "radiance cream", "luminous cream",
                         "luminizing cream", "glow moisturizer"]),
        ("pigmentation-cream", ["pigmentation cream", "anti-pigmentation",
                                 "anti pigmentation", "melasma cream",
                                 "whitening cream", "fairness cream",
                                 "skin lightening cream"]),
    ],
    "anti-aging-products": [
        ("retinol-cream", ["retinol cream", "retinal cream", "bakuchiol cream"]),
        ("firming-cream", ["firming cream", "lifting cream", "tightening cream",
                            "collagen cream", "neck cream", "neck firming"]),
        ("wrinkle-treatment", ["wrinkle cream", "anti-wrinkle", "anti wrinkle",
                                "wrinkle treatment", "age-defying", "age defying"]),
    ],
    "body-skincare": [
        ("foot-cream", ["foot cream", "foot lotion", "heel balm", "heel cream"]),
        ("hand-cream", ["hand cream", "hand lotion"]),
        ("body-butter", ["body butter"]),
        ("body-oil", ["body oil"]),
        ("body-scrub", ["body scrub"]),
        ("body-wash", ["body wash", "shower gel", "shower oil", "bubble bath",
                       "shower foam", "head to toe wash"]),
        ("body-lotion", ["body lotion", "body cream", "body milk", "body mist",
                          "bodi mist", "fragrance mist",
                          "body moisturizer", "deo rollon", "deo roll-on",
                          "deodorant spray", "deodorant", "body lovin"]),
    ],
    # ----- COSMETICS -----
    "face-makeup": [
        ("setting-spray", ["setting spray", "fixer spray", "makeup fixer",
                            "fixing spray", "double fixer", "finishing mist",
                            "fnshing mist", "dewy setting mist", "matte setting mist",
                            "stay the day"]),
        ("makeup-remover", ["makeup remover", "make-up remover", "make up remover"]),
        ("face-primer", ["face primer", "primer base", "makeup primer", "blur primer",
                          "pore primer", "superglow primer", "vit c primer"]),
        ("concealer", ["concealer", "iar eraser", "spot rescue", "fit me cnclr",
                        "fit me conceal", "fit me cncl", "cnclr"]),
        ("bb-cc-cream", ["bb cream", "cc cream", "bb mousse", "cc mousse",
                          "fit me bb", " bb ", " cc ", "bb & cc", "bb&cc",
                          "skin tnt", "skin tint"]),
        ("tinted-moisturizer", ["tinted moisturizer", "tinted moisturiser",
                                 "tinted moisturiz", "complexion care cream"]),
        ("highlighters", ["highlighter", "highliter", "highlighting",
                           "illuminator", "strobe cream", "strobing cream",
                           "master chrome", "chrome highlighter"]),
        ("bronzer", ["bronzer", "rouge"]),
        ("blush", ["blush", "cheek color", "cheek colour", "color splash"]),
        ("contour", ["contour"]),
        ("loose-powder", ["loose powder", "setting powder", "banana powder",
                           "translucent powder", "finishing powder", "blur powder",
                           "bake powder", "bake and blur", "fit me loose"]),
        ("compact", ["compact powder", "pressed powder", "powder compact",
                      "fit me pwd", "compact"]),
        ("sindoor", ["sindoor"]),
        ("foundation", ["foundation", "fndtn", "fndn", " fdn ", "9to5", "9-to-5",
                         "9 to 5", "skin foundation", "double wear",
                         "fit me fdn", "fit me fdt", "ss lm fdn",
                         "lumi matte fdn", "matte+pore", "matte+poreless",
                         "mat+pore", "fdt mat", "fdt fdn",
                         "camouflage cream", "paint stick", "tv paint stick",
                         "ss fdn", "cake make", "cake makeup",
                         "mattreal mousse", "matt real mousse",
                         "nude medinm", "nude medium", "high on cover"]),
    ],
    "lips": [
        ("lip-liner", ["lip liner", "lip pencil", "lip pen"]),
        ("lip-primer", ["lip primer"]),
        ("lip-plumper", ["lip plumper", "plumping lip", "plump and shine",
                          "plump & shine"]),
        ("lip-crayon", ["lip crayon", "crayon lipstick", "lipstick crayon",
                         "superstay crayon", "transfer not crayon"]),
        ("liquid-lipstick", ["liquid lipstick", "liquid lip", "liq lip",
                              "matte liquid lip", "liquid matte", "matte ink",
                              "superstay matte", "superstay matte ink",
                              "stopper liquid matte", "vinyl ink", "lifter plump"]),
        ("lip-gloss", ["lip gloss", "lipgloss", "lip glaze", "lifter gloss",
                        "lifter plump", "plumping gloss", "plumping lg",
                        "hs plumping"]),
        ("lip-tint", ["lip tint", "lip stain", "lip oil tint", "lip & cheek tint",
                      "lip-cheek tint", "lip and cheek tint", "lip&cheek tint",
                      "lip n cheek tint", "lip n ckeek mousse tint",
                      "cheek tint", "teddy tint", "sinful lip n ckeek",
                      "fresh tint", "fit me fresh tint"]),
        ("lipstick", ["lipstick", "lipstik", "lipstcik", "lipstck", "lipstk",
                       "lipsitick", "lipstic", "lpstk", "lip mouse", "lip stick",
                       "matte lipstick", "lip color",
                       "lip colour", "lipcolor", "lipclr", "lip bullet",
                       "powder bullet", "powder bullett",
                       "lippy", "lippie", "color pops", "colour pops", "color crush",
                       "colour crush", "true wear", "lip love", "smudge me not",
                       "ultimatte",
                       "lustreglass", "color sensation", "color sensational",
                       "sensational lip", "baby lips",
                       "take me as i am", "matte luxe", "matte as hell",
                       "im unlimited", "cs creamy matte",
                       "be-jewel lip", "color lock"]),
    ],
    "eyes": [
        ("under-eye-concealer", ["under eye concealer", "under-eye concealer"]),
        ("eye-makeup-remover", ["eye makeup remover", "eye make-up remover",
                                 "eye make up remover"]),
        ("contact-lenses", ["contact lens"]),
        ("false-eyelashes", ["false lash", "false eyelash", "fake lash",
                              "fake eyelash"]),
        ("eye-primer", ["eye primer"]),
        ("eyebrow-enhancers", ["eyebrow", "eye brow", "brow pencil", "brow gel",
                                "brow powder", "brow enhancer", "brow definer",
                                "arch arrival", "fashion brow"]),
        ("eye-shadow", ["eye shadow", "eyeshadow", "mousse shadow",
                         "stardust glitter", "dazzle dot glitter", "glitter shadow",
                         "twinkle star glitter", "twinkle star", "eye tint",
                         "be-jewel eye"]),
        ("mascara", ["mascara", "eye drama"]),
        ("eyeliner", ["eyeliner", "eye liner", "shine line", "gloss artist",
                       "eye pencil", "magic eye pencil", "cream liner",
                       "tattoo liner", "ts liners", "tattoo studio liner",
                       "line tattoo", "high impact liner",
                       "glamor eyes liner", "glamour eyes liner", "ab gel stylist",
                       "gel eye liner", "line tattoo crayon", "microliner",
                       "hyper glossy liquid liner", "wingman waterproof",
                       "liquid liner"]),
        ("kajal", ["kajal", "kohl", "eyeconic"]),
    ],
    "nails": [
        ("nail-remover", ["nail polish remover", "nail color remover",
                           "nail colour remover", "nail enamel remover",
                           "nail enam. remover", "nail enam remover",
                           "nail polsh remover", "nail polish polsh remover",
                           "nail remover", "twist & erase"]),
        ("cuticle-oil", ["cuticle oil", "cuticle conditioner", "cuticle"]),
        ("nail-strengthener", ["nail strengthener", "nail hardener"]),
        ("nail-art", ["nail art", "nail sticker", "nail decal", "nail glitter",
                       "stick on nails", "stick-on nails"]),
        ("nail-care", ["nail care", "nail treatment", "nail file", "nail buffer"]),
        ("nail-enamel", ["nail enamel", "nail enam"]),
        ("nail-polish", ["nail polish", "nailpolish", "nail lacquer", "nail laquer",
                          "nail luxe", "nail color", "nail colour",
                          "nail paint", "nail pops", "nail gel", "gel finish",
                          "chrome nail", "ultimate glam nail",
                          " np ", "np bridgerton", "ab gel stylist"]),
    ],
    "tools-brushes": [
        ("makeup-pouches", ["makeup pouch", "makeup bag", "cosmetics pouch",
                             "cosmetic pouch"]),
        ("mirrors", ["compact mirror", "makeup mirror"]),
        ("sharpeners", ["sharpener", "sharpner"]),
        ("tweezers", ["tweezer"]),
        ("eyelash-curlers", ["eyelash curler", "lash curler"]),
        ("sponges-applicators", ["beauty sponge", "makeup sponge", "puff",
                                  "blender", "applicator", "powder puff"]),
        ("brush-cleaners", ["brush cleaner"]),
        ("brush-sets", ["brush set"]),
        ("lip-brush", ["lip brush"]),
        ("eye-brush", ["eye brush"]),
        ("face-brush", ["face brush", "makeup brush", "powder brush",
                         "foundation brush", "contour brush", "blush brush"]),
    ],
    "multi-palettes": [
        ("eye-shadow-palette", ["eye shadow palette", "eyeshadow palette"]),
        ("face-palette", ["face palette"]),
        ("lip-palette", ["lip palette"]),
        ("cheek-palette", ["cheek palette", "blush palette",
                            "highlighting palette", "highlighter palette",
                            "contour palette"]),
        ("all-in-one-palette", ["all-in-one palette", "all in one palette",
                                 "multi-use palette", "multi use palette",
                                 "palette"]),
    ],
    "makeup-kits": [
        ("bridal-kit", ["bridal kit", "bridal makeup", "bridal set"]),
        ("travel-kit", ["travel kit", "travel size", "mini kit", "mini makeup"]),
        ("starter-kit", ["starter kit", "beginner kit"]),
        ("gift-set", ["gift set", "gift box", "gift pack"]),
        ("combo-set", ["combo set", "combo pack", "makeup kit", "makeup set"]),
    ],
}
_SKINCARE_HARD_KW = [
    "serum", "moisturiz", "moisturis", "moistrsr",
    "moisture", "crm moisture", "milk crm", "milk cream",
    "day creme", "night creme", "creme moistrsr", "gel creme",
    "skin cream", "lumi skin", "complexion care", "peach milk",
    "sunscreen", "sunblock", "sunscrn", "spf", "toner",
    "cleanser", "face wash", "facewash", "face cleanse", "face foam",
    "facial foam", "facial cleanser", "clnsr", "clenser",
    "face scrub", "face mask", "sheet mask", "clay mask", "clay pack",
    "mud mask", "sleeping mask",
    "lip balm", "lip mask", "lip scrub", "lip oil",
    "body lotion", "body wash", "body butter", "body scrub", "body oil",
    "body lovin", "deo rollon", "deo roll-on", "deodorant",
    "hand cream", "foot cream", "shower gel", "shower oil",
    "face oil", "facial oil", "essence", "ampoule",
    "cica", "ceramide", "retinol", "retinal", "niacinamide", "niacinmide",
    "hyaluronic", "vitamin c", "vit c", "vit-c", "salicylic", "glycolic",
    "lactic", "kojic", "azelaic", "bakuchiol",
    "eye cream", "eye gel", "under eye serum", "under-eye serum",
    "acne patch", "pimple patch", "spot corrector", "scar gel", "spot gel",
    "barrier repair", "recovery balm", "after sun",
    "micellar", "cleansing balm", "exfoliat", "peeling solution",
    "facial wash", "face mist", "rosewater",
]


def _normalize(text: Optional[str]) -> str:
    """Lowercase + strip + collapse whitespace + remove punctuation noise."""
    if not text:
        return ""
    t = text.lower().strip()
    t = re.sub(r"[\u2013\u2014]", "-", t)  # em/en dashes -> hyphen
    t = re.sub(r"\s+", " ", t)
    return t


def classify_product(name: str, description: str = "", brand: str = "",
                     current_niche: Optional[str] = None) -> dict:
    """Return {niche, category, subcategory, concerns:[]} based on name+description.

    Matching strategy (longest keyword wins for specificity):
      1. Niche detection — cosmetics keywords win, else skincare keywords.
      2. Category — pick category with longest matching keyword inside niche.
      3. Subcategory — pick sub whose slug-words appear in the name.
      4. Concerns (skincare only) — collect up to 3 concern matches.
    """
    full = _normalize(f"{name} {description} {brand}")

    # 1. Niche detection — definitive keywords win first, soft counters second.
    niche = (current_niche or "").lower() or None

    # Tier 1 — HAIRCARE (exclude from cosmetics/skincare entirely)
    if any(k in full for k in _HAIRCARE_KW):
        niche = "haircare"
        return {"niche": "haircare", "category": None, "subcategory": None,
                "concerns": [], "unclassified": False}

    # Tier 2 — Definitive cosmetics (concealer/foundation/lipstick/etc.) always win
    def_cosm = any(k in full for k in _DEFINITE_COSMETICS_KW)
    def_skin = any(k in full for k in _DEFINITE_SKINCARE_KW)
    if def_cosm and not def_skin:
        niche = "cosmetics"
    elif def_skin and not def_cosm:
        niche = "skincare"
    elif def_cosm and def_skin:
        # Both present — use longest-match to decide
        def cosm_longest():
            return max((len(k) for k in _DEFINITE_COSMETICS_KW if k in full), default=0)
        def skin_longest():
            return max((len(k) for k in _DEFINITE_SKINCARE_KW if k in full), default=0)
        niche = "cosmetics" if cosm_longest() >= skin_longest() else "skincare"
    else:
        # Tier 3 — Soft keyword counters + brand hint
        cosm_hits = sum(1 for k in _COSMETICS_HARD_KW if k in full)
        skin_hits = sum(1 for k in _SKINCARE_HARD_KW if k in full)
        first_word = (name or "").strip().split()[:2]
        brand_hint_text = " ".join(first_word).lower()
        is_cosm_brand = any(b in brand_hint_text for b in _COSMETICS_BRANDS)
        if is_cosm_brand and skin_hits == 0:
            cosm_hits += 2
        if cosm_hits > skin_hits and cosm_hits > 0:
            niche = "cosmetics"
        elif skin_hits > 0:
            niche = "skincare"
        elif niche not in ("skincare", "cosmetics"):
            niche = niche if niche == "anti-aging" else "skincare"

    # 2. Category match — definitive markers first, then longest-keyword.
    #
    # Some products contain keywords from multiple categories (e.g. "Hydrating
    # Cream Cleanser" hits both moisturizers ("hydrating cream") and cleansers
    # ("cleanser")). The PRIMARY_CATEGORY_KW dict below acts as a decisive tier
    # so that the product form word wins over an ingredient/description word.
    cat_pool = COSMETICS_CATEGORIES if niche == "cosmetics" else SKINCARE_CATEGORIES
    best_cat = None

    # 2a. Definitive product-form markers (highest priority — first match wins).
    if niche == "skincare":
        _PRIMARY_CAT_KW: list[tuple[str, list[str]]] = [
            ("cleansers", ["cleanser", "face wash", "facewash", "facial wash",
                            "facial cleanser", "facial foam", "cleansing balm",
                            "cleansing oil", "cleansing milk", "cleansing water",
                            "micellar water", "micellar", "make-up remover wash",
                            "purifying wash", "ubtan wash"]),
            ("sunscreens", ["sunscreen", "sunblock", " spf ", "spf 30", "spf 40",
                             "spf 50", "sun lotion", "sun stick", "sun spray",
                             "sun cream", "sun gel", "sunscrn", "sun scrn",
                             "sun expert"]),
            ("masks-packs", ["sheet mask", "clay mask", "mud mask",
                              "sleeping mask", "peel-off mask", "peel off mask",
                              "face mask", "face pack", "overnight mask",
                              "hydrating mask"]),
            ("exfoliators", ["face scrub", "facial scrub", "body scrub",
                              "exfoliant", "exfoliator", "peeling solution",
                              "peeling toner", "enzyme peel", "chemical peel",
                              "polishing scrub", "skin polisher", "glow peel"]),
            ("toners-mists", ["toner", "face mist", "facial mist",
                               "hydrating mist", "rose water mist", "rosewater mist",
                               "rose mist", "tonic", "astringent"]),
            ("spot-treatments", ["acne patch", "pimple patch", "pimple gel",
                                  "anti-acne gel", "spot corrector", "spot gel",
                                  "scar gel", "scar cream", "scar treatment",
                                  "pimple master", "blemish gel"]),
            ("face-oils", ["facial oil", "face oil", "overnight oil", "glow oil",
                            "elixir oil"]),
            ("eye-care", ["eye cream", "eye gel", "eye serum", "eye balm",
                           "under eye cream", "under-eye cream", "under eye patch",
                           "eye patch"]),
            ("lip-care", ["lip balm", "lip mask", "lip scrub", "lip oil",
                           "lip butter"]),
            ("essences-ampoules", ["essence", "ampoule"]),
            ("barrier-care", ["cica cream", "cica gel", "ceramide cream",
                               "ceramide moisturiz", "recovery balm",
                               "barrier repair", "barrier cream",
                               "ceramide", "cica ", "centella", "panthenol"]),
            ("body-skincare", ["body lotion", "body butter", "body wash",
                                "body scrub", "body oil", "body cream",
                                "body milk", "body mist", "bodi mist",
                                "shower gel", "shower oil",
                                "hand cream", "hand lotion", "foot cream",
                                "foot lotion", "heel balm",
                                "body lovin", "deo rollon", "deo roll-on",
                                "deodorant"]),
            ("brightening-products", ["pigmentation cream", "dark spot corrector",
                                       "dark spot cream", "whitening cream",
                                       "fairness cream", "luminizing cream"]),
            ("anti-aging-products", ["retinol cream", "anti-wrinkle",
                                      "anti wrinkle", "wrinkle cream",
                                      "wrinkle treatment", "firming cream",
                                      "lifting cream", "neck cream",
                                      "neck firming", "collagen cream",
                                      "age-defying", "age defying"]),
            ("serums-treatments", ["face serum", "treatment serum",
                                    "skin booster serum", "anti-aging serum",
                                    "anti aging serum", "anti-acne serum"]),
            ("moisturizers", ["moisturizer", "moisturiser", "face cream",
                               "day cream", "night cream", "face lotion",
                               "facial lotion", "facial emulsion", "emulsion",
                               "gel cream", "water cream", "aqua gel",
                               "aqua cream", "water gel", "day creme",
                               "night creme", "creme moistrsr", "moistrsr",
                               "complexion care", "complexion care cream",
                               "crm moisture", "milk crm",
                               "milk cream", "skin moisture", "moisture-riser",
                               "moisture riser", "gel moisture", "gel creme",
                               "day gel creme", "lumi skin cream", "skin cream",
                               "peach milk", "ultra light gel"]),
        ]
    else:  # cosmetics
        _PRIMARY_CAT_KW = [
            ("makeup-kits", ["bridal kit", "bridal makeup", "bridal set",
                              "travel kit", "starter kit", "beginner kit",
                              "gift set", "gift box", "gift pack",
                              "combo set", "combo pack", "makeup kit",
                              "makeup set", "mini kit"]),
            ("multi-palettes", ["eye shadow palette", "eyeshadow palette",
                                 "face palette", "lip palette",
                                 "cheek palette", "blush palette",
                                 "highlighting palette", "highlighter palette",
                                 "contour palette", "all-in-one palette",
                                 "all in one palette", "multi-use palette",
                                 "palette"]),
            ("nails", ["nail polish", "nailpolish", "nail enamel", "nail enam",
                        "nail lacquer", "nail laquer", "nail luxe",
                        "nail color", "nail colour", "nail paint", "nail art",
                        "nail care", "nail treatment", "nail strengthener",
                        "nail hardener", "nail polish remover", "nail remover",
                        "cuticle oil", "cuticle conditioner",
                        "nail pops", "nail gel", "gel finish nail",
                        "nail file", "nail buffer", "nail glitter",
                        "stick on nails", "stick-on nails", "chrome nail",
                        " np ", "np bridgerton", "ab gel stylist"]),
            ("lips", ["lipstick", "lipstik", "lipstcik", "lipstck", "lipstk",
                       "lipsitick", "lipstic", "lpstk", "lip stick",
                       "liquid lipstick", "matte lipstick",
                       "liquid lip", "liq lip", "liquid matte",
                       "lip crayon", "lip gloss", "lipgloss",
                       "lip liner", "lip pencil", "lip pen", "lip primer", "lip plumper",
                       "lip tint", "lip stain", "lip & cheek", "lip and cheek",
                       "lip-cheek", "lip&cheek", "lip n cheek", "lip n ckeek",
                       "lip color", "lip colour",
                       "lipcolor", "lippy", "lippie", "lip bullet",
                       "powder bullet", "color pops", "colour pops",
                       "color crush", "colour crush", "true wear",
                       "plump and shine", "plump & shine",
                       "lip love", "lip-love", "lip glaze", "lip cream",
                       "smudge me not", "vinyl ink", "vinyl sauce",
                       "lifter plump", "lifter gloss",
                       "matte ink", "superstay matte", "superstay crayon",
                       "ultimatte", "color sensational",
                       "matte luxe", "matte as hell",
                       "sensational lip", "mattifying lip", "sinful plumping",
                       "sinful lip", "delulu liq", "delulu liquid",
                       "f52 bs lip", "bs lip", "lit lip", "lip stack",
                       "nothing else matters", "color lock",
                       "transfer not crayon", "teddy tint", "fresh tint",
                       "plumping gloss", "plumping lg",
                       "cs creamy matte", "im unlimited",
                       "be-jewel lip", "mousse muse", "baby lips",
                       "take me as i am"]),
            ("eyes", ["kajal", "kohl", "eyeliner", "eye liner", "mascara",
                       "eye shadow", "eyeshadow", "eyebrow pencil", "brow pencil",
                       "brow gel", "brow powder", "brow enhancer", "brow definer",
                       "eye pencil", "fashion brow", "tattoo liner",
                       "ts liners", "tattoo studio liner", "line tattoo",
                       "high impact liner",
                       "false lash", "false eyelash", "fake lash",
                       "eye primer", "eye makeup remover", "under eye concealer",
                       "contact lens", "eyeconic", "stardust glitter",
                       "dazzle dot", "mousse shadow", "cream liner",
                       "magic eye pencil", "gel eye liner",
                       "twinkle star", "arch arrival",
                       "glamor eyes", "glamour eyes",
                       "be-jewel eye", "eye tint"]),
            ("tools-brushes", ["makeup brush", "face brush", "eye brush",
                                "lip brush", "brush set", "brush cleaner",
                                "beauty sponge", "makeup sponge", "powder puff",
                                "eyelash curler", "lash curler", "tweezer",
                                "sharpener", "sharpner", "makeup mirror",
                                "compact mirror", "makeup pouch", "makeup bag"]),
            ("face-makeup", ["foundation", "fdtn", "fmc fdtn", "fmc fdn",
                              "concealer", "cnclr", "compact powder",
                              "compact", "blush", "bronzer", "highlighter",
                              "highliter", "highlighting", "contour",
                              "setting spray", "fixer spray", "makeup fixer",
                              "fnshing mist", "stay the day",
                              "makeup remover", "tinted moisturiz",
                              "bb cream", "cc cream", "fit me bb", "skin tnt",
                              "skin tint", "double wear",
                              "fit me fdt", "fit me fdn", "fdt mat", "mat+pore",
                              "matte+pore", "matte+poreless", "fit me pwd",
                              "fit me loose", "loose pwd", "pwd mat+pore",
                              "face primer", "loose powder", "setting powder",
                              "banana powder", "translucent powder",
                              "finishing powder", "color corrector",
                              "colour corrector", "sindoor",
                              "paint stick", "tv paint",
                              "strobe cream", "strobing cream", "camouflage cream",
                              "iar eraser", "color splash", "high on cover",
                              "cake make", "cake makeup",
                              "mattreal mousse", "lumi matte"]),
        ]

    # Special override: an "eye shadow palette" should land in multi-palettes,
    # but "eye shadow" alone should land in eyes. The primary-cat list above
    # already handles this since multi-palettes is listed before eyes.

    # Search primary list — first category whose ANY keyword matches wins.
    for cat_slug, kws in _PRIMARY_CAT_KW:
        if any(k in full for k in kws):
            best_cat = next((c for c in cat_pool if c["slug"] == cat_slug), None)
            if best_cat:
                break

    # 2b. Fallback — longest-keyword match over the category `keywords` field.
    if best_cat is None:
        best_cat_score = 0
        for cat in cat_pool:
            for kw in cat.get("keywords") or []:
                if kw in full:
                    if len(kw) > best_cat_score:
                        best_cat_score = len(kw)
                        best_cat = cat
    if best_cat is None:
        # No keyword matched. Leave category as NULL so unmatched products
        # don't pollute a fallback bucket. They'll be browsable via the niche
        # filter ("All cosmetics") and admin can curate them via `needs_review`.
        # FLAGSHIP GUARD still applies — non-Celesta-Glow products must not
        # land in the anti-aging niche.
        _brand_lc = (brand or "").lower()
        _name_lc = (name or "").lower()
        _is_celesta = "celesta glow" in _brand_lc or "celesta glow" in _name_lc
        if niche == "anti-aging" and not _is_celesta:
            niche = "skincare"
        return {
            "niche": niche,
            "category": None,
            "subcategory": None,
            "concerns": [],
            "unclassified": True,
        }
    unclassified = False

    # 3. Subcategory — Use the granular priority-ordered keyword dict for the
    # resolved category (first specific match wins). This guarantees products
    # land on Gel Cleanser / Foam Cleanser / Niacinamide Serum / etc. tiles
    # instead of all defaulting to the most generic sub.
    best_sub_slug = None
    sub_kw_list = _CATEGORY_SUBCATEGORY_KW.get(best_cat["slug"], [])
    for sub_slug, phrases in sub_kw_list:
        for ph in phrases:
            if ph in full:
                best_sub_slug = sub_slug
                break
        if best_sub_slug:
            break

    # Fallback: original name-token phrase matching (handles edge cases the
    # priority dict might miss — e.g., composite "BB & CC Cream" sub name).
    if not best_sub_slug:
        best_sub_score = 0
        for sub_slug, sub_name in best_cat.get("subs", []):
            phrases = {sub_name.lower(), sub_slug.replace("-", " ")}
            # Singular form (strip plural-s)
            if sub_name.lower().endswith("s"):
                phrases.add(sub_name.lower().rstrip("s"))
            sub_slug_words = sub_slug.replace("-", " ")
            if sub_slug_words.endswith("s"):
                phrases.add(sub_slug_words.rstrip("s"))
            # Split on "&" or "/" — try each piece + the suffix word.
            if "&" in sub_name or "/" in sub_name:
                parts = re.split(r"\s*[&/]\s*", sub_name)
                if len(parts) >= 2:
                    suffix = parts[-1].strip().split()[-1].lower()
                    for p in parts[:-1]:
                        p_clean = p.strip().lower()
                        if p_clean:
                            phrases.add(f"{p_clean} {suffix}")
                            phrases.add(p_clean)
            # First word of sub name (e.g. "Eye Shadow Palette" → "eye")
            first_word = sub_name.lower().split()[0]
            if len(first_word) >= 4:  # avoid noise like "eye" matching too broadly
                phrases.add(first_word)

            for phrase in phrases:
                if len(phrase) < 3:
                    continue
                if phrase in full and len(phrase) > best_sub_score:
                    best_sub_score = len(phrase)
                    best_sub_slug = sub_slug

    # 4. Concerns (skincare only) — collect up to 3
    concerns: list[str] = []
    if niche == "skincare":
        # Score each concern, keep top 3 by best keyword match length
        scored: list[tuple[int, str]] = []
        for c in SKINCARE_CONCERNS:
            best = 0
            for kw in c.get("keywords") or []:
                if kw in full and len(kw) > best:
                    best = len(kw)
            if best > 0:
                scored.append((best, c["slug"]))
        scored.sort(reverse=True)
        concerns = [s for _, s in scored[:3]]

    # 5. FLAGSHIP NICHE GUARD — anti-aging is reserved for Celesta Glow only.
    # If any other brand winds up here (e.g. via current_niche carry-over or
    # cosmetics-fallback path), demote to skincare + anti-aging-products cat.
    brand_text = (brand or "").lower()
    name_text = (name or "").lower()
    is_celesta = "celesta glow" in brand_text or "celesta glow" in name_text
    if niche == "anti-aging" and not is_celesta:
        niche = "skincare"
        # Snap to a sensible skincare category for the affected products.
        if not best_cat or best_cat["slug"] not in [c["slug"] for c in SKINCARE_CATEGORIES]:
            best_cat = next(
                (c for c in SKINCARE_CATEGORIES if c["slug"] == "anti-aging-products"),
                best_cat,
            )

    return {
        "niche": niche,
        "category": best_cat["slug"] if best_cat else None,
        "subcategory": best_sub_slug,
        "concerns": concerns,
        "unclassified": unclassified,
    }


# ============================================================
# FILTER TAGS (bestseller / luxury / trending / most_bought)
# ============================================================
# Tags are stored as `tags` array on each product. They power
# the "Bestsellers / Luxury / Trending / Most-bought" rails on
# category pages. Admin can override via PUT /admin/products/{slug}.

LUXURY_PRICE_THRESHOLD = 1500   # ₹1500+ MRP = luxury candidate
BESTSELLER_REVIEW_THRESHOLD = 800  # ≥800 reviews
TRENDING_RATING_THRESHOLD = 4.5    # rating ≥ 4.5
TRENDING_REVIEW_THRESHOLD = 200    # AND ≥ 200 reviews


async def compute_product_tags(db) -> dict:
    """Heuristic tagger. Re-computes tags for every product. Idempotent.

    Heuristics (research-backed: these are signals e-commerce platforms use):
      • bestseller   — top 15% by reviews_count OR badge="Bestseller"
      • luxury       — mrp >= ₹1500 (premium tier)
      • trending     — rating ≥ 4.5 AND reviews_count ≥ 200 AND not bestseller
      • most_bought  — top 5% by orders_count (if available) else top 5% by reviews

    Admin-overrides survive: any tag in product.tags that starts with `manual:`
    is preserved on re-run (so admin can pin a product as `manual:luxury`).
    """
    # Pull all active product (subset of fields)
    products = await db.products.find(
        {"is_active": True},
        {"_id": 0, "slug": 1, "mrp": 1, "reviews_count": 1, "rating": 1,
         "badge": 1, "tags": 1, "total_orders": 1, "created_at": 1}
    ).to_list(20000)

    if not products:
        return {"updated": 0}

    # Build percentile thresholds
    review_counts = sorted([p.get("reviews_count") or 0 for p in products], reverse=True)
    bs_cutoff_idx = max(1, int(len(review_counts) * 0.15))  # top 15%
    mb_cutoff_idx = max(1, int(len(review_counts) * 0.05))  # top 5%
    bs_threshold = review_counts[bs_cutoff_idx - 1] if review_counts else 0
    mb_threshold = review_counts[mb_cutoff_idx - 1] if review_counts else 0

    # Use total_orders if any product has it set, else fall back to reviews
    has_orders = any(p.get("total_orders") for p in products)
    if has_orders:
        orders = sorted([p.get("total_orders") or 0 for p in products], reverse=True)
        mb_threshold = orders[mb_cutoff_idx - 1] if orders else 0

    # New-launch — top-100 most-recently-created products (caps the flood when
    # bulk-imports stamp `created_at` to "now"). Combined with badge="new".
    products_sorted_new = sorted(
        products,
        key=lambda p: (p.get("created_at") or ""),
        reverse=True,
    )
    new_launch_slugs = {p["slug"] for p in products_sorted_new[:100]}

    updated = 0
    now = _now()
    for p in products:
        slug = p["slug"]
        mrp = float(p.get("mrp") or 0)
        rvw = int(p.get("reviews_count") or 0)
        rating = float(p.get("rating") or 0)
        badge = (p.get("badge") or "").lower()
        existing = p.get("tags") or []
        # Keep manual: overrides
        manual_tags = [t for t in existing if isinstance(t, str) and t.startswith("manual:")]

        new_tags: list[str] = []
        is_bestseller = (rvw >= max(bs_threshold, BESTSELLER_REVIEW_THRESHOLD)) or ("bestseller" in badge)
        if is_bestseller:
            new_tags.append("bestseller")
        if mrp >= LUXURY_PRICE_THRESHOLD:
            new_tags.append("luxury")
        if rating >= TRENDING_RATING_THRESHOLD and rvw >= TRENDING_REVIEW_THRESHOLD and not is_bestseller:
            new_tags.append("trending")

        if has_orders:
            tot = int(p.get("total_orders") or 0)
            if tot >= mb_threshold and tot > 0:
                new_tags.append("most_bought")
        else:
            # Fallback: very-high reviews proxy
            if rvw >= mb_threshold and rvw > 0:
                new_tags.append("most_bought")

        # new_launch — among top-100 newest products OR badge contains "new"
        if (slug in new_launch_slugs) or "new" in badge:
            new_tags.append("new_launch")

        # Dedupe and merge
        final = list(dict.fromkeys(manual_tags + new_tags))
        await db.products.update_one(
            {"slug": slug},
            {"$set": {"tags": final, "tags_updated_at": now}}
        )
        updated += 1
    return {"updated": updated, "thresholds": {
        "bestseller_reviews": bs_threshold,
        "most_bought": mb_threshold,
        "luxury_mrp": LUXURY_PRICE_THRESHOLD,
    }}


# ============================================================
# RESET — wipe + reseed canonical taxonomy
# ============================================================
async def reset_canonical_taxonomy(db) -> dict:
    """Reset concerns + skincare/cosmetics categories + subcategories to the
    canonical Jan-2026 user spec.

    Anti-aging concern is preserved (flagship line uses it; we re-create it as
    `aging` for the new spec but keep `anti-aging` as an alias for legacy data).

    SAFETY (P0 fix Feb-2026): admin-curated visual fields — `image`, `icon`
    overrides, `accent_from`, `accent_to`, `accent_text`, `tagline` — are
    READ from existing rows BEFORE the delete and MERGED back in after the
    canonical re-insert. Without this guard, every taxonomy reset wiped the
    Cloudinary image URLs admins uploaded for category/concern tiles and the
    live site reverted to the default emoji icons until the next manual
    restore. Files-of-reference: catalog_backup.py STICKY_FIELDS.
    """
    now = _now()

    # 0. Read existing admin-curated visual fields BEFORE we wipe.
    # These are the same fields catalog_backup.STICKY_FIELDS protects on
    # restore — keep both lists in sync.
    PRESERVE_FIELDS = ("image", "icon", "accent_from", "accent_to",
                       "accent_text", "tagline", "description")

    async def _snapshot_visuals(collection_name: str) -> dict:
        out: dict = {}
        try:
            proj = {"_id": 0, "slug": 1, **{f: 1 for f in PRESERVE_FIELDS}}
            async for row in db[collection_name].find({}, proj):
                slug = row.get("slug")
                if not slug:
                    continue
                kept = {f: row[f] for f in PRESERVE_FIELDS
                        if row.get(f) not in (None, "", [], {})}
                if kept:
                    out[slug] = kept
        except Exception as exc:
            logger.warning(f"[taxonomy_canonical] visual snapshot {collection_name} failed: {exc}")
        return out

    preserved_concerns = await _snapshot_visuals("concerns")
    preserved_categories = await _snapshot_visuals("categories")
    preserved_subcategories = await _snapshot_visuals("subcategories")

    # 1. Wipe legacy concerns (keep none — full reset).
    await db.concerns.delete_many({})
    # 2. Wipe skincare + cosmetics categories.
    await db.categories.delete_many({"niche": {"$in": ["skincare", "cosmetics"]}})
    # 3. Wipe skincare + cosmetics subcategories.
    await db.subcategories.delete_many({"niche": {"$in": ["skincare", "cosmetics"]}})

    # 4. Seed concerns (13 mains, each with subs array).
    concern_docs = []
    for c in SKINCARE_CONCERNS:
        concern_docs.append({
            **{k: v for k, v in c.items() if k != "keywords"},
            "niche": "skincare",
            "created_at": now, "updated_at": now,
        })
    # Legacy alias concern so old products tagged "anti-aging" still resolve.
    # IMPORTANT (Feb-2026): kept under niche="anti-aging" (its OWN flagship
    # niche) — never "skincare" — so it does NOT pollute the skincare niche's
    # concern carousel. The `aging` concern is the canonical entry on
    # skincare. Without this guard, both "Anti-Aging (Flagship)" and "Aging
    # Concerns" would render side-by-side on /skincare which the user
    # explicitly does not want.
    concern_docs.append({
        "slug": "anti-aging",
        "name": "Skin Care",
        "icon": "✨",
        "tagline": "Complete skin care range",
        "subs": ["Fine Lines", "Wrinkles", "Firming", "Brightening"],
        "accent_from": "#dcfce7", "accent_to": "#bbf7d0", "accent_text": "#14532d",
        "sort_order": 0,
        "is_active": True,
        "niche": "anti-aging",
        "alias_of": "aging",
        "created_at": now, "updated_at": now,
    })
    if concern_docs:
        await db.concerns.insert_many(concern_docs, ordered=False)

    # 5. Seed skincare categories + subcategories.
    cat_docs, sub_docs = [], []
    for cat in SKINCARE_CATEGORIES:
        cat_docs.append({
            "slug": cat["slug"], "name": cat["name"], "icon": cat["icon"],
            "niche": "skincare", "group": "skincare", "is_parent": True,
            "subs": [s[1] for s in cat["subs"]],
            "sort_order": cat["sort_order"], "is_active": True,
            "created_at": now, "updated_at": now,
        })
        for order, (sub_slug, sub_name) in enumerate(cat["subs"]):
            sub_docs.append({
                "slug": sub_slug, "name": sub_name,
                "parent_category": cat["slug"], "niche": "skincare",
                "sort_order": order, "is_active": True,
                "created_at": now, "updated_at": now,
            })
            # ALSO insert as a flat category row so the Skincare/Cosmetics hubs
            # (CosmeticsCategoryHub component) can render them. It reads from
            # /api/categories and groups by `parent` + `is_parent`.
            cat_docs.append({
                "slug": sub_slug, "name": sub_name,
                "icon": SUBCAT_ICONS.get(sub_slug, cat["icon"]),
                "niche": "skincare", "group": "skincare", "is_parent": False,
                "parent": cat["slug"],
                "sort_order": order, "is_active": True,
                "created_at": now, "updated_at": now,
            })

    # 6. Seed cosmetics categories + subcategories.
    for cat in COSMETICS_CATEGORIES:
        cat_docs.append({
            "slug": cat["slug"], "name": cat["name"], "icon": cat["icon"],
            "niche": "cosmetics", "group": "cosmetics", "is_parent": True,
            "subs": [s[1] for s in cat["subs"]],
            "sort_order": cat["sort_order"], "is_active": True,
            "created_at": now, "updated_at": now,
        })
        for order, (sub_slug, sub_name) in enumerate(cat["subs"]):
            sub_docs.append({
                "slug": sub_slug, "name": sub_name,
                "parent_category": cat["slug"], "niche": "cosmetics",
                "sort_order": order, "is_active": True,
                "created_at": now, "updated_at": now,
            })
            # Flat-category row for the Cosmetics hub UI.
            cat_docs.append({
                "slug": sub_slug, "name": sub_name,
                "icon": SUBCAT_ICONS.get(sub_slug, cat["icon"]),
                "niche": "cosmetics", "group": "cosmetics", "is_parent": False,
                "parent": cat["slug"],
                "sort_order": order, "is_active": True,
                "created_at": now, "updated_at": now,
            })

    if cat_docs:
        await db.categories.insert_many(cat_docs, ordered=False)
    if sub_docs:
        await db.subcategories.insert_many(sub_docs, ordered=False)

    # 6b. Re-apply admin-curated visual overrides captured before the wipe.
    # We only $set fields that have a non-empty preserved value — so the
    # canonical defaults (icon emojis, tagline, accent colors) survive when
    # no admin override exists, but Cloudinary image URLs / custom icons /
    # custom accent colors uploaded by the admin come straight back.
    async def _reapply(collection_name: str, preserved: dict) -> int:
        restored = 0
        for slug, kept in preserved.items():
            if not kept:
                continue
            try:
                res = await db[collection_name].update_one(
                    {"slug": slug}, {"$set": kept}
                )
                if res.matched_count:
                    restored += 1
            except Exception as exc:
                logger.warning(f"[taxonomy_canonical] reapply {collection_name}/{slug} failed: {exc}")
        return restored

    re_concerns = await _reapply("concerns", preserved_concerns)
    re_categories = await _reapply("categories", preserved_categories)
    re_subcategories = await _reapply("subcategories", preserved_subcategories)
    logger.info(
        "[taxonomy_canonical] preserved admin visuals: concerns=%d, categories=%d, subcategories=%d",
        re_concerns, re_categories, re_subcategories,
    )

    # 7. Sentinel — block the legacy seeders from re-running.
    await db.site_settings.update_one(
        {"_id": "main"},
        {"$set": {
            "taxonomy_canonical_applied": True,
            "taxonomy_canonical_version": "2026-02-granular-subs-v5",
            "taxonomy_canonical_applied_at": now,
            "cosmetics_featured_nav": COSMETICS_FEATURED_NAV,
            "cosmetics_promo_sections": COSMETICS_PROMO_SECTIONS,
            # also flip the v2 flag so old code doesn't re-seed flat concerns
            "taxonomy_v2_applied": True,
        }},
        upsert=True,
    )

    return {
        "concerns": len(concern_docs),
        "categories": len(cat_docs),
        "subcategories": len(sub_docs),
    }


# ============================================================
# RECLASSIFY all products (links every product to taxonomy)
# ============================================================
# ============================================================
# MASTER BRAIN — sub-brand detection, brand normalisation,
# haircare hiding, concern inference.
# Auto-applied on every backend startup inside reclassify_all_products.
# Image / icon / media fields are NEVER touched by this engine.
# ============================================================

# Sub-brand prefix → canonical brand. Real distinct brands that import
# files lumped under a parent / store brand by mistake.
_SUB_BRAND_PREFIXES: dict[str, str] = {
    # HUL family — separate from Lakme
    "simple ": "Simple",
    "elle 18": "Elle 18",
    "elle18": "Elle 18",
    "ell 18": "Elle 18",
    "pond's": "Pond's",
    "ponds": "Pond's",
    "dove ": "Dove",
    "vaseline": "Vaseline",
    # Lakme abbreviations stay Lakme
    "lakme ": "Lakme", "lkm ": "Lakme", "lkme": "Lakme", "lk ": "Lakme",
    # Maybelline
    "maybelline": "Maybelline", "ml ": "Maybelline",
    # MyGlamm / Renee / Sugar
    "myglamm": "MyGlamm",
    "renee ": "Renee",
    "sugar pop": "Sugar Pop",
    "sugar ": "Sugar",
    # Big foreign brands
    "the ordinary": "The Ordinary",
    "beauty of joseon": "Beauty of Joseon",
    "huda beauty": "Huda Beauty", "huda ": "Huda Beauty",
    "kay beauty": "Kay Beauty", "kay by katrina": "Kay Beauty",
    "too faced": "Too Faced",
    "mac ": "Mac", "m.a.c": "Mac",
    "estee lauder": "Estee Lauder", "estée lauder": "Estee Lauder",
    "the face shop": "The Face Shop",
    "laneige": "Laneige",
    "glow recipe": "Glow Recipe",
    # Indian D2C
    "the derma co": "The Derma Co",
    "fix derma": "Fix Derma", "fixderma": "Fix Derma",
    "swiss beauty select": "Swiss Beauty Select",
    "swiss beauty": "Swiss Beauty", "swissbeauty": "Swiss Beauty",
    "minimalist": "Minimalist", "be minimalist": "Minimalist",
    "cosrx": "Cosrx",
    "cetaphil": "Cetaphil",
    "bioderma": "Bioderma",
    "sebamed": "Sebamed", "seba med": "Sebamed",
    "cerave": "Cerave", "cera ve": "Cerave",
    "pilgrim": "Pilgrim",
    "lotus": "Lotus",
    "mamaearth": "Mamaearth", "mama earth": "Mamaearth",
    "plum ": "Plum",
    "dot&key": "Dot & Key", "dot & key": "Dot & Key", "dot and key": "Dot & Key",
    "foxtale": "Foxtale",
    "auric ": "Auric",
    "quench": "Quench",
    "makeup revolution": "Revolution", "revolution ": "Revolution",
    "pac ": "Pac",
    "forever52": "Forever52", "forever 52": "Forever52",
    "colorbar": "Colorbar",
    "loreal paris": "L'Oreal Paris", "l'oreal paris": "L'Oreal Paris",
    "loreal ": "L'Oreal Paris",
    "nykaa ": "Nykaa",
    "krylon": "Krylon",
    "mirabella": "Mirabella", "mirabelle": "Mirabella",
    "aqualogia": "Aqualogia",
    "aureana": "Aureana",
    "dr sheth": "Dr. Sheth's", "dr. sheth": "Dr. Sheth's",
    "dr sheth's": "Dr. Sheth's", "dr. sheth's": "Dr. Sheth's",
    "celesta glow": "Celesta Glow",
}

# brand string → canonical (typo / casing normaliser)
_BRAND_NORMALISE: dict[str, str] = {
    "derma": "The Derma Co", "dermaco": "The Derma Co",
    "derma co": "The Derma Co", "the derma co": "The Derma Co",
    "mirabelle": "Mirabella",
    "esteelauder": "Estee Lauder", "estée lauder": "Estee Lauder",
    "laniege": "Laneige",
    "loreal paris": "L'Oreal Paris", "loreal": "L'Oreal Paris",
    "dr sheiths": "Dr. Sheth's", "dr sheth": "Dr. Sheth's",
    "dr sheths": "Dr. Sheth's", "dr. sheth": "Dr. Sheth's",
    "beauty of joseon": "Beauty of Joseon",
    "fixderma": "Fix Derma",
    "fenty beauty": "Fenty Beauty",
}

# Default concerns by category when a product has none.  Keeps concern-based
# filters meaningful even for products whose name doesn't hit a concern keyword.
_CATEGORY_DEFAULT_CONCERNS: dict[str, list[str]] = {
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

_CONCERN_KEYWORD_HINTS: dict[str, list[str]] = {
    "acne-breakouts":   ["acne", "pimple", "blemish", "salicylic", "bha",
                         "anti-acne", "anti acne", "spot", "blackhead",
                         "whitehead"],
    "pigmentation":     ["dark spot", "pigmentation", "melasma", "uneven tone",
                         "tan removal", "tanning", "kojic", "alpha arbutin",
                         "azelaic"],
    "dryness":          ["dry skin", "moisturiz", "hydrat", "hyaluronic",
                         "squalane", "shea butter", "ceramide", "nourishing"],
    "oil-sebum":        ["oily skin", "oil control", "matte ", "sebum",
                         "niacinamide", "purifying", "anti-shine"],
    "aging":            ["anti-aging", "anti-ageing", "wrinkle", "firming",
                         "retinol", "retinal", "bakuchiol", "peptide",
                         "collagen", "lifting", "rejuven"],
    "sensitivity":      ["sensitive skin", "calming", "soothing", "redness",
                         "centella", "cica", "panthenol", "allantoin"],
    "texture-pores":    ["pores", "smooth", "texture", "polished", "refining",
                         "minimiz"],
    "brightening-glow": ["bright", "glow", "radiance", "luminous", "vitamin c",
                         "vit c", "niacinamide", "alpha arbutin", "lit ",
                         "illuminat"],
    "under-eye":        ["under eye", "under-eye", "dark circle", "puffy",
                         "puffiness", "caffeine eye"],
    "barrier-support":  ["barrier", "ceramide", "cica", "centella", "panthenol",
                         "repair"],
    "sun-protection":   ["spf", "sunscreen", "sunblock", "uva", "uvb",
                         "broad spectrum"],
    "mens":             [" men ", "for men", "men's"],
}

# Image / media field allow-list — these are NEVER part of the canonical
# taxonomy engine's writes. Belt-and-braces guard against accidental updates.
_IMAGE_FIELDS = frozenset({
    "images", "image", "image_url", "thumbnail", "thumb", "thumb_url",
    "hero_image", "swatches", "swatch", "swatch_image", "video_url",
    "video_thumb_url", "media", "gallery",
})


def _detect_sub_brand(name: str) -> Optional[str]:
    """Longest-prefix sub-brand detection in the product name."""
    n = (name or "").lower().strip()
    if not n:
        return None
    for token in sorted(_SUB_BRAND_PREFIXES.keys(), key=len, reverse=True):
        # Token may include trailing space already (intentional anchoring)
        if n.startswith(token) or n == token.strip():
            return _SUB_BRAND_PREFIXES[token]
    return None


def _normalise_brand_value(brand: Optional[str]) -> Optional[str]:
    """Case/typo normalisation; returns canonical or input unchanged."""
    if not brand:
        return brand
    bl = brand.lower().strip()
    return _BRAND_NORMALISE.get(bl, brand)


def _infer_concerns(name: str, description: str, category: Optional[str]) -> list[str]:
    blob = ((name or "") + " " + (description or "")).lower()
    found: list[str] = []
    for concern, kws in _CONCERN_KEYWORD_HINTS.items():
        for k in kws:
            if k in blob:
                if concern not in found:
                    found.append(concern)
                break
        if len(found) >= 3:
            break
    if not found and category:
        found = list(_CATEGORY_DEFAULT_CONCERNS.get(category, []))
    return found[:3]


def _safe_set(payload: dict) -> dict:
    """Strip any image / media fields from an update payload.

    Defensive: this is called immediately before EVERY db.products.update_one
    inside reclassify_all_products. If a future contributor accidentally adds
    an image-related key to the update, this filter removes it BEFORE the
    write hits MongoDB. Image / icon assets remain admin-owned and immune to
    taxonomy reclassification.
    """
    return {k: v for k, v in payload.items() if k not in _IMAGE_FIELDS}


async def reclassify_all_products(db, batch_log: int = 500,
                                   job_id: Optional[str] = None) -> dict:
    """Walk all products and re-classify niche/category/subcategory/concerns
    based on name + description + brand keywords.

    If `job_id` is supplied, writes progress updates to
    `db.taxonomy_jobs` so a frontend poller can render a progress bar.
    """
    def _sanitize_keys(o):
        """Mongo rejects None as a document key. Convert recursively. Idempotent."""
        if isinstance(o, dict):
            return {("__null__" if k is None else str(k)): _sanitize_keys(v)
                    for k, v in o.items()}
        if isinstance(o, list):
            return [_sanitize_keys(v) for v in o]
        return o

    total = await db.products.count_documents({})
    counters = {"updated": 0, "total": total,
                "by_niche": {}, "by_category": {}, "by_subcat": {}}

    async def _write_progress(stage: str = "classifying"):
        if not job_id:
            return
        try:
            await db.taxonomy_jobs.update_one(
                {"_id": job_id},
                {"$set": _sanitize_keys({
                    "stage": stage,
                    "processed": counters["updated"],
                    "total": total,
                    "percent": int(counters["updated"] * 100 / total) if total else 100,
                    "by_niche": counters["by_niche"],
                    "updated_at": _now(),
                })},
            )
        except Exception as e:
            logger.warning(f"[taxonomy_canonical] progress write failed: {e}")

    await _write_progress("classifying")

    cur = db.products.find(
        {},
        {"_id": 0, "slug": 1, "name": 1, "description": 1, "brand": 1,
         "niche": 1, "category": 1, "subcategory": 1, "concerns": 1,
         "is_active": 1}
    )
    async for prod in cur:
        # ---- BRAND MASTER BRAIN — sub-brand prefix + typo normalisation ----
        raw_name = prod.get("name") or ""
        raw_brand = prod.get("brand") or ""
        # Sub-brand prefix wins over the bulk-import brand (e.g. "Simple Face
        # Wash" misfiled as Lakme → corrected to Simple).
        sub_b = _detect_sub_brand(raw_name)
        if sub_b:
            effective_brand = sub_b
        else:
            effective_brand = _normalise_brand_value(raw_brand) or raw_brand

        # Re-classify everything. Flagship anti-aging products are detected
        # by name/description content, not by a sticky niche flag.
        result = classify_product(
            name=raw_name,
            description=prod.get("description") or "",
            brand=effective_brand,
            current_niche=prod.get("niche"),
        )
        # FLAGSHIP GUARD — the "anti-aging" niche is RESERVED for Celesta Glow
        # AND only for the SKUs the admin originally placed there. We do NOT
        # auto-promote every CG product into anti-aging; that would lump
        # cleansers, sunscreens, toners etc. into the flagship hub. Rule:
        #   - If product WAS already niche=anti-aging AND brand is Celesta
        #     Glow → keep it there (preserve admin curation).
        #   - Any other product currently sitting in anti-aging that is NOT
        #     Celesta Glow → demote to skincare (no foreign brands allowed).
        brand_text = (prod.get("brand") or "").lower()
        name_text = (prod.get("name") or "").lower()
        is_celesta = "celesta glow" in brand_text or "celesta glow" in name_text
        was_anti_aging = prod.get("niche") == "anti-aging"
        if was_anti_aging and is_celesta:
            # Preserve admin's anti-aging curation for this Celesta SKU.
            result["niche"] = "anti-aging"
        elif result["niche"] == "anti-aging" and not is_celesta:
            # Defensive — classifier should not pick anti-aging for non-CG,
            # but if it ever does, demote.
            result["niche"] = "skincare"
            if not result.get("category"):
                result["category"] = "anti-aging-products"

        upd = {
            "niche": result["niche"],
            "category": result["category"],
            "subcategory": result["subcategory"],
            "concerns": result["concerns"],
            "needs_review": result.get("unclassified", False),
            "taxonomy_classified_at": _now(),
        }

        # ---- BRAND CORRECTION — apply if changed ----
        if effective_brand and effective_brand != raw_brand:
            upd["brand"] = effective_brand

        # ---- HAIRCARE HIDE — this is a skincare/cosmetics store. Hair products
        # stay in the DB (so the snapshot/restore keeps them) but is_active=False
        # removes them from the public catalogue / hub tiles. Re-enabling is a
        # one-flip admin action.
        if result["niche"] == "haircare" and prod.get("is_active", True) is not False:
            upd["is_active"] = False
        # Conversely, if a product was hidden as haircare but is no longer
        # classified haircare (e.g. classifier improvement), re-enable it.
        elif result["niche"] != "haircare" and prod.get("is_active") is False:
            upd["is_active"] = True

        # ---- CONCERN INFERENCE FALLBACK — fill the long tail the keyword
        # classifier misses, but ONLY for skincare/anti-aging niches.
        # Cosmetics products legitimately have no concerns.
        if not result["concerns"] and result["niche"] in ("skincare", "anti-aging"):
            inferred = _infer_concerns(
                raw_name, prod.get("description") or "", result["category"]
            )
            if inferred:
                upd["concerns"] = inferred
                upd["concerns_inferred"] = True

        # ---- IMAGE-SAFETY GUARD — strip any image/media field that may have
        # crept into the payload before writing to Mongo.
        upd = _safe_set(upd)
        await db.products.update_one({"slug": prod["slug"]}, {"$set": upd})
        counters["updated"] += 1
        # Convert None to a string sentinel so the dict can be persisted in
        # MongoDB (which rejects None as a document key). Same goes for niche.
        niche_key = result["niche"] or "__null__"
        cat_key = result["category"] or "__null__"
        counters["by_niche"][niche_key] = counters["by_niche"].get(niche_key, 0) + 1
        counters["by_category"][cat_key] = counters["by_category"].get(cat_key, 0) + 1
        if result["subcategory"]:
            counters["by_subcat"][result["subcategory"]] = counters["by_subcat"].get(result["subcategory"], 0) + 1
        if counters["updated"] % batch_log == 0:
            logger.info(f"[taxonomy_canonical] reclassified {counters['updated']} products...")
            await _write_progress("classifying")
    await _write_progress("cleaning_empty_tiles")
    # Auto-deactivate empty (sub)categories so the hub UI doesn't show empty tiles.
    cleanup = await cleanup_empty_taxonomy(db)
    counters["cleanup"] = cleanup
    await _write_progress("repairing_brands")
    # Repair bad brand values (sheet names, blanks, numeric strings) — runs
    # AFTER classify so the classifier still sees the raw text for niche hints.
    brand_fix = await cleanup_bad_brands(db, dry_run=False)
    counters["brand_fix"] = brand_fix
    # Final sanitization of the entire counters payload — guarantees no
    # downstream Mongo write can ever fail because of a None key.
    return _sanitize_keys(counters)


# ============================================================
# BRAND CLEANUP — fix garbage brand values from Excel imports
# (sheet names, page numbers, empty / placeholder strings).
# Auto-extracts the real brand from the product name's first
# 1-3 words when possible.
# ============================================================

# Known brand prefixes seen in product names — used to repair
# products whose brand field is a sheet name. Extend as needed.
_KNOWN_BRAND_PREFIXES = [
    "Too Faced", "Fenty Beauty", "Charlotte Tilbury", "Huda Beauty",
    "Mac", "L'Oreal Paris", "Loreal Paris", "Loreal", "Maybelline",
    "Lakme", "Colorbar", "Nykaa", "Sugar", "Forever52", "Forever 52",
    "Renee", "Swiss Beauty Select", "Swiss Beauty", "Kay Beauty",
    "Pac", "Mamaearth", "Plum", "Revolution", "Krylon", "Lotus",
    "Pilgrim", "Auric", "Fix Derma", "Fixderma", "Quench", "Cetaphil",
    "Dermaco", "Minimalist", "Dot&Key", "Dot & Key", "Mirabella",
    "The Face Shop", "Sebamed", "Aureana", "Aqualogia",
    "Esteelauder", "Estee Lauder", "Dr Sheiths", "Cosrx",
    "Laneige", "Laniege", "Cerave", "Bioderma", "The Ordinary",
    "Foxtale", "Beauty Of Joseon", "Glow Recipe", "Tarte",
    "Urban Decay", "Benefit", "Nars", "Bobbi Brown", "Clinique",
    "Smashbox", "Stila", "Hourglass", "Pat McGrath", "Pixi",
    "Milani", "Wet n Wild", "ELF", "e.l.f.", "Anastasia",
    "Becca", "Tower 28", "Rare Beauty", "Patrick Ta",
    "Mars", "Miss Claire", "Elle 18", "Elle18", "Insight",
    "Blue Heaven", "Rimmel", "Revlon", "Chambor",
    "Celesta Glow", "Celesta Beauty",
]


def _is_bad_brand(value) -> bool:
    """True if `value` looks like Excel-import garbage instead of a brand."""
    if value is None:
        return True
    s = str(value).strip()
    if len(s) < 2:
        return True
    sl = s.lower()
    if sl in {"nan", "none", "null", "unknown", "n/a", "na", "-", "tbd"}:
        return True
    if re.match(r"^(sheet|tab|page|column|row)\s*\d*$", sl):
        return True
    if re.match(r"^(untitled|new sheet|sheet\d+|book\d*)$", sl):
        return True
    if re.match(r"^\d+$", s):
        return True
    if re.match(r"^[a-z]\d+$", sl):
        return True
    return False


def _extract_brand_from_name(name: str) -> Optional[str]:
    """Find a known brand prefix at the start of the product name."""
    if not name:
        return None
    name_lower = name.lower().strip()
    for brand in sorted(_KNOWN_BRAND_PREFIXES, key=len, reverse=True):
        if name_lower.startswith(brand.lower()):
            return brand
    return None


async def cleanup_bad_brands(db, dry_run: bool = False) -> dict:
    """Walk all products, fix garbage brand values (sheet names, blanks,
    numeric strings) by extracting the real brand from the product name's
    first word(s). If no known brand matches, sets brand=None.
    Idempotent — safe to re-run. Runs automatically after every reclassify."""
    from collections import Counter as _Counter
    fixed_by_extract: list[dict] = []
    set_to_null: list[str] = []
    cur = db.products.find({}, {"_id": 0, "slug": 1, "name": 1, "brand": 1})
    async for p in cur:
        b = p.get("brand")
        if not _is_bad_brand(b):
            continue
        extracted = _extract_brand_from_name(p.get("name") or "")
        if extracted:
            fixed_by_extract.append({"slug": p["slug"], "old": b, "new": extracted})
            if not dry_run:
                await db.products.update_one(
                    {"slug": p["slug"]},
                    {"$set": {"brand": extracted,
                              "brand_fixed_at": _now(),
                              "brand_was": str(b) if b is not None else None}}
                )
        else:
            set_to_null.append(p["slug"])
            if not dry_run:
                await db.products.update_one(
                    {"slug": p["slug"]},
                    {"$set": {"brand": None,
                              "brand_fixed_at": _now(),
                              "brand_was": str(b) if b is not None else None}}
                )
    extract_summary = _Counter(item["new"] for item in fixed_by_extract)
    return {
        "fixed_by_extract": len(fixed_by_extract),
        "set_to_null": len(set_to_null),
        "extracted_brand_counts": dict(extract_summary),
        "examples": fixed_by_extract[:10],
        "dry_run": dry_run,
    }


# ============================================================
# CLEANUP — deactivate categories/subcategories with 0 products
# ============================================================
async def cleanup_empty_taxonomy(db) -> dict:
    """Set is_active=False on category/subcategory rows that have no products.
    Parents (is_parent=True) with at least one active child stay active.

    The user spec said: "Some subcategory, it is zero products. So remove
    that. That is not needed." This is the implementation.
    """
    # 1. Count products per category slug (matches either `category` or `subcategory`)
    counts_by_slug: dict[str, int] = {}
    async for p in db.products.find({"is_active": True}, {"_id": 0, "category": 1, "subcategory": 1}):
        for k in (p.get("category"), p.get("subcategory")):
            if k:
                counts_by_slug[k] = counts_by_slug.get(k, 0) + 1

    # 2. Walk every category row in db.categories and toggle is_active accordingly.
    deactivated, reactivated = [], []
    cur = db.categories.find(
        {"niche": {"$in": ["skincare", "cosmetics"]}},
        {"_id": 0, "slug": 1, "name": 1, "is_parent": 1, "parent": 1, "is_active": 1, "niche": 1}
    )
    rows = await cur.to_list(length=None)

    # Group children by parent so we can keep a parent active if it has 1+ active child.
    children_by_parent: dict[str, list[dict]] = {}
    parents: list[dict] = []
    for r in rows:
        if r.get("is_parent"):
            parents.append(r)
        elif r.get("parent"):
            children_by_parent.setdefault(r["parent"], []).append(r)

    # 2a. Toggle children
    for parent, kids in children_by_parent.items():
        for kid in kids:
            cnt = counts_by_slug.get(kid["slug"], 0)
            want_active = cnt > 0
            if want_active != kid.get("is_active", True):
                await db.categories.update_one(
                    {"slug": kid["slug"], "niche": kid["niche"]},
                    {"$set": {"is_active": want_active, "product_count": cnt}}
                )
                (reactivated if want_active else deactivated).append(kid["slug"])
            else:
                # Refresh product_count even when active state unchanged
                await db.categories.update_one(
                    {"slug": kid["slug"], "niche": kid["niche"]},
                    {"$set": {"product_count": cnt}}
                )

    # 2b. Toggle parents — deactivate parent only if ALL children are empty AND parent itself is empty.
    # Parent product_count = own + sum of children (aggregate display on hub tiles).
    for p in parents:
        parent_own = counts_by_slug.get(p["slug"], 0)
        kids = children_by_parent.get(p["slug"], [])
        kids_total = sum(counts_by_slug.get(k["slug"], 0) for k in kids)
        # Use max() so we don't double-count when products already store
        # category=parent_slug (which makes parent_own ≈ kids_total).
        total = max(parent_own, kids_total)
        any_kid_has = any(counts_by_slug.get(k["slug"], 0) > 0 for k in kids)
        want_active = parent_own > 0 or any_kid_has
        if want_active != p.get("is_active", True):
            await db.categories.update_one(
                {"slug": p["slug"], "niche": p["niche"]},
                {"$set": {"is_active": want_active, "product_count": total}}
            )
            (reactivated if want_active else deactivated).append(p["slug"])
        else:
            await db.categories.update_one(
                {"slug": p["slug"], "niche": p["niche"]},
                {"$set": {"product_count": total}}
            )

    # 3. Mirror to db.subcategories collection.
    sub_cur = db.subcategories.find(
        {"niche": {"$in": ["skincare", "cosmetics"]}},
        {"_id": 0, "slug": 1, "niche": 1, "is_active": 1}
    )
    async for s in sub_cur:
        cnt = counts_by_slug.get(s["slug"], 0)
        want_active = cnt > 0
        await db.subcategories.update_one(
            {"slug": s["slug"], "niche": s["niche"]},
            {"$set": {"is_active": want_active, "product_count": cnt}}
        )

    return {
        "deactivated": len(deactivated),
        "reactivated": len(reactivated),
        "deactivated_slugs": deactivated[:50],
        "total_categories_scanned": len(rows),
    }




# ============================================================
# DEDUPE — collapse duplicate products by normalized name
# ============================================================
def _norm_name(name: str) -> str:
    """Aggressive normalization for dedup matching."""
    n = (name or "").lower().strip()
    n = re.sub(r"[\u2013\u2014]", "-", n)
    n = re.sub(r"[^a-z0-9 ]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


async def dedupe_products(db, dry_run: bool = False) -> dict:
    """Find products with identical normalized names, keep the one with the
    highest review_count (most established), deactivate the rest.

    Marks duplicates with `is_active=False` and `dedup_merged_into=<keeper_slug>`
    so admin can review.
    """
    by_key: dict[str, list[dict]] = {}
    cur = db.products.find(
        {},
        {"_id": 0, "slug": 1, "name": 1, "reviews_count": 1, "rating": 1, "is_active": 1}
    )
    async for p in cur:
        key = _norm_name(p.get("name") or "")
        if not key:
            continue
        by_key.setdefault(key, []).append(p)

    dupes = {k: v for k, v in by_key.items() if len(v) > 1}
    duplicates_found = sum(len(v) - 1 for v in dupes.values())

    if dry_run:
        return {"groups": len(dupes), "duplicates_found": duplicates_found, "dry_run": True}

    deactivated = 0
    now = _now()
    for key, group in dupes.items():
        # Sort by reviews desc, then rating desc — best one wins.
        group.sort(key=lambda p: (p.get("reviews_count") or 0, p.get("rating") or 0), reverse=True)
        keeper = group[0]
        for loser in group[1:]:
            if not loser.get("is_active"):
                continue  # already disabled
            await db.products.update_one(
                {"slug": loser["slug"]},
                {"$set": {
                    "is_active": False,
                    "dedup_merged_into": keeper["slug"],
                    "dedup_at": now,
                }}
            )
            deactivated += 1
    return {"groups": len(dupes), "duplicates_found": duplicates_found,
            "deactivated": deactivated, "dry_run": False}
