"""Attach the real Celesta Glow product gallery images (hosted on the brand's
own Cloudinary) to the 5 seeded flagship SKUs so the storefront renders with
the live product photography. Idempotent — safe to re-run."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from motor.motor_asyncio import AsyncIOMotorClient

B = "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_1200/"

IMAGES = {
    "celesta-glow-radiance-serum": [
        B + "v1780327224/celesta-glow/products/201e80b87d604c84ad25548b6a4783c6.webp",
        B + "v1780327234/celesta-glow/products/75874e14a6a54d55b343e02d532f6a89.webp",
    ],
    "celesta-glow-repair-night-cream": [
        B + "v1780327317/celesta-glow/products/0dbe0d70050649ba8823c171b9ec8ed8.jpg",
        B + "v1780327325/celesta-glow/products/e756218f271241be81c1ac202b888797.webp",
    ],
    "celesta-glow-under-eye-cream": [
        B + "v1780326942/celesta-glow/products/2176944437ca41a285f6be32764302e8.jpg",
        B + "v1780326943/celesta-glow/products/5c4bdaff7cf24facba83c8f779dabb07.jpg",
    ],
    "celesta-glow-mineral-sunscreen-spf50": [
        B + "v1780327417/celesta-glow/products/e199648f7c6f4fe2b91f7a408211758e.jpg",
        B + "v1780327422/celesta-glow/products/355d8def9fc14a5dba9b97566b4a9930.jpg",
    ],
    "celesta-glow-gentle-cleanser": [
        B + "v1780326845/celesta-glow/products/9cbffd4042f04e7d816d1825192c0ab4.webp",
        B + "v1780326859/celesta-glow/products/1f58e2bef15145a19eae5baba213dea6.webp",
    ],
}


async def run():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    updated = 0
    for slug, imgs in IMAGES.items():
        res = await db.products.update_one(
            {"slug": slug}, {"$set": {"images": imgs}}
        )
        updated += res.modified_count
    print(f"Updated images on {updated} products")


if __name__ == "__main__":
    asyncio.run(run())
