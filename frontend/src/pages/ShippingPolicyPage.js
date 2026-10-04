import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, Truck, Package, MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';

function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="Shipping Policy | Free Delivery Across India | Celesta Glow"
        description="Celesta Glow ships free across India via Delhivery (19,000+ pin codes). Metro 2-3 days, other cities 3-5 days. Both prepaid and COD options."
        canonicalPath="/shipping-policy"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Shipping Policy', url: '/shipping-policy' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shipping Policy</h1>
              <p className="text-sm text-gray-500">Last updated: April 2026</p>
            </div>
          </div>

          {/* Free Shipping Banner */}
          <div className="bg-gradient-to-r from-green-50 to-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">FREE Shipping on All Orders!</p>
                <p className="text-sm text-green-700">We deliver across India at no extra cost to you.</p>
              </div>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Shipping Coverage</h2>
            <p className="text-gray-600 mb-4">
              We ship to all serviceable pin codes across India. Our logistics partner Delhivery covers 19,000+ pin codes ensuring delivery to both urban and rural areas.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. Delivery Timeline</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">Metro Cities</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">2-3 Days</p>
                <p className="text-xs text-gray-500">Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-gray-900">Other Cities</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">3-5 Days</p>
                <p className="text-xs text-gray-500">Tier 2 & 3 cities, Towns</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-4 italic">
              *Delivery times are estimates and may vary due to unforeseen circumstances like weather conditions, local holidays, or logistics delays.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. Order Processing</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Package className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Order Confirmation</p>
                    <p className="text-sm text-gray-600">Within 30 minutes via SMS/WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Dispatch Time</p>
                    <p className="text-sm text-gray-600">Same day for orders placed before 2 PM IST</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Truck className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Tracking Updates</p>
                    <p className="text-sm text-gray-600">Real-time tracking via SMS & WhatsApp</p>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. Payment Options</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900 mb-2">Prepaid Options</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• UPI (GPay, PhonePe, Paytm)</li>
                  <li>• Credit/Debit Cards</li>
                  <li>• Net Banking</li>
                  <li>• Wallets</li>
                </ul>
              </div>
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900 mb-2">Cash on Delivery (COD)</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Available across India</li>
                  <li>• ₹29 COD advance required</li>
                  <li>• Pay remaining on delivery</li>
                  <li>• Cash/UPI accepted</li>
                </ul>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Order Tracking</h2>
            <p className="text-gray-600 mb-4">
              Once your order is shipped, you'll receive a tracking link via SMS and WhatsApp. You can track your order status in real-time through our logistics partner's website.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Delivery Attempts</h2>
            <p className="text-gray-600 mb-4">
              Our delivery partner will make up to 3 delivery attempts. If you're unavailable, they will contact you to reschedule. After 3 failed attempts, the order will be returned to us.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Unserviceable Areas</h2>
            <p className="text-gray-600 mb-4">
              Some remote areas may not be serviceable by our logistics partner. In such cases, we will contact you within 24 hours of order placement to arrange an alternative or process a full refund.
            </p>

            <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">Shipping Queries?</p>
                  <p className="text-sm text-yellow-700">
                    Contact us on WhatsApp: <a href="https://wa.me/919446125745" className="font-medium underline">+91 94461 25745</a> or email: <a href="mailto:support@celestaglow.com" className="font-medium underline">support@celestaglow.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShippingPolicyPage;
