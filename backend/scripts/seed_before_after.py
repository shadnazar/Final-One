"""Seed the 5 customer transformation images provided by the client for the
Homepage Before/After strip. Idempotent: re-runs are safe (matches on
image URL to avoid duplicates)."""
import asyncio
import os
import secrets
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load env from backend/.env (same as server.py)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

IMAGES = [
    {
        "image": "https://customer-assets-v7afamib.emergentagent.net/job_weather-preview-6/artifacts/xwnkuy5y_84976EC2-A502-4C06-89D1-FD5A69D6470F.png",
        "customer_name": "Verified customer",
        "duration": "8 weeks",
        "description": "Cleared active acne + faded post-acne spots",
        "sort_order": 1,
    },
    {
        "image": "https://customer-assets-v7afamib.emergentagent.net/job_weather-preview-6/artifacts/9fjw6yl1_3786F443-55ED-4827-81A7-4693D9112040.png",
        "customer_name": "Verified customer",
        "duration": "6 weeks",
        "description": "Even skin tone, softer texture",
        "sort_order": 2,
    },
    {
        "image": "https://customer-assets-v7afamib.emergentagent.net/job_weather-preview-6/artifacts/ejlz9ial_7AB2FFB6-3B34-4088-9735-B6E03443C961.png",
        "customer_name": "Verified customer",
        "duration": "10 weeks",
        "description": "Brighter, plumper skin with reduced redness",
        "sort_order": 3,
    },
    {
        "image": "https://customer-assets-v7afamib.emergentagent.net/job_weather-preview-6/artifacts/q1xg6786_C23A32E0-757C-4080-A47A-D637B509A429.png",
        "customer_name": "Verified customer",
        "duration": "12 weeks",
        "description": "Glass-skin glow, minimized pores",
        "sort_order": 4,
    },
    {
        "image": "https://customer-assets-v7afamib.emergentagent.net/job_weather-preview-6/artifacts/zym64adn_2ABB4DDB-36B4-47E2-AE91-EC7CA76504C5.png",
        "customer_name": "Verified customer",
        "duration": "8 weeks",
        "description": "Clearer complexion, refined pores",
        "sort_order": 5,
    },
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    inserted = 0
    for img in IMAGES:
        existing = await db.before_after_images.find_one({"image": img["image"]})
        if existing:
            continue
        doc = {
            **img,
            "is_global": True,
            "product_slug": None,
            "before_image": "",
            "after_image": "",
            "ba_id": f"ba_{secrets.token_hex(4)}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.before_after_images.insert_one(doc)
        inserted += 1
    total = await db.before_after_images.count_documents({"is_global": True})
    print(f"Inserted {inserted} new before/after images. Global total: {total}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
