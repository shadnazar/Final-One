"""Taxonomy tombstones — survives redeploys.

When an admin deletes a concern, category, or subcategory, the slug is recorded
in `taxonomy_tombstones`. Seed scripts MUST consult this collection and skip any
tombstoned slug, otherwise re-running seed (which happens on every container
boot) silently resurrects the deleted item.

Tombstones are included in the catalog backup snapshot, so even a fresh pod with
an empty DB will refuse to re-seed slugs the admin previously deleted.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Iterable, Set


async def add_tombstone(db, kind: str, slug: str) -> None:
    """Record a deletion. Idempotent (upserts on the unique kind+slug pair)."""
    if not slug:
        return
    await db.taxonomy_tombstones.update_one(
        {"kind": kind, "slug": slug},
        {"$set": {"kind": kind, "slug": slug, "deleted_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def get_tombstoned_slugs(db, kind: str) -> Set[str]:
    """Return all slugs of `kind` (concern | category | subcategory) that
    are tombstoned. Used by seed scripts to skip resurrection."""
    cur = db.taxonomy_tombstones.find({"kind": kind}, {"_id": 0, "slug": 1})
    return {d["slug"] async for d in cur}


async def restore_tombstone(db, kind: str, slug: str) -> bool:
    """Admin override — let a slug be re-seedable again. Returns True if a
    tombstone was actually removed."""
    res = await db.taxonomy_tombstones.delete_one({"kind": kind, "slug": slug})
    return bool(res.deleted_count)


async def filter_out_tombstoned(db, kind: str, slugs: Iterable[str]) -> Set[str]:
    """Convenience helper: from a list of candidate slugs, drop tombstoned ones."""
    tombs = await get_tombstoned_slugs(db, kind)
    return {s for s in slugs if s not in tombs}
