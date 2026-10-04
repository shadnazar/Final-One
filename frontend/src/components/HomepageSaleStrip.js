import React from 'react';
import { useSaleMode, isSaleOn } from '../utils/saleMode';
import { Flame, Clock, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Site-wide sale ribbon shown at the very top of the homepage / niche pages
 * whenever the admin has flipped the anti-aging Flat 50% switch ON.
 *
 * Click behaviour: if the current page already renders an anti-aging section
 * (niche-card, anti-aging landing, or the anti-aging tab of /shop), smooth-scroll
 * to it. Otherwise route to /anti-aging.
 */
export default function HomepageSaleStrip() {
  const sale = useSaleMode();
  const navigate = useNavigate();
  const loc = useLocation();
  if (!isSaleOn(sale, 'anti-aging')) return null;

  const handleClick = (e) => {
    e.preventDefault();
    // Try to scroll to an on-page anti-aging anchor first.
    const target =
      document.querySelector('[data-testid="anti-aging-landing-banner"]') ||
      document.querySelector('[data-testid="niche-card-anti-aging"]') ||
      document.querySelector('[data-testid="skincare-shop-by-category-section"]') ||
      document.querySelector('[data-shop-anti-aging]');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Otherwise route: from the homepage, /shop?niche=anti-aging is where
    // products actually live; other pages get the anti-aging landing.
    if (loc.pathname === '/') navigate('/shop?niche=anti-aging');
    else navigate('/anti-aging');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white overflow-hidden hover:brightness-110 transition"
      data-testid="homepage-sale-strip"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 flex-wrap text-center">
        <Flame size={16} className="text-yellow-200 shrink-0" />
        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">
          {sale.badge_label || 'FLAT 50% OFF'}
        </span>
        <span className="hidden sm:inline text-red-100">·</span>
        <span className="text-[11px] sm:text-sm text-red-100">
          {sale.banner_text || 'Anti-aging range — free shipping, ends soon'}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold ml-1">
          <Clock size={12} /> Ends soon
          <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}
