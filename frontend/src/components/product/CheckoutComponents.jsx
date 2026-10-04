/**
 * Checkout Form Components - Extracted from ProductPage
 * Modular components for the checkout flow
 */
import React, { memo } from 'react';
import { Check, CreditCard, Truck, ChevronLeft, Shield, Clock, Gift, Phone } from 'lucide-react';

// Price Display Component
export const PriceDisplay = memo(function PriceDisplay({
  paymentMethod,
  prepaidPrice,
  codPrice,
  codAdvance,
  codBalance,
  mrp,
  hasDiscount,
  discountAmount,
  referralDiscount,
  getTotalDiscount
}) {
  const finalPrice = paymentMethod === 'prepaid' ? prepaidPrice : codPrice;
  const totalDiscount = getTotalDiscount ? getTotalDiscount() : (hasDiscount ? discountAmount : 0) + (referralDiscount || 0);
  
  return (
    <div className="bg-gray-50 rounded-xl p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600">MRP</span>
        <span className="text-gray-400 line-through">₹{mrp}</span>
      </div>
      
      {totalDiscount > 0 && (
        <div className="flex justify-between items-center mb-2 text-green-600">
          <span className="flex items-center gap-1">
            <Gift size={14} />
            Discount Applied
          </span>
          <span>-₹{totalDiscount}</span>
        </div>
      )}
      
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <span className="font-semibold text-gray-900">
          {paymentMethod === 'prepaid' ? 'Total' : 'Pay at Delivery'}
        </span>
        <span className="text-xl font-bold text-green-600">
          ₹{paymentMethod === 'prepaid' ? finalPrice : finalPrice}
        </span>
      </div>
    </div>
  );
});

// Payment Method Selector
export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  paymentMethod,
  setPaymentMethod,
  prepaidPrice,
  codAdvance,
  trackAction
}) {
  const handleChange = (method) => {
    setPaymentMethod(method);
    if (trackAction) {
      trackAction('payment_method_change', { method });
    }
  };

  return (
    <div className="space-y-3 mb-4">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
        <CreditCard size={18} className="text-green-500" />
        Payment Method
      </h4>
      
      {/* Prepaid Option */}
      <label 
        className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
          paymentMethod === 'prepaid' 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="payment"
              value="prepaid"
              checked={paymentMethod === 'prepaid'}
              onChange={() => handleChange('prepaid')}
              className="w-5 h-5 text-green-500"
            />
            <div>
              <span className="font-semibold text-gray-900">Pay Online</span>
              <p className="text-xs text-gray-500">UPI, Card, Net Banking</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-bold text-green-600">₹{prepaidPrice}</span>
            <p className="text-xs text-green-600">Save more!</p>
          </div>
        </div>
      </label>
      
      {/* COD Option */}
      <label 
        className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
          paymentMethod === 'cod' 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={paymentMethod === 'cod'}
              onChange={() => handleChange('cod')}
              className="w-5 h-5 text-green-500"
            />
            <div>
              <span className="font-semibold text-gray-900">Cash on Delivery</span>
              <p className="text-xs text-gray-500">Pay ₹{codAdvance} now, rest at delivery</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-700">₹{codAdvance}</span>
            <p className="text-xs text-gray-500">Advance</p>
          </div>
        </div>
      </label>
    </div>
  );
});

// Address Form Fields
export const AddressFormFields = memo(function AddressFormFields({
  formData,
  errors,
  handleFieldChange,
  handlePincodeChange,
  handlePhoneChange
}) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
            errors.name ? 'border-red-500' : 'border-gray-200'
          }`}
          placeholder="Enter your full name"
          data-testid="checkout-name"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>
      
      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Phone size={14} className="inline mr-1" />
          Mobile Number *
        </label>
        <div className="flex">
          <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl text-gray-500">
            +91
          </span>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handlePhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={`flex-1 px-4 py-3 border rounded-r-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
              errors.phone ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="10-digit mobile number"
            data-testid="checkout-phone"
          />
        </div>
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>
      
      {/* Email (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
            errors.email ? 'border-red-500' : 'border-gray-200'
          }`}
          placeholder="For order updates"
          data-testid="checkout-email"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>
      
      {/* House Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">House/Flat No. *</label>
        <input
          type="text"
          value={formData.house_number}
          onChange={(e) => handleFieldChange('house_number', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
            errors.house_number ? 'border-red-500' : 'border-gray-200'
          }`}
          placeholder="House no., Building name"
          data-testid="checkout-house"
        />
        {errors.house_number && <p className="text-red-500 text-xs mt-1">{errors.house_number}</p>}
      </div>
      
      {/* Area/Locality */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Area/Locality *</label>
        <input
          type="text"
          value={formData.area}
          onChange={(e) => handleFieldChange('area', e.target.value)}
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
            errors.area ? 'border-red-500' : 'border-gray-200'
          }`}
          placeholder="Street, Area, Landmark"
          data-testid="checkout-area"
        />
        {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area}</p>}
      </div>
      
      {/* Pincode & State */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
          <input
            type="text"
            value={formData.pincode}
            onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
              errors.pincode ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="6-digit"
            data-testid="checkout-pincode"
          />
          {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={formData.state}
            readOnly
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
            placeholder="Auto-detect"
            data-testid="checkout-state"
          />
        </div>
      </div>
    </div>
  );
});

// Checkout Header with Back Button
export const CheckoutHeader = memo(function CheckoutHeader({ onBack, orderCount }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
          data-testid="checkout-back-btn"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="font-bold text-gray-900">Checkout</h2>
        <div className="text-xs text-green-600 font-medium">
          <Shield size={14} className="inline mr-1" />
          Secure
        </div>
      </div>
      
      {/* Order Counter */}
      {orderCount > 0 && (
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-green-600">{orderCount}+</span> orders today
          </p>
        </div>
      )}
    </div>
  );
});

// Order Summary Card
export const OrderSummaryCard = memo(function OrderSummaryCard({ productImage }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-4">
        <img 
          src={productImage} 
          alt="Celesta Glow Serum" 
          className="w-20 h-20 object-contain rounded-lg bg-gray-50"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">Celesta Glow Anti-Aging Serum</h3>
          <p className="text-xs text-gray-500 mt-1">30ml | Premium Formula</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              <Truck size={10} className="inline mr-1" />
              Free Delivery
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              <Clock size={10} className="inline mr-1" />
              2-3 Days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Checkout Trust Badges
export const CheckoutTrustBadges = memo(function CheckoutTrustBadges() {
  return (
    <div className="flex items-center justify-center gap-4 py-4 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Shield size={14} className="text-green-500" />
        100% Secure
      </span>
      <span className="flex items-center gap-1">
        <Truck size={14} className="text-blue-500" />
        Free Shipping
      </span>
      <span className="flex items-center gap-1">
        <Check size={14} className="text-purple-500" />
        Easy Returns
      </span>
    </div>
  );
});
