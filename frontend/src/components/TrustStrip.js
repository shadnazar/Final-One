import React from 'react';
import { Truck, ShieldCheck, Leaf, Headphones } from 'lucide-react';

/**
 * 4-column premium trust strip (per reference design).
 * 24H Dispatch · Dermatologically Tested · Clean & Safe · Expert Support
 */
export default function TrustStrip({ accent = '#16a34a', accentBg = '#dcfce7' }) {
  const items = [
    { Icon: Truck,        label: '24H Dispatch',           sub: 'Fast Delivery' },
    { Icon: ShieldCheck,  label: 'Dermatologically',       sub: 'Tested' },
    { Icon: Leaf,         label: 'Clean & Safe',           sub: 'Ingredients' },
    { Icon: Headphones,   label: 'Expert',                 sub: 'Support' },
  ];

  return (
    <section className="px-3 sm:px-6" data-testid="trust-strip">
      <div className="max-w-7xl mx-auto bg-white border border-stone-200/80 rounded-2xl sm:rounded-3xl py-3 sm:py-5 px-3 sm:px-5 grid grid-cols-4 gap-2 sm:gap-4 shadow-sm">
        {items.map(({ Icon, label, sub }) => (
          <div key={label} className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <span
              className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center"
              style={{ background: accentBg }}
            >
              <Icon size={16} strokeWidth={2} style={{ color: accent }} />
            </span>
            <div>
              <div className="text-[10px] sm:text-[13px] font-black text-gray-900 leading-tight">{label}</div>
              <div className="text-[9px] sm:text-[11px] text-gray-500 leading-tight">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
