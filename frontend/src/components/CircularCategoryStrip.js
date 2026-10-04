import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cldOptim } from '../utils/productImage';

/**
 * CircularCategoryStrip — Flipkart-Minutes-style horizontal strip of circular tiles.
 *
 * @param items     [{ slug, name, image, icon, accent_from, accent_to, accent_text? }]
 * @param routePrefix  e.g. "/concern" or "/category"
 * @param title     Optional section title shown above the strip
 * @param subtitle  Optional sub-text under title
 * @param accent    Theme accent color for ring + arrows (e.g. "#16a34a", "#0891b2", "#be185d")
 * @param testIdPrefix  e.g. "skincare-concern", "cosmetics-cat"
 *
 * Behaviour:
 *  - On mobile: 4 circles per row (grid)
 *  - On ≥sm: horizontal scroll with previous/next arrows on hover
 *  - Each circle: gradient ring + image inside + label below
 */
export default function CircularCategoryStrip({ items, routePrefix, title, subtitle, accent = '#16a34a', testIdPrefix = 'cat-strip', onItemClick, activeSlug, eagerCount = 0, showImages = true, blankCircles = false }) {
  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({ canPrev: false, canNext: true });

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      canPrev: el.scrollLeft > 8,
      canNext: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  return (
    <section className="relative" data-testid={`${testIdPrefix}-strip`}>      {(title || subtitle) && (
        <div className="text-center mb-6 sm:mb-8">
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5" style={{ color: accent }}>
              {subtitle}
            </p>
          )}
          {title && (
            <h2 className="font-heading text-xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
              {title}
            </h2>
          )}
        </div>
      )}

      <div className="relative">
        {/* Prev arrow (desktop) */}
        <button
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          className={`hidden md:flex absolute -left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg ring-1 ring-gray-200 items-center justify-center transition-all ${scrollState.canPrev ? 'opacity-100 hover:scale-110' : 'opacity-0 pointer-events-none'}`}
          style={{ color: accent }}
        >
          <ChevronLeft size={18} />
        </button>
        {/* Next arrow (desktop) */}
        <button
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          className={`hidden md:flex absolute -right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg ring-1 ring-gray-200 items-center justify-center transition-all ${scrollState.canNext ? 'opacity-100 hover:scale-110' : 'opacity-0 pointer-events-none'}`}
          style={{ color: accent }}
        >
          <ChevronRight size={18} />
        </button>

        {/* Edge fade */}
        <div className="hidden sm:block absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-[1] pointer-events-none" />
        <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-[1] pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto hide-scrollbar scroll-smooth py-2 pb-3 sm:px-6 snap-x snap-mandatory"
        >
          {items.map((it, i) => {
            const fromColor = it.accent_from || '#dcfce7';
            const toColor = it.accent_to || '#bbf7d0';
            const eager = i < eagerCount;
            return (
              <CircleItem
                key={it.slug}
                item={it}
                routePrefix={routePrefix}
                fromColor={fromColor}
                toColor={toColor}
                accent={accent}
                testIdPrefix={testIdPrefix}
                onItemClick={onItemClick}
                isActive={activeSlug === it.slug}
                eager={eager}
                showImages={showImages}
                blankCircles={blankCircles}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}


function CircleItem({ item: it, routePrefix, fromColor, toColor, accent, testIdPrefix, onItemClick, isActive, eager = false, showImages = true, blankCircles = false }) {
  const [errored, setErrored] = useState(false);
  // Show the admin-uploaded image whenever one exists (so Shop-by-Concern /
  // Shop-by-Category circles update the moment an image is set in admin).
  // Fall back to a blank circle (blankCircles) or an icon only when there is
  // genuinely NO image for this item.
  const showFallback = !it.image || errored;

  // Inner visual content (shared by Link and button variants)
  const inner = (
    <>
      <div className="relative">
        <div
          className={`rounded-full p-[3px] transition-all duration-300 group-hover:scale-105 ${isActive ? 'ring-2 ring-offset-2' : ''}`}
          style={{ background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`, ...(isActive ? { '--tw-ring-color': accent } : {}) }}
        >
          <div className="rounded-full p-[2px] bg-white">
            <div
              className="w-[60px] h-[60px] sm:w-[88px] sm:h-[88px] md:w-[96px] md:h-[96px] rounded-full overflow-hidden relative flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)` }}
            >
              {showFallback ? (
                blankCircles ? null : (
                  <span className="text-2xl sm:text-3xl select-none" style={{ color: accent }}>
                    {it.icon || '✨'}
                  </span>
                )
              ) : (
                <img
                  src={cldOptim(it.image, {w:200})}
                  alt={it.name}
                  loading={eager ? 'eager' : 'lazy'}
                  fetchpriority={eager ? 'high' : 'auto'}
                  decoding="async"
                  onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                  onError={() => setErrored(true)}
                  className="w-full h-full object-cover transition-opacity duration-300 opacity-0 group-hover:scale-110"
                />
              )}
            </div>
          </div>
        </div>
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ring-2 ring-offset-2"
          style={{ '--tw-ring-color': accent, ringColor: accent }}
        />
      </div>
      <div className="mt-2 text-center w-full">
        <p className={`text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-tight line-clamp-2 min-h-[28px] ${isActive ? '' : 'text-gray-800 group-hover:text-gray-900'}`} style={isActive ? { color: accent } : undefined}>
          {it.name}
        </p>
        {it.tagline && (
          <p className="text-[9px] sm:text-[10px] text-gray-400 line-clamp-1 mt-0.5 hidden sm:block">
            {it.tagline}
          </p>
        )}
      </div>
    </>
  );

  // Inline filter mode — onItemClick callback (no navigation)
  if (typeof onItemClick === 'function') {
    return (
      <button
        type="button"
        onClick={() => onItemClick(it.slug)}
        className="group flex-shrink-0 flex flex-col items-center snap-start w-[72px] sm:w-[100px] md:w-[110px] focus:outline-none"
        data-testid={`${testIdPrefix}-${it.slug}`}
        aria-pressed={isActive}
      >
        {inner}
      </button>
    );
  }

  // Default — navigation Link
  return (
    <Link
      to={`${routePrefix}/${it.slug}`}
      className="group flex-shrink-0 flex flex-col items-center snap-start w-[72px] sm:w-[100px] md:w-[110px] focus:outline-none"
      data-testid={`${testIdPrefix}-${it.slug}`}
    >
      {inner}
    </Link>
  );
}
