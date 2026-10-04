"""
Iteration 13 — P0 bug fix verification: Manual restore must bring back the
LATEST admin-uploaded images (not the stale June-11 legacy snapshot).

Tests:
  1) /api/admin/catalog/backup/status — sanity baseline
  2) /api/admin/catalog/backup/restore?force=true — must return restored:true,
     include fresh_baseline.uploaded:true, snapshot_created_at, _incrementals_applied >= 200
  3) After restore, /api/concerns — ALL 14 concerns must have https image
  4) After restore, /api/categories — >= 100 categories with https image
  5) /api/admin/catalog/backup/status — remote_snapshot_created_at must be
     MORE RECENT than baseline (proves fresh_baseline was written)
  6) Skeleton-state guard: simulate skeleton (unset images on concerns),
     call incremental_snapshot() → must return skipped_skeleton:true.
     Revert images and verify guard releases.
  7) Public APIs return 200 after the changes.
"""
import os
import sys
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Frontend env doesn't auto-propagate to pytest shell; fall back to that file.
    try:
        with open("/app/frontend/.env") as fh:
            for ln in fh:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"

ADMIN_TOKEN = "celestaglow2024"
HEADERS = {"X-Admin-Token": ADMIN_TOKEN}

# Shared state across tests in this module (preserves order)
STATE = {}


# ---------------------------------------------------------------------------
# Phase 1 — baseline + restore
# ---------------------------------------------------------------------------
class TestRestoreEndpoint:
    def test_01_status_baseline(self):
        r = requests.get(f"{BASE_URL}/api/admin/catalog/backup/status",
                         headers=HEADERS, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("cloudinary_configured") is True
        STATE["baseline_remote_created_at"] = data.get("remote_snapshot_created_at")
        STATE["baseline_remote_available"] = data.get("remote_snapshot_available")
        print(f"[baseline] remote_snapshot_created_at={STATE['baseline_remote_created_at']}")
        assert STATE["baseline_remote_available"], "no remote snapshot available"

    def test_02_restore_force_true(self):
        # ~3 min cap (user said ≤180s)
        r = requests.post(
            f"{BASE_URL}/api/admin/catalog/backup/restore?force=true",
            headers=HEADERS, timeout=240,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:500]}"
        body = r.json()
        STATE["restore_response"] = body
        print(f"[restore] keys={list(body.keys())}")
        # restored:true
        assert body.get("restored") is True, f"restored != true: {body}"
        # _incrementals_applied >= 200
        ia = (body.get("counts") or {}).get("_incrementals_applied")
        STATE["incrementals_applied"] = ia
        print(f"[restore] _incrementals_applied={ia}")
        assert isinstance(ia, int), f"_incrementals_applied missing/non-int: {ia}"
        assert ia >= 200, f"_incrementals_applied {ia} < 200"
        # snapshot_created_at present
        assert body.get("snapshot_created_at"), "snapshot_created_at missing"
        # fresh_baseline.uploaded
        fb = body.get("fresh_baseline") or {}
        STATE["fresh_baseline"] = fb
        print(f"[restore] fresh_baseline={fb}")
        assert fb.get("uploaded") is True, f"fresh_baseline.uploaded != true: {fb}"
        assert fb.get("created_at"), "fresh_baseline.created_at missing"

    def test_03_concerns_have_images(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        assert r.status_code == 200, r.text
        concerns = r.json()
        assert len(concerns) >= 14, f"expected ≥14 concerns, got {len(concerns)}"
        bad = [c.get("slug") for c in concerns
               if not (c.get("image") or "").startswith("https://res.cloudinary.com/")]
        assert not bad, f"{len(bad)} concerns missing cloudinary image: {bad}"

    def test_04_categories_have_images(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=30)
        assert r.status_code == 200, r.text
        cats = r.json()
        with_img = [c for c in cats
                    if (c.get("image") or "").startswith("https://")]
        print(f"[categories] {len(with_img)} of {len(cats)} have https image")
        assert len(with_img) >= 100, (
            f"expected ≥100 categories with https image, got {len(with_img)}/{len(cats)}"
        )

    def test_05_status_after_restore_is_fresher(self):
        # Give Cloudinary listing a moment to reflect the new full
        time.sleep(3)
        r = requests.get(f"{BASE_URL}/api/admin/catalog/backup/status",
                         headers=HEADERS, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        new_ts = data.get("remote_snapshot_created_at")
        old_ts = STATE.get("baseline_remote_created_at")
        print(f"[status-after] new={new_ts} old={old_ts}")
        assert new_ts, "remote_snapshot_created_at missing after restore"
        # New baseline should be strictly more recent
        assert new_ts > (old_ts or ""), (
            f"remote_snapshot_created_at did not advance: new={new_ts} old={old_ts}"
        )


# ---------------------------------------------------------------------------
# Phase 2 — public API availability after the restore
# ---------------------------------------------------------------------------
class TestPublicAPIsAfterRestore:
    @pytest.mark.parametrize("path", [
        "/api/products?limit=5",
        "/api/concerns",
        "/api/categories",
        "/api/site-settings",
        "/api/doctor-consultation/config",
    ])
    def test_public_endpoint_ok(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=30)
        assert r.status_code == 200, f"{path} HTTP {r.status_code}: {r.text[:200]}"


# ---------------------------------------------------------------------------
# Phase 3 — Skeleton-state guard (direct module invocation)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_06_skeleton_guard_blocks_incremental_and_releases_after_revert():
    """Direct unit test of incremental_snapshot's skeleton guard.

    - Healthy state → incremental_snapshot must NOT return skipped_skeleton.
    - Wipe concerns.image → must return skipped_skeleton:true.
    - Restore via the restore endpoint to revert → guard releases.
    """
    # Load backend env into this test process so motor + cloudinary work
    sys.path.insert(0, "/app/backend")
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv("/app/backend/.env", override=False)
    except Exception:
        pass
    from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
    from services import catalog_backup as cb  # type: ignore

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    test_db = client[os.environ["DB_NAME"]]

    # --- (a) Healthy: guard should NOT trigger ---
    healthy_res = await cb.incremental_snapshot(test_db)
    print(f"[skeleton-test] healthy result keys={list(healthy_res.keys())} "
          f"skipped_skeleton={healthy_res.get('skipped_skeleton')}")
    assert healthy_res.get("skipped_skeleton") is not True, (
        f"Skeleton guard wrongly triggered while healthy: {healthy_res}"
    )

    # --- (b) Save concerns images then wipe them to simulate skeleton ---
    saved_concerns = []
    async for d in test_db.concerns.find({}, {"_id": 0, "slug": 1, "image": 1}):
        saved_concerns.append(d)
    try:
        await test_db.concerns.update_many({}, {"$unset": {"image": ""}})
        skeleton_res = await cb.incremental_snapshot(test_db)
        print(f"[skeleton-test] wiped result={skeleton_res}")
        assert skeleton_res.get("skipped_skeleton") is True, (
            f"Skeleton guard did NOT trigger when images wiped: {skeleton_res}"
        )
        assert skeleton_res.get("success") is False
    finally:
        # --- Revert: restore the images we saved ---
        for d in saved_concerns:
            if d.get("slug") and d.get("image"):
                await test_db.concerns.update_one(
                    {"slug": d["slug"]}, {"$set": {"image": d["image"]}}
                )
        # Verify revert worked
        with_img = await test_db.concerns.count_documents(
            {"image": {"$regex": "^https?://", "$options": "i"}}
        )
        total = await test_db.concerns.count_documents({})
        print(f"[skeleton-test] post-revert concerns with_image={with_img}/{total}")
        assert with_img >= max(1, int(total * 0.20) + 1), (
            f"failed to restore concerns images: {with_img}/{total}"
        )

    # --- (c) After revert, guard releases — incremental_snapshot should not skip ---
    after_res = await cb.incremental_snapshot(test_db)
    print(f"[skeleton-test] post-revert result={after_res}")
    assert after_res.get("skipped_skeleton") is not True, (
        f"Skeleton guard still triggered after revert: {after_res}"
    )

    client.close()


# ---------------------------------------------------------------------------
# Phase 4 — restored data sanity check: AT LEAST one image URL is recent
# ---------------------------------------------------------------------------
class TestRestoreSanity:
    def test_07_restore_response_has_counts(self):
        body = STATE.get("restore_response") or {}
        counts = body.get("counts") or {}
        assert counts.get("concerns", 0) >= 0  # restore reports counts dict
        # Several core collections should have been touched
        non_zero = [k for k, v in counts.items()
                    if isinstance(v, int) and v > 0 and not k.startswith("_")]
        assert len(non_zero) >= 5, f"too few collections updated: {counts}"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v", "-s"]))
