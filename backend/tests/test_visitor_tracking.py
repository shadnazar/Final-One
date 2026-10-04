"""Iteration 4: visitor tracking + cosmetic concerns."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_PASSWORD", "celestaglow2024")
HEADERS_ADMIN = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ===== Visitor ping =====
class TestVisitorPing:
    def test_ping_returns_success(self):
        payload = {
            "session_id": "TEST_pytest_sess_aaa111",
            "path": "/skincare",
            "title": "Skincare Home",
            "niche": "skincare",
        }
        r = requests.post(f"{BASE_URL}/api/visitor/ping", json=payload, timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("success") is True

    def test_ping_is_idempotent_single_doc(self):
        sid = "TEST_pytest_sess_idem_bbb222"
        payload = {"session_id": sid, "path": "/cosmetics", "title": "Cosmetics", "niche": "cosmetics"}
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/visitor/ping", json=payload, timeout=15)
            assert r.status_code == 200

        # verify Mongo — exactly 1 doc for this session_id
        cli = MongoClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]
        count = db.visitor_pings.count_documents({"session_id": sid})
        assert count == 1, f"expected 1 doc for {sid}, got {count}"
        doc = db.visitor_pings.find_one({"session_id": sid})
        assert doc["ping_count"] >= 3
        assert doc["path"] == "/cosmetics"
        assert doc["niche"] == "cosmetics"

    def test_ttl_index_exists_with_300s(self):
        cli = MongoClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]
        info = db.visitor_pings.index_information()
        # find TTL index on last_seen
        ttl_idx = None
        for name, meta in info.items():
            keys = meta.get("key", [])
            if any(k[0] == "last_seen" for k in keys) and "expireAfterSeconds" in meta:
                ttl_idx = meta
                break
        assert ttl_idx is not None, f"no TTL index on last_seen: {info}"
        assert ttl_idx["expireAfterSeconds"] == 300


# ===== Admin active visitors =====
class TestAdminActiveVisitors:
    def test_requires_admin_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/visitors/active", timeout=15)
        assert r.status_code in (401, 403), f"expected unauthorized, got {r.status_code}"

    def test_returns_recent_visitors(self):
        # seed a ping first
        sid = "TEST_pytest_sess_active_ccc333"
        requests.post(
            f"{BASE_URL}/api/visitor/ping",
            json={"session_id": sid, "path": "/skincare/test", "title": "t", "niche": "skincare"},
            timeout=15,
        )
        time.sleep(0.5)
        r = requests.get(f"{BASE_URL}/api/admin/visitors/active", headers=HEADERS_ADMIN, timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["success"] is True
        assert isinstance(data["count"], int)
        assert isinstance(data["visitors"], list)
        assert isinstance(data["by_page"], list)
        assert isinstance(data["by_niche"], list)
        # our seeded session should be in the list
        sids = [v["session_id"] for v in data["visitors"]]
        assert sid in sids, f"seeded session {sid} not in active list: {sids[:10]}"
        me = next(v for v in data["visitors"] if v["session_id"] == sid)
        assert me["path"] == "/skincare/test"
        assert me["niche"] == "skincare"
        assert "last_seen" in me and "first_seen" in me
        assert "_id" not in me  # mongodb _id must be excluded

    def teardown_method(self, method):
        try:
            cli = MongoClient(os.environ["MONGO_URL"])
            db = cli[os.environ["DB_NAME"]]
            db.visitor_pings.delete_many({"session_id": {"$regex": "^TEST_pytest_"}})
        except Exception:
            pass


# ===== Cosmetic concerns =====
class TestCosmeticConcerns:
    EXPECTED = {"full-coverage", "everyday-natural", "bridal-glam", "long-wear"}

    def test_four_cosmetic_concerns_exist(self):
        r = requests.get(f"{BASE_URL}/api/concerns", timeout=15)
        assert r.status_code == 200
        all_concerns = r.json()
        cosmetic = [c for c in all_concerns if c.get("niche") == "cosmetics"]
        slugs = {c["slug"] for c in cosmetic}
        missing = self.EXPECTED - slugs
        assert not missing, f"missing cosmetic concerns: {missing}. Found: {slugs}"

    def test_admin_concerns_crud_preserves_niche(self):
        # create one in cosmetics niche
        payload = {
            "slug": "TEST_pytest_concern_temp",
            "name": "Test Temp",
            "niche": "cosmetics",
            "description": "temp",
        }
        r = requests.post(f"{BASE_URL}/api/admin/concerns", json=payload, headers=HEADERS_ADMIN, timeout=15)
        if r.status_code == 404:
            pytest.skip("admin concerns POST not available")
        assert r.status_code in (200, 201), r.text[:300]

        # GET back and confirm niche preserved
        r2 = requests.get(f"{BASE_URL}/api/concerns", timeout=15)
        rec = next((c for c in r2.json() if c["slug"] == "TEST_pytest_concern_temp"), None)
        assert rec is not None
        assert rec.get("niche") == "cosmetics"

        # PUT — update and ensure niche stays
        r3 = requests.put(
            f"{BASE_URL}/api/admin/concerns/TEST_pytest_concern_temp",
            json={"slug": "TEST_pytest_concern_temp", "name": "Test Temp Updated", "niche": "cosmetics"},
            headers=HEADERS_ADMIN, timeout=15,
        )
        assert r3.status_code in (200, 204), r3.text[:300]

        # cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/concerns/TEST_pytest_concern_temp",
            headers=HEADERS_ADMIN, timeout=15,
        )
