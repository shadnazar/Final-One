import React from 'react';
import { Link } from 'react-router-dom';
import { Droplet, Flame, Sun, Snowflake, Sparkles } from 'lucide-react';

/**
 * SkinTypeQuickFilter — horizontal row of 4 chips (Oily / Dry / Combo / Sensitive)
 * that deep-link to /shop?niche=skincare&skin_type=... so users can find products
 * matching their skin type with one tap.
 */
const TYPES = [
  { id: 'oily', label: 'Oily',        icon: Droplet,    accent: '#0e7490' },
  { id: 'dry',          label: 'Dry',         icon: Snowflake,  accent: '#2563eb' },
  { id: 'combination',  label: 'Combination', icon: Sparkles,   accent: '#7c3aed' },
  { id: 'sensitive',    label: 'Sensitive',   icon: Flame,      accent: '#dc2626' },
  { id: 'normal',       label: 'Normal',      icon: Sun,        accent: '#0d9488' },
];

export default function SkinTypeQuickFilter({ accent = '#0e7490', accentDark = '#155e75' }) {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8" data-testid="skin-type-quick-filter">
      <div className="flex items-end justify-between mb-3 sm:mb-4 px-1">
        <div>
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1" style={{ color: accent }}>Personalized</p>
          <h2 className="font-heading text-base sm:text-xl lg:text-2xl font-black text-gray-900">
            Shop by <span className="italic" style={{ color: accent }}>skin type</span>
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {TYPES.map((t) => (
          <Link
            key={t.id}
            to={`/shop?niche=skincare&skin_type=${t.id}`}
            data-testid={`skin-type-${t.id}`}
            className="group bg-white rounded-2xl ring-1 ring-stone-200 hover:ring-2 hover:-translate-y-0.5 transition-all p-2.5 sm:p-4 text-center"
            style={{ '--accent': t.accent }}
          >
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-1.5 sm:mb-2 flex items-center justify-center transition-colors"
              style={{ backgroundColor: `${t.accent}15` }}
            >
              <t.icon size={18} style={{ color: t.accent }} />
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-gray-800 leading-tight">{t.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
