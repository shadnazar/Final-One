import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import axios from 'axios';
import BackButton from '../components/BackButton';
import CircularCategoryStrip from '../components/CircularCategoryStrip';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCENT = '#0f766e';

/* ---------- Simple section header ---------- */
function SectionHeader({ title, accent }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-stone-900 leading-tight tracking-tight">
        {title}
      </h2>
      <div className="mt-2 h-[3px] w-12 rounded-full" style={{ background: accent }} />
    </div>
  );
}

/* ---------- Banner card — button only, no text ---------- */
function BannerButton({ to, label, accent, bg }) {
  return (
    <Link
      to={to}
      data-testid={`banner-btn-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="flex items-center justify-center rounded-2xl px-6 py-4 text-white font-black text-sm sm:text-base tracking-wide shadow-md hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95 gap-2"
      style={{ background: bg || accent }}
    >
      {label}
      <ArrowRight size={16} />
    </Link>
  );
}

/* =====================================================================
   MAIN PAGE
   ===================================================================== */
export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API}/api/categories`),
      axios.get(`${API}/api/concerns`),
    ])
      .then(([c, cn]) => {
        if (cancelled) return;
        setCategories(c.data || []);
        setConcerns(cn.data || []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activeConcerns = concerns;
  const activeCategories = categories.filter(c => c.is_active !== false);

  return (
    <div className="bg-white pb-16" data-testid="categories-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4">
        <BackButton />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-6 sm:mt-10 space-y-10 sm:space-y-14">

        {/* ── SHOP BY CONCERN ── */}
        <section data-testid="categories-concern-section">
          <SectionHeader title="Shop by Concern" accent={ACCENT} />
          {loading ? (
            <div className="flex gap-4 overflow-x-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] rounded-full bg-stone-100" />
                  <div className="h-3 w-14 bg-stone-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <CircularCategoryStrip
              items={activeConcerns}
              routePrefix="/concern"
              accent={ACCENT}
              testIdPrefix="cat-concern"
              blankCircles={true}
            />
          )}
        </section>

        {/* ── SHOP BY CATEGORY ── */}
        <section data-testid="categories-category-section">
          <SectionHeader title="Shop by Category" accent={ACCENT} />
          {loading ? (
            <div className="flex gap-4 overflow-x-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] rounded-full bg-stone-100" />
                  <div className="h-3 w-14 bg-stone-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <CircularCategoryStrip
              items={activeCategories}
              routePrefix="/category"
              accent={ACCENT}
              testIdPrefix="cat-category"
              blankCircles={true}
            />
          )}
        </section>

        {/* ── BANNER SECTION — buttons only, no text ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="categories-banners">
          <BannerButton
            to="/concern"
            label="Shop by Concern"
            bg="linear-gradient(135deg, #0f766e 0%, #0891b2 100%)"
          />
          <BannerButton
            to="/shop"
            label="Shop Products"
            bg="linear-gradient(135deg, #15803d 0%, #0f766e 100%)"
          />
        </section>

      </div>
    </div>
  );
}
