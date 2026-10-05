"""One-click variation generator.

From a single source product + a chosen concern, generate the full targeting
matrix of shoppable products:

    2 genders  x  3 skin types  x  4 age groups  =  24 variations

Every variation:
  * reuses the SAME pure-white bottle photo + shared Formula-Technology gallery
    cards (composed once — the bottle stays pixel-identical everywhere),
  * gets its OWN title, description and how-to-use, all highlighting the chosen
    concern and calling out that it is *exclusively* for that audience,
  * gets its OWN certificate (brand template with the name overlaid),
  * is correctly linked to the concern + inherits the source product type
    (niche / category / subcategory) so catalog taxonomy stays accurate.
"""
import asyncio
import os
import re
from datetime import datetime, timezone

from services import gallery_composer as gc

GENDERS = [
    ("men", "Men", "men", "male"),
    ("women", "Women", "women", "female"),
]
SKIN_TYPES = ["Oily", "Dry", "Combination"]
AGE_GROUPS = [
    ("18-24", "18\u201324"),
    ("25-35", "25\u201335"),
    ("35-50", "35\u201350"),
    ("50-65plus", "50\u201365+"),
]

PRODUCTS_DIR = gc.PRODUCTS_DIR


def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def _bottle_from_product_image(product: dict):
    """Extract the product's ACTUAL hero bottle (RGBA) from its first image so
    every variation card matches the one-click/upscaled hero exactly. Returns
    (bottle_rgba, hero_url). Falls back to the approved brand bottle + a freshly
    rendered Pillow hero when the product has no usable image. Spends NO AI
    credits — pure download + Pillow cut-out."""
    imgs = [u for u in (product.get("images") or []) if u]
    if imgs:
        try:
            from services import brand_bottles as bb
            im = gc._load_local_or_remote(imgs[0])
            return bb._trim(bb._alpha_cutout(im)), imgs[0]
        except Exception:
            pass
    return gc._resolve_bottle(product), None


def _compose_shared_gallery(product: dict, base_slug: str, concern_label: str):
    """Compose the 4 Formula-Technology cards ONCE and return
    (image_list, stories, bottle). All 24 variations reference these files.

    The bottle + hero are taken from the SOURCE product's own (AI-generated or
    upscaled) hero image, so variations stay visually identical to it. No AI
    credits are spent — the hero is reused and the cards are drawn with Pillow.
    """
    bottle, hero_url = _bottle_from_product_image(product)
    name = (product.get("short_name") or product.get("name") or "PRODUCT").upper()
    solves = concern_label
    best_for = "Every skin type, every age \u2014 personalised below"
    stories = gc._stories_from_product(product)
    layouts = [
        gc._layout_a(bottle, *stories[0], solves, best_for),
        gc._layout_b(bottle, *stories[1], solves, best_for, name),
        gc._layout_c(bottle, *stories[2], solves, best_for),
        gc._layout_d(bottle, *stories[3], solves, best_for),
    ]
    imgs = []
    # Image 1 = the source product's ACTUAL hero (reused verbatim, 0 credits).
    if hero_url:
        imgs.append(hero_url)
    else:
        try:
            from services import brand_bottles
            imgs.append(gc._persist(brand_bottles.hero_bytes(product), base_slug,
                                    "var-hero", f"{base_slug}-var-hero.jpg"))
        except Exception:
            pass
    for i, img in enumerate(layouts, start=1):
        imgs.append(gc._persist(img, base_slug, f"var-tech{i}",
                                f"{base_slug}-var-tech{i}.jpg"))
    return imgs, stories, bottle


def _certificate_for(name: str, slug: str) -> str:
    cert = gc._certificate(name)
    return gc._persist(cert, slug, "certificate", f"{slug}-certificate.jpg")


async def generate_variations(db, product: dict, concern_slug: str, concern_label: str) -> dict:
    """Generate & upsert the 24 variation products. Returns a summary."""
    base_slug = product["slug"]
    base_name = product.get("short_name") or product.get("name") or "Product"
    concern_label = concern_label or (concern_slug or "skin concerns").replace("-", " ").title()

    # Cloudinary must be live before we render anything — otherwise the 100+
    # generated assets would land on the pod's disposable disk and 404 later.
    from services import cloudinary_service as _cs
    if not await _cs.ensure_configured(db):
        raise RuntimeError(
            "Cloudinary is not configured — variation image generation aborted so "
            "no artwork is stored on ephemeral disk."
        )

    shared_images, stories, bottle = await asyncio.to_thread(
        _compose_shared_gallery, product, base_slug, concern_label
    )
    # Shared BEFORE/AFTER pair (drawn once, referenced by every variation).
    try:
        shared_ba = await asyncio.to_thread(
            gc.before_after_pair, base_slug, concern_label, "every skin type & age"
        )
    except Exception:
        shared_ba = {}
    ba_list = []
    if shared_ba:
        ba_list = [
            {"type": "before", "image": shared_ba["before_image"], "caption": "Week 0 — baseline"},
            {"type": "after", "image": shared_ba["after_image"], "caption": "After consistent use"},
        ]
    tech_stories = [
        {"ingredient": w, "headline": s, "description": d} for (w, s, d) in stories
    ]

    # Detailed, concern-specific FAQs (TEXT) generated once via AI, shared across
    # all variations. Falls back to a rich rule-based set if the key is exhausted.
    try:
        from services.faq_ai import generate_faqs
        shared_faqs = await generate_faqs(product, concern_label)
    except Exception:
        shared_faqs = product.get("faqs") or []

    now = datetime.now(timezone.utc).isoformat()
    key_ingredients = product.get("key_ingredients") or "clinically-proven actives"
    actives = gc._clean_actives(key_ingredients)
    lead_active = actives[0]
    base_how = product.get("how_to_use") or "Apply to clean skin morning and night. Follow with sunscreen in the AM."

    created, updated = 0, 0
    slugs = []
    new_docs = []  # collect all NEW variations and batch-insert once (avoids 24
                   # separate round-trips that can partially fail / time out)


    for g_slug, g_label, g_word, _g in GENDERS:
        for skin in SKIN_TYPES:
            for age_slug, age_label in AGE_GROUPS:
                vslug = f"{base_slug}-{g_slug}-{_slugify(skin)}-{age_slug}"
                vname = f"{base_name} for {skin} Skin \u2014 {concern_label} ({g_label} {age_label})"
                cert_name = f"{base_name} \u2014 {concern_label}"

                exclusive = f"Formulated exclusively for {g_word}."
                description = (
                    f"{exclusive} A targeted {concern_label.lower()} treatment tuned for "
                    f"{skin.lower()} skin in the {age_label} age group. Powered by {key_ingredients}, "
                    f"this {base_name.lower()} tackles {concern_label.lower()} while respecting the "
                    f"unique needs of {g_word} aged {age_label}. Dermatologically tested, vegan and "
                    f"cruelty-free."
                )
                how_to_use = (
                    f"{base_how} For {skin.lower()} skin ({g_word}, {age_label}): "
                    + (
                        "use a pea-sized amount and build tolerance gradually."
                        if skin == "Dry"
                        else "apply an even layer and reapply as needed through the day."
                    )
                    + f" Best paired with the rest of your {concern_label.lower()} routine."
                )

                # Per-variation image work wrapped so ONE failure never aborts the
                # whole batch — the variation still gets created with shared assets.
                # Composition + Cloudinary upload are synchronous and CPU/IO bound,
                # so they run in a worker thread to keep the event loop responsive
                # across all 24 variations.
                try:
                    cert_url = await asyncio.to_thread(_certificate_for, cert_name, vslug)

                    # Personalised problem -> solution card (pure-white, green theme)
                    problem = (
                        f"As {g_word} with {skin.lower()} skin around {age_label}, "
                        f"{concern_label.lower()} shows up faster and lingers longer."
                    )
                    change = (
                        f"{lead_active} plus a targeted actives blend visibly reduces "
                        f"{concern_label.lower()} — skin looks clearer, calmer and more even with daily use."
                    )

                    def _mk_solution():
                        sol_img = gc._layout_solution(
                            bottle, concern_label, problem, change,
                            f"{g_word} \u00b7 {skin} skin \u00b7 {age_label}",
                        )
                        return gc._persist(sol_img, vslug, "solution", f"{vslug}-solution.jpg")

                    sol_url = await asyncio.to_thread(_mk_solution)
                    sol_alt = f"How {base_name} solves {concern_label} for {g_word} with {skin.lower()} skin, {age_label}"
                except Exception as _img_err:
                    import logging as _lg
                    _lg.warning(f"[variations] image compose failed for {vslug} (non-fatal): {_img_err}")
                    cert_url = product.get("test_report_image") or ""
                    sol_url = None
                    sol_alt = None

                # Auto SEO alt text for every image, tied to on-image text.
                alts = gc.build_alt_texts(vname, concern_label, stories, has_solution=False)
                image_gallery = [{"url": u, "alt": alts[i] if i < len(alts) else f"{vname} view {i+1}"}
                                 for i, u in enumerate(shared_images)]

                # Per-variation price bump: base price + a deterministic random
                # ₹25–₹65 (seeded by slug so it stays stable across regenerations).
                import hashlib as _hl
                _off = 25 + int(_hl.md5(vslug.encode()).hexdigest()[:8], 16) % 41  # 25..65
                _base_mrp = int(product.get("mrp", 0) or 0)
                _base_pp = int(product.get("prepaid_price", 0) or 0)
                _base_cod = int(product.get("cod_price", 0) or 0)

                doc = {
                    "slug": vslug,
                    "name": vname,
                    "short_name": f"{base_name} ({g_label} {age_label})",
                    "niche": product.get("niche"),
                    "category": product.get("category"),
                    "subcategory": product.get("subcategory"),
                    "concerns": [concern_slug] if concern_slug else product.get("concerns", []),
                    "concern_primary": concern_slug,
                    "concern_label": concern_label,
                    "target_gender": g_slug,
                    "target_skin_type": skin,
                    "target_age_group": age_label,
                    "exclusive_for": f"{g_label} \u00b7 {skin} skin \u00b7 {age_label}",
                    "tagline": f"{concern_label} \u2014 exclusively for {g_word} ({age_label})",
                    "hero_line": f"Targeted {concern_label} care for {skin.lower()} skin.",
                    "mrp": (_base_mrp + _off) if _base_mrp else _base_mrp,
                    "prepaid_price": (_base_pp + _off) if _base_pp else _base_pp,
                    "cod_price": (_base_cod + _off) if _base_cod else _base_cod,
                    "discount_percent": product.get("discount_percent", 0),
                    "size": product.get("size", ""),
                    "key_ingredients": key_ingredients,
                    "benefits": product.get("benefits", []),
                    "how_to_use": how_to_use,
                    "description": description,
                    "faqs": shared_faqs,
                    "solution_image": sol_url,
                    "solution_image_alt": sol_alt,
                    "before_after": ba_list,
                    "image_gallery": image_gallery,
                    "is_active": True,
                    "is_bestseller": False,
                    "stock_qty": product.get("stock_qty", 100),
                    "brand": product.get("brand", "Celesta Glow"),
                    "images": list(shared_images),
                    "tech_stories": tech_stories,
                    "test_report_image": cert_url,
                    "test_report_lab": "Mascot Spincontrol \u2014 Clinical Research",
                    "generated_from": base_slug,
                    "parent_id": base_slug,       # explicit parent link
                    "product_group": base_slug,   # group key for grouped display
                    "is_variation": True,
                    "updated_at": now,
                }

                existing = await db.products.find_one({"slug": vslug}, {"_id": 1})
                if existing:
                    await db.products.update_one({"slug": vslug}, {"$set": doc})
                    updated += 1
                else:
                    doc["created_at"] = now
                    doc["sort_order"] = 500 + len(slugs)
                    new_docs.append(doc)   # batch-inserted after the loop
                    created += 1
                slugs.append(vslug)

    # Single batch insert for every NEW variation — one DB round-trip instead of
    # 24, so we never partially save or time out mid-loop.
    if new_docs:
        await db.products.insert_many(new_docs, ordered=False)

    # Register the shared BEFORE/AFTER pair against every variation slug so the
    # PDP "Before & After" carousel (which queries by product_slug) shows it too.
    if shared_ba:
        try:
            import hashlib as _h
            for s in slugs:
                ba_id = "ba_var_" + _h.md5(s.encode()).hexdigest()[:8]
                await db.before_after_images.update_one(
                    {"ba_id": ba_id},
                    {"$set": {
                        "ba_id": ba_id,
                        "product_slug": s,
                        "before_image": shared_ba["before_image"],
                        "after_image": shared_ba["after_image"],
                        "description": f"{concern_label} — visible improvement",
                        "is_global": False,
                        "sort_order": 0,
                        "created_at": now,
                    }},
                    upsert=True,
                )
        except Exception:
            pass

    # Record how many variations this base product now has, so listings can
    # surface a "View all N variations" link without an extra query.
    try:
        await db.products.update_one(
            {"slug": base_slug},
            {"$set": {"variation_count": len(slugs), "updated_at": now}},
        )
    except Exception:
        pass

    return {
        "success": True,
        "source": base_slug,
        "concern": concern_slug,
        "concern_label": concern_label,
        "total": len(slugs),
        "created": created,
        "updated": updated,
        "shared_images": shared_images,
        "slugs": slugs,
    }