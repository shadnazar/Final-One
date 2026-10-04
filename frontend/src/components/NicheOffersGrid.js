import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { cldOptim } from '../utils/productImage';
import { Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * NicheOffersGrid — compact "Mega Bash" offer strip.
 *
 * Redesign (Feb-2026): user asked to cut the section height in half and
 * turn the offers into a single running marquee row of product tiles.
 * The tall top-deal card, category tiles and cross-sell chips are gone;
 * only the branded header + running strip remain.
 */
export default function NicheOffersGrid({ niche = 'skin-care', categories: _cats = [], theme = 'auto' }) {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/products`, { params: { niche, limit: 60 } });
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
        if (!cancelled) {
          setProducts(items.filter((p) => p.is_active !== false));
          setLoaded(true);
        }
      } catch (_) {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [niche]);

  // Prefer discounted products first, then fall back to the cheapest picks so
  // the marquee is always populated even when the DB has no discounts yet.
  const marqueePicks = useMemo(() => {
    const discounted = products
      .filter((p) => p.mrp && p.prepaid_price && p.mrp > p.prepaid_price)
      .sort((a, b) => ((b.mrp - b.prepaid_price) / b.mrp) - ((a.mrp - a.prepaid_price) / a.mrp));
    const rest = products
      .filter((p) => !(p.mrp && p.prepaid_price && p.mrp > p.prepaid_price))
      .sort((a, b) => (a.prepaid_price || a.mrp || 999999) - (b.prepaid_price || b.mrp || 999999));
    return [...discounted, ...rest].slice(0, 12);
  }, [products]);

  const palette = resolveTheme(theme, niche);

  // Skeleton — while loading OR when we have zero products at all. Keeps the
  // section visible so the layout doesn't jump.
  if (!loaded || marqueePicks.length === 0) {
    return (
      <section
        data-testid={`niche-offers-grid-${niche}-skeleton`}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-4 sm:mb-6 ring-1 ring-black/5 shadow-md"
        style={{ background: palette.bg }}
      >
        <Header palette={palette} />
        <div className="relative px-3 sm:px-6 pt-2 pb-3 sm:pb-4">
          <div className="flex gap-2.5 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28 sm:w-32 h-24 sm:h-28 rounded-2xl bg-white/70 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Duplicate the list for a seamless CSS marquee loop.
  const track = [...marqueePicks, ...marqueePicks];

  return (
    <section
      data-testid={`niche-offers-grid-${niche}`}
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-4 sm:mb-6 ring-1 ring-black/5 shadow-md"
      style={{ background: palette.bg }}
    >
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <Sparkles className="absolute top-3 left-4 text-white/60" size={14} />
        <Sparkles className="absolute top-6 right-6 text-white/60" size={10} />
        <Sparkles className="absolute bottom-4 left-8 text-white/60" size={9} />
      </div>

      <Header palette={palette} />

      {/* Running marquee row */}
      <div className="relative px-3 sm:px-6 pb-3 sm:pb-4">
        <div
          className="overflow-hidden"
          style={{ maskImage: 'linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)' }}
        >
          <div
            className="flex gap-2.5 sm:gap-3 animate-[niche-strip-scroll_32s_linear_infinite]"
            style={{ width: 'max-content' }}
            onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = 'paused'; }}
            onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = 'running'; }}
            onTouchStart={(e) => { e.currentTarget.style.animationPlayState = 'paused'; }}
            onTouchEnd={(e) => { e.currentTarget.style.animationPlayState = 'running'; }}
          >
            {track.map((p, i) => (
              <OfferTile key={`${p.slug}-${i}`} product={p} palette={palette} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes niche-strip-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function Header({ palette }) {
  return (
    <div className="relative px-4 sm:px-6 pt-3 sm:pt-4 pb-1.5 text-center">
      <p className="text-[9px] sm:text-[10px] uppercase font-black tracking-[0.3em]" style={{ color: palette.headerAccent }}>
        Handpicked · This Week
      </p>
      <h2
        className="text-xl sm:text-3xl font-black italic leading-none mt-0.5"
        style={{ color: palette.headerText, fontFamily: '"Cormorant Garamond", serif', letterSpacing: '-0.01em' }}
      >
        {palette.title}
      </h2>
      <p className="text-[10px] sm:text-xs font-semibold mt-0.5" style={{ color: palette.subText }}>
        {palette.subtitle}
      </p>
    </div>
  );
}

function OfferTile({ product, palette }) {
  const img = product?.images?.[0] || product?.image;
  const hasDiscount = product.mrp && product.prepaid_price && product.mrp > product.prepaid_price;
  const pct = hasDiscount ? Math.round(((product.mrp - product.prepaid_price) / product.mrp) * 100) : 0;
  return (
    <Link
      to={`/product/${product.slug}`}
      className="flex-shrink-0 w-28 sm:w-32 bg-white rounded-2xl ring-1 ring-black/5 p-2 hover:shadow-md transition-all"
      data-testid={`offer-strip-item-${product.slug}`}
    >
      <div className="relative w-full h-16 sm:h-20 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden">
        {img && (
          <img
            src={cldOptim(img, { w: 240 })}
            alt={product.short_name || product.name}
            loading="lazy"
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
            className="w-full h-full object-contain opacity-0 transition-opacity duration-300"
          />
        )}
        {hasDiscount && (
          <span
            className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white shadow"
            style={{ background: palette.chipAccent }}
          >
            {pct}% OFF
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[10px] sm:text-[11px] font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.4em]">
        {product.short_name || product.name}
      </p>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-xs font-black" style={{ color: palette.headerText }}>₹{product.prepaid_price || product.mrp}</span>
        {hasDiscount && (
          <span className="text-[9px] text-gray-400 line-through">₹{product.mrp}</span>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Theming
// ─────────────────────────────────────────────────────────────────────────

function resolveTheme(theme, niche) {
  const key = String(theme === 'auto' ? niche : theme).toLowerCase();
  switch (key) {
    case 'skin-care':
    case 'skincare':
    case 'anti-aging':
    case 'anti_aging':
      return {
        bg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 45%, #14b8a6 100%)',
        headerAccent: '#134e4a',
        headerText: '#115e59',
        subText: '#0f766e',
        chipAccent: '#0d9488',
        chipBg: '#f0fdfa',
        chipText: '#134e4a',
        title: 'Mega Bash',
        subtitle: 'Top skin-care deals · This week only',
      };
    case 'cosmetics':
    case 'makeup':
      return {
        bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 45%, #f472b6 100%)',
        headerAccent: '#9f1239',
        headerText: '#9f1239',
        subText: '#be185d',
        chipAccent: '#db2777',
        chipBg: '#fdf2f8',
        chipText: '#9f1239',
        title: 'Beauty Bash',
        subtitle: 'Handpicked cosmetics · Up to 60% OFF',
      };
    default:
      return {
        bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 45%, #3b82f6 100%)',
        headerAccent: '#1e3a8a',
        headerText: '#1e3a8a',
        subText: '#1d4ed8',
        chipAccent: '#2563eb',
        chipBg: '#eff6ff',
        chipText: '#1e3a8a',
        title: 'Mega Bash',
        subtitle: 'Top deals · This week only',
      };
  }
}
