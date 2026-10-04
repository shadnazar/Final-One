"""
Image Service - Fetch relevant stock images for blog posts
Uses category-based image mapping to ensure relevant images
"""
import secrets
from typing import Optional

# Category-specific Unsplash/Pexels image URLs (high-quality, free to use)
CATEGORY_IMAGES = {
    "celebrity": [
        "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503236823255-94609f598e71?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80",
    ],
    "tips": [
        "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80",
    ],
    "diy": [
        "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498579809087-ef1e558fd1da?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506377295352-e3154d43ea9e?w=800&auto=format&fit=crop&q=80",
    ],
    "science": [
        "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80",
    ],
    "ingredients": [
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1598662972299-5408ddb8a3dc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800&auto=format&fit=crop&q=80",
    ],
    "seasonal": [
        "https://images.unsplash.com/photo-1505944357431-27579db47222?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503236823255-94609f598e71?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop&q=80",
    ],
    "mistakes": [
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1573461160327-b450ce3d8e7f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&auto=format&fit=crop&q=80",
    ],
    "trends": [
        "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?w=800&auto=format&fit=crop&q=80",
    ],
    "news": [
        "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526045478516-99145907023c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1554519515-242161756769?w=800&auto=format&fit=crop&q=80",
    ],
    "age-specific": [
        "https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508243771214-6e95d137426b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565843708714-52ecf69ab81f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&auto=format&fit=crop&q=80",
    ],
    "regional": [
        "https://images.unsplash.com/photo-1590244453571-486164929eee?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1524500659273-b0dcb2ff4100?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228994-fae8a137f9f8?w=800&auto=format&fit=crop&q=80",
    ],
    "comparison": [
        "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1598662972299-5408ddb8a3dc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=800&auto=format&fit=crop&q=80",
    ],
    "default": [
        "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1629940446512-e0f1edd3f8e2?w=800&auto=format&fit=crop&q=80",
        "https://images.pexels.com/photos/7321494/pexels-photo-7321494.jpeg?auto=compress&cs=tinysrgb&w=800",
        "https://images.pexels.com/photos/3762881/pexels-photo-3762881.jpeg?auto=compress&cs=tinysrgb&w=800",
        "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80",
    ]
}


def get_image_for_category(category: str, used_images: Optional[list] = None) -> str:
    """
    Get a relevant image URL based on blog category.
    Avoids returning recently used images.
    """
    used_images = used_images or []
    
    # Normalize category
    category = category.lower().strip() if category else "default"
    
    # Get images for category
    images = CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["default"])
    
    # Filter out recently used images
    available_images = [img for img in images if img not in used_images]
    
    # If all images used, reset
    if not available_images:
        available_images = images
    
    return secrets.choice(available_images)


def get_image_for_keywords(keywords: list, title: str = "") -> str:
    """
    Get image based on keywords and title analysis.
    Maps common keywords to appropriate categories.
    """
    keyword_mapping = {
        "celebrity": ["bollywood", "celebrity", "star", "actress", "actor", "film"],
        "diy": ["diy", "homemade", "home remedy", "natural", "turmeric", "honey", "aloe"],
        "science": ["science", "research", "study", "clinical", "dermatologist", "collagen"],
        "ingredients": ["ingredient", "retinol", "vitamin", "hyaluronic", "niacinamide", "serum"],
        "seasonal": ["winter", "summer", "monsoon", "spring", "season", "weather", "climate"],
        "mistakes": ["mistake", "avoid", "wrong", "don't", "never", "blunder", "error"],
        "trends": ["trend", "2024", "2025", "2026", "new", "latest", "popular"],
        "tips": ["tip", "trick", "secret", "how to", "guide", "routine"],
    }
    
    # Combine keywords and title words
    all_words = " ".join(keywords).lower() + " " + title.lower()
    
    # Find matching category
    for category, trigger_words in keyword_mapping.items():
        for word in trigger_words:
            if word in all_words:
                return get_image_for_category(category)
    
    return get_image_for_category("default")
