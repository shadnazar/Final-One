# Celesta Glow — PRD / State

## Product
Full-stack skincare e-commerce (React + FastAPI + MongoDB) cloned from the owner's GitHub
repo and branded "celestaglow". Public storefront + admin panel. Integrations: Razorpay,
Cloudinary, Delhivery, Gmail SMTP, Meta Pixel/CAPI, Google Maps, GA4/Ads/Clarity, Gemini
(direct `GEMINI_API_KEY` — NOT the Emergent universal key, which is blocked in prod).

## Core admin AI features
- **One-Click Product Generator** (`POST /api/admin/ai/one-click-product`): AI classify →
  copy → Gemini hero image → gallery/certificate/before-after → live product.
- **Generate Gallery & Certificate** (`POST /api/admin/products/{slug}/generate-images`).
- **24 Variations** (`POST /api/admin/products/{slug}/generate-variations`): 2 genders × 3
  skin types × 4 age groups from a source product.
- **AI Upscale** (`POST /api/admin/products/{slug}/upscale-images`).
- **30-Day Progress Tracker** (`/api/journey/*`, `/api/tracker/*`): sequential day unlock,
  Eat/Avoid/Do-Naturally guidance.

## Architecture notes
- Image pipeline: AI hero (Gemini `gemini-2.5-flash-image`) + Pillow-composed gallery cards
  (`services/gallery_composer.py`, `services/brand_bottles.py`).
- LLM text via `services/llm_helper.py` (`llm_text`, direct Gemini `gemini-flash-latest`).
- Fonts bundled in `/app/backend/fonts` (pods lack `/usr/share/fonts`).
- Generated artwork persisted to Cloudinary (`services/durable_images.py`) — survives redeploy.

## Changelog — 2026-10-05 (this session)
Fixed the 3 open image-generation issues:
1. **Sub-images now match the AI hero (P0, DONE).** One-click extracts the exact bottle from
   the Gemini hero (`brand_bottles._alpha_cutout` + `_trim`) and composites THAT into the
   Pillow gallery cards. `gallery_composer.generate_gallery_and_certificate/generate_and_persist`
   gained `bottle_override` + `hero_url` params. Verified: hero + tech cards are pixel-identical.
2. **AI Upscale no longer blurs label text (P0, DONE).** `upscale-images` dropped Cloudinary's
   destructive `e_upscale`; now applies only `q_auto:best,f_auto` (crisp). Also sharpens the
   `solution_image` ("how it works") card.
3. **24 Variations reliable + consistent (P1, DONE).** Endpoint now runs as a BACKGROUND job
   (`var_*` job id) with `GET /api/admin/products/variations-job/{job_id}` polling — fixes the
   intermittent 502/503 timeout failures. `variation_generator._compose_shared_gallery` now
   reuses the source product's ACTUAL hero image (`images[0]`) + extracts its bottle for the
   cards (0 extra AI credits). Frontend `AdminProducts.js` polls the job.

Verified via curl + image inspection on preview. Test QA product + variations cleaned up.

## Changelog — 2026-10-05 (combo live/TBL fix)
**Bug:** A combo set LIVE in admin still showed "to be launched / coming soon" on the user app.
**Root cause (frontend):** `kitIsTbl = ... || productsInKit.length === 0 || ...` — the combo was
forced TBL whenever its member products weren't present in the page's limited product fetch
(homepage loads only 20 skin-care products; slow loads; members outside the loaded niche).
**Fix:** Removed the `length === 0` term in all 3 render spots — `pages/Homepage.js` (~565),
`pages/ShopPage.js` (~441 completeKit, ~702 combo grid). A combo is now TBL only if the combo's
own `is_to_be_launched` flag is set, OR a RESOLVED member product is genuinely TBL. The cart-side
`isComboTbl()` helper was already correct. Verified on /shop: combos render "ADD KIT" (buyable);
the only TBL-text left is the filter chips.

## Backlog / future (P2)
- Let admin re-run generate-images on OLD existing products to bring their sub-images in sync
  with the new AI-hero-matching logic (one-off migration button could batch this).
- Optional: persist a progress % (done/total) inside the variation job for a live progress bar.
