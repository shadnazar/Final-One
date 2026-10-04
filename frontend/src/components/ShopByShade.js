import React from 'react';
import { Link } from 'react-router-dom';
import { Palette } from 'lucide-react';

/**
 * ShopByShade — circular swatch strip for cosmetics home.
 * Curated shade families that deep-link to /shop?niche=cosmetics&shade_family=...
 *
 * Each chip is a colored circle + label. Mobile shows 5/row, desktop shows full row.
 */
const FAMILIES = [
  { id: 'nude',   label: 'Nude',   hex: '#d8a584' },
  { id: 'berry',  label: 'Berry',  hex: '#9d2356' },
  { id: 'red',    label: 'Red',    hex: '#c1121f' },
  { id: 'pink',   label: 'Pink',   hex: '#f48fb1' },
  { id: 'brown',  label: 'Brown',  hex: '#7b4b2a' },
  { id: 'coral',  label: 'Coral',  hex: '#ff6b6b' },
  { id: 'plum',   label: 'Plum',   hex: '#6d214f' },
  { id: 'mauve',  label: 'Mauve',  hex: '#c294a9' },
];

export default function ShopByShade({ accent = '#be185d' }) {
  return (
    <section className="bg-white border-b border-stone-100" data-testid="shop-by-shade">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7">
        <div className="flex items-end justify-between mb-3 sm:mb-4 px-1">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 flex items-center gap-2" style={{ color: accent }}>
              <Palette size={11} /> Find Your Shade
            </p>
            <h2 className="font-heading text-base sm:text-xl lg:text-2xl font-black text-gray-900">
              Shop by <span className="italic" style={{ color: accent }}>shade</span>
            </h2>
          </div>
        </div>
        <div className="flex gap-3 sm:gap-5 overflow-x-auto pb-2 sm:pb-0 sm:justify-around scrollbar-hide">
          {FAMILIES.map((f) => (
            <Link
              key={f.id}
              to={`/shop?niche=cosmetics&shade_family=${f.id}`}
              data-testid={`shade-family-${f.id}`}
              className="group flex flex-col items-center flex-shrink-0"
            >
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full ring-2 ring-white shadow-md transition-transform duration-300 group-hover:scale-110 group-active:scale-95"
                style={{ backgroundColor: f.hex }}
              />
              <span className="mt-2 text-[11px] sm:text-xs font-bold text-stone-800">{f.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
