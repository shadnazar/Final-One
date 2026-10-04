/**
 * Live social-proof numbers for product pages.
 *
 * Design goals (per merchant request):
 *  • Same product, same day → same numbers. NO flicker when the user clicks
 *    through gallery images.
 *  • Different products show DIFFERENT numbers (hashed from slug).
 *  • "Sold today" starts low (~5) at midnight and grows linearly through the
 *    day to the product's peak by 11:59 PM, then resets at the next midnight.
 *  • "Viewing now" feels alive — fluctuates every ~1 minute around a baseline
 *    that's also tied to time of day (mornings quieter, evenings busier).
 *  • "Stock left" stays stable through the day, dropping slowly.
 *
 * All functions are pure + deterministic given the same (slug, time) inputs,
 *  so React StrictMode's double-render doesn't change anything either.
 */

// Cheap, stable string-hash → 32-bit unsigned int.
function hashSlug(slug = '') {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Yields a stable pseudo-random float in [0,1) from any integer seed.
function seedRand(seed) {
  // Mulberry32 — small + good distribution.
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Day key — YYYYMMDD as integer. Same value for any time within the same day.
function dayKey(now = new Date()) {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// Fraction of the day elapsed [0,1).
function dayFraction(now = new Date()) {
  return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
}


/* ------------------------------------------------------------------ */
/*  Sold today — the IMPORTANT one. Grows monotonically through day.  */
/* ------------------------------------------------------------------ */

/**
 * Returns the "sold today" count for a given product, deterministic per (slug, day).
 * Value:
 *   • starts at FLOOR (default 5) at 00:00
 *   • ends at CEIL  (product-specific, in [25..95]) at 23:59
 *   • adds a tiny ±2 wobble that stays the same all day (so it doesn't look
 *     suspiciously round, but DOES NOT change as the user navigates the page).
 */
export function getSoldToday(slug, { floor = 5, now = new Date() } = {}) {
  if (!slug) return floor;
  const productSeed = hashSlug(slug);
  const daySeed = dayKey(now);

  // Daily peak: 25–95, biased upward for hot products (same product gets the
  // same peak every day → predictable for merchant, varies day-to-day with
  // the daySeed so it doesn't feel exactly identical week after week).
  const peakBase = 25 + Math.floor(seedRand(productSeed) * 70);          // 25..94
  const dailyJitter = Math.floor(seedRand(productSeed ^ daySeed) * 11) - 5; // -5..+5
  const peak = Math.max(floor + 10, Math.min(99, peakBase + dailyJitter));

  // Linear growth from floor → peak across the day, with a tiny "burst"
  // pattern: noon and 8pm get a small bump (mimics real shopping habits).
  const f = dayFraction(now);
  const lunchBump = Math.exp(-Math.pow((f - 0.5) * 8, 2)) * 0.06;   // peak at 12:00
  const eveningBump = Math.exp(-Math.pow((f - 0.83) * 6, 2)) * 0.10; // peak at 19:55
  const eased = Math.min(1, f + lunchBump + eveningBump);

  const value = floor + (peak - floor) * eased;

  // ±1 deterministic wobble, fixed for the day, so number doesn't look fake-round.
  const wobble = Math.floor(seedRand(productSeed ^ (daySeed + 1)) * 3) - 1;
  return Math.max(floor, Math.round(value + wobble));
}


/* ------------------------------------------------------------------ */
/*  Viewing now — fluctuates every minute, stable WITHIN a minute     */
/* ------------------------------------------------------------------ */

/**
 * Returns the "viewing now" count. Different per product, slowly fluctuates
 * over the day, but STABLE within the same minute (so clicking images on the
 * product page doesn't make it jump).
 */
export function getViewingNow(slug, { now = new Date() } = {}) {
  if (!slug) return 8;
  const productSeed = hashSlug(slug);

  // Per-minute bucket → only changes once a minute.
  const minuteBucket = Math.floor(now.getTime() / 60000);

  // Time-of-day baseline: lower at night, higher during shopping hours.
  const f = dayFraction(now);
  // 0..1 hump centered around 8pm (peak shopping), trough at 4am.
  const hump = 0.5 + 0.5 * Math.cos((f - 0.83) * 2 * Math.PI);
  const baseline = 6 + Math.round(hump * 18); // 6..24

  // Per-product offset (popular slugs get +up to 12).
  const offset = Math.floor(seedRand(productSeed) * 13);

  // Per-minute jitter (±3) so the number feels alive.
  const jitter = Math.floor(seedRand(productSeed ^ minuteBucket) * 7) - 3;

  return Math.max(3, baseline + offset + jitter);
}


/* ------------------------------------------------------------------ */
/*  Stock left — stable per product per day, very slow drain          */
/* ------------------------------------------------------------------ */

/**
 * Returns "only N left" — between 5 and 22. Decreases gently through the day
 * (matches the rising "sold today" narrative) but stays stable within a
 * 30-minute bucket so it doesn't visibly twitch.
 */
export function getStockLeft(slug, { now = new Date() } = {}) {
  if (!slug) return 12;
  const productSeed = hashSlug(slug);
  const daySeed = dayKey(now);

  const startStock = 12 + Math.floor(seedRand(productSeed ^ daySeed) * 11); // 12..22
  const f = dayFraction(now);
  const drainTotal = Math.floor(seedRand(productSeed) * 8) + 4;             // 4..11
  const drained = Math.floor(drainTotal * f);
  const remaining = startStock - drained;
  return Math.max(5, remaining);
}


/**
 * Convenience: returns all three at once.
 */
export function getSocialProof(slug, opts = {}) {
  return {
    viewingNow: getViewingNow(slug, opts),
    soldToday: getSoldToday(slug, opts),
    stockLeft: getStockLeft(slug, opts),
  };
}
