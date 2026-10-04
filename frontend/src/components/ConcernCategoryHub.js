import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { cldOptim } from '../utils/productImage';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Concern + Category hub for the Homepage.
 * Flipkart-inspired horizontal-scroll concern tabs at the very top,
 * then a premium "Shop by Concern" tile grid, then a "Shop by Category" tile grid
 * (Cleansers, Serums, Moisturizers, Sunscreens, Eye Care, Cosmetics & Makeup).
 */
export default function ConcernCategoryHub() {
  const [concerns, setConcerns] = useState([]);
  const [categories, setCategories] = useState([]);
  const tabsRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/concerns`).then(r => setConcerns(r.data || [])).catch(() => {});
    axios.get(`${API}/api/categories`).then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const scrollTabs = (dir) => {
    if (!tabsRef.current) return;
    tabsRef.current.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  const skincareCats = categories.filter(c => c.group !== 'cosmetics');
  const cosmeticsCats = categories.filter(c => c.group === 'cosmetics');

  return (
    <>
      {/* === HORIZONTAL CONCERN TABS (Flipkart-style sticky-feel) === */}
      {concerns.length > 0 && (
        <section className="bg-white border-b border-gray-100 relative" data-testid="concern-tabs">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 relative">
            <button
              onClick={() => scrollTabs(-1)}
              aria-label="Scroll left"
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md ring-1 ring-gray-200 items-center justify-center hover:bg-green-50"
            >
              <ChevronLeft size={16} className="text-green-700" />
            </button>
            <div
              ref={tabsRef}
              className="flex items-center gap-3 sm:gap-4 overflow-x-auto hide-scrollbar py-3 sm:py-4 px-2 sm:px-10 scroll-smooth"
            >
              <Link
                to="/shop"
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group min-w-[68px]"
                data-testid="concern-tab-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-100 to-green-50 ring-2 ring-green-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles size={22} className="text-green-700" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-green-800 leading-tight text-center">For You</span>
              </Link>
              {concerns.map(c => (
                <Link
                  key={c.slug}
                  to={`/concern/${c.slug}`}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 group min-w-[68px]"
                  data-testid={`concern-tab-${c.slug}`}
                >
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-green-400 transition-all"
                    style={{ background: `linear-gradient(135deg, ${c.accent_from || '#dcfce7'} 0%, ${c.accent_to || '#bbf7d0'} 100%)` }}
                  >
                    {c.image ? (
                      <img src={cldOptim(c.image, {w:200})} alt={c.name} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} className="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">{c.icon || '✨'}</div>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-800 leading-tight text-center max-w-[70px] line-clamp-2">
                    {c.name.split(' ')[0]}
                  </span>
                </Link>
              ))}
            </div>
            <button
              onClick={() => scrollTabs(1)}
              aria-label="Scroll right"
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md ring-1 ring-gray-200 items-center justify-center hover:bg-green-50"
            >
              <ChevronRight size={16} className="text-green-700" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}


/**
 * "Shop by Concern" — premium tile grid (used in main homepage flow)
 */
export function ShopByConcern() {
  const [concerns, setConcerns] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/concerns`).then(r => setConcerns(r.data || [])).catch(() => {});
  }, []);
  if (!concerns.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14" data-testid="shop-by-concern">
      <div className="text-center mb-8">
        <p className="text-[11px] font-bold tracking-[0.4em] text-green-700 uppercase mb-2">Solve Your Skin Concerns</p>
        <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
          Shop by <span className="italic text-green-700">Concern</span>
        </h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
          Pick your problem — we'll show you the routine that fixes it.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {concerns.map(c => (
          <Link
            key={c.slug}
            to={`/concern/${c.slug}`}
            className="group relative rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] hover:-translate-y-1 transition-all duration-500 hover:shadow-2xl"
            style={{ background: `linear-gradient(160deg, ${c.accent_from || '#dcfce7'} 0%, ${c.accent_to || '#bbf7d0'} 100%)` }}
            data-testid={`concern-tile-${c.slug}`}
          >
            {c.image && (
              <img src={cldOptim(c.image, {w:400})} alt={c.name} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-110" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg shadow-md">
              {c.icon || '✨'}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <h3 className="font-heading font-black text-white text-base sm:text-lg leading-tight mb-0.5">
                {c.name}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-white/85 line-clamp-1">{c.tagline}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-white bg-white/15 backdrop-blur px-2 py-1 rounded-full ring-1 ring-white/30 group-hover:bg-white group-hover:text-green-800 transition-colors">
                Shop now <ChevronRight size={11} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}


/**
 * "Shop by Category" — splits skincare vs cosmetics
 */
export function ShopByCategory() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/categories`).then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const skincare = categories.filter(c => c.group !== 'cosmetics');
  const cosmetics = categories.filter(c => c.group === 'cosmetics');

  if (!categories.length) return null;

  return (
    <section className="bg-gradient-to-b from-white via-stone-50/60 to-white" data-testid="shop-by-category">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Skincare strip */}
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold tracking-[0.4em] text-green-700 uppercase mb-2">Routine Builder</p>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
            Shop by <span className="italic text-green-700">Category</span>
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
            Build your perfect skincare routine, step by step.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 mb-10">
          {skincare.map(c => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className="group bg-white rounded-2xl ring-1 ring-gray-200 hover:ring-green-300 hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
              data-testid={`category-tile-${c.slug}`}
            >
              <div className="aspect-square overflow-hidden bg-gradient-to-br from-green-50 via-white to-stone-50 relative">
                {c.image ? (
                  <img src={cldOptim(c.image, {w:400})} alt={c.name} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} className="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">{c.icon || '🧴'}</div>
                )}
                <div className="absolute top-2 right-2 bg-white/95 backdrop-blur w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md">
                  {c.icon || '🧴'}
                </div>
              </div>
              <div className="p-3 text-center">
                <h3 className="font-bold text-gray-900 text-xs sm:text-sm leading-tight mb-0.5 group-hover:text-green-700 transition-colors">
                  {c.name}
                </h3>
                <p className="text-[10px] text-gray-500 line-clamp-1">{c.tagline}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Cosmetics & Makeup strip */}
        {cosmetics.length > 0 && (
          <div className="relative rounded-3xl overflow-hidden ring-1 ring-rose-100 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50/50 p-6 sm:p-8" data-testid="cosmetics-strip">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(244,114,182,0.25) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(251,146,60,0.18) 0%, transparent 50%)' }} />
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-[0.4em] text-rose-700 uppercase mb-1.5">Beauty Beyond Skincare</p>
                <h3 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-rose-950 leading-tight">
                  Cosmetics &amp; <span className="italic text-rose-700">Makeup</span>
                </h3>
                <p className="text-sm text-rose-900/75 mt-1">Lip · Cheek · Brow — formulated with skincare actives</p>
              </div>
              <Link
                to="/category/cosmetics-makeup"
                className="self-start sm:self-auto bg-rose-700 hover:bg-rose-800 text-white px-5 py-2.5 rounded-full text-xs font-black tracking-wide flex items-center gap-1.5 shadow-md shadow-rose-900/20 transition-all"
                data-testid="cosmetics-shop-all"
              >
                Shop all <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {cosmetics.map(c => (
                <Link
                  key={c.slug}
                  to={`/category/${c.slug}`}
                  className="bg-white/90 backdrop-blur rounded-2xl ring-1 ring-rose-100 hover:ring-rose-300 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden group"
                >
                  <div className="aspect-[5/4] overflow-hidden bg-gradient-to-br from-rose-50 to-pink-50">
                    {c.image ? (
                      <img src={cldOptim(c.image, {w:400})} alt={c.name} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} className="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">{c.icon || '💄'}</div>
                    )}
                  </div>
                  <div className="p-2.5 text-center">
                    <h4 className="font-bold text-rose-950 text-xs sm:text-sm leading-tight">{c.name}</h4>
                    <p className="text-[10px] text-rose-900/60 line-clamp-1">{c.tagline}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
