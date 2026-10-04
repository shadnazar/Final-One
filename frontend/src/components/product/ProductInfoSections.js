import React from 'react';
import { Star, Sparkles, Award, TrendingUp, Shield, Check } from 'lucide-react';

// Active Ingredients Section
export const ActiveIngredients = () => {
  const ingredients = [
    {
      name: 'Retinol 0.3%',
      benefit: 'Reduces wrinkles & fine lines',
      color: 'from-purple-500 to-violet-600'
    },
    {
      name: 'Niacinamide 5%',
      benefit: 'Minimizes pores & evens skin',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      name: 'Hyaluronic Acid',
      benefit: 'Deep hydration & plumping',
      color: 'from-pink-500 to-rose-600'
    },
    {
      name: 'Vitamin C 15%',
      benefit: 'Brightens & fights dark spots',
      color: 'from-orange-500 to-amber-600'
    }
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Award size={18} className="text-green-500" />
        Powerful Active Ingredients
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ingredients.map((item) => (
          <div key={item.name} className="bg-gray-50 rounded-xl p-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-2`}>
              <Sparkles size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-900 text-xs mb-0.5">{item.name}</p>
            <p className="text-[10px] text-gray-500">{item.benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Clinical Results Section
export const ClinicalResults = () => {
  const results = [
    { id: 'result-smooth', percentage: '94%', text: 'reported visibly smoother skin' },
    { id: 'result-lines', percentage: '89%', text: 'saw reduction in fine lines' },
    { id: 'result-hydration', percentage: '91%', text: 'noticed improved hydration' },
    { id: 'result-bright', percentage: '87%', text: 'experienced brighter skin tone' }
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <TrendingUp size={18} className="text-green-500" />
        Clinical Results in 4 Weeks
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {results.map((item) => (
          <div key={item.id} className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600 mb-1">{item.percentage}</p>
            <p className="text-[10px] text-gray-600">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Anti-Aging Benefits Section
export const AntiAgingBenefits = () => {
  const benefits = [
    'Reduces wrinkles & fine lines by 87%',
    'Firms & tightens sagging skin',
    'Fades age spots & pigmentation',
    'Restores youthful radiance',
    'Clinically tested on Indian skin'
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-green-500" />
        Why We're #1 for Anti-Aging
      </h3>
      <div className="space-y-2">
        {benefits.map((benefit, i) => (
          <div key={`benefit-${i}-${benefit.substring(0, 10)}`} className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check size={12} className="text-green-600" />
            </div>
            <span className="text-gray-700">{benefit}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Age Regression Score
export const AgeRegressionScore = () => (
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

// Product Reviews
export const ProductReviews = () => {
  const reviews = [
    { id: 'review-priya', name: 'Priya M.', location: 'Mumbai', rating: 5, text: 'My wrinkles have reduced so much! Best investment for my skin at 45.' },
    { id: 'review-anita', name: 'Anita S.', location: 'Delhi', rating: 5, text: 'I can see visible difference in just 2 weeks. My skin looks 10 years younger!' },
    { id: 'review-kavitha', name: 'Kavitha R.', location: 'Bangalore', rating: 5, text: 'Finally found a serum that works on Indian skin. Highly recommend!' }
  ];

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-3">Customer Reviews</h3>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-0.5">
                {[...Array(review.rating)].map((_, j) => (
                  <Star key={`${review.id}-star-${j}`} size={12} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <span className="text-xs text-gray-500">{review.name}, {review.location}</span>
            </div>
            <p className="text-sm text-gray-700">{review.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
