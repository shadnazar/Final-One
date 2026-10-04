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
import IngredientSpotlight from '../components/IngredientSpotlight';
import SaleBadge from '../components/SaleBadge';
import NicheOffersGrid from '../components/NicheOffersGrid';
import { ProductCard } from './ConcernCategoryPage';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;
const FALLBACK = {
  hero: {
    image_desktop: 'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/v5vv0e5r_546BA64A-4E90-4675-B7DB-3D2EFDB10675.png',
    image_mobile: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80',
    eyebrow: 'Skincare',
    title_line1: 'Skincare for every',
    title_line2: 'skin type & concern.',
    subtitle: "From acne to dullness, dryness to dark spots — pick your concern and we'll show you the routine.",
    cta1_label: 'Pick your concern', cta1_link: '/shop?niche=skincare',
    cta2_label: 'Shop With AI', cta2_link: '/routine',
    accent: '#0e7490', accent_dark: '#155e75', accent_bg: '#cffafe',
  },
  bestsellers: { enabled: true, eyebrow: 'Trending now', title_prefix: 'Skincare', title_highlight: 'Bestsellers', limit: 0, sort_by: 'reviews_count' },
  cta_section: { enabled: true, eyebrow: 'Build your routine', title: 'Not sure where to start?', subtitle: "Take the 2-minute Skin Analysis and we'll build a personalized routine.", button_label: 'Start Routine Builder', button_link: '/routine', bg_from: '#0e7490', bg_via: '#155e75', bg_to: '#115e59' },
  show_concern_strip: true,
  concern_strip_title: 'Shop by Concern',
  concern_strip_subtitle: 'Pick your skin problem',
};

export default function SkincareHome() {
  // Show only the first 20 products on the niche home (curated bestsellers section).
  // The full catalog lives at /shop?niche=skincare with infinite scroll. Loading
  // 48+ here on every niche switch was burning bandwidth and freezing low-end devices.
  const _raw = peek(`${API}/api/products?niche=skincare&page=1&limit=20`) || peek(`${API}/api/products?niche=skincare&page=1&limit=48`) || [];
  const _cp = Array.isArray(_raw) ? _raw : (_raw?.items || []);
  const _cc = peek(`${API}/api/concerns`) || [];
  const _cs = peek(`${API}/api/site-settings`) || {};
  const _cat = peek(`${API}/api/categories`) || [];
  const [products, setProducts] = useState(_cp);
  const [concerns, setConcerns] = useState(_cc);
  const [settings, setSettings] = useState(_cs);
  const [categories, setCategories] = useState(_cat);
  const [shopByCategoryTiles, setShopByCategoryTiles] = useState([]);
  const [loading, setLoading] = useState(_cp.length === 0);

  useEffect(() => {
    // AbortController kills in-flight requests when the user rapidly switches niche,
    // so the latest niche's data isn't blocked by stale earlier requests.
    const ctrl = new AbortController();
    const sig = ctrl.signal;

    // ---- 1) Taxonomy first (concerns + categories + settings) ----
    Promise.all([
      cachedGet(`${API}/api/concerns`, { signal: sig }).catch(() => ({ data: [] })),
      cachedGet(`${API}/api/site-settings`, { signal: sig }).catch(() => ({ data: {} })),
      cachedGet(`${API}/api/categories`, { signal: sig }).catch(() => ({ data: [] })),
    ])
      .then(([c, s, cats]) => {
        if (sig.aborted) return;
        setConcerns(c.data || []);
        setSettings(s.data || {});
        setCategories(cats.data || []);
      })
      .catch(() => { /* aborted or network — swallow */ });

    // ---- 1b) Shop-by-category tiles fetched separately so a failure in the
    //      taxonomy chain above can never prevent the tiles from rendering. ----
    cachedGet(`${API}/api/shop-by-category?niche=skincare`, { signal: sig, force: true })
      .then((sbc) => {
        if (sig.aborted) return;
        const arr = Array.isArray(sbc.data) ? sbc.data : (sbc.data?.items || []);
        setShopByCategoryTiles(arr);
      })
      .catch(() => { /* ignore */ });

    // ---- 2) Products after (only 20 — the rest lives at /shop) ----
    cachedGet(`${API}/api/products?niche=skincare&page=1&limit=20`, { signal: sig })
      .then((p) => {
        if (sig.aborted) return;
        const items = Array.isArray(p.data) ? p.data : (p.data?.items || []);
        setProducts(items);
      })
      .catch(() => { /* aborted */ })
      .finally(() => { if (!sig.aborted) setLoading(false); });

    return () => { ctrl.abort(); };
  }, []);

  const niche = (settings?.niche_settings && settings.niche_settings['skincare']) || FALLBACK;
  const hero = niche.hero || FALLBACK.hero;
  const bs = niche.bestsellers || FALLBACK.bestsellers;
  const ctaCfg = niche.cta_section || FALLBACK.cta_section;
  const accent = hero.accent || FALLBACK.hero.accent;
  const accentDark = hero.accent_dark || FALLBACK.hero.accent_dark;
  const accentBg = hero.accent_bg || FALLBACK.hero.accent_bg;

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    const by = bs.sort_by || 'reviews_count';
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

  // Filter concerns to skincare niche only
  const skincareConcerns = useMemo(
    () => concerns.filter(c => !c.niche || c.niche === 'skincare'),
    [concerns]
  );

  return (
    <div className="bg-stone-50/40" data-testid="skincare-home">
      <SearchBar accent={accent} niche="skincare" testId="skincare-search-bar" />

      <SaleBadge cfg={niche.sale_badge} niche="skincare" testIdPrefix="skincare-sale-badge" />

      {/* Editorial-style "Glow Bash" offer grid — Top Deal + category tiles with
          Up to X% OFF badges + cross-sell chips. Mirrors the anti-aging landing
          in structure but keeps the skincare palette. Only renders once at least
          one active product is loaded. */}
      <section className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
          <NicheOffersGrid niche="skincare" categories={categories} theme="skincare" />
        </div>
      </section>

      {niche.show_concern_strip !== false && (
        <section className="bg-white border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <CircularCategoryStrip
              items={skincareConcerns}
              routePrefix="/concern"
              title={<>{(niche.concern_strip_title || 'Shop by Concern').split(' ').slice(0, -1).join(' ')} <span className="italic" style={{ color: accent }}>{(niche.concern_strip_title || 'Shop by Concern').split(' ').slice(-1)[0]}</span></>}
              subtitle={niche.concern_strip_subtitle || 'Pick your skin problem'}
              accent={accent}
              testIdPrefix="skincare-concern"
              eagerCount={6}
            />
          </div>
        </section>
      )}

      {/* Shop by Category tiles — admin-managed via /admin/shop-by-category.
          Each tile has its OWN image (independent from the category image
          used on /categories) so admin can showcase different product-type
          artwork here. Skincare-niche only. */}
      {(() => {
        const manual = (Array.isArray(shopByCategoryTiles) ? shopByCategoryTiles : []).filter(t => t.is_active !== false);
        // Auto-fallback: derive tiles from the product catalog. We show
        // TOP-LEVEL parent categories (moisturizers, cleansers, serums,
        // exfoliators, sunscreens, etc.) — not the sub-slugs like face-wash.
        // Falls back to deriving unique `parent` values if is_parent is not set.
        const auto = manual.length === 0
          ? (() => {
              const arr = (Array.isArray(categories) ? categories : [])
                .filter(c => (c.group === 'skincare' || c.niche === 'skincare' || (!c.group && !c.niche)) && c.is_active !== false);
              // First choice: explicit parent categories.
              let picks = arr.filter(c => c.is_parent === true);
              if (picks.length < 6) {
                // Fall back to unique parent slugs referenced by children.
                const parentSlugs = [...new Set(arr.map(c => c.parent).filter(Boolean))];
                const byParent = parentSlugs
                  .map(slug => arr.find(c => c.slug === slug) || { slug, name: slug.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()), niche: 'skincare' });
                picks = [...picks, ...byParent.filter(p => !picks.some(x => x.slug === p.slug))];
              }
              return picks
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map(c => ({
                  slug: c.slug,
                  name: c.name,
                  image: c.image || c.icon_image || null,
                  icon: c.icon || null,
                  route_slug: c.slug,
                }));
            })()
          : [];
        const tiles = manual.length ? manual : auto;
        if (tiles.length === 0) return null;
        return (
          <section className="bg-white border-b border-stone-100" data-testid="skincare-shop-by-category-section">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
              <CircularCategoryStrip
                items={tiles}
                routePrefix="/category"
                title={<>Shop by <span className="italic" style={{ color: accent }}>Category</span></>}
                accent={accent}
                testIdPrefix="skincare-shop-by-category"
              />
            </div>
          </section>
        );
      })()}

      {/* Shop by Brand small banner — placed ABOVE the niche hero banner */}
      <ShopByBrand niche="skincare" accent={accent} accentBg={'#cffafe'} />

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
        testId="skincare-hero"
      />

      <div className="pt-4 sm:pt-7">
        <TrustStrip accent={accent} accentBg={accentBg} />
      </div>

      {/* Skin Type Quick Filter removed per spec — concerns strip already covers personalization. */}

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

      {/* Shop by Category — Build your routine. Placed ABOVE bestsellers so users
          can pick a routine step (Cleanse → Treat → Moisturize → Protect) before
          scrolling into curated products. */}
      <CosmeticsCategoryHub
        categories={categories.filter(c => c.niche === 'skincare' || c.group === 'skincare')}
        virtualGroups={[
          { slug: 'cleanse-prep', name: 'Cleanse & Prep', children: ['cleansers', 'exfoliators', 'toners-mists'], sort_order: 1 },
          { slug: 'treat',        name: 'Treat',          children: ['serums-treatments', 'essences-ampoules', 'spot-treatments'], sort_order: 2 },
          { slug: 'moisturize',   name: 'Moisturize',     children: ['moisturizers', 'face-oils', 'barrier-care'], sort_order: 3 },
          { slug: 'protect',      name: 'Protect',        children: ['sunscreens'], sort_order: 4 },
          { slug: 'target',       name: 'Targeted Care',  children: ['eye-care', 'lip-care', 'brightening-products', 'anti-aging-products'], sort_order: 5 },
          { slug: 'mask-body',    name: 'Masks & Body',   children: ['masks-packs', 'body-skincare'], sort_order: 6 },
        ]}
        eyebrow="Build your routine"
        title="Pick a step."
        subtitle="Cleanse · Treat · Moisturize · Protect · Targeted Care · Masks — every product, every step."
        accentColor={accentDark}
        testIdPrefix="skincare-hub"
      />

      {/* Shop by Brand moved up (above NicheHero banner) — see top of page. */}

      {bs.enabled !== false && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
          <div className="flex items-end justify-between mb-4 sm:mb-6 px-1 sm:px-0">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 sm:mb-1.5 flex items-center gap-2" style={{ color: accent }}>
                <Flame size={11} style={{ fill: accent, color: accent }} /> {bs.eyebrow || 'Trending now'}
              </p>
              <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
                {bs.title_prefix} <span className="italic" style={{ color: accent }}>{bs.title_highlight}</span>
              </h2>
            </div>
            <Link to="/shop?niche=skincare" className="text-[11px] sm:text-xs font-bold hover:underline flex items-center gap-1" style={{ color: accent }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="aspect-[3/5] bg-gradient-to-br from-stone-100 to-stone-200 rounded-3xl" />)}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500 ring-1 ring-cyan-100">No bestsellers yet — check back soon.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
              {sortedProducts.map(p => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}
        </section>
      )}

      {/* Shop by Category hub now rendered ABOVE bestsellers (see top section). */}
      {/* Shop by Brand moved up to sit right after categories (see above). */}

      {/* Legacy CategoryShowcase kept off by default — admin can re-enable via niche.show_category_showcase=true. */}
      {niche.show_category_showcase === true && (
        <CategoryShowcase
          categories={categories}
          products={products}
          niche="skincare"
          accent={accent}
          accentBg="#cffafe"
          testIdPrefix="skincare-category-showcase"
          enabled={true}
          title={niche.category_showcase_title || 'Shop by Category'}
          subtitle={niche.category_showcase_subtitle || "Find what you're looking for"}
          highlight={niche.category_showcase_highlight || 'looking for'}
          banner={niche.category_showcase_banner || null}
          headerImage={niche.category_showcase_header_image || null}
        />
      )}

      {/* Ingredient Spotlight — Hero Actives (admin can hide) */}
      {niche.show_hero_actives === true && <IngredientSpotlight accent={accent} />}

      {niche.show_reviews && <ReviewsCarousel title={niche.reviews_title || 'What our community says'} eyebrow={niche.reviews_eyebrow || 'Real reviews · Verified buyers'} />}
      {niche.show_dermatologist && <DermatologistSection accent={accent} accentDark={accentDark} cfg={niche.dermatologist} />}
      {/* FAQ — always shown, auto-generated by AI for in-depth answers */}
      <FaqSection accent={accent} faqs={niche.faqs} title={niche.faq_title} eyebrow={niche.faq_eyebrow} niche="skincare" />

      {ctaCfg.enabled !== false && (
        <section className="relative overflow-hidden" style={{ background: `linear-gradient(to right, ${ctaCfg.bg_from || '#0e7490'}, ${ctaCfg.bg_via || '#155e75'}, ${ctaCfg.bg_to || '#115e59'})` }}>
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 85% 15%, white 0%, transparent 50%), radial-gradient(circle at 15% 85%, white 0%, transparent 50%)' }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
            <p className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] uppercase text-white/70 mb-2">{ctaCfg.eyebrow}</p>
            <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-2">{ctaCfg.title}</h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl mx-auto mb-4 sm:mb-5">{ctaCfg.subtitle}</p>
            <Link to={ctaCfg.button_link || '/routine'} className="inline-flex items-center gap-2 bg-white hover:bg-cyan-50 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-2xl hover:-translate-y-0.5 transition-all" style={{ color: accentDark }}>
              <Sparkles size={13} style={{ color: accent }} /> {ctaCfg.button_label} <ChevronRight size={13} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
