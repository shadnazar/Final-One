import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';

function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="Terms & Conditions | Celesta Glow"
        description="Celesta Glow's Terms & Conditions for shopping, returns, payment, cookies, intellectual property and customer responsibilities."
        canonicalPath="/terms"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Terms', url: '/terms' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
              <p className="text-sm text-gray-500">Last updated: March 2026</p>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Introduction</h2>
            <p className="text-gray-600 mb-4">
              Welcome to Celesta Glow. By accessing our website and using our services, you agree to be bound by these 
              Terms and Conditions. Please read them carefully before using our platform.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. Cookies and Tracking</h2>
            <p className="text-gray-600 mb-4">
              By claiming any discount or continuing to use our website after accepting our terms, you consent to the use of:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for the website to function properly</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website</li>
              <li><strong>Marketing Cookies:</strong> Used to track visitors for advertising purposes</li>
              <li><strong>Personalization Cookies:</strong> Allow us to provide a personalized shopping experience</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. Data Collection</h2>
            <p className="text-gray-600 mb-4">
              We collect the following information to improve your experience:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Pages you visit on our website</li>
              <li>Time spent on each page</li>
              <li>Actions taken (clicks, form submissions, etc.)</li>
              <li>Device information (screen size, browser type)</li>
              <li>Phone number (when provided for discounts)</li>
              <li>Delivery address (when placing an order)</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. Products and Orders</h2>
            <p className="text-gray-600 mb-4">
              All products sold on Celesta Glow are genuine and sourced directly from authorized manufacturers. 
              We reserve the right to limit quantities, refuse or cancel orders at our discretion.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Pricing and Discounts</h2>
            <p className="text-gray-600 mb-4">
              Prices are subject to change without notice. Discount codes are valid for one-time use only and cannot 
              be combined with other offers unless explicitly stated.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Returns and Refunds</h2>
            <p className="text-gray-600 mb-4">
              We offer a 7-day return window on <strong>unopened, factory-sealed</strong> products in original
              packaging. For hygiene and safety reasons, we cannot accept returns or issue refunds on any product
              whose seal has been broken or bottle opened — even if used only once. Damaged-on-arrival or wrong-item
              shipments are always covered. Refunds (when eligible) are processed within 7-10 business days after we
              receive the returned product. See our <a href="/refund-policy" className="text-green-700 underline font-medium">Refund &amp; Return Policy</a> for full details.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Skin Consultation</h2>
            <p className="text-gray-600 mb-4">
              Our online skin consultation provides personalized recommendations based on your inputs. It is not a 
              substitute for professional medical advice. Consult a dermatologist for specific skin conditions.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">8. Intellectual Property</h2>
            <p className="text-gray-600 mb-4">
              All content on this website, including text, images, logos, and product designs, is the property of 
              Celesta Glow and protected by intellectual property laws.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">9. Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For any questions regarding these terms, please contact us at:
            </p>
            <ul className="list-none text-gray-600 mb-4 space-y-1">
              <li>Email: support@celestaglow.com</li>
              <li>Phone: +91 94461 25745</li>
              <li>WhatsApp: <a href="https://wa.me/919446125745" className="text-green-600 hover:underline">+91 94461 25745</a></li>
            </ul>
            
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">10. Company Information</h2>
            <p className="text-gray-600 mb-4">
              <strong>Veegal Enterprises LLP</strong><br />
              1st Floor, 38, Booth No. 62, Ashwini Layout, 2nd Main, Egipura,<br />
              Bengaluru, Karnataka – 560047, India
            </p>

            <div className="mt-8 p-4 bg-green-50 rounded-xl">
              <p className="text-green-700 text-sm">
                By using Celesta Glow, you acknowledge that you have read, understood, and agree to be bound by 
                these Terms and Conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
