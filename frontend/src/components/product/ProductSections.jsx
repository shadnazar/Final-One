/**
 * Product Page Components - Extracted for cleaner code
 * These components are memoized for performance
 */
import React, { memo } from 'react';
import { Star, Check, Truck, Shield, ChevronDown, ChevronUp, Clock, ShieldCheck, Award, TrendingUp, BadgeCheck, Verified, CreditCard } from 'lucide-react';

// Trust Badges Grid Component
export const TrustBadgesGrid = memo(function TrustBadgesGrid() {
  const badges = [
    { id: 'trust-delivery', icon: Truck, label: 'Free Delivery', sublabel: 'All India' },
    { id: 'trust-genuine', icon: ShieldCheck, label: '100% Genuine', sublabel: 'Authentic' },
    { id: 'trust-shipping', icon: Clock, label: 'Fast Shipping', sublabel: '2-3 Days' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 py-5 border-y border-gray-100 mb-5">
      {badges.map((item) => (
        <div key={item.id} className="text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
            <item.icon size={18} className="text-green-600" />
          </div>
          <p className="text-xs font-semibold text-gray-900">{item.label}</p>
          <p className="text-[10px] text-gray-500">{item.sublabel}</p>
        </div>
      ))}
    </div>
  );
});

// Why Choose Us Section
export const WhyChooseUsSection = memo(function WhyChooseUsSection() {
  const items = [
    { id: 'why-results', icon: TrendingUp, title: 'Visible Results', desc: 'See younger skin in just 2-4 weeks', stat: '94%' },
    { id: 'why-safe', icon: Shield, title: 'Safe Formula', desc: 'Dermatologist tested, no harsh chemicals', stat: '100%' },
    { id: 'why-award', icon: Award, title: 'Award Winning', desc: "India's #1 rated anti-aging serum", stat: '#1' },
  ];

  return (
    <div className="mt-6 p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl">
      <h3 className="font-bold mb-4 text-center flex items-center justify-center gap-2 text-white">
        <Award className="text-green-400" size={20} />
        <span className="text-white">Why 10,000+ Choose Celesta Glow</span>
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-white/15 backdrop-blur p-3 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <item.icon size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{item.title}</p>
              <p className="text-xs text-gray-200">{item.desc}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-green-400">{item.stat}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Product Details Accordion
export const ProductDetailsAccordion = memo(function ProductDetailsAccordion({ expandedSection, setExpandedSection, trackAction }) {
  const sections = [
    { 
      id: 'detail-ingredients',
      title: 'Key Ingredients', 
      emoji: '🧪',
      content: '0.3% Retinol for cell renewal, Niacinamide for brightening, Hyaluronic Acid for deep hydration, Vitamin E for protection against environmental damage.',
      highlight: '4-in-1 Formula'
    },
    { 
      id: 'detail-usage',
      title: 'How to Use', 
      emoji: '📝',
      content: 'Cleanse face, apply 2-3 drops to face and neck avoiding eye area, follow with moisturizer. Use sunscreen during daytime. For retinol beginners, start 2-3 times per week.',
      highlight: 'Night Use Only'
    },
    { 
      id: 'detail-clinical',
      title: 'Clinical Results', 
      emoji: '📊',
      content: '94% saw improved hydration. 89% noticed reduced fine lines. 91% reported brighter, more youthful skin. Results from 8-week clinical study with 200 participants.',
      highlight: '8-Week Study'
    },
    { 
      id: 'detail-included',
      title: "What's Included", 
      emoji: '📦',
      content: '30ml Premium Anti-Aging Serum in airless pump bottle, detailed usage guide, satisfaction guarantee card. Package includes protective box for safe delivery.',
      highlight: '30ml Bottle'
    },
  ];

  return (
    <div className="mt-6 space-y-3">
      <h3 className="font-bold text-gray-900 mb-2">Product Details</h3>
      {sections.map((section) => (
        <div key={section.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => {
              setExpandedSection(expandedSection === section.id ? null : section.id);
              if (trackAction) trackAction('faq_interaction', { section: section.title });
            }}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            data-testid={`accordion-${section.id}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">{section.emoji} {section.title}</span>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {section.highlight}
              </span>
            </div>
            {expandedSection === section.id 
              ? <ChevronUp size={18} className="text-green-500" /> 
              : <ChevronDown size={18} className="text-gray-400" />
            }
          </button>
          {expandedSection === section.id && (
            <div className="px-4 pb-4 pt-0">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// Final Trust Section (Rating & Certifications)
export const FinalTrustSection = memo(function FinalTrustSection() {
  return (
    <div className="mt-6 text-center pb-6">
      <div className="flex items-center justify-center gap-2 mb-2">
        {[...Array(5)].map((_, i) => (
          <Star key={`trust-star-${i}`} size={16} className="text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <p className="text-sm text-gray-600">Rated 4.8/5 by 2,340+ customers</p>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span>✓ FDA Approved</span>
        <span>✓ Cruelty Free</span>
        <span>✓ Made in India</span>
      </div>
    </div>
  );
});

// Trusted By Section (Bottom badges)
export const TrustedBySection = memo(function TrustedBySection() {
  return (
    <div className="px-4 pb-32">
      <div className="bg-gradient-to-r from-green-50 to-green-50 border border-green-100 rounded-2xl p-4 mb-20">
        <p className="text-center text-xs font-semibold text-green-700 mb-3">TRUSTED BY 10,000+ CUSTOMERS</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-1">
              <BadgeCheck className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-[10px] text-gray-600">100% Genuine</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-1">
              <Verified className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] text-gray-600">Verified Seller</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-1">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-[10px] text-gray-600">Secure Pay</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-1">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-[10px] text-gray-600">Fast Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Expert Endorsement Section
export const ExpertEndorsement = memo(function ExpertEndorsement() {
  return (
    <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-700 font-bold">DR</span>
        </div>
        <div>
          <p className="text-sm text-gray-700 italic">"Celesta Glow contains the gold standard of anti-aging ingredients. I recommend it to all my patients looking for effective, gentle anti-aging care."</p>
          <p className="text-xs text-gray-600 mt-2 font-medium">— Dr. Priya Sharma, Dermatologist</p>
        </div>
      </div>
    </div>
  );
});

// Money Back Guarantee
export const MoneyBackGuarantee = memo(function MoneyBackGuarantee() {
  return (
    <div className="mt-5 p-4 bg-green-50 border border-green-100 rounded-xl text-center">
      <p className="text-green-700 font-semibold text-sm">💯 7-Day Sealed Return</p>
      <p className="text-green-600 text-xs mt-1">Unopened, factory-sealed items only · Damaged or wrong-item shipments always covered</p>
    </div>
  );
});

// Active Ingredients Section
export const ActiveIngredientsSection = memo(function ActiveIngredientsSection() {
  const ingredients = [
    { id: 'ing-retinol', name: 'Retinol 0.3%', desc: 'Reduces wrinkles & fine lines', color: 'from-purple-400 to-pink-400' },
    { id: 'ing-niacinamide', name: 'Niacinamide', desc: 'Brightens & evens skin tone', color: 'from-blue-400 to-cyan-400' },
    { id: 'ing-hyaluronic', name: 'Hyaluronic Acid', desc: 'Deep hydration & plumping', color: 'from-green-400 to-green-400' },
    { id: 'ing-vitamine', name: 'Vitamin E', desc: 'Protects & nourishes skin', color: 'from-amber-400 to-orange-400' },
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check size={14} className="text-white" />
        </span>
        Active Ingredients
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ingredients.map((item) => (
          <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                {item.name}
              </span>
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
            </div>
            <p className="text-[11px] text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

// Exit Intent Popup Component
export const ExitIntentPopup = memo(function ExitIntentPopup({ 
  show, 
  onClose, 
  onClaim, 
  loading,
  discountAmount = 100 
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative animate-bounce-in">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
        >
          ✕
        </button>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏰</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Wait! Don't Miss Out!</h3>
          <p className="text-gray-600 mb-4">Get an EXTRA ₹{discountAmount} OFF your order right now!</p>
          
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 px-6 rounded-xl mb-4">
            <span className="text-2xl font-bold">₹{discountAmount} OFF</span>
            <p className="text-xs opacity-90">Limited time offer</p>
          </div>
          
          <button
            onClick={onClaim}
            disabled={loading}
            className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Applying...' : `Claim ₹${discountAmount} Discount`}
          </button>
          
          <button
            onClick={onClose}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            No thanks, I'll pay full price
          </button>
        </div>
      </div>
    </div>
  );
});
