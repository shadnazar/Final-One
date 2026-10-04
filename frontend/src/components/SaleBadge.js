/**
 * SaleBadge — admin-configurable promotional banner for niche home pages.
 *
 * Backwards-compatible: accepts EITHER
 *   - `cfg.offers: [{...},{...}]`  (preferred, new)  → auto-rotating carousel
 *   - `cfg` legacy single-offer shape (text, sub_text, code…) → wrapped to a
 *     single-item carousel automatically.
 *
 * Features:
 *  - Auto left-swipe carousel: slides one offer to the next on a configurable
 *    interval (default 5s). Pauses on hover for accessibility.
 *  - Dots + prev/next arrows for manual navigation.
 *  - "Floating" placement (sticky bottom-right pill) is dismissible per niche
 *    (localStorage), inline placement is always visible.
 *  - Each offer has independent colours / text / coupon / CTA / icon.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X, Sparkles, Tag, Flame } from 'lucide-react';

const STORAGE_PREFIX = 'celesta:saleBadge:dismissed:';

const ICONS = { flame: Flame, tag: Tag, sparkles: Sparkles };
const pickIcon = (name) => ICONS[name] || Sparkles;

/** Normalise legacy single-offer config to {offers:[...]} */
function normaliseOffers(cfg) {
  if (!cfg) return null;
  if (Array.isArray(cfg.offers) && cfg.offers.length > 0) {
    return {
      enabled: cfg.enabled !== false,
      placement: cfg.placement === 'floating' ? 'floating' : 'inline',
      autoplay: cfg.autoplay !== false,
      interval_ms: Number(cfg.interval_ms) || 5000,
      offers: cfg.offers.filter(o => o && (o.text || o.sub_text)),
    };
  }
  // legacy single-offer
  if (cfg.text || cfg.sub_text) {
    return {
      enabled: cfg.enabled !== false,
      placement: cfg.placement === 'floating' ? 'floating' : 'inline',
      autoplay: cfg.autoplay !== false,
      interval_ms: Number(cfg.interval_ms) || 5000,
      offers: [{
        text: cfg.text || 'LIMITED-TIME OFFER',
        sub_text: cfg.sub_text || '',
        code: cfg.code || '',
        cta_label: cfg.cta_label || 'Shop now',
        cta_link: cfg.cta_link || '/shop',
        bg_from: cfg.bg_from || '#dc2626',
        bg_to: cfg.bg_to || '#7c2d12',
        text_color: cfg.text_color || '#ffffff',
        icon: cfg.icon || 'sparkles',
      }],
    };
  }
  return null;
}

/* ---------- A single offer card (used inside the carousel) ---------- */
function OfferCard({ offer, testIdPrefix, idx }) {
  const Icon = pickIcon(offer.icon);
  const bgFrom = offer.bg_from || '#dc2626';
  const bgTo = offer.bg_to || '#7c2d12';
  const textColor = offer.text_color || '#ffffff';
  return (
    <Link
      to={offer.cta_link || '/shop'}
      className="relative block w-full overflow-hidden"
      style={{
        background: `linear-gradient(120deg, ${bgFrom} 0%, ${bgTo} 100%)`,
        color: textColor,
      }}
      data-testid={`${testIdPrefix}-slide-${idx}`}
    >
      <span className="absolute inset-0 opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle at 12% 30%, rgba(255,255,255,0.55), transparent 55%), radial-gradient(circle at 88% 80%, rgba(255,255,255,0.3), transparent 55%)' }} />
      <div className="relative px-4 sm:px-7 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center ring-2 ring-white/40 backdrop-blur-sm flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase opacity-90 truncate">
              {offer.sub_text || 'LIMITED TIME'}
            </p>
            <p className="text-base sm:text-2xl font-black leading-tight tracking-tight">
              {offer.text || 'Special Offer'}
              {offer.code && (
                <span className="ml-2 inline-block align-middle px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-mono font-black bg-white/95"
                      style={{ color: bgFrom }}
                      data-testid={`${testIdPrefix}-code-${idx}`}>
                  {offer.code}
                </span>
              )}
            </p>
          </div>
        </div>
        <span
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white text-xs sm:text-sm font-black tracking-wider uppercase shadow-md"
          style={{ color: bgFrom }}
          data-testid={`${testIdPrefix}-cta-${idx}`}
        >
          {offer.cta_label || 'Shop now'} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}

export default function SaleBadge({ cfg, niche = 'skincare', testIdPrefix = 'sale-badge' }) {
  const data = useMemo(() => normaliseOffers(cfg), [cfg]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${niche}`;
  useEffect(() => {
    if (data?.placement === 'floating') {
      try { if (window.localStorage.getItem(storageKey) === '1') setDismissed(true); } catch { /* noop */ }
    }
  }, [data, storageKey]);

  const offers = data?.offers || [];
  const count = offers.length;
  const autoplay = data?.autoplay !== false;
  const intervalMs = Math.max(1500, Math.min(30000, data?.interval_ms || 5000));

  // Auto left-swipe
  useEffect(() => {
    if (!autoplay || paused || count <= 1) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [autoplay, paused, count, intervalMs]);

  // Clamp idx if offers shrink (e.g., admin removed one)
  useEffect(() => {
    if (idx >= count) setIdx(0);
  }, [count, idx]);

  if (!data || !data.enabled || count === 0 || dismissed) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(storageKey, '1'); } catch { /* noop */ }
    setDismissed(true);
  };

  /* === INLINE: full-width auto-rotating ribbon carousel === */
  if (data.placement === 'inline') {
    return (
      <div
        className="px-3 sm:px-6 pt-3 sm:pt-4 max-w-7xl mx-auto"
        data-testid={testIdPrefix}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/15">
          {/* Track: each slide is full-width, translateX(-idx*100%) */}
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {offers.map((o, i) => (
              <div key={i} className="w-full flex-shrink-0">
                <OfferCard offer={o} testIdPrefix={testIdPrefix} idx={i} />
              </div>
            ))}
          </div>

          {/* Controls (only render when >1 offer) */}
          {count > 1 && (
            <>
              {/* Dots */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {offers.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Go to offer ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
                    data-testid={`${testIdPrefix}-dot-${i}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* === FLOATING: sticky bottom-right dismissible carousel === */
  const current = offers[idx] || offers[0];
  const Icon = pickIcon(current.icon);
  const bgFrom = current.bg_from || '#dc2626';
  const bgTo = current.bg_to || '#7c2d12';
  const textColor = current.text_color || '#ffffff';
  return (
    <div
      className="hidden sm:block fixed z-40 bottom-6 right-6 max-w-[320px]"
      data-testid={testIdPrefix}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20 transition-colors duration-500"
        style={{ background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`, color: textColor }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center z-10"
          data-testid={`${testIdPrefix}-dismiss`}
        >
          <X size={12} />
        </button>
        <span className="absolute inset-0 opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle at 15% 25%, rgba(255,255,255,0.55), transparent 55%)' }} />
        <Link to={current.cta_link || '/shop'} className="relative block p-4 pr-9" key={idx /* re-mount on slide for subtle fade */}>
          <div className="flex items-center gap-3 animate-[fadeIn_0.6s_ease]">
            <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center ring-2 ring-white/30 flex-shrink-0">
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black tracking-[0.28em] uppercase opacity-85">{current.sub_text || 'OFFER'}</p>
              <p className="text-base font-black leading-tight">{current.text}</p>
              {current.code && (
                <p className="mt-1.5 text-[11px] opacity-95">
                  Use code <span className="px-1.5 py-0.5 rounded-md font-mono font-black bg-white/95 text-[10px]" style={{ color: bgFrom }}>{current.code}</span>
                </p>
              )}
            </div>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-black tracking-wider uppercase opacity-90">
            {current.cta_label || 'Shop now'} <ArrowRight size={11} />
          </span>
        </Link>
        {count > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {offers.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`h-1 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1 bg-white/45'}`}
                aria-label={`Offer ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
