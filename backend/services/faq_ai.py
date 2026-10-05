"""AI FAQ generator for the one-click Generate Gallery + Certificate flow.

Generates a detailed, concern-specific FAQ set (TEXT, not images) using the
Emergent universal key (Gemini). Falls back to a rich rule-based set so the
flow always produces useful FAQs even when the key budget is exhausted.
"""
import os
import re
import json
import uuid
import logging

logger = logging.getLogger(__name__)


def _fallback_faqs(product_name: str, concern_label: str, actives: list) -> list:
    a = ", ".join(actives[:3]) if actives else "clinically-proven actives"
    cl = concern_label or "your skin concern"
    return [
        {"q": f"How soon will {product_name} improve {cl.lower()}?",
         "a": f"Most users notice a visible difference in {cl.lower()} within 2–4 weeks of consistent AM/PM use. "
              f"Because {product_name} is powered by {a}, deeper results (firmness, even tone) typically build over 6–8 weeks."},
        {"q": f"How exactly does it target {cl.lower()}?",
         "a": f"{a.split(',')[0]} works at the surface and deeper layers to address the root causes of {cl.lower()} — "
              f"resurfacing dull cells, supporting the barrier and calming irritation — so skin looks clearer and healthier over time."},
        {"q": "Is it safe for sensitive or reactive skin?",
         "a": "Yes. It is dermatologically tested, fragrance-light and pH-balanced. If you are new to actives, start every alternate "
              "night for the first week, then build up to daily use as tolerance improves."},
        {"q": "Can I layer it with my other products?",
         "a": f"Absolutely. Cleanse, apply {product_name}, then lock in with a moisturiser. In the morning always finish with SPF 50, "
              f"as active ingredients can increase sun sensitivity."},
        {"q": "When is the best time to apply — AM or PM?",
         "a": f"For {cl.lower()}, a consistent PM routine gives the best results, with a lighter AM application if your skin is comfortable. "
              "Consistency matters far more than quantity."},
        {"q": "What if it does not suit me?",
         "a": "We offer a 7-day return on unopened, factory-sealed items. Damaged-on-arrival or wrong-item orders are always covered, "
              "and our skin experts can suggest a gentler alternative from the range."},
    ]


async def generate_faqs(product: dict, concern_label: str) -> list:
    """Return a list of {q, a}. Tries Gemini, falls back to rule-based."""
    name = product.get("short_name") or product.get("name") or "this product"
    actives = [p.strip() for p in re.split(r"[+,]", product.get("key_ingredients") or "") if p.strip()]
    concern_label = concern_label or "skin concerns"

    try:
        from services.llm_helper import llm_text
        prompt = (
            f"You are a dermatology copywriter for the skincare brand Celesta Glow.\n"
            f"Write 6 detailed, buyer-focused FAQs for the product '{name}', which specifically "
            f"targets the concern '{concern_label}'. Key ingredients: {', '.join(actives) or 'clinically-proven actives'}.\n"
            f"Each answer must be 2–3 sentences, specific to '{concern_label}', factual and reassuring "
            f"(mention timelines, how the actives work, layering, SPF, and returns where relevant).\n"
            f"Return ONLY valid JSON: {{\"faqs\":[{{\"q\":\"...\",\"a\":\"...\"}}]}}"
        )
        resp = await llm_text(prompt, system="You write accurate, concise skincare FAQs. Output strict JSON only.")
        m = re.search(r"\{[\s\S]*\}", resp or "")
        if m:
            data = json.loads(m.group())
            faqs = data.get("faqs") or []
            norm = [{"q": f.get("q") or f.get("question"), "a": f.get("a") or f.get("answer")}
                    for f in faqs if (f.get("q") or f.get("question")) and (f.get("a") or f.get("answer"))]
            if len(norm) >= 4:
                return norm[:8]
    except Exception as e:
        logger.warning(f"[faq_ai] Gemini FAQ generation failed, using fallback: {e}")

    return _fallback_faqs(name, concern_label, actives)
