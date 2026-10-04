/**
 * CategoryShowcase — PREMIUM "Shop by Category" section used by Skincare &
 * Cosmetics home pages.
 *
 * Visual upgrades (vs. previous version):
 *  • Editorial header — accent eyebrow pill, big italic-gradient headline,
 *    floating "View all" CTA with arrow that translates on hover.
 *  • Asymmetric premium grid: first card is a full-width hero card with a
 *    bigger header image and 6 product previews; remaining cards are 2-col
 *    rich preview cards.
 *  • Each card: large header image with gradient veil & accent badge, big
 *    type-driven heading, product chips with rounded image + price overlay.
 *  • Hover micro-interactions: image scale, CTA pill translate, shadow lift.
 *
 * Admin-editable via `niche_settings[niche]` (existing keys), with new
 * optional overlays (`category_showcase_*`) for banner / extra CTA.
 */
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ChevronRight, Flame } from 'lucide-react';
import { productPrimaryImage, resolveImageUrl } from '../utils/productImage';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80';

/* ---------- Product mini chip (used inside category cards) ---------- */
function ProductChip({ p, accent, onClick, large = false }) {
  const img = productPrimaryImage(p, PLACEHOLDER);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(`/product/${p.slug}`); }}
      className="flex flex-col group/chip text-left focus:outline-none w-full"
      data-testid={`category-showcase-product-${p.slug}`}
    >
      <div
        className={`relative ${large ? 'aspect-[4/5]' : 'aspect-square'} w-full bg-stone-50 rounded-2xl overflow-hidden ring-1 ring-stone-200 group-hover/chip:ring-2 transition-all shadow-sm group-hover/chip:shadow-md`}
        style={{ '--tw-ring-color': accent }}
      >
        <img
          src={img}
          alt={p.name}
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
          className="w-full h-full object-cover group-hover/chip:scale-110 transition-transform duration-700"
        />
        {p.mrp > p.prepaid_price && large && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black tracking-wider uppercase shadow">
            -{Math.round(((p.mrp - p.prepaid_price) / p.mrp) * 100)}%
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] sm:text-xs font-bold text-stone-900 line-clamp-1 leading-snug">{p.short_name || p.name}</p>
      <p className="text-[10px] sm:text-[11px] text-stone-500 font-medium">
        <span className="font-black text-stone-900">₹{p.prepaid_price}</span>
        {p.mrp > p.prepaid_price && (
          <span className="ml-1 line-through text-stone-400">₹{p.mrp}</span>
        )}
      </p>
    </button>
  );
}

/* ---------- Standard 2-col category preview card ---------- */
function CategoryCard({ category, items, total, accent, accentBg, hero = false, navigate }) {
  const headerImg = resolveImageUrl(
    category.image || items[0]?.images?.[0] || null,
    null
  );
  const previewCount = hero ? 4 : 4;
  const previews = items.slice(0, previewCount);
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/category/${category.slug}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/category/${category.slug}`); }}
      className={`group relative bg-white ring-1 ring-stone-200 rounded-3xl overflow-hidden hover:ring-2 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-500 cursor-pointer ${hero ? 'lg:col-span-2' : ''}`}
      style={{ '--tw-ring-color': accent }}
      data-testid={`category-showcase-card-${category.slug}`}
    >
      {/* Full-bleed header image with gradient veil + floating accent pill */}
      <div className={`relative overflow-hidden ${hero ? 'h-44 sm:h-56' : 'h-32 sm:h-40'}`}>
        {headerImg ? (
          <img
            src={headerImg}
            alt={category.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${category.accent_from || accentBg} 0%, ${category.accent_to || accent}66 100%)` }} />
        )}
        {/* Bottom gradient for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-3/4" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%)' }} />
        {/* Accent corner pill */}
        <span
          className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black tracking-[0.18em] uppercase text-white shadow-md backdrop-blur-sm"
          style={{ background: `${accent}cc` }}
        >
          <Sparkles size={9} />
          {hero ? 'Featured' : (category.tagline ? category.tagline.slice(0, 14) : 'Shop')}
        </span>
        {/* Title overlaid on image bottom */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-heading font-black text-white leading-tight tracking-tight drop-shadow-md ${hero ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-lg sm:text-xl'}`}>
              {category.name}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-white/85 font-bold mt-0.5">
              {total} {total === 1 ? 'product' : 'products'}{category.tagline && !hero ? ` · ${category.tagline}` : ''}
            </p>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white text-stone-900 text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-lg transition-transform group-hover:translate-x-1"
          >
            Shop <ArrowRight size={11} />
          </span>
        </div>
      </div>

      {/* Product chips grid */}
      <div className={`p-4 sm:p-5 grid gap-3 sm:gap-4 ${hero ? 'grid-cols-4' : 'grid-cols-4'}`}>
        {previews.map(p => (
          <ProductChip key={p.slug} p={p} accent={accent} onClick={navigate} large={hero} />
        ))}
        {Array.from({ length: Math.max(0, previewCount - previews.length) }).map((_, i) => (
          <div key={`pad-${i}`} className={`${hero ? 'aspect-[4/5]' : 'aspect-square'} rounded-2xl bg-stone-50 ring-1 ring-stone-100`} />
        ))}
      </div>

      {/* Hero card adds an extra "Explore <category>" footer pill */}
      {hero && (
        <div className="px-5 pb-5 -mt-1">
          <Link
            to={`/category/${category.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase rounded-full px-4 py-2 ring-1 transition-colors hover:bg-stone-900 hover:text-white"
            style={{ color: accent, borderColor: `${accent}55`, '--tw-ring-color': accent }}
          >
            Explore all {total} {category.name}
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------- Decorative banner pinned above the grid (admin-editable) ---------- */
function HighlightBanner({ cfg, accent }) {
  if (!cfg?.enabled) return null;
  return (
    <Link
      to={cfg.cta_link || '#'}
      className="block relative overflow-hidden rounded-3xl mb-6 sm:mb-8 text-white shadow-lg ring-1 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${cfg.bg_from || accent}, ${cfg.bg_to || '#0f172a'})` }}
      data-testid="category-showcase-banner"
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(circle at 90% 80%, rgba(255,255,255,0.3), transparent 55%)' }} />
      <div className="relative px-5 py-5 sm:px-8 sm:py-7 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase opacity-85 mb-1">
            <Flame size={10} className="inline mr-1.5" />
            {cfg.eyebrow || 'LIMITED DROP'}
          </p>
          <p className="text-base sm:text-2xl font-black tracking-tight leading-tight">{cfg.text || ''}</p>
        </div>
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-stone-900 text-xs font-black tracking-wider uppercase shadow-md">
          {cfg.cta_label || 'Shop now'} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}

export default function CategoryShowcase({
  categories = [],
  products = [],
  niche = 'skincare',
  accent = '#16a34a',
  accentBg = '#dcfce7',
  testIdPrefix = 'category-showcase',
  enabled = true,
  title = 'Shop by Category',
  subtitle = "Find what you're looking for",
  highlight = 'looking for',
  // NEW: optional admin-editable highlight banner shown above the grid
  banner = null, // { enabled, eyebrow, text, cta_label, cta_link, bg_from, bg_to }
  // NEW: optional admin-editable header decorative image (shown to the right
  // of the headline on desktop, above on mobile). When set, the section header
  // becomes a 2-col layout with editorial image.
  headerImage = null, // string URL
}) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const byCat = new Map();
    for (const p of products) {
      const cat = p.category;
      if (!cat) continue;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(p);
    }
    const tieBreak = (a, b) =>
      ((a.sort_order ?? 99) - (b.sort_order ?? 99)) ||
      String(a.slug || '').localeCompare(String(b.slug || ''));
    for (const arr of byCat.values()) arr.sort(tieBreak);

    return categories
      .filter(c => (c.niche || c.group) === niche && byCat.has(c.slug) && byCat.get(c.slug).length > 0)
      .map(c => ({ category: c, items: byCat.get(c.slug).slice(0, 6), total: byCat.get(c.slug).length }));
  }, [categories, products, niche]);

  if (!enabled || groups.length === 0) return null;

  // Highlight `highlight` substring inside subtitle, render with italic accent
  const subtitleParts = subtitle.split(highlight);
  const renderedSubtitle = subtitleParts.length > 1
    ? <>{subtitleParts[0]}<span className="italic font-light" style={{ color: accent }}>{highlight}</span>{subtitleParts.slice(1).join(highlight)}</>
    : subtitle;

  const [first, ...rest] = groups;

  return (
    <section
      className="relative max-w-7xl mx-auto px-3 sm:px-6 py-10 sm:py-16"
      data-testid={testIdPrefix}
    >
      {/* Subtle backdrop accents */}
      <span className="hidden md:block absolute -top-10 right-[5%] w-60 h-60 rounded-full blur-3xl opacity-[0.18] pointer-events-none" style={{ background: accent }} aria-hidden="true" />
      <span className="hidden md:block absolute -bottom-10 left-[5%] w-72 h-72 rounded-full blur-3xl opacity-[0.12] pointer-events-none" style={{ background: '#fda4af' }} aria-hidden="true" />

      {/* Editorial header */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mb-7 sm:mb-10 items-end">
        <div className={`max-w-2xl ${headerImage ? 'lg:col-span-7' : 'lg:col-span-9'}`}>
          <p
            className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase mb-3 px-3 py-1.5 rounded-full"
            style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}33` }}
          >
            <Sparkles size={11} />
            {title}
          </p>
          <h2 className="font-heading text-3xl sm:text-5xl font-black text-stone-900 leading-[1.05] tracking-tight">
            {renderedSubtitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-stone-500 leading-relaxed">
            {groups.length} curated {groups.length === 1 ? 'edit' : 'edits'} · hand-picked for {niche === 'cosmetics' ? 'Indian skin tones' : 'every concern & climate'}
          </p>
          <Link
            to={`/${niche === 'cosmetics' ? 'cosmetics' : 'shop?niche=' + niche}`}
            className="mt-5 hidden sm:inline-flex flex-shrink-0 items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-black tracking-wider uppercase shadow-lg ring-1 ring-white/20 transition-transform hover:-translate-y-0.5"
            style={{ background: accent }}
            data-testid={`${testIdPrefix}-view-all`}
          >
            Explore the {niche} edit
            <ArrowRight size={13} />
          </Link>
        </div>
        {headerImage && (
          <div className="lg:col-span-5 relative" data-testid={`${testIdPrefix}-header-image`}>
            <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[5/4] rounded-3xl overflow-hidden ring-1 ring-stone-200 shadow-md">
              <img
                src={headerImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] hover:scale-105"
              />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, transparent 50%, ${accent}33 100%)` }}
              />
              {/* Small floating accent chip on the image */}
              <span
                className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase text-white shadow-md backdrop-blur-sm"
                style={{ background: `${accent}d9` }}
              >
                <Sparkles size={11} /> Editor's edit
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Optional banner */}
      <HighlightBanner cfg={banner} accent={accent} />

      {/* Asymmetric grid: first card is hero-wide (lg+), the rest 2-col */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {first && (
          <CategoryCard
            category={first.category}
            items={first.items}
            total={first.total}
            accent={accent}
            accentBg={accentBg}
            hero
            navigate={navigate}
          />
        )}
        {rest.map(({ category, items, total }) => (
          <CategoryCard
            key={category.slug}
            category={category}
            items={items}
            total={total}
            accent={accent}
            accentBg={accentBg}
            navigate={navigate}
          />
        ))}
      </div>

      {/* Mobile "View all" pill */}
      <div className="sm:hidden mt-6 flex justify-center">
        <Link
          to={`/${niche === 'cosmetics' ? 'cosmetics' : 'shop?niche=' + niche}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xs font-black tracking-wider uppercase shadow-lg"
          style={{ background: accent }}
        >
          Explore the {niche} edit <ArrowRight size={13} />
        </Link>
      </div>
    </section>
  );
}
