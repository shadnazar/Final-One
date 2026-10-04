"""Compose the 4 'Formula Technology' gallery cards per product with PIL.

Why PIL instead of AI: the bottle is pasted from the brand's actual reference
photo, so it is PIXEL-IDENTICAL in every image (hero + all gallery cards), the
background is pure white (#FFFFFF), and all typography is crisp and correctly
spelled. Four distinct editorial layouts, one shared green/white theme.

Run:  python /app/backend/scripts/compose_tech_cards.py
Overwrites uploads/products/<slug>-tech{1..4}.jpg (same URLs the DB uses).
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRODUCTS_DIR = os.path.join(BACKEND, "uploads", "products")
REFS_DIR = os.path.join(BACKEND, "uploads", "refs")

F_DIR = "/usr/share/fonts/truetype/liberation"
F_BOLD = os.path.join(F_DIR, "LiberationSans-Bold.ttf")
F_REG = os.path.join(F_DIR, "LiberationSans-Regular.ttf")
F_SERIF_B = os.path.join(F_DIR, "LiberationSerif-Bold.ttf")
F_SERIF_I = os.path.join(F_DIR, "LiberationSerif-Italic.ttf")

GREEN = (31, 81, 51)
INK = (24, 24, 24)
GREY = (96, 102, 96)
WHITE = (255, 255, 255)
W = H = 1200

PRODUCTS = {
    "celesta-glow-radiance-serum": {
        "ref": "ref-serum.png", "name": "ADVANCED FACE SERUM",
        "solves": "Dullness, dark spots and uneven skin tone",
        "best_for": "Anyone 25+ who wants brighter, firmer, glowing skin in 4 weeks",
        "tech": [
            ("NIACINAMIDE", "The even-tone story", "Niacinamide supports a brighter, more even-looking complexion."),
            ("ALPHA ARBUTIN", "The dark-spot story", "Alpha arbutin fades the look of dark spots and pigmentation."),
            ("VITAMIN C", "The glow story", "Vitamin C boosts radiance and defends against daily stress."),
            ("HYALURONIC ACID", "The deep-hydration story", "Hyaluronic acid holds moisture for a plump, dewy finish."),
        ],
    },
    "celesta-glow-repair-night-cream": {
        "ref": "ref-nightcream.png", "name": "ADVANCED RETINOID NIGHT CREAM",
        "solves": "Fine lines, wrinkles and overnight moisture loss",
        "best_for": "Mature or dry skin needing overnight repair and firming",
        "tech": [
            ("RETINOID", "The visible-firming story", "Retinoid accelerates renewal to soften fine lines and wrinkles."),
            ("HYALURONIC ACID", "The overnight-hydration story", "Hyaluronic acid keeps skin plump and hydrated until morning."),
            ("PEPTIDES", "The bounce-back story", "Peptides help skin look firmer and more resilient over time."),
            ("CERAMIDES", "The barrier-repair story", "Ceramides rebuild the barrier for calm, comfortable skin."),
        ],
    },
    "celesta-glow-under-eye-cream": {
        "ref": "ref-eye.png", "name": "CAFFEINE UNDER EYE CREAM",
        "solves": "Dark circles, puffiness and tired-looking eyes",
        "best_for": "Tired eyes from screens and late nights needing a quick refresh",
        "tech": [
            ("CAFFEINE", "The refreshed, awake-looking story", "Caffeine de-puffs and energises tired-looking under-eyes."),
            ("NIACINAMIDE", "The even-looking tone story", "Niacinamide helps fade dark circles for a brighter look."),
            ("HYALURONIC ACID", "The smooth-hydration story", "Hyaluronic acid plumps fine lines around the eyes."),
            ("PEPTIDES", "The firming story", "Peptides smooth and firm the delicate under-eye skin."),
        ],
    },
    "celesta-glow-mineral-sunscreen-spf50": {
        "ref": "ref-sunscreen.png", "name": "DAILY DEFENSE SUNSCREEN",
        "solves": "UV damage, pigmentation and white-cast sunscreens",
        "best_for": "Daily UV protection on every Indian skin tone, zero white cast",
        "tech": [
            ("SPF 50 PA+++", "The daily-defense story", "SPF 50 PA+++ gives verified broad-spectrum UVA/UVB protection."),
            ("ZINC OXIDE", "The mineral-shield story", "Micronised zinc oxide blocks rays with an invisible finish."),
            ("NIACINAMIDE", "The brightening story", "Niacinamide brightens while it protects against sun stress."),
            ("VITAMIN E", "The antioxidant story", "Vitamin E neutralises free radicals from daily sun exposure."),
        ],
    },
    "celesta-glow-gentle-cleanser": {
        "ref": "ref-cleanser.png", "name": "GENTLE CLEANSER",
        "solves": "Impurities, tightness and sensitivity from harsh cleansers",
        "best_for": "Sensitive and combination skin that needs a gentle daily cleanse",
        "tech": [
            ("AMINO ACIDS", "The no-strip story", "Amino-acid surfactants clean deeply without tightness."),
            ("NIACINAMIDE", "The clarity story", "Niacinamide keeps skin clear, calm and even-looking."),
            ("SALICYLIC ACID", "The pore-clearing story", "Salicylic acid unclogs pores for a smooth, clear finish."),
            ("ALOE VERA", "The soothing story", "Aloe vera calms and comforts sensitive, reactive skin."),
        ],
    },
}


def font(path, size):
    return ImageFont.truetype(path, size)


def text_w(draw, s, fnt, tracking=0):
    w = draw.textbbox((0, 0), s, font=fnt)[2]
    return w + tracking * max(len(s) - 1, 0)


def draw_tracked(draw, xy, s, fnt, fill, tracking=0):
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textbbox((0, 0), ch, font=fnt)[2] + tracking
    return x


def wrap(draw, s, fnt, max_w):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if text_w(draw, t, fnt) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def load_bottle(ref_name):
    """Crop the bottle (incl. soft shadow) out of the white-background reference."""
    im = Image.open(os.path.join(REFS_DIR, ref_name)).convert("RGB")
    diff = ImageChops.difference(im, Image.new("RGB", im.size, WHITE)).convert("L")
    mask = diff.point(lambda p: 255 if p > 10 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return im
    pad = 6
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def paste_bottle(canvas, bottle, target_h, cx, bottom):
    scale = target_h / bottle.height
    nw = int(bottle.width * scale)
    b = bottle.resize((nw, target_h), Image.LANCZOS)
    canvas.paste(b, (int(cx - nw / 2), int(bottom - target_h)))
    return int(cx - nw / 2), int(bottom - target_h), nw  # left, top, width


def connector(draw, x0, y0, x1, y1, elbow=None):
    """Thin green elbow line from (x0,y0) to (x1,y1), with a dot at the end."""
    ex = elbow if elbow is not None else x0 + int((x1 - x0) * 0.72)
    draw.line([(x0, y0), (ex, y0), (x1, y1)], fill=GREEN, width=3)
    draw.ellipse([x1 - 7, y1 - 7, x1 + 7, y1 + 7], fill=GREEN)


def canvas_new():
    return Image.new("RGB", (W, H), WHITE)


# ----------------------------------------------------------------- layouts
def layout_a(spec, bottle, tech):
    """Headline-left + connector (NIACINAMIDE reference)."""
    word, story, desc = tech
    im = canvas_new(); d = ImageDraw.Draw(im)
    f_eyebrow = font(F_BOLD, 30); f_head = font(F_BOLD, 118)
    f_sub = font(F_SERIF_B, 46); f_small = font(F_REG, 27)

    y = 250
    draw_tracked(d, (70, y), "FORMULA TECHNOLOGY", f_eyebrow, INK, tracking=14)
    y += 66
    d.text((64, y), word, font=f_head, fill=GREEN)
    head_w = text_w(d, word, f_head)
    y += 150
    d.line([(70, y), (70 + head_w + 12, y)], fill=GREEN, width=5)
    y += 36
    d.text((70, y), story, font=f_sub, fill=GREEN)
    y += 84
    for line in wrap(d, f"Solves: {spec['solves']}.", f_small, 560):
        d.text((70, y), line, font=f_small, fill=GREY); y += 38
    y += 10
    for line in wrap(d, f"Made for: {spec['best_for']}.", f_small, 560):
        d.text((70, y), line, font=f_small, fill=GREY); y += 38
    y += 10
    for line in wrap(d, desc, f_small, 560):
        d.text((70, y), line, font=f_small, fill=INK); y += 38

    left, top, _ = paste_bottle(im, bottle, 760, 935, 1160)
    connector(d, 70 + head_w + 12, 250 + 66 + 150, left + 60, top + 260)
    return im


def layout_b(spec, bottle, tech):
    """Big claim on top, bottle centered, two side columns (SPF reference)."""
    word, story, desc = tech
    im = canvas_new(); d = ImageDraw.Draw(im)
    f_claim = font(F_BOLD, 62); f_sub = font(F_SERIF_B, 34)
    f_ct = font(F_BOLD, 30); f_cb = font(F_REG, 25)

    claim = f"{word} CARRIES THE {spec['name']} POSITIONING."
    lines = wrap(d, claim, f_claim, 1040)
    y = 90
    for ln in lines:
        lw = text_w(d, ln, f_claim)
        d.text(((W - lw) / 2, y), ln, font=f_claim, fill=GREEN)
        y += 74
    y += 10
    sw = text_w(d, story, f_sub)
    d.text(((W - sw) / 2, y), story, font=f_sub, fill=INK)

    # side columns
    col_top = 480
    d.line([(400, col_top), (400, 1080)], fill=(210, 215, 210), width=3)
    d.line([(800, col_top), (800, 1080)], fill=(210, 215, 210), width=3)

    d.text((70, col_top), "WHAT IT SOLVES", font=f_ct, fill=GREEN)
    d.line([(70, col_top + 48), (330, col_top + 48)], fill=GREEN, width=3)
    yy = col_top + 76
    for ln in wrap(d, spec["solves"] + ".", f_cb, 280):
        d.text((70, yy), ln, font=f_cb, fill=INK); yy += 36

    d.text((870, col_top), "WHO IT IS FOR", font=f_ct, fill=GREEN)
    d.line([(870, col_top + 48), (1130, col_top + 48)], fill=GREEN, width=3)
    yy = col_top + 76
    for ln in wrap(d, spec["best_for"] + ".", f_cb, 280):
        d.text((870, yy), ln, font=f_cb, fill=INK); yy += 36

    paste_bottle(im, bottle, 660, 600, 1150)
    return im


def layout_c(spec, bottle, tech):
    """Giant headline top-left + petri-dish ingredient visual (petri reference)."""
    word, story, desc = tech
    im = canvas_new(); d = ImageDraw.Draw(im)
    f_head = font(F_BOLD, 96); f_sub = font(F_BOLD, 32)
    f_lab = font(F_BOLD, 40); f_cap = font(F_REG, 27)

    y = 90
    d.text((70, y), "FORMULA", font=f_head, fill=GREEN); y += 108
    d.text((70, y), "TECHNOLOGY", font=f_head, fill=GREEN); y += 140
    story_up = story[4:].upper() if story.lower().startswith("the ") else story.upper()
    for ln in wrap(d, f"THE {story_up}.", f_sub, 700):
        d.text((70, y), ln, font=f_sub, fill=INK); y += 44
    y += 16
    for ln in wrap(d, f"Made for: {spec['best_for']}.", f_cap, 640):
        d.text((70, y), ln, font=f_cap, fill=GREY); y += 38

    # petri dish with gel + bubbles
    cx, cy, rx, ry = 330, 870, 250, 120
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(219, 240, 224), outline=(176, 214, 188), width=5)
    d.ellipse([cx - rx + 22, cy - ry + 16, cx + rx - 22, cy + ry - 10], fill=(206, 233, 214))
    for bx, by, br in [(cx - 60, cy - 20, 46), (cx + 70, cy + 10, 34), (cx + 10, cy + 45, 24), (cx - 130, cy + 30, 20)]:
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=(235, 248, 239), outline=(190, 220, 198), width=3)
        d.ellipse([bx - br // 3, by - br // 2, bx + br // 6, by - br // 6], fill=WHITE)

    lw = text_w(d, word, f_lab)
    d.text((70, 640), word, font=f_lab, fill=GREEN)
    d.line([(70, 640 + 52), (70 + lw, 640 + 52)], fill=GREEN, width=4)
    connector(d, 70 + lw, 640 + 26, cx + 40, cy - 40)

    paste_bottle(im, bottle, 800, 950, 1165)
    return im


def layout_d(spec, bottle, tech):
    """Editorial: serif italic accent line + caps paragraph (CAFFEINE reference)."""
    word, story, desc = tech
    im = canvas_new(); d = ImageDraw.Draw(im)
    f_eyebrow = font(F_BOLD, 28); f_head = font(F_BOLD, 112)
    f_it = font(F_SERIF_I, 50); f_caps = font(F_BOLD, 27); f_small = font(F_REG, 26)

    y = 210
    draw_tracked(d, (70, y), "FORMULA TECHNOLOGY", f_eyebrow, INK, tracking=12)
    y += 60
    d.text((64, y), word, font=f_head, fill=GREEN)
    head_w = text_w(d, word, f_head)
    y += 142
    d.line([(70, y), (70 + head_w + 10, y)], fill=GREEN, width=5)
    y += 34
    d.text((70, y), story, font=f_it, fill=GREEN)
    y += 96
    para = f"IN THIS FORMULA, {word} LEADS THE STORY — {desc.upper()}"
    for ln in wrap(d, para, f_caps, 620):
        d.text((70, y), ln, font=f_caps, fill=INK); y += 40

    yy = 1050
    for ln in wrap(d, f"Best for: {spec['best_for']}.", f_small, 600):
        d.text((70, yy), ln, font=f_small, fill=GREY); yy += 34

    left, top, _ = paste_bottle(im, bottle, 740, 940, 1155)
    connector(d, 70 + head_w + 10, 210 + 60 + 142, left + 50, top + 240)
    return im


def main():
    for slug, spec in PRODUCTS.items():
        bottle = load_bottle(spec["ref"])
        outs = [
            layout_a(spec, bottle, spec["tech"][0]),
            layout_b(spec, bottle, spec["tech"][1]),
            layout_c(spec, bottle, spec["tech"][2]),
            layout_d(spec, bottle, spec["tech"][3]),
        ]
        for i, img in enumerate(outs, start=1):
            path = os.path.join(PRODUCTS_DIR, f"{slug}-tech{i}.jpg")
            img.save(path, "JPEG", quality=92)
            print(f"  [ok] {slug}-tech{i}.jpg")
    print("done")


if __name__ == "__main__":
    main()
