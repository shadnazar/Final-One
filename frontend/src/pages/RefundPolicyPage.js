import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw, CheckCircle, Clock, AlertCircle, HelpCircle } from 'lucide-react';
import SEOHead, { breadcrumbJsonLd, faqJsonLd } from '../components/SEOHead';

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="Refund & Return Policy | Celesta Glow"
        description="Celesta Glow accepts 7-day returns on unopened, factory-sealed items only. Opened bottles cannot be returned or refunded for hygiene reasons. Damaged-on-arrival shipments are always covered."
        canonicalPath="/refund-policy"
        jsonLd={[
          breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Refund & Return Policy', url: '/refund-policy' }]),
          faqJsonLd([
            { q: 'Can I return an opened bottle of Celesta Glow?',
              a: 'No. For hygiene and safety reasons, once a bottle, tube or jar has been opened or its seal broken, we cannot accept it back, replace it or refund it — even if used only once. Damaged-on-arrival or wrong-item shipments are always covered.' },
            { q: 'How long do I have to return a Celesta Glow product?',
              a: 'You have 7 days from delivery to raise a return request on unopened, factory-sealed items.' },
            { q: 'How will my refund be issued?',
              a: 'For prepaid orders, refund is sent to your original payment method within 7-10 business days. For COD orders, refund is sent via bank transfer or UPI within 7-10 business days.' },
            { q: 'What if my product arrives damaged?',
              a: 'Contact us within 48 hours of delivery with order ID, photos of the outer parcel and product, and an unboxing video if possible. We arrange a free replacement or full refund — damaged-on-arrival cases are always covered.' },
          ]),
        ]}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Refund & Return Policy</h1>
              <p className="text-sm text-gray-500">Last updated: February 2026</p>
            </div>
          </div>

          {/* Sealed-Only Returns Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">Sealed-Bottle Returns Only</p>
                <p className="text-sm text-amber-800">For hygiene &amp; safety reasons, we cannot accept or refund any product whose <strong>seal has been broken or bottle opened</strong>. Damaged-on-arrival and wrong-item shipments are always covered.</p>
              </div>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Our Promise</h2>
            <p className="text-gray-600 mb-4">
              At Celesta Glow, we want every customer to be confident in their purchase — but because skincare and cosmetics are personal-care products, hygiene rules are non-negotiable. <strong>Once a bottle, tube or jar has been opened or its seal broken, we cannot accept it back, replace it, or refund it.</strong> Returns are accepted only on unopened, factory-sealed items inside a 7-day window from delivery, or on shipments that arrived damaged or wrong (always eligible).
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. Eligibility for Returns</h2>
            <p className="text-gray-600 mb-2">A return request will be approved <strong>only</strong> if all of the following are true:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>Request is raised within <strong>7 days of delivery</strong>.</li>
              <li>The product is <strong>completely unused</strong> with the manufacturer seal/shrink-wrap intact.</li>
              <li>Original packaging, outer carton, leaflets and any free gift are returned together.</li>
              <li>You have the order ID and an unboxing video / clear photos of the unopened product.</li>
            </ul>
            <p className="text-gray-600 mb-2">Damaged-on-arrival or wrong-item deliveries are <strong>always</strong> eligible — see Section 6.</p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. Non-Returnable / Non-Refundable</h2>
            <p className="text-gray-600 mb-2">For health, hygiene and safety reasons, we cannot accept returns or issue refunds on:</p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Any product that has been opened, used, sampled, swatched or had its seal broken</strong> — even if used only once.</li>
              <li>Products with missing original packaging, outer carton or leaflets.</li>
              <li>Returns requested after the 7-day window from delivery.</li>
              <li>Free gifts, samples, complimentary items and promotional add-ons.</li>
              <li>Items damaged due to mishandling by the customer after delivery.</li>
              <li>Personal-care kits, sets or combos where any single item inside has been opened.</li>
            </ul>
            <p className="text-gray-600 mb-4">
              <strong>If a parcel is opened during reverse-pickup inspection and our team finds the seal tampered with, the return will be rejected and the product shipped back to you at no extra cost — no refund will be issued.</strong>
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. How to Request a Return</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <p className="text-gray-700">Contact us via WhatsApp at <a href="https://wa.me/919446125745" className="text-green-600 font-medium">+91 94461 25745</a> or email <a href="mailto:support@celestaglow.com" className="text-green-600 font-medium">support@celestaglow.com</a></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <p className="text-gray-700">Provide your order ID and reason for return</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <p className="text-gray-700">Our team will arrange a reverse pickup within 3-5 business days</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                  <p className="text-gray-700">Refund will be processed within 7-10 business days after receiving the product</p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Refund Process</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">Prepaid Orders</span>
                </div>
                <p className="text-sm text-gray-600">Refund to original payment method within 7-10 business days</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-gray-900">COD Orders</span>
                </div>
                <p className="text-sm text-gray-600">Refund via bank transfer or UPI within 7-10 business days</p>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Damaged, Defective or Wrong Products</h2>
            <p className="text-gray-600 mb-4">
              Received a damaged carton, leaking bottle or the wrong item? Please contact us within <strong>48 hours of delivery</strong> with (1) the order ID, (2) clear photos of the outer parcel and the product, and (3) a short unboxing video if possible. We will arrange a free replacement or a full refund — these cases are <strong>always</strong> covered, regardless of whether the inner seal was broken during inspection.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Cancellation Policy</h2>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Before Shipping:</strong> Full refund within 24 hours</li>
              <li><strong>After Shipping:</strong> Product will be delivered; you can then request a return</li>
              <li><strong>Prepaid Orders:</strong> ₹29 COD advance is non-refundable if order is cancelled after shipping</li>
            </ul>

            <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">Need Help?</p>
                  <p className="text-sm text-yellow-700">
                    For any refund-related queries, reach out to us on WhatsApp: <a href="https://wa.me/919446125745" className="font-medium underline">+91 94461 25745</a> or email: <a href="mailto:support@celestaglow.com" className="font-medium underline">support@celestaglow.com</a>
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

export default RefundPolicyPage;
