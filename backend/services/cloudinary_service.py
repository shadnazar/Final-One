"""
Cloudinary integration:
- Stores admin-supplied credentials (cloud_name / api_key / api_secret) in Mongo
  under collection `admin_settings` with key {type: "cloudinary"}.
- Configures the cloudinary SDK lazily on every upload so newly-saved keys
  apply immediately without a backend restart.
- Falls back to environment variables CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
  when the DB record is missing (handy for first-time bootstrapping).
"""
import os
import io
import logging
from typing import Optional, Dict

import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

# Module-level cache so we don't hit the DB on every request
_creds_cache: Dict[str, Optional[str]] = {
    "cloud_name": None,
    "api_key": None,
    "api_secret": None,
    "loaded_from": None,
}


def _apply_creds(creds: Dict[str, Optional[str]]) -> None:
    """Configure the cloudinary SDK with the given creds. Safe to call repeatedly."""
    cloud_name = creds.get("cloud_name") or os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = creds.get("api_key") or os.environ.get("CLOUDINARY_API_KEY")
    api_secret = creds.get("api_secret") or os.environ.get("CLOUDINARY_API_SECRET")
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


async def get_cloudinary_credentials(db) -> Dict[str, Optional[str]]:
    """Return current credentials.

    Priority (Feb 2026, post Cloudinary migration):
      1. `.env`  CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
      2. `admin_settings.cloudinary` document in MongoDB (legacy fallback)

    Previously the DB beat the env, which silently kept uploads pinned to the
    old account even after an operator switched .env credentials. Flipping the
    priority means the env is now the single source of truth that ops control.
    Any DB row with stale creds becomes harmless — env wins as long as it's
    fully populated; otherwise per-field fallback to DB kicks in.
    """
    doc = await db.admin_settings.find_one({"type": "cloudinary"})
    env_cloud  = (os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip()
    env_key    = (os.environ.get("CLOUDINARY_API_KEY") or "").strip()
    env_secret = (os.environ.get("CLOUDINARY_API_SECRET") or "").strip()
    db_cloud  = ((doc or {}).get("cloud_name") or "").strip()
    db_key    = ((doc or {}).get("api_key") or "").strip()
    db_secret = ((doc or {}).get("api_secret") or "").strip()
    cloud_name = env_cloud or db_cloud
    api_key    = env_key or db_key
    api_secret = env_secret or db_secret
    if env_cloud and env_key and env_secret:
        loaded_from = "env"
    elif doc and (db_cloud or db_key or db_secret):
        loaded_from = "env+db" if (env_cloud or env_key or env_secret) else "db"
    else:
        loaded_from = "env" if api_key else None
    creds = {
        "cloud_name": cloud_name,
        "api_key": api_key,
        "api_secret": api_secret,
        "loaded_from": loaded_from,
    }
    _creds_cache.update(creds)
    return creds


async def save_cloudinary_credentials(db, cloud_name: str, api_key: str, api_secret: str) -> Dict:
    """Persist credentials to Mongo and refresh local cache."""
    from datetime import datetime, timezone
    payload = {
        "cloud_name": (cloud_name or "").strip(),
        "api_key": (api_key or "").strip(),
        "api_secret": (api_secret or "").strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_settings.update_one(
        {"type": "cloudinary"},
        {"$set": payload},
        upsert=True,
    )
    _creds_cache.update({
        "cloud_name": payload["cloud_name"],
        "api_key": payload["api_key"],
        "api_secret": payload["api_secret"],
        "loaded_from": "db",
    })
    _apply_creds(_creds_cache)
    return {"success": True, "cloud_name": payload["cloud_name"]}


def is_configured() -> bool:
    return bool(
        _creds_cache.get("cloud_name")
        and _creds_cache.get("api_key")
        and _creds_cache.get("api_secret")
    )


async def ensure_configured(db) -> bool:
    """Lazy-load creds + apply them. Returns True if cloudinary is usable."""
    if not is_configured():
        await get_cloudinary_credentials(db)
    _apply_creds(_creds_cache)
    return is_configured()


async def upload_image(db, file_bytes: bytes, folder: str = "celesta-glow", public_id: Optional[str] = None) -> Dict:
    """Upload bytes to Cloudinary and return the secure URL + metadata."""
    if not await ensure_configured(db):
        raise RuntimeError("Cloudinary is not configured. Save credentials in admin settings first.")
    file_obj = io.BytesIO(file_bytes)
    res = cloudinary.uploader.upload(
        file_obj,
        folder=folder,
        public_id=public_id,
        resource_type="image",
        overwrite=True,
        unique_filename=public_id is None,
        quality="auto:best",
        fetch_format="auto",
    )
    _url = res.get("secure_url") or res.get("url")
    # Deliver every image at best quality + auto modern format (webp/avif) so
    # product photos stay crisp instead of blurry/compressed.
    if _url and "res.cloudinary.com" in _url and "/upload/" in _url and "q_auto" not in _url:
        _url = _url.replace("/upload/", "/upload/q_auto:best,f_auto/", 1)
    return {
        "url": _url,
        "public_id": res.get("public_id"),
        "width": res.get("width"),
        "height": res.get("height"),
        "format": res.get("format"),
        "bytes": res.get("bytes"),
    }
