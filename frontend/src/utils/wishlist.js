/**
 * Wishlist — pure localStorage. No login required, persists across sessions.
 *
 * Shape on disk:
 *   localStorage["wishlist"] = ["product-slug-1", "product-slug-2", ...]
 *
 * Listens via window event "wishlistUpdated" so UI components stay in sync
 * across the page (e.g., heart icon on product cards toggles immediately).
 */
const KEY = 'wishlist';

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (slugs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {}
  try {
    window.dispatchEvent(new Event('wishlistUpdated'));
  } catch {}
};

export const getWishlist = () => read();

export const isWishlisted = (slug) => read().includes(slug);

export const toggleWishlist = (slug) => {
  if (!slug) return false;
  const items = read();
  const idx = items.indexOf(slug);
  if (idx > -1) {
    items.splice(idx, 1);
    write(items);
    return false;
  }
  items.push(slug);
  write(items);
  return true;
};

export const removeFromWishlist = (slug) => {
  const items = read().filter((s) => s !== slug);
  write(items);
};

export const clearWishlist = () => write([]);

export const wishlistCount = () => read().length;
