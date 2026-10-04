#!/usr/bin/env python3
"""
Backend API Test Suite for Celesta Glow
Tests site settings round-trip (no LLM credits used)
"""

import requests
import json
import sys

# Base URL from frontend/.env
BASE_URL = "https://celesta-staging.preview.emergentagent.com/api"
ADMIN_TOKEN = "celestaglow2024"

def test_site_settings_round_trip():
    """
    Test: Site settings round-trip for storefront controls.
    1. PUT /api/admin/site-settings with other_brands_in_stock=true and product_image_reference_url
    2. GET /api/site-settings to verify both fields persisted
    3. PUT again with other_brands_in_stock=false and product_image_reference_url=""
    4. GET again to confirm both updated
    """
    print("\n" + "="*80)
    print("TEST: Site Settings Round-Trip")
    print("="*80)
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    # Step 1: PUT with other_brands_in_stock=true and product_image_reference_url set
    print("\n[STEP 1] PUT /api/admin/site-settings (setting values)")
    payload_1 = {
        "other_brands_in_stock": True,
        "product_image_reference_url": "https://res.cloudinary.com/dcvuqcqjn/image/upload/celesta-glow/brand/brand-bottle-cream.jpg"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/admin/site-settings",
            headers=headers,
            json=payload_1,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get("success"):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        print("✅ PUT request successful")
    except Exception as e:
        print(f"❌ FAILED: Exception during PUT: {e}")
        return False
    
    # Step 2: GET to verify values persisted
    print("\n[STEP 2] GET /api/site-settings (verify values)")
    try:
        response = requests.get(f"{BASE_URL}/site-settings", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response Body:\n{json.dumps(data, indent=2)}")
        
        # Verify both fields
        other_brands = data.get("other_brands_in_stock")
        ref_url = data.get("product_image_reference_url")
        
        if other_brands != True:
            print(f"❌ FAILED: Expected other_brands_in_stock=true, got {other_brands}")
            return False
        
        expected_url = "https://res.cloudinary.com/dcvuqcqjn/image/upload/celesta-glow/brand/brand-bottle-cream.jpg"
        if ref_url != expected_url:
            print(f"❌ FAILED: Expected product_image_reference_url={expected_url}, got {ref_url}")
            return False
        
        print("✅ GET verified: other_brands_in_stock=true, product_image_reference_url set correctly")
    except Exception as e:
        print(f"❌ FAILED: Exception during GET: {e}")
        return False
    
    # Step 3: PUT with other_brands_in_stock=false and product_image_reference_url=""
    print("\n[STEP 3] PUT /api/admin/site-settings (clearing values)")
    payload_2 = {
        "other_brands_in_stock": False,
        "product_image_reference_url": ""
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/admin/site-settings",
            headers=headers,
            json=payload_2,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if not data.get("success"):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        print("✅ PUT request successful")
    except Exception as e:
        print(f"❌ FAILED: Exception during PUT: {e}")
        return False
    
    # Step 4: GET again to verify updated values
    print("\n[STEP 4] GET /api/site-settings (verify updated values)")
    try:
        response = requests.get(f"{BASE_URL}/site-settings", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response Body:\n{json.dumps(data, indent=2)}")
        
        # Verify both fields updated
        other_brands = data.get("other_brands_in_stock")
        ref_url = data.get("product_image_reference_url")
        
        if other_brands != False:
            print(f"❌ FAILED: Expected other_brands_in_stock=false, got {other_brands}")
            return False
        
        if ref_url != "":
            print(f"❌ FAILED: Expected product_image_reference_url='', got {ref_url}")
            return False
        
        print("✅ GET verified: other_brands_in_stock=false, product_image_reference_url=''")
    except Exception as e:
        print(f"❌ FAILED: Exception during GET: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST PASSED: Site settings round-trip successful")
    print("="*80)
    return True


if __name__ == "__main__":
    print("\n🧪 Celesta Glow Backend Test Suite")
    print("Testing: Site Settings Round-Trip (No LLM Credits)")
    
    success = test_site_settings_round_trip()
    
    if success:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ TESTS FAILED")
        sys.exit(1)
