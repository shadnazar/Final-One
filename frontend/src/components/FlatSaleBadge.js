import React from 'react';
import { Flame } from 'lucide-react';

/**
 * FlatSaleBadge — 50% OFF pill for the global anti-aging sale mode.
 * Different from SaleBadge (which is the multi-offer promotional carousel).
 */
export default function FlatSaleBadge({ label = 'FLAT 50% OFF', overlay = true, size = 'sm' }) {
  const cls = size === 'lg'
    ? 'px-3 py-1.5 text-sm gap-1.5'
    : size === 'xs' ? 'px-1.5 py-0.5 text-[9px] gap-1' : 'px-2 py-1 text-[10px] gap-1';
  const positionCls = overlay ? 'absolute top-2 left-2 z-10' : 'inline-flex';
  return (
    <span
      className={`${positionCls} inline-flex items-center rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold uppercase tracking-wider shadow-md ${cls}`}
      data-testid="flat-sale-badge"
    >
      <Flame size={size === 'lg' ? 14 : 10} />
      {label}
    </span>
  );
}

export function FlatSaleStrip({ label = 'FLAT 50% OFF', urgency = 'Ends soon' }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600" data-testid="flat-sale-strip">
      <Flame size={11} className="text-red-500" />
      <span>{label}</span>
      <span className="text-red-400">·</span>
      <span className="text-red-500 font-normal">{urgency}</span>
    </div>
  );
}
