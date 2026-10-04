"""
Internationalization (i18n) API Routes - Multi-language support
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional
import json

router = APIRouter(prefix="/i18n", tags=["i18n"])

# Supported languages
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "हिन्दी (Hindi)"
}

# Translation keys for static content
TRANSLATIONS = {
    "en": {
        # Navigation
        "nav.home": "Home",
        "nav.shop": "Shop",
        "nav.blog": "Blog",
        "nav.contact": "Contact",
        
        # Hero Section
        "hero.badge": "NO MORE SKIN PROBLEMS",
        "hero.title": "Transform Your Skin",
        "hero.subtitle": "Advanced Age Balance Multi Active Serum",
        "hero.cta": "Order Now",
        
        # Product Info
        "product.name": "Celesta Glow Anti-Aging Face Serum",
        "product.price": "₹399",
        "product.mrp": "₹1,499",
        "product.discount": "73% OFF",
        "product.stock": "Only {count} left!",
        "product.viewers": "{count} people are viewing this",
        "product.sold_today": "{count} sold today",
        
        # Trust Badges
        "trust.guarantee": "7 Day Money Back Guarantee",
        "trust.delivery": "Free Delivery",
        "trust.dermatologist": "Dermatologist Tested",
        "trust.genuine": "100% Genuine",
        
        # Checkout
        "checkout.prepaid": "Prepaid",
        "checkout.cod": "Cash on Delivery",
        "checkout.prepaid_benefit": "Save ₹51 + Fast Delivery",
        "checkout.cod_note": "₹49 Advance + ₹401 on Delivery",
        "checkout.place_order": "Place Order",
        
        # Sections
        "section.testimonials": "What Our Customers Say",
        "section.why_skin_changes": "Why Skin Changes Over Time",
        "section.4_serums": "4 Serums in One Bottle",
        "section.how_to_use": "How to Use",
        "section.faq": "Frequently Asked Questions",
        
        # Common
        "common.loading": "Loading...",
        "common.error": "Something went wrong",
        "common.read_more": "Read More",
        "common.view_all": "View All",
        "common.verified": "Verified",
    },
    "hi": {
        # Navigation
        "nav.home": "होम",
        "nav.shop": "दुकान",
        "nav.blog": "ब्लॉग",
        "nav.contact": "संपर्क",
        
        # Hero Section
        "hero.badge": "अब कोई त्वचा समस्या नहीं",
        "hero.title": "अपनी त्वचा को बदलें",
        "hero.subtitle": "एडवांस्ड एज बैलेंस मल्टी एक्टिव सीरम",
        "hero.cta": "अभी ऑर्डर करें",
        
        # Product Info
        "product.name": "सेलेस्टा ग्लो एंटी-एजिंग फेस सीरम",
        "product.price": "₹399",
        "product.mrp": "₹1,499",
        "product.discount": "73% छूट",
        "product.stock": "केवल {count} बचे हैं!",
        "product.viewers": "{count} लोग इसे देख रहे हैं",
        "product.sold_today": "आज {count} बिके",
        
        # Trust Badges
        "trust.guarantee": "7 दिन मनी बैक गारंटी",
        "trust.delivery": "मुफ्त डिलीवरी",
        "trust.dermatologist": "त्वचा विशेषज्ञ द्वारा परीक्षित",
        "trust.genuine": "100% असली",
        
        # Checkout
        "checkout.prepaid": "प्रीपेड",
        "checkout.cod": "कैश ऑन डिलीवरी",
        "checkout.prepaid_benefit": "₹51 बचाएं + तेज़ डिलीवरी",
        "checkout.cod_note": "₹49 एडवांस + ₹401 डिलीवरी पर",
        "checkout.place_order": "ऑर्डर करें",
        
        # Sections
        "section.testimonials": "हमारे ग्राहक क्या कहते हैं",
        "section.why_skin_changes": "त्वचा समय के साथ क्यों बदलती है",
        "section.4_serums": "एक बोतल में 4 सीरम",
        "section.how_to_use": "कैसे उपयोग करें",
        "section.faq": "अक्सर पूछे जाने वाले प्रश्न",
        
        # Common
        "common.loading": "लोड हो रहा है...",
        "common.error": "कुछ गलत हो गया",
        "common.read_more": "और पढ़ें",
        "common.view_all": "सभी देखें",
        "common.verified": "सत्यापित",
    }
}


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "languages": [
            {"code": code, "name": name} 
            for code, name in SUPPORTED_LANGUAGES.items()
        ],
        "default": "en"
    }


@router.get("/translations/{language}")
async def get_translations(language: str):
    """Get all translations for a specific language"""
    if language not in TRANSLATIONS:
        raise HTTPException(status_code=404, detail=f"Language '{language}' not supported")
    
    return {
        "language": language,
        "translations": TRANSLATIONS[language]
    }


@router.get("/translate/{language}/{key}")
async def get_single_translation(language: str, key: str):
    """Get a single translation by key"""
    if language not in TRANSLATIONS:
        raise HTTPException(status_code=404, detail=f"Language '{language}' not supported")
    
    translation = TRANSLATIONS[language].get(key)
    if translation is None:
        # Fallback to English
        translation = TRANSLATIONS["en"].get(key, key)
    
    return {
        "key": key,
        "language": language,
        "translation": translation
    }
