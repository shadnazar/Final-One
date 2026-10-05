"""Compose per-product Formula-Technology gallery cards + a lab certificate.

Used by the admin "Generate Gallery & Certificate" button. The product's FIRST
image (its hero product shot) is used as the bottle source, so the bottle stays
pixel-identical across the hero and every generated card. Pure-white background,
crisp typography, 4 distinct editorial layouts in one green/white brand theme.

No LLM budget required — everything is drawn with Pillow.
"""
import os
import re
import io
import hashlib
import logging

import requests
from PIL import Image, ImageDraw, ImageFont, ImageChops

logger = logging.getLogger(__name__)

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRODUCTS_DIR = os.path.join(BACKEND, "uploads", "products")
os.makedirs(PRODUCTS_DIR, exist_ok=True)


def _persist(img, slug: str, tag: str, cache_filename: str = None) -> str:
    """Store a composed card on Cloudinary and return its PERMANENT URL.

    Generated artwork must never be served from `/api/uploads/...` — that disk
    is wiped on every redeploy, which is exactly why images "vanished after a
    few days". `durable_images` uploads under a deterministic public_id, so
    re-generating refreshes the same asset in place.
    """
    from services import durable_images
    return durable_images.save_image_sync(
        None, img, slug=slug, tag=tag, quality=95,
        cache_filename=cache_filename,
    )

# Fonts: prefer the BUNDLED copies (shipped with the app so they exist in every
# deploy), then common system locations, and finally PIL's built-in default so
# gallery/certificate rendering NEVER hard-fails with "cannot open resource".
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
F_SERIF_B = _font_path("LiberationSerif-Bold.ttf")
F_SERIF_I = _font_path("LiberationSerif-Italic.ttf")

GREEN = (31, 81, 51)
INK = (24, 24, 24)
GREY = (96, 102, 96)
WHITE = (255, 255, 255)
W = H = 1200


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        try:
            return ImageFont.truetype(os.path.join(_FONTS_LOCAL, os.path.basename(path)), size)
        except Exception:
            return ImageFont.load_default()


def _tw(draw, s, fnt, tracking=0):
    w = draw.textbbox((0, 0), s, font=fnt)[2]
    return w + tracking * max(len(s) - 1, 0)


def _tracked(draw, xy, s, fnt, fill, tracking=0):
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textbbox((0, 0), ch, font=fnt)[2] + tracking
    return x


def _wrap(draw, s, fnt, max_w):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if _tw(draw, t, fnt) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def _connector(draw, x0, y0, x1, y1):
    ex = x0 + int((x1 - x0) * 0.72)
    draw.line([(x0, y0), (ex, y0), (x1, y1)], fill=GREEN, width=3)
    draw.ellipse([x1 - 7, y1 - 7, x1 + 7, y1 + 7], fill=GREEN)


def _load_local_or_remote(url: str) -> Image.Image:
    """Resolve a product image URL (local /api/uploads/... or remote http) → PIL."""
    base = url.split("?")[0]
    if base.startswith("http://") or base.startswith("https://"):
        r = requests.get(base, timeout=25)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    # local: /api/uploads/<rest>  ->  backend/uploads/<rest>
    rest = base.split("/api/uploads/", 1)[-1]
    path = os.path.join(BACKEND, "uploads", rest)
    return Image.open(path).convert("RGB")


def _whiten_bg(im: Image.Image, threshold: int = 232) -> Image.Image:
    """Force the product background to STRICTLY pure white (255,255,255).

    Two passes so studio shots with slightly grey / off-white / gradient
    backdrops still come out pure white:
      1. Corner flood-fill: from each corner, convert the connected near-white
         region to pure white (handles soft grey studio backgrounds).
      2. Global sweep: any remaining near-white pixel is snapped to pure white.
    Pixels darker than the threshold (the actual bottle) are left untouched.
    """
    from PIL import ImageDraw as _ID
    im = im.convert("RGB")
    w, h = im.size
    try:
        # Pass 1 — flood fill from the 4 corners with a generous tolerance.
        for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            cr, cg, cb = im.getpixel(corner)
            if cr >= 200 and cg >= 200 and cb >= 200:  # only fill light backgrounds
                _ID.floodfill(im, corner, WHITE, thresh=60)
    except Exception:
        pass
    # Pass 2 — global near-white snap.
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = WHITE
    return im


def _crop_bottle(im: Image.Image) -> Image.Image:
    """Crop the product (incl. soft shadow) out of a white-ish background."""
    diff = ImageChops.difference(im, Image.new("RGB", im.size, WHITE)).convert("L")
    mask = diff.point(lambda p: 255 if p > 12 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return im
    pad = 8
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def _paste(canvas, bottle, target_h, cx, bottom, keep_clear_x=None):
    """Composite the bottle onto the card THROUGH ITS ALPHA CHANNEL.

    This is the fix for the "white block covering the ingredient text" bug.
    The bottle used to be a rectangular RGB crop whose white studio backdrop
    was pasted opaquely over whatever copy sat beneath it. The bottle is now
    RGBA (background cut away in `brand_bottles`), so only the product's own
    pixels land on the card and every word stays readable.

    `keep_clear_x` is a hard left boundary: if the scaled bottle would reach
    into the text column, it is nudged right (and shrunk as a last resort) so
    product and copy can never collide.
    """
    bottle = bottle.convert("RGBA")
    scale = target_h / bottle.height
    nw = max(1, int(bottle.width * scale))
    left = int(cx - nw / 2)

    if keep_clear_x is not None and left < keep_clear_x:
        # 1) try sliding right while staying on-canvas
        max_left = W - nw - 12
        if max_left >= keep_clear_x:
            left = keep_clear_x
        else:
            # 2) not enough room — scale the bottle down to fit the clear zone
            avail = max(80, W - 12 - keep_clear_x)
            scale = min(scale, avail / bottle.width)
            target_h = max(1, int(bottle.height * scale))
            nw = max(1, int(bottle.width * scale))
            left = keep_clear_x

    b = bottle.resize((nw, target_h), Image.LANCZOS)
    top = int(bottom - target_h)

    # Soft contact shadow so a cut-out bottle still sits naturally on white.
    try:
        from PIL import ImageFilter as _IF
        sh_h = max(10, int(target_h * 0.035))
        shadow = Image.new("RGBA", (nw, sh_h * 3), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse(
            [int(nw * 0.10), sh_h, int(nw * 0.90), sh_h * 2], fill=(120, 128, 120, 70)
        )
        shadow = shadow.filter(_IF.GaussianBlur(sh_h * 0.5))
        canvas.paste(shadow, (left, int(bottom - sh_h * 1.4)), shadow)
    except Exception:
        pass

    canvas.paste(b, (left, top), b)
    return left, top, nw


def _canvas():
    return Image.new("RGB", (W, H), WHITE)


# --------------------------------------------------------------- layouts
def _layout_a(bottle, word, story, desc, solves, best_for):
    im = _canvas(); d = ImageDraw.Draw(im)
    f_eb = font(F_BOLD, 30); f_h = font(F_BOLD, 112)
    f_sub = font(F_SERIF_B, 46); f_sm = font(F_REG, 27)
    _tracked(d, (70, 250), "FORMULA TECHNOLOGY", f_eb, INK, 14)
    y = 316
    # shrink headline to fit
    while _tw(d, word, f_h) > 720 and f_h.size > 48:
        f_h = font(F_BOLD, f_h.size - 4)
    d.text((64, y), word, font=f_h, fill=GREEN)
    hw = _tw(d, word, f_h); y += f_h.size + 30
    d.line([(70, y), (70 + hw + 12, y)], fill=GREEN, width=5); y += 34
    d.text((70, y), story, font=f_sub, fill=GREEN); y += 82
    for ln in _wrap(d, f"Solves: {solves}.", f_sm, 560):
        d.text((70, y), ln, font=f_sm, fill=GREY); y += 38
    y += 8
    for ln in _wrap(d, f"Made for: {best_for}.", f_sm, 560):
        d.text((70, y), ln, font=f_sm, fill=GREY); y += 38
    y += 8
    for ln in _wrap(d, desc, f_sm, 560):
        d.text((70, y), ln, font=f_sm, fill=INK); y += 38
    left, top, _ = _paste(im, bottle, 760, 935, 1160, keep_clear_x=660)
    _connector(d, 70 + hw + 12, 316 + f_h.size + 30, left + 60, top + 260)
    return im


def _layout_b(bottle, word, story, desc, solves, best_for, name):
    im = _canvas(); d = ImageDraw.Draw(im)
    f_c = font(F_BOLD, 60); f_sub = font(F_SERIF_B, 34)
    f_ct = font(F_BOLD, 30); f_cb = font(F_REG, 25)
    claim = f"{word} CARRIES THE {name} POSITIONING."
    y = 90
    for ln in _wrap(d, claim, f_c, 1040):
        d.text(((W - _tw(d, ln, f_c)) / 2, y), ln, font=f_c, fill=GREEN); y += 72
    y += 8
    d.text(((W - _tw(d, story, f_sub)) / 2, y), story, font=f_sub, fill=INK)
    ct = 480
    d.line([(400, ct), (400, 1080)], fill=(210, 215, 210), width=3)
    d.line([(800, ct), (800, 1080)], fill=(210, 215, 210), width=3)
    d.text((70, ct), "WHAT IT SOLVES", font=f_ct, fill=GREEN)
    d.line([(70, ct + 48), (330, ct + 48)], fill=GREEN, width=3)
    yy = ct + 76
    for ln in _wrap(d, solves + ".", f_cb, 290):
        d.text((70, yy), ln, font=f_cb, fill=INK); yy += 36
    d.text((870, ct), "WHO IT IS FOR", font=f_ct, fill=GREEN)
    d.line([(870, ct + 48), (1130, ct + 48)], fill=GREEN, width=3)
    yy = ct + 76
    for ln in _wrap(d, best_for + ".", f_cb, 290):
        d.text((870, yy), ln, font=f_cb, fill=INK); yy += 36
    _paste(im, bottle, 660, 600, 1150, keep_clear_x=415)
    return im


def _layout_c(bottle, word, story, desc, solves, best_for):
    im = _canvas(); d = ImageDraw.Draw(im)
    f_h = font(F_BOLD, 92); f_sub = font(F_BOLD, 32)
    f_lab = font(F_BOLD, 40); f_cap = font(F_REG, 27)
    d.text((70, 90), "FORMULA", font=f_h, fill=GREEN)
    d.text((70, 90 + f_h.size + 6), "TECHNOLOGY", font=f_h, fill=GREEN)
    y = 90 + 2 * f_h.size + 40
    story_up = story[4:].upper() if story.lower().startswith("the ") else story.upper()
    for ln in _wrap(d, f"THE {story_up}.", f_sub, 700):
        d.text((70, y), ln, font=f_sub, fill=INK); y += 44
    y += 14
    for ln in _wrap(d, f"Made for: {best_for}.", f_cap, 640):
        d.text((70, y), ln, font=f_cap, fill=GREY); y += 38
    cx, cy, rx, ry = 330, 870, 250, 120
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(219, 240, 224), outline=(176, 214, 188), width=5)
    d.ellipse([cx - rx + 22, cy - ry + 16, cx + rx - 22, cy + ry - 10], fill=(206, 233, 214))
    for bx, by, br in [(cx - 60, cy - 20, 46), (cx + 70, cy + 10, 34), (cx + 10, cy + 45, 24), (cx - 130, cy + 30, 20)]:
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=(235, 248, 239), outline=(190, 220, 198), width=3)
        d.ellipse([bx - br // 3, by - br // 2, bx + br // 6, by - br // 6], fill=WHITE)
    lab = font(F_BOLD, 40)
    while _tw(d, word, lab) > 340 and lab.size > 24:
        lab = font(F_BOLD, lab.size - 3)
    lw = _tw(d, word, lab)
    d.text((70, 640), word, font=lab, fill=GREEN)
    d.line([(70, 640 + lab.size + 8), (70 + lw, 640 + lab.size + 8)], fill=GREEN, width=4)
    _connector(d, 70 + lw, 640 + lab.size // 2, cx + 40, cy - 40)
    _paste(im, bottle, 800, 950, 1165, keep_clear_x=790)
    return im


def _layout_d(bottle, word, story, desc, solves, best_for):
    im = _canvas(); d = ImageDraw.Draw(im)
    f_eb = font(F_BOLD, 28); f_h = font(F_BOLD, 108)
    f_it = font(F_SERIF_I, 50); f_caps = font(F_BOLD, 27); f_sm = font(F_REG, 26)
    _tracked(d, (70, 210), "FORMULA TECHNOLOGY", f_eb, INK, 12)
    y = 270
    while _tw(d, word, f_h) > 720 and f_h.size > 44:
        f_h = font(F_BOLD, f_h.size - 4)
    d.text((64, y), word, font=f_h, fill=GREEN)
    hw = _tw(d, word, f_h); y += f_h.size + 30
    d.line([(70, y), (70 + hw + 10, y)], fill=GREEN, width=5); y += 34
    d.text((70, y), story, font=f_it, fill=GREEN); y += 96
    para = f"IN THIS FORMULA, {word} LEADS THE STORY — {desc.upper()}"
    for ln in _wrap(d, para, f_caps, 620):
        d.text((70, y), ln, font=f_caps, fill=INK); y += 40
    yy = 1050
    for ln in _wrap(d, f"Best for: {best_for}.", f_sm, 600):
        d.text((70, yy), ln, font=f_sm, fill=GREY); yy += 34
    left, top, _ = _paste(im, bottle, 740, 940, 1155, keep_clear_x=710)
    _connector(d, 70 + hw + 10, 270 + f_h.size + 30, left + 50, top + 240)
    return im


CERT_TEMPLATE = os.path.join(BACKEND, "uploads", "assets", "cert_template.jpg")
CERT_TEMPLATE_URL = "https://res.cloudinary.com/dtj1zuhkl/image/upload/v1785093629/celesta-glow/products/36f1837c154d4e43bfefbe3f348f2327.jpg"
CERT_BROWN = (124, 78, 45)


def _ensure_cert_template() -> Image.Image:
    """Load the fixed certificate template (cached on disk)."""
    if not os.path.exists(CERT_TEMPLATE):
        os.makedirs(os.path.dirname(CERT_TEMPLATE), exist_ok=True)
        r = requests.get(CERT_TEMPLATE_URL, timeout=25)
        r.raise_for_status()
        with open(CERT_TEMPLATE, "wb") as f:
            f.write(r.content)
    return Image.open(CERT_TEMPLATE).convert("RGB")


def _certificate(name, ingredients=None, batch=None):
    """Use the brand's fixed certificate template and overlay ONLY the product
    name in the same brown, bold, underlined style as the original design.

    The template is 1600x1182; the product-name line sits centred at ~34% from
    the top. We white-box the baked-in sample name and draw the new one.
    """
    im = _ensure_cert_template()
    W0, H0 = im.size
    d = ImageDraw.Draw(im)

    # Clean product name (title-case, no size codes clutter)
    txt = (name or "Product").strip()

    # Cover the baked-in sample name with a pure-white band.
    band_top = int(H0 * 0.300)
    band_bot = int(H0 * 0.365)
    d.rectangle([int(W0 * 0.16), band_top, int(W0 * 0.84), band_bot], fill=WHITE)

    # Fit the font width to a max line width, then draw centred.
    max_w = int(W0 * 0.66)
    size = 54
    f = font(F_BOLD, size)
    while _tw(d, txt, f) > max_w and size > 26:
        size -= 2
        f = font(F_BOLD, size)
    tw = _tw(d, txt, f)
    x = (W0 - tw) / 2
    y = int(H0 * 0.312)
    d.text((x, y), txt, font=f, fill=CERT_BROWN)
    # Underline in the same brown, matching the original design.
    uy = y + size + 8
    d.line([(x, uy), (x + tw, uy)], fill=CERT_BROWN, width=3)
    return im


def _batch(slug):
    return "CG-" + hashlib.md5(slug.encode()).hexdigest()[:6].upper()


def _layout_solution(bottle, concern_label, problem, change, audience):
    """Problem -> Solution editorial card. Pure-white, brand green/white theme.
    Shows the exact concern, the shopper's problem, and how the formula changes
    it for THIS audience (gender / skin type / age)."""
    im = _canvas(); d = ImageDraw.Draw(im)
    f_eb = font(F_BOLD, 28); f_h = font(F_BOLD, 74)
    f_lab = font(F_BOLD, 26); f_body = font(F_REG, 27); f_aud = font(F_BOLD, 24)
    _tracked(d, (70, 96), "HOW IT WORKS FOR YOU", f_eb, INK, 10)
    y = 150
    for ln in _wrap(d, concern_label, f_h, 700):
        d.text((66, y), ln, font=f_h, fill=GREEN); y += f_h.size + 6
    d.line([(70, y + 6), (70 + 220, y + 6)], fill=GREEN, width=5)
    y += 46
    # THE PROBLEM
    d.text((70, y), "THE PROBLEM", font=f_lab, fill=(150, 60, 60)); y += 40
    for ln in _wrap(d, problem, f_body, 640):
        d.text((70, y), ln, font=f_body, fill=GREY); y += 38
    y += 26
    # THE CHANGE
    d.text((70, y), "THE CHANGE", font=f_lab, fill=GREEN); y += 40
    for ln in _wrap(d, change, f_body, 640):
        d.text((70, y), ln, font=f_body, fill=INK); y += 38
    # audience pill
    ay = 1070
    pill = f"For {audience}"
    pw = _tw(d, pill, f_aud)
    d.rounded_rectangle([70, ay, 70 + pw + 44, ay + 52], radius=26, fill=(233, 246, 238))
    d.text((92, ay + 12), pill, font=f_aud, fill=GREEN)
    _paste(im, bottle, 620, 950, 1150, keep_clear_x=730)
    return im


def _clean_actives(key_ingredients):
    parts = [p.strip() for p in re.split(r"[+,]", key_ingredients or "") if p.strip()]
    out = []
    for p in parts:
        out.append(re.sub(r"\s*\d.*$", "", p).strip() or p)
    return out[:4] or ["clinically-proven actives"]


def build_alt_texts(name, concern_label, stories, has_solution=False):
    """Auto SEO alt text for every generated image, tied to the on-image text."""
    alts = [f"{name} — pure-white product shot for {concern_label}"]
    for (word, _s, _d) in stories[:4]:
        alts.append(f"{name} formula technology: {word.title()} for {concern_label}")
    if has_solution:
        alts.append(f"How {name} solves {concern_label} — problem and result")
    return alts


def _stories_from_product(product):
    """Return up to 4 (word, story, desc) tuples from the product."""
    ts = product.get("tech_stories") or []
    if ts:
        return [(t.get("ingredient", "ACTIVE"), t.get("headline", "The formula story"),
                 t.get("description", "A carefully chosen active ingredient.")) for t in ts[:4]]
    ki = product.get("key_ingredients") or ""
    parts = [p.strip() for p in re.split(r"[+,]", ki) if p.strip()][:4]
    out = []
    for p in parts:
        word = re.sub(r"\s*\d.*$", "", p).strip().upper() or p.upper()
        out.append((word, "The formula story", f"{p} is a key active in this formula."))
    while len(out) < 4:
        out.append(("ACTIVE", "The formula story", "A carefully chosen active ingredient."))
    return out


def _placeholder_bottle() -> Image.Image:
    """Draw a clean Celesta Glow bottle so galleries/cards still render when the
    product has NO uploaded hero photo. Pure-white, brand green/grey, minimalist —
    matches the studio look of the real shots. Returns a tightly cropped bottle."""
    cw, ch = 460, 860
    im = Image.new("RGB", (cw, ch), WHITE)
    d = ImageDraw.Draw(im)
    body_l, body_t, body_r, body_b = 92, 196, 368, 812
    # soft shadow
    d.ellipse([body_l + 20, body_b - 24, body_r - 20, body_b + 26], fill=(238, 240, 238))
    # bottle body
    d.rounded_rectangle([body_l, body_t, body_r, body_b], radius=34,
                        fill=(252, 253, 252), outline=(206, 214, 208), width=4)
    # subtle left highlight
    d.rounded_rectangle([body_l + 14, body_t + 18, body_l + 40, body_b - 30],
                        radius=12, fill=(244, 248, 245))
    # cap / pump
    d.rounded_rectangle([158, 96, 302, 200], radius=16, fill=(228, 233, 229), outline=(198, 206, 200), width=3)
    d.rounded_rectangle([196, 60, 264, 104], radius=10, fill=(214, 221, 215))
    # label block
    lx0, lx1 = body_l + 34, body_r - 34
    cx = (lx0 + lx1) // 2
    fb = font(F_BOLD, 40); fs = font(F_REG, 22)
    top = body_t + 120
    for i, ch_ in enumerate(("CELESTA",)):
        w_ = _tw(d, ch_, fb)
        _tracked(d, (cx - (w_ + 7 * 6) / 2, top), ch_, fb, GREEN, 6)
    _tracked(d, (cx - _tw(d, "GLOW", fs) / 2 - 20, top + 54), "GLOW", fs, GREY, 8)
    d.line([(cx - 60, top + 92), (cx + 60, top + 92)], fill=(200, 214, 204), width=3)
    fsm = font(F_REG, 20)
    for j, ln in enumerate(["DERMATOLOGIST", "TESTED FORMULA"]):
        d.text((cx - _tw(d, ln, fsm) / 2, top + 116 + j * 26), ln, font=fsm, fill=GREY)
    return _crop_bottle(im)


def _resolve_bottle(product: dict):
    """Return the APPROVED brand bottle for this product, background removed.

    STRICT BRAND RULE: only the two owner-supplied bottles (the Advanced Face
    Serum pump and the Advanced Retinoid Night Cream pump) may appear in
    generated artwork. Whatever image a product row happens to carry is
    deliberately ignored — scraped studio shots, AI-invented bottles and the
    old drawn placeholder are all rejected. The product's own name and actives
    are re-printed onto the approved bottle so each card still reads correctly.

    Returns RGBA so `_paste` can composite it without covering any text.
    """
    from services import brand_bottles
    try:
        return brand_bottles.resolve(product or {})
    except Exception as exc:
        # Last resort: the un-relabelled master, still an approved bottle.
        logging.error(f"[gallery] approved-bottle relabel failed: {exc}")
        return brand_bottles.resolve(product or {}, relabelled=False)


def _skin_panel(kind: str, concern_label: str, audience: str) -> Image.Image:
    """Draw an on-brand macro 'skin' panel. kind='before' = duller/uneven,
    kind='after' = brighter/even. Deterministic, budget-free, always renders."""
    import random as _r
    seed = int(hashlib.md5((kind + concern_label + audience).encode()).hexdigest()[:8], 16)
    rnd = _r.Random(seed)
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    is_after = kind == "after"
    base = (232, 198, 172) if is_after else (214, 176, 146)
    # skin field (leave a white margin so it reads as a tasteful swatch)
    m = 70
    px0, py0, px1, py1 = m, m + 90, W - m, H - m
    radius = 48
    # Build the textured skin on its OWN layer, then composite through a
    # rounded-rectangle mask so nothing bleeds past the panel edges.
    skin = Image.new("RGB", (W, H), base)
    sd = ImageDraw.Draw(skin)
    x0, y0, x1, y1 = px0 + 4, py0 + 4, px1 - 4, py1 - 4
    if is_after:
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        for _ in range(180):
            rx = rnd.randint(x0, x1); ry = rnd.randint(y0, y1)
            dist = ((rx - cx) ** 2 + (ry - cy) ** 2) ** 0.5
            if dist < 360:
                rr = rnd.randint(30, 70)
                sd.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=(240, 212, 190))
    else:
        for _ in range(120):
            rx = rnd.randint(x0, x1); ry = rnd.randint(y0, y1)
            rr = rnd.randint(24, 80)
            shade = rnd.choice([(196, 156, 128), (188, 146, 120), (204, 168, 140)])
            sd.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=shade)
        for _ in range(16):
            rx = rnd.randint(x0, x1); ry = rnd.randint(y0, y1)
            rr = rnd.randint(8, 18)
            sd.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=(192, 120, 110))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([px0, py0, px1, py1], radius=radius, fill=255)
    im.paste(skin, (0, 0), mask)
    # top eyebrow + label pill
    f_eb = font(F_BOLD, 26); f_pill = font(F_BOLD, 34); f_cap = font(F_REG, 26)
    _tracked(d, (m, m - 4), "REAL SKIN RESULT", f_eb, INK, 8)
    lbl = "AFTER" if is_after else "BEFORE"
    pill_fill = (233, 246, 238) if is_after else (245, 235, 233)
    pill_text = GREEN if is_after else (150, 60, 60)
    pw = _tw(d, lbl, f_pill)
    d.rounded_rectangle([m, m + 108, m + pw + 52, m + 108 + 58], radius=29, fill=pill_fill)
    d.text((m + 26, m + 120), lbl, font=f_pill, fill=pill_text)
    # bottom caption strip
    cap = ("Even, brighter & radiant" if is_after else "Dull, uneven & textured")
    sub = f"{concern_label} · {audience}" if audience else concern_label
    d.rounded_rectangle([m, H - m - 120, W - m, H - m - 24], radius=22, fill=WHITE)
    d.text((m + 28, H - m - 108), cap, font=f_pill, fill=pill_text)
    d.text((m + 28, H - m - 58), sub, font=f_cap, fill=GREY)
    return im


def before_after_pair(slug: str, concern_label: str, audience: str = "") -> dict:
    """Compose a BEFORE + AFTER macro-skin pair (brand theme) and save both to
    Cloudinary. Returns {before_image, after_image} as PERMANENT URLs."""
    concern_label = concern_label or "Visible skin concerns"
    before = _skin_panel("before", concern_label, audience)
    after = _skin_panel("after", concern_label, audience)
    return {
        "before_image": _persist(before, slug, "before", f"{slug}-before.jpg"),
        "after_image": _persist(after, slug, "after", f"{slug}-after.jpg"),
    }


def generate_gallery_and_certificate(product: dict, do_gallery=True, do_certificate=True,
                                     do_before_after=True, bottle_override=None,
                                     hero_url=None) -> dict:
    """Compose gallery cards + certificate (+ before/after) for a product dict.

    Returns fields to $set. Every image is stored on Cloudinary under a
    deterministic public_id, so the returned URLs are permanent and survive
    redeploys.

    Image 1 is ALWAYS a freshly rendered high-quality hero shot of the approved
    brand bottle (quality 97, 4:4:4 chroma, 1400px) — this replaces the soft,
    over-compressed hero the storefront used to show. Images 2-5 are the
    Formula-Technology cards, onto which the bottle is composited through its
    alpha channel so it can never cover the ingredient copy.
    """
    slug = product["slug"]

    bottle = bottle_override if bottle_override is not None else _resolve_bottle(product)
    name = (product.get("short_name") or product.get("name") or "PRODUCT").upper()
    solves = product.get("solves") or product.get("concern_label") or "Common skin concerns for your skin type"
    best_for = product.get("best_for") or product.get("exclusive_for") or "Everyday skincare for all skin types"
    stories = _stories_from_product(product)

    result = {}

    # ---- Image 1: hero shot ------------------------------------------------
    # If an AI-generated (or upscaled) hero URL was supplied, use it verbatim so
    # the hero and every gallery card share the EXACT same bottle. Otherwise
    # render a crisp Pillow hero from the approved brand bottle.
    hero = hero_url
    if not hero:
        try:
            from services import brand_bottles
            hero = _persist(
                brand_bottles.hero_bytes(product), slug, "hero", f"{slug}-hero.jpg",
            )
        except Exception as exc:
            logger.error(f"[gallery] hero render failed for {slug}: {exc}")

    if do_gallery:
        layouts = [
            _layout_a(bottle, *stories[0], solves, best_for),
            _layout_b(bottle, *stories[1], solves, best_for, name),
            _layout_c(bottle, *stories[2], solves, best_for),
            _layout_d(bottle, *stories[3], solves, best_for),
        ]
        tech_urls = []
        for i, img in enumerate(layouts, start=1):
            tech_urls.append(_persist(img, slug, f"tech{i}", f"{slug}-tech{i}.jpg"))
        new_imgs = ([hero] if hero else []) + tech_urls
        result["images"] = new_imgs
        result["tech_stories"] = [
            {"ingredient": w, "headline": s, "description": d} for (w, s, d) in stories
        ]
    elif hero:
        result["images"] = [hero] + [u for u in (product.get("images") or []) if u][1:]

    if do_certificate:
        cert = _certificate(product.get("name", "Product"))
        result["test_report_image"] = _persist(cert, slug, "certificate", f"{slug}-certificate.jpg")
        result["test_report_lab"] = "Mascot Spincontrol — Clinical Research"

    if do_before_after:
        audience = product.get("exclusive_for") or product.get("best_for") or ""
        ba = before_after_pair(slug, solves, audience)
        result["before_after"] = [
            {"type": "before", "image": ba["before_image"], "caption": "Week 0 — baseline"},
            {"type": "after", "image": ba["after_image"], "caption": "After consistent use"},
        ]
        result["before_after_before"] = ba["before_image"]
        result["before_after_after"] = ba["after_image"]

    return result


async def generate_and_persist(db, product: dict, do_gallery=True,
                               do_certificate=True, do_before_after=True,
                               bottle_override=None, hero_url=None) -> dict:
    """Async entry point for FastAPI routes.

    Pillow composition plus the Cloudinary uploads are CPU/IO bound and fully
    synchronous, so they run in a worker thread — a route awaiting this never
    blocks the event loop. Cloudinary credentials are verified up front so the
    caller gets a clear 503-style error instead of a half-generated gallery
    whose URLs would die on the next redeploy.
    """
    import asyncio
    from services import cloudinary_service as cs

    if not await cs.ensure_configured(db):
        raise RuntimeError(
            "Cloudinary is not configured — image generation is disabled because "
            "the generated artwork could not be stored permanently. Set "
            "CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET."
        )
    return await asyncio.to_thread(
        generate_gallery_and_certificate, product,
        do_gallery, do_certificate, do_before_after, bottle_override, hero_url,
    )
