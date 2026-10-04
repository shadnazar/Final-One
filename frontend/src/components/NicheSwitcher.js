import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * NicheSwitcher — Flipkart-style top 3-pill switcher rendered above the brand bar.
 * One pill = one niche destination home page.
 *   anti-aging  -> /          (flagship Celesta Glow brand line)
 *   skincare    -> /skincare  (broader concerns + categories)
 *   cosmetics   -> /cosmetics (lip / eye / face / brow makeup)
 */
export default function NicheSwitcher() {
  const [niches, setNiches] = useState([]);
  const location = useLocation();

  useEffect(() => {
    axios.get(`${API}/api/niches`).then(r => setNiches(r.data || [])).catch(() => {});
  }, []);

  if (!niches.length) return null;

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/' || location.pathname === '/skin-care';
    return location.pathname.startsWith(route);
  };

  return (
    <section
      className="bg-white border-b border-stone-200/80 sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
      data-testid="niche-switcher"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {niches.map(n => {
            const active = isActive(n.route);
            return (
              <Link
                key={n.slug}
                to={n.route}
                data-testid={`niche-pill-${n.slug}`}
                className={`group relative flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all overflow-hidden ${
                  active ? 'shadow-md shadow-black/5 scale-[1.01]' : 'bg-stone-50 hover:bg-white ring-1 ring-stone-200/60 hover:ring-stone-300/80'
                }`}
                style={
                  active
                    ? { background: `linear-gradient(135deg, ${n.accent_from} 0%, ${n.accent_to} 100%)`, color: n.accent_text }
                    : { color: '#4b5563' }
                }
              >
                {active && (
                  <span className="absolute inset-x-0 top-0 h-1/2 opacity-50 pointer-events-none rounded-t-xl" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)' }} />
                )}
                <span className="relative text-base sm:text-lg leading-none">{n.icon}</span>
                <div className="relative flex flex-col items-start leading-tight">
                  <span className={`font-black tracking-tight text-[12px] sm:text-[13px] md:text-sm whitespace-nowrap ${active ? '' : ''}`}>
                    {n.name.replace('& ', '& ')}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] font-medium hidden md:block whitespace-nowrap ${active ? '' : 'text-gray-400'}`}
                    style={active ? { color: n.accent_text, opacity: 0.7 } : {}}
                  >
                    {n.tagline}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
