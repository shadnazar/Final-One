"""
Backend API Testing for Celesta Glow E-commerce
Tests all high-priority backend flows as per test_result.md
"""
import requests
import json
import sys
from datetime import datetime

# Read backend URL from frontend/.env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip()
                    return f"{url}/api"
    except Exception as e:
        print(f"❌ Error reading backend URL: {e}")
        sys.exit(1)
    return None

BASE_URL = get_backend_url()
print(f"🔗 Testing backend at: {BASE_URL}\n")

# Test results tracking
test_results = {
    "passed": [],
    "failed": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    if passed:
        test_results["passed"].append(name)
        print(f"✅ {name}")
        if details:
            print(f"   {details}")
    else:
        test_results["failed"].append(name)
        print(f"❌ {name}")
        if details:
            print(f"   {details}")
    print()

def test_products_list():
    """Test GET /api/products - should return 5 products"""
    try:
        response = requests.get(f"{BASE_URL}/products", timeout=10)
        
        if response.status_code != 200:
            log_test("Products List API", False, f"Status: {response.status_code}")
            return None
        
        data = response.json()
        
        # Handle both array and paginated response
        if isinstance(data, list):
            products = data
        elif isinstance(data, dict) and 'items' in data:
            products = data['items']
        else:
            log_test("Products List API", False, "Unexpected response format")
            return None
        
        if len(products) >= 5:
            log_test("Products List API", True, f"Found {len(products)} products")
            return products
        else:
            log_test("Products List API", False, f"Expected at least 5 products, got {len(products)}")
            return None
            
    except Exception as e:
        log_test("Products List API", False, f"Exception: {str(e)}")
        return None

def test_product_detail(slug):
    """Test GET /api/products/{slug} - get product detail"""
    try:
        response = requests.get(f"{BASE_URL}/products/{slug}", timeout=10)
        
        if response.status_code != 200:
            log_test(f"Product Detail API ({slug})", False, f"Status: {response.status_code}")
            return None
        
        product = response.json()
        
        if product.get('slug') == slug:
            log_test(f"Product Detail API ({slug})", True, f"Name: {product.get('name', 'N/A')}")
            return product
        else:
            log_test(f"Product Detail API ({slug})", False, "Slug mismatch in response")
            return None
            
    except Exception as e:
        log_test(f"Product Detail API ({slug})", False, f"Exception: {str(e)}")
        return None

def test_razorpay_order_creation():
    """Test POST /api/create-razorpay-order - LIVE keys, only create order"""
    try:
        payload = {
            "amount": 599.0
        }
        
        response = requests.post(
            f"{BASE_URL}/create-razorpay-order",
            json=payload,
            timeout=15
        )
        
        if response.status_code != 200:
            log_test("Razorpay Order Creation", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return None
        
        data = response.json()
        
        # Verify Razorpay order structure
        if data.get('id') and data.get('amount'):
            log_test("Razorpay Order Creation", True, 
                    f"Order ID: {data.get('id')}, Amount: {data.get('amount')} paise")
            return data
        else:
            log_test("Razorpay Order Creation", False, f"Invalid order structure: {data}")
            return None
            
    except Exception as e:
        log_test("Razorpay Order Creation", False, f"Exception: {str(e)}")
        return None

def test_cod_order_creation():
    """Test POST /api/orders - COD order with valid Indian pincode"""
    try:
        # First, validate the cart to get the correct total with shipping/taxes
        cart_payload = {
            "items": [
                {
                    "product_slug": "anti-aging-serum",
                    "quantity": 1
                }
            ],
            "payment_method": "COD"
        }
        
        cart_response = requests.post(f"{BASE_URL}/cart/validate", json=cart_payload, timeout=10)
        if cart_response.status_code != 200:
            log_test("COD Order Creation", False, f"Cart validation failed: {cart_response.text[:200]}")
            return None
        
        cart_data = cart_response.json()
        server_total = cart_data.get('total', 0)
        validated_items = cart_data.get('items', [])
        
        if not validated_items:
            log_test("COD Order Creation", False, "No items in validated cart")
            return None
        
        # Use a valid Indian pincode (Mumbai)
        payload = {
            "name": "Test Customer",
            "phone": "9876543210",
            "email": "test@example.com",
            "house_number": "123 Test Building",
            "area": "Test Area, Andheri",
            "pincode": "400058",
            "state": "Maharashtra",
            "payment_method": "COD",
            "amount": server_total,
            "items": [
                {
                    "slug": validated_items[0].get('slug'),
                    "name": validated_items[0].get('name'),
                    "quantity": 1,
                    "price": validated_items[0].get('price')
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/orders",
            json=payload,
            timeout=20
        )
        
        if response.status_code != 200:
            log_test("COD Order Creation", False, 
                    f"Status: {response.status_code}, Response: {response.text[:300]}")
            return None
        
        data = response.json()
        
        # Verify order structure
        if data.get('order_id') and data.get('amount'):
            log_test("COD Order Creation", True, 
                    f"Order ID: {data.get('order_id')}, Amount: ₹{data.get('amount')}, Status: {data.get('status')}")
            return data
        else:
            log_test("COD Order Creation", False, f"Invalid order response: {data}")
            return None
            
    except Exception as e:
        log_test("COD Order Creation", False, f"Exception: {str(e)}")
        return None

def test_consultation_submit():
    """Test POST /api/consultation/submit - lead/consultation form"""
    try:
        payload = {
            "answers": {
                "age_group": "25_30",
                "skin_type": "combination",
                "concerns": ["fine_lines", "pigmentation"],
                "sun_exposure": "1_2_hrs",
                "sunscreen_usage": "sometimes",
                "lifestyle": "moderate",
                "skincare_usage": "basic",
                "major_issue": "aging"
            },
            "phone": "9876543210",
            "face_images": [],
            "language": "en",
            "session_id": "test_session_123"
        }
        
        response = requests.post(
            f"{BASE_URL}/consultation/submit",
            json=payload,
            timeout=15
        )
        
        if response.status_code != 200:
            log_test("Consultation Submit", False, 
                    f"Status: {response.status_code}, Response: {response.text[:300]}")
            return None
        
        data = response.json()
        
        # Verify consultation response - check for 'id' field (not 'consultation_id')
        if data.get('id') or data.get('consultation_id') or data.get('success'):
            consultation_id = data.get('id') or data.get('consultation_id', 'N/A')
            log_test("Consultation Submit", True, 
                    f"Consultation ID: {consultation_id}")
            return data
        else:
            log_test("Consultation Submit", False, f"Invalid response: {data}")
            return None
            
    except Exception as e:
        log_test("Consultation Submit", False, f"Exception: {str(e)}")
        return None

def test_ai_skin_analyzer():
    """Test POST /api/routine/analyze - AI skin analysis endpoint"""
    try:
        # Create a minimal valid base64 image (1x1 transparent PNG)
        # This is just to test the endpoint responds, not for actual analysis
        minimal_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        payload = {
            "front": f"data:image/png;base64,{minimal_png_base64}",
            "concerns": ["aging"]
        }
        
        response = requests.post(
            f"{BASE_URL}/routine/analyze",
            json=payload,
            timeout=30  # AI calls may take longer
        )
        
        # Accept both 200 (success) and 422 (validation error for fake image)
        # as valid responses - we just want to ensure no 500 error
        if response.status_code == 200:
            data = response.json()
            if data.get('success') or data.get('skin_score'):
                log_test("AI Skin Analyzer", True, 
                        f"Skin Score: {data.get('skin_score', 'N/A')}, Analysis returned successfully")
                return data
            else:
                log_test("AI Skin Analyzer", False, f"Unexpected response: {data}")
                return None
        elif response.status_code == 422:
            # Expected validation error for non-human face
            log_test("AI Skin Analyzer", True, 
                    "Endpoint responds correctly with validation error for non-human image")
            return {"validation_error": True}
        else:
            log_test("AI Skin Analyzer", False, 
                    f"Status: {response.status_code}, Response: {response.text[:300]}")
            return None
            
    except Exception as e:
        log_test("AI Skin Analyzer", False, f"Exception: {str(e)}")
        return None

def main():
    """Run all backend tests"""
    print("=" * 70)
    print("CELESTA GLOW BACKEND API TESTING")
    print("=" * 70)
    print()
    
    # 1. Test Products Catalog
    print("📦 Testing Products Catalog...")
    print("-" * 70)
    products = test_products_list()
    
    if products and len(products) > 0:
        # Test product detail with first product slug
        first_slug = products[0].get('slug')
        if first_slug:
            test_product_detail(first_slug)
    
    # 2. Test Razorpay Order Creation
    print("💳 Testing Razorpay Integration...")
    print("-" * 70)
    test_razorpay_order_creation()
    
    # 3. Test COD Order Creation
    print("📦 Testing COD Order Creation...")
    print("-" * 70)
    test_cod_order_creation()
    
    # 4. Test Consultation Submit
    print("📋 Testing Consultation/Lead Submit...")
    print("-" * 70)
    test_consultation_submit()
    
    # 5. Test AI Skin Analyzer
    print("🤖 Testing AI Skin Analyzer...")
    print("-" * 70)
    test_ai_skin_analyzer()
    
    # Print Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"✅ Passed: {len(test_results['passed'])}")
    print(f"❌ Failed: {len(test_results['failed'])}")
    print()
    
    if test_results['failed']:
        print("Failed Tests:")
        for test in test_results['failed']:
            print(f"  - {test}")
        print()
        sys.exit(1)
    else:
        print("🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
