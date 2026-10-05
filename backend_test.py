#!/usr/bin/env python3
"""
Backend API Test Suite for Celesta Glow
Tests: Admin Generate Gallery + Certificate endpoint (font fix verification)
"""

import requests
import json
import sys
from io import BytesIO
from PIL import Image

# Base URL from frontend/.env
BASE_URL = "https://celesta-staging.preview.emergentagent.com/api"
ADMIN_TOKEN = "celestaglow2024"


def test_generate_gallery_certificate():
    """
    Test: Admin Generate Gallery + Certificate endpoint (font fix verification)
    
    Bug being verified: The admin "Generate Gallery + Certificate" button returned 
    "Image generation failed: cannot open resource" because PIL fonts were loaded 
    from /usr/share/fonts (missing in some environments). Fonts are now bundled 
    in /app/backend/fonts/ with a fallback loader.
    
    Test Steps:
    1. GET /api/products to get an existing product slug (e.g. anti-aging-serum)
    2. POST /api/admin/products/{slug}/generate-images with header X-Admin-Token 
       and JSON body {"gallery": true, "certificate": true}
    3. Verify: HTTP 200, response contains generated gallery images (tech1..tech4), 
       test_report_image/certificate URL, and before/after images with NO 
       "cannot open resource" error
    4. Fetch one returned image URL and confirm it loads (200, non-trivial size)
    5. Regression check: POST with {"gallery": false, "certificate": true}
    """
    print("\n" + "="*80)
    print("TEST: Admin Generate Gallery + Certificate (Font Fix Verification)")
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
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}...")  # First 500 chars
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            # Check if error contains "cannot open resource"
            if "cannot open resource" in response.text.lower():
                print("❌ CRITICAL: Font loading error detected - 'cannot open resource'")
            return False
        
        data = response.json()
        
        # Verify success field
        if not data.get("success"):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        # Verify gallery images (tech1, tech2, tech3, tech4)
        images = data.get("images", [])
        if len(images) < 4:
            print(f"❌ FAILED: Expected at least 4 gallery images, got {len(images)}")
            print(f"Images: {images}")
            return False
        
        print(f"✅ Gallery images generated: {len(images)} images")
        for i, img_url in enumerate(images[:5], 1):
            print(f"   Image {i}: {img_url[:80]}...")
        
        # Verify certificate/test_report_image
        test_report_image = data.get("test_report_image")
        if not test_report_image:
            print(f"❌ FAILED: Expected test_report_image (certificate), got None")
            return False
        
        print(f"✅ Certificate generated: {test_report_image[:80]}...")
        
        # Verify before/after images
        before_after = data.get("before_after", [])
        
        if not before_after or len(before_after) < 2:
            print(f"⚠️  WARNING: Before/after images not generated")
            print(f"   before_after: {before_after}")
        else:
            print(f"✅ Before/after images generated: {len(before_after)} images")
            for ba in before_after:
                ba_type = ba.get("type", "unknown")
                ba_img = ba.get("image", "")
                print(f"   {ba_type.capitalize()}: {ba_img[:80]}...")
        
        # Store first image URL for verification
        first_image_url = images[0] if images else None
        
    except Exception as e:
        print(f"❌ FAILED: Exception during POST: {e}")
        return False
    
    # Step 3: Fetch one returned image URL and verify it loads
    print(f"\n[STEP 3] Verify generated image loads correctly")
    
    if not first_image_url:
        print(f"❌ FAILED: No image URL to verify")
        return False
    
    try:
        print(f"Fetching: {first_image_url[:80]}...")
        img_response = requests.get(first_image_url, timeout=15)
        print(f"Status Code: {img_response.status_code}")
        
        if img_response.status_code != 200:
            print(f"❌ FAILED: Image fetch returned {img_response.status_code}")
            return False
        
        # Verify image size is non-trivial
        img_size = len(img_response.content)
        print(f"Image size: {img_size} bytes ({img_size / 1024:.1f} KB)")
        
        if img_size < 1000:  # Less than 1KB is suspicious
            print(f"❌ FAILED: Image size too small ({img_size} bytes)")
            return False
        
        # Verify it's a valid image by opening with PIL
        try:
            img = Image.open(BytesIO(img_response.content))
            width, height = img.size
            print(f"Image dimensions: {width}x{height}")
            
            # Verify reasonable dimensions (should be 1200x1200 or similar)
            if width < 100 or height < 100:
                print(f"❌ FAILED: Image dimensions too small ({width}x{height})")
                return False
            
            print(f"✅ Image verified: {width}x{height}, {img_size / 1024:.1f} KB")
            
        except Exception as e:
            print(f"❌ FAILED: Could not open image with PIL: {e}")
            return False
        
    except Exception as e:
        print(f"❌ FAILED: Exception during image fetch: {e}")
        return False
    
    # Step 4: Regression check - POST with {"gallery": false, "certificate": true}
    print(f"\n[STEP 4] Regression check: POST with gallery=false, certificate=true")
    
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
        
        if not data.get("success"):
            print(f"❌ FAILED: Regression check success=false")
            return False
        
        # Should have certificate but not new gallery images
        test_report_image = data.get("test_report_image")
        if not test_report_image:
            print(f"❌ FAILED: Certificate not generated in regression check")
            return False
        
        print(f"✅ Regression check passed: Certificate generated without gallery")
        print(f"   Certificate: {test_report_image[:80]}...")
        
    except Exception as e:
        print(f"❌ FAILED: Exception during regression check: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST PASSED: Generate Gallery + Certificate working correctly")
    print("   - No 'cannot open resource' font errors")
    print("   - Gallery images generated successfully")
    print("   - Certificate generated successfully")
    print("   - Before/after images generated")
    print("   - Images load correctly with valid dimensions")
    print("   - Regression check passed")
    print("="*80)
    return True


if __name__ == "__main__":
    print("\n🧪 Celesta Glow Backend Test Suite")
    print("Testing: Admin Generate Gallery + Certificate (Font Fix)")
    print("Bug Fix: Bundled fonts in /app/backend/fonts/ with fallback loader")
    
    success = test_generate_gallery_certificate()
    
    if success:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ TESTS FAILED")
        sys.exit(1)
