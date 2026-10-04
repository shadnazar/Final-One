"""
Seed data for skin concerns, product categories, and additional sample products.
Idempotent — only seeds if collections are empty / new fields are missing.
"""
import logging
from datetime import datetime, timezone


# ==================== SKIN CONCERNS (problem-based) ====================
# Each concern = a customer-facing problem that maps to multiple products.
# `accent_color` drives the tile background hue on Homepage / ConcernPage.
CONCERNS = [
    {
        "slug": "anti-aging",
        "name": "Anti-Aging",
        "tagline": "Wrinkles, fine lines, firmness",
        "icon": "✨",
        "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#fef3c7",
        "accent_to": "#fde68a",
        "accent_text": "#78350f",
        "description": "Slow visible aging, smooth fine lines, restore firmness with retinoid + peptides.",
        "sort_order": 1,
        "is_active": True,
    },
    {
        "slug": "acne-blemishes",
        "name": "Acne & Blemishes",
        "tagline": "Pimples, breakouts, blackheads",
        "icon": "🎯",
        "image": "https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#ffe4e6",
        "accent_to": "#fecdd3",
        "accent_text": "#9f1239",
        "description": "Salicylic acid + niacinamide formulas to calm breakouts and refine pores.",
        "sort_order": 2,
        "is_active": True,
    },
    {
        "slug": "pigmentation",
        "name": "Pigmentation & Dark Spots",
        "tagline": "Uneven tone, melasma",
        "icon": "🌗",
        "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#ede9fe",
        "accent_to": "#ddd6fe",
        "accent_text": "#5b21b6",
        "description": "Vitamin C + alpha arbutin to fade spots and even your skin tone.",
        "sort_order": 3,
        "is_active": True,
    },
    {
        "slug": "dullness",
        "name": "Dullness & Glow",
        "tagline": "Tired, lifeless skin",
        "icon": "💎",
        "image": "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#dcfce7",
        "accent_to": "#bbf7d0",
        "accent_text": "#14532d",
        "description": "Brighten and revive your natural glow with antioxidant-rich actives.",
        "sort_order": 4,
        "is_active": True,
    },
    {
        "slug": "dark-circles",
        "name": "Dark Circles & Puffiness",
        "tagline": "Tired eyes, under-eye bags",
        "icon": "👁️",
        "image": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#dbeafe",
        "accent_to": "#bfdbfe",
        "accent_text": "#1e3a8a",
        "description": "Caffeine + peptides to depuff and brighten the delicate eye area.",
        "sort_order": 5,
        "is_active": True,
    },
    {
        "slug": "dryness",
        "name": "Dryness & Dehydration",
        "tagline": "Flaky, tight skin",
        "icon": "💧",
        "image": "https://images.unsplash.com/photo-1620916297893-c2cd4f5fb73f?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#cffafe",
        "accent_to": "#a5f3fc",
        "accent_text": "#155e75",
        "description": "Hyaluronic acid + ceramides to lock in moisture all day long.",
        "sort_order": 6,
        "is_active": True,
    },
    {
        "slug": "oily-skin",
        "name": "Oily Skin & Pores",
        "tagline": "Excess oil, large pores",
        "icon": "✨",
        "image": "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#ecfccb",
        "accent_to": "#d9f99d",
        "accent_text": "#365314",
        "description": "Niacinamide + zinc to balance oil and visibly minimize pores.",
        "sort_order": 7,
        "is_active": True,
    },
    {
        "slug": "sensitive-skin",
        "name": "Sensitive Skin",
        "tagline": "Redness, irritation",
        "icon": "🌿",
        "image": "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#fce7f3",
        "accent_to": "#fbcfe8",
        "accent_text": "#831843",
        "description": "Centella + allantoin formulas designed for reactive, sensitive skin.",
        "sort_order": 8,
        "is_active": True,
    },
    {
        "slug": "large-pores",
        "name": "Large Pores",
        "tagline": "Pore size, congestion",
        "icon": "🔬",
        "image": "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#e0f2fe", "accent_to": "#bae6fd", "accent_text": "#075985",
        "description": "Niacinamide + BHA exfoliators refine pore size and clear congestion.",
        "sort_order": 9, "is_active": True,
    },
    {
        "slug": "fine-lines",
        "name": "Fine Lines & Wrinkles",
        "tagline": "Early signs of aging",
        "icon": "🌿",
        "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#fef3c7", "accent_to": "#fde68a", "accent_text": "#92400e",
        "description": "Peptides, retinoids and bakuchiol smooth fine lines.",
        "sort_order": 10, "is_active": True,
    },
    {
        "slug": "sun-damage",
        "name": "Sun Damage",
        "tagline": "UV stress, photo-aging",
        "icon": "☀️",
        "image": "https://images.unsplash.com/photo-1611080541599-8c6dbde6ed28?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#fef9c3", "accent_to": "#fef08a", "accent_text": "#854d0e",
        "description": "Broad-spectrum SPF + antioxidants reverse and prevent UV damage.",
        "sort_order": 11, "is_active": True,
    },
    {
        "slug": "uneven-tone",
        "name": "Uneven Skin Tone",
        "tagline": "Patchiness, texture",
        "icon": "🎨",
        "image": "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#ede9fe", "accent_to": "#ddd6fe", "accent_text": "#6d28d9",
        "description": "Gentle AHAs + tranexamic acid even out tone.",
        "sort_order": 12, "is_active": True,
    },
    {
        "slug": "redness",
        "name": "Redness & Rosacea",
        "tagline": "Flushing, broken capillaries",
        "icon": "🍃",
        "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#fee2e2", "accent_to": "#fecaca", "accent_text": "#991b1b",
        "description": "Centella + azelaic-acid formulas calm chronic redness.",
        "sort_order": 13, "is_active": True,
    },
    {
        "slug": "blackheads",
        "name": "Blackheads & Whiteheads",
        "tagline": "Comedones, nose & chin",
        "icon": "⚪",
        "image": "https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#e0e7ff", "accent_to": "#c7d2fe", "accent_text": "#3730a3",
        "description": "Salicylic acid + clay masks for stubborn comedones.",
        "sort_order": 14, "is_active": True,
    },
    {
        "slug": "dehydration",
        "name": "Dehydrated Skin",
        "tagline": "Tightness, surface fine lines",
        "icon": "💧",
        "image": "https://images.unsplash.com/photo-1576608472635-91a946e0bb73?auto=format&fit=crop&w=800&q=80",
        "accent_from": "#cffafe", "accent_to": "#a5f3fc", "accent_text": "#155e75",
        "description": "Hyaluronic acid + beta glucan restore moisture instantly.",
        "sort_order": 15, "is_active": True,
    },
]


# ==================== PRODUCT CATEGORIES (form-based) ====================
CATEGORIES = [
    {
        "slug": "cleanser",
        "name": "Cleansers",
        "tagline": "Face wash, micellar, makeup remover",
        "icon": "🧼",
        "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=80",
        "sort_order": 1,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "serum",
        "name": "Serums",
        "tagline": "Targeted treatment serums",
        "icon": "💧",
        "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
        "sort_order": 2,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "moisturizer-cream",
        "name": "Moisturizers & Creams",
        "tagline": "Day & night moisturizers",
        "icon": "🥥",
        "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
        "sort_order": 3,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "sunscreen",
        "name": "Sunscreens",
        "tagline": "Broad-spectrum SPF 30-50+",
        "icon": "☀️",
        "image": "https://images.unsplash.com/photo-1556228841-a3c527ebefe5?auto=format&fit=crop&w=800&q=80",
        "sort_order": 4,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "eye-care",
        "name": "Eye Care",
        "tagline": "Under eye creams & serums",
        "icon": "👁️",
        "image": "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80",
        "sort_order": 5,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "cosmetics-makeup",
        "name": "Cosmetics & Makeup",
        "tagline": "Lip, cheek, brow essentials",
        "icon": "💄",
        "image": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
        "sort_order": 6,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "lipstick",
        "name": "Lipstick & Lip Color",
        "tagline": "Tints, mattes, glosses",
        "icon": "💋",
        "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80",
        "sort_order": 7,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "eye-makeup",
        "name": "Eye Makeup",
        "tagline": "Eyeliner, mascara, kajal",
        "icon": "👁️",
        "image": "https://images.unsplash.com/photo-1583241800698-9c2e3a7b8ba8?auto=format&fit=crop&w=800&q=80",
        "sort_order": 8,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "brow",
        "name": "Brow",
        "tagline": "Pencils, gels, definers",
        "icon": "✏️",
        "image": "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=800&q=80",
        "sort_order": 9,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "face-makeup",
        "name": "Face Makeup",
        "tagline": "Foundation, blush, highlighter",
        "icon": "🎨",
        "image": "https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=800&q=80",
        "sort_order": 10,
        "is_active": True,
        "group": "cosmetics",
    },
    # ===== Expanded Skincare sub-categories (Amazon-style reference) =====
    {
        "slug": "facewash-scrubs",
        "name": "Facewash & Scrubs",
        "tagline": "Daily cleansers, exfoliators",
        "icon": "🧼",
        "image": "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=800&q=80",
        "sort_order": 11,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "toner",
        "name": "Toner",
        "tagline": "Balance & prep skin",
        "icon": "💦",
        "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
        "sort_order": 12,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "body-lotion",
        "name": "Body Lotion",
        "tagline": "Body moisturizers",
        "icon": "🧴",
        "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
        "sort_order": 13,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "lip-balm",
        "name": "Lip Balms",
        "tagline": "Hydrating lip care",
        "icon": "💋",
        "image": "https://images.unsplash.com/photo-1631730359585-38a4935cbec4?auto=format&fit=crop&w=800&q=80",
        "sort_order": 14,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "face-masks",
        "name": "Face Masks",
        "tagline": "Sheet, clay & overnight masks",
        "icon": "🎭",
        "image": "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=800&q=80",
        "sort_order": 15,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "exfoliators",
        "name": "Exfoliators",
        "tagline": "AHA · BHA · enzyme peels",
        "icon": "✨",
        "image": "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=800&q=80",
        "sort_order": 16,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "night-cream",
        "name": "Night Cream",
        "tagline": "Overnight repair & renewal",
        "icon": "🌙",
        "image": "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=800&q=80",
        "sort_order": 17,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "day-cream",
        "name": "Day Cream",
        "tagline": "Morning hydration boost",
        "icon": "☀️",
        "image": "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80",
        "sort_order": 18,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "face-mist",
        "name": "Face Mists",
        "tagline": "Refresh & set the routine",
        "icon": "💨",
        "image": "https://images.unsplash.com/photo-1626954079979-ec4f7b05e032?auto=format&fit=crop&w=800&q=80",
        "sort_order": 19,
        "is_active": True,
        "group": "skincare",
    },
    {
        "slug": "spot-treatment",
        "name": "Spot Treatment",
        "tagline": "Targeted acne & blemish care",
        "icon": "🎯",
        "image": "https://images.unsplash.com/photo-1556228720-da4e85f4e1cf?auto=format&fit=crop&w=800&q=80",
        "sort_order": 20,
        "is_active": True,
        "group": "skincare",
    },
    # ===== Expanded Cosmetics sub-categories (Amazon-style reference) =====
    {
        "slug": "kajal-eyeliner",
        "name": "Kajal & Eyeliner",
        "tagline": "Define your eyes",
        "icon": "👁️",
        "image": "https://images.unsplash.com/photo-1583241800698-9c2e3a7b8ba8?auto=format&fit=crop&w=800&q=80",
        "sort_order": 21,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "blush-highlighter",
        "name": "Blush & Highlighters",
        "tagline": "Glow & flush",
        "icon": "🌸",
        "image": "https://images.unsplash.com/photo-1631730359585-38a4935cbec4?auto=format&fit=crop&w=800&q=80",
        "sort_order": 22,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "lipstick-gloss",
        "name": "Lipsticks & Glosses",
        "tagline": "Bold mattes, shiny glosses",
        "icon": "💋",
        "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80",
        "sort_order": 23,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "eyeshadow",
        "name": "Eyeshadows",
        "tagline": "Shimmer, matte, palettes",
        "icon": "🎨",
        "image": "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80",
        "sort_order": 24,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "foundation-concealer",
        "name": "Foundations & Concealers",
        "tagline": "Flawless base coverage",
        "icon": "🪞",
        "image": "https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=800&q=80",
        "sort_order": 25,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "primer-compact",
        "name": "Primers & Compacts",
        "tagline": "Smooth canvas, set & go",
        "icon": "✨",
        "image": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=800&q=80",
        "sort_order": 26,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "nails-accessories",
        "name": "Nails and Accessories",
        "tagline": "Polishes, files, tools",
        "icon": "💅",
        "image": "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80",
        "sort_order": 27,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "makeup-kit",
        "name": "Makeup Kits",
        "tagline": "Curated bundles",
        "icon": "🎁",
        "image": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
        "sort_order": 28,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "makeup-brush",
        "name": "Makeup Brushes",
        "tagline": "Pro-grade brushes & tools",
        "icon": "🖌️",
        "image": "https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=800&q=80",
        "sort_order": 29,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "makeup-fixer",
        "name": "Makeup Fixers",
        "tagline": "Setting sprays for long wear",
        "icon": "💨",
        "image": "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80",
        "sort_order": 30,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "makeup-remover",
        "name": "Makeup Removers",
        "tagline": "Gentle, clean removers",
        "icon": "🫧",
        "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=80",
        "sort_order": 31,
        "is_active": True,
        "group": "cosmetics",
    },
    {
        "slug": "mascara",
        "name": "Mascara",
        "tagline": "Volume, length, lift",
        "icon": "👁️",
        "image": "https://images.unsplash.com/photo-1631214540242-3cd8c4b0b3b8?auto=format&fit=crop&w=800&q=80",
        "sort_order": 32, "is_active": True, "group": "cosmetics",
    },
    {
        "slug": "lip-liner",
        "name": "Lip Liners",
        "tagline": "Define & shape lips",
        "icon": "💄",
        "image": "https://images.unsplash.com/photo-1583241475880-083f84372725?auto=format&fit=crop&w=800&q=80",
        "sort_order": 33, "is_active": True, "group": "cosmetics",
    },
    {
        "slug": "setting-powder",
        "name": "Setting Powder",
        "tagline": "Matte finish, all-day wear",
        "icon": "⚪",
        "image": "https://images.unsplash.com/photo-1522335789203-aaa56a4d9b8d?auto=format&fit=crop&w=800&q=80",
        "sort_order": 34, "is_active": True, "group": "cosmetics",
    },
    {
        "slug": "bronzer-contour",
        "name": "Bronzer & Contour",
        "tagline": "Warmth, sculpt, definition",
        "icon": "🌅",
        "image": "https://images.unsplash.com/photo-1583241475880-083f84372725?auto=format&fit=crop&w=800&q=80",
        "sort_order": 35, "is_active": True, "group": "cosmetics",
    },
    {
        "slug": "body-care",
        "name": "Body Care",
        "tagline": "Body wash, scrubs, oils",
        "icon": "🛁",
        "image": "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=800&q=80",
        "sort_order": 36, "is_active": True, "group": "skincare",
    },
    {
        "slug": "hair-care",
        "name": "Hair Care",
        "tagline": "Shampoo, conditioner, serums",
        "icon": "💇",
        "image": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
        "sort_order": 37, "is_active": True, "group": "skincare",
    },
    {
        "slug": "lip-care",
        "name": "Lip Care",
        "tagline": "Lip balms, scrubs, masks",
        "icon": "💋",
        "image": "https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=800&q=80",
        "sort_order": 38, "is_active": True, "group": "skincare",
    },
]


# ==================== ADDITIONAL SAMPLE PRODUCTS ====================
# These cover more concerns + the new Cosmetics & Makeup category.
NEW_SAMPLE_PRODUCTS = [
    {
        "slug": "vitamin-c-glow-serum",
        "name": "Celesta Glow Vitamin C Brightening Serum",
        "short_name": "Vitamin C Glow Serum",
        "tagline": "10% L-Ascorbic Acid · Antioxidant",
        "description": "A potent brightening serum with 10% pure L-Ascorbic Acid, Ferulic Acid, and Vitamin E. Visibly fades dark spots, evens skin tone, and revives a healthy glow in 4 weeks.",
        "category": "serum",
        "concerns": ["dullness", "pigmentation", "anti-aging"],
        "key_ingredients": "10% Vitamin C + Ferulic Acid + Vitamin E",
        "ingredients_full": "Aqua, L-Ascorbic Acid, Glycerin, Propanediol, Tocopherol, Ferulic Acid, Sodium Hyaluronate, Phenoxyethanol, Ethylhexylglycerin",
        "benefits": ["Visibly fades dark spots", "Evens skin tone in 4 weeks", "Boosts natural glow", "Antioxidant protection"],
        "how_to_use": "Apply 3-4 drops to clean skin in the morning. Follow with sunscreen.",
        "size": "30ml / 1.01 fl oz",
        "images": ["https://images.unsplash.com/photo-1620916297893-c2cd4f5fb73f?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 1499, "prepaid_price": 849, "cod_price": 949, "cod_advance": 29,
        "discount_percent": 43, "badge": "Bestseller", "is_active": True, "sort_order": 6,
        "rating": 4.8, "reviews_count": 1654, "skin_type": "All Skin Types",
    },
    {
        "slug": "acne-control-gel",
        "name": "Celesta Glow Acne Control Spot Gel",
        "short_name": "Acne Spot Gel",
        "tagline": "2% Salicylic Acid · Tea Tree",
        "description": "A targeted spot gel with 2% Salicylic Acid, Tea Tree Oil, and Niacinamide. Calms active breakouts overnight and prevents new ones.",
        "category": "serum",
        "concerns": ["acne-blemishes", "oily-skin"],
        "key_ingredients": "2% Salicylic Acid + Tea Tree + Niacinamide",
        "ingredients_full": "Aqua, Salicylic Acid, Niacinamide, Melaleuca Alternifolia Oil, Centella Asiatica Extract, Glycerin, Propanediol, Phenoxyethanol",
        "benefits": ["Calms active breakouts overnight", "Prevents new pimples", "Refines visible pores", "Soothes redness"],
        "how_to_use": "Apply directly to blemishes morning and night with clean fingertips.",
        "size": "20g / 0.7 oz",
        "images": ["https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 699, "prepaid_price": 399, "cod_price": 449, "cod_advance": 29,
        "discount_percent": 43, "badge": "New Launch", "is_active": True, "sort_order": 7,
        "rating": 4.7, "reviews_count": 873, "skin_type": "Oily / Acne-Prone",
    },
    {
        "slug": "hydra-boost-toner",
        "name": "Celesta Glow Hydra-Boost Hyaluronic Toner",
        "short_name": "Hydra-Boost Toner",
        "tagline": "Multi-weight HA · 7-Day Glow",
        "description": "A weightless hydrating toner with 5 molecular weights of Hyaluronic Acid, Beta-Glucan, and Panthenol. Plumps, soothes, and preps skin for serums.",
        "category": "serum",
        "concerns": ["dryness", "dullness", "sensitive-skin"],
        "key_ingredients": "Hyaluronic Acid (5x) + Beta-Glucan + Panthenol",
        "ingredients_full": "Aqua, Sodium Hyaluronate, Hyaluronic Acid, Beta-Glucan, Panthenol, Allantoin, Glycerin, Niacinamide, Phenoxyethanol",
        "benefits": ["Locks in moisture all day", "Soothes irritation", "Plumps fine lines", "Preps skin for serums"],
        "how_to_use": "Apply to clean skin with cotton pad or hands. Use morning and night before serums.",
        "size": "150ml / 5.07 fl oz",
        "images": ["https://images.unsplash.com/photo-1556228841-a3c527ebefe5?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 899, "prepaid_price": 549, "cod_price": 599, "cod_advance": 29,
        "discount_percent": 39, "badge": "", "is_active": True, "sort_order": 8,
        "rating": 4.6, "reviews_count": 542, "skin_type": "Dry / Dehydrated / Sensitive",
    },
    {
        "slug": "niacinamide-pore-serum",
        "name": "Celesta Glow Niacinamide 10% + Zinc Pore Refining Serum",
        "short_name": "Pore Refiner Serum",
        "tagline": "10% Niacinamide · 1% Zinc",
        "description": "A high-strength pore-refining serum with 10% Niacinamide and 1% Zinc PCA. Visibly minimizes pores, balances oil, and clears congestion.",
        "category": "serum",
        "concerns": ["oily-skin", "acne-blemishes", "pigmentation"],
        "key_ingredients": "10% Niacinamide + 1% Zinc PCA",
        "ingredients_full": "Aqua, Niacinamide, Zinc PCA, Glycerin, Propanediol, Sodium Hyaluronate, Phenoxyethanol",
        "benefits": ["Minimizes visible pores", "Balances excess oil", "Clears congestion", "Smoother texture in 2 weeks"],
        "how_to_use": "Apply 3-4 drops to clean skin twice daily. Follow with moisturizer.",
        "size": "30ml / 1.01 fl oz",
        "images": ["https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 999, "prepaid_price": 599, "cod_price": 699, "cod_advance": 29,
        "discount_percent": 40, "badge": "", "is_active": True, "sort_order": 9,
        "rating": 4.7, "reviews_count": 1102, "skin_type": "Oily / Combination",
    },
    {
        "slug": "daily-moisturizer",
        "name": "Celesta Glow Daily Hydra-Cream Moisturizer",
        "short_name": "Daily Moisturizer",
        "tagline": "Ceramide + Squalane · 24h Hydration",
        "description": "A weightless gel-cream moisturizer with Ceramides, Squalane, and Hyaluronic Acid. Delivers 24-hour hydration without heaviness.",
        "category": "moisturizer-cream",
        "concerns": ["dryness", "sensitive-skin", "dullness"],
        "key_ingredients": "Ceramides + Squalane + Hyaluronic Acid",
        "ingredients_full": "Aqua, Squalane, Glycerin, Ceramide NP, Sodium Hyaluronate, Cetearyl Alcohol, Niacinamide, Allantoin, Phenoxyethanol",
        "benefits": ["24-hour hydration", "Strengthens skin barrier", "Soothes & calms redness", "Non-greasy gel-cream"],
        "how_to_use": "Apply to clean skin morning and night after serums.",
        "size": "50ml / 1.69 fl oz",
        "images": ["https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 999, "prepaid_price": 649, "cod_price": 749, "cod_advance": 29,
        "discount_percent": 35, "badge": "Daily Essential", "is_active": True, "sort_order": 10,
        "rating": 4.7, "reviews_count": 967, "skin_type": "All Skin Types",
    },
    {
        "slug": "lip-cheek-tint",
        "name": "Celesta Glow Lip & Cheek Tint",
        "short_name": "Lip & Cheek Tint",
        "tagline": "2-in-1 Multi-Use Stain",
        "description": "A buildable, weightless lip and cheek tint with hyaluronic acid and vitamin E. Long-wearing, transfer-resistant, dermatologically tested.",
        "category": "lipstick",
        "concerns": [],
        "key_ingredients": "Hyaluronic Acid + Vitamin E",
        "ingredients_full": "Aqua, Glycerin, Propanediol, CI 15850, Sodium Hyaluronate, Tocopherol, Phenoxyethanol",
        "benefits": ["Buildable color payoff", "Lightweight & comfortable", "Hydrates while it tints", "12-hour wear"],
        "how_to_use": "Dot onto lips and cheeks, blend with fingertips.",
        "size": "8ml / 0.27 fl oz",
        "images": ["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 599, "prepaid_price": 349, "cod_price": 399, "cod_advance": 29,
        "discount_percent": 42, "badge": "New Launch", "is_active": True, "sort_order": 11,
        "rating": 4.6, "reviews_count": 318, "skin_type": "All Skin Types",
    },
    {
        "slug": "tinted-lip-balm-spf",
        "name": "Celesta Glow Tinted Lip Balm SPF 15",
        "short_name": "Tinted Lip Balm SPF 15",
        "tagline": "Sun protection + a kiss of color",
        "description": "A nourishing tinted lip balm with SPF 15, shea butter, and vitamin E. Locks in moisture, protects from UV, and gives a soft natural tint.",
        "category": "lipstick",
        "concerns": ["dryness"],
        "key_ingredients": "Shea Butter + SPF 15 + Vitamin E",
        "ingredients_full": "Butyrospermum Parkii (Shea) Butter, Ricinus Communis (Castor) Seed Oil, Cera Alba, Octinoxate, Tocopherol, Hydrogenated Castor Oil, CI 77491",
        "benefits": ["Heals dry, chapped lips", "SPF 15 sun protection", "Subtle natural tint", "Lasts up to 6 hours"],
        "how_to_use": "Apply directly to lips. Reapply after eating or every 2 hours in sun.",
        "size": "4g / 0.14 oz",
        "images": ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 399, "prepaid_price": 249, "cod_price": 299, "cod_advance": 29,
        "discount_percent": 38, "badge": "", "is_active": True, "sort_order": 12,
        "rating": 4.7, "reviews_count": 421, "skin_type": "All Skin Types",
    },
    {
        "slug": "brow-definer-pencil",
        "name": "Celesta Glow Microblade Brow Definer Pencil",
        "short_name": "Brow Definer Pencil",
        "tagline": "Hair-fine 1.5mm tip · Smudge-proof",
        "description": "An ultra-fine 1.5mm tip brow pencil for hair-like strokes. Smudge-proof, water-resistant, and lasts 12+ hours.",
        "category": "brow",
        "concerns": [],
        "key_ingredients": "Carnauba Wax + Iron Oxides",
        "ingredients_full": "Hydrogenated Polyisobutene, Synthetic Wax, Iron Oxides (CI 77491, CI 77492, CI 77499), Carnauba Wax, Tocopherol",
        "benefits": ["Hair-fine 1.5mm precision tip", "Smudge & sweat proof", "12-hour wear", "Spoolie included"],
        "how_to_use": "Draw light hair-like strokes following the natural brow shape. Set with the spoolie.",
        "size": "0.08g · refillable",
        "images": ["https://images.unsplash.com/photo-1583241800698-9c2e3a7b8ba8?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 499, "prepaid_price": 299, "cod_price": 349, "cod_advance": 29,
        "discount_percent": 40, "badge": "", "is_active": True, "sort_order": 13,
        "rating": 4.6, "reviews_count": 256, "skin_type": "All Skin Types",
    },
    {
        "slug": "matte-velvet-lipstick",
        "name": "Celesta Glow Matte Velvet Lipstick",
        "short_name": "Matte Velvet Lipstick",
        "tagline": "Long-wear · Hyaluronic Acid Infused",
        "description": "A weightless matte lipstick that lasts 12 hours without drying lips. Infused with Hyaluronic Acid + Vitamin E.",
        "category": "lipstick",
        "concerns": [],
        "key_ingredients": "Hyaluronic Acid + Vitamin E + Jojoba",
        "ingredients_full": "Ricinus Communis (Castor) Seed Oil, Hydrogenated Polyisobutene, Sodium Hyaluronate, Tocopherol, Iron Oxides, CI 15850",
        "benefits": ["12-hour intense matte wear", "Hydrating, never cakey", "Buildable color payoff", "Vegan & cruelty-free"],
        "how_to_use": "Apply directly to lips. Build up for deeper color.",
        "size": "3.5g / 0.12 oz",
        "images": ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 599, "prepaid_price": 349, "cod_price": 399, "cod_advance": 29,
        "discount_percent": 42, "badge": "Bestseller", "is_active": True, "sort_order": 14,
        "rating": 4.7, "reviews_count": 612, "skin_type": "All Skin Types",
    },
    {
        "slug": "liquid-eyeliner-jet-black",
        "name": "Celesta Glow Liquid Eyeliner — Jet Black",
        "short_name": "Liquid Eyeliner",
        "tagline": "Felt-tip · 24h Smudge-proof",
        "description": "A precision felt-tip liquid eyeliner with deep jet-black pigment. Smudge-proof, water-resistant, 24-hour wear.",
        "category": "eye-makeup",
        "concerns": [],
        "key_ingredients": "Carbon Black + Acrylates Copolymer",
        "ingredients_full": "Aqua, Acrylates Copolymer, Glycerin, Phenoxyethanol, Iron Oxide (CI 77499), Polysorbate 20",
        "benefits": ["Ultra-thin precision felt tip", "Jet-black intense pigment", "24-hour smudge-proof", "Water-resistant"],
        "how_to_use": "Glide along the lash line for a thin or thick line.",
        "size": "1ml / 0.03 fl oz",
        "images": ["https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 549, "prepaid_price": 299, "cod_price": 349, "cod_advance": 29,
        "discount_percent": 46, "badge": "New Launch", "is_active": True, "sort_order": 15,
        "rating": 4.6, "reviews_count": 384, "skin_type": "All Skin Types",
    },
    {
        "slug": "volumizing-mascara",
        "name": "Celesta Glow Volume Boost Mascara",
        "short_name": "Volume Boost Mascara",
        "tagline": "10x Volume · Smudge & Flake-Proof",
        "description": "A volumizing mascara with bamboo-fiber brush for 10x lash volume. Smudge-proof, flake-free, all-day wear.",
        "category": "eye-makeup",
        "concerns": [],
        "key_ingredients": "Bamboo Extract + Pro-Vitamin B5",
        "ingredients_full": "Aqua, Cera Alba, Iron Oxide (CI 77499), Stearic Acid, Bambusa Vulgaris Extract, Panthenol, Phenoxyethanol",
        "benefits": ["10x volume in 2 coats", "Smudge & flake-proof", "Conditions lashes", "Easy water-based removal"],
        "how_to_use": "Apply 2 coats from root to tip, zigzag motion.",
        "size": "9ml / 0.30 fl oz",
        "images": ["https://images.unsplash.com/photo-1599733589046-8a0a8044f2cf?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 599, "prepaid_price": 379, "cod_price": 429, "cod_advance": 29,
        "discount_percent": 37, "badge": "", "is_active": True, "sort_order": 16,
        "rating": 4.5, "reviews_count": 289, "skin_type": "All Eyes",
    },
    {
        "slug": "blush-stick-rose",
        "name": "Celesta Glow Cream Blush Stick — Rose Petal",
        "short_name": "Cream Blush Stick",
        "tagline": "Buildable · Dewy Finish",
        "description": "A creamy blush stick with a soft dewy finish. Blendable, buildable, and gives skin a healthy flush.",
        "category": "face-makeup",
        "concerns": [],
        "key_ingredients": "Squalane + Vitamin E + Jojoba",
        "ingredients_full": "Caprylic/Capric Triglyceride, Squalane, Tocopherol, Jojoba Esters, Iron Oxides, Mica",
        "benefits": ["Buildable dewy color", "Hydrating, weightless", "All-day wear", "Lip + cheek dual-use"],
        "how_to_use": "Dot onto cheeks and blend with fingertips. Also works on lips.",
        "size": "5g / 0.17 oz",
        "images": ["https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 549, "prepaid_price": 329, "cod_price": 379, "cod_advance": 29,
        "discount_percent": 40, "badge": "", "is_active": True, "sort_order": 17,
        "rating": 4.6, "reviews_count": 198, "skin_type": "All Skin Types",
    },
    # ===== Skincare niche - 5 more samples =====
    {
        "slug": "retinol-night-renewal",
        "name": "Celesta Glow 0.3% Retinol Night Renewal Cream",
        "short_name": "Retinol Night Cream",
        "tagline": "Encapsulated Retinol · Bakuchiol",
        "description": "A gentle yet powerful overnight retinol cream. Encapsulated 0.3% Retinol with Bakuchiol & Squalane resurfaces skin while you sleep — without the irritation.",
        "category": "night-cream",
        "concerns": ["anti-aging", "dullness", "uneven-texture"],
        "key_ingredients": "0.3% Encapsulated Retinol + Bakuchiol + Squalane",
        "ingredients_full": "Aqua, Squalane, Glycerin, Retinol, Bakuchiol, Tocopherol, Niacinamide, Ceramide NP, Phenoxyethanol",
        "benefits": ["Smooths fine lines overnight", "Refines uneven texture", "Boosts cell turnover", "Buffered for sensitive skin"],
        "how_to_use": "Apply pea-sized amount at night after cleansing. Use 2-3 nights/week to start.",
        "size": "30ml / 1.01 fl oz",
        "images": ["https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 1599, "prepaid_price": 899, "cod_price": 999, "cod_advance": 29,
        "discount_percent": 44, "badge": "Bestseller", "is_active": True, "sort_order": 18,
        "rating": 4.8, "reviews_count": 1432, "skin_type": "All Skin Types",
    },
    {
        "slug": "aha-bha-exfoliating-toner",
        "name": "Celesta Glow AHA + BHA Exfoliating Toner",
        "short_name": "AHA + BHA Toner",
        "tagline": "5% Glycolic · 2% Salicylic",
        "description": "A weekly resurfacing toner blending 5% Glycolic Acid and 2% Salicylic Acid. Gently sloughs dead cells, unclogs pores, and brightens dull skin.",
        "category": "exfoliators",
        "concerns": ["uneven-texture", "acne-blemishes", "dullness"],
        "key_ingredients": "5% Glycolic Acid + 2% Salicylic Acid + Aloe",
        "ingredients_full": "Aqua, Glycolic Acid, Salicylic Acid, Aloe Vera Leaf Juice, Glycerin, Sodium Hydroxide, Allantoin, Phenoxyethanol",
        "benefits": ["Smooths skin in 1 use", "Unclogs pores", "Reduces dullness", "Preps skin for serums"],
        "how_to_use": "Apply with cotton pad 2-3 nights/week after cleansing. Always wear SPF the next day.",
        "size": "100ml / 3.38 fl oz",
        "images": ["https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 999, "prepaid_price": 599, "cod_price": 699, "cod_advance": 29,
        "discount_percent": 40, "badge": "New Launch", "is_active": True, "sort_order": 19,
        "rating": 4.7, "reviews_count": 612, "skin_type": "Combination / Oily",
    },
    {
        "slug": "rose-clay-detox-mask",
        "name": "Celesta Glow Rose Clay Detox Mask",
        "short_name": "Rose Clay Mask",
        "tagline": "Kaolin · Rose Petal · Niacinamide",
        "description": "A weekly detox mask with French Rose Kaolin Clay and Niacinamide. Draws out impurities, refines pores, and leaves skin balanced and bright.",
        "category": "face-masks",
        "concerns": ["oily-skin", "dullness", "acne-blemishes"],
        "key_ingredients": "Pink Kaolin + Rose Petal + Niacinamide",
        "ingredients_full": "Aqua, Kaolin, Glycerin, Rosa Damascena Flower Powder, Niacinamide, Allantoin, Phenoxyethanol",
        "benefits": ["Detoxifies pores", "Brightens dull skin", "Soothes sensitivity", "Non-drying clay formula"],
        "how_to_use": "Apply thin layer to clean skin. Leave on 10 minutes. Rinse with lukewarm water.",
        "size": "100g / 3.5 oz",
        "images": ["https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 799, "prepaid_price": 449, "cod_price": 499, "cod_advance": 29,
        "discount_percent": 44, "badge": "", "is_active": True, "sort_order": 20,
        "rating": 4.6, "reviews_count": 384, "skin_type": "Oily / Combination",
    },
    {
        "slug": "ceramide-body-lotion",
        "name": "Celesta Glow Ceramide Repair Body Lotion",
        "short_name": "Ceramide Body Lotion",
        "tagline": "5x Ceramides · 48h Hydration",
        "description": "A barrier-repairing body lotion with 5x ceramides, urea, and shea butter. Soothes dry, rough patches and locks in moisture for 48 hours.",
        "category": "body-lotion",
        "concerns": ["dryness", "sensitive-skin"],
        "key_ingredients": "5x Ceramides + Urea + Shea Butter",
        "ingredients_full": "Aqua, Glycerin, Urea, Cetearyl Alcohol, Butyrospermum Parkii Butter, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Phenoxyethanol",
        "benefits": ["48-hour deep hydration", "Soothes dry & rough skin", "Strengthens skin barrier", "Fragrance-free"],
        "how_to_use": "Apply liberally to body daily after shower.",
        "size": "300ml / 10.14 fl oz",
        "images": ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 899, "prepaid_price": 549, "cod_price": 599, "cod_advance": 29,
        "discount_percent": 39, "badge": "Daily Essential", "is_active": True, "sort_order": 21,
        "rating": 4.7, "reviews_count": 521, "skin_type": "Dry / Sensitive",
    },
    {
        "slug": "rosewater-face-mist",
        "name": "Celesta Glow Pure Rosewater Hydrating Face Mist",
        "short_name": "Rosewater Face Mist",
        "tagline": "100% Pure · Steam-Distilled",
        "description": "A pure, steam-distilled rosewater face mist. Hydrates, soothes redness, and refreshes skin throughout the day.",
        "category": "face-mist",
        "concerns": ["dryness", "sensitive-skin"],
        "key_ingredients": "100% Pure Damask Rosewater",
        "ingredients_full": "Rosa Damascena Flower Water, Glycerin, Aloe Vera Leaf Juice, Phenoxyethanol",
        "benefits": ["Instantly hydrates", "Calms redness", "Refreshing & cooling", "Sets makeup"],
        "how_to_use": "Spritz onto clean skin or over makeup as needed.",
        "size": "120ml / 4.05 fl oz",
        "images": ["https://images.unsplash.com/photo-1626954079979-ec4f7b05e032?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 449, "prepaid_price": 249, "cod_price": 299, "cod_advance": 29,
        "discount_percent": 44, "badge": "", "is_active": True, "sort_order": 22,
        "rating": 4.6, "reviews_count": 287, "skin_type": "All Skin Types",
    },
    # ===== Cosmetics niche - 5 more samples =====
    {
        "slug": "kajal-smudge-proof-black",
        "name": "Celesta Glow Smudge-Proof Kajal — Intense Black",
        "short_name": "Smudge-Proof Kajal",
        "tagline": "16-hour wear · Vit-E enriched",
        "description": "An ultra-creamy kajal that glides on smooth and stays put for 16 hours. Enriched with Vitamin E and Almond Oil for nourishment.",
        "category": "kajal-eyeliner",
        "concerns": [],
        "key_ingredients": "Vitamin E + Sweet Almond Oil + Carbon Black",
        "ingredients_full": "Hydrogenated Polyisobutene, Cera Alba, Synthetic Wax, Carbon Black, Tocopherol, Prunus Amygdalus Dulcis Oil",
        "benefits": ["16-hour smudge-proof wear", "Glides on smoothly", "Conditions delicate eye area", "Ophthalmologist tested"],
        "how_to_use": "Apply along the upper or lower lash line. Smudge for a soft kohl look.",
        "size": "0.35g · twist-up",
        "images": ["https://images.unsplash.com/photo-1583241800698-9c2e3a7b8ba8?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 399, "prepaid_price": 229, "cod_price": 279, "cod_advance": 29,
        "discount_percent": 43, "badge": "Bestseller", "is_active": True, "sort_order": 23,
        "rating": 4.7, "reviews_count": 1042, "skin_type": "All Skin Types",
    },
    {
        "slug": "highlighter-stick-champagne",
        "name": "Celesta Glow Glow Highlighter Stick — Champagne",
        "short_name": "Glow Highlighter",
        "tagline": "Buildable · Skin-Like Glow",
        "description": "A creamy highlighter stick that gives a lit-from-within champagne glow. Buildable, blendable, and skincare-infused.",
        "category": "blush-highlighter",
        "concerns": [],
        "key_ingredients": "Squalane + Mica + Vitamin E",
        "ingredients_full": "Caprylic/Capric Triglyceride, Squalane, Mica, CI 77891, Tocopherol, Jojoba Esters",
        "benefits": ["Skin-like dewy glow", "Buildable shimmer", "Hydrating", "Lip + cheek + eyes"],
        "how_to_use": "Swipe onto cheekbones, brow bone, and cupid's bow. Blend with fingertips.",
        "size": "5.5g / 0.19 oz",
        "images": ["https://images.unsplash.com/photo-1631730359585-38a4935cbec4?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 649, "prepaid_price": 379, "cod_price": 429, "cod_advance": 29,
        "discount_percent": 42, "badge": "New Launch", "is_active": True, "sort_order": 24,
        "rating": 4.6, "reviews_count": 412, "skin_type": "All Skin Types",
    },
    {
        "slug": "matte-finish-foundation",
        "name": "Celesta Glow Skin Tint Matte Finish Foundation",
        "short_name": "Matte Finish Foundation",
        "tagline": "12h Wear · SPF 20 · Hyaluronic",
        "description": "A weightless matte foundation with SPF 20 and hyaluronic acid. Buildable medium coverage that lasts 12 hours without oxidizing.",
        "category": "face-makeup",
        "concerns": [],
        "key_ingredients": "Hyaluronic Acid + SPF 20 + Niacinamide",
        "ingredients_full": "Aqua, Cyclopentasiloxane, Titanium Dioxide, Glycerin, Niacinamide, Sodium Hyaluronate, Iron Oxides, Phenoxyethanol",
        "benefits": ["12-hour matte wear", "Doesn't oxidize", "Hydrating, never cakey", "Buildable medium coverage"],
        "how_to_use": "Dot onto face and blend with damp sponge or fingertips.",
        "size": "30ml / 1.01 fl oz",
        "images": ["https://images.unsplash.com/photo-1599733589046-8a0a8044f2cf?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 999, "prepaid_price": 599, "cod_price": 699, "cod_advance": 29,
        "discount_percent": 40, "badge": "", "is_active": True, "sort_order": 25,
        "rating": 4.5, "reviews_count": 367, "skin_type": "Combination / Oily",
    },
    {
        "slug": "concealer-creamy-coverage",
        "name": "Celesta Glow Creamy Coverage Concealer",
        "short_name": "Creamy Concealer",
        "tagline": "Crease-Proof · Vitamin C Brightening",
        "description": "A creamy, full-coverage concealer that doesn't crease. Brightens under-eyes, covers dark spots and acne marks. Infused with Vitamin C.",
        "category": "face-makeup",
        "concerns": [],
        "key_ingredients": "Vitamin C + Caffeine + Niacinamide",
        "ingredients_full": "Aqua, Caprylic/Capric Triglyceride, Glycerin, Ascorbyl Glucoside, Caffeine, Niacinamide, Iron Oxides, Phenoxyethanol",
        "benefits": ["Full coverage, weightless feel", "Brightens dark circles", "Crease-proof 10h wear", "Skincare-infused"],
        "how_to_use": "Dot under eyes or on blemishes. Tap to blend with fingertip or sponge.",
        "size": "6ml / 0.20 fl oz",
        "images": ["https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 599, "prepaid_price": 349, "cod_price": 399, "cod_advance": 29,
        "discount_percent": 42, "badge": "Daily Essential", "is_active": True, "sort_order": 26,
        "rating": 4.7, "reviews_count": 487, "skin_type": "All Skin Types",
    },
    {
        "slug": "lip-gloss-plumping-clear",
        "name": "Celesta Glow Plumping Lip Gloss — Crystal Clear",
        "short_name": "Plumping Lip Gloss",
        "tagline": "Hyaluronic Acid · Non-sticky",
        "description": "A non-sticky plumping lip gloss with Hyaluronic Acid and Peppermint Oil. Adds visible volume, shine, and hydration in one swipe.",
        "category": "lipstick",
        "concerns": ["dryness"],
        "key_ingredients": "Hyaluronic Acid + Peppermint Oil + Vitamin E",
        "ingredients_full": "Hydrogenated Polyisobutene, Sodium Hyaluronate, Tocopherol, Mentha Piperita Oil, Polybutene, Silica",
        "benefits": ["Visibly plumps lips", "Non-sticky finish", "Hydrating peptide blend", "Layer over lipstick or alone"],
        "how_to_use": "Apply directly to lips. Layer over lipstick for added shine.",
        "size": "5ml / 0.17 fl oz",
        "images": ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1000&q=80"],
        "mrp": 499, "prepaid_price": 299, "cod_price": 349, "cod_advance": 29,
        "discount_percent": 40, "badge": "New Launch", "is_active": True, "sort_order": 27,
        "rating": 4.6, "reviews_count": 234, "skin_type": "All Skin Types",
    },
]


# Niche assignment for ALL products (all under single skin-care niche)
PRODUCT_NICHES = {
    "anti-aging-serum":   "skin-care",
    "anti-aging-cream":   "skin-care",
    "under-eye-cream":    "skin-care",
    "sunscreen":          "skin-care",
    "cleanser":           "skin-care",
    "vitamin-c-glow-serum":    "skin-care",
    "acne-control-gel":        "skin-care",
    "hydra-boost-toner":       "skin-care",
    "niacinamide-pore-serum":  "skin-care",
    "daily-moisturizer":       "skin-care",
    "retinol-night-renewal":   "skin-care",
    "aha-bha-exfoliating-toner": "skin-care",
    "rose-clay-detox-mask":    "skin-care",
    "ceramide-body-lotion":    "skin-care",
    "rosewater-face-mist":     "skin-care",
    "lip-cheek-tint":         "skin-care",
    "tinted-lip-balm-spf":    "skin-care",
    "brow-definer-pencil":    "skin-care",
    "matte-velvet-lipstick":  "skin-care",
    "liquid-eyeliner-jet-black": "skin-care",
    "volumizing-mascara":     "skin-care",
    "blush-stick-rose":       "skin-care",
    "kajal-smudge-proof-black":  "skin-care",
    "highlighter-stick-champagne": "skin-care",
    "matte-finish-foundation":   "skin-care",
    "concealer-creamy-coverage": "skin-care",
    "lip-gloss-plumping-clear":  "skin-care",
}


# Niche metadata for the niche switcher
NICHES = [
    {
        "slug": "skin-care",
        "name": "Skin Care",
        "tagline": "Dermatologist Recommended",
        "icon": "✨",
        "accent_from": "#dcfce7",
        "accent_to": "#bbf7d0",
        "accent_text": "#14532d",
        "route": "/",
        "sort_order": 1,
    },
]


# Existing 5 products: append `concerns` array based on their formulation
EXISTING_PRODUCT_CONCERNS = {
    "anti-aging-serum":   ["anti-aging", "dullness", "pigmentation"],
    "anti-aging-cream":   ["anti-aging", "dryness"],
    "under-eye-cream":    ["dark-circles", "anti-aging"],
    "sunscreen":          ["anti-aging", "pigmentation", "sensitive-skin"],
    "cleanser":           ["acne-blemishes", "oily-skin", "dullness"],
}


async def seed_concerns_and_categories(db):
    """Seed concerns + categories collections (idempotent — upserts new items).

    Respects taxonomy tombstones: if the admin deleted a slug, this seed will
    NOT resurrect it on the next container boot. Otherwise the admin's deletes
    would be silently undone every redeploy.
    """
    from services.taxonomy_tombstones import get_tombstoned_slugs
    now = datetime.now(timezone.utc).isoformat()
    tombs_concerns = await get_tombstoned_slugs(db, "concern")
    tombs_categories = await get_tombstoned_slugs(db, "category")
    # Concerns — insert if missing AND not tombstoned
    for c in CONCERNS:
        if c["slug"] in tombs_concerns:
            continue
        existing = await db.concerns.find_one({"slug": c["slug"]})
        if not existing:
            doc = dict(c)
            doc["created_at"] = now
            doc["updated_at"] = now
            await db.concerns.insert_one(doc)

    # Categories — insert if missing AND not tombstoned
    for c in CATEGORIES:
        if c["slug"] in tombs_categories:
            continue
        existing = await db.categories.find_one({"slug": c["slug"]})
        if not existing:
            doc = dict(c)
            doc["created_at"] = now
            doc["updated_at"] = now
            await db.categories.insert_one(doc)


async def seed_extra_products(db):
    """Sample-product seeding disabled — catalog starts and stays empty."""
    logging.info("[concerns_seed] sample-product seeding skipped (empty catalog by configuration)")
    return


async def backfill_existing_product_concerns(db):
    """Add `concerns` array to existing 5 products if missing."""
    updated = 0
    for slug, concerns in EXISTING_PRODUCT_CONCERNS.items():
        result = await db.products.update_one(
            {"slug": slug, "$or": [{"concerns": {"$exists": False}}, {"concerns": []}]},
            {"$set": {"concerns": concerns, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count:
            updated += 1
    if updated:
        logging.info(f"[concerns_seed] Backfilled concerns on {updated} existing products")


async def backfill_product_niches(db):
    """Set `niche` field on every known product (idempotent — always sets to canonical value)."""
    updated = 0
    for slug, niche in PRODUCT_NICHES.items():
        result = await db.products.update_one(
            {"slug": slug},
            {"$set": {"niche": niche, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count:
            updated += 1
    if updated:
        logging.info(f"[concerns_seed] Backfilled niche on {updated} products")
    # Also backfix wrongly-categorised cosmetic products to new sub-cats
    cat_fixes = {
        "lip-cheek-tint": "lipstick",
        "tinted-lip-balm-spf": "lipstick",
        "brow-definer-pencil": "brow",
    }
    for slug, cat in cat_fixes.items():
        await db.products.update_one(
            {"slug": slug, "category": "cosmetics-makeup"},
            {"$set": {"category": cat}}
        )


async def seed_niches(db):
    """Seed niches collection (idempotent). Migrates old slugs to new ones."""
    now = datetime.now(timezone.utc).isoformat()
    # Migrate old "anti-aging" slug → "skin-care"
    await db.niches.update_one(
        {"slug": "anti-aging"},
        {"$set": {"slug": "skin-care", "name": "Skin Care", "tagline": "Dermatologist Recommended", "updated_at": now, "route": "/"}}
    )
    # Migrate any products with old niche slugs → "skin-care"
    for old_slug in ("anti-aging", "skincare", "cosmetics"):
        await db.products.update_many(
            {"niche": old_slug},
            {"$set": {"niche": "skin-care", "updated_at": now}}
        )
    # Remove old niches that are no longer used
    await db.niches.delete_many({"slug": {"$in": ["skincare", "cosmetics"]}})
    # Insert "skin-care" niche if it doesn't exist yet
    if not await db.niches.find_one({"slug": "skin-care"}):
        doc = dict(NICHES[0])
        doc["created_at"] = now
        doc["updated_at"] = now
        doc["is_active"] = True
        await db.niches.insert_one(doc)
        logging.info("[concerns_seed] Inserted skin-care niche")
    logging.info("[concerns_seed] Niches seeded/migrated")


async def deactivate_legacy_cosmetics_dupes(db):
    """Deactivate legacy generic cosmetics categories that overlap with newer
    specific sub-cats, and remap any products tagged on the old slug to the new
    specific slug. Idempotent — safe to run on every restart."""
    LEGACY_TO_NEW = {
        # legacy generic -> preferred specific
        "cosmetics-makeup": None,    # deactivate parent (too generic)
        "lipstick": "lipstick-gloss",
        "eye-makeup": "kajal-eyeliner",
        "face-makeup": "foundation-concealer",
    }
    deactivated = 0
    remapped = 0
    for legacy, new_slug in LEGACY_TO_NEW.items():
        # Mark legacy category inactive
        r = await db.categories.update_one(
            {"slug": legacy, "is_active": True},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if r.modified_count:
            deactivated += 1
        # Remap products if a replacement exists
        if new_slug:
            r2 = await db.products.update_many(
                {"category": legacy},
                {"$set": {"category": new_slug, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            if r2.modified_count:
                remapped += r2.modified_count
    if deactivated or remapped:
        logging.info(f"[concerns_seed] Deactivated {deactivated} legacy cosmetics cats, remapped {remapped} products")


async def run_concerns_seed(db):
    """Run all concerns/categories/products seed (idempotent).

    NOTE (Jan 2026): concerns + categories are now authoritatively managed by
    `taxonomy_v2.py`. We skip the legacy `seed_concerns_and_categories` step
    once taxonomy_v2 has been applied (sentinel: settings.taxonomy_v2_applied).
    """
    try:
        settings = await db.site_settings.find_one({"_id": "main"}, {"_id": 0, "taxonomy_v2_applied": 1})
        v2_applied = bool(settings and settings.get("taxonomy_v2_applied"))
        if not v2_applied:
            await seed_concerns_and_categories(db)
        await seed_extra_products(db)
        await backfill_existing_product_concerns(db)
        await backfill_product_niches(db)
        await seed_niches(db)
        if not v2_applied:
            await deactivate_legacy_cosmetics_dupes(db)
        # Re-activate any legacy taxonomy_v2 categories that may have been
        # incorrectly deactivated by an earlier startup.
        if v2_applied:
            await db.categories.update_many(
                {"niche": {"$in": ["skincare", "cosmetics"]}, "is_active": False},
                {"$set": {"is_active": True}},
            )
        logging.info("[concerns_seed] All concerns/categories/products seed completed")
    except Exception as e:
        logging.error(f"[concerns_seed] Failed: {e}", exc_info=True)
