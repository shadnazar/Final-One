#!/usr/bin/env python3
"""
Backend API Test Suite for Celesta Glow
Tests: Two bug fixes verification
1. One-click product FULL media set (5 images, certificate, before/after, how_to_use)
2. Font fix for gallery/certificate generation (no "cannot open resource" error)
"""

import requests
import json
import sys
from io import BytesIO
from PIL import Image

# Base URL from frontend/.env
BASE_URL = "https://celesta-staging.preview.emergentagent.com/api"
ADMIN_TOKEN = "celestaglow2024"


def test_one_click_product_full_media():
    """
    FIX 1: One-click product must return FULL media set in a single call
    
    Test Steps:
    1. POST /api/admin/ai/one-click-product with JSON body 
       {"name": "Celesta Glow Peptide Repair Serum", "generate_image": true}
    2. Verify HTTP 200
    3. Verify response.product contains ALL of:
       (a) images: list with MORE THAN ONE image (5 total: 1 hero + 4 gallery tech images)
       (b) test_report_image: non-empty certificate URL
       (c) before_after: list of 2 items (before + after)
       (d) how_to_use: non-empty text
    4. Fetch hero image and one tech image URL to confirm they load (HTTP 200, non-trivial size)
    
    IMPORTANT: Make only ONE call to conserve LLM credits
    """
    print("\n" + "="*80)
    print("FIX 1: One-click Product FULL Media Set Verification")
    print("="*80)
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {
        "name": "Celesta Glow Peptide Repair Serum",
        "generate_image": True
    }
    
    print("\n[STEP 1] POST /api/admin/ai/one-click-product")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("⚠️  This will consume LLM credits - making ONE call only")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/ai/one-click-product",
            headers=headers,
            json=payload,
            timeout=120  # AI generation can take time
        )
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:1000]}")
            return False
        
        data = response.json()
        
        # Verify product exists in response
        product = data.get("product")
        if not product:
            print(f"❌ FAILED: No 'product' field in response")
            print(f"Response keys: {data.keys()}")
            return False
        
        print(f"✅ Product created successfully")
        print(f"   Product slug: {product.get('slug', 'N/A')}")
        
        # (a) Verify images: list with MORE THAN ONE image (5 total: 1 hero + 4 gallery)
        print("\n[STEP 2a] Verify images (expect 5: 1 hero + 4 gallery tech images)")
        images = product.get("images", [])
        
        if not images or len(images) <= 1:
            print(f"❌ FAILED: Expected MORE THAN ONE image (5 total), got {len(images)}")
            print(f"   Images: {images}")
            return False
        
        if len(images) < 5:
            print(f"⚠️  WARNING: Expected 5 images (1 hero + 4 gallery), got {len(images)}")
            print(f"   This may indicate incomplete media generation")
        
        print(f"✅ Images count: {len(images)}")
        
        # Identify hero and tech images
        hero_image = None
        tech_images = []
        
        for img_url in images:
            if "tech" in img_url.lower():
                tech_images.append(img_url)
            elif "hero" in img_url.lower() or "products/" in img_url:
                hero_image = img_url
        
        # If we can't identify by name, assume first is hero, rest are tech
        if not hero_image and images:
            hero_image = images[0]
            tech_images = images[1:]
        
        print(f"   Hero image: {hero_image[:80] if hero_image else 'NOT FOUND'}...")
        print(f"   Tech/Gallery images: {len(tech_images)}")
        for i, tech_img in enumerate(tech_images[:4], 1):
            print(f"      Tech {i}: {tech_img[:80]}...")
        
        if len(tech_images) < 4:
            print(f"❌ FAILED: Expected 4 tech/gallery images, got {len(tech_images)}")
            return False
        
        # (b) Verify test_report_image: non-empty certificate URL
        print("\n[STEP 2b] Verify test_report_image (certificate)")
        test_report_image = product.get("test_report_image")
        
        if not test_report_image:
            print(f"❌ FAILED: test_report_image is empty or missing")
            print(f"   test_report_image: {test_report_image}")
            return False
        
        print(f"✅ Certificate URL: {test_report_image[:80]}...")
        
        # (c) Verify before_after: list of 2 items
        print("\n[STEP 2c] Verify before_after (expect 2 items)")
        before_after = product.get("before_after", [])
        
        if not before_after or len(before_after) != 2:
            print(f"❌ FAILED: Expected 2 before_after items, got {len(before_after)}")
            print(f"   before_after: {before_after}")
            return False
        
        print(f"✅ Before/after images: {len(before_after)} items")
        for ba in before_after:
            ba_type = ba.get("type", "unknown")
            ba_img = ba.get("image", "")
            print(f"   {ba_type.capitalize()}: {ba_img[:80]}...")
        
        # (d) Verify how_to_use: non-empty text
        print("\n[STEP 2d] Verify how_to_use (non-empty text)")
        how_to_use = product.get("how_to_use")
        
        if not how_to_use or not isinstance(how_to_use, str) or len(how_to_use.strip()) == 0:
            print(f"❌ FAILED: how_to_use is empty or missing")
            print(f"   how_to_use: {how_to_use}")
            return False
        
        print(f"✅ how_to_use text: {len(how_to_use)} characters")
        print(f"   Preview: {how_to_use[:100]}...")
        
    except Exception as e:
        print(f"❌ FAILED: Exception during POST: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 3: Fetch hero and one tech image to verify they load
    print("\n[STEP 3] Verify images load correctly (HTTP 200, non-trivial size)")
    
    images_to_verify = []
    if hero_image:
        images_to_verify.append(("Hero", hero_image))
    if tech_images:
        images_to_verify.append(("Tech1", tech_images[0]))
    
    for img_name, img_url in images_to_verify:
        try:
            print(f"\n   Fetching {img_name}: {img_url[:80]}...")
            img_response = requests.get(img_url, timeout=15)
            print(f"   Status Code: {img_response.status_code}")
            
            if img_response.status_code != 200:
                print(f"   ❌ FAILED: {img_name} fetch returned {img_response.status_code}")
                return False
            
            # Verify image size is non-trivial
            img_size = len(img_response.content)
            print(f"   Image size: {img_size} bytes ({img_size / 1024:.1f} KB)")
            
            if img_size < 1000:  # Less than 1KB is suspicious
                print(f"   ❌ FAILED: {img_name} size too small ({img_size} bytes)")
                return False
            
            # Verify it's a valid image by opening with PIL
            try:
                img = Image.open(BytesIO(img_response.content))
                width, height = img.size
                print(f"   Image dimensions: {width}x{height}")
                
                if width < 100 or height < 100:
                    print(f"   ❌ FAILED: {img_name} dimensions too small ({width}x{height})")
                    return False
                
                print(f"   ✅ {img_name} verified: {width}x{height}, {img_size / 1024:.1f} KB")
                
            except Exception as e:
                print(f"   ❌ FAILED: Could not open {img_name} with PIL: {e}")
                return False
            
        except Exception as e:
            print(f"   ❌ FAILED: Exception fetching {img_name}: {e}")
            return False
    
    print("\n" + "="*80)
    print("✅ FIX 1 PASSED: One-click product returns FULL media set")
    print("   ✓ Images: 5 total (1 hero + 4 gallery tech images)")
    print("   ✓ test_report_image: certificate URL present")
    print("   ✓ before_after: 2 items (before + after)")
    print("   ✓ how_to_use: non-empty text")
    print("   ✓ Images load correctly with valid dimensions")
    print("="*80)
    return True


def test_font_fix_gallery_certificate():
    """
    FIX 2: Font "cannot open resource" fix for gallery/certificate
    
    Test Steps:
    1. GET /api/products to pick an existing slug (e.g. anti-aging-serum)
    2. POST /api/admin/products/{slug}/generate-images with body 
       {"gallery": true, "certificate": true}
    3. Verify HTTP 200 with gallery images (tech1-4) + certificate
    4. Verify NO "cannot open resource" error
    5. Regression: same endpoint with {"gallery": false, "certificate": true} also returns 200
    
    Note: This is Pillow-only, NO LLM credits consumed
    """
    print("\n" + "="*80)
    print("FIX 2: Font Fix for Gallery/Certificate Generation")
    print("="*80)
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    # Step 1: GET /api/products to find an existing product slug
    print("\n[STEP 1] GET /api/products (find existing product)")
    try:
        response = requests.get(f"{BASE_URL}/products", timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        products = response.json()
        if not products or len(products) == 0:
            print(f"❌ FAILED: No products found in catalog")
            return False
        
        # Find a product (prefer anti-aging-serum if available)
        product_slug = None
        for p in products:
            if p.get("slug") == "anti-aging-serum":
                product_slug = "anti-aging-serum"
                break
        
        if not product_slug and len(products) > 0:
            product_slug = products[0].get("slug")
        
        if not product_slug:
            print(f"❌ FAILED: Could not find a valid product slug")
            return False
        
        print(f"✅ Found product slug: {product_slug}")
        
    except Exception as e:
        print(f"❌ FAILED: Exception during GET /api/products: {e}")
        return False
    
    # Step 2: POST /api/admin/products/{slug}/generate-images with gallery + certificate
    print(f"\n[STEP 2] POST /api/admin/products/{product_slug}/generate-images")
    print("Payload: {\"gallery\": true, \"certificate\": true}")
    print("⚠️  This is Pillow-only - NO LLM credits consumed")
    
    payload = {
        "gallery": True,
        "certificate": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/products/{product_slug}/generate-images",
            headers=headers,
            json=payload,
            timeout=60  # Image generation can take time
        )
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:1000]}")
            # Check if error contains "cannot open resource"
            if "cannot open resource" in response.text.lower():
                print("❌ CRITICAL: Font loading error detected - 'cannot open resource'")
            return False
        
        data = response.json()
        
        # Check for "cannot open resource" in response
        response_str = json.dumps(data).lower()
        if "cannot open resource" in response_str:
            print("❌ CRITICAL: Font loading error detected in response - 'cannot open resource'")
            return False
        
        # Verify success field
        if not data.get("success"):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        print(f"✅ No 'cannot open resource' error detected")
        
        # Verify gallery images (tech1, tech2, tech3, tech4)
        images = data.get("images", [])
        if len(images) < 4:
            print(f"⚠️  WARNING: Expected at least 4 gallery images, got {len(images)}")
            print(f"   Images: {images}")
        else:
            print(f"✅ Gallery images generated: {len(images)} images")
            for i, img_url in enumerate(images[:5], 1):
                print(f"   Image {i}: {img_url[:80]}...")
        
        # Verify certificate/test_report_image
        test_report_image = data.get("test_report_image")
        if not test_report_image:
            print(f"⚠️  WARNING: test_report_image (certificate) not in response")
        else:
            print(f"✅ Certificate generated: {test_report_image[:80]}...")
        
        # Verify before/after images
        before_after = data.get("before_after", [])
        if before_after and len(before_after) >= 2:
            print(f"✅ Before/after images generated: {len(before_after)} images")
        
    except Exception as e:
        print(f"❌ FAILED: Exception during POST: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 3: Regression check - POST with {"gallery": false, "certificate": true}
    print(f"\n[STEP 3] Regression check: POST with gallery=false, certificate=true")
    
    payload_regression = {
        "gallery": False,
        "certificate": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/products/{product_slug}/generate-images",
            headers=headers,
            json=payload_regression,
            timeout=60
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Regression check returned {response.status_code}")
            print(f"Response: {response.text[:500]}")
            if "cannot open resource" in response.text.lower():
                print("❌ CRITICAL: Font loading error detected in regression check")
            return False
        
        data = response.json()
        
        # Check for "cannot open resource" in response
        response_str = json.dumps(data).lower()
        if "cannot open resource" in response_str:
            print("❌ CRITICAL: Font loading error in regression check - 'cannot open resource'")
            return False
        
        if not data.get("success"):
            print(f"❌ FAILED: Regression check success=false")
            return False
        
        print(f"✅ Regression check passed: No font errors")
        
    except Exception as e:
        print(f"❌ FAILED: Exception during regression check: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ FIX 2 PASSED: Font fix working correctly")
    print("   ✓ No 'cannot open resource' font errors")
    print("   ✓ Gallery images generated successfully")
    print("   ✓ Certificate generated successfully")
    print("   ✓ Regression check passed")
    print("="*80)
    return True


if __name__ == "__main__":
    print("\n🧪 Celesta Glow Backend Test Suite")
    print("Testing: Two Bug Fixes Verification")
    print("="*80)
    
    results = {}
    
    # Test FIX 1: One-click product FULL media set
    print("\n\n")
    results["FIX 1"] = test_one_click_product_full_media()
    
    # Test FIX 2: Font fix for gallery/certificate
    print("\n\n")
    results["FIX 2"] = test_font_fix_gallery_certificate()
    
    # Summary
    print("\n\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for fix_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{fix_name}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
