/**
 * Product Hero Section - Main product display with image, price, benefits
 */
import React, { memo } from 'react';
import { Star, Check, Award, Sparkles } from 'lucide-react';

// Product Image Gallery with Touch Scroll
export const ProductImageGallery = memo(function ProductImageGallery({ 
  images, 
  currentIndex, 
  setCurrentIndex,
  productImage 
}) {
  const allImages = images || [productImage];
  
  return (
    <div className="relative bg-gradient-to-b from-gray-100 to-white">
      <div 
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        onScroll={(e) => {
          const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
          if (setCurrentIndex) setCurrentIndex(idx);
        }}
      >
        {allImages.map((img, idx) => (
          <div key={`product-img-${idx}`} className="min-w-full snap-center">
            <img 
              src={img} 
              alt={`Product view ${idx + 1}`} 
              className="w-full h-72 object-contain"
            />
          </div>
        ))}
      </div>
      {allImages.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {allImages.map((_, idx) => (
            <div 
              key={`dot-${idx}`}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-green-500 w-4' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Product Info Header (Title, Rating, Price)
export const ProductInfoHeader = memo(function ProductInfoHeader({ 
  mrp, 
  prepaidPrice 
}) {
  return (
    <>
      <p className="text-xs text-gray-500 mb-1">CELESTA GLOW</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2" data-testid="product-title">
        Super Anti-Aging Serum
      </h1>
      <p className="text-sm text-gray-600 mb-3">India's First 4-in-1 Age Balance Formula</p>
      
      {/* Rating */}
      <div className="flex items-center gap-2 mb-4" data-testid="product-rating">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={`rating-star-${i}`} size={14} className="star-gold" />
          ))}
        </div>
        <span className="text-gray-500 text-sm">4.8 (2,340 reviews)</span>
      </div>

      {/* Price Card */}
      <div className="card-cg mb-5" data-testid="product-price">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-bold text-green-600">₹{prepaidPrice}</span>
          <span className="text-lg text-gray-400 line-through">₹{mrp}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white bg-red-500 px-2 py-1 rounded">
            SAVE ₹{mrp - prepaidPrice}
          </span>
          <span className="text-xs text-red-600 font-medium">Limited Time Only!</span>
        </div>
      </div>
    </>
  );
});

// Age Regression Score Card
export const AgeRegressionScore = memo(function AgeRegressionScore() {
  return (
    <div className="bg-gradient-to-r from-green-50 to-green-50 border border-green-200 rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-green-600 font-medium mb-1">DERMATOLOGIST APPROVED</p>
          <p className="text-4xl font-bold text-green-600">95</p>
          <p className="text-sm text-gray-600">Age Regression Score</p>
        </div>
        <div className="text-right">
          <Award size={40} className="text-green-500 mb-2" />
          <p className="text-xs text-gray-500">Clinically Tested</p>
        </div>
      </div>
    </div>
  );
});

// Benefits List
export const BenefitsList = memo(function BenefitsList() {
  const benefits = [
    { id: 'benefit-wrinkles', text: 'Reduces wrinkles by 47% in 4 weeks', highlight: '47%' },
    { id: 'benefit-collagen', text: 'Boosts collagen production by 89%', highlight: '89%' },
    { id: 'benefit-elasticity', text: 'Improves skin elasticity in 14 days', highlight: '14 days' },
    { id: 'benefit-customers', text: '10,000+ happy customers across India', highlight: '10,000+' },
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-green-500" />
        Why We're #1 for Anti-Aging
      </h3>
      <div className="space-y-2.5">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="check-item" data-testid={benefit.id}>
            <div className="check-icon">
              <Check size={12} />
            </div>
            <span className="text-gray-700 text-sm">{benefit.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// Clinical Results Section
export const ClinicalResults = memo(function ClinicalResults() {
  return (
    <div className="bg-gray-900 text-white rounded-2xl p-5 mb-5">
      <p className="text-xs text-green-400 font-medium mb-2">CLINICAL STUDY RESULTS</p>
      <h3 className="text-lg font-bold mb-4">Proven Anti-Aging Results</h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-green-400">94%</p>
          <p className="text-xs text-gray-400">Reduced Fine Lines</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">89%</p>
          <p className="text-xs text-gray-400">Firmer Skin</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">96%</p>
          <p className="text-xs text-gray-400">More Radiant</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3 text-center">*Based on 8-week clinical trial with 200 participants</p>
    </div>
  );
});

// Powerful Ingredients Section
export const IngredientsSection = memo(function IngredientsSection() {
  const ingredients = [
    { 
      id: 'ingredient-retinol',
      name: '0.3% Retinol', 
      benefit: 'Gold standard for wrinkle reduction', 
      detail: 'Clinically proven to boost collagen',
      gradient: 'from-purple-500 to-indigo-600',
      bgGradient: 'from-purple-50 to-indigo-50',
      icon: '✨'
    },
    { 
      id: 'ingredient-hyaluronic',
      name: 'Hyaluronic Acid', 
      benefit: '72-hour deep hydration', 
      detail: 'Holds 1000x its weight in water',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      icon: '💧'
    },
    { 
      id: 'ingredient-niacinamide',
      name: '5% Niacinamide', 
      benefit: 'Brightens & evens skin tone', 
      detail: 'Minimizes pores & dark spots',
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      icon: '☀️'
    },
    { 
      id: 'ingredient-vitamine',
      name: 'Vitamin E Complex', 
      benefit: 'Protects against damage', 
      detail: 'Powerful antioxidant shield',
      gradient: 'from-green-500 to-green-500',
      bgGradient: 'from-green-50 to-green-50',
      icon: '🛡️'
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </span>
        Powerful Active Ingredients
      </h3>
      <div className="space-y-3">
        {ingredients.map((item) => (
          <div key={item.id} className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${item.bgGradient} border border-gray-100`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white text-xl shadow-lg`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-700 font-medium">{item.benefit}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Sticky Bottom CTA
export const StickyBottomCTA = memo(function StickyBottomCTA({ 
  timeLeft, 
  prepaidPrice, 
  mrp, 
  onBuyClick 
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t-2 border-green-500 p-3 z-50 shadow-2xl" data-testid="sticky-bottom-cta">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">FLASH SALE</span>
            <span className="text-[10px] text-red-600 font-medium">
              Ends in {String(timeLeft.hours).padStart(2,'0')}:{String(timeLeft.minutes).padStart(2,'0')}:{String(timeLeft.seconds).padStart(2,'0')}
            </span>
          </div>
          <p className="font-bold text-gray-900 text-lg">₹{prepaidPrice} <span className="text-sm text-gray-400 line-through">₹{mrp}</span></p>
        </div>
        <button
          onClick={onBuyClick}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          data-testid="sticky-buy-button"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
});
