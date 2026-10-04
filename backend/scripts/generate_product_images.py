"""Regenerate Celesta Glow product imagery with a PIXEL-CONSISTENT bottle.

Strategy (strict bottle consistency):
  - The hero image IS the brand's actual reference bottle photo for that SKU
    (uploads/refs/ref-*.png) — so the bottle never changes between images.
  - The 4 "Formula Technology" cards pass that same reference photo to Gemini
    Nano Banana and ask it to place THE EXACT SAME bottle on the right side of
    a clean formula graphic on a pure-white background. Because it's an edit of
    the reference, the bottle shape/cap/lighting stay identical.

Run:  python /app/backend/scripts/generate_product_images.py
Idempotent — skips files that already exist (delete a file to regenerate it).
"""
import asyncio
import base64
import os
import shutil
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRODUCTS_DIR = os.path.join(BACKEND, "uploads", "products")
REFS_DIR = os.path.join(BACKEND, "uploads", "refs")
os.makedirs(PRODUCTS_DIR, exist_ok=True)

API_KEY = os.environ.get("EMERGENT_LLM_KEY")
IMAGE_MODEL = "gemini-3.1-flash-image-preview"

STYLE = (
    "Professional product photography on a PURE WHITE background (#FFFFFF). The background must be completely "
    "white with no shadows, no gradients, no textures, no grey tones, no off-white. Solid pure white background "
    "only. Studio lighting. Clean white seamless backdrop. "
    "The product is a matte-white bottle with a clear cap, printed with the vertical "
    "'CELESTA GLOW' serif wordmark and forest-green (#1f5133) product text. "
    "The background is a PURE, seamless WHITE (#FFFFFF) with NO floor shadow and no grey tint. "
    "Photorealistic, crisp focus, premium minimalist Indian skincare e-commerce style."
)

PRODUCTS = {
    "celesta-glow-radiance-serum": {
        "ref": "ref-serum.png",
        "name": "ADVANCED FACE SERUM", "size": "30 ml",
        "ingredients": "NIACINAMIDE + ALPHA ARBUTIN + VITAMIN C",
        "benefits": ["Reduces Dullness", "Supports Firm Skin", "Youthful Glow"],
        "solves": "Dullness, dark spots and uneven skin tone",
        "best_for": "Anyone 25+ who wants brighter, firmer, glowing skin in 4 weeks",
        "tech_summary": "A brightening serum pairing niacinamide and alpha arbutin with vitamin C to even tone and boost glow.",
        "tech": [
            ("NIACINAMIDE", "The even-tone story", "Niacinamide supports a brighter, more even-looking complexion."),
            ("ALPHA ARBUTIN", "The dark-spot story", "Alpha arbutin fades the look of dark spots and pigmentation."),
            ("VITAMIN C", "The glow story", "Vitamin C boosts radiance and defends against daily stress."),
            ("HYALURONIC ACID", "The deep-hydration story", "Hyaluronic acid holds moisture for a plump, dewy finish."),
        ],
    },
    "celesta-glow-repair-night-cream": {
        "ref": "ref-nightcream.png",
        "name": "ADVANCED RETINOID NIGHT CREAM", "size": "50 ml",
        "ingredients": "RETINOID + HYALURONIC ACID",
        "benefits": ["Reduces Fine Lines & Wrinkles", "Improves Firmness", "Deeply Hydrates"],
        "solves": "Fine lines, wrinkles and overnight moisture loss",
        "best_for": "Mature or dry skin needing overnight repair and firming",
        "tech_summary": "A 50 ml retinoid night cream that renews and firms skin while you sleep, without irritation.",
        "tech": [
            ("RETINOID", "The visible-firming story", "Retinoid accelerates renewal to soften fine lines and wrinkles."),
            ("HYALURONIC ACID", "The overnight-hydration story", "Hyaluronic acid keeps skin plump and hydrated until morning."),
            ("PEPTIDES", "The bounce-back story", "Peptides help skin look firmer and more resilient over time."),
            ("CERAMIDES", "The barrier-repair story", "Ceramides rebuild the barrier for calm, comfortable skin."),
        ],
    },
    "celesta-glow-under-eye-cream": {
        "ref": "ref-eye.png",
        "name": "CAFFEINE UNDER EYE CREAM", "size": "15 g",
        "ingredients": "CAFFEINE + NIACINAMIDE + HYALURONIC ACID",
        "benefits": ["Reduces Puffiness", "Helps Brighten Under Eyes", "Deep Hydration"],
        "solves": "Dark circles, puffiness and tired-looking eyes",
        "best_for": "Tired eyes from screens and late nights needing a quick refresh",
        "tech_summary": "A cooling caffeine roll-on that de-puffs and brightens the delicate under-eye area.",
        "tech": [
            ("CAFFEINE", "The refreshed, awake-looking story", "Caffeine de-puffs and energises tired-looking under-eyes."),
            ("NIACINAMIDE", "The even-looking tone story", "Niacinamide helps fade dark circles for a brighter look."),
            ("HYALURONIC ACID", "The smooth-hydration story", "Hyaluronic acid plumps fine lines around the eyes."),
            ("PEPTIDES", "The firming story", "Peptides smooth and firm the delicate under-eye skin."),
        ],
    },
    "celesta-glow-mineral-sunscreen-spf50": {
        "ref": "ref-sunscreen.png",
        "name": "DAILY DEFENSE SUNSCREEN", "size": "50 g",
        "ingredients": "NIACINAMIDE + VITAMIN E",
        "benefits": ["SPF 50 PA+++ Broad-Spectrum", "Zero White Cast", "Light, Clean & Matte"],
        "solves": "UV damage, pigmentation and white-cast sunscreens",
        "best_for": "Daily UV protection on every Indian skin tone, zero white cast",
        "tech_summary": "A mineral SPF 50 PA+++ that shields from UVA/UVB while brightening, with no greasy white cast.",
        "tech": [
            ("SPF 50 PA+++", "The daily-defense story", "SPF 50 PA+++ gives verified broad-spectrum UVA/UVB protection."),
            ("ZINC OXIDE", "The mineral-shield story", "Micronised zinc oxide blocks rays with an invisible finish."),
            ("NIACINAMIDE", "The brightening story", "Niacinamide brightens while it protects against sun stress."),
            ("VITAMIN E", "The antioxidant story", "Vitamin E neutralises free radicals from daily sun exposure."),
        ],
    },
    "celesta-glow-gentle-cleanser": {
        "ref": "ref-cleanser.png",
        "name": "GENTLE CLEANSER", "size": "100 ml",
        "ingredients": "NIACINAMIDE + SALICYLIC ACID + PEA PROTEIN",
        "benefits": ["Cleanses Deeply", "Removes Impurities", "Smooth, Clear Skin"],
        "solves": "Impurities, tightness and sensitivity from harsh cleansers",
        "best_for": "Sensitive and combination skin that needs a gentle daily cleanse",
        "tech_summary": "A sulphate-free cleanser that removes dirt and SPF without stripping the barrier.",
        "tech": [
            ("AMINO ACIDS", "The no-strip story", "Amino-acid surfactants clean deeply without tightness."),
            ("NIACINAMIDE", "The clarity story", "Niacinamide keeps skin clear, calm and even-looking."),
            ("SALICYLIC ACID", "The pore-clearing story", "Salicylic acid unclogs pores for a smooth, clear finish."),
            ("ALOE VERA", "The soothing story", "Aloe vera calms and comforts sensitive, reactive skin."),
        ],
    },
}


def _ref_b64(ref_name: str) -> str:
    with open(os.path.join(REFS_DIR, ref_name), "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def _gen_edit(ref_name: str, prompt: str, out_path: str, label: str) -> bool:
    if os.path.exists(out_path):
        print(f"  [skip] {label} exists")
        return True
    try:
        chat = LlmChat(
            api_key=API_KEY,
            session_id=f"cg-{uuid.uuid4().hex[:8]}",
            system_message="You are an award-winning skincare packaging designer and art director.",
        )
        chat.with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
        msg = UserMessage(text=prompt, file_contents=[ImageContent(_ref_b64(ref_name))])
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            print(f"  [FAIL] {label}: no image")
            return False
        data = base64.b64decode(images[0]["data"])
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"  [ok]   {label}  ({len(data)//1024} KB)")
        return True
    except Exception as e:
        print(f"  [ERR]  {label}: {str(e)[:160]}")
        return False


async def run():
    if not API_KEY:
        print("ERROR: EMERGENT_LLM_KEY missing")
        return
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    for slug, spec in PRODUCTS.items():
        print(f"\n=== {slug} ===")
        hero_name = f"{slug}-hero.jpg"
        hero_path = os.path.join(PRODUCTS_DIR, hero_name)

        # 1) HERO = the actual reference bottle photo (pixel-perfect consistency).
        shutil.copyfile(os.path.join(REFS_DIR, spec["ref"]), hero_path)
        print(f"  [hero] using reference photo {spec['ref']}")
        images = [f"/api/uploads/products/{hero_name}"]

        label_txt = (
            f"product name '{spec['name']}', the line '{spec['ingredients']}', "
            f"the benefits '{'; '.join(spec['benefits'])}', 'FOR ALL SKIN TYPES' and the size '{spec['size']}'"
        )

        # 2) FORMULA TECHNOLOGY gallery — 4 DISTINCT editorial layouts, same
        #    green-white theme, bottle always the exact reference photo.
        tech = spec["tech"]
        w0, s0, d0 = tech[0]
        w1, s1, d1 = tech[1]
        w2, s2, d2 = tech[2]
        w3, s3, d3 = tech[3]

        SAME_BOTTLE = (
            "CRITICAL: place the EXACT SAME bottle from the reference image — same shape, same cap, "
            "same label text, same lighting, completely unchanged and identical to the reference photo. "
        )

        layouts = [
            # Style A — headline-left with connector line (NIACINAMIDE reference)
            (
                "On the LEFT add only typography: small uppercase label 'FORMULA TECHNOLOGY', then one very "
                f"large bold headline word '{w0}' in dark forest green (#1f5133) with a thin green underline, "
                f"then a subheading '{s0}'. A thin green connector line points from the headline to the bottle. "
                f"Beneath the subheading add a small line: 'Solves: {spec['solves']}. Made for: {spec['best_for']}.' "
                f"and one more small line explaining how: '{d0}'"
            ),
            # Style B — big claim at top, bottle centered, two side columns (SPF reference)
            (
                "At the TOP add one big bold all-caps forest-green (#1f5133) claim headline spanning the width: "
                f"'{w1} CARRIES THE {spec['name']} POSITIONING.' with a smaller black sub-line '{s1}'. "
                "Place the bottle in the CENTER. On the LEFT side add a bordered column titled 'WHAT IT SOLVES' "
                f"with '{spec['solves']}', and on the RIGHT side a bordered column titled 'WHO IT IS FOR' with "
                f"'{spec['best_for']}'. Thin green vertical divider lines separate the columns from the bottle."
            ),
            # Style C — giant headline top-left + big petri-dish ingredient visual (petri dish reference)
            (
                "Top-LEFT: a giant bold forest-green (#1f5133) headline 'FORMULA TECHNOLOGY', then a smaller "
                f"all-caps line 'THE {s1.upper()}.' Bottom-LEFT: a large photorealistic glass petri dish filled "
                f"with a clear light-green gel serum with bubbles, labelled '{w2}' with a connector line. "
                "The bottle stands on the RIGHT. "
                f"A small caption under the headline reads: 'Made for: {spec['best_for']}.'"
            ),
            # Style D — editorial with italic serif accent word (CAFFEINE reference)
            (
                "On the LEFT: small spaced uppercase label 'FORMULA TECHNOLOGY', then one giant bold headline "
                f"word '{w3}' in dark forest green (#1f5133) with a thin underline, then an italic serif accent "
                f"line '{s3}' where the key words are in italic, then a small all-caps paragraph: "
                f"'IN THIS FORMULA, {w3} LEADS THE STORY — {d3.upper()}' "
                "A thin green connector line points from the headline to the bottle on the RIGHT. "
                f"At the bottom-left add a small line: 'Best for: {spec['best_for']}.'"
            ),
        ]

        for i, layout in enumerate(layouts, start=1):
            tname = f"{slug}-tech{i}.jpg"
            tprompt = (
                "Create a clean premium skincare 'Formula Technology' marketing graphic. "
                f"{SAME_BOTTLE}{layout}. {STYLE} Generous whitespace, editorial layout, "
                "all text crisp, correctly spelled and perfectly legible."
            )
            if await _gen_edit(spec["ref"], tprompt, os.path.join(PRODUCTS_DIR, tname), f"tech{i}"):
                images.append(f"/api/uploads/products/{tname}")

        # ---- persist ----
        update = {
            "images": images,
            "solves": spec["solves"],
            "best_for": spec["best_for"],
            "technology_summary": spec["tech_summary"],
            "tech_stories": [
                {"ingredient": w, "headline": s, "description": d}
                for (w, s, d) in spec["tech"]
            ],
        }
        await db.products.update_one({"slug": slug}, {"$set": update})
        print(f"  -> DB updated: {len(images)} images")

    print("\nAll done.")


if __name__ == "__main__":
    asyncio.run(run())
