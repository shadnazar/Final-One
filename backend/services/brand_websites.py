"""Map of brand sheet-name → official website + search URL builder.

Most Indian D2C brands run Shopify, which exposes `/search/suggest.json?q=X`
returning a clean JSON product list with title, url, image, vendor, price.
For brands NOT on Shopify, we fall back to a generic `/search?q=X` HTML page
and parse the first product link, or skip the scrape entirely and rely on
LLM enrichment alone.
"""
from __future__ import annotations
from typing import Optional

# Sheet-name → official website (uppercase keys, matched after .strip().upper())
BRAND_SITES: dict[str, str] = {
    "COSRX": "https://www.cosrx.com",
    "LANEIGE": "https://www.laneige.com",
    "BEAUTY OF JOSEON": "https://beautyofjoseon.com",
    "MIRABELLE": "https://www.mirabelleko.com",
    "BIODERMA": "https://www.bioderma.in",
    "THE ORDINARY": "https://theordinary.com",
    "MINIMALIST": "https://beminimalist.co",
    "DERMACO": "https://thedermaco.com",
    "PILGRIM": "https://discoverpilgrim.com",
    "PLUM": "https://plumgoodness.com",
    "DOT&KEY": "https://www.dotandkey.com",
    "DOTKEY": "https://www.dotandkey.com",
    "ESTEELAUDER": "https://www.esteelauder.in",
    "GLOW RECIPE": "https://www.glowrecipe.com",
    "THE FACE SHOP": "https://thefaceshop.in",
    "CETAPHIL": "https://www.cetaphil.com",
    "SIMPLE": "https://www.simpleskincare.in",
    "FIXDERMA": "https://www.fixderma.com",
    "MAMAEARTH": "https://mamaearth.in",
    "AQUALOGICA": "https://aqualogica.in",
    "LAKME": "https://www.lakmeindia.com",
    "LOREAL PARIS": "https://www.lorealparis.in",
    "LOTUS": "https://www.lotusherbals.com",
    "SEBAMED": "https://www.sebamedindia.com",
    "DR SHEITHS": "https://drsheths.com",
    "MAYBELLINE": "https://www.maybelline.co.in",
    "TOO FACE": "https://www.toofaced.com",
    "TOO FACED": "https://www.toofaced.com",
    "MAC": "https://www.maccosmetics.in",
    "SUGAR": "https://www.sugarcosmetics.com",
    "QUENCH": "https://quenchbotanics.com",
    "RENEE": "https://reneecosmetics.com",
    "COLORBAR": "https://www.colorbarcosmetics.com",
    "HUDABEAUTY": "https://hudabeauty.com",
    "REVOLUTION": "https://www.revolutionbeauty.com",
    "NYKAA": "https://www.nykaa.com",
    "KAY BEAUTY": "https://kaybykatrina.com",
    "SWISS BEAUTY": "https://swissbeauty.in",
    "SWISS BEAUTY SELECT": "https://swissbeauty.in",
    "AURIC": "https://auric.in",
    "AUREANA": "https://aureana.in",
    "FOREVER52": "https://www.daily-life.in",
    "CERAVE": "https://www.cerave.com",
    "FLICKA": "https://flicka.in",
    "CHARACTER": "https://www.charactercosmetics.in",
    "DERMA K": "https://www.dermak.in",
    "KROYLON": "https://www.kryolan.com",
    "PAC": "https://www.paccosmetics.in",
}

# Brands known to run on Shopify — supports /search/suggest.json
SHOPIFY_BRANDS: set[str] = {
    "MINIMALIST", "PILGRIM", "PLUM", "DOT&KEY", "DOTKEY", "MAMAEARTH", "AQUALOGICA",
    "DR SHEITHS", "SUGAR", "QUENCH", "RENEE", "FIXDERMA", "DERMACO", "KAY BEAUTY",
    "SWISS BEAUTY", "SWISS BEAUTY SELECT", "FLICKA", "AURIC", "AUREANA", "MIRABELLE",
    "BEAUTY OF JOSEON", "GLOW RECIPE",
}


def normalize_brand(sheet_name: str) -> str:
    return (sheet_name or "").strip().upper()


def get_brand_site(sheet_name: str) -> Optional[str]:
    return BRAND_SITES.get(normalize_brand(sheet_name))


def is_shopify(sheet_name: str) -> bool:
    return normalize_brand(sheet_name) in SHOPIFY_BRANDS
