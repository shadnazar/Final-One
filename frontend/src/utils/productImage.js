/**
 * Resolve a product / category / concern image string to an absolute URL the
 * browser can load, with automatic Cloudinary transformations injected.
 *
 * Background: legacy admin uploads stored relative paths like
 * `/api/uploads/products/xxx.jpg`. New Cloudinary uploads are absolute
 * `https://res.cloudinary.com/...`. Both shapes coexist in the DB, so every
 * place that renders a product image must normalise.
 *
 *   - empty / null / undefined  → fallback placeholder
 *   - http://, https://, data:, blob: → returned as-is (Cloudinary URLs get
 *     optimised — see `cldOptim` below)
 *   - "/api/uploads/..." or any other "/..." → prefixed with REACT_APP_BACKEND_URL
 *
 * Performance fix (Feb-2026 P0): the admin uploads category images as
 * full-resolution PNGs (1.5+ MB each). On a customer's mobile 5G that's
 * 8-15 seconds of blank card per image. By injecting Cloudinary's
 * `f_auto,q_auto,w_<size>` transformation params at RENDER time we get:
 *   - automatic WebP/AVIF format (60-80% smaller than PNG)
 *   - automatic quality compression
 *   - resized to the actual display width (mobile category tile = ~400px)
 *
 * This is a zero-migration fix — DB URLs stay untouched, Cloudinary serves
 * the optimised variant on the fly and caches it on its CDN.
 */
const FALLBACK = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400';
const API_HOST = process.env.REACT_APP_BACKEND_URL || '';

// Matches a Cloudinary delivery URL captured into 3 groups:
//   1. host + /image/upload/   2. existing transforms (or empty)   3. rest (v123/path.png)
// Example match:
//   https://res.cloudinary.com/dtj1zuhkl/image/upload/v178159136/celesta-glow/...
//   →  ["…/upload/", "", "v178159136/celesta-glow/…"]
const CLD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)((?:[a-z0-9_,.-]+\/)*)?(v\d+\/[^?]+|.+)$/i;

/**
 * Inject Cloudinary optimisation params into an `image/upload` URL.
 *
 *   cldOptim('https://res.cloudinary.com/x/image/upload/v123/foo.png')
 *   → 'https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_400/v123/foo.png'
 *
 * If the URL already has a transformation segment (e.g. `f_auto,q_auto,w_800/`)
 * we leave it alone — admin-uploaded URLs almost never carry transforms, but
 * some internal endpoints do, and we must not stack them.
 */
export function cldOptim(url, opts = {}) {
  if (!url || typeof url !== 'string') return url;
  const m = url.match(CLD_RE);
  if (!m) return url;
  const [, base, existingTransforms, rest] = m;
  if (existingTransforms) return url;  // already optimised — don't double-stack
  const width = opts.w || opts.width || 400;
  const height = opts.h || opts.height || 0;
  const crop = opts.c || (height ? 'fill' : 'limit');
  const parts = ['f_auto', 'q_auto', `w_${width}`];
  if (height) parts.push(`h_${height}`);
  parts.push(`c_${crop}`);
  return `${base}${parts.join(',')}/${rest}`;
}

export function resolveImageUrl(raw, fallback = FALLBACK, opts = {}) {
  if (!raw) return fallback;
  const s = String(raw);
  if (/^(https?:|data:|blob:)/i.test(s)) {
    // Optimise Cloudinary URLs automatically at the boundary.
    return s.includes('res.cloudinary.com') ? cldOptim(s, opts) : s;
  }
  if (s.startsWith('/')) return `${API_HOST}${s}`;
  return s;
}

/** Get the primary image URL for a product, handling all known field shapes. */
export function productPrimaryImage(p, fallback = FALLBACK, opts = {}) {
  if (!p) return fallback;
  const raw =
    (Array.isArray(p.images) && p.images[0]) ||
    p.image_url ||
    p.image ||
    p.thumbnail ||
    null;
  return resolveImageUrl(raw, fallback, opts);
}
