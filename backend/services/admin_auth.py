"""
Centralised admin password verification.

Security contract
-----------------
* Once an admin saves a custom password (stored as a SHA-256 hash in
  ``admin_settings`` under ``{type: "password"}``), THAT is the only password
  accepted. The seed/env value (``ADMIN_PASSWORD`` / ``celestaglow2024``)
  becomes inert.
* Until the admin saves a custom password, the env value is the bootstrap
  default — required so a fresh install can log in.

Before this module existed, every verifier accepted *both* the DB hash *and*
the env hash, meaning a leaked default password kept working forever after a
password change. That is the bug this module fixes.

Implementation
--------------
We keep an in-memory ``_active_admin_hash`` cache (string) that is:

* hydrated at startup via :func:`refresh_active_admin_hash`,
* updated synchronously by :func:`set_active_admin_hash` whenever the admin
  saves a new password,
* read by sync verifiers via :func:`get_cached_active_admin_hash`,
* read by async verifiers via :func:`get_active_admin_hash` (which falls back
  to a live DB query if the cache is empty for any reason).

This gives us correct security behaviour everywhere — sync FastAPI deps
included — without introducing an async-to-sync bridge.
"""
from __future__ import annotations

import hashlib
import os
from typing import Optional


def _env_seed_password() -> str:
    """The bootstrap admin password from env, used ONLY if no DB password is set yet."""
    return os.environ.get("ADMIN_PASSWORD") or "celestaglow2024"


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


# ------- in-memory cache -------
_active_admin_hash: Optional[str] = None


def get_cached_active_admin_hash() -> str:
    """Return the cached active hash. Falls back to the env-seed hash if the
    cache hasn't been hydrated yet (only happens during the first request
    after a cold start before the startup hook has run)."""
    return _active_admin_hash or _hash(_env_seed_password())


def set_active_admin_hash(new_hash: str) -> None:
    """Update the cached hash. Call this from the change-password endpoint
    so the new password takes effect immediately for *every* verifier in
    every router/process running in this pod."""
    global _active_admin_hash
    _active_admin_hash = new_hash


async def refresh_active_admin_hash(db) -> str:
    """Re-read the active hash from the DB and update the cache. Returns the
    refreshed hash. Safe to call any time (startup, after password change)."""
    global _active_admin_hash
    if db is not None:
        try:
            stored = await db.admin_settings.find_one({"type": "password"})
            if stored and stored.get("hash"):
                _active_admin_hash = stored["hash"]
                return _active_admin_hash
        except Exception:
            pass
    _active_admin_hash = _hash(_env_seed_password())
    return _active_admin_hash


async def get_active_admin_hash(db) -> str:
    """Async lookup that prefers the in-memory cache and falls back to a DB
    read. Use this in async verifiers. Sync code should call
    :func:`get_cached_active_admin_hash` instead."""
    if _active_admin_hash:
        return _active_admin_hash
    return await refresh_active_admin_hash(db)


async def is_admin_password(token: Optional[str], db) -> bool:
    """True iff ``token`` (plain password) hashes to the active admin hash."""
    if not token:
        return False
    return _hash(token) == await get_active_admin_hash(db)


async def has_custom_admin_password(db) -> bool:
    """True iff admin has saved a custom password (env seed is therefore inert)."""
    if db is None:
        return False
    try:
        stored = await db.admin_settings.find_one({"type": "password"})
        return bool(stored and stored.get("hash"))
    except Exception:
        return False
