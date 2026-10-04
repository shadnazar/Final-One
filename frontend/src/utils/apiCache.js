// Lightweight cache for GET requests, with optional localStorage persistence.
// Goal: when the user navigates between pages (e.g. Home → Concern → Cart → Home),
// already-fetched data is served instantly — even after a full page reload.
//
// Usage:
//   import { cachedGet, peek, invalidate } from '@/utils/apiCache';
//   const cachedProducts = peek(`${API}/api/products`); // sync, returns null if stale/missing
//   const { data } = await cachedGet(`${API}/api/products`);
//
// Defaults: 5 min TTL, persisted to localStorage so a hard reload still hits cache.
// In-flight de-dupe so concurrent callers share one network round-trip.

import axios from 'axios';

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const LS_KEY = 'apiCache_v2';
const LS_PERSIST = typeof window !== 'undefined' && !!window.localStorage;

const cache = new Map();    // key → { value, expiresAt }
const inflight = new Map(); // key → Promise

// ---- localStorage hydration / persistence ----
function loadFromStorage() {
  if (!LS_PERSIST) return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && v.expiresAt > now) cache.set(k, v);
    });
  } catch {
    // ignore corrupt cache
  }
}
let persistTimer = null;
function persistToStorage() {
  if (!LS_PERSIST) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const obj = {};
      cache.forEach((v, k) => {
        // Only persist small payloads (<150KB serialized) to avoid LS quota issues
        if (v && v.expiresAt > Date.now()) obj[k] = v;
      });
      const serialized = JSON.stringify(obj);
      if (serialized.length < 4_000_000) {
        window.localStorage.setItem(LS_KEY, serialized);
      }
    } catch {
      // ignore quota errors
    }
  }, 250);
}
loadFromStorage();

const buildKey = (url, params) => {
  if (!params) return url;
  const qs = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `${url}?${qs}`;
};

export async function cachedGet(url, options = {}) {
  let { ttl = DEFAULT_TTL_MS, params, headers, force = false, retry = 1, timeout = 12_000, signal } = options;
  // FRESHNESS: admin-editable taxonomy & settings must reflect on the storefront
  // almost immediately after an admin edit. Cap their client cache at 30s regardless
  // of the caller's requested TTL (otherwise a 5-min localStorage cache hid edits).
  if (/\/api\/(concerns|categories|niches|subcategories|site-settings)(\b|\?|\/|$)/.test(url)) {
    ttl = Math.min(ttl, 30_000);
  }
  const key = buildKey(url, params);

  if (!force) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return { data: hit.value, fromCache: true };
    }
    if (inflight.has(key)) {
      const value = await inflight.get(key);
      return { data: value, fromCache: true };
    }
  }

  const p = (async () => {
    let lastErr = null;
    // PERF/UX: auto-retry once on network failure / 5xx / timeout so a single
    // cold-start hiccup doesn't surface as "Not Available" to the user.
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const r = await axios.get(url, { params, headers, timeout, signal });
        cache.set(key, { value: r.data, expiresAt: Date.now() + ttl });
        persistToStorage();
        return r.data;
      } catch (e) {
        // Caller aborted — bubble up immediately, don't retry, don't cache.
        if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || signal?.aborted) {
          throw e;
        }
        lastErr = e;
        const status = e?.response?.status;
        const retryable = !status || status >= 500 || e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK';
        if (!retryable || attempt === retry) break;
        // 500ms then 1s back-off
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastErr;
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);

  const value = await p;
  return { data: value, fromCache: false };
}

/**
 * Synchronous peek — return cached value if fresh, else null.
 * Use to seed initial component state so pages render instantly on revisit.
 */
export function peek(url, params) {
  const key = buildKey(url, params);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return null;
}

/**
 * Prime the cache with a value we already have (e.g. a product object from a
 * listing response) so a subsequent page can render INSTANTLY via `peek`
 * without waiting for a network round-trip. Only primes if not already fresh.
 */
export function prime(url, value, ttl = DEFAULT_TTL_MS) {
  if (!url || value == null) return;
  const key = buildKey(url);
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return; // keep the fresher/full copy
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  persistToStorage();
}

/**
 * Stale-while-revalidate helper. Returns cached value immediately (even if stale)
 * and triggers a background refresh. The provided onUpdate callback is invoked
 * with the freshly fetched value when it lands.
 */
export function swr(url, options = {}, onUpdate) {
  const { params } = options;
  const key = buildKey(url, params);
  const hit = cache.get(key);
  cachedGet(url, { ...options, force: true })
    .then(({ data }) => {
      if (typeof onUpdate === 'function' && JSON.stringify(data) !== JSON.stringify(hit?.value)) {
        onUpdate(data);
      }
    })
    .catch(() => {});
  return hit ? hit.value : null;
}

// Invalidate a specific URL (with optional params) or a prefix.
export function invalidate(urlOrPrefix, params) {
  if (params !== undefined) {
    cache.delete(buildKey(urlOrPrefix, params));
    persistToStorage();
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k === urlOrPrefix || k.startsWith(urlOrPrefix)) cache.delete(k);
  }
  persistToStorage();
}

export function invalidateAll() {
  cache.clear();
  inflight.clear();
  if (LS_PERSIST) {
    try { window.localStorage.removeItem(LS_KEY); } catch {}
  }
}

// Best-effort: invalidate after admin mutations
if (typeof window !== 'undefined') {
  window.addEventListener('admin-data-changed', () => invalidateAll());

  // Hourly safety-net: if a tab is open >1h, drop stale persisted entries on next visit.
  // This prevents long-lived tabs from showing data the admin updated >1h ago without
  // forcing a full reload. Cache itself still respects per-call TTL.
  try {
    const HOUR = 60 * 60_000;
    const lastResetKey = 'apiCache_lastReset';
    const stored = Number(window.localStorage.getItem(lastResetKey) || 0);
    if (!stored || Date.now() - stored > HOUR) {
      invalidateAll();
      window.localStorage.setItem(lastResetKey, String(Date.now()));
    }
    setInterval(() => {
      invalidateAll();
      window.localStorage.setItem(lastResetKey, String(Date.now()));
    }, HOUR);
  } catch { /* ignore */ }

  // Re-validate cache when the user returns to the tab after a while
  let lastFocus = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // If gone for >5 min, drop cache so the user sees fresh data
      if (Date.now() - lastFocus > 5 * 60_000) invalidateAll();
      lastFocus = Date.now();
    }
  });
}
