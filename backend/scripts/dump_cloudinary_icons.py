"""
Dump recent Cloudinary uploads in the icon folders to a JSON file.

The auto-recovery script can't match by name because admin uploads use
random UUID public_ids. This dump lets the admin visually pair each URL
with the right slug and either:

  (a) re-link via the admin image-edit UI, OR
  (b) edit the resulting `lost_icons_map.json` and re-run
      `recover_lost_icons.py --apply-map`.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services import cloudinary_service as _cs  # noqa: E402
import cloudinary.api as capi  # noqa: E402


FOLDERS = [
    "celesta-glow/category",
    "celesta-glow/subcategory",
    "celesta-glow/concern",
]


async def main() -> None:
    db = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
        os.environ.get("DB_NAME", "test_database")
    ]
    if not await _cs.ensure_configured(db):
        print("Cloudinary not configured.")
        return
    dump = {}
    for folder in FOLDERS:
        rows = []
        cursor = None
        while True:
            kwargs = dict(
                type="upload", prefix=folder + "/", max_results=500,
                resource_type="image",
            )
            if cursor:
                kwargs["next_cursor"] = cursor
            try:
                res = capi.resources(**kwargs)
            except Exception as exc:
                print(f"list error {folder}: {exc}")
                break
            for a in res.get("resources") or []:
                rows.append({
                    "public_id": a.get("public_id"),
                    "secure_url": a.get("secure_url") or a.get("url"),
                    "created_at": a.get("created_at"),
                    "bytes": a.get("bytes"),
                    "format": a.get("format"),
                })
            cursor = res.get("next_cursor")
            if not cursor:
                break
        rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        dump[folder] = rows
        print(f"{folder}: {len(rows)} files (most recent first)")

    # Also list slugs that currently have no image so admin can match
    needs = {}
    for col in ("subcategories", "categories", "concerns"):
        ms = []
        async for d in db[col].find(
            {"$or": [{"image": ""}, {"image": None}, {"image": {"$exists": False}}]},
            {"_id": 0, "slug": 1, "name": 1},
        ):
            ms.append({"slug": d.get("slug"), "name": d.get("name")})
        needs[col] = ms
        print(f"missing-image {col}: {len(ms)}")

    out = {
        "cloudinary": dump,
        "missing": needs,
        "instructions": (
            "Each file below is a real image still living on Cloudinary. "
            "Open the secure_url in a browser to see the image. Then, in "
            "the admin panel, use the slug's image-edit UI and paste the "
            "URL — OR fill in the `manual_map` section below and run "
            "`python3 scripts/recover_lost_icons.py --apply-map "
            "scripts/lost_icons_map.json` to bulk re-link."
        ),
        "manual_map": {
            # Example — admin fills in:
            # "subcategories": {
            #   "barrier-repair-cream": "<paste secure_url here>",
            # },
        },
    }
    out_path = os.path.join(os.path.dirname(__file__), "lost_icons_map.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWritten → {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
