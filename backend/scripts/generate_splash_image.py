"""One-shot script to render the Celesta Glow splash screen as a static PNG.

Renders at 2x resolution (1080x1920) so it looks sharp on retina mobile +
desktop. Saved to `/app/frontend/public/splash-celesta-glow.png` and used by
the SplashScreen component as a plain <img>. No fonts to load at runtime,
no animation, no Tailwind dependency — works the same on every device.

Run again whenever the design needs to change:
    python /app/backend/scripts/generate_splash_image.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920  # 9:16 — fits both mobile portrait and desktop centred crop
OUT = "/app/frontend/public/splash-celesta-glow.png"

# Palette
WHITE = (255, 255, 255, 255)
INK = (22, 22, 22, 255)
BODY_INK = (31, 31, 31, 255)
MINT = (127, 176, 105, 255)            # #7FB069
MINT_PALE = (185, 214, 164, 220)        # #b9d6a4
ORB_GREEN = (217, 237, 202, 80)
ORB_AMBER = (254, 243, 199, 60)


def _find_font(*names):
    """Return the first font path that exists on this system from the given names."""
    candidates = []
    for n in names:
        candidates += [
            f"/usr/share/fonts/truetype/{n}",
            f"/usr/share/fonts/{n}",
            f"/usr/share/fonts/opentype/{n}",
        ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _load(font_path: str, size: int) -> ImageFont.FreeTypeFont:
    if font_path and os.path.exists(font_path):
        return ImageFont.truetype(font_path, size=size)
    return ImageFont.load_default()


# Pick the best available serif on the container
SERIF = (
    _find_font(
        "liberation/LiberationSerif-Regular.ttf",
        "dejavu/DejaVuSerif.ttf",
    ) or "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
)
SANS = (
    _find_font(
        "liberation/LiberationSans-Regular.ttf",
        "dejavu/DejaVuSans.ttf",
    ) or "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
)
SANS_BOLD = (
    _find_font(
        "liberation/LiberationSans-Bold.ttf",
        "dejavu/DejaVuSans-Bold.ttf",
    ) or "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
)


# --- Build the canvas ---
img = Image.new("RGBA", (W, H), WHITE)

# Soft orb blobs (simulate blur with a transparent ellipse on its own layer)
orb_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(orb_layer)
od.ellipse([-300, -300, 600, 600], fill=ORB_GREEN)
od.ellipse([W - 600, H - 600, W + 300, H + 300], fill=ORB_AMBER)
orb_layer = orb_layer.filter_blur if False else orb_layer  # PIL doesn't have blur in this name
# Actual blur:
from PIL import ImageFilter as _IF  # noqa: E402
orb_layer = orb_layer.filter(_IF.GaussianBlur(radius=120))
img = Image.alpha_composite(img, orb_layer)

draw = ImageDraw.Draw(img)


def _text_center(text, font, y, fill=INK, letter_spacing: int = 0):
    """Draw `text` horizontally centered at y. Returns the text's bounding box."""
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (W - tw) / 2 - bbox[0]
        draw.text((x, y), text, font=font, fill=fill)
        return (x, y, x + tw, y + th)
    # Hand-spaced render
    glyphs = []
    total_w = 0
    for i, ch in enumerate(text):
        gw = draw.textbbox((0, 0), ch, font=font)[2]
        glyphs.append((ch, gw))
        total_w += gw + (letter_spacing if i < len(text) - 1 else 0)
    x = (W - total_w) / 2
    for ch, gw in glyphs:
        draw.text((x, y), ch, font=font, fill=fill)
        x += gw + letter_spacing
    return None


# ---- CELESTA — large serif, wide letter-spacing ----
celesta_font = _load(SERIF, 178)
celesta_y = 620
_text_center("CELESTA", celesta_font, celesta_y, fill=INK, letter_spacing=36)

# ---- GLOW row — rule | G L O W | rule ----
glow_font = _load(SERIF, 60)
glow_text = "G L O W"
glow_bbox = draw.textbbox((0, 0), glow_text, font=glow_font, spacing=8)
glow_w = glow_bbox[2] - glow_bbox[0]
glow_y = celesta_y + 230
gx = (W - glow_w) / 2
draw.text((gx, glow_y), glow_text, font=glow_font, fill=MINT)

# Horizontal rules on both sides of GLOW
rule_y = int(glow_y + 50)
left_rule_end = int(gx) - 56
right_rule_start = int(gx + glow_w) + 56
draw.rectangle([130, rule_y, left_rule_end, rule_y + 3], fill=MINT)
draw.rectangle([right_rule_start, rule_y, W - 130, rule_y + 3], fill=MINT)


# ---- Tagline (3 lines, "Kerala" in mint) ----
tag_font = _load(SANS, 52)
tag_y = glow_y + 200
line1 = "The Most Trusted"
line2 = "Skincare Ecommerce App"
_text_center(line1, tag_font, tag_y, fill=BODY_INK)
_text_center(line2, tag_font, tag_y + 78, fill=BODY_INK)
# "of Kerala" — mixed ink + mint, manually composed so "Kerala" is mint
prefix = "of "
kerala = "Kerala"
prefix_w = draw.textbbox((0, 0), prefix, font=tag_font)[2]
kerala_w = draw.textbbox((0, 0), kerala, font=tag_font)[2]
total = prefix_w + kerala_w
sx = (W - total) / 2
of_y = tag_y + 156
draw.text((sx, of_y), prefix, font=tag_font, fill=BODY_INK)
draw.text((sx + prefix_w, of_y), kerala, font=tag_font, fill=MINT)

# ---- Heart-rule divider ----
heart_y = of_y + 170
# Heart drawn as two arcs + triangle (simple, scales)
heart_cx = W // 2
heart_size = 26
# Heart shape via polygon (approximation good enough at this size)
heart_pts = [
    (heart_cx, heart_y + 8),
    (heart_cx - 22, heart_y - 14),
    (heart_cx - 22, heart_y - 28),
    (heart_cx - 11, heart_y - 32),
    (heart_cx, heart_y - 22),
    (heart_cx + 11, heart_y - 32),
    (heart_cx + 22, heart_y - 28),
    (heart_cx + 22, heart_y - 14),
]
draw.polygon(heart_pts, fill=MINT)
# Two flanking rules
draw.rectangle([heart_cx - 240, heart_y - 5, heart_cx - 60, heart_y - 3], fill=MINT_PALE)
draw.rectangle([heart_cx + 60, heart_y - 5, heart_cx + 240, heart_y - 3], fill=MINT_PALE)


# ---- Slogan: Glow With Confidence — clean sans, mint, NO underline ----
slogan_font = _load(SANS_BOLD, 76)
slogan_y = heart_y + 60
_text_center("Glow With Confidence", slogan_font, slogan_y, fill=MINT)


# Save (flatten to RGB so the PNG is small)
final = Image.new("RGB", (W, H), (255, 255, 255))
final.paste(img, (0, 0), img)
final.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT}  ({os.path.getsize(OUT) // 1024} KB, {W}×{H})")
