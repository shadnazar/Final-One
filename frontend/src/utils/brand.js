// Tiny helper to read per-niche brand name from site_settings (cached in sessionStorage)
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const CACHE_KEY = 'cg_niche_brands';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

let inflight = null;

export async function loadNicheBrands() {
  // Return cached if fresh
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.brands;
  } catch (e) {}
  // Single inflight request to avoid stampede
  if (inflight) return inflight;
  inflight = axios
    .get(`${API}/api/site-settings`)
    .then((res) => {
      const ns = res.data?.niche_settings || {};
      const brands = {
        'anti-aging': ns['anti-aging']?.brand_name || 'Celesta Glow',
        'skincare': ns['skincare']?.brand_name || 'Celesta Glow',
        'cosmetics': ns['cosmetics']?.brand_name || 'Celesta Beauty',
      };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), brands })); } catch (e) {}
      return brands;
    })
    .catch(() => ({ 'anti-aging': 'Celesta Glow', 'skincare': 'Celesta Glow', 'cosmetics': 'Celesta Beauty' }))
    .finally(() => { inflight = null; });
  return inflight;
}

// Sync, blocking-safe lookup (uses cache only — falls back to default if no cache)
export function getNicheBrandSync(niche) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.brands?.[niche]) return cached.brands[niche];
  } catch (e) {}
  if (niche === 'cosmetics') return 'Celesta Beauty';
  return 'Celesta Glow';
}

// Pick the brand for a product (prefers product.brand override, else niche-based)
export function getProductBrand(product) {
  if (product?.brand && product.brand.trim()) return product.brand.trim();
  return getNicheBrandSync(product?.niche || 'anti-aging');
}
