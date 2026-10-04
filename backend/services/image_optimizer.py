"""Cloudinary URL transformer.

Injects `f_auto,q_auto,w_<width>` into Cloudinary delivery URLs so the CDN
serves WebP/AVIF + auto-quality + correctly-sized images, cutting page weight
70-90% without re-uploading anything.

A typical URL like:
    https://res.cloudinary.com/<cloud>/image/upload/v1700000000/abc123.jpg
becomes:
    https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_600/v1700000000/abc123.jpg

Safe — if the URL already has transforms, we don't double-stack them.
Non-Cloudinary URLs pass through untouched.

CACHE BUSTING: when the caller passes a `version` token (typically the parent
doc's `updated_at`), we append `?_v=<short-hash>` so a NEW upload at the same
URL invalidates the browser/CDN cache *instantly* on the user's next page
load — fixes the "old banner image flashes for a second then swaps to the
new one" bug.
"""
from __future__ import annotations
import hashlib
import re
from typing import Any, Optional

_CLOUDINARY_RE = re.compile(r"(https?://res\.cloudinary\.com/[^/]+/image/upload/)(.*)")
_HAS_TRANSFORM = re.compile(r"^(f_|q_|w_|h_|c_|g_|e_|b_|r_|dpr_|fl_)")


def _cb_token(version: Optional[str]) -> str:
    """Tiny 8-char hash of the version string for the ?_v= param."""
    if not version:
        return ""
    return hashlib.md5(str(version).encode()).hexdigest()[:8]


def optimize_cloudinary_url(url: str, width: int = 600, version: Optional[str] = None) -> str:
    """Inject f_auto,q_auto,w_<width> into a Cloudinary URL. Idempotent.

    If `version` is supplied (typically the parent doc's updated_at), append
    a `?_v=<8-char-hash>` query param so updates instantly bust browser/CDN
    caches.  If the URL already has a `?_v=` we replace it.
    """
    if not url or not isinstance(url, str):
        return url
    # Drop any prior _v param so we don't stack them
    base = url.split("?")[0] if "?_v=" in url else url
    m = _CLOUDINARY_RE.match(base)
    if not m:
        # Non-Cloudinary URLs still benefit from cache busting
        if version:
            sep = "&" if "?" in base else "?"
            return f"{base}{sep}_v={_cb_token(version)}"
        return base
    prefix, rest = m.group(1), m.group(2)
    first_seg = rest.split("/", 1)[0]
    if _HAS_TRANSFORM.match(first_seg):
        out = base
    else:
        out = f"{prefix}f_auto,q_auto,w_{width}/{rest}"
    if version:
        sep = "&" if "?" in out else "?"
        return f"{out}{sep}_v={_cb_token(version)}"
    return out


def optimize_product_images(product: dict, width: int = 600) -> dict:
    """Mutate a product dict in-place — apply f_auto,q_auto,w_<width> to every
    image URL inside the standard image fields. Returns the dict for chaining."""
    if not isinstance(product, dict):
        return product
    version = product.get("updated_at") or product.get("modified_at")
    if isinstance(product.get("images"), list):
        product["images"] = [optimize_cloudinary_url(u, width, version) for u in product["images"]]
    if isinstance(product.get("image"), str):
        product["image"] = optimize_cloudinary_url(product["image"], width, version)
    # Shade-level images for cosmetics variants
    if isinstance(product.get("shades"), list):
        for sh in product["shades"]:
            if isinstance(sh, dict) and isinstance(sh.get("image"), str):
                sh["image"] = optimize_cloudinary_url(sh["image"], width, version)
    return product


def optimize_products_list(products: Any, width: int = 600) -> Any:
    """Apply optimize_product_images to every product in a list."""
    if isinstance(products, list):
        for p in products:
            optimize_product_images(p, width=width)
    elif isinstance(products, dict) and isinstance(products.get("items"), list):
        for p in products["items"]:
            optimize_product_images(p, width=width)
    return products
