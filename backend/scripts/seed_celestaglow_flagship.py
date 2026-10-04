"""Seed the 5 flagship Celesta Glow SKUs.

Run: python /app/backend/scripts/seed_celestaglow_flagship.py

Idempotent — upserts by `slug`, so re-running will only refresh existing docs
instead of duplicating them.
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

# Make sure the backend dir is on sys.path so `import server` style imports resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient


PRODUCTS = [
    {
        "slug": "celesta-glow-radiance-serum",
        "name": "Celesta Glow Radiance Serum",
        "short_name": "Radiance Serum",
        "niche": "anti-aging",
        "category": "serums",
        "concerns": ["anti-aging", "aging", "dullness", "pigmentation"],
        "mrp": 1899,
        "prepaid_price": 1299,
        "cod_price": 1349,
        "discount_percent": 32,
        "size": "30ml",
        "tagline": "Retinol + Niacinamide + Hyaluronic Acid",
        "hero_line": "Visible glow in 4 weeks.",
        "key_ingredients": ["Retinol 0.3%", "Niacinamide 5%", "Hyaluronic Acid", "Peptides"],
        "benefits": [
            "Reduces fine lines & wrinkles",
            "Brightens dull skin",
            "Deep hydration for 24 hours",
            "Evens out skin tone",
        ],
        "how_to_use": "After cleansing, apply 3–4 drops on damp skin, morning and night. Follow with moisturizer and SPF in AM.",
        "faqs": [
            {"q": "Can I use retinol every day?", "a": "Start 2–3 nights a week and build up gradually. Always pair with SPF in the morning."},
            {"q": "Suitable for sensitive skin?", "a": "Yes — the 0.3% retinol is buffered with niacinamide and HA. Patch test first."},
        ],
        "is_active": True,
        "is_bestseller": True,
        "stock_qty": 250,
        "brand": "Celesta Glow",
    },
    {
        "slug": "celesta-glow-repair-night-cream",
        "name": "Celesta Glow Repair Night Cream",
        "short_name": "Night Cream",
        "niche": "anti-aging",
        "category": "moisturizers",
        "concerns": ["anti-aging", "aging", "dryness", "dullness"],
        "mrp": 1699,
        "prepaid_price": 1149,
        "cod_price": 1199,
        "discount_percent": 32,
        "size": "50g",
        "tagline": "Overnight ceramide + peptide repair",
        "hero_line": "Wake up to plumper, smoother skin.",
        "key_ingredients": ["Ceramides", "Peptides", "Squalane", "Vitamin E"],
        "benefits": [
            "Restores overnight moisture barrier",
            "Firms & lifts sagging skin",
            "Reduces morning puffiness",
            "Non-greasy, fast-absorbing",
        ],
        "how_to_use": "After serum, massage a pea-sized amount over face and neck. Use nightly.",
        "faqs": [
            {"q": "Can I use this with retinol serum?", "a": "Yes — apply the serum first, wait 2 minutes, then layer the night cream."},
            {"q": "Is it comedogenic?", "a": "No — the formula is non-comedogenic and safe for combination skin."},
        ],
        "is_active": True,
        "is_bestseller": True,
        "stock_qty": 220,
        "brand": "Celesta Glow",
    },
    {
        "slug": "celesta-glow-under-eye-cream",
        "name": "Celesta Glow Under Eye Cream",
        "short_name": "Eye Cream",
        "niche": "anti-aging",
        "category": "eye-care",
        "concerns": ["dark-circles", "aging", "puffiness"],
        "mrp": 1299,
        "prepaid_price": 899,
        "cod_price": 949,
        "discount_percent": 31,
        "size": "15g",
        "tagline": "Caffeine + Vitamin K for tired eyes",
        "hero_line": "Brighter under-eyes in 2 weeks.",
        "key_ingredients": ["Caffeine 3%", "Vitamin K", "Peptides", "Hyaluronic Acid"],
        "benefits": [
            "Reduces dark circles",
            "De-puffs morning eye bags",
            "Smooths crow's feet",
            "Cooling roll-on applicator",
        ],
        "how_to_use": "Roll under and around the eye, tap in gently with ring finger. Use AM and PM.",
        "faqs": [
            {"q": "Safe for contact lens wearers?", "a": "Yes — the formula is ophthalmologist tested and fragrance free."},
            {"q": "Does it work on genetic dark circles?", "a": "It brightens the area over 6–8 weeks, but genetic pigmentation may need clinical treatment."},
        ],
        "is_active": True,
        "is_bestseller": True,
        "stock_qty": 300,
        "brand": "Celesta Glow",
    },
    {
        "slug": "celesta-glow-mineral-sunscreen-spf50",
        "name": "Celesta Glow Mineral Sunscreen SPF 50 PA+++",
        "short_name": "Sunscreen SPF 50",
        "niche": "anti-aging",
        "category": "sunscreens",
        "concerns": ["sun-damage", "pigmentation", "aging"],
        "mrp": 899,
        "prepaid_price": 649,
        "cod_price": 699,
        "discount_percent": 28,
        "size": "50ml",
        "tagline": "Zero white cast · Reef-safe",
        "hero_line": "Broad-spectrum protection you'll actually wear.",
        "key_ingredients": ["Zinc Oxide 12%", "Titanium Dioxide", "Niacinamide", "Vitamin E"],
        "benefits": [
            "Blocks UVA + UVB rays",
            "Invisible finish on all skin tones",
            "Doubles as a smoothing primer",
            "Water-resistant up to 80 minutes",
        ],
        "how_to_use": "Apply two finger-lengths as the last step in your morning routine. Reapply every 2 hours outdoors.",
        "faqs": [
            {"q": "Is it safe for kids?", "a": "Yes — mineral filters are pediatrician approved for children over 6 months."},
            {"q": "Will it leave a white cast?", "a": "No — the micronized zinc formula blends invisibly on light to deep skin tones."},
        ],
        "is_active": True,
        "is_bestseller": True,
        "stock_qty": 400,
        "brand": "Celesta Glow",
    },
    {
        "slug": "celesta-glow-gentle-cleanser",
        "name": "Celesta Glow Gentle Foaming Cleanser",
        "short_name": "Gentle Cleanser",
        "niche": "anti-aging",
        "category": "cleansers",
        "concerns": ["sensitive-skin", "dryness", "acne"],
        "mrp": 699,
        "prepaid_price": 499,
        "cod_price": 549,
        "discount_percent": 29,
        "size": "150ml",
        "tagline": "Sulphate-free · pH 5.5",
        "hero_line": "Cleans without stripping.",
        "key_ingredients": ["Amino Acids", "Aloe Vera", "Panthenol", "Green Tea Extract"],
        "benefits": [
            "Removes makeup, SPF & dirt",
            "Never leaves skin tight",
            "Balanced pH for barrier health",
            "Safe for daily use AM + PM",
        ],
        "how_to_use": "Take a coin-sized amount, lather with water, massage gently for 30 seconds, rinse well.",
        "faqs": [
            {"q": "Can I use it with a face brush?", "a": "Yes — but a gentle silicone brush is enough for most skin types."},
            {"q": "Does it remove waterproof makeup?", "a": "It removes light makeup. Double cleanse with an oil cleanser for waterproof formulas."},
        ],
        "is_active": True,
        "is_bestseller": True,
        "stock_qty": 350,
        "brand": "Celesta Glow",
    },
]


async def run():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL / DB_NAME missing from .env")
        return
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    now = datetime.now(timezone.utc).isoformat()
    inserted, updated = 0, 0
    for i, p in enumerate(PRODUCTS):
        p["created_at"] = now
        p["updated_at"] = now
        p["sort_order"] = i
        p.setdefault("images", [])
        if isinstance(p.get("key_ingredients"), list):
            p["key_ingredients"] = " + ".join(p["key_ingredients"])
        existing = await db.products.find_one({"slug": p["slug"]}, {"_id": 1})
        if existing:
            await db.products.update_one({"slug": p["slug"]}, {"$set": p})
            updated += 1
        else:
            await db.products.insert_one(p)
            inserted += 1
    total = await db.products.count_documents({})
    print(f"Inserted: {inserted}, Updated: {updated}, Total products in DB: {total}")


if __name__ == "__main__":
    asyncio.run(run())
