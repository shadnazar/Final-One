/**
 * routePrefetch.js — Preload lazy-loaded route chunks on link hover/focus.
 *
 * React Router's `<Link>` doesn't fetch the route's JS chunk until the user
 * clicks. By firing the dynamic import on hover (well before the click), the
 * chunk is usually already cached by the time the user actually navigates,
 * so the Suspense fallback never has a chance to flash.
 *
 * Usage:
 *   import { prefetchRoute } from '../utils/routePrefetch';
 *   <Link to="/shop" onMouseEnter={() => prefetchRoute('/shop')} onFocus={...}>Shop</Link>
 */

// Map path prefixes → dynamic import factories (match the ones in AppRouter.js).
const PREFETCH_MAP = {
  '/shop': () => import('../pages/ShopPage'),
  '/cart': () => import('../pages/CartPage'),
  '/checkout': () => import('../pages/CheckoutPage'),
  '/categories': () => import('../pages/CategoriesPage'),
  '/category/': () => import('../pages/ConcernCategoryPage'),
  '/concern/': () => import('../pages/ConcernCategoryPage'),
  '/product/': () => import('../pages/ProductDetailPage'),
  '/skincare': () => import('../pages/SkincareHome'),
  '/cosmetics': () => import('../pages/CosmeticsHome'),
  '/routine': () => import('../pages/RoutinePage'),
  '/account': () => import('../pages/AccountPage'),
  '/track-order': () => import('../pages/TrackOrder'),
  '/search': () => import('../pages/SearchResults'),
  '/consultation': () => import('../pages/ConsultationPage'),
  '/blog': () => import('../pages/BlogList'),
  '/about': () => import('../pages/AboutPage'),
  '/contact': () => import('../pages/ContactPage'),
};

const fired = new Set();

export function prefetchRoute(path) {
  if (!path) return;
  // Find the best-matching prefix and fire its import once.
  for (const prefix of Object.keys(PREFETCH_MAP)) {
    if (path === prefix || path.startsWith(prefix)) {
      if (fired.has(prefix)) return;
      fired.add(prefix);
      try { PREFETCH_MAP[prefix](); } catch (_) { /* ignore */ }
      return;
    }
  }
}

/** Handy hover/focus handler you can spread onto a <Link>. */
export const prefetchHandlers = (path) => ({
  onMouseEnter: () => prefetchRoute(path),
  onFocus: () => prefetchRoute(path),
  onTouchStart: () => prefetchRoute(path),
});
