"""Seed the flagship 'Complete Anti-Aging Kit' combo from the 5 core SKUs."""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from motor.motor_asyncio import AsyncIOMotorClient

COMBO = {
    "combo_id": "complete-anti-aging-kit",
    "name": "Complete Anti-Aging Kit",
    "description": "All 5 products for a complete anti-aging routine. Cleanse, treat, hydrate, protect.",
    "product_slugs": [
        "celesta-glow-gentle-cleanser",
        "celesta-glow-radiance-serum",
        "celesta-glow-under-eye-cream",
        "celesta-glow-repair-night-cream",
        "celesta-glow-mineral-sunscreen-spf50",
    ],
    "mrp_total": 5299,
    "combo_prepaid_price": 2999,
    "combo_cod_price": 3199,
    "discount_percent": 43,
    "badge": "Save \u20b92,300",
    "is_active": True,
    "sort_order": 1,
    "niche": "anti-aging",
    "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/v1777596658/celesta-glow/products/7049ccdde7f54912a204844d6cd4b8dc.jpg",
    "is_to_be_launched": False,
    "launch_date": None,
    "preorder_enabled": False,
}


async def run():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    COMBO["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.combos.update_one({"combo_id": COMBO["combo_id"]}, {"$set": COMBO}, upsert=True)
    total = await db.combos.count_documents({})
    print(f"Combo upserted (matched={res.matched_count}). Total combos: {total}")


if __name__ == "__main__":
    asyncio.run(run())
