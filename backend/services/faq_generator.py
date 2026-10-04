"""
AI-powered FAQ generator for niche home pages.

Generates 8-10 detailed, in-depth FAQs per niche (skincare / cosmetics / anti-aging)
using Emergent LLM key. Results are cached in MongoDB and refreshed every 7 days.
Falls back to high-quality static FAQs when key is missing or AI call fails.
"""
import os
import json
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

CACHE_DAYS = 7

# High-quality fallback FAQs (used when AI key missing / call fails)
FALLBACK = {
    "skincare": [
        {"q": "How do I figure out my skin type before picking a routine?",
         "a": "Wash your face with a mild cleanser, wait 30 minutes without applying anything, then check: if your T-zone is shiny and pores look enlarged → oily; if cheeks feel tight or flaky → dry; if T-zone is oily but cheeks are dry → combination; if your skin reacts to most actives with redness → sensitive. Our 2-minute skin analysis quiz at /routine narrows this down with 12 dermatologist-vetted questions and recommends a complete AM + PM ritual."},
        {"q": "How long does a typical skincare routine take to show results?",
         "a": "Hydration and brightness improvements (texture, glow) show in 7–14 days. Pigmentation, dark spots and uneven tone improve in 4–8 weeks. Fine lines, firmness and deep concerns need 8–12 weeks of consistent twice-daily use. The reason is cell turnover — your skin renews every 28 days, so every active needs at least 2 full cycles to be judged fairly."},
        {"q": "Can I use Vitamin C and Retinol together?",
         "a": "Yes — but on alternating routines. Use Vitamin C in the AM (it boosts SPF protection by neutralising free radicals from UV + pollution). Use Retinol in the PM (sunlight degrades it within hours). Stacking both in the same routine is not dangerous but lowers efficacy because their optimal pH ranges differ. Sandwich retinol between two layers of moisturiser if you have sensitive skin."},
        {"q": "What's the correct order to layer skincare products?",
         "a": "Thinnest to thickest, water-based to oil-based: Cleanser → Toner (optional) → Water-based serum (Vit C, Niacinamide, Hyaluronic Acid) → Eye Cream → Treatment (Retinol, AHA/BHA) → Moisturiser → Face Oil (PM only, optional) → SPF 50 (AM only, non-negotiable). Wait 30–60 seconds between actives so each layer absorbs before the next is applied."},
        {"q": "Will skincare products break me out before they work?",
         "a": "Sometimes yes — it's called purging and only happens with cell-turnover actives (Retinoids, AHAs, BHAs). True purging lasts 2–4 weeks, appears where you usually get breakouts, and clears completely. If new bumps appear in unusual spots, or last beyond 6 weeks, it's not purging — it's irritation or a comedogenic ingredient mismatch. Stop and consult our dermatology team via /consultation."},
        {"q": "How much product should I actually use?",
         "a": "Serum: 4–5 drops or one pea-sized squeeze for the whole face. Moisturiser: one almond-sized scoop. Sunscreen: two finger-lengths (2 stripes from base to tip of index + middle finger) — this is what gives you the claimed SPF protection; using less means you're getting half the SPF. Eye cream: a rice-grain dot per eye, patted in with the ring finger."},
        {"q": "Is sunscreen really needed indoors and in winter?",
         "a": "Yes. UVA (the ageing ray) penetrates window glass, clouds, and is constant year-round in India. Blue light from screens and overhead LEDs also contributes to pigmentation. Daily SPF 50 from 9am to 6pm, reapplied every 4 hours when near windows or outdoors, prevents up to 80% of visible ageing. Indoor-only days still need at least one morning application."},
        {"q": "Are clean / natural ingredients always better than active ingredients?",
         "a": "No — \"clean\" is a marketing term, not a scientific standard. Many natural ingredients (citrus essential oils, fragrance, walnut shell powder) are highly irritating. Many synthetic actives (Niacinamide, Hyaluronic Acid, Peptides) are bio-identical to molecules already in your skin. Choose ingredients by clinical evidence, not by where they come from. Every Celesta Glow formula is non-comedogenic, fragrance-free, and dermatologically tested."},
        {"q": "What's the 7-day return policy on skincare?",
         "a": "We accept 7-day returns on factory-sealed, unopened bottles only. Skincare is regulated as a hygiene product in India, so opened bottles cannot be returned for safety reasons. If a product doesn't suit you after opening, WhatsApp us at +91 9446125745 with a photo of the reaction — we'll either guide you to a compatible alternative or issue store credit on a case-by-case basis."},
        {"q": "How do I store my skincare products to make them last longer?",
         "a": "Keep all products in cool, dark places (away from direct sunlight and bathroom humidity). Vitamin C serums and Retinols especially degrade in heat — store them in the refrigerator for 30% longer shelf life. Always close lids tightly to prevent oxidation. Check the PAO symbol (Period After Opening, e.g. 12M) on the back of each product — that's how many months it stays potent after first use."},
    ],
    "cosmetics": [
        {"q": "How do I find my perfect foundation and concealer shade online?",
         "a": "Match foundation to the side of your jaw (not your wrist or forehead — these are usually a different undertone). For undertone: look at your inner wrist veins — blue/purple = cool, green = warm, mixed = neutral. Our shade-match guide (Cosmetics page) shows 24 shades on real Indian skin tones. If you're between two shades, pick the lighter one for winter and the darker one for summer."},
        {"q": "Are your cosmetics safe for sensitive skin and acne-prone skin?",
         "a": "Yes — every Celesta Glow makeup formula is non-comedogenic (won't clog pores), fragrance-free, and dermatologically tested on Indian skin. Our foundations and concealers contain Niacinamide and Hyaluronic Acid that actually treat skin while you wear them. We avoid common irritants like talc, parabens, mineral oil, and synthetic fragrance across the entire cosmetics range."},
        {"q": "How do I prep my skin so makeup lasts longer in Indian humidity?",
         "a": "1) Cleanse with a gentle cleanser, 2) apply a hydrating toner, 3) wait 60 seconds, then apply a lightweight oil-free moisturiser, 4) wait 2 minutes, 5) apply SPF 50, 6) wait 5 minutes before primer. The waiting is everything — applying makeup on tacky skin causes pilling and 4-hour meltdown. In peak humidity, finish with a setting spray to lock everything in for 10–12 hours."},
        {"q": "What's the difference between matte, dewy and satin finishes?",
         "a": "Matte = no shine, photo-friendly, lasts longest in humidity, best for oily skin. Dewy = high glow, looks lit-from-within, best for dry/normal skin, can look greasy on oily skin. Satin = the middle ground — soft natural radiance without slip, the most universally flattering finish and what most Celesta Glow base products default to. You can transform matte into dewy with a few drops of facial oil mixed in."},
        {"q": "How do I remove long-wear makeup at the end of the day?",
         "a": "Double cleansing is non-negotiable: 1) An oil-based or balm cleanser to melt makeup, SPF and sebum (massage onto dry skin for 60 seconds, emulsify with water, rinse). 2) Follow with a gentle water-based cleanser to remove the oil residue. Never go to bed in makeup — it traps free radicals, causes oxidative ageing, and clogs pores within hours."},
        {"q": "Are your products cruelty-free and what's in them?",
         "a": "100% cruelty-free, never tested on animals, and not sold in any country requiring animal testing. Most products are vegan (we'll specifically label non-vegan items like products containing beeswax or carmine). Full ingredient lists are on every product page — we believe in radical transparency. No hidden \"fragrance\" blends, no proprietary mystery actives."},
        {"q": "How do I build a 5-minute everyday makeup routine?",
         "a": "Tinted moisturiser (evens tone + adds skincare) → concealer only where needed (under-eye + any spots) → cream blush patted onto cheekbones (also works on lips) → brow gel to set brows → one swipe of mascara. Skip eyeshadow, lipstick, highlighter for everyday — your skin will thank you. 5 minutes, 5 products, looks like you got 8 hours of sleep."},
        {"q": "Do your shades photograph well for selfies and reels?",
         "a": "Yes — every product is tested under 5 lighting conditions: natural daylight, indoor warm light (3000K), cool office light (5000K), ring-light flash, and on-camera flash. We avoid heavy mica/SPF in foundations that cause flashback (the white ghost-face effect in flash photos). Our matte products use micro-fine pigments that look natural on camera at 1080p and 4K."},
        {"q": "How long do your makeup products stay potent after opening?",
         "a": "Mascaras and liquid liners: 3 months (bacterial risk for eyes is highest). Liquid foundations and concealers: 12 months. Lipsticks and lip liners: 18 months. Cream blushes and bronzers: 12 months. Powder products: 24 months. Check the PAO symbol (e.g. 12M) on the bottom of each tube. Store away from sunlight; lipsticks in the fridge during summer to prevent melting."},
        {"q": "What's your 7-day return policy on makeup?",
         "a": "Sealed, unused makeup can be returned within 7 days for a full refund. Opened or used products cannot be returned for hygiene reasons — but if a product doesn't suit you, WhatsApp us at +91 9446125745 with a photo and reason. We'll issue store credit on a case-by-case basis, or guide you to a better shade/formula match for your next purchase."},
    ],
    "anti-aging": [
        {"q": "How quickly will I see results from the Anti-Aging Kit?",
         "a": "Most users notice softer skin and a brighter complexion within 7–10 days. Visible firming and reduction in fine lines typically appear at 4 weeks of consistent AM + PM use."},
        {"q": "Is retinol safe for Indian skin? Will it cause irritation?",
         "a": "Yes — our retinol is buffered with peptides and ceramides specifically for tropical-climate Indian skin. Start with 2 nights per week, then increase. Mild flaking in the first 2 weeks is normal adjustment."},
        {"q": "Can I use the Vitamin C serum and retinol together?",
         "a": "Yes, but on alternating routines. Use Vitamin C in the AM (boosts SPF), retinol in the PM (light degrades it). Sandwich retinol between moisturiser for sensitive skin."},
        {"q": "Are the products dermatologically tested?",
         "a": "Every formula passes a 3-stage review with board-certified dermatologists specialising in Indian skin types and climate."},
        {"q": "What if it doesn't work for me?",
         "a": "7-day return on factory-sealed bottles. Opened bottles cannot be returned for hygiene reasons — please WhatsApp us before breaking the seal."},
        {"q": "How is shipping & delivery?",
         "a": "Free shipping on orders over ₹499. Most metros 2–3 business days, tier-2 cities 4–5 days. COD available across India."},
    ],
}


class FAQGenerator:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")

    async def _generate_with_ai(self, niche: str) -> list:
        """Call Emergent LLM to generate 8-10 in-depth FAQs for the niche."""
        if not self.api_key:
            return []

        from emergentintegrations.llm.chat import LlmChat, UserMessage

        niche_context = {
            "skincare": "skincare routines, ingredients (retinol, vitamin C, niacinamide, hyaluronic acid, AHA/BHA), skin types (oily/dry/combo/sensitive), Indian climate concerns (humidity, pollution, sun damage), pigmentation, acne, anti-ageing for 25-55 age group",
            "cosmetics": "makeup and cosmetics for Indian skin tones, foundation shade matching, lipsticks, mascaras, primers, long-wear in Indian humidity, makeup removal, cruelty-free formulations, makeup for sensitive/acne-prone skin",
            "anti-aging": "anti-ageing skincare for Indian adults 28+, retinol, peptides, vitamin C, fine lines, firming, dark circles, complete anti-ageing routines",
        }.get(niche, "skincare")

        system_msg = (
            "You are a senior dermatologist and skincare educator writing for Celesta Glow — India's #1 anti-aging skincare brand. "
            "You write detailed, science-backed FAQ answers that go beyond surface-level marketing. "
            "Each answer must be 3-6 sentences, include specific actionable details (numbers, timeframes, ingredients, mechanisms), and feel like advice from a trusted expert, not generic marketing copy."
        )

        prompt = f"""Generate EXACTLY 9 detailed, in-depth FAQs about: {niche_context}.

Requirements for each FAQ:
- Question is a real question an Indian customer aged 25-55 would actually ask before buying
- Answer is 3-6 sentences, 70-150 words, with concrete details (timeframes, percentages, ingredient names, mechanisms, application steps)
- Avoid generic marketing fluff. Sound like a dermatologist explaining to a friend.
- Cover: results-timeline, how-to-use, ingredient safety, layering/compatibility, common myths, returns, storage, finding-your-match, side-effects.
- Include at least 1 FAQ about the 7-day return policy.
- Tone: warm, expert, India-aware (mention humidity, pollution, climate where relevant).

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {{"q": "Question 1?", "a": "Detailed answer 1."}},
  {{"q": "Question 2?", "a": "Detailed answer 2."}}
]"""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"faq-{niche}-{uuid.uuid4().hex[:8]}",
                system_message=system_msg,
            ).with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            m = re.search(r"\[[\s\S]*\]", resp)
            if not m:
                logger.warning(f"[faq-gen] No JSON array in AI response for {niche}")
                return []
            raw = m.group()
            raw = re.sub(r",\s*]", "]", raw)
            raw = re.sub(r",\s*}", "}", raw)
            data = json.loads(raw)
            cleaned = []
            for item in data:
                if isinstance(item, dict) and item.get("q") and item.get("a"):
                    cleaned.append({"q": str(item["q"]).strip(), "a": str(item["a"]).strip()})
            return cleaned[:10]
        except Exception as e:
            logger.error(f"[faq-gen] AI call failed for {niche}: {e}")
            return []

    async def get_faqs(self, niche: str, force_refresh: bool = False) -> list:
        """Return cached FAQs (refreshed every 7 days) or generate fresh."""
        niche = (niche or "skincare").lower().strip()
        if niche not in ("skincare", "cosmetics", "anti-aging"):
            niche = "skincare"

        # 1. Check cache
        if not force_refresh:
            cached = await self.db.faq_cache.find_one({"niche": niche})
            if cached and cached.get("faqs"):
                gen_at = cached.get("generated_at")
                try:
                    gen_dt = datetime.fromisoformat(gen_at.replace("Z", "+00:00")) if isinstance(gen_at, str) else gen_at
                    if gen_dt and (datetime.now(timezone.utc) - gen_dt) < timedelta(days=CACHE_DAYS):
                        return cached["faqs"]
                except Exception:
                    pass

        # 2. Try AI generation
        faqs = await self._generate_with_ai(niche)

        # 3. Fall back to static high-quality set
        if not faqs or len(faqs) < 4:
            faqs = FALLBACK.get(niche, FALLBACK["skincare"])
            source = "fallback"
        else:
            source = "ai"

        # 4. Store in cache
        try:
            await self.db.faq_cache.update_one(
                {"niche": niche},
                {"$set": {
                    "niche": niche,
                    "faqs": faqs,
                    "source": source,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
        except Exception as e:
            logger.error(f"[faq-gen] cache write failed: {e}")

        return faqs
