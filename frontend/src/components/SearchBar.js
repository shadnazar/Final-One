import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Sparkles } from 'lucide-react';
import axios from 'axios';
import { productPrimaryImage } from '../utils/productImage';

const API = process.env.REACT_APP_BACKEND_URL;

/* simple in-memory cache, keyed by `niche` (or 'all'). Refreshed every 5 min. */
const CACHE = { data: {}, t: 0 };

/**
 * Premium search bar with **niche-scoped autocomplete**.
 *
 * @param accent  hex theme color
 * @param niche   one of 'anti-aging' | 'skincare' | 'cosmetics' | undefined → all niches
 * @param testId  test ID prefix
 *
 * Behaviour:
 *  - As user types, suggestions matching `name` / `short_name` / `key_ingredients`
 *    within the niche scope are surfaced inline.
 *  - Tap a suggestion → navigate directly to its product page.
 *  - Pressing Enter with no selection → /shop?q=<query>&niche=<niche>
 */
export default function SearchBar({ accent = '#16a34a', niche, testId = 'home-search-bar' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [allProducts, setAllProducts] = useState([]);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  /* Fetch products in scope (cached) */
  useEffect(() => {
    const key = niche || 'all';
    const fresh = Date.now() - CACHE.t < 5 * 60 * 1000;
    if (fresh && CACHE.data[key]) {
      setAllProducts(CACHE.data[key]);
      return;
    }
    const url = niche ? `${API}/api/products?niche=${niche}` : `${API}/api/products`;
    axios.get(url)
      .then(r => {
        CACHE.data[key] = r.data || [];
        CACHE.t = Date.now();
        setAllProducts(r.data || []);
      })
      .catch(() => setAllProducts([]));
  }, [niche]);

  /* Click-outside close */
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || s.length < 1) return [];
    return allProducts
      .filter(p => {
        const hay = `${p.name || ''} ${p.short_name || ''} ${p.tagline || ''} ${p.key_ingredients || ''} ${p.category || ''}`.toLowerCase();
        return hay.includes(s);
      })
      .slice(0, 12);
  }, [q, allProducts]);

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = q.trim();
    // Pressing Enter:
    //   1. If a suggestion is highlighted (arrow keys), open it directly.
    //   2. Otherwise if there are suggestions, open the FIRST one — this
    //      means the user never lands on a separate /shop loading-skeleton
    //      page; the search experience stays inline.
    //   3. Only when there are zero matches do we fall back to /shop?q=...
    //      (with the empty-state UI in the dropdown the user usually clicks
    //      "Browse all in Shop" instead).
    if (highlight >= 0 && suggestions[highlight]) {
      navigate(`/product/${suggestions[highlight].slug}`);
      setOpen(false);
      setQ('');
      return;
    }
    if (suggestions.length > 0) {
      navigate(`/product/${suggestions[0].slug}`);
      setOpen(false);
      setQ('');
      return;
    }
    if (!trimmed) return;
    const params = new URLSearchParams({ q: trimmed });
    if (niche) params.set('niche', niche);
    navigate(`/shop?${params.toString()}`);
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const placeholder = niche === 'anti-aging'
    ? 'Search anti-aging products, ingredients…'
    : niche === 'skincare'
      ? 'Search skincare products, concerns…'
      : niche === 'cosmetics'
        ? 'Search makeup, lipsticks, eyeshadows…'
        : 'Search for products, concerns…';

  return (
    <section className="bg-white" data-testid={testId}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div ref={wrapperRef} className="relative">
          <form onSubmit={submit} className="relative group">
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-md"
              style={{ background: `linear-gradient(135deg, ${accent}40 0%, transparent 70%)` }}
            />
            <div className="relative flex items-center bg-white border border-stone-200 group-focus-within:border-stone-300 rounded-2xl shadow-sm transition-all">
              <Search size={18} className="ml-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); setHighlight(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKey}
                placeholder={placeholder}
                style={{ fontSize: '16px' }}
                className="flex-1 px-3 py-3 sm:py-3.5 bg-transparent text-sm sm:text-[15px] focus:outline-none placeholder-gray-400"
                data-testid="search-input"
                autoComplete="off"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="mr-1 w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-gray-400"
                  data-testid="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete dropdown */}
          {open && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 bg-white rounded-2xl ring-1 ring-stone-200 shadow-2xl shadow-stone-900/10 overflow-hidden z-30"
              data-testid="search-suggestions"
            >
              <p className="px-3 pt-3 pb-1 text-[10px] font-black tracking-[0.2em] uppercase text-stone-400">
                {suggestions.length} matches
              </p>
              <ul className="max-h-[60vh] overflow-y-auto">
                {suggestions.map((p, i) => (
                  <li key={p.slug}>
                    <Link
                      to={`/product/${p.slug}`}
                      onClick={() => { setOpen(false); setQ(''); }}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        i === highlight ? 'bg-stone-100' : 'hover:bg-stone-50'
                      }`}
                      data-testid={`search-suggestion-${p.slug}`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-50 to-stone-100 ring-1 ring-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? (
                          <img src={productPrimaryImage(p)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles size={16} className="text-stone-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900 truncate">{p.short_name || p.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {p.tagline || p.key_ingredients || p.category}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-sm font-black" style={{ color: accent }}>₹{p.prepaid_price}</span>
                        {p.mrp > p.prepaid_price && (
                          <span className="text-[10px] line-through text-stone-400">₹{p.mrp}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {/* No "See all" footer — results are now rich enough to be the
                  primary search experience. Press Enter or tap a row to open
                  the product directly without navigating to a loading skeleton. */}
            </div>
          )}
          {open && q.trim().length >= 1 && suggestions.length === 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl ring-1 ring-stone-200 shadow-xl px-4 py-5 text-center text-sm text-stone-500 z-30" data-testid="search-no-results">
              No products match "{q}".
              <button
                type="button"
                onClick={submit}
                className="block mx-auto mt-2 font-bold underline"
                style={{ color: accent }}
              >
                Browse all in Shop →
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
