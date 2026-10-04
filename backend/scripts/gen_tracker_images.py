"""Generate 4 on-theme 'Recommended For You' step images via Pollinations (free).
Saves to backend/uploads/assets/rec-{slug}.jpg
"""
import os, httpx
from urllib.parse import quote

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "assets"))
os.makedirs(OUT, exist_ok=True)

STYLE = ("minimal premium skincare product bottle, soft sage-green and cream palette, "
         "clean studio background, soft natural light, editorial beauty photography, "
         "no text, no logo, no watermark")

ITEMS = {
    "cleanser":   "a frosted pump bottle of gentle facial cleanser, " + STYLE,
    "serum":      "a slim glass dropper serum bottle, " + STYLE,
    "moisturizer":"a round jar of face moisturizer cream, " + STYLE,
    "sunscreen":  "a tube of sunscreen SPF, " + STYLE,
}

for slug, prompt in ITEMS.items():
    url = (f"https://image.pollinations.ai/prompt/{quote(prompt)}"
           f"?width=400&height=400&model=flux&nologo=true&enhance=true&seed=7{len(slug)}")
    try:
        r = httpx.get(url, timeout=120.0, follow_redirects=True)
        if r.status_code == 200 and len(r.content) > 1024:
            p = os.path.join(OUT, f"rec-{slug}.jpg")
            with open(p, "wb") as f:
                f.write(r.content)
            print("saved", p, len(r.content))
        else:
            print("FAIL", slug, r.status_code, len(r.content))
    except Exception as e:
        print("ERR", slug, str(e)[:120])
