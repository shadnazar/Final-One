import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * BeforeAfterCarousel — auto-swiping strip of customer transformation photos.
 *
 * Usage:
 *   <BeforeAfterCarousel />                       // global carousel (Homepage)
 *   <BeforeAfterCarousel productSlug="serum" />   // product-scoped (PDP)
 *
 * Supports 3 image shapes returned by /api/before-after:
 *   1. Single stitched B/A image  → doc.image
 *   2. Separate before / after     → doc.before_image + doc.after_image
 *
 * Auto-advances every 4 s, pauses on hover, and never renders when the shop
 * has no images on file (silent no-op).
 */
export default function BeforeAfterCarousel({
  productSlug,
  onlyGlobal = false,
  eyebrow = 'Real results · verified customers',
  title = 'Before & After',
  accent = '#0f766e',
}) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const url = productSlug
      ? `${API}/api/before-after/${productSlug}`
      : `${API}/api/before-after${onlyGlobal ? '?only_global=true' : ''}`;
    axios.get(url).then(r => {
      const data = Array.isArray(r.data) ? r.data : [];
      // Keep only usable rows
      const cleaned = data.filter(d => d.image || (d.before_image && d.after_image));
      setItems(cleaned);
    }).catch(() => setItems([]));
  }, [productSlug, onlyGlobal]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive(a => (a + 1) % items.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [items.length, paused]);

  if (!items.length) return null;

  const prev = () => setActive(a => (a - 1 + items.length) % items.length);
  const next = () => setActive(a => (a + 1) % items.length);

  return (
    <section
      className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12"
      data-testid={productSlug ? `pdp-before-after` : `home-before-after`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="text-center mb-5 sm:mb-7">
        <p
          className="text-[10px] sm:text-[11px] font-bold tracking-[0.35em] uppercase mb-1.5 inline-flex items-center gap-1.5"
          style={{ color: accent }}
        >
          <Sparkles size={12} /> {eyebrow}
        </p>
        <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 leading-tight">
          {title.split(' ').slice(0, -1).join(' ')}{' '}
          <span className="italic" style={{ color: accent }}>{title.split(' ').slice(-1)[0]}</span>
        </h2>
      </div>

      <div className="relative">
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-stone-100 ring-1 ring-stone-200 shadow-sm">
          {/* Slides */}
          {items.map((it, idx) => (
            <div
              key={`${it.ba_id || 'ba'}-${idx}`}
              className={`transition-opacity duration-700 ${idx === active ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
              data-testid={`ba-slide-${idx}`}
            >
              {it.image ? (
                <img
                  src={it.image}
                  alt={`Before and after transformation ${idx + 1}`}
                  className="w-full h-auto object-contain block bg-white"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                />
              ) : (
                <div className="grid grid-cols-2 gap-0.5 bg-stone-200">
                  <div className="relative bg-white">
                    <img src={it.before_image} alt="Before" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute top-3 left-3 bg-white/95 text-stone-900 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full ring-1 ring-stone-200 shadow-sm uppercase tracking-wider">Before</span>
                  </div>
                  <div className="relative bg-white">
                    <img src={it.after_image} alt="After" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute top-3 right-3 text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider" style={{ background: accent }}>After</span>
                  </div>
                </div>
              )}

              {/* Caption bar */}
              {(it.customer_name || it.duration || it.description) && (
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/60 via-black/30 to-transparent text-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    {it.customer_name && (
                      <span className="text-xs sm:text-sm font-bold">{it.customer_name}</span>
                    )}
                    {it.duration && (
                      <span className="text-[10px] sm:text-xs bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                        {it.duration}
                      </span>
                    )}
                    {it.description && (
                      <span className="text-[11px] sm:text-xs text-white/85 hidden sm:inline">— {it.description}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous transformation"
              data-testid="ba-prev"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1/2 hover:scale-105"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Next transformation"
              data-testid="ba-next"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1/2 hover:scale-105"
            >
              <ChevronRight size={18} />
            </button>

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActive(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  data-testid={`ba-dot-${idx}`}
                  className={`h-1.5 rounded-full transition-all ${idx === active ? 'w-6' : 'w-1.5 bg-stone-300'}`}
                  style={idx === active ? { background: accent } : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
