import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Flame, Sparkles } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import TrustStrip from '../components/TrustStrip';
import NicheHero from '../components/NicheHero';
import HeroCarousel from '../components/HeroCarousel';
import CircularCategoryStrip from '../components/CircularCategoryStrip';
import CategoryShowcase from '../components/CategoryShowcase';
import CosmeticsCategoryHub from '../components/CosmeticsCategoryHub';
import ShopByBrand from '../components/ShopByBrand';
import { DermatologistSection, FaqSection } from '../components/NicheSections';
import ReviewsCarousel from '../components/ReviewsCarousel';
import TrendingLooks from '../components/TrendingLooks';
import SaleBadge from '../components/SaleBadge';
import NicheOffersGrid from '../components/NicheOffersGrid';
import { ProductCard } from './ConcernCategoryPage';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;
const FALLBACK = {
  hero: {
    image_desktop: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1664&q=80',
    image_mobile: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    eyebrow: 'Cosmetics',
    title_line1: 'Beauty meets',
    title_line2: 'skincare actives.',
    subtitle: 'Buildable colour, weightless wear, skin-loving actives. Pick your category and shop the look.',
    cta1_label: 'Shop categories', cta1_link: '/shop?niche=cosmetics',
    cta2_label: 'Free Skin Analysis', cta2_link: '/consultation',
    accent: '#be185d', accent_dark: '#831843', accent_bg: '#fce7f3',
  },
  bestsellers: { enabled: true, eyebrow: 'Most-loved', title_prefix: 'Makeup', title_highlight: 'Bestsellers', limit: 0, sort_by: 'reviews_count' },
  cta_section: { enabled: true, eyebrow: 'Complete the look', title: 'Glow + Color in one routine.', subtitle: 'Pair our skincare actives with our makeup for a healthy-skin finish.', button_label: 'Start Routine Builder', button_link: '/routine', bg_from: '#be185d', bg_via: '#9d174d', bg_to: '#831843' },
  show_category_strip: true,
  category_strip_title: 'Shop by Category',
  category_strip_subtitle: 'Lip · Eye · Brow · Face',
};

export default function CosmeticsHome() {
  // Show only 20 products on the niche home. Full catalog at /shop?niche=cosmetics.
  const _raw = peek(`${API}/api/products?niche=cosmetics&page=1&limit=20`) || peek(`${API}/api/products?niche=cosmetics&page=1&limit=48`) || [];
  const _cp = Array.isArray(_raw) ? _raw : (_raw?.items || []);
  const _cc = peek(`${API}/api/categories?niche=cosmetics`) || peek(`${API}/api/categories`) || [];
  const _cs = peek(`${API}/api/site-settings`) || {};
  const _concerns = peek(`${API}/api/concerns`) || [];
  const [products, setProducts] = useState(_cp);
  const _cosmeticsOnly = (_cc || []).filter(x => x.niche === 'cosmetics' || x.group === 'cosmetics');
  const [categories, setCategories] = useState(
    _cosmeticsOnly.map(x => ({
      ...x,
      accent_from: x.accent_from || '#fce7f3',
      accent_to: x.accent_to || '#fbcfe8',
      accent_text: x.accent_text || '#831843',
    }))
  );
  const [concerns, setConcerns] = useState(_concerns.filter(x => x.niche === 'cosmetics'));
  const [settings, setSettings] = useState(_cs);
  const [loading, setLoading] = useState(_cp.length === 0);

  useEffect(() => {
    const ctrl = new AbortController();
    const sig = ctrl.signal;

    // 1) Taxonomy first — categories + concerns + settings render immediately
    Promise.all([
      cachedGet(`${API}/api/categories?niche=cosmetics`, { signal: sig }),
      cachedGet(`${API}/api/site-settings`, { signal: sig }),
      cachedGet(`${API}/api/concerns`, { signal: sig }),
    ])
      .then(([c, s, cn]) => {
        if (sig.aborted) return;
        setCategories((c.data || [])
          .filter(x => x.niche === 'cosmetics' || x.group === 'cosmetics')
          .map(x => ({
            ...x,
            accent_from: x.accent_from || '#fce7f3',
            accent_to: x.accent_to || '#fbcfe8',
            accent_text: x.accent_text || '#831843',
          }))
        );
        setConcerns((cn.data || []).filter(x => x.niche === 'cosmetics'));
        setSettings(s.data || {});
      })
      .catch(() => {});

    // 2) Products second — 20 only
    cachedGet(`${API}/api/products?niche=cosmetics&page=1&limit=20`, { signal: sig })
      .then((p) => {
        if (sig.aborted) return;
        const items = Array.isArray(p.data) ? p.data : (p.data?.items || []);
        setProducts(items);
      })
      .catch(() => {})
      .finally(() => { if (!sig.aborted) setLoading(false); });

    return () => { ctrl.abort(); };
  }, []);

  const niche = (settings?.niche_settings && settings.niche_settings['cosmetics']) || FALLBACK;
  const hero = niche.hero || FALLBACK.hero;
  const bs = niche.bestsellers || FALLBACK.bestsellers;
  const ctaCfg = niche.cta_section || FALLBACK.cta_section;
  const accent = hero.accent || FALLBACK.hero.accent;
  const accentDark = hero.accent_dark || FALLBACK.hero.accent_dark;
  const accentBg = hero.accent_bg || FALLBACK.hero.accent_bg;

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    const by = bs.sort_by || 'reviews_count';
    // Stable tie-breaker chain: when the primary key ties (e.g. all products
    // have 0 reviews), fall back to admin sort_order, then to slug. This kills
    // the "random / shuffled order" bug on the Cosmetics home grid.
    const tieBreak = (a, b) =>
      ((a.sort_order ?? 99) - (b.sort_order ?? 99)) ||
      String(a.slug || '').localeCompare(String(b.slug || ''));
    if (by === 'reviews_count') {
      arr.sort((a, b) => ((b.reviews_count || 0) - (a.reviews_count || 0)) || tieBreak(a, b));
    } else if (by === 'rating') {
      arr.sort((a, b) => ((b.rating || 0) - (a.rating || 0)) || tieBreak(a, b));
    } else if (by === 'price_asc') {
      arr.sort((a, b) => ((a.prepaid_price || 0) - (b.prepaid_price || 0)) || tieBreak(a, b));
    } else if (by === 'price_desc') {
      arr.sort((a, b) => ((b.prepaid_price || 0) - (a.prepaid_price || 0)) || tieBreak(a, b));
    } else {
      arr.sort(tieBreak);
    }
    // Always show every product in the niche so newly added admin products are immediately visible.
    return arr;
  }, [products, bs.sort_by]);

  return (
    <div className="bg-gradient-to-b from-rose-50/30 via-white to-stone-50/40" data-testid="cosmetics-home">
      <SearchBar accent={accent} niche="cosmetics" testId="cosmetics-search-bar" />

      <SaleBadge cfg={niche.sale_badge} niche="cosmetics" testIdPrefix="cosmetics-sale-badge" />

      {/* Editorial-style "Beauty Bash" offer grid — Top Deal + category tiles
          with Up to X% OFF pills + cross-sell chips. */}
      <section className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
          <NicheOffersGrid niche="cosmetics" categories={categories} theme="cosmetics" />
        </div>
      </section>

      {niche.show_category_strip !== false && (
        <section className="bg-white border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <CircularCategoryStrip
              items={categories.filter(c => !c.is_parent && c.parent === 'face-makeup')}
              routePrefix="/category"
              title={<>{(niche.category_strip_title || 'Shop by Face').split(' ').slice(0, -1).join(' ')} <span className="italic" style={{ color: accent }}>{(niche.category_strip_title || 'Shop by Face').split(' ').slice(-1)[0]}</span></>}
              subtitle={niche.category_strip_subtitle || 'Primer · Foundation · Concealer · Blush · Highlighter'}
              accent={accent}
              testIdPrefix="cosmetics-cat"
              eagerCount={6}
            />
          </div>
        </section>
      )}

      {/* Shop by Look (cosmetic concerns) — moved off the home page; users
          access this via Categories → drilldown chips on the category detail
          page instead. Toggleable via niche.show_concerns_strip if the
          merchant ever wants to surface it on home again. */}
      {concerns.length > 0 && niche.show_concerns_strip === true && (
        <section className="bg-stone-50 border-b border-stone-100" data-testid="cosmetics-concerns-strip">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <CircularCategoryStrip
              items={concerns}
              routePrefix="/concern"
              title={<>Shop by <span className="italic" style={{ color: accent }}>Look</span></>}
              subtitle="Full Coverage · Bridal · Long Wear · Everyday"
              accent={accent}
              testIdPrefix="cosmetics-concerns"
            />
          </div>
        </section>
      )}

      {/* Shop by Brand small banner — placed ABOVE the niche hero banner */}
      <ShopByBrand niche="cosmetics" accent={accentDark} accentBg={'#fce7f3'} />

      <NicheHero
        bgImage={hero.image_desktop}
        mobileBgImage={hero.image_mobile}
        eyebrow={hero.eyebrow}
        eyebrowDot={accent}
        eyebrowText={accentDark}
        title={<>{hero.title_line1}<br /><span className="italic font-light" style={{ color: accentDark }}>{hero.title_line2}</span></>}
        subtitle={hero.subtitle}
        cta1={{ label: hero.cta1_label, to: hero.cta1_link }}
        cta2={{ label: hero.cta2_label, to: hero.cta2_link }}
        accent={accent}
        accentDark={accentDark}
        testId="cosmetics-hero"
      />

      <div className="pt-4 sm:pt-7">
        <TrustStrip accent={accent} accentBg={accentBg} />
      </div>

      {/* Shop by Shade removed per spec — shade selection lives on individual product pages. */}

      {/* Per-niche banner carousel */}
      {(() => {
        const banners = (Array.isArray(niche.banner_carousel) && niche.banner_carousel.length > 0)
          ? niche.banner_carousel
          : [];
        const autoplay = niche.carousel_autoplay_ms || 2000;
        const sorted = [...banners].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        if (sorted.length === 0) return null;
        return (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-5 sm:mt-7">
            <HeroCarousel banners={sorted} autoplayMs={autoplay} className="rounded-2xl sm:rounded-3xl ring-1 ring-stone-200/70" />
          </div>
        );
      })()}

      {/* Shop by Category — Build your look. Placed ABOVE bestsellers so users
          can pick a face/lips/eyes/nails category before browsing curated picks. */}
      <CosmeticsCategoryHub
        categories={categories}
        virtualGroups={[
          { slug: 'face-makeup',   name: 'Face',           children: ['face-primer', 'concealer', 'foundation', 'compact', 'contour', 'loose-powder', 'blush', 'bb-cc-cream', 'highlighter', 'setting-spray', 'makeup-remover', 'tinted-moisturizer', 'bronzer'], sort_order: 1 },
          { slug: 'lips',          name: 'Lips',           children: ['lipstick', 'liquid-lipstick', 'lip-crayon', 'lip-gloss', 'lip-liner', 'lip-tint'], sort_order: 2 },
          { slug: 'eyes',          name: 'Eyes',           children: ['kajal', 'eyeliner', 'mascara', 'eye-shadow', 'eye-brow', 'false-lashes'], sort_order: 3 },
          { slug: 'nails',         name: 'Nails',          children: ['nail-polish'], sort_order: 4 },
          { slug: 'tools-brushes', name: 'Tools & Brushes',children: ['makeup-brush', 'beauty-sponge', 'tools-accessories'], sort_order: 5 },
          { slug: 'makeup-kits',   name: 'Kits & Combos',  children: [], sort_order: 6 },
        ]}
        eyebrow="Shop the full range"
        title="Pick a category."
        subtitle="Face · Lips · Eyes · Nails · Tools · Kits — every subcategory, every shade, in one tap."
        accentColor={accentDark}
        testIdPrefix="cosmetics-hub"
      />

      {/* Shop by Brand moved up (above NicheHero banner) — see top of page. */}

      {bs.enabled !== false && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
          <div className="flex items-end justify-between mb-4 sm:mb-6 px-1 sm:px-0">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 sm:mb-1.5 flex items-center gap-2" style={{ color: accent }}>
                <Flame size={11} style={{ fill: accent, color: accent }} /> {bs.eyebrow}
              </p>
              <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
                {bs.title_prefix} <span className="italic" style={{ color: accent }}>{bs.title_highlight}</span>
              </h2>
            </div>
            <Link to="/shop?niche=cosmetics" className="text-[11px] sm:text-xs font-bold hover:underline flex items-center gap-1" style={{ color: accent }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="aspect-[3/5] bg-gradient-to-br from-rose-100 to-pink-100 rounded-3xl" />)}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500 ring-1 ring-rose-100">No bestsellers yet — check back soon.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
              {sortedProducts.map(p => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}
        </section>
      )}

      {/* Shop by Category hub now rendered ABOVE bestsellers (see top section). */}

      {/* Legacy category showcase kept off by default — admin can re-enable via niche.show_category_showcase=true */}
      {niche.show_category_showcase === true && (
        <CategoryShowcase
          categories={categories}
          products={products}
          niche="cosmetics"
          accent={accent}
          accentBg="#fce7f3"
          testIdPrefix="cosmetics-category-showcase"
          enabled={true}
          title={niche.category_showcase_title || 'Shop by Category'}
          subtitle={niche.category_showcase_subtitle || "Find what you're looking for"}
          highlight={niche.category_showcase_highlight || 'looking for'}
          banner={niche.category_showcase_banner || null}
          headerImage={niche.category_showcase_header_image || null}
        />
      )}

      {/* Trending Looks — Bridal / Everyday / Bold / Office (admin can hide) */}
      {niche.show_trending_looks === true && <TrendingLooks accent={accent} />}

      {niche.show_reviews && <ReviewsCarousel title={niche.reviews_title || 'What our community says'} eyebrow={niche.reviews_eyebrow || 'Real reviews · Verified buyers'} />}
      {niche.show_dermatologist && (
        <DermatologistSection
          accent={accent}
          accentDark={accentDark}
          cfg={{
            eyebrow: 'Pro Makeup Artist approved',
            title_part1: 'Curated with',
            title_highlight: 'celebrity makeup artists',
            title_suffix: ' for Indian skin tones.',
            body: 'Every shade and finish is tested by working makeup artists who shoot Indian brides, editorial covers and celebrity reels — so your makeup looks flawless on camera AND in real life, in humidity, AC and harsh flash.',
            stats: [
              { num: '24', label: 'Shades for Indian undertones' },
              { num: '12h', label: 'Long-wear in humidity' },
              { num: '100%', label: 'Non-comedogenic & cruelty-free' },
            ],
            cta_label: 'Get a shade match',
            cta_link: '/consultation',
            image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80',
            ...(niche.dermatologist || {}),
          }}
        />
      )}
      {/* FAQ — always shown, auto-generated by AI for in-depth answers */}
      <FaqSection accent={accent} faqs={niche.faqs} title={niche.faq_title} eyebrow={niche.faq_eyebrow} niche="cosmetics" />

      {ctaCfg.enabled !== false && (
        <section className="relative overflow-hidden" style={{ background: `linear-gradient(to right, ${ctaCfg.bg_from || '#be185d'}, ${ctaCfg.bg_via || '#9d174d'}, ${ctaCfg.bg_to || '#831843'})` }}>
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] text-white/70 uppercase mb-2">{ctaCfg.eyebrow}</p>
            <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-2">{ctaCfg.title}</h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl mx-auto mb-4 sm:mb-5">{ctaCfg.subtitle}</p>
            <Link to={ctaCfg.button_link || '/routine'} className="inline-flex items-center gap-2 bg-white hover:bg-rose-50 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-2xl hover:-translate-y-0.5 transition-all" style={{ color: accentDark }}>
              <Sparkles size={13} style={{ color: accent }} /> {ctaCfg.button_label} <ChevronRight size={13} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
