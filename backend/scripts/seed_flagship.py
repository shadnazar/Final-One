"""Seed the 5 flagship Celesta Glow products using the one-click AI generator
(for AI copy + niche/concern auto-connect) then correct price/size/images."""
import requests, sys

BASE = "http://localhost:8001/api"
H = {"X-Admin-Token": "celestaglow2024", "Content-Type": "application/json"}

PRODUCTS = [
    {"name": "Advanced Face Serum", "mrp": 1499, "offer": 899, "size": "30ml / 1.01 fl oz",
     "key_ingredients": "Retinol, Vitamin C, Niacinamide, Hyaluronic Acid",
     "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_600/v1780327224/celesta-glow/products/201e80b87d604c84ad25548b6a4783c6.webp"},
    {"name": "Advanced Retinol Night Cream", "mrp": 1499, "offer": 999, "size": "50g / 1.76 oz",
     "key_ingredients": "Retinol, Peptides, Shea Butter, Ceramides",
     "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_600/v1790225020/celesta-glow/products/1a2b9e09601541cfa94430cac3cb657d.jpg"},
    {"name": "Under Eye Cream", "mrp": 899, "offer": 549, "size": "15g / 0.52 oz",
     "key_ingredients": "Caffeine, Vitamin K, Peptides, Hyaluronic Acid",
     "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_1200/v1780326942/celesta-glow/products/2176944437ca41a285f6be32764302e8.jpg"},
    {"name": "Gentle Cleanser", "mrp": 799, "offer": 499, "size": "100ml / 3.38 fl oz",
     "key_ingredients": "Glycerin, Aloe Vera, Green Tea, Panthenol",
     "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_1200/v1780326845/celesta-glow/products/9cbffd4042f04e7d816d1825192c0ab4.webp"},
    {"name": "SPF 50 Sunscreen", "mrp": 799, "offer": 449, "size": "50g / 1.76 oz",
     "key_ingredients": "Zinc Oxide, Niacinamide, Vitamin E, Hyaluronic Acid",
     "image": "https://res.cloudinary.com/dtj1zuhkl/image/upload/f_auto,q_auto,w_1200/v1780327417/celesta-glow/products/e199648f7c6f4fe2b91f7a408211758e.jpg"},
]

for p in PRODUCTS:
    body = {"name": p["name"], "brand": "Celesta Glow", "key_ingredients": p["key_ingredients"],
            "image_url": p["image"], "generate_image": False}
    r = requests.post(f"{BASE}/admin/ai/one-click-product", json=body, headers=H, timeout=120)
    if r.status_code != 200:
        print(f"FAIL create {p['name']}: {r.status_code} {r.text[:200]}"); continue
    d = r.json(); slug = d["slug"]; cls = d.get("product", {})
    # Correct price/size to the real values
    disc = round((1 - p["offer"]/p["mrp"]) * 100)
    upd = {"mrp": p["mrp"], "prepaid_price": p["offer"], "cod_price": p["offer"],
           "offer_price": p["offer"], "discount_percent": disc, "size": p["size"]}
    ru = requests.put(f"{BASE}/admin/products/{slug}", json=upd, headers=H, timeout=60)
    print(f"OK  {p['name']:32s} slug={slug:36s} niche={cls.get('niche')} cat={cls.get('category')} concerns={cls.get('concerns')} price_upd={ru.status_code}")

print("DONE")
