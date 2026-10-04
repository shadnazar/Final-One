"""Migrate every ephemeral /api/uploads/* image URL in MongoDB to Cloudinary.

Why
---
Any document field still pointing at ``/api/uploads/...`` is served from the
pod's disposable disk. That directory is wiped on each redeploy, so those URLs
turn into 404s — the "images disappear after a few days" problem.

This script walks the collections that hold image URLs, uploads the local file
backing each ephemeral URL to Cloudinary under a deterministic public_id, and
rewrites the field to the permanent ``res.cloudinary.com`` URL. Anything whose
local file is already gone is reported so it can be regenerated.

Idempotent — re-running skips URLs that are already on Cloudinary.

Run:  cd /app/backend && python migrate_images_to_cloudinary.py
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BACKEND = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.path.join(BACKEND, "uploads")

# collection -> (id_field, [dotted image fields])
TARGETS = [
    ("products", "slug", [
        "images", "image", "hero_image", "test_report_image",
        "before_after_before", "before_after_after",
        "before_image", "after_image", "certificate_image",
        "before_after.image", "image_gallery.url", "solution_image",
    ]),
    ("before_after_images", "ba_id", ["before_image", "after_image"]),
    ("skin_scans", "id", ["photo_url"]),
    ("routines", "id", ["photo_url"]),
    ("tracker_logs", "id", ["photo_url"]),
    ("routine_plans", "plan_id", ["before_photo"]),
    ("journeys", "id", ["before_photo"]),
    ("banners", "banner_id", ["image", "mobile_image"]),
    ("blogs", "slug", ["image", "cover_image"]),
    ("blog_posts", "slug", ["image", "cover_image"]),
    ("site_settings", "_id", ["homepage_feature_image"]),
    ("brand_assets", "key", ["url", "image"]),
    ("shop_by_category_tiles", "tile_id", ["image"]),
]

EPHEMERAL = re.compile(r"^/api/uploads/(.+)$")


def _local_path(url: str):
    m = EPHEMERAL.match((url or "").split("?")[0])
    if not m:
        return None
    return os.path.join(UPLOADS, m.group(1))


def _public_id(url: str) -> str:
    rel = EPHEMERAL.match(url.split("?")[0]).group(1)
    stem = os.path.splitext(rel)[0]
    return re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()[:150]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    from services import cloudinary_service as cs
    from services import durable_images as di

    if not await cs.ensure_configured(db):
        print("FATAL: Cloudinary is not configured — set the three CLOUDINARY_* env vars.")
        return

    cache: dict = {}
    moved = missing = skipped = 0

    async def convert(url):
        """Return a permanent URL for `url` (or None when unrecoverable)."""
        nonlocal moved, missing, skipped
        if not isinstance(url, str) or not url:
            return None
        if not EPHEMERAL.match(url.split("?")[0]):
            skipped += 1
            return None                      # already Cloudinary / remote
        if url in cache:
            return cache[url]
        path = _local_path(url)
        if not path or not os.path.exists(path):
            missing += 1
            print(f"  MISSING local file for {url}")
            cache[url] = None
            return None
        with open(path, "rb") as f:
            data = f.read()
        try:
            new = await asyncio.to_thread(
                di._upload_sync, data, "celesta-glow/migrated", _public_id(url)
            )
            cache[url] = new["url"]
            moved += 1
            return new["url"]
        except Exception as exc:
            print(f"  UPLOAD FAILED {url}: {str(exc)[:110]}")
            cache[url] = None
            return None

    for coll, idf, fields in TARGETS:
        try:
            docs = await db[coll].find({}, {"_id": 0} if idf != "_id" else None).to_list(5000)
        except Exception:
            continue
        if not docs:
            continue
        changed_docs = 0
        for doc in docs:
            update = {}
            for field in fields:
                if "." in field:
                    parent, child = field.split(".", 1)
                    arr = doc.get(parent)
                    if not isinstance(arr, list):
                        continue
                    new_arr, touched = [], False
                    for item in arr:
                        if isinstance(item, dict) and isinstance(item.get(child), str):
                            nu = await convert(item[child])
                            if nu:
                                item = {**item, child: nu}
                                touched = True
                        new_arr.append(item)
                    if touched:
                        update[parent] = new_arr
                    continue

                val = doc.get(field)
                if isinstance(val, str):
                    nu = await convert(val)
                    if nu:
                        update[field] = nu
                elif isinstance(val, list):
                    new_list, touched = [], False
                    for u in val:
                        nu = await convert(u) if isinstance(u, str) else None
                        new_list.append(nu or u)
                        touched = touched or bool(nu)
                    if touched:
                        update[field] = new_list

            if update:
                key = {idf: doc.get(idf)} if idf != "_id" else {"_id": doc.get("_id", "main")}
                await db[coll].update_one(key, {"$set": update})
                changed_docs += 1
        if changed_docs:
            print(f"{coll}: updated {changed_docs} document(s)")

    print(f"\nDONE  migrated={moved}  already_permanent={skipped}  missing_local={missing}")
    if missing:
        print("Regenerate the missing ones from Admin → Generate Gallery & Certificate.")


if __name__ == "__main__":
    asyncio.run(main())
