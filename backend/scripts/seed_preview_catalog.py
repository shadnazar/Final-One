"""Seed the Celesta Glow flagship catalog to match the live preview.

Creates 4 base products (Vitamin E / C / A serums + Benzoyl Peroxide spot
corrector) and their 24 variation SKUs each (2 genders x 3 skin types x 4 age
ranges). Images/certificates are resolved from the bundled backend/uploads
assets when the file exists, else fall back to the Cloudinary hero image.

Idempotent — upserts by slug. Run:
    python /app/backend/scripts/seed_preview_catalog.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from motor.motor_asyncio import AsyncIOMotorClient

UP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "products"))
CLD = "https://res.cloudinary.com/dcvuqcqjn/image/upload/q_auto:best,f_auto/{v}/celesta-glow/products/{f}.jpg"


def up(name):
    """Return /api/uploads path if the asset exists, else None."""
    if os.path.exists(os.path.join(UP_DIR, name)):
        return f"/api/uploads/products/{name}"
    return None


NOW = datetime.now(timezone.utc).isoformat()

INGREDIENTS_FULL = (
    "Aqua, Glycerin, Propanediol, Niacinamide, Sodium Hyaluronate, Tocopheryl "
    "Acetate, Panthenol, Allantoin, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin, "
    "Citric Acid, Sodium Gluconate."
)

BASE = [
    {
        "slug": "vitamin-e-brightening-serum",
        "name": "Vitamin E Brightening Serum",
        "short_name": "Vitamin E Serum",
        "tagline": "Vitamin E + Niacinamide Brightening Formula",
        "description": "A lightweight, fast-absorbing serum that deeply nourishes and brightens dull skin. Enriched with Vitamin E and Niacinamide to improve clarity, reduce dark spots and restore a healthy, radiant glow for all skin types.",
        "category": "serum",
        "concerns": ["brightening-glow", "pigmentation", "anti-aging"],
        "key_ingredients": "Vitamin E + Niacinamide + Hyaluronic Acid",
        "benefits": ["Brightens & Evens Skin Tone", "Reduces Dullness & Dark Spots", "Deep Antioxidant Nourishment", "Lightweight Daily Use Formula"],
        "how_to_use": "Apply 3-4 drops to clean, dry skin morning and night. Follow with moisturizer and sunscreen in the AM.",
        "size": "30ml / 1.01 fl oz",
        "mrp": 999, "prepaid_price": 649, "cod_price": 699, "discount_percent": 35,
        "rating": 4.9, "reviews_count": 2803, "cld_v": "v1790768399", "cld_f": "prod-23c1fa376216",
        "sort_order": 1, "badge": "Bestseller",
    },
    {
        "slug": "vitamin-c-brightening-serum",
        "name": "Vitamin C Brightening Serum",
        "short_name": "Vitamin C Serum",
        "tagline": "15% Vitamin C + Alpha Arbutin",
        "description": "A potent brightening serum powered by a stable form of Vitamin C and Alpha Arbutin. Visibly fades pigmentation, boosts radiance and defends skin against environmental stress for a luminous, even complexion.",
        "category": "serum",
        "concerns": ["brightening-glow", "pigmentation", "anti-aging"],
        "key_ingredients": "Vitamin C + Alpha Arbutin + Ferulic Acid",
        "benefits": ["Visibly Fades Pigmentation", "Boosts Radiance & Glow", "Antioxidant Protection", "Evens Skin Tone"],
        "how_to_use": "Apply 3-4 drops to clean, dry skin in the morning. Always follow with sunscreen.",
        "size": "30ml / 1.01 fl oz",
        "mrp": 1299, "prepaid_price": 849, "cod_price": 899, "discount_percent": 35,
        "rating": 4.9, "reviews_count": 1932, "cld_v": "v1790767676", "cld_f": "prod-5c4b53a4d611",
        "sort_order": 2, "badge": "Bestseller",
    },
    {
        "slug": "vitamin-a-serum",
        "name": "Vitamin A Serum",
        "short_name": "Vitamin A Serum",
        "tagline": "Retinol (Vitamin A) + Peptides",
        "description": "An advanced anti-aging serum formulated with encapsulated Retinol and supporting peptides. Smooths fine lines, refines texture and renews skin overnight while minimising irritation for Indian skin.",
        "category": "serum",
        "concerns": ["anti-aging", "aging", "texture-pores"],
        "key_ingredients": "Retinol + Peptides + Niacinamide",
        "benefits": ["Reduces Fine Lines & Wrinkles", "Refines Skin Texture", "Overnight Skin Renewal", "Minimises Pores"],
        "how_to_use": "Apply 2-3 drops at night on clean, dry skin. Start 2-3 nights a week. Always use SPF in the morning.",
        "size": "30ml / 1.01 fl oz",
        "mrp": 1499, "prepaid_price": 975, "cod_price": 1025, "discount_percent": 35,
        "rating": 4.8, "reviews_count": 1789, "cld_v": "v1790777411", "cld_f": "prod-3a8b9a44dd7e",
        "sort_order": 3, "badge": "Bestseller",
    },
    {
        "slug": "2-5-benzoyl-peroxide-spot-corrector",
        "name": "2.5% Benzoyl Peroxide Spot Corrector",
        "short_name": "Benzoyl Peroxide Spot Corrector",
        "tagline": "2.5% Benzoyl Peroxide Targeted Treatment",
        "description": "A targeted spot treatment with 2.5% Benzoyl Peroxide that fights acne-causing bacteria and clears active breakouts fast, while soothing agents keep skin calm and reduce the look of post-acne marks.",
        "category": "spot-treatment",
        "concerns": ["acne-breakouts", "oil-sebum"],
        "key_ingredients": "2.5% Benzoyl Peroxide + Allantoin",
        "benefits": ["Clears Active Breakouts", "Fights Acne-Causing Bacteria", "Reduces Post-Acne Marks", "Gentle On Skin Barrier"],
        "how_to_use": "Apply a thin layer directly on blemishes once daily, building up to twice daily. Follow with moisturizer.",
        "size": "15ml / 0.5 fl oz",
        "mrp": 299, "prepaid_price": 199, "cod_price": 249, "discount_percent": 33,
        "rating": 4.7, "reviews_count": 1208, "cld_v": "v1790890950", "cld_f": "prod-1f0096ea9a94",
        "sort_order": 4, "badge": "Bestseller",
    },
]

GENDERS = ["men", "women"]
SKIN = ["combination", "dry", "oily"]
AGES = ["18-24", "25-35", "35-50", "50-65plus"]


def build_base(p):
    cld_main = CLD.format(v=p["cld_v"], f=p["cld_f"])
    imgs = [cld_main]
    for t in ("tech1", "tech2", "tech3", "tech4"):
        u = up(f"{p['slug']}-{t}.jpg")
        if u:
            imgs.append(u)
    cert = up(f"{p['slug']}-certificate.jpg")
    doc = {
        "slug": p["slug"], "name": p["name"], "short_name": p["short_name"],
        "tagline": p["tagline"], "description": p["description"],
        "category": p["category"], "concerns": p["concerns"], "niche": "anti-aging",
        "key_ingredients": p["key_ingredients"], "ingredients_full": INGREDIENTS_FULL,
        "benefits": p["benefits"], "how_to_use": p["how_to_use"], "size": p["size"],
        "images": imgs, "image": cld_main,
        "mrp": p["mrp"], "prepaid_price": p["prepaid_price"], "cod_price": p["cod_price"],
        "cod_advance": 29, "discount_percent": p["discount_percent"],
        "badge": p["badge"], "is_active": True, "sort_order": p["sort_order"],
        "rating": p["rating"], "reviews_count": p["reviews_count"],
        "skin_type": "All Skin Types", "stock_qty": 500, "low_stock_threshold": 10,
        "is_bestseller": True, "is_variation": False, "variation_count": 24,
        "brand": "Celesta Glow",
        "test_report_lab": "Mascot Spincontrol — Clinical Research",
        "test_report_date": "2026-09-12", "is_dermat_tested": True,
        "created_at": NOW, "updated_at": NOW,
    }
    if cert:
        doc["test_report_image"] = cert
    before = up(f"{p['slug']}-before.jpg")
    after = up(f"{p['slug']}-after.jpg")
    if before and after:
        doc["before_image"] = before
        doc["after_image"] = after
    return doc


def build_variations(p):
    out = []
    i = 0
    for g in GENDERS:
        for s in SKIN:
            for a in AGES:
                i += 1
                vslug = f"{p['slug']}-{g}-{s}-{a}"
                sol = up(f"{vslug}-solution.jpg") or CLD.format(v=p["cld_v"], f=p["cld_f"])
                cert = up(f"{vslug}-certificate.jpg")
                age_label = a.replace("-", "–").replace("50–65plus", "50–65+")
                doc = {
                    "slug": vslug,
                    "name": f"{p['name']} ({g.capitalize()} {s.capitalize()} {age_label})",
                    "short_name": p["short_name"],
                    "tagline": p["tagline"], "description": p["description"],
                    "category": p["category"], "concerns": p["concerns"], "niche": "anti-aging",
                    "key_ingredients": p["key_ingredients"], "ingredients_full": INGREDIENTS_FULL,
                    "benefits": p["benefits"], "how_to_use": p["how_to_use"], "size": p["size"],
                    "images": [sol], "image": sol,
                    "mrp": p["mrp"], "prepaid_price": p["prepaid_price"], "cod_price": p["cod_price"],
                    "cod_advance": 29, "discount_percent": p["discount_percent"],
                    "is_active": True, "sort_order": 100 + i,
                    "rating": p["rating"], "reviews_count": max(5, p["reviews_count"] // 24),
                    "skin_type": s.capitalize(), "stock_qty": 200, "low_stock_threshold": 10,
                    "is_variation": True, "generated_from": p["slug"], "variation_count": 0,
                    "brand": "Celesta Glow",
                    "specs": {"gender": g, "skin_type": s, "age_range": age_label},
                    "test_report_lab": "Mascot Spincontrol — Clinical Research",
                    "test_report_date": "2026-09-12", "is_dermat_tested": True,
                    "created_at": NOW, "updated_at": NOW,
                }
                if cert:
                    doc["test_report_image"] = cert
                out.append(doc)
    return out


async def run():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL / DB_NAME missing")
        sys.exit(1)
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    total = 0
    for p in BASE:
        base_doc = build_base(p)
        await db.products.update_one({"slug": p["slug"]}, {"$set": base_doc}, upsert=True)
        total += 1
        for v in build_variations(p):
            await db.products.update_one({"slug": v["slug"]}, {"$set": v}, upsert=True)
            total += 1
    count = await db.products.count_documents({})
    actives = await db.products.count_documents({"is_active": True, "is_variation": {"$ne": True}})
    print(f"Seeded/updated {total} docs. Total products in DB: {count}. Listed (base) active: {actives}")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
