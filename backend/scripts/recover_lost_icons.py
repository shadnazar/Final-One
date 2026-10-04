"""
Recover admin-uploaded icons / banners that lost their DB URL reference.

The image files are still on Cloudinary (admin upload endpoint pushes them
there, only the DB row's `image` field got wiped by a stale restore).  This
script lists every recent Cloudinary asset in the folders admin uploads
typically use, then tries to match each asset back to a category /
subcategory / concern slug.

Strategy (no destructive writes):
  - For every subcategory / category / concern doc that has empty `image`,
    look for a Cloudinary file whose context (caption / alt) or public_id
    references the slug.
  - Also surface "orphan" Cloudinary files uploaded in the last 7 days that
    don't match any slug, so the admin can manually re-link them.

Run:
    python3 -m scripts.recover_lost_icons --dry      # see what would happen
    python3 -m scripts.recover_lost_icons            # apply matches
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services import cloudinary_service as _cs  # noqa: E402
import cloudinary  # noqa: E402
import cloudinary.api as capi  # noqa: E402


# Folders the admin upload endpoint and inline image editors use.
# Add to this list if you discover new folders by inspecting Cloudinary's
# media library directly.
RECOVERY_FOLDERS = [
    "celesta-glow",
    "celesta-glow/category",
    "celesta-glow/categories",
    "celesta-glow/subcategory",
    "celesta-glow/subcategories",
    "celesta-glow/concerns",
    "celesta-glow/concern",
    "celesta-glow/niches",
    "celesta-glow/icons",
]


def _slug_tokens(slug: str) -> List[str]:
    s = slug.replace("_", "-")
    return [t for t in s.split("-") if t]


def _match_score(public_id: str, slug: str) -> int:
    pid = public_id.lower()
    sl = slug.lower()
    score = 0
    if sl in pid:
        score += 100
    # Token-level match (e.g. slug "barrier-repair-cream" → tokens
    # match against "barrier_repair_cream_xyz" or "barrier-repair-...")
    toks = _slug_tokens(sl)
    matched = sum(1 for t in toks if t in pid)
    if matched == len(toks) and toks:
        score += 80
    elif matched >= max(1, len(toks) - 1):
        score += 40
    return score


async def list_cloudinary(folder: str) -> List[Dict]:
    out: List[Dict] = []
    next_cursor = None
    while True:
        kwargs = dict(
            type="upload",
            prefix=folder + "/",
            max_results=500,
            resource_type="image",
            context=True,
        )
        if next_cursor:
            kwargs["next_cursor"] = next_cursor
        try:
            res = capi.resources(**kwargs)
        except Exception as exc:
            print(f"  ! list error for {folder}: {exc}")
            break
        out.extend(res.get("resources") or [])
        next_cursor = res.get("next_cursor")
        if not next_cursor:
            break
    return out


async def recover(dry: bool = False, days: int = 14) -> None:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    db = AsyncIOMotorClient(mongo_url)[db_name]

    if not await _cs.ensure_configured(db):
        print("Cloudinary not configured.")
        return

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # 1. Fetch every Cloudinary file from the candidate folders
    print(f"Scanning Cloudinary for assets uploaded in the last {days} days …")
    all_assets: List[Dict] = []
    seen_public_ids = set()
    for folder in RECOVERY_FOLDERS:
        assets = await list_cloudinary(folder)
        for a in assets:
            if a.get("public_id") in seen_public_ids:
                continue
            created = a.get("created_at")
            if created:
                try:
                    if datetime.fromisoformat(created.replace("Z", "+00:00")) < cutoff:
                        continue
                except Exception:
                    pass
            seen_public_ids.add(a["public_id"])
            all_assets.append(a)
        print(f"  {folder}: {len(assets)} files seen")
    print(f"Total candidate assets within window: {len(all_assets)}\n")

    # 2. Walk each collection, try to re-link
    for col in ("subcategories", "categories", "concerns"):
        n_missing = await db[col].count_documents({
            "$or": [{"image": ""}, {"image": None}, {"image": {"$exists": False}}],
        })
        if n_missing == 0:
            print(f"--- {col}: all rows already have an image, skipping ---\n")
            continue
        print(f"--- {col}: {n_missing} rows missing image ---")
        async for doc in db[col].find(
            {"$or": [{"image": ""}, {"image": None}, {"image": {"$exists": False}}]},
            {"_id": 0, "slug": 1, "name": 1},
        ):
            slug = doc.get("slug")
            if not slug:
                continue
            best: Optional[Dict] = None
            best_score = 0
            for a in all_assets:
                score = _match_score(a.get("public_id", ""), slug)
                if score > best_score:
                    best = a
                    best_score = score
            if best and best_score >= 80:
                url = best.get("secure_url") or best.get("url")
                print(f"  {slug:38s} → {best['public_id']}  (score={best_score})")
                if not dry:
                    await db[col].update_one(
                        {"slug": slug},
                        {"$set": {"image": url,
                                  "updated_at": datetime.now(timezone.utc).isoformat()}},
                    )
                    # Mirror to the sibling collection (same-slug pattern used
                    # by the rest of the codebase).
                    sibling = "categories" if col == "subcategories" else (
                        "subcategories" if col == "categories" else None)
                    if sibling:
                        await db[sibling].update_one(
                            {"slug": slug, "$or": [{"image": ""}, {"image": None}]},
                            {"$set": {"image": url}},
                        )
            else:
                print(f"  {slug:38s} … no Cloudinary match (best score={best_score})")
        print()


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    # --apply-map <path>: read manual_map from JSON and re-link
    if "--apply-map" in sys.argv:
        import json as _json
        idx = sys.argv.index("--apply-map")
        path = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
        if not path or not os.path.exists(path):
            print("Usage: --apply-map <path-to-lost_icons_map.json>")
            sys.exit(1)
        async def _apply():
            data = _json.load(open(path))
            mapping = (data or {}).get("manual_map") or {}
            db = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
                os.environ.get("DB_NAME", "test_database")
            ]
            applied = 0
            for col, slug_to_url in mapping.items():
                if col not in ("subcategories", "categories", "concerns"):
                    continue
                for slug, url in (slug_to_url or {}).items():
                    if not url:
                        continue
                    res = await db[col].update_one(
                        {"slug": slug},
                        {"$set": {"image": url,
                                  "updated_at": datetime.now(timezone.utc).isoformat()}},
                    )
                    if res.matched_count:
                        applied += 1
                        print(f"  [{col}] {slug} ← {url[:70]}")
                        # Mirror to sibling collection (same-slug pattern)
                        sib = "categories" if col == "subcategories" else (
                            "subcategories" if col == "categories" else None)
                        if sib:
                            await db[sib].update_one(
                                {"slug": slug, "$or": [{"image": ""}, {"image": None}, {"image": {"$exists": False}}]},
                                {"$set": {"image": url}},
                            )
            print(f"\nApplied {applied} manual mappings.")
        asyncio.run(_apply())
    else:
        asyncio.run(recover(dry=dry))
