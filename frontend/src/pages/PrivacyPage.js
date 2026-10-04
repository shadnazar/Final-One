import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="Privacy Policy | Celesta Glow"
        description="How Celesta Glow collects, uses and protects your personal data. SSL-encrypted payments via Razorpay, cookie disclosures and your data rights."
        canonicalPath="/privacy"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Privacy Policy', url: '/privacy' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-sm text-gray-500">Last updated: March 2026</p>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Information We Collect</h2>
            <p className="text-gray-600 mb-4">
              At Celesta Glow, we collect information to provide you with a better shopping experience. 
              This includes:
            </p>
            
            <h3 className="text-md font-semibold text-gray-800 mt-4 mb-2">Personal Information</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Name and contact information</li>
              <li>Phone number (for discounts and order updates)</li>
              <li>Delivery address</li>
              <li>Payment information (processed securely via Razorpay)</li>
            </ul>

            <h3 className="text-md font-semibold text-gray-800 mt-4 mb-2">Automatically Collected Information</h3>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Browser type and version</li>
              <li>Device information and screen resolution</li>
              <li>IP address and approximate location</li>
              <li>Pages visited and time spent</li>
              <li>Click and scroll behavior</li>
              <li>Referral source</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. Cookies and Tracking Technologies</h2>
            <p className="text-gray-600 mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Remember your preferences and settings</li>
              <li>Analyze website traffic and usage patterns</li>
              <li>Personalize your shopping experience</li>
              <li>Deliver targeted advertisements</li>
              <li>Improve our products and services</li>
            </ul>

            <h3 className="text-md font-semibold text-gray-800 mt-4 mb-2">Types of Cookies We Use</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Cookie Type</th>
                    <th className="px-4 py-2 text-left">Purpose</th>
                    <th className="px-4 py-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2">Essential</td>
                    <td className="px-4 py-2">Website functionality, cart, login</td>
                    <td className="px-4 py-2">Session</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2">Analytics</td>
                    <td className="px-4 py-2">Usage tracking, page views</td>
                    <td className="px-4 py-2">1 year</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2">Marketing</td>
                    <td className="px-4 py-2">Advertising, retargeting</td>
                    <td className="px-4 py-2">90 days</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2">Preferences</td>
                    <td className="px-4 py-2">Language, location settings</td>
                    <td className="px-4 py-2">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Provide personalized product recommendations</li>
              <li>Send promotional offers and discounts (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Prevent fraud and ensure security</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. Third-Party Services</h2>
            <p className="text-gray-600 mb-4">
              We may share your information with trusted third parties:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Razorpay:</strong> For secure payment processing</li>
              <li><strong>Meta (Facebook):</strong> For advertising and analytics</li>
              <li><strong>Shipping Partners:</strong> For order delivery</li>
              <li><strong>SMS Providers:</strong> For order updates and OTP</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Data Security</h2>
            <p className="text-gray-600 mb-4">
              We implement appropriate security measures to protect your personal information from unauthorized 
              access, alteration, disclosure, or destruction. All payment transactions are encrypted using SSL technology.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Your Rights</h2>
            <p className="text-gray-600 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Withdraw consent for data processing</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For privacy-related inquiries or to exercise your rights, contact us at:
            </p>
            <ul className="list-none text-gray-600 mb-4 space-y-1">
              <li>Email: support@celestaglow.com</li>
              <li>Phone: +91 94461 25745</li>
              <li>WhatsApp: <a href="https://wa.me/919446125745" className="text-green-600 hover:underline">+91 94461 25745</a></li>
            </ul>
            
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">8. Company Information</h2>
            <p className="text-gray-600 mb-4">
              <strong>Veegal Enterprises LLP</strong><br />
              1st Floor, 38, Booth No. 62, Ashwini Layout, 2nd Main, Egipura,<br />
              Bengaluru, Karnataka – 560047, India
            </p>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <p className="text-blue-700 text-sm">
                By using Celesta Glow, you consent to the collection and use of your information as described 
                in this Privacy Policy. We may update this policy from time to time, and any changes will be 
                posted on this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPage;
