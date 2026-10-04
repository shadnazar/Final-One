"""Durable image storage — Cloudinary is the ONLY source of truth.

Why this module exists
======================
Generated artwork (product hero shots, Formula-Technology cards, certificates,
before/after panels, routine imagery) used to be written to
``backend/uploads/products/`` and referenced as ``/api/uploads/products/x.jpg``.
That directory lives on the pod's ephemeral disk: every redeploy wipes it and
each of those URLs turns into a 404 — images "disappear after a few days".

Everything now goes through :func:`save_image`, which uploads to Cloudinary
under a **deterministic public_id** and returns the permanent ``res.cloudinary.com``
URL. Local disk is written too, but purely as a render cache — it is never the
URL we hand to the browser.

Because the public_id is deterministic (``celesta-glow/generated/<slug>-<tag>``),
re-running a generator overwrites the same asset instead of growing the library,
and an image that already exists can be re-pointed without re-uploading.
"""
import asyncio
import io
import logging
import os
import re
from typing import Optional, Union

from PIL import Image

logger = logging.getLogger(__name__)

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE_DIR = os.path.join(BACKEND, "uploads", "products")
os.makedirs(CACHE_DIR, exist_ok=True)

GENERATED_FOLDER = "celesta-glow/generated"


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", str(s or "")).strip("-").lower()
    return s[:120] or "image"


def to_bytes(image: Union[Image.Image, bytes], fmt: str = "JPEG",
             quality: int = 95) -> bytes:
    """Encode a PIL image at high quality (no visible compression artefacts)."""
    if isinstance(image, (bytes, bytearray)):
        return bytes(image)
    buf = io.BytesIO()
    if fmt.upper() == "PNG":
        image.save(buf, "PNG", optimize=True)
    else:
        img = image.convert("RGB") if image.mode in ("RGBA", "P", "LA") else image
        img.save(buf, "JPEG", quality=quality, subsampling=0,
                 optimize=True, progressive=True)
    return buf.getvalue()


async def save_image(
    db,
    image: Union[Image.Image, bytes],
    *,
    slug: str,
    tag: str,
    fmt: str = "JPEG",
    quality: int = 95,
    folder: str = GENERATED_FOLDER,
    cache_filename: Optional[str] = None,
) -> str:
    """Persist one generated image and return its PERMANENT public URL.

    Raises ``RuntimeError`` when Cloudinary is unreachable *and* local
    fallback is not explicitly allowed — we would rather fail loudly than
    hand back a URL that dies on the next redeploy.
    """
    data = to_bytes(image, fmt=fmt, quality=quality)
    public_id = f"{_slugify(slug)}-{_slugify(tag)}"

    # Render cache on disk (handy for local recomposition; never served as the
    # canonical URL).
    if cache_filename:
        try:
            with open(os.path.join(CACHE_DIR, cache_filename), "wb") as f:
                f.write(data)
        except Exception as exc:
            logger.debug(f"[durable_images] cache write skipped: {exc}")

    try:
        from services import cloudinary_service as cs
        if await cs.ensure_configured(db):
            res = await asyncio.to_thread(
                _upload_sync, data, folder, public_id,
            )
            url = res.get("url")
            if url:
                return url
    except Exception as exc:
        logger.error(f"[durable_images] Cloudinary upload failed for {public_id}: {exc}")

    allow_local = (os.environ.get("ALLOW_LOCAL_UPLOADS") or "").lower() in ("1", "true", "yes")
    if cache_filename and allow_local:
        logger.warning(f"[durable_images] serving {public_id} from EPHEMERAL local disk")
        return f"/api/uploads/products/{cache_filename}"
    raise RuntimeError(
        "Cloudinary is not configured — refusing to persist a generated image "
        "that would be lost on the next deploy. Set CLOUDINARY_CLOUD_NAME / "
        "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET."
    )


def _upload_sync(data: bytes, folder: str, public_id: str) -> dict:
    """Blocking Cloudinary upload (run off the event loop via to_thread)."""
    import cloudinary.uploader
    res = cloudinary.uploader.upload(
        io.BytesIO(data),
        folder=folder,
        public_id=public_id,
        resource_type="image",
        overwrite=True,          # deterministic id → refresh in place
        invalidate=True,         # bust the CDN edge cache
        unique_filename=False,
        use_filename=False,
        quality="auto:best",
        fetch_format="auto",
    )
    url = res.get("secure_url") or res.get("url")
    if url and "/upload/" in url and "q_auto" not in url:
        url = url.replace("/upload/", "/upload/q_auto:best,f_auto/", 1)
    return {"url": url, "public_id": res.get("public_id")}


def save_image_sync(db_unused, image: Union[Image.Image, bytes], *, slug: str,
                    tag: str, fmt: str = "JPEG", quality: int = 95,
                    folder: str = GENERATED_FOLDER,
                    cache_filename: Optional[str] = None) -> str:
    """Synchronous variant for standalone scripts / sync generators.

    Credentials must already be applied (``cloudinary.config``) — the seed
    scripts call ``cloudinary_service.ensure_configured`` first.
    """
    data = to_bytes(image, fmt=fmt, quality=quality)
    public_id = f"{_slugify(slug)}-{_slugify(tag)}"
    if cache_filename:
        try:
            with open(os.path.join(CACHE_DIR, cache_filename), "wb") as f:
                f.write(data)
        except Exception:
            pass
    res = _upload_sync(data, folder, public_id)
    if not res.get("url"):
        raise RuntimeError(f"Cloudinary upload returned no URL for {public_id}")
    return res["url"]


def is_ephemeral(url: str) -> bool:
    """True when a stored URL points at the pod's disposable disk."""
    return bool(url) and str(url).startswith("/api/uploads/")
