import React, { memo } from 'react';
import { Shield, Truck, Award, RefreshCw, CheckCircle } from 'lucide-react';

// Trust badges data with unique IDs
const TRUST_BADGES = [
  { id: 'badge-genuine', icon: Shield, text: '100% Genuine', color: 'text-green-600' },
  { id: 'badge-delivery', icon: Truck, text: 'Free Delivery', color: 'text-blue-600' },
  { id: 'badge-derma', icon: Award, text: 'Dermatologist Approved', color: 'text-purple-600' },
  { id: 'badge-return', icon: RefreshCw, text: 'Easy Returns', color: 'text-orange-600' },
];

// Single trust badge
const TrustBadge = memo(({ badge }) => {
  const Icon = badge.icon;
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-1.5 ${badge.color}`}>
        <Icon size={18} />
      </div>
      <span className="text-xs text-gray-600 font-medium">{badge.text}</span>
    </div>
  );
});
TrustBadge.displayName = 'TrustBadge';

// Trust badges grid
function TrustBadges() {
  return (
    <div className="grid grid-cols-4 gap-2 mb-6 py-4 border-y border-gray-100" data-testid="trust-badges">
      {TRUST_BADGES.map((badge) => (
        <TrustBadge key={badge.id} badge={badge} />
      ))}
    </div>
  );
}

// Verified reviews badges
const VERIFIED_BADGES = [
  { id: 'verified-google', name: 'Google', rating: '4.8', reviews: '2.1K', color: 'bg-blue-50 text-blue-700' },
  { id: 'verified-amazon', name: 'Amazon', rating: '4.6', reviews: '890', color: 'bg-orange-50 text-orange-700' },
  { id: 'verified-trusted', name: 'Trustpilot', rating: '4.9', reviews: '1.5K', color: 'bg-green-50 text-green-700' },
];

const VerifiedReviewBadge = memo(({ badge }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${badge.color}`}>
    <CheckCircle size={14} />
    <span className="text-xs font-medium">{badge.name}</span>
    <span className="text-xs font-bold">{badge.rating}</span>
    <span className="text-xs opacity-70">({badge.reviews})</span>
  </div>
));
VerifiedReviewBadge.displayName = 'VerifiedReviewBadge';

function VerifiedReviewsBadges() {
  return (
    <div className="mb-5">
      <p className="text-xs text-gray-500 mb-2 font-medium">VERIFIED ON</p>
      <div className="flex flex-wrap gap-2">
        {VERIFIED_BADGES.map((badge) => (
          <VerifiedReviewBadge key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  );
}

export default memo(TrustBadges);
export { TrustBadge, TRUST_BADGES, VerifiedReviewsBadges, VERIFIED_BADGES };
