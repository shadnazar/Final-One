import React, { memo } from 'react';
import { Star, Award, Check, Sparkles } from 'lucide-react';

const MRP = 1499;
const PREPAID_PRICE = 699;

// Memoized star rating component
const StarRating = memo(({ rating = 5, reviewCount = 2340 }) => (
  <div className="flex items-center gap-2 mb-4" data-testid="product-rating">
    <div className="flex gap-0.5">
      {Array.from({ length: rating }, (_, i) => (
        <Star key={`star-${i}`} size={14} className="star-gold" />
      ))}
    </div>
    <span className="text-gray-500 text-sm">4.8 ({reviewCount.toLocaleString()} reviews)</span>
  </div>
));
StarRating.displayName = 'StarRating';

// Memoized price card
const PriceCard = memo(({ price = PREPAID_PRICE, mrp = MRP }) => (
  <div className="card-cg mb-5" data-testid="product-price">
    <div className="flex items-baseline gap-3 mb-2">
      <span className="text-3xl font-bold text-green-600">₹{price}</span>
      <span className="text-lg text-gray-400 line-through">₹{mrp}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-white bg-red-500 px-2 py-1 rounded">
        SAVE ₹{mrp - price}
      </span>
      <span className="text-xs text-red-600 font-medium">Limited Time Only!</span>
    </div>
  </div>
));
PriceCard.displayName = 'PriceCard';

// Age regression score component
const AgeRegressionScore = memo(() => (
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
));
AgeRegressionScore.displayName = 'AgeRegressionScore';

// Benefits list with unique keys
const BENEFITS = [
  { id: 'benefit-wrinkles', text: 'Reduces wrinkles by 47% in 4 weeks', highlight: '47%' },
  { id: 'benefit-collagen', text: 'Boosts collagen production by 89%', highlight: '89%' },
  { id: 'benefit-elasticity', text: 'Improves skin elasticity in 14 days', highlight: '14 days' },
  { id: 'benefit-customers', text: '10,000+ happy customers across India', highlight: '10,000+' },
];

const BenefitsList = memo(() => (
  <div className="mb-6">
    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
      <Sparkles size={18} className="text-green-500" />
      Why We're #1 for Anti-Aging
    </h3>
    <div className="space-y-2.5">
      {BENEFITS.map((benefit) => (
        <div key={benefit.id} className="check-item" data-testid={benefit.id}>
          <div className="check-icon">
            <Check size={12} />
          </div>
          <span className="text-gray-700 text-sm">{benefit.text}</span>
        </div>
      ))}
    </div>
  </div>
));
BenefitsList.displayName = 'BenefitsList';

// Clinical results component
const ClinicalResults = memo(() => (
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
));
ClinicalResults.displayName = 'ClinicalResults';

// Main ProductHero component
function ProductHero({ price = PREPAID_PRICE, mrp = MRP }) {
  return (
    <div className="px-5 py-5">
      <p className="text-xs text-gray-500 mb-1">CELESTA GLOW</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2" data-testid="product-title">
        Super Anti-Aging Serum
      </h1>
      <p className="text-sm text-gray-600 mb-3">India's First 4-in-1 Age Balance Formula</p>
      
      <StarRating />
      <PriceCard price={price} mrp={mrp} />
      <AgeRegressionScore />
      <BenefitsList />
      <ClinicalResults />
    </div>
  );
}

export default memo(ProductHero);
export { StarRating, PriceCard, AgeRegressionScore, BenefitsList, ClinicalResults };
