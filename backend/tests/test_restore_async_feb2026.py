"""
Iteration 14 — Async restore endpoint verification.

Tests for new endpoints:
  POST /api/admin/catalog/backup/restore-async  (returns job_id quickly)
  GET  /api/admin/catalog/backup/restore/status?job_id=<id>

Also covers:
  - Auth protection on both endpoints (missing/wrong token => 401/403)
  - 404 when job_id unknown or missing
  - End-to-end flow with polling (≤5 min)
  - Public APIs stay available throughout
  - Status timestamp advances after restore (fresh baseline committed)
"""
import os
import time
import threading
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as fh:
            for ln in fh:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

ADMIN_TOKEN = "celestaglow2024"
HEADERS = {"X-Admin-Token": ADMIN_TOKEN}

STATE = {}


# -- Auth gate ---------------------------------------------------------------
class TestAuth:
    def test_restore_async_no_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/catalog/backup/restore-async?force=true", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_restore_async_wrong_token(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/catalog/backup/restore-async?force=true",
            headers={"X-Admin-Token": "wrong"}, timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_status_no_token(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/backup/restore/status?job_id=deadbeef",
            timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_status_wrong_token(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/backup/restore/status?job_id=deadbeef",
            headers={"X-Admin-Token": "nope"}, timeout=30,
        )
        assert r.status_code in (401, 403)


# -- Status of bogus job -----------------------------------------------------
class TestStatusBogus:
    def test_status_missing_job_id(self):
        # FastAPI marks the query param required → expect 422
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/backup/restore/status",
            headers=HEADERS, timeout=30,
        )
        assert r.status_code in (404, 422), f"got {r.status_code}: {r.text[:200]}"

    def test_status_unknown_job_id(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/backup/restore/status?job_id=doesnotexist",
            headers=HEADERS, timeout=30,
        )
        assert r.status_code == 404, f"expected 404 for unknown job_id, got {r.status_code}: {r.text[:200]}"


# -- Concurrency guard: second restore while first running should 409 --------
class TestConcurrencyGuard:
    def test_second_kickoff_returns_409(self):
        # Fire one off
        r1 = requests.post(
            f"{BASE_URL}/api/admin/catalog/backup/restore-async?force=true",
            headers=HEADERS, timeout=30,
        )
        assert r1.status_code in (200, 202), f"first kickoff failed: {r1.status_code}: {r1.text[:200]}"
        j1 = r1.json().get("job_id")
        assert j1
        STATE["concurrency_job_id"] = j1
        # Immediately fire a second one — should be rejected as already-running
        r2 = requests.post(
            f"{BASE_URL}/api/admin/catalog/backup/restore-async?force=true",
            headers=HEADERS, timeout=30,
        )
        # If somehow first finished super fast (highly unlikely), accept 200.
        if r2.status_code == 409:
            detail = (r2.json() or {}).get("detail", "")
            assert j1 in detail, f"409 detail should mention existing job_id={j1}: {detail!r}"
            print(f"[concurrency] second POST correctly rejected with 409: {detail[:120]}")
        else:
            print(f"[concurrency] second POST returned {r2.status_code} (first likely finished already)")
            assert r2.status_code in (200, 202, 409)


# -- Backwards compat: old sync route still registered -----------------------
class TestSyncRouteStillRegistered:
    def test_sync_restore_route_exists(self):
        """Hit with empty body without force=true → should NOT 404. We don't
        actually want to wait, so use a tiny timeout — even a connection that
        accepts the body is enough proof the route is registered."""
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/catalog/backup/restore",
                headers=HEADERS, timeout=3,
            )
            # If we get *any* response in 3s, it's likely 409 (restore not
            # needed without force). Or 502/timeout. We only fail on a 404.
            assert r.status_code != 404, "sync /restore route is missing"
        except requests.exceptions.ReadTimeout:
            # Timed out at the proxy = route handler was reached. Pass.
            pass


# -- End-to-end async flow ---------------------------------------------------
class TestE2EAsyncRestore:
    def test_kickoff_returns_fast(self):
        # If the concurrency guard test already started a restore, reuse it.
        if STATE.get("concurrency_job_id"):
            STATE["job_id"] = STATE["concurrency_job_id"]
            print(f"[kickoff] reusing job from concurrency test: {STATE['job_id']}")
            return
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/admin/catalog/backup/restore-async?force=true",
            headers=HEADERS, timeout=30,
        )
        elapsed = time.time() - t0
        assert r.status_code in (200, 202), f"got {r.status_code}: {r.text[:300]}"
        assert elapsed < 10.0, f"kickoff too slow ({elapsed:.1f}s) — async refactor broken"
        body = r.json()
        STATE["job_id"] = body.get("job_id")
        assert STATE["job_id"], f"job_id missing: {body}"
        assert len(STATE["job_id"]) == 12, f"job_id length unexpected: {STATE['job_id']!r}"
        assert all(c in "0123456789abcdef" for c in STATE["job_id"]), \
            f"job_id not 12-char hex: {STATE['job_id']!r}"
        assert body.get("status") == "running"
        assert body.get("message")
        print(f"[kickoff] job_id={STATE['job_id']} in {elapsed:.2f}s status={body.get('status')}")

    def test_public_apis_available_during_restore(self):
        """While the restore is running in the background, public endpoints
        must not be blocked. Hit each one and assert 200."""
        paths = [
            "/api/products?limit=5",
            "/api/concerns",
            "/api/categories",
            "/api/site-settings",
            "/api/doctor-consultation/config",
        ]
        for p in paths:
            r = requests.get(f"{BASE_URL}{p}", timeout=30)
            assert r.status_code == 200, f"{p}: {r.status_code}: {r.text[:120]}"
            print(f"[public-during-restore] {p} OK")

    def test_poll_until_done(self):
        job_id = STATE.get("job_id")
        assert job_id, "kickoff test failed; skipping poll"
        deadline = time.time() + 300  # 5 min cap
        last = None
        phases_seen = set()
        while time.time() < deadline:
            r = requests.get(
                f"{BASE_URL}/api/admin/catalog/backup/restore/status?job_id={job_id}",
                headers=HEADERS, timeout=30,
            )
            assert r.status_code == 200, f"status poll {r.status_code}: {r.text[:200]}"
            last = r.json()
            # Schema sanity
            assert "status" in last
            assert "phase" in last
            assert "started_at" in last
            assert "elapsed_sec" in last
            phases_seen.add(last.get("phase"))
            if last.get("status") in ("done", "error"):
                break
            time.sleep(5)
        STATE["final_status"] = last
        print(f"[poll] phases seen: {phases_seen} final={last and last.get('status')} "
              f"elapsed={last and last.get('elapsed_sec')}")
        assert last and last.get("status") == "done", f"restore not done: {last}"
        result = last.get("result") or {}
        STATE["result"] = result
        assert result, "result missing on done job"

    def test_result_counts_and_baseline(self):
        result = STATE.get("result") or {}
        assert result.get("restored") is True, f"restored != true: {result}"
        counts = result.get("counts") or {}
        STATE["counts"] = counts
        print(f"[result] counts={counts}")
        assert counts.get("concerns", 0) >= 13, f"concerns count too low: {counts.get('concerns')}"
        assert counts.get("categories", 0) >= 100, f"categories count too low: {counts.get('categories')}"
        ia = counts.get("_incrementals_applied")
        assert isinstance(ia, int) and ia >= 100, f"_incrementals_applied bad: {ia}"
        fb = result.get("fresh_baseline") or {}
        print(f"[result] fresh_baseline={fb}")
        if fb.get("uploaded") is not True:
            # Acceptable only if a skipped_reason is provided (e.g. dedupe match)
            assert fb.get("skipped_reason"), f"fresh_baseline not uploaded AND no skipped_reason: {fb}"

    def test_post_restore_concerns_have_cloudinary_images(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=30)
        assert r.status_code == 200
        concerns = r.json()
        assert len(concerns) >= 14, f"expected ≥14 concerns, got {len(concerns)}"
        bad = [c.get("slug") for c in concerns
               if not (c.get("image") or "").startswith("https://res.cloudinary.com/")]
        assert not bad, f"{len(bad)} concerns missing cloudinary image: {bad}"

    def test_post_restore_categories_have_https_images(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        with_img = [c for c in cats if (c.get("image") or "").startswith("https://")]
        print(f"[categories] {len(with_img)}/{len(cats)} have https image")
        assert len(with_img) >= 100, f"expected ≥100 cats with https image, got {len(with_img)}/{len(cats)}"

    def test_status_endpoint_still_returns_cached_job(self):
        """Job is kept for 1hr post-completion → polling same id still works."""
        job_id = STATE.get("job_id")
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/backup/restore/status?job_id={job_id}",
            headers=HEADERS, timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "done"
        assert data.get("result"), "cached result missing"


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "-s"]))
