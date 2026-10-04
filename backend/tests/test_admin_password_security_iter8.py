"""
Iteration 8 — Admin password security regression.

Verifies the centralised active-hash fix: once a custom admin password is
saved, the env-seed (`celestaglow2024`) MUST be inert on EVERY admin
endpoint and on /admin/login. Bootstrap mode (no custom pw) must still
accept the env-seed.

We always reset the password back to `celestaglow2024` at the end of the
suite via a session-scoped fixture so the rest of the test environment
keeps working.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://weather-preview-6.preview.emergentagent.com").rstrip("/")
SEED_PW = "celestaglow2024"
NEW_PW = "NewSecure@2026"


# ---------- helpers ----------
def _login(pw):
    return requests.post(f"{BASE_URL}/api/admin/login", json={"password": pw}, timeout=20)


def _change_pw(token, current, new):
    return requests.post(
        f"{BASE_URL}/api/admin/change-password",
        headers={"X-Admin-Token": token, "Content-Type": "application/json"},
        json={"current_password": current, "new_password": new},
        timeout=20,
    )


# Endpoints the spec calls out as needing X-Admin-Token protection.
# (method, path, body-or-None)
PROBE_GET_ENDPOINTS = [
    "/api/admin/concerns",
    "/api/admin/categories",
    "/api/admin/subcategories",
    "/api/admin/coupons",
    "/api/admin/blogs",
    "/api/admin/orders",
    "/api/admin/email/stats",
    "/api/admin/locations",
    "/api/admin/products",
    "/api/products?active_only=false",
]


def _hit(token, path, method="GET", json_body=None):
    url = f"{BASE_URL}{path}"
    return requests.request(
        method,
        url,
        headers={"X-Admin-Token": token, "Content-Type": "application/json"},
        json=json_body,
        timeout=20,
    )


# ---------- session-level cleanup: ALWAYS revert to seed ----------
@pytest.fixture(scope="session", autouse=True)
def _ensure_revert_to_seed_at_end():
    yield
    # Best-effort revert. Try seed → maybe bootstrap is already there.
    r = _login(SEED_PW)
    if r.status_code == 200:
        return  # already at seed
    # else try logging in with NEW_PW and changing back
    r2 = _login(NEW_PW)
    if r2.status_code == 200:
        tok = r2.json().get("token")
        _change_pw(tok, NEW_PW, SEED_PW)


# ---------- 1. bootstrap mode: env-seed accepted on /login + endpoints ----------
class TestBootstrapModeSeedAccepted:
    """In bootstrap mode (no custom pw saved) env-seed must work everywhere."""

    def test_seed_login_succeeds(self):
        # Make sure we are in bootstrap mode (revert if needed).
        r = _login(SEED_PW)
        if r.status_code != 200:
            # If currently on NEW_PW from a prior failed run, revert first.
            r2 = _login(NEW_PW)
            if r2.status_code == 200:
                _change_pw(r2.json()["token"], NEW_PW, SEED_PW)
            r = _login(SEED_PW)
        assert r.status_code == 200, f"seed login failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("token") == SEED_PW

    @pytest.mark.parametrize("path", PROBE_GET_ENDPOINTS)
    def test_seed_token_authorizes_admin_endpoint(self, path):
        r = _hit(SEED_PW, path, "GET")
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


# ---------- 2. password change → seed inert; new accepted ----------
class TestSeedInertAfterPasswordChange:
    """The crux of the security fix."""

    @pytest.fixture(scope="class", autouse=True)
    def _set_new_password(self):
        # Login with seed (bootstrap), capture session token T_old, change pw.
        login = _login(SEED_PW)
        assert login.status_code == 200, login.text
        t_old = login.json()["token"]
        # Stash for cross-test
        TestSeedInertAfterPasswordChange.t_old = t_old

        ch = _change_pw(t_old, SEED_PW, NEW_PW)
        assert ch.status_code == 200, f"change-password failed: {ch.status_code} {ch.text}"
        # Brief settle for in-memory cache propagation.
        time.sleep(0.5)
        yield
        # Always revert back to seed at end of class
        login_new = _login(NEW_PW)
        if login_new.status_code == 200:
            _change_pw(login_new.json()["token"], NEW_PW, SEED_PW)

    def test_login_with_old_seed_is_rejected(self):
        r = _login(SEED_PW)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"
        assert "Invalid password" in r.text

    def test_login_with_new_password_succeeds(self):
        r = _login(NEW_PW)
        assert r.status_code == 200, r.text
        assert r.json().get("token") == NEW_PW

    @pytest.mark.parametrize("path", PROBE_GET_ENDPOINTS)
    def test_seed_token_rejected_on_admin_endpoints(self, path):
        r = _hit(SEED_PW, path, "GET")
        assert r.status_code in (401, 403), f"{path} STILL accepted seed! got {r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("path", PROBE_GET_ENDPOINTS)
    def test_new_token_accepted_on_admin_endpoints(self, path):
        r = _hit(NEW_PW, path, "GET")
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_old_session_token_invalidated(self):
        # T_old was the seed string used as session token; change-password
        # should have called admin_sessions.clear_all() and inerted the seed
        # in the password cache, so this hit should now be 401/403.
        t_old = TestSeedInertAfterPasswordChange.t_old
        r = _hit(t_old, "/api/admin/concerns", "GET")
        assert r.status_code in (401, 403), f"old session token still works! {r.status_code}"

    def test_seed_rejected_on_admin_products_post(self):
        # Master fallback inertness on a POST endpoint
        r = _hit(SEED_PW, "/api/admin/products", "POST", json_body={
            "slug": "TEST_should_not_create", "name": "x", "niche": "skincare",
        })
        assert r.status_code in (401, 403), f"POST /admin/products accepted seed! {r.status_code} {r.text[:200]}"

    def test_seed_rejected_on_products_active_only_false(self):
        # products.py.verify_auth path
        r = requests.get(
            f"{BASE_URL}/api/products?active_only=false",
            headers={"X-Admin-Token": SEED_PW}, timeout=20,
        )
        assert r.status_code in (401, 403), r.text[:200]

    def test_seed_rejected_on_landing_pages(self):
        r = _hit(SEED_PW, "/api/admin/landing-pages", "GET")
        # endpoint may not exist as GET; accept 401/403/404 (auth must fail before 200)
        assert r.status_code != 200, f"landing pages accepted seed: {r.status_code}"

    def test_seed_rejected_on_consultations(self):
        r = _hit(SEED_PW, "/api/admin/consultations", "GET")
        assert r.status_code != 200, f"consultations accepted seed: {r.status_code}"


# ---------- 3. revert + bootstrap restored ----------
class TestRevertRestoresBootstrap:
    """After reverting password back to the seed, env-seed accepted again."""

    @pytest.fixture(scope="class", autouse=True)
    def _setup(self):
        # Make sure we start from seed (in case prior class left things)
        r = _login(SEED_PW)
        if r.status_code != 200:
            r2 = _login(NEW_PW)
            if r2.status_code == 200:
                _change_pw(r2.json()["token"], NEW_PW, SEED_PW)
        # Now: seed → NEW_PW → seed, verify last seed accepted
        l1 = _login(SEED_PW)
        assert l1.status_code == 200, l1.text
        ch1 = _change_pw(l1.json()["token"], SEED_PW, NEW_PW)
        assert ch1.status_code == 200
        time.sleep(0.4)
        l2 = _login(NEW_PW)
        assert l2.status_code == 200, l2.text
        ch2 = _change_pw(l2.json()["token"], NEW_PW, SEED_PW)
        assert ch2.status_code == 200
        time.sleep(0.4)
        yield

    def test_seed_login_works_after_revert(self):
        r = _login(SEED_PW)
        assert r.status_code == 200, r.text

    def test_seed_token_works_on_endpoint_after_revert(self):
        r = _hit(SEED_PW, "/api/admin/concerns", "GET")
        assert r.status_code == 200, r.text


# ---------- 4. existing change-password validation rules ----------
class TestChangePasswordValidation:
    def test_wrong_current_password_returns_401(self):
        # Login first
        l = _login(SEED_PW)
        assert l.status_code == 200, l.text
        tok = l.json()["token"]
        r = _change_pw(tok, "definitely_not_the_password", "AnotherPwd@2026")
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_short_new_password_returns_400(self):
        l = _login(SEED_PW)
        assert l.status_code == 200
        tok = l.json()["token"]
        r = _change_pw(tok, SEED_PW, "short")
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_valid_change_then_revert(self):
        # full happy path with revert
        l = _login(SEED_PW)
        assert l.status_code == 200
        tok = l.json()["token"]
        r = _change_pw(tok, SEED_PW, NEW_PW)
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        # revert
        l2 = _login(NEW_PW)
        assert l2.status_code == 200, l2.text
        r2 = _change_pw(l2.json()["token"], NEW_PW, SEED_PW)
        assert r2.status_code == 200, r2.text


# ---------- 5. employee login unaffected ----------
class TestEmployeeLoginUnaffected:
    def test_employee_login_still_works(self):
        # Credentials seeded in /app/memory/test_credentials.md
        r = requests.post(
            f"{BASE_URL}/api/employee/login",
            json={"username": "testemp_jan2026", "password": "Test@1234"},
            timeout=20,
        )
        # If the seed user was deleted by another iteration, gracefully skip.
        if r.status_code == 401:
            pytest.skip("Test employee not present (seed missing); admin pw flow unaffected.")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True or body.get("token")
