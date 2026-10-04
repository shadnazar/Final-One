import React, { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { addToCart, setProductQty, getProductQty } from '../pages/Homepage';

/**
 * AddToBagButton
 * - Renders "Add to Bag" CTA when product not in cart.
 * - Switches to a quantity stepper (- N +) once added.
 * - Listens to `cartUpdated` events so it stays in sync everywhere.
 *
 * Variants:
 *  - "pill"  (default)  – rounded-full green pill, used on home/concern/category cards
 *  - "block"            – full-width block button, used on /shop grid
 */
export default function AddToBagButton({ slug, variant = 'pill', label = 'Add to Bag', isToBeLaunched = false }) {
  const [qty, setQty] = useState(0);

  const refresh = useCallback(() => setQty(getProductQty(slug)), [slug]);

  useEffect(() => {
    refresh();
    const onUpd = () => refresh();
    window.addEventListener('cartUpdated', onUpd);
    return () => window.removeEventListener('cartUpdated', onUpd);
  }, [refresh]);

  // TBL products are NEVER orderable — render a disabled informational pill.
  // Once admin flips is_to_be_launched=false the button automatically reverts
  // to the normal "Add to Bag" / quantity-stepper flow.
  if (isToBeLaunched) {
    if (variant === 'block') {
      return (
        <button
          disabled
          className="mt-auto w-full bg-stone-100 text-stone-500 text-xs font-black py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed tracking-[0.22em] ring-1 ring-stone-200"
          data-testid={`tbl-${slug}`}
        >
          <span>COMING SOON</span>
        </button>
      );
    }
    return (
      <button
        disabled
        className="flex-1 bg-stone-100 text-stone-500 text-[12px] sm:text-sm font-bold py-2.5 sm:py-3 rounded-full flex items-center justify-center gap-1.5 cursor-not-allowed tracking-wide ring-1 ring-stone-200"
        data-testid={`tbl-${slug}`}
      >
        <span>Coming soon</span>
      </button>
    );
  }

  if (qty === 0) {
    if (variant === 'block') {
      return (
        <button
          onClick={() => addToCart(slug)}
          className="mt-auto group/btn relative w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-green-700/20 hover:shadow-lg hover:shadow-green-700/35 hover:-translate-y-0.5"
          data-testid={`add-cart-${slug}`}
        >
          <ShoppingCart size={15} />
          <span className="tracking-wide">ADD TO CART</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => addToCart(slug)}
        className="flex-1 min-w-0 group/btn relative bg-green-600 hover:bg-green-700 text-white text-[11px] sm:text-sm font-bold px-2.5 py-2.5 sm:py-3 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-sm shadow-green-700/20 hover:shadow-md"
        data-testid={`add-cart-${slug}`}
      >
        <span className="tracking-tight sm:tracking-wide whitespace-nowrap truncate">{label}</span>
        <ShoppingCart size={12} className="shrink-0" />
      </button>
    );
  }

  // Quantity stepper
  if (variant === 'block') {
    return (
      <div
        className="mt-auto w-full grid grid-cols-3 items-stretch rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md shadow-green-700/20 overflow-hidden"
        data-testid={`qty-stepper-${slug}`}
      >
        <button
          onClick={() => setProductQty(slug, qty - 1)}
          className="py-3 hover:bg-white/10 transition-colors flex items-center justify-center"
          aria-label="Decrease quantity"
          data-testid={`qty-dec-${slug}`}
        >
          <Minus size={16} />
        </button>
        <div className="py-3 flex items-center justify-center font-black text-base" data-testid={`qty-value-${slug}`}>{qty}</div>
        <button
          onClick={() => setProductQty(slug, qty + 1)}
          className="py-3 hover:bg-white/10 transition-colors flex items-center justify-center"
          aria-label="Increase quantity"
          data-testid={`qty-inc-${slug}`}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-1 grid grid-cols-3 items-stretch rounded-full bg-green-600 text-white shadow-sm shadow-green-700/20 overflow-hidden"
      data-testid={`qty-stepper-${slug}`}
    >
      <button
        onClick={() => setProductQty(slug, qty - 1)}
        className="py-2.5 sm:py-3 hover:bg-green-700 transition-colors flex items-center justify-center"
        aria-label="Decrease quantity"
        data-testid={`qty-dec-${slug}`}
      >
        <Minus size={14} />
      </button>
      <div className="py-2.5 sm:py-3 flex items-center justify-center font-bold text-[13px] sm:text-sm" data-testid={`qty-value-${slug}`}>{qty}</div>
      <button
        onClick={() => setProductQty(slug, qty + 1)}
        className="py-2.5 sm:py-3 hover:bg-green-700 transition-colors flex items-center justify-center"
        aria-label="Increase quantity"
        data-testid={`qty-inc-${slug}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
