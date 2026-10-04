import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Shop-by-Brand small banner — one horizontal rail per niche-home page.
 * Pulls top brands from `/api/brands/public?niche=<>` and renders pill-tiles
 * with logo + product count. Whole rail links to `/brands?niche=<>` and each
 * tile links to `/brands/<slug>` for the brand-detail page.
 *
 * Theme-matched: uses the niche's accent colour + the same rounded glass
 * cards the homepage already uses, so the banner reads as part of the page
 * rather than a bolt-on rail.
 */
export default function ShopByBrand({ niche, accent = '#0e7490', accentBg = '#cffafe' }) {
  const initial = peek(`${API}/api/brands/public?niche=${niche}`) || { brands: [] };
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial.brands?.length);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await cachedGet(`${API}/api/brands/public?niche=${niche}`);
        if (!cancelled) {
          // cachedGet returns {data, fromCache} — unwrap to the actual payload
          setData(res?.data || res || { brands: [] });
          setLoading(false);
        }
      } catch (_) {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [niche]);

  const brands = (data?.brands || []).filter(b => b && b.brand);
  if (!loading && brands.length < 3) return null; // not worth showing a rail

  return (
    <section
      className="py-6 sm:py-10"
      data-testid={`shop-by-brand-${niche}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-3 sm:mb-5">
          <div>
            <p
              className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] uppercase mb-1"
              style={{ color: accent }}
            >
              <Sparkles size={11} className="inline -mt-0.5 mr-1" /> Curated
            </p>
            <h2 className="font-heading text-xl sm:text-3xl font-black text-stone-900 leading-tight">
              Shop by <span style={{ color: accent }}>Brand</span>.
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Pick your favourite house — every SKU, in one place.
            </p>
          </div>
          <Link
            to={`/brands?niche=${niche}`}
            className="text-[11px] sm:text-xs font-bold hover:underline flex items-center gap-1 whitespace-nowrap"
            style={{ color: accent }}
            data-testid={`shop-by-brand-${niche}-view-all`}
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-28 sm:w-36 aspect-square rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-hide">
            {brands.map(b => (
              <Link
                key={b.slug}
                to={`/brands/${b.slug}?niche=${niche}`}
                className="group shrink-0 w-28 sm:w-36 aspect-square rounded-2xl bg-white ring-1 ring-stone-200 hover:ring-2 hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
                style={{ '--accent': accent }}
                data-testid={`brand-tile-${b.slug}`}
              >
                <div
                  className="flex-1 flex items-center justify-center p-3 sm:p-4"
                  style={{ background: accentBg }}
                >
                  {b.logo ? (
                    <img
                      src={b.logo}
                      alt={b.brand}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span
                      className="font-heading font-black text-base sm:text-lg text-center"
                      style={{ color: accent }}
                    >
                      {b.brand}
                    </span>
                  )}
                </div>
                <div className="p-2 sm:p-2.5 bg-white">
                  <p className="font-bold text-[11px] sm:text-xs text-stone-900 truncate">
                    {b.brand}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-stone-500">
                    {b.count} products
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
