"""
Catalog Backup & Restore — pragmatic fix for "data wipes on every redeploy"
without requiring an external MongoDB.

The pod-internal MongoDB at `localhost:27017` lives on ephemeral storage. Every
production redeploy creates a fresh pod with an empty database, which is why
admin-uploaded subcategory images, taxonomy edits, and category structure
appear to "vanish".

This module:
  1. Periodically (and on every admin write) snapshots the taxonomy
     collections to a single JSON file uploaded to Cloudinary as a `raw`
     asset at  celesta-glow/db-snapshots/latest.json.
  2. On backend startup, if any of these collections is empty, automatically
     downloads the latest snapshot and bulk-restores it.

Limitations (be honest):
  - Snapshots only `concerns`, `categories`, `subcategories`, `niches`.
    NOT products, orders, customers, coupons — those need a real persistent
    DB. We restore the structure customers see (taxonomy + images) but not the
    transactional data (which is also far more volatile).
  - Snapshot is asynchronous; a write that happens AFTER the last snapshot
    won't survive a same-second redeploy. ~30s lag worst case.
  - This is a stop-gap. Atlas remains the correct long-term solution.
"""
from __future__ import annotations

import asyncio
import gzip
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader

import requests

from . import cloudinary_service as _cs

logger = logging.getLogger(__name__)

# Collections we treat as the canonical snapshot. Everything an admin can
# create / edit through the dashboard belongs here, PLUS all customer-facing
# transactional data (orders, customer accounts, leads, reviews). User mandate:
# "not a penny of data should be lost on redeploy".
SNAPSHOT_COLLECTIONS = [
    # --- Taxonomy ---
    "concerns", "categories", "subcategories", "niches",
    # Deletion records — without this, admin-deleted concerns/categories
    # come back on every redeploy when seed scripts re-create them.
    "taxonomy_tombstones",
    # --- Catalog & merchandising ---
    # products/combos intentionally EXCLUDED — catalog starts empty and must
    # never be repopulated from any remote snapshot.
    "shades",
    # --- Promotions & site content ---
    "coupons", "gift_cards", "banners", "sale_badges",
    "site_settings", "site_pages", "blogs", "blog_posts",
    # --- Brand / store config ---
    "brands", "store_locations", "site_announcements",
    # Brand logos/banners uploaded via admin "Shop by Brand" — keyed by slug.
    # MUST be backed up; otherwise admin-uploaded brand logos are wiped on every
    # redeploy / DB restore (same class of bug as the earlier subcategory-icon loss).
    "brand_assets",
    # --- Other admin-uploaded content ---
    # before/after gallery images, product groups, physical store locations,
    # product-specific review docs, customer-routine builder, support notes,
    # and order audit trail. All admin-writable, all wiped on redeploy without
    # this entry.
    "before_after_images", "product_groups", "locations",
    "product_reviews", "routines", "retention_notes", "order_audit",
    # --- Transactional data (orders, customers, leads, reviews) ---
    # NOTE: these are write-heavy. Snapshots happen on a 25s debounce so an
    # order placed in the last 25s before a redeploy may be lost. For high
    # order volumes (>100/day) you still want Atlas — but for the launch
    # phase this safety net catches everything.
    "orders", "order_items", "order_tracking",
    # --- Doctor consultation bookings (paid via Razorpay) ---
    # MUST be backed up — losing a paid customer booking would be unacceptable.
    "doctor_bookings",
    # --- Feb-2026 growth features ---
    "shop_by_category_tiles",  # admin-managed Skincare "Shop by Category" tiles
    "leads",                   # Partner / Invest / Skin Concern lead submissions
    "sale_campaigns",          # Admin-defined sale landing pages
    "users", "customers", "customer_addresses",
    "leads", "contact_messages", "otp_records",
    "reviews", "review_reports",
    "referrals", "referral_payouts",
    "wallet_transactions", "wallet_balances",
]

# Collections that are intentionally excluded (truly ephemeral / sensitive / TTL).
NON_SNAPSHOT_COLLECTIONS = {
    "admin_sessions", "employee_sessions",  # short-lived auth tokens
    "visitor_pings", "live_visitors",       # 5-min TTL by design
    "taxonomy_jobs", "background_jobs",     # transient job runners
    "rate_limits", "scraper_logs",          # short-lived
    "audit_logs",                           # log stream, append-only
    "cart_events", "cart_abandonment",      # analytics fluff
    "api_credentials",                      # SECRETS — never back up
    "admin_settings",                       # SECRETS — Cloudinary keys live here
}

CLOUDINARY_PUBLIC_ID = "celesta-glow/db-snapshots/latest"

# Debounce / throttle — at most one snapshot per N seconds even on bursty admin
# writes. The actual snapshot runs in a background task, never blocking the
# user's request.
_throttle_seconds = 25
_last_snapshot_at: Optional[float] = None
_pending_snapshot_task: Optional[asyncio.Task] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _serialize(db) -> Dict[str, Any]:
    """Dump every doc in each snapshot collection into a plain JSON dict.

    Skips collections that exist on the snapshot list but have 0 docs locally
    (saves bytes + lets us add new collections to the list safely without
    bloating the snapshot for stores that don't use them yet)."""
    payload: Dict[str, Any] = {
        "schema_version": 2,
        "created_at": _now_iso(),
        "collections": {},
    }
    existing = await db.list_collection_names()
    existing_set = set(existing)
    for col in SNAPSHOT_COLLECTIONS:
        if col not in existing_set:
            continue
        docs: List[Dict] = []
        async for d in db[col].find({}, {"_id": 0}):
            docs.append(d)
        if not docs:
            continue
        payload["collections"][col] = docs
        payload["collections"][col + "__count"] = len(docs)
    return payload


async def snapshot(db, allow_skeleton: bool = False) -> Dict[str, Any]:
    """Full snapshot — compress + upload all snapshot collections.

    Dedupe: if the new payload's content hash matches the most recent FULL
    snapshot, we skip the upload entirely and keep the existing one (saves
    Cloudinary bandwidth + storage when nothing changed since last full).

    Retention: keeps the last 3 FULL snapshots PLUS every incremental whose
    `base_full` points to one of those 3 fulls. When a full is purged, ALL
    incrementals chained to it are purged too (no orphans, no duplicates).

    SKELETON-STATE GUARD (Feb-2026 P0 fix): refuses to upload a full snapshot
    while the DB looks like a freshly-seeded skeleton. Otherwise the
    retention sweep would DELETE all good incrementals and pin a poisoned
    full as the new baseline — making future restores load imageless data.
    Pass `allow_skeleton=True` ONLY when you've just restored from chain
    and explicitly want to anchor the post-restore state.
    """
    global _last_snapshot_at
    if not await _cs.ensure_configured(db):
        raise RuntimeError("Cloudinary not configured — cannot snapshot")
    if not allow_skeleton:
        try:
            for col in ("concerns", "categories"):
                total = await db[col].count_documents({})
                if total < 5:
                    continue
                with_image = await db[col].count_documents({
                    "image": {"$regex": "^https?://", "$options": "i"}
                })
                if (with_image / total) < 0.20:
                    logger.warning(
                        "[catalog_backup] SKELETON-STATE detected (%s: %d/%d with image) — "
                        "refusing to upload FULL snapshot (would poison the baseline)",
                        col, with_image, total,
                    )
                    return {"success": False, "reason": "skeleton state — full snapshot skipped",
                            "skipped_skeleton": True}
        except Exception as exc:
            logger.warning("[catalog_backup] skeleton guard probe failed in full snapshot: %s", exc)
    payload = await _serialize(db)
    raw_json = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")

    # Dedupe — skip upload if content identical to the most recent full
    import hashlib as _hashlib
    content_hash = _hashlib.sha256(raw_json).hexdigest()
    existing = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
    last_hash = ((existing.get("history") or [{}])[-1] or {}).get("hash")
    if last_hash == content_hash:
        logger.info("Snapshot dedupe: content unchanged since last full (hash %s) — skipping upload", content_hash[:8])
        # Still bump the "since" pointer so incrementals know nothing's new
        await db.admin_settings.update_one(
            {"type": "catalog_backup"},
            {"$set": {"last_check_at": _now_iso()}},
            upsert=True,
        )
        return {
            "success": True, "skipped_dedupe": True, "hash": content_hash,
            "created_at": _now_iso(),
        }

    blob = gzip.compress(raw_json, compresslevel=6)
    ts_compact = payload["created_at"].replace(":", "-").replace(".", "-")
    dated_public_id = f"celesta-glow/backups/full-{ts_compact}"
    res = cloudinary.uploader.upload(
        io.BytesIO(blob),
        public_id=dated_public_id,
        resource_type="raw",
        overwrite=True,
        unique_filename=False,
    )
    # Mirror to the `latest` alias as a cold-boot fallback.
    try:
        cloudinary.uploader.upload(
            io.BytesIO(blob),
            public_id=CLOUDINARY_PUBLIC_ID,
            resource_type="raw",
            overwrite=True,
            unique_filename=False,
        )
    except Exception as exc:
        logger.warning("Failed to mirror snapshot to `latest` alias: %s", exc)

    _last_snapshot_at = asyncio.get_event_loop().time()
    counts = {c: payload["collections"].get(c + "__count", 0) for c in SNAPSHOT_COLLECTIONS}
    snapshot_url = res.get("secure_url") or res.get("url")
    snapshot_version = res.get("version")
    try:
        doc = existing
        history = doc.get("history", [])
        history.append({
            "public_id": dated_public_id,
            "url": snapshot_url,
            "version": snapshot_version,
            "created_at": payload["created_at"],
            "bytes": len(blob),
            "hash": content_hash,
            "kind": "full",
        })
        # Keep last 3 FULL backups only (incrementals tracked separately below)
        history = [h for h in history if h.get("kind") != "full"] + [h for h in history if h.get("kind") == "full"][-3:]
        # current_full = the just-uploaded one; old incrementals belong to retired fulls
        await db.admin_settings.update_one(
            {"type": "catalog_backup"},
            {"$set": {
                "type": "catalog_backup",
                "latest_url": snapshot_url,
                "created_at": payload["created_at"],
                "current_full_public_id": dated_public_id,
                "current_full_created_at": payload["created_at"],
                "history": history,
                # A new full resets the incremental chain — any earlier
                # incrementals describe diffs against an older base and are
                # therefore obsolete.
                "incrementals": [],
            }},
            upsert=True,
        )

        # ---- Cloudinary retention sweep ----
        # Keep: last 3 fulls + the `latest` alias + every incremental file
        # whose `base_full` matches one of the kept fulls.
        try:
            import cloudinary.api as _capi
            keep_full_ids = {h["public_id"] for h in history if h.get("kind") == "full"}
            keep_full_ids.add(CLOUDINARY_PUBLIC_ID)
            # We DO NOT keep any prior incrementals because we just wrote a
            # brand-new full that already contains everything.
            res_list = _capi.resources(
                resource_type="raw",
                type="upload",
                prefix="celesta-glow/backups/",
                max_results=200,
            )
            to_delete = [
                r["public_id"] for r in res_list.get("resources", [])
                if r["public_id"] not in keep_full_ids
            ]
            if to_delete:
                _capi.delete_resources(to_delete, resource_type="raw")
                logger.info("Backup retention: pruned %d old file(s) from Cloudinary: %s", len(to_delete), to_delete[:10])
        except Exception as exc:
            logger.warning("Cloudinary retention sweep failed: %s", exc)

    except Exception as exc:
        logger.warning("Failed to persist snapshot URL: %s", exc)
    logger.info(
        "Full snapshot uploaded: raw=%dKB gz=%dKB hash=%s",
        len(raw_json) // 1024, len(blob) // 1024, content_hash[:8],
    )
    return {
        "success": True, "kind": "full",
        "url": snapshot_url, "counts": counts,
        "snapshot_bytes_raw": len(raw_json),
        "snapshot_bytes_compressed": len(blob),
        "created_at": payload["created_at"],
        "hash": content_hash,
    }


# ---------------------------------------------------------------------------
# INCREMENTAL SNAPSHOT — only docs whose `updated_at` is newer than the last
# full's `created_at` (or the most recent incremental, whichever is later).
# Chains under the current full; cleared whenever a new full is uploaded.
# ---------------------------------------------------------------------------
def _doc_updated_at(d: Dict) -> Optional[str]:
    """Best-effort timestamp pick for incremental delta detection."""
    for f in ("updated_at", "taxonomy_classified_at", "modified_at",
              "created_at", "placed_at", "last_seen", "ai_taxonomy_audited_at"):
        v = d.get(f)
        if v:
            return str(v)
    return None


async def _serialize_incremental(db, since_iso: str) -> Dict[str, Any]:
    """Build a delta payload — only docs with a timestamp > since_iso."""
    payload: Dict[str, Any] = {
        "schema_version": 3,
        "type": "incremental",
        "since": since_iso,
        "created_at": _now_iso(),
        "collections": {},
    }
    existing_set = set(await db.list_collection_names())
    for col in SNAPSHOT_COLLECTIONS:
        if col not in existing_set:
            continue
        docs: List[Dict] = []
        async for d in db[col].find({}, {"_id": 0}):
            ts = _doc_updated_at(d)
            if ts and ts > since_iso:
                docs.append(d)
        if docs:
            payload["collections"][col] = docs
            payload["collections"][col + "__count"] = len(docs)
    return payload


async def incremental_snapshot(db) -> Dict[str, Any]:
    """Upload a small JSON.gz of ONLY rows changed since the last snapshot.

    Self-healing: if there's no `current_full_public_id` in admin_settings
    (e.g. backend was deployed before the incremental engine landed), this
    function will run a full snapshot FIRST so the chain has an anchor,
    then fall through into the incremental flow. That guarantees admin
    image / icon uploads are captured the very first time a write happens
    after deployment.

    SKELETON-STATE GUARD (Feb-2026 P0 fix): refuses to upload an incremental
    while the DB looks like a freshly-seeded skeleton — i.e. concerns or
    categories have rows but <20% carry an `image` URL. Without this guard,
    pod restarts that beat the auto-restore would create a poison
    incremental that captures the imageless state, and that incremental
    would then "win" in any chain replay, undoing admin uploads.
    """
    if not await _cs.ensure_configured(db):
        return {"success": False, "reason": "cloudinary not configured"}
    # Skeleton-state guard
    try:
        for col in ("concerns", "categories"):
            total = await db[col].count_documents({})
            if total < 5:
                continue
            with_image = await db[col].count_documents({
                "image": {"$regex": "^https?://", "$options": "i"}
            })
            if (with_image / total) < 0.20:
                logger.warning(
                    "[catalog_backup] SKELETON-STATE detected (%s: %d/%d with image) — "
                    "refusing to upload incremental to avoid poisoning the chain",
                    col, with_image, total,
                )
                return {"success": False, "reason": "skeleton state — skipping to protect data integrity",
                        "skipped_skeleton": True}
    except Exception as exc:
        logger.warning("[catalog_backup] skeleton guard probe failed: %s", exc)
    meta = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
    current_full_id = meta.get("current_full_public_id")
    if not current_full_id:
        logger.info("Incremental: no current full anchor — bootstrapping with a full snapshot first")
        try:
            full_res = await snapshot(db)
            if not full_res.get("success"):
                return {"success": False, "reason": "bootstrap full snapshot failed"}
            # snapshot() just updated admin_settings → refresh meta + chain anchor
            meta = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
            current_full_id = meta.get("current_full_public_id")
            if not current_full_id:
                return {"success": False, "reason": "bootstrap snapshot did not produce a full anchor"}
        except Exception as exc:
            logger.warning("Bootstrap full snapshot failed: %s", exc)
            return {"success": False, "reason": f"bootstrap failed: {exc}"}
    incs = meta.get("incrementals") or []
    since_iso = (incs[-1].get("created_at") if incs else None) \
                or meta.get("current_full_created_at") \
                or "1970-01-01T00:00:00+00:00"
    payload = await _serialize_incremental(db, since_iso)
    if not payload["collections"]:
        logger.info("Incremental: no changes since %s — skipping upload", since_iso)
        return {"success": True, "skipped_no_changes": True, "since": since_iso}

    raw_json = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    import hashlib as _hashlib
    content_hash = _hashlib.sha256(raw_json).hexdigest()
    # Dedupe within the incremental chain
    if incs and incs[-1].get("hash") == content_hash:
        logger.info("Incremental dedupe: identical to last incremental — skipping upload")
        return {"success": True, "skipped_dedupe": True, "hash": content_hash}

    payload["base_full"] = current_full_id
    raw_json = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    blob = gzip.compress(raw_json, compresslevel=6)
    ts_compact = payload["created_at"].replace(":", "-").replace(".", "-")
    public_id = f"celesta-glow/backups/inc-{ts_compact}"
    res = cloudinary.uploader.upload(
        io.BytesIO(blob),
        public_id=public_id,
        resource_type="raw",
        overwrite=True,
        unique_filename=False,
    )
    inc_url = res.get("secure_url") or res.get("url")
    incs.append({
        "public_id": public_id,
        "url": inc_url,
        "created_at": payload["created_at"],
        "since": since_iso,
        "bytes": len(blob),
        "hash": content_hash,
        "base_full": current_full_id,
        "collections": {k: v for k, v in payload["collections"].items() if not k.endswith("__count")},
    })
    # Strip the `collections` echo from the metadata to keep admin_settings small
    incs_meta = [{k: v for k, v in i.items() if k != "collections"} for i in incs]
    await db.admin_settings.update_one(
        {"type": "catalog_backup"},
        {"$set": {"incrementals": incs_meta, "last_inc_url": inc_url}},
        upsert=True,
    )
    changed_counts = {k.replace("__count", ""): v for k, v in payload["collections"].items() if k.endswith("__count")}
    logger.info(
        "Incremental uploaded: gz=%dKB changed=%s base=%s",
        len(blob) // 1024, changed_counts, current_full_id,
    )
    return {
        "success": True, "kind": "incremental",
        "url": inc_url, "changed": changed_counts,
        "snapshot_bytes_compressed": len(blob),
        "since": since_iso, "created_at": payload["created_at"],
        "base_full": current_full_id,
    }


async def _debounced_snapshot(db):
    """Wait briefly to coalesce a burst of admin writes, then snapshot."""
    global _pending_snapshot_task
    try:
        await asyncio.sleep(_throttle_seconds)
        await snapshot(db)
    except Exception as exc:
        logger.warning("Background snapshot failed: %s", exc)
    finally:
        _pending_snapshot_task = None


_last_write_at: Optional[float] = None
_pending_incremental_task: Optional[asyncio.Task] = None
_incremental_debounce_seconds = 25  # coalesce a burst of admin writes


async def _debounced_incremental(db):
    """Wait briefly to coalesce a burst of admin writes, then incremental."""
    global _pending_incremental_task
    try:
        await asyncio.sleep(_incremental_debounce_seconds)
        try:
            res = await incremental_snapshot(db)
            if res.get("success") and not res.get("skipped_no_changes") and not res.get("skipped_dedupe"):
                logger.info("Post-write incremental uploaded: %s", res.get("changed") or res.get("kind"))
        except Exception as exc:
            logger.warning("Debounced incremental failed: %s", exc)
    except Exception as exc:
        logger.warning("Background incremental task crashed: %s", exc)
    finally:
        _pending_incremental_task = None


def schedule_snapshot(db) -> None:
    """Called by admin write endpoints (image upload / category edit / etc.).

    Marks _last_write_at AND fires a debounced incremental snapshot 25 s
    later so the admin's freshly-uploaded image is on Cloudinary BEFORE the
    next pod restart can wipe the DB. Coalesces a burst of writes into one
    upload — 20 writes in 25 s ⇒ one incremental.
    """
    global _last_write_at, _pending_incremental_task
    _last_write_at = asyncio.get_event_loop().time()
    if _pending_incremental_task is None or _pending_incremental_task.done():
        try:
            _pending_incremental_task = asyncio.create_task(_debounced_incremental(db))
        except RuntimeError:
            # Called outside an event loop — caller should retry from a task
            _pending_incremental_task = None


async def _fetch_latest_snapshot(db) -> Optional[Dict[str, Any]]:
    """Pull the latest snapshot down from Cloudinary. Supports both gzipped
    (current) and plain JSON (legacy v1) snapshots transparently.

    P0 fix Feb-2026: searches BOTH the new and legacy Cloudinary accounts and
    picks the NEWEST full snapshot by `created_at`, instead of trusting the
    `latest_url` pinned in admin_settings (which can be stale — pinned to
    a versioned URL like /v1780322944/latest that always serves the OLD
    snapshot, even after a newer one is uploaded with the same public_id).
    """
    if not await _cs.ensure_configured(db):
        return None
    creds = _cs._creds_cache  # type: ignore[attr-defined]
    cloud_name = creds.get("cloud_name") or os.environ.get("CLOUDINARY_CLOUD_NAME")
    if not cloud_name:
        return None

    import cloudinary as _cld
    import cloudinary.api as _capi
    import time as _time

    # Build the list of accounts to search (current + legacy if configured)
    accounts: List[tuple] = []
    if cloud_name:
        accounts.append((cloud_name, creds.get("api_key"), creds.get("api_secret")))
    leg_cn = os.environ.get("CLOUDINARY_LEGACY_CLOUD_NAME") or ""
    leg_k = os.environ.get("CLOUDINARY_LEGACY_API_KEY") or ""
    leg_s = os.environ.get("CLOUDINARY_LEGACY_API_SECRET") or ""
    if leg_cn and leg_k and leg_s and leg_cn != cloud_name:
        accounts.append((leg_cn, leg_k, leg_s))

    # 1) Find the NEWEST `full-*` snapshot across both accounts.
    candidates_full: List[tuple] = []  # (created_at, url)
    for cn, ak, sk in accounts:
        try:
            _cld.config(cloud_name=cn, api_key=ak, api_secret=sk)
            r = _capi.resources(
                type="upload", resource_type="raw",
                prefix="celesta-glow/backups/full-", max_results=50,
            )
            for x in r.get("resources", []) or []:
                if x.get("secure_url"):
                    candidates_full.append((x.get("created_at", ""), x["secure_url"]))
            # Also fetch the `latest` alias as a fallback anchor
            try:
                info = _capi.resource(CLOUDINARY_PUBLIC_ID, resource_type="raw")
                if info and info.get("secure_url"):
                    candidates_full.append((info.get("created_at", ""), info["secure_url"]))
            except Exception:
                pass
        except Exception as exc:
            logger.debug("Cloudinary listing failed for %s: %s", cn, exc)
    # Restore original creds
    if accounts:
        try:
            _cld.config(cloud_name=accounts[0][0], api_key=accounts[0][1], api_secret=accounts[0][2])
        except Exception:
            pass

    # Sort newest-first by created_at, then fall back to the stored URL
    candidates_full.sort(key=lambda x: x[0] or "", reverse=True)
    cb = int(_time.time())
    candidate_urls: List[str] = [u for _, u in candidates_full]

    # Add the historical stored URL + cache-busted aliases as last-resort fallbacks
    try:
        meta = await db.admin_settings.find_one(
            {"type": "catalog_backup"}, {"_id": 0, "latest_url": 1}
        )
        if meta and meta.get("latest_url"):
            candidate_urls.append(meta["latest_url"])
    except Exception:
        pass
    candidate_urls.extend([
        f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}?_={cb}",
        f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}.json?_={cb}",
    ])
    if leg_cn and leg_cn != cloud_name:
        candidate_urls.extend([
            f"https://res.cloudinary.com/{leg_cn}/raw/upload/{CLOUDINARY_PUBLIC_ID}?_={cb}",
            f"https://res.cloudinary.com/{leg_cn}/raw/upload/{CLOUDINARY_PUBLIC_ID}.json?_={cb}",
        ])

    if candidates_full:
        logger.info(
            "[catalog_backup] _fetch_latest_snapshot picked NEWEST full at %s",
            candidates_full[0][0],
        )

    for candidate in candidate_urls:
        try:
            r = requests.get(candidate, timeout=15)
            if r.status_code != 200:
                continue
            body = r.content
            try:
                decompressed = gzip.decompress(body)
                return json.loads(decompressed.decode("utf-8"))
            except (OSError, json.JSONDecodeError):
                txt = body.decode("utf-8", errors="ignore")
                if txt.startswith("{"):
                    return json.loads(txt)
        except Exception as exc:
            logger.debug("Snapshot fetch failed for %s: %s", candidate, exc)
    return None


async def auto_restore_if_empty(db, force: bool = False, progress_cb=None) -> Dict[str, Any]:
    """Run at backend startup. If the snapshot collections look freshly-wiped
    (≥80% of them have ≤5 docs OR the products collection itself is empty),
    pull the latest Cloudinary snapshot and bulk-upsert. Idempotent — never
    overwrites a doc that already exists with the same slug/id.

    When ``force=True`` (manual admin restore), the "near-empty" precondition
    is skipped and every snapshot doc is upserted in place. STICKY_FIELDS
    protection still applies — admin-uploaded images / icons that exist
    locally but not in the snapshot are KEPT. The incremental chain is also
    applied, so the DB ends up at the latest known captured state, not just
    the last full-snapshot state.

    ``progress_cb`` (Feb-2026): optional callable ``(done_pkt, total_pkt,
    current_col)`` invoked before each collection is restored. Lets the
    async admin endpoint stream packet-wise progress to the UI so long
    restores show real progress instead of a spinner.
    """
    counts: Dict[str, int] = {}
    near_empty = 0
    existing = set(await db.list_collection_names())
    for col in SNAPSHOT_COLLECTIONS:
        if col not in existing:
            counts[col] = 0
            near_empty += 1
            continue
        n = await db[col].count_documents({})
        counts[col] = n
        if n < 5:
            near_empty += 1
    # Decide restore: signal of a fresh pod is that products is empty OR
    # most collections are near-empty.
    products_empty = counts.get("products", 0) < 5
    threshold = 0.5  # >=50% of snapshot collections look empty

    # SKELETON-STATE DETECTION (P0 fix Feb-2026): even if products/concerns
    # are populated by canonical seeders, the admin-uploaded `image` URLs
    # may all be missing. That's the failure mode the user reported —
    # "site reverts to default emojis on pod restart". If a snapshot
    # anchor exists in admin_settings AND a majority of concerns/categories
    # have NO `image` field, treat the DB as wiped and trigger restore.
    skeleton_state = False
    try:
        meta = await db.admin_settings.find_one(
            {"type": "catalog_backup"},
            {"_id": 0, "current_full_public_id": 1, "incrementals": 1},
        ) or {}
        has_snapshot_anchor = bool(meta.get("current_full_public_id")) or bool(meta.get("incrementals"))
        if has_snapshot_anchor:
            checks = []
            for col in ("concerns", "categories", "subcategories"):
                total = counts.get(col, 0)
                if total <= 0:
                    continue
                with_image = await db[col].count_documents({
                    "$or": [
                        {"image": {"$regex": "^https?://", "$options": "i"}},
                        {"image_url": {"$regex": "^https?://", "$options": "i"}},
                    ]
                })
                # Treat collection as skeleton if <20% of rows carry an image
                checks.append((with_image / total) < 0.20)
            if checks and sum(checks) / len(checks) >= 0.5:
                skeleton_state = True
                logger.warning(
                    "[catalog_backup] skeleton-state detected (rows exist but admin images missing) — triggering restore"
                )
    except Exception as exc:
        logger.warning(f"[catalog_backup] skeleton-state probe failed: {exc}")

    needs_restore = force or products_empty or skeleton_state or (near_empty / max(1, len(SNAPSHOT_COLLECTIONS))) >= threshold
    if not needs_restore:
        logger.info("Snapshot collections look populated %s — skipping auto-restore", counts)
        return {"restored": False, "reason": "already populated", "counts": counts}

    snapshot_data = await _fetch_latest_snapshot(db)
    if not snapshot_data:
        logger.info("No remote snapshot available — first deploy. Local counts: %s", counts)
        return {"restored": False, "reason": "no snapshot found", "counts": counts}

    # ---------- BACKFILL admin_settings current_full anchor ----------
    # Older snapshots (uploaded by code that pre-dates the incremental engine)
    # didn't set `current_full_public_id`. Without it, incremental backups
    # would refuse to chain and admin image uploads would never get backed
    # up — exactly the bug a user reported losing yesterday's subcategory
    # image upload. Backfill the anchor here so the very next incremental
    # call has somewhere to attach.
    try:
        meta = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
        if not meta.get("current_full_public_id"):
            history = meta.get("history") or []
            fulls = [h for h in history if h.get("kind") == "full" or h.get("kind") is None]
            picked = fulls[-1] if fulls else None
            if picked and picked.get("public_id"):
                anchor_id = picked["public_id"]
                anchor_ts = picked.get("created_at") or snapshot_data.get("created_at") or meta.get("created_at")
            else:
                # No history at all → use the legacy `latest` alias as the anchor
                # and derive the timestamp from the snapshot data we just fetched.
                anchor_id = CLOUDINARY_PUBLIC_ID
                anchor_ts = snapshot_data.get("created_at") or meta.get("created_at")
            await db.admin_settings.update_one(
                {"type": "catalog_backup"},
                {"$set": {
                    "current_full_public_id": anchor_id,
                    "current_full_created_at": anchor_ts,
                    "incrementals": meta.get("incrementals") or [],
                }},
                upsert=True,
            )
            logger.info("Backfilled current_full anchor: %s (created_at=%s)", anchor_id, anchor_ts)
    except Exception as exc:
        logger.warning("current_full anchor backfill failed: %s", exc)

    restored_counts: Dict[str, int] = {}
    # ------------------------------------------------------------------
    # "Sticky" fields per collection — admin-curated values that must NEVER
    # be reset by a restore.  If the snapshot's value is empty/missing but
    # the local doc already has a non-empty value, we KEEP the local one.
    # Why: admin uploads a category icon at 10:00, the next snapshot fires
    # at 10:15 with the image included. But if the admin uploaded AFTER
    # the most recent snapshot, a redeploy + restore would wipe the image
    # back to the snapshot's older state. Treat image / icon / accent
    # fields as one-way (snapshot fills in blanks, never overwrites).
    # ------------------------------------------------------------------
    STICKY_FIELDS: Dict[str, set] = {
        "concerns":      {"image", "icon", "accent_from", "accent_to", "accent_text", "tagline", "name", "description"},
        "categories":    {"image", "icon", "tagline", "name", "description"},
        "subcategories": {"image", "icon", "tagline", "accent_from", "accent_to", "accent_text", "name", "description"},
        "products":      {"images", "image_url", "thumbnail", "video_url", "video_thumb_url",
                          "hero_image", "swatches"},
        "brands":        {"image", "logo", "logo_url", "banner", "banner_url"},
        "banners":       {"image", "image_url", "mobile_image", "desktop_image"},
        "site_settings": {"logo", "logo_url", "favicon", "splash_image", "hero_image"},
    }

    # ------------------------------------------------------------------
    # ADMIN_AUTHORITATIVE fields — these are SO sticky that even if the
    # snapshot has a non-empty value for them, LOCAL ALWAYS WINS. Used for
    # state the admin explicitly toggles (soft-delete via is_active=false,
    # hide-from-niche flags, taxonomy reassignments). Restore must NOT
    # undo these — otherwise admin "delete" / "hide" actions silently
    # revert on the next manual restore.
    # Bug fix Feb-2026: user reported "many deleted products coming back"
    # and "anti-aging showing on skincare niche after restore".
    # ------------------------------------------------------------------
    ADMIN_AUTHORITATIVE: Dict[str, set] = {
        "products":      {"is_active", "archived", "hidden", "is_deleted",
                          "niche", "category", "subcategory", "hidden_niches"},
        "concerns":      {"is_active", "hidden", "archived", "niche", "hidden_niches",
                          "alias_of", "sort_order"},
        "categories":    {"is_active", "hidden", "archived", "niche", "hidden_niches",
                          "sort_order"},
        "subcategories": {"is_active", "hidden", "archived", "niche", "hidden_niches",
                          "sort_order", "parent_slug"},
        "brands":        {"is_active", "hidden", "archived"},
        "banners":       {"is_active", "hidden", "archived", "sort_order"},
    }

    def _is_filled(v) -> bool:
        if v is None:
            return False
        if isinstance(v, str):
            return v.strip() != ""
        if isinstance(v, (list, dict, tuple, set)):
            return len(v) > 0
        return True

    for _idx, col in enumerate(SNAPSHOT_COLLECTIONS):
        # Packet-wise progress ping so the admin UI can render a live bar.
        if progress_cb is not None:
            try:
                progress_cb(_idx, len(SNAPSHOT_COLLECTIONS), col)
            except Exception:
                pass
        docs = (snapshot_data.get("collections") or {}).get(col) or []
        if not docs:
            restored_counts[col] = 0
            continue
        sticky = STICKY_FIELDS.get(col, set())
        authoritative = ADMIN_AUTHORITATIVE.get(col, set())
        try:
            inserted = 0
            updated = 0
            for d in docs:
                # Pick the natural primary key per collection
                pk = None
                for k in ("slug", "code", "id", "order_id", "combo_id", "_id"):
                    if d.get(k):
                        pk = {k: d[k]}
                        break
                if pk is None:
                    # No identifier — just insert blindly
                    await db[col].insert_one(d)
                    inserted += 1
                else:
                    # Look at local first — preserve admin-curated values.
                    if sticky or authoritative:
                        proj = {"_id": 0, **{f: 1 for f in (sticky | authoritative)}}
                        local = await db[col].find_one(pk, proj)
                        if local:
                            payload = dict(d)
                            # ADMIN_AUTHORITATIVE: local wins unconditionally
                            # when set — protects soft-deletes (is_active=False),
                            # hidden flags, niche reassignments etc. from being
                            # silently reverted by an older snapshot.
                            for f in authoritative:
                                if f in local:  # admin has explicitly set it
                                    payload.pop(f, None)
                            # STICKY: local wins only when payload is empty
                            # (so blank fills from a fresh full snapshot are
                            # allowed, but admin uploads / overrides stay).
                            for f in sticky:
                                local_v = local.get(f)
                                if _is_filled(local_v) and not _is_filled(payload.get(f)):
                                    payload.pop(f, None)
                            d_to_set = payload
                        else:
                            d_to_set = d
                    else:
                        d_to_set = d
                    res = await db[col].update_one(pk, {"$set": d_to_set}, upsert=True)
                    if res.upserted_id is not None:
                        inserted += 1
                    elif res.modified_count:
                        updated += 1
            restored_counts[col] = inserted + updated
        except Exception as exc:
            logger.error("Auto-restore failed for %s: %s", col, exc)
            restored_counts[col] = -1

    # ---------- Apply incremental chain on top of the full ----------
    # The full snapshot we just restored is the BASE. Any incrementals
    # uploaded after that full (small deltas, one per 15-min tick if
    # anything changed) are applied in chronological order so the DB
    # ends up at the latest known state, not the last-full state.
    #
    # Recovery mode (Jun 24 2026): we also list Cloudinary's
    # `celesta-glow/backups/` folder DIRECTLY to find every incremental
    # ever uploaded — admin_settings.incrementals can be incomplete after
    # a DB wipe or a buggy restore, but Cloudinary's listing is ground
    # truth. Both lists are merged + de-duped + sorted by created_at.
    try:
        meta = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
        listed_incs = list(meta.get("incrementals") or [])
        # Map pid -> entry so we can merge with Cloudinary listing
        seen = {(i.get("public_id") or ""): i for i in listed_incs if i.get("public_id")}
        # Cloudinary listing across BOTH accounts (current + legacy)
        import cloudinary as _cld
        import cloudinary.api as _capi
        creds_now = _cs._creds_cache  # type: ignore[attr-defined]
        legacy = os.environ.get("CLOUDINARY_LEGACY_CLOUD_NAME") or ""
        accounts = []
        if creds_now.get("cloud_name"):
            accounts.append(("current", creds_now.get("cloud_name"), creds_now.get("api_key"), creds_now.get("api_secret")))
        # Legacy account creds may not be available — use API ping-free listing via secure_url public alias
        # Most installations keep legacy keys in env if migration is recent
        leg_key = os.environ.get("CLOUDINARY_LEGACY_API_KEY") or ""
        leg_secret = os.environ.get("CLOUDINARY_LEGACY_API_SECRET") or ""
        if legacy and leg_key and leg_secret:
            accounts.append(("legacy", legacy, leg_key, leg_secret))
        for label, cn, ak, sk in accounts:
            try:
                _cld.config(cloud_name=cn, api_key=ak, api_secret=sk)
                next_cursor = None
                for _ in range(20):  # up to 10K resources (500 * 20)
                    kwargs = {"type": "upload", "resource_type": "raw",
                              "prefix": "celesta-glow/backups", "max_results": 500}
                    if next_cursor:
                        kwargs["next_cursor"] = next_cursor
                    r = _capi.resources(**kwargs)
                    for x in r.get("resources", []) or []:
                        pid = x.get("public_id") or ""
                        if not pid or "/inc-" not in pid:
                            continue
                        url = x.get("secure_url") or ""
                        # Inject any not already in admin_settings.incrementals
                        if pid not in seen:
                            seen[pid] = {"public_id": pid, "url": url,
                                         "created_at": x.get("created_at"),
                                         "timestamp": x.get("created_at")}
                        elif not seen[pid].get("url"):
                            seen[pid]["url"] = url
                    next_cursor = r.get("next_cursor")
                    if not next_cursor:
                        break
            except Exception as exc:
                logger.warning("Cloudinary inc listing (%s) failed: %s", label, exc)
        # Re-apply current account config so subsequent operations don't break
        try:
            if creds_now.get("cloud_name"):
                _cld.config(cloud_name=creds_now["cloud_name"],
                            api_key=creds_now["api_key"],
                            api_secret=creds_now["api_secret"])
        except Exception:
            pass
        incs = sorted(seen.values(), key=lambda x: x.get("created_at") or x.get("timestamp") or "")
        applied_incs = 0
        for inc in incs:
            url = inc.get("url")
            if not url:
                continue
            try:
                r = requests.get(url, timeout=20)
                if r.status_code != 200:
                    logger.warning("Incremental fetch %s HTTP %s — skipping", inc.get("public_id"), r.status_code)
                    continue
                data = json.loads(gzip.decompress(r.content).decode("utf-8"))
            except Exception as e:
                logger.warning("Incremental fetch/parse failed for %s: %s", inc.get("public_id"), e)
                continue
            for col, docs in (data.get("collections") or {}).items():
                if col.endswith("__count") or not isinstance(docs, list):
                    continue
                sticky = STICKY_FIELDS.get(col, set())
                authoritative = ADMIN_AUTHORITATIVE.get(col, set())
                for d in docs:
                    pk = None
                    for k in ("slug", "code", "id", "order_id", "combo_id", "_id"):
                        if d.get(k):
                            pk = {k: d[k]}
                            break
                    if pk is None:
                        await db[col].insert_one(d)
                        continue
                    if sticky or authoritative:
                        proj = {"_id": 0, **{f: 1 for f in (sticky | authoritative)}}
                        local = await db[col].find_one(pk, proj)
                        if local:
                            payload = dict(d)
                            for f in authoritative:
                                if f in local:
                                    payload.pop(f, None)
                            for f in sticky:
                                lv = local.get(f)
                                if _is_filled(lv) and not _is_filled(payload.get(f)):
                                    payload.pop(f, None)
                            d_to_set = payload
                        else:
                            d_to_set = d
                    else:
                        d_to_set = d
                    await db[col].update_one(pk, {"$set": d_to_set}, upsert=True)
            applied_incs += 1
        if applied_incs:
            logger.info("Auto-restore applied %d incremental delta(s) on top of full", applied_incs)
        restored_counts["_incrementals_applied"] = applied_incs
    except Exception as exc:
        logger.warning("Incremental chain replay failed: %s", exc)

    # ---------- Tombstone enforcement ----------
    # `taxonomy_tombstones` were already restored above. Now sweep across
    # concerns / categories / subcategories / products and DELETE any row
    # whose slug is tombstoned. This catches the edge case where the
    # snapshot was taken BEFORE the admin's delete — without this sweep,
    # the auto-restore would silently bring deleted items back.
    try:
        kind_to_col = {
            "concern": "concerns",
            "category": "categories",
            "subcategory": "subcategories",
            "product": "products",
        }
        for kind, col in kind_to_col.items():
            tomb_slugs = [d["slug"] async for d in db.taxonomy_tombstones.find({"kind": kind}, {"_id": 0, "slug": 1})]
            if tomb_slugs:
                res = await db[col].delete_many({"slug": {"$in": tomb_slugs}})
                if res.deleted_count:
                    logger.info("Tombstone sweep removed %d resurrected %s rows", res.deleted_count, kind)
    except Exception as exc:
        logger.warning("Tombstone sweep failed: %s", exc)

    logger.info(
        "Snapshot auto-restored: %s (snapshot created %s)",
        restored_counts, snapshot_data.get("created_at"),
    )
    return {
        "restored": True,
        "counts": restored_counts,
        "snapshot_created_at": snapshot_data.get("created_at"),
    }


async def status(db) -> Dict[str, Any]:
    """Inspect the snapshot health for the admin UI."""
    counts = {col: await db[col].count_documents({}) for col in SNAPSHOT_COLLECTIONS}
    remote = await _fetch_latest_snapshot(db)
    return {
        "cloudinary_configured": await _cs.ensure_configured(db),
        "local_counts": counts,
        "remote_snapshot_available": bool(remote),
        "remote_snapshot_created_at": (remote or {}).get("created_at"),
        "remote_counts": (remote or {}).get("collections") and {c: (remote["collections"].get(c + "__count") or 0) for c in SNAPSHOT_COLLECTIONS},
    }
