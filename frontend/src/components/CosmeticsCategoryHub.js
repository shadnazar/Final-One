/**
 * CosmeticsCategoryHub — Premium parent-then-subcategory grid for /cosmetics and /skincare.
 *
 * For cosmetics, parents come from DB (face-makeup / lips / eyes / nails /
 * tools-brushes / makeup-kits). For skincare, parents are *virtual* — we
 * synthesise them from a `virtualGroups` prop (since the skincare taxonomy
 * is flat with no parents in DB).
 *
 * Renders each parent category as a band with a labelled left rail and a
 * horizontal-scrollable strip of its subcategories. Each subcategory tile
 * shows the icon, name, and live product count. Tap any tile → navigates
 * to /category/{slug}.
 *
 * Counts are fetched via /api/products?category={slug}&page=1&limit=1 which
 * returns a `total` we use without pulling the full catalog.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { cachedGet } from '../utils/apiCache';
import { cldOptim } from '../utils/productImage';

const API = process.env.REACT_APP_BACKEND_URL;

// Parent → emoji + brand accent. Keeps each band visually distinct without
// loading bespoke artwork (we lean into the new product taxonomy v2 directly).
const PARENT_THEME = {
  // Cosmetics
  'face-makeup':   { icon: '✨', from: '#fff1f2', to: '#fecdd3', text: '#9f1239', accent: '#e11d48' },
  'lips':          { icon: '💋', from: '#fdf2f8', to: '#fbcfe8', text: '#831843', accent: '#db2777' },
  'eyes':          { icon: '👁',  from: '#f5f3ff', to: '#ddd6fe', text: '#4c1d95', accent: '#7c3aed' },
  'nails':         { icon: '💅', from: '#fff7ed', to: '#fed7aa', text: '#7c2d12', accent: '#ea580c' },
  'tools-brushes': { icon: '🖌️', from: '#f8fafc', to: '#e2e8f0', text: '#1e293b', accent: '#475569' },
  'makeup-kits':   { icon: '🎁', from: '#ecfdf5', to: '#a7f3d0', text: '#064e3b', accent: '#059669' },
  // Skincare (virtual groups)
  'cleanse-prep':  { icon: '🧼', from: '#ecfeff', to: '#a5f3fc', text: '#155e75', accent: '#0891b2' },
  'treat':         { icon: '🧪', from: '#fdf4ff', to: '#f5d0fe', text: '#6b21a8', accent: '#a855f7' },
  'moisturize':    { icon: '💧', from: '#eff6ff', to: '#bfdbfe', text: '#1e3a8a', accent: '#2563eb' },
  'protect':       { icon: '☀️', from: '#fefce8', to: '#fef08a', text: '#713f12', accent: '#ca8a04' },
  'target':        { icon: '🎯', from: '#f0fdf4', to: '#bbf7d0', text: '#14532d', accent: '#16a34a' },
  'mask-body':     { icon: '🛁', from: '#fff1f2', to: '#fecdd3', text: '#881337', accent: '#e11d48' },
};

const FALLBACK_THEME = { icon: '🛍', from: '#f1f5f9', to: '#cbd5e1', text: '#0f172a', accent: '#0f766e' };

// Hero copy keyed by parent slug (works for both real DB parents and virtual groups).
const PARENT_COPY = {
  'face-makeup':   { eyebrow: 'Face',           pre: 'Cover, conceal, ',     post: 'glow.' },
  'lips':          { eyebrow: 'Lips',           pre: 'Bold, balmy, ',         post: 'utterly you.' },
  'eyes':          { eyebrow: 'Eyes',           pre: 'Define every ',         post: 'flutter.' },
  'nails':         { eyebrow: 'Nails',          pre: 'Tip-to-toe ',           post: 'colour.' },
  'tools-brushes': { eyebrow: 'Tools & Brushes',pre: 'Pro tools for ',        post: 'pro finish.' },
  'makeup-kits':   { eyebrow: 'Kits & Combos',  pre: 'Curated ',              post: 'kits & combos.' },
  'cleanse-prep':  { eyebrow: 'Cleanse & Prep', pre: 'Start with a ',         post: 'clean canvas.' },
  'treat':         { eyebrow: 'Treat',          pre: 'Targeted ',             post: 'actives.' },
  'moisturize':    { eyebrow: 'Moisturize',     pre: 'All-day ',              post: 'hydration.' },
  'protect':       { eyebrow: 'Protect',        pre: 'Daily ',                post: 'SPF shield.' },
  'target':        { eyebrow: 'Targeted Care',  pre: 'Eye, lip, ',            post: 'concern-specific care.' },
  'mask-body':     { eyebrow: 'Masks & Body',   pre: 'Spa-grade ',            post: 'rituals.' },
};

function SubcatTile({ subcat, count, accent, testIdPrefix }) {
  return (
    <Link
      to={`/category/${subcat.slug}`}
      className="group relative flex-shrink-0 w-[140px] sm:w-[170px] snap-start"
      data-testid={`${testIdPrefix}-subcat-${subcat.slug}`}
    >
      <div
        className="relative aspect-[5/6] rounded-2xl overflow-hidden ring-1 ring-stone-200/80 group-hover:ring-stone-300 bg-white transition-all group-hover:shadow-[0_18px_50px_-15px_rgba(0,0,0,0.18)] group-hover:-translate-y-0.5 duration-500"
      >
        {/* Soft gradient backdrop per parent */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(155deg, white 30%, ${accent}10)` }} />
        {subcat.image && (
          <img
            src={cldOptim(subcat.image, {w:400})}
            alt={subcat.name}
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            loading="lazy"
            decoding="async"
          />
        )}
        {/* Floating shape */}
        <div
          className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl ${subcat.image ? 'opacity-30' : 'opacity-60'}`}
          style={{ background: accent }}
        />
        {/* Body */}
        <div className="relative h-full flex flex-col justify-end p-3 bg-gradient-to-t from-white/80 via-white/40 to-transparent">
          <p className="text-sm sm:text-[15px] font-black text-stone-900 leading-snug">{subcat.name}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 group-hover:text-stone-900 transition-colors">
            Shop now <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ParentBand({ parent, subcats, counts, viewAllHref, testIdPrefix, dbMeta }) {
  const theme = PARENT_THEME[parent.slug] || FALLBACK_THEME;
  const copy = PARENT_COPY[parent.slug] || { eyebrow: parent.name, pre: '', post: parent.name + '.' };
  // Admin-uploaded background image for this parent band (via /admin/categories
  // → edit the parent record like "nails" or "face-makeup"). Falls back to the
  // hardcoded gradient theme.
  const bgImage = dbMeta?.image || '';
  const bandTagline = dbMeta?.tagline || '';
  return (
    <section
      className="relative rounded-3xl overflow-hidden ring-1 ring-stone-200/80"
      style={{ background: `linear-gradient(120deg, ${theme.from}, ${theme.to})` }}
      data-testid={`${testIdPrefix}-band-${parent.slug}`}
    >
      {bgImage && (
        <img
          src={bgImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
          loading="lazy"
        />
      )}
      <div className="absolute inset-y-0 -left-12 w-44 opacity-50 blur-3xl" style={{ background: theme.accent }} />
      <div className="relative px-4 sm:px-7 py-5 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1" style={{ color: theme.text }}>
              <span className="mr-1.5" aria-hidden="true">{theme.icon}</span> {copy.eyebrow}
            </p>
            <h3 className="font-heading text-xl sm:text-3xl font-black leading-tight" style={{ color: theme.text }}>
              {copy.pre}<span className="italic font-light">{copy.post}</span>
            </h3>
            {bandTagline && (
              <p className="text-xs sm:text-sm mt-1.5 opacity-80" style={{ color: theme.text }}>{bandTagline}</p>
            )}
          </div>
          {viewAllHref && (
            <Link
              to={viewAllHref}
              className="inline-flex items-center gap-1 text-xs font-bold hover:underline whitespace-nowrap px-3 py-2 rounded-xl bg-white/70 ring-1 ring-white/60"
              style={{ color: theme.text }}
              data-testid={`${testIdPrefix}-parent-${parent.slug}`}
            >
              Shop all <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Props:
 *   categories     — full list of categories for the niche (with niche/parent/is_parent/slug/name/image)
 *   virtualGroups  — for niches without DB parents (skincare). Shape:
 *                    [{ slug: 'cleanse-prep', name: 'Cleanse & Prep', children: ['cleansers','exfoliators','toners-mists'] }, ...]
 *   eyebrow        — top banner eyebrow text (default 'Shop the full range')
 *   title          — top banner H2 (default 'Pick a category.')
 *   subtitle       — top banner subtitle string
 *   accentColor    — heading color (for the italic word)
 *   testIdPrefix   — data-testid namespace
 */
export default function CosmeticsCategoryHub({
  categories = [],
  virtualGroups = null,
  eyebrow = 'Shop the full range',
  title = 'Pick a category.',
  subtitle = 'Face · Lips · Eyes · Nails · Tools · Kits — every subcategory, every shade, in one tap.',
  accentColor = '#be185d',
  testIdPrefix = 'cosmetics-hub',
}) {
  // Build the bands either from real DB parents, or from virtualGroups.
  // For virtualGroups, we ALSO splice in any admin-added child categories
  // whose `parent` field matches the band slug — so admin-created subcategories
  // appear in the hub automatically without code changes.
  const { parents, byParent, parentMetaBySlug } = useMemo(() => {
    const bySlug = Object.fromEntries(categories.map(c => [c.slug, c]));
    // Map of parent_slug -> admin-added child category records (extra tiles)
    const adminChildrenByParent = {};
    for (const c of categories) {
      const p = c.parent;
      if (p && !c.is_parent) {
        (adminChildrenByParent[p] = adminChildrenByParent[p] || []).push(c);
      }
    }
    if (virtualGroups && Array.isArray(virtualGroups) && virtualGroups.length) {
      const parents = virtualGroups.map(g => ({
        slug: g.slug,
        name: g.name,
        is_parent: true,
        sort_order: g.sort_order ?? 99,
      }));
      const byParent = {};
      for (const g of virtualGroups) {
        const hardcoded = (g.children || [])
          .map(slug => bySlug[slug])
          .filter(Boolean);
        // Admin-added extras: any DB child whose `parent` slug matches this band
        // OR any DB child whose `parent` matches one of the hardcoded child slugs
        // (e.g. admin adds a "matte-lipstick" under parent="lipstick" — shows under Lips band).
        const matchSlugs = new Set([g.slug, ...(g.children || [])]);
        const extras = [];
        for (const ps of matchSlugs) {
          for (const ec of (adminChildrenByParent[ps] || [])) {
            if (!hardcoded.find(h => h.slug === ec.slug) && !extras.find(e => e.slug === ec.slug)) {
              extras.push(ec);
            }
          }
        }
        const merged = [...hardcoded, ...extras]
          .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
        byParent[g.slug] = merged;
      }
      // For virtualGroups, parent meta (image, tagline) is pulled from the DB
      // record if a category exists with the same slug (e.g. "face-makeup", "lips",
      // "eyes", "nails", "tools-brushes", "makeup-kits" from taxonomy_v2).
      const parentMetaBySlug = {};
      for (const g of virtualGroups) {
        const dbRow = bySlug[g.slug];
        if (dbRow) parentMetaBySlug[g.slug] = dbRow;
      }
      return { parents, byParent, parentMetaBySlug };
    }
    // DB-driven path (cosmetics with taxonomy_v2 parents)
    const parents = categories
      .filter(c => c.is_parent)
      .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    const byParent = {};
    for (const c of categories) {
      if (!c.is_parent && c.parent) {
        (byParent[c.parent] = byParent[c.parent] || []).push(c);
      }
    }
    for (const k of Object.keys(byParent)) {
      byParent[k].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    }
    const parentMetaBySlug = Object.fromEntries(parents.map(p => [p.slug, p]));
    return { parents, byParent, parentMetaBySlug };
  }, [categories, virtualGroups]);

  // Per-subcategory product counts (lazy, batched)
  const [counts, setCounts] = useState({});
  useEffect(() => {
    const slugs = new Set();
    for (const k of Object.keys(byParent)) {
      for (const c of byParent[k]) slugs.add(c.slug);
    }
    if (!slugs.size) return;
    let cancelled = false;
    Promise.all(
      Array.from(slugs).map(slug =>
        cachedGet(`${API}/api/products?category=${slug}&page=1&limit=1`, { ttl: 120_000 })
          .then(r => {
            const total = Array.isArray(r.data) ? r.data.length : (r.data?.total ?? (r.data?.items?.length ?? 0));
            return [slug, total];
          })
          .catch(() => [slug, 0])
      )
    ).then(entries => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.keys(byParent).map(k => byParent[k].map(c => c.slug)))]);

  if (!parents.length) return null;

  // Split title into "leading words" + "highlight word" so the last word is italic-accent.
  const titleParts = title.trim().split(/\s+/);
  const leading = titleParts.slice(0, -1).join(' ');
  const highlight = titleParts.slice(-1)[0] || '';

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12" data-testid={testIdPrefix}>
      <div className="text-center mb-6 sm:mb-9 px-3">
        <p className="text-[10px] sm:text-[11px] font-black tracking-[0.45em] uppercase mb-1.5" style={{ color: accentColor }}>{eyebrow}</p>
        <h2 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-black text-stone-900 leading-tight">
          {leading} <span className="italic font-light" style={{ color: accentColor }}>{highlight}</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 mt-2 max-w-xl mx-auto">{subtitle}</p>
      </div>

      <div className="space-y-5 sm:space-y-7">
        {parents.map(p => (
          <ParentBand
            key={p.slug}
            parent={p}
            subcats={byParent[p.slug] || []}
            counts={counts}
            dbMeta={parentMetaBySlug[p.slug]}
            // Virtual groups don't have a /category/{slug} target — link to /shop with filter
            viewAllHref={
              virtualGroups
                ? null
                : `/category/${p.slug}`
            }
            testIdPrefix={testIdPrefix}
          />
        ))}
      </div>
    </section>
  );
}
