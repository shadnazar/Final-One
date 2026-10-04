import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, ChevronLeft, Sparkles, Star, Heart } from 'lucide-react';
import BackButton from '../components/BackButton';
import { resolveImageUrl } from '../utils/productImage';
import { getProductBrand } from '../utils/brand';
import AddToBagButton from '../components/AddToBagButton';
import SEOHead from '../components/SEOHead';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * CustomizeProductPage — "Choose Your Customized Product".
 *
 * Route: /customize/:slug   (slug = base product slug, e.g. celesta-glow-radiance-serum)
 *
 * Shows the MAIN product title once as the group heading, then every generated
 * variation (up to 24 = 2 genders x 3 skin types x 4 age groups) as sub-cards.
 * Each card overlays ONLY the descriptor part (for <Skin> Skin | <Concern> |
 * <Gender> <Age>) on the image — the full name lives in the heading above.
 * Section background is light blue.
 */
export default function CustomizeProductPage() {
  const { slug } = useParams();
  const [base, setBase] = useState(null);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      axios.get(`${API}/api/products/${slug}`).catch(() => ({ data: null })),
      axios.get(`${API}/api/products?generated_from=${encodeURIComponent(slug)}&limit=48`).catch(() => ({ data: null })),
    ]).then(([b, v]) => {
      if (cancelled) return;
      setBase(b.data || null);
      const list = Array.isArray(v.data) ? v.data : (v.data?.items || v.data?.products || []);
      setVariations(list);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const groupTitle = useMemo(() => {
    const n = base?.short_name || base?.name || 'Product';
    return /s$/i.test(n) ? n : `${n}s`;
  }, [base]);

  const brand = base ? getProductBrand(base) : 'Celesta Glow';

  return (
    <div className="min-h-screen bg-sky-50" data-testid="customize-product-page">
      <SEOHead title={`Choose Your ${groupTitle} | Celesta Glow`} description={base?.description} />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="mb-4"><BackButton /></div>

        {/* Group header */}
        <div className="text-center mb-8 sm:mb-10">
          {base?.images?.[0] && (
            <div className="mb-5 rounded-3xl overflow-hidden ring-1 ring-sky-100 bg-white max-w-3xl mx-auto" data-testid="customize-banner-image">
              <img
                src={resolveImageUrl(base.images[0])}
                alt={`${groupTitle} banner`}
                loading="eager"
                className="w-full h-36 sm:h-56 object-cover"
                onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
            </div>
          )}
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.32em] text-sky-700 uppercase mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={13} /> Choose your customized product
          </p>
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] text-sky-800/70 uppercase">{brand}</p>
          <h1 className="font-heading text-2xl sm:text-4xl font-black text-sky-950 leading-tight mt-1">
            {groupTitle}
          </h1>
          {base?.hero_line && (
            <p className="text-sm sm:text-base text-sky-800/80 mt-2 max-w-2xl mx-auto">{base.hero_line}</p>
          )}
          <p className="text-xs text-sky-700/70 mt-3">
            {variations.length > 0
              ? `${variations.length} personalised variation${variations.length > 1 ? 's' : ''} — pick the one made for you`
              : 'Personalised variations coming soon'}
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white/70 rounded-3xl h-72 animate-pulse ring-1 ring-sky-100" />
            ))}
          </div>
        )}

        {!loading && variations.length === 0 && base && (
          /* No variations generated yet — show the base product so the page is never empty */
          <div className="max-w-sm mx-auto">
            <VariationCard p={base} brand={brand} baseName={groupTitle.replace(/s$/, '')} />
          </div>
        )}

        {!loading && variations.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {variations.map((p) => (
              <VariationCard key={p.slug} p={p} brand={brand} baseName={groupTitle.replace(/s$/, '')} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Pastel colour per age band for the top-left chip
function ageChipClass(age) {
  const a = (age || '').toString();
  if (a.includes('18')) return 'bg-emerald-100 text-emerald-800';
  if (a.includes('25')) return 'bg-sky-100 text-sky-800';
  if (a.includes('35')) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function VariationCard({ p, brand, baseName }) {
  const img = resolveImageUrl((p.images && p.images[0]) || p.image);
  const price = p.prepaid_price || p.cod_price || p.mrp;
  const hasMrp = p.mrp && p.mrp > price;
  const discount = hasMrp ? Math.round((1 - price / p.mrp) * 100) : 0;
  const gender = p.target_gender ? p.target_gender.charAt(0).toUpperCase() + p.target_gender.slice(1) : '';
  const chip = [gender, p.target_age_group].filter(Boolean).join(' ');
  const subtitle = p.concern_label ? `For ${p.concern_label}` : (p.tagline || p.short_name || '');
  const reviews = p.reviews_count || 0;
  const rating = p.average_rating || 4.8;
  // Per-variation targeting badges (differ for every variation):
  //   skin type · concern · gender+age
  const badges = [
    p.target_skin_type ? { label: `${p.target_skin_type} Skin`, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' } : null,
    p.concern_label ? { label: p.concern_label, cls: 'bg-violet-50 text-violet-700 ring-violet-200' } : null,
    chip ? { label: chip, cls: 'bg-amber-50 text-amber-700 ring-amber-200' } : null,
  ].filter(Boolean);

  return (
    <div
      className="group relative bg-white rounded-3xl ring-1 ring-stone-200 hover:ring-emerald-300 overflow-hidden hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)] hover:-translate-y-1 transition-all duration-500 flex flex-col"
      data-testid={`variation-card-${p.slug}`}
    >
      {/* Image area — pure white so the bottle + serum drops float cleanly */}
      <Link to={`/product/${p.slug}`} className="block relative bg-white">
        {chip && (
          <span className={`absolute top-3 left-3 z-10 text-[10px] sm:text-[11px] font-black tracking-wide px-2.5 py-1 rounded-full ring-1 ring-white/70 shadow-sm ${ageChipClass(p.target_age_group)}`}>
            {chip}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 ring-1 ring-stone-200 flex items-center justify-center text-stone-400 hover:text-rose-500 transition-colors"
          aria-label="Save to wishlist"
        >
          <Heart size={15} />
        </button>
        <div className="aspect-square flex items-center justify-center p-4">
          {img ? (
            <img src={img} alt={subtitle} loading="lazy" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300"><Sparkles size={40} /></div>
          )}
        </div>
      </Link>

      <div className="px-3.5 sm:px-4 pb-4 pt-1 flex flex-col gap-1.5 flex-1">
        <p className="text-[10px] font-bold tracking-[0.24em] text-stone-400 uppercase">{brand}</p>
        <Link to={`/product/${p.slug}`} className="font-heading text-base sm:text-lg font-black text-stone-900 leading-tight hover:text-emerald-700 transition-colors">
          {baseName || p.short_name}
        </Link>
        {badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5" data-testid={`variation-badges-${p.slug}`}>
            {badges.map((b, i) => (
              <span key={i} className={`inline-flex items-center text-[9.5px] sm:text-[10.5px] font-black px-2 py-0.5 rounded-full ring-1 ${b.cls}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs mt-0.5">
          <Star size={13} className="fill-amber-400 text-amber-400" />
          <span className="font-bold text-stone-700">{rating}</span>
          <span className="text-stone-400">({reviews >= 1000 ? (reviews / 1000).toFixed(1) + 'K' : reviews} reviews)</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg sm:text-xl font-black text-stone-900">₹{price?.toLocaleString()}</span>
          {hasMrp && <span className="text-xs text-stone-400 line-through">₹{p.mrp?.toLocaleString()}</span>}
          {discount > 0 && <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{discount}% OFF</span>}
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex-1 min-w-0"><AddToBagButton slug={p.slug} /></div>
          <Link
            to={`/product/${p.slug}`}
            className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors"
            aria-label="View product"
          >
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
