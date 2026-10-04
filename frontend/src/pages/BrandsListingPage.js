import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cachedGet } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCENTS = {
  skincare:    { c: '#0e7490', bg: '#cffafe', label: 'Skincare' },
  cosmetics:   { c: '#be185d', bg: '#fce7f3', label: 'Cosmetics' },
  'anti-aging':{ c: '#065f46', bg: '#d1fae5', label: 'Anti-Aging' },
};

/**
 * /brands?niche=<>  — full brand grid for one niche.
 * Tiles link to /brands/<slug> which lists every SKU of that brand.
 */
export default function BrandsListingPage() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const niche = params.get('niche') || 'skincare';
  const theme = ACCENTS[niche] || ACCENTS.skincare;
  const [data, setData] = useState({ brands: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedGet(`${API}/api/brands/public?niche=${niche}&limit=80`)
      .then(r => { if (!cancelled) { setData(r?.data || r || { brands: [] }); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [niche]);

  return (
    <div className="min-h-screen bg-white">
      <header
        className="pt-8 sm:pt-14 pb-6 sm:pb-10 px-4 sm:px-6"
        style={{ background: theme.bg }}
        data-testid="brands-listing-header"
      >
        <div className="max-w-7xl mx-auto">
          <p
            className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] uppercase mb-2"
            style={{ color: theme.c }}
          >
            {theme.label} · Shop by Brand
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black text-stone-900">
            Every house, <span style={{ color: theme.c }}>one shelf.</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-600 mt-3 max-w-xl">
            Browse {data?.brands?.length || 0} brands curated for {theme.label.toLowerCase()}. Tap a
            tile to see the full range.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 animate-pulse" />
            ))}
          </div>
        ) : (data?.brands || []).length === 0 ? (
          <div className="text-center py-20 text-sm text-stone-500">
            No brands available for this niche yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {data.brands.map(b => (
              <Link
                key={b.slug}
                to={`/brands/${b.slug}?niche=${niche}`}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 hover:ring-2 hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
                data-testid={`brand-card-${b.slug}`}
              >
                <div className="aspect-square flex items-center justify-center p-5" style={{ background: theme.bg }}>
                  {b.logo ? (
                    <img src={b.logo} alt={b.brand} loading="lazy" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="font-heading font-black text-xl text-center" style={{ color: theme.c }}>
                      {b.brand}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-stone-900 truncate">{b.brand}</p>
                  <p className="text-xs text-stone-500">{b.count} products</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
