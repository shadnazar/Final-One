import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Expandable FAQ/Info Sections
export const ExpandableSection = ({ title, content, isExpanded, onToggle, icon: Icon }) => (
  <div className="border border-gray-100 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon size={18} className="text-green-600" />}
        <span className="font-medium text-gray-900 text-sm">{title}</span>
      </div>
      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
    </button>
    {isExpanded && (
      <div className="px-4 py-3 bg-white text-sm text-gray-600 leading-relaxed">
        {content}
      </div>
    )}
  </div>
);

// Checkout Form Input
export const FormInput = ({ label, name, type = 'text', value, onChange, error, placeholder, required = true }) => (
  <div>
    <label className="text-xs font-medium text-gray-700 mb-1 block">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all ${
        error ? 'border-red-300 bg-red-50' : 'border-gray-200'
      }`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

// Payment Method Selector
export const PaymentMethodSelector = ({ selected, onChange, prepaidPrice, codPrice, discountApplied, discountAmount, codAdvance }) => {
  const getFinalPrepaidPrice = () => prepaidPrice - (discountApplied ? discountAmount : 0);
  const getFinalCodPrice = () => codPrice - (discountApplied ? discountAmount : 0);

  return (
    <div className="space-y-2">
      {/* Prepaid Option */}
      <label
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
          selected === 'prepaid' ? 'border-green-500 bg-green-50' : 'border-gray-200'
        }`}
      >
        <input
          type="radio"
          name="paymentMethod"
          value="prepaid"
          checked={selected === 'prepaid'}
          onChange={() => onChange('prepaid')}
          className="w-4 h-4 text-green-600"
        />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">
            Pay Online {discountApplied && <span className="line-through text-gray-400">₹{prepaidPrice}</span>} ₹{getFinalPrepaidPrice()}
          </p>
          <p className="text-green-600 text-xs">💰 {discountApplied ? 'Extra ₹50 discount applied!' : `Save ₹${codPrice - prepaidPrice} + Fast Delivery`}</p>
        </div>
        {selected === 'prepaid' && (
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">Best Value</span>
        )}
      </label>

      {/* COD Option */}
      <label
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
          selected === 'cod' ? 'border-green-500 bg-green-50' : 'border-gray-200'
        }`}
      >
        <input
          type="radio"
          name="paymentMethod"
          value="cod"
          checked={selected === 'cod'}
          onChange={() => onChange('cod')}
          className="w-4 h-4 text-green-600"
        />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">
            Cash on Delivery {discountApplied && <span className="line-through text-gray-400">₹{codPrice}</span>} ₹{getFinalCodPrice()}
          </p>
          <p className="text-gray-500 text-xs">Pay ₹{Math.max(codAdvance - (discountApplied ? discountAmount : 0), 29)} now + ₹{getFinalCodPrice() - Math.max(codAdvance - (discountApplied ? discountAmount : 0), 29)} on delivery</p>
        </div>
      </label>
    </div>
  );
};

// Order Summary Box
export const OrderSummary = ({ prepaidPrice, getFinalPrice, discountApplied }) => (
  <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1.5">
    <div className="flex justify-between text-gray-600">
      <span>Product Price</span>
      <span className="line-through text-gray-400">₹1,499</span>
    </div>
    <div className="flex justify-between text-green-600">
      <span>Discount ({discountApplied ? '56%' : '53%'} OFF)</span>
      <span>- ₹{discountApplied ? 1499 - getFinalPrice() : 1499 - prepaidPrice}</span>
    </div>
    <div className="flex justify-between text-gray-600">
      <span>Shipping</span>
      <span className="text-green-600 font-medium">FREE ₹0</span>
    </div>
    <div className="flex justify-between text-gray-600">
      <span>Tax/GST</span>
      <span className="text-green-600 font-medium">Included ₹0</span>
    </div>
    <div className="h-px bg-gray-200 my-2"></div>
    <div className="flex justify-between font-bold text-gray-900 text-base">
      <span>Total</span>
      <span className="text-green-600">₹{getFinalPrice()}</span>
    </div>
  </div>
);
