"""
Middleware that schedules a debounced Cloudinary snapshot after EVERY
successful admin write to a snapshot-eligible collection.

Why a middleware?
  We have ~60 admin write endpoints across 15 route files. Hooking each one
  manually is brittle and forgets new endpoints. Centralising the trigger here
  means every existing AND future admin route is auto-covered for free.

Activation rules:
  - Method must be POST / PUT / PATCH / DELETE
  - Path must start with /api/admin/
  - Response status must be 2xx (don't snapshot on validation errors)
  - X-Admin-Token must be present (rules out public misuse)

The actual snapshot runs in a 25-second debounced background task — bursts
of admin writes coalesce into a single Cloudinary upload.
"""
from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# NOTE (Feb 2026): per-write auto-snapshot was disabled by user request.
# Backups now run ONLY (a) at midnight IST via the scheduler in server.py
# and (b) when the admin clicks "Backup now" in the dashboard widget.
# The middleware itself stays in place but is now a no-op — kept so future
# work can opt back into per-write backups easily.


class CatalogBackupTriggerMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, db, schedule_snapshot):
        super().__init__(app)
        self._db = db
        self._schedule = schedule_snapshot

    async def dispatch(self, request: Request, call_next):
        return await call_next(request)
