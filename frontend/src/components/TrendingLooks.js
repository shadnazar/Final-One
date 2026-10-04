import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cldOptim } from '../utils/productImage';

/**
 * TrendingLooks — 4-tile grid for cosmetics home page showcasing different
 * looks (Bridal / Everyday / Bold / Office). Each deep-links to a curated
 * /shop?niche=cosmetics&look=... query so the admin can later tag products
 * with these looks for filtering.
 */
const LOOKS = [
  {
    id: 'bridal',
    label: 'Bridal',
    tagline: 'For your big day',
    image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=600&q=70',
    overlay: 'from-rose-900/55 via-rose-800/30 to-transparent',
  },
  {
    id: 'everyday',
    label: 'Everyday',
    tagline: 'Light & natural',
    image: 'https://images.unsplash.com/photo-1522335789203-aaa83f04a83a?auto=format&fit=crop&w=600&q=70',
    overlay: 'from-amber-900/50 via-amber-800/25 to-transparent',
  },
  {
    id: 'bold',
    label: 'Bold',
    tagline: 'Make a statement',
    image: 'https://images.unsplash.com/photo-1503236823255-94609f598e71?auto=format&fit=crop&w=600&q=70',
    overlay: 'from-violet-900/55 via-violet-800/30 to-transparent',
  },
  {
    id: 'office',
    label: 'Office',
    tagline: 'Polished & professional',
    image: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=70',
    overlay: 'from-stone-900/55 via-stone-800/30 to-transparent',
  },
];

export default function TrendingLooks({ accent = '#be185d' }) {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12" data-testid="trending-looks">
      <div className="flex items-end justify-between mb-4 sm:mb-6 px-1">
        <div>
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 flex items-center gap-2" style={{ color: accent }}>
            <Sparkles size={11} /> Inspiration
          </p>
          <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
            Trending <span className="italic" style={{ color: accent }}>looks</span>
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {LOOKS.map((l) => (
          <Link
            key={l.id}
            to={`/shop?niche=cosmetics&look=${l.id}`}
            data-testid={`look-${l.id}`}
            className="group relative aspect-[3/4] rounded-3xl overflow-hidden ring-1 ring-stone-200 hover:-translate-y-1 hover:shadow-2xl transition-all"
          >
            <img
              src={l.image}
              alt={l.label}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${l.overlay}`} />
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
              <p className="font-heading text-base sm:text-xl font-black tracking-tight">{l.label}</p>
              <p className="text-[11px] sm:text-xs opacity-90 mt-0.5">{l.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
