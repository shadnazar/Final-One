import React from 'react';
import { Flame, Clock } from 'lucide-react';

export const FlashSaleBanner = ({ timeLeft }) => (
  <div className="bg-red-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm">
    <Flame size={16} className="animate-pulse" />
    <span className="font-semibold">FLASH SALE:</span>
    <div className="flex gap-1 font-mono font-bold">
      <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{String(timeLeft.hours).padStart(2, '0')}</span>:
      <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{String(timeLeft.minutes).padStart(2, '0')}</span>:
      <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  </div>
);

export const StickyBottomCTA = ({ timeLeft, price, mrp, onClick, loading }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-40">
    <div className="flex items-center justify-between max-w-lg mx-auto">
      <div>
        <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
          <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px]">FLASH SALE</span>
          <span>Ends in {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xl font-bold text-gray-900">₹{price}</span>
          <span className="text-sm text-gray-400 line-through">₹{mrp}</span>
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={loading}
        className="btn-cg text-sm px-6 py-3 flex items-center gap-2"
        data-testid="sticky-buy-now-btn"
      >
        {loading ? 'Processing...' : 'Buy Now'}
        <span className="text-lg">→</span>
      </button>
    </div>
  </div>
);

export const TrustBadges = ({ Truck, ShieldCheck, Clock }) => (
  <div className="grid grid-cols-3 gap-2 py-5 border-y border-gray-100 mb-5">
    {[
      { id: 'trust-delivery', icon: Truck, label: 'Free Delivery', sublabel: 'All India' },
      { id: 'trust-genuine', icon: ShieldCheck, label: '100% Genuine', sublabel: 'Authentic' },
      { id: 'trust-shipping', icon: Clock, label: 'Fast Shipping', sublabel: '2-3 Days' },
    ].map((item) => (
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

export const SocialProofBanner = ({ viewingNow, soldToday, stockLeft, Users, Flame, Clock }) => (
  <div className="flex justify-center gap-4 py-3 bg-yellow-50 border-y border-yellow-100 text-sm">
    <div className="flex items-center gap-1 text-orange-600">
      <Users size={14} />
      <span><strong>{viewingNow}</strong> viewing</span>
    </div>
    <div className="flex items-center gap-1 text-green-600">
      <Flame size={14} />
      <span><strong>{soldToday}</strong> sold today</span>
    </div>
    <div className="flex items-center gap-1 text-red-600">
      <Clock size={14} />
      <span>Only <strong>{stockLeft}</strong> left!</span>
    </div>
  </div>
);

export const PriceCard = ({ prepaidPrice, mrp }) => (
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
);

export const ProductRating = ({ rating = 4.8, reviews = 2340, Star }) => (
  <div className="flex items-center gap-2 mb-4" data-testid="product-rating">
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={`rating-star-${i}`} size={14} className="star-gold" />
      ))}
    </div>
    <span className="text-gray-500 text-sm">{rating} ({reviews.toLocaleString()} reviews)</span>
  </div>
);
