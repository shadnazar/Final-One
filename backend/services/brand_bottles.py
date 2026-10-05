"""Canonical Celesta Glow product bottles.

STRICT BRAND RULE (owner mandate, Feb 2026)
===========================================
Only TWO bottle photographs may ever appear in generated artwork:

  * ``serum`` →  the "ADVANCED FACE SERUM" pump bottle
  * ``cream`` →  the "CELESTA GLOW ADVANCED RETINOID NIGHT CREAM" pump bottle

No AI-invented bottles, no drawn placeholder bottles, no third-party studio
shots. ``resolve(product)`` therefore ignores whatever image a product happens
to carry and returns one of these two, chosen from the product's own category /
name. The only thing that varies per product is the *label text*, which is
re-rendered onto the bottle by :func:`relabel`.

Both masters live on Cloudinary (``celesta-glow/brand/*``) so they survive a
redeploy, and are cached on local disk purely to avoid re-downloading.

Every bottle is returned as **RGBA with a real alpha channel** — the white
studio backdrop is cut away. That is what stops the old "white box sitting on
top of the ingredient text" bug: a transparent bottle composites over copy
instead of erasing it.
"""
import io
import os
import logging
import re

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

logger = logging.getLogger(__name__)

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BRAND_DIR = os.path.join(BACKEND, "uploads", "brand")
os.makedirs(BRAND_DIR, exist_ok=True)

CLOUD = "https://res.cloudinary.com/dcvuqcqjn/image/upload/q_auto:best,f_auto/celesta-glow/brand/"

# The ONLY two approved bottles.
BOTTLES = {
    "serum": {
        "file": os.path.join(BRAND_DIR, "serum_bottle.jpg"),
        "url": CLOUD + "brand-bottle-serum.jpg",
        # Label text block geometry as fractions of the TRIMMED bottle
        # (~292x885 RGBA after background cut-out + tight crop). The printed
        # copy spans most of the body width, so erase generously.
        "label_box": (0.15, 0.44, 0.84, 0.96),
    },
    "cream": {
        "file": os.path.join(BRAND_DIR, "cream_bottle.jpg"),
        "url": CLOUD + "brand-bottle-cream.jpg",
        # TRIMMED cream (~316x1122). The vertical "CELESTA GLOW" brand text sits
        # on the LEFT and is KEPT; only the changeable centre copy is overwritten.
        "label_box": (0.40, 0.42, 0.86, 0.93),
    },
}

# Category / name keywords → bottle kind. Creams, moisturisers, balms and
# masks take the taller cream bottle; everything else takes the serum bottle.
_CREAM_WORDS = (
    "cream", "moistur", "night", "balm", "butter", "mask", "lotion", "gel",
    "sunscreen", "spf", "eye", "ointment", "salve",
)

GREEN = (31, 81, 51)
GREY = (110, 116, 110)

# Fonts: prefer the BUNDLED copies (shipped with the app so they exist in every
# deploy), then common system locations, and finally PIL's built-in default so
# rendering NEVER hard-fails with "cannot open resource".
_FONTS_LOCAL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")


def _font_path(name: str) -> str:
    for d in (
        _FONTS_LOCAL,
        "/usr/share/fonts/truetype/liberation",
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/liberation",
    ):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return os.path.join(_FONTS_LOCAL, name)


F_BOLD = _font_path("LiberationSans-Bold.ttf")
F_REG = _font_path("LiberationSans-Regular.ttf")


def _truetype(path: str, size: int):
    """Load a TrueType font, falling back gracefully so a missing system font
    can never crash image generation."""
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        try:
            # try the bundled copy by filename
            return ImageFont.truetype(os.path.join(_FONTS_LOCAL, os.path.basename(path)), size)
        except Exception:
            return ImageFont.load_default()

_cache: dict = {}


def kind_for(product: dict) -> str:
    """Pick which of the two approved bottles this product must use."""
    hay = " ".join(
        str(product.get(k) or "")
        for k in ("category", "subcategory", "name", "short_name", "slug", "size")
    ).lower()
    return "cream" if any(w in hay for w in _CREAM_WORDS) else "serum"


def _master(kind: str) -> Image.Image:
    """Load an approved bottle master at FULL resolution (disk cache → Cloudinary)."""
    spec = BOTTLES[kind]
    path = spec["file"]
    if not os.path.exists(path):
        try:
            r = requests.get(spec["url"], timeout=30)
            r.raise_for_status()
            with open(path, "wb") as f:
                f.write(r.content)
        except Exception as exc:
            raise RuntimeError(f"Approved '{kind}' bottle master unavailable: {exc}")
    return Image.open(path).convert("RGB")


def _alpha_cutout(im: Image.Image, near_white: int = 236) -> Image.Image:
    """Cut the white studio backdrop away and return RGBA.

    Only *background-connected* near-white is removed, so the bottle's own
    white body and white label survive intact. One C-level flood fill on a
    1-pixel padded mask does the connectivity work.
    """
    im = im.convert("RGB")
    w, h = im.size

    # Near-white mask (255 = candidate background), padded by 1px so a single
    # flood fill from the corner reaches every border-touching white region.
    try:
        import numpy as np

        arr = np.asarray(im, dtype=np.int16)
        cand = (arr >= near_white).all(axis=2)
        mask = Image.fromarray((cand * 255).astype("uint8"), "L")
    except Exception:
        grey = im.convert("L")
        mask = grey.point(lambda p: 255 if p >= near_white else 0)

    padded = Image.new("L", (w + 2, h + 2), 255)
    padded.paste(mask, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128, thresh=0)
    flooded = padded.crop((1, 1, w + 1, h + 1))

    # alpha: 0 where background-connected white (value 128), else opaque.
    alpha = flooded.point(lambda p: 0 if p == 128 else 255)
    # Feather by a hair so composited edges are clean, not jagged.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7)).point(lambda p: 255 if p > 150 else (0 if p < 70 else p))

    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out


def _trim(im: Image.Image) -> Image.Image:
    """Tight-crop an RGBA bottle to its opaque pixels (keeps a small margin)."""
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    pad = 4
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def _fit_font(draw, text, path, max_w, start, floor=11):
    size = start
    f = _truetype(path, size)
    while draw.textbbox((0, 0), text, font=f)[2] > max_w and size > floor:
        size -= 1
        f = _truetype(path, size)
    return f


def _wrap(draw, text, f, max_w):
    words, lines, cur = str(text).split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if draw.textbbox((0, 0), t, font=f)[2] <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def relabel(bottle: Image.Image, kind: str, product: dict) -> Image.Image:
    """Reprint the product's own name / actives onto an approved bottle.

    The bottle silhouette, cap and finish stay pixel-identical to the master —
    only the printed label text changes, which is exactly what the brand allows.
    """
    im = bottle.copy()
    W0, H0 = im.size
    fl, ft, fr, fb = BOTTLES[kind]["label_box"]
    x0, y0, x1, y1 = int(W0 * fl), int(H0 * ft), int(W0 * fr), int(H0 * fb)
    box_w = x1 - x0
    cx = (x0 + x1) / 2
    # Text is drawn inside a slightly narrower, centred band so long words never
    # spill past the bottle's curved edges (the erase box stays full-width).
    inset = int(box_w * 0.12)
    text_w = box_w - 2 * inset

    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Erase the master's printed copy using the bottle's own body colour so the
    # patch is invisible. Sample the body just above the label, then clamp each
    # channel bright so a shadowed/grey sample can never produce a visible patch.
    sx = int((x0 + x1) / 2)
    sy = max(0, int(y0 - H0 * 0.03))
    _r, _g, _b = im.convert("RGB").getpixel((sx, sy))
    body = (max(_r, 244), max(_g, 244), max(_b, 244))
    d.rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], fill=body + (255,))

    name = (product.get("short_name") or product.get("name") or "Advanced Formula")
    name = re.sub(r"^celesta\s*glow\s*", "", str(name), flags=re.I).strip() or "Advanced Formula"
    actives = str(product.get("key_ingredients") or "")
    if isinstance(product.get("key_ingredients"), list):
        actives = " + ".join(str(x) for x in product["key_ingredients"])
    actives = re.sub(r"\s*\d+(\.\d+)?%", "", actives)
    size_txt = str(product.get("size") or "")

    y = y0 + 4
    # Product name — green, bold, centred, upper-case, wrapped.
    f_name = _fit_font(d, "ADVANCED", F_BOLD, text_w, 30, 12)
    for ln in _wrap(d, name.upper(), f_name, text_w):
        tw = d.textbbox((0, 0), ln, font=f_name)[2]
        d.text((cx - tw / 2, y), ln, font=f_name, fill=GREEN + (255,))
        y += f_name.size + 3
    y += 8

    # Hero actives — small grey caps.
    if actives:
        f_act = _fit_font(d, "NIACINAMIDE +", F_REG, text_w, 16, 8)
        for ln in _wrap(d, actives.upper(), f_act, text_w)[:4]:
            tw = d.textbbox((0, 0), ln, font=f_act)[2]
            d.text((cx - tw / 2, y), ln, font=f_act, fill=GREY + (255,))
            y += f_act.size + 3
        y += 8

    # Footer: "FOR ALL SKIN TYPES" + pack size.
    f_ft = _fit_font(d, "FOR ALL SKIN TYPES", F_REG, text_w, 13, 8)
    for ln in ["FOR ALL SKIN TYPES"] + ([size_txt] if size_txt else []):
        tw = d.textbbox((0, 0), ln, font=f_ft)[2]
        d.text((cx - tw / 2, min(y, y1 - f_ft.size)), ln, font=f_ft, fill=GREEN + (255,))
        y += f_ft.size + 4

    # Keep the label strictly inside the bottle silhouette.
    layer.putalpha(Image.composite(layer.split()[-1], Image.new("L", im.size, 0), im.split()[-1]))
    return Image.alpha_composite(im, layer)


def resolve(product: dict, relabelled: bool = False) -> Image.Image:
    """Return the approved, background-free RGBA bottle for this product.

    ``relabelled`` defaults to **False**: the owner supplied these two bottle
    photographs as the exact artwork to use, and their printed labels
    ("ADVANCED FACE SERUM" / "ADVANCED RETINOID NIGHT CREAM") are already the
    correct brand copy. Reprinting over them degrades the photo, so the master
    is used pixel-exact unless a caller explicitly opts in.
    """
    kind = kind_for(product or {})
    key = (kind, bool(relabelled), str((product or {}).get("slug") or "") if relabelled else "")
    if key in _cache:
        return _cache[key].copy()

    cut_key = ("__cut__", kind)
    if cut_key in _cache:
        cut = _cache[cut_key].copy()
    else:
        cut = _trim(_alpha_cutout(_master(kind)))
        _cache[cut_key] = cut.copy()

    out = relabel(cut, kind, product or {}) if relabelled else cut
    _cache[key] = out.copy()
    return out


def hero_bytes(product: dict, size: int = 2048) -> bytes:
    """High-quality hero product shot: approved bottle, pure-white backdrop.

    This is the FIRST product image. It is rendered from the full-resolution
    master with LANCZOS and saved at quality 97 / 4:4:4 chroma so it stays
    razor sharp instead of the soft, over-compressed shot shipped before.

    The bottle silhouette / cap / finish stay pixel-identical to the approved
    master; only the printed LABEL TEXT is re-rendered to carry THIS product's
    name + actives (``relabelled=True``), so every generated image shows the
    correct product name on the bottle.
    """
    bottle = resolve(product, relabelled=True)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    # Bottle occupies ~82% of the frame height, optically centred.
    target_h = int(size * 0.82)
    scale = target_h / bottle.height
    nw = max(1, int(bottle.width * scale))
    b = bottle.resize((nw, target_h), Image.LANCZOS)
    canvas.paste(b, (int((size - nw) / 2), int((size - target_h) / 2)), b)
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=97, subsampling=0, optimize=True, progressive=True)
    return buf.getvalue()


def hero_bytes_from_reference(product: dict, ref_bytes: bytes, size: int = 2048) -> bytes:
    """Render a hero product shot using an ADMIN-SUPPLIED reference bottle photo
    as the base, then reprint THIS product's own name / actives onto its label.

    This is how a shop owner says "use *this* bottle design" — they upload one
    clean reference photo of their bottle (white studio backdrop) and every
    generated product reuses that exact bottle, with only the printed label text
    swapped to the correct product name. No AI image credits are spent and the
    label text is always crisp + correct (drawn with Pillow).
    """
    im = Image.open(io.BytesIO(ref_bytes)).convert("RGB")
    # Cut the studio backdrop so the bottle composites cleanly onto white.
    cut = _trim(_alpha_cutout(im))
    # Pick the label-box geometry closest to this product's bottle kind.
    kind = kind_for(product or {})
    bottle = relabel(cut, kind, product or {})

    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    target_h = int(size * 0.82)
    scale = target_h / bottle.height
    nw = max(1, int(bottle.width * scale))
    b = bottle.resize((nw, target_h), Image.LANCZOS)
    canvas.paste(b, (int((size - nw) / 2), int((size - target_h) / 2)), b)
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=97, subsampling=0, optimize=True, progressive=True)
    return buf.getvalue()
