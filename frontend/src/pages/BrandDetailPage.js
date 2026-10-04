import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { cachedGet } from '../utils/apiCache';
import { ProductCard } from './ConcernCategoryPage';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCENTS = {
  skincare:     { c: '#0e7490', bg: '#cffafe' },
  cosmetics:    { c: '#be185d', bg: '#fce7f3' },
  'anti-aging': { c: '#065f46', bg: '#d1fae5' },
};

/**
 * /brands/<slug> — brand detail page. Banner + every active SKU of the brand.
 */
export default function BrandDetailPage() {
  const { slug } = useParams();
  const loc = useLocation();
  const niche = (new URLSearchParams(loc.search)).get('niche') || 'skincare';
  const theme = ACCENTS[niche] || ACCENTS.skincare;
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      cachedGet(`${API}/api/brands/public/${slug}`).catch(() => null),
      // PERF: use the new server-side `brand` filter (Feb 2026) instead of
      // fetching 60 niche products and filtering client-side. The old
      // approach silently dropped 95% of multi-page brands (Fix Derma has
      // 99 products — only the first ~5-15 ever surfaced before).
      cachedGet(`${API}/api/products?brand=${slug}&limit=1000&sort=images_first`).catch(() => null),
    ]).then(([bRes, lRes]) => {
      if (cancelled) return;
      const b = bRes?.data || bRes;
      const list = lRes?.data || lRes;
      setBrand(b || { brand: slug, logo: null, banner: null });
      const items = Array.isArray(list) ? list : (list?.items || []);
      setProducts(items);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, niche]);

  if (!brand && !loading) {
    return <div className="p-10 text-center text-stone-500">Brand not found</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <header
        className="pt-8 sm:pt-14 pb-6 sm:pb-10 px-4 sm:px-6"
        style={brand?.banner ? { backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.85), ${theme.bg}), url(${brand.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: theme.bg }}
        data-testid="brand-detail-header"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4 sm:gap-6">
          {brand?.logo && (
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-white ring-1 ring-stone-200 p-2 sm:p-3 flex items-center justify-center shadow-sm">
              <img src={brand.logo} alt={brand.brand} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div>
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] uppercase mb-1" style={{ color: theme.c }}>
              Brand
            </p>
            <h1 className="font-heading text-3xl sm:text-5xl font-black text-stone-900">
              {brand?.brand || slug}
            </h1>
            {brand?.description && (
              <p className="text-sm text-stone-600 mt-2 max-w-xl">{brand.description}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <p className="text-xs sm:text-sm text-stone-500 mb-4">
          {loading ? 'Loading products…' : `${products.length} products`}
        </p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/5] rounded-3xl bg-gradient-to-br from-stone-100 to-stone-200 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-sm text-stone-500">
            No products listed for {brand?.brand} yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {products.map(p => <ProductCard key={p.slug} product={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
