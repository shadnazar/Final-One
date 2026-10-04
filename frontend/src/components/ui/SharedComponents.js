import React from 'react';
import { Star, Check, Shield, Truck, Clock } from 'lucide-react';

// Star Rating Component
export const StarRating = ({ rating = 5, size = 14, showCount = false, count = 0 }) => (
  <div className="flex items-center gap-2">
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star 
          key={`shared-star-${i}`} 
          size={size} 
          className={i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} 
        />
      ))}
    </div>
    {showCount && <span className="text-gray-500 text-sm">({count.toLocaleString()})</span>}
  </div>
);

// Checkmark List Item
export const CheckItem = ({ text, iconColor = 'text-green-600', bgColor = 'bg-green-100' }) => (
  <div className="flex items-center gap-3 text-sm">
    <div className={`w-5 h-5 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
      <Check size={12} className={iconColor} />
    </div>
    <span className="text-gray-700">{text}</span>
  </div>
);

// Trust Badge
export const TrustBadge = ({ icon: Icon, label, sublabel, iconColor = 'text-green-600', bgColor = 'bg-green-100' }) => (
  <div className="text-center">
    <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center mx-auto mb-1`}>
      <Icon size={18} className={iconColor} />
    </div>
    <p className="text-xs font-semibold text-gray-900">{label}</p>
    {sublabel && <p className="text-[10px] text-gray-500">{sublabel}</p>}
  </div>
);

// Price Display
export const PriceDisplay = ({ price, originalPrice, size = 'md', showSavings = false }) => {
  const sizes = {
    sm: { price: 'text-lg', original: 'text-sm', savings: 'text-xs' },
    md: { price: 'text-2xl', original: 'text-base', savings: 'text-sm' },
    lg: { price: 'text-3xl', original: 'text-lg', savings: 'text-sm' }
  };
  const s = sizes[size];

  return (
    <div className="flex items-baseline gap-2">
      <span className={`${s.price} font-bold text-green-600`}>₹{price}</span>
      {originalPrice && <span className={`${s.original} text-gray-400 line-through`}>₹{originalPrice}</span>}
      {showSavings && originalPrice && (
        <span className={`${s.savings} text-red-500 font-medium`}>Save ₹{originalPrice - price}</span>
      )}
    </div>
  );
};

// Section Header
export const SectionHeader = ({ title, subtitle, icon: Icon, iconColor = 'text-green-500' }) => (
  <div className="mb-4">
    <h3 className="font-bold text-gray-900 flex items-center gap-2">
      {Icon && <Icon size={18} className={iconColor} />}
      {title}
    </h3>
    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

// Loading Spinner
export const LoadingSpinner = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`${sizes[size]} border-2 border-green-200 border-t-green-600 rounded-full animate-spin`}></div>
  );
};

// Button Component
export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  fullWidth = false,
  className = ''
}) => {
  const variants = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        ${fullWidth ? 'w-full' : ''} 
        rounded-xl font-semibold transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
};

// Card Component
export const Card = ({ children, className = '', padding = 'p-4' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${padding} ${className}`}>
    {children}
  </div>
);

// Badge Component
export const Badge = ({ text, variant = 'success', size = 'sm' }) => {
  const variants = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700'
  };
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  return (
    <span className={`${variants[variant]} ${sizes[size]} font-medium rounded-full`}>
      {text}
    </span>
  );
};
