import { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

let _cache = null;
let _promise = null;
const _subs = new Set();

async function _load() {
  if (_promise) return _promise;
  _promise = axios.get(`${API}/sale-mode`).then(r => {
    _cache = r.data || null;
    _subs.forEach(fn => { try { fn(_cache); } catch (_) { /* noop */ } });
    return _cache;
  }).catch(() => { _cache = null; return null; });
  return _promise;
}

/**
 * useSaleMode() — reactive hook for the global 50% OFF anti-aging switch.
 * Cached in-memory so every product card / cart line / banner reads the
 * same object without hitting the API repeatedly. When admin flips the
 * switch, any component using this hook re-renders on next mount.
 */
export function useSaleMode() {
  const [state, setState] = useState(_cache);
  useEffect(() => {
    if (!_cache) _load().then(setState);
    else setState(_cache);
    _subs.add(setState);
    return () => { _subs.delete(setState); };
  }, []);
  return state;
}

export function isSaleOn(saleMode, niche) {
  if (!saleMode || !saleMode.enabled) return false;
  const niches = saleMode.applies_to_niches || ['anti-aging'];
  if (!niche) return niches.length > 0;
  return niches.includes(String(niche).toLowerCase());
}

/** Applies the sale discount to a base price if the item's niche qualifies. */
export function applySale(saleMode, niche, basePrice) {
  const price = Number(basePrice || 0);
  if (!isSaleOn(saleMode, niche)) return { price, mrp: price, saved: 0, applied: false };
  const pct = Number(saleMode.discount_percent || 50);
  const discounted = Math.round(price * (1 - pct / 100));
  return { price: discounted, mrp: price, saved: price - discounted, applied: true, pct };
}

export function refreshSaleMode() {
  _promise = null;
  _cache = null;
  return _load();
}
