import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { cachedGet } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

/* Pre-designed niche-card artwork (image already contains its own title/icon/arrow). */
const CARD_IMAGES = {
  'anti-aging': 'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/egnbiizj_E86525F8-AFBE-4431-B212-D00E13DAFA1C.jpeg',
  'skincare':   'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/tpi0b3jj_171A56DB-E605-493B-94CA-E8823DD9BF61.jpeg',
  'cosmetics':  'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/0qo8dahm_ED352F30-0FBF-4C89-8FBE-F10AE07275B7.jpeg',
};

const ACTIVE_RING = {
  'anti-aging': '#0f766e',
  'skincare':   '#1e88e5',
  'cosmetics':  '#fb7185',
};

/* Static default niches – identical to what the API returns, so the cards render
 * INSTANTLY on first paint and never flicker when switching pages. */
const DEFAULT_NICHES = [
  { slug: 'anti-aging', name: 'Anti-Aging',         route: '/',           sort_order: 1 },
  { slug: 'skincare',   name: 'Skincare',           route: '/skincare',   sort_order: 2 },
  { slug: 'cosmetics',  name: 'Cosmetics & Makeup', route: '/cosmetics',  sort_order: 3 },
];

/* Module-level cache so we only hit /api/niches ONCE per full page load.
 * Persists across unmount/remount while navigating between routes. */
let NICHES_CACHE = null;
let NICHES_INFLIGHT = null;

async function fetchNichesOnce() {
  if (NICHES_CACHE) return NICHES_CACHE;
  if (NICHES_INFLIGHT) return NICHES_INFLIGHT;
  NICHES_INFLIGHT = axios
    .get(`${API}/api/niches`)
    .then((r) => {
      NICHES_CACHE = (r.data && r.data.length) ? r.data : DEFAULT_NICHES;
      return NICHES_CACHE;
    })
    .catch(() => {
      NICHES_CACHE = DEFAULT_NICHES;
      return NICHES_CACHE;
    })
    .finally(() => { NICHES_INFLIGHT = null; });
  return NICHES_INFLIGHT;
}

/**
 * NicheCardSwitcher — three image-only cards. No code-rendered text or icons.
 * Uses static defaults for instant render + module cache for zero re-fetch.
 *
 * Per-device images: admin can upload card_image_mobile / _tablet / _desktop /
 * _tv inside `niche_settings.<slug>.card_image_*`. We fall back smoothly:
 *   TV → Desktop → Tablet → Mobile → Built-in stock photo.
 * Implemented as a <picture> element so the browser picks the best source
 * before downloading anything.
 */

function pickCardImages(slug, settingsForNiche) {
  const fallback = CARD_IMAGES[slug];
  const ns = settingsForNiche || {};
  const desktop = ns.card_image_desktop || ns.card_image_tablet || ns.card_image_mobile || fallback;
  const tablet  = ns.card_image_tablet  || ns.card_image_mobile  || ns.card_image_desktop || fallback;
  const mobile  = ns.card_image_mobile  || ns.card_image_tablet  || ns.card_image_desktop || fallback;
  const tv      = ns.card_image_tv      || desktop;
  return { mobile, tablet, desktop, tv };
}

export default function NicheCardSwitcher({ nicheSettings = {} } = {}) {
  const [niches, setNiches] = useState(() => NICHES_CACHE || DEFAULT_NICHES);
  const [siteSettings, setSiteSettings] = useState(nicheSettings);
  const [activeNichesFilter, setActiveNichesFilter] = useState(null); // null = not fetched yet, array = fetched
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    fetchNichesOnce().then((data) => {
      if (mounted && data && data.length) setNiches(data);
    });
    // Fetch the admin niche-mode toggle so we hide cards for disabled niches
    // when the site is running in "Anti-Aging Only" mode.
    cachedGet(`${API}/api/niche-mode`).then(r => {
      if (mounted && Array.isArray(r?.data?.active_niches)) setActiveNichesFilter(r.data.active_niches);
    }).catch(() => { if (mounted) setActiveNichesFilter(['anti-aging', 'skincare', 'cosmetics']); });
    // If the parent didn't pass nicheSettings, fetch site-settings here so the
    // cards still respect the admin's per-device uploads.
    if (!Object.keys(nicheSettings).length) {
      cachedGet(`${API}/api/site-settings`).then(r => {
        if (mounted && r?.data?.niche_settings) setSiteSettings(r.data.niche_settings);
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch the destination niche's product list on hover/touchstart so the
  // first switch is instant (runs silently, no UI impact).
  const prefetchNiche = useCallback((slug) => {
    const slugKey = slug === 'anti-aging' ? 'anti-aging'
      : slug === 'skincare' ? 'skincare'
      : slug === 'cosmetics' ? 'cosmetics' : null;
    if (!slugKey) return;
    cachedGet(`${API}/api/products?niche=${slugKey}`).catch(() => {});
    if (slugKey === 'skincare') cachedGet(`${API}/api/concerns`).catch(() => {});
    if (slugKey === 'cosmetics') cachedGet(`${API}/api/categories`).catch(() => {});
  }, []);

  if (!niches.length) return null;

  // Apply admin niche-mode filter. When only anti-aging is active we hide
  // the whole strip entirely — there's nothing to switch between.
  const filteredNiches = activeNichesFilter
    ? niches.filter(n => activeNichesFilter.includes(n.slug))
    : niches;
  if (filteredNiches.length <= 1) return null;

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/' || location.pathname === '/anti-aging';
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  };

  return (
    <section className="bg-white py-2 sm:py-4" data-testid="niche-card-switcher">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {filteredNiches.map((n) => {
            const ring = ACTIVE_RING[n.slug] || '#22c55e';
            const active = isActive(n.route);
            const imgs = pickCardImages(n.slug, siteSettings?.[n.slug]);
            return (
              <Link
                key={n.slug}
                to={n.route}
                data-testid={`niche-card-${n.slug}`}
                aria-label={n.name}
                onMouseEnter={() => prefetchNiche(n.slug)}
                onTouchStart={() => prefetchNiche(n.slug)}
                onFocus={() => prefetchNiche(n.slug)}
                className={`group relative block aspect-[7/6] sm:aspect-[5/3] lg:aspect-[5/3] rounded-2xl overflow-hidden bg-stone-100 transition-all duration-300 ${
                  active
                    ? 'ring-2 sm:ring-[3px] shadow-lg shadow-black/10 scale-[1.01]'
                    : 'ring-1 ring-stone-200 hover:ring-stone-300 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                style={active ? { '--tw-ring-color': ring } : undefined}
              >
                {/* <picture> lets the browser pick the right source by viewport
                    BEFORE it starts downloading. Largest first (TV) → smallest
                    (mobile). The <img> fallback handles browsers that don't
                    support <picture>. */}
                <picture>
                  <source media="(min-width: 1920px)" srcSet={imgs.tv} />
                  <source media="(min-width: 1024px)" srcSet={imgs.desktop} />
                  <source media="(min-width: 640px)"  srcSet={imgs.tablet} />
                  <img
                    src={imgs.mobile}
                    alt={n.name}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                    className="absolute inset-0 w-full h-full object-cover sm:object-contain opacity-0 transition-opacity duration-300 group-hover:scale-[1.03]"
                  />
                </picture>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
