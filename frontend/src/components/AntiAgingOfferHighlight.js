import React from 'react';
import { Flame, Truck, Receipt, Sparkles, Clock } from 'lucide-react';
import { useSaleMode, isSaleOn } from '../utils/saleMode';

/**
 * Prominent "offer card" shown at the TOP of any anti-aging listing
 * (ShopPage?niche=anti-aging, ConcernCategoryPage anti-aging).
 *
 * Renders four value-props side-by-side:
 *   1. FLAT 50% OFF ribbon (dynamic percentage from admin config)
 *   2. Zero Tax
 *   3. Zero Delivery
 *   4. Ends-soon urgency
 *
 * Only renders when admin has flipped the sale switch ON and this page's niche
 * is included in applies_to_niches. Otherwise returns null (no layout impact).
 */
export default function AntiAgingOfferHighlight({ niche = 'anti-aging' }) {
  const sale = useSaleMode();
  if (!isSaleOn(sale, niche)) return null;

  const pct = Number(sale?.discount_percent || 50);
  const zeroTax = !!sale?.zero_tax;
  const zeroShip = !!sale?.zero_shipping;
  const urgencyLine = sale?.urgency_line || 'Offer ends soon — grab yours today';

  return (
    <section
      data-testid="anti-aging-offer-highlight"
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-5 sm:mb-8 shadow-lg ring-1 ring-amber-300/60"
    >
      {/* Warm gold gradient — mirrors the FLAT 50% OFF ribbon on product cards */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600" />
      {/* subtle noise / shimmer */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff2 0, transparent 40%), radial-gradient(circle at 80% 70%, #fff2 0, transparent 40%)' }}
      />

      <div className="relative px-4 sm:px-6 py-5 sm:py-6">
        {/* Row 1 — headline */}
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 bg-white/95 text-orange-700 font-black uppercase text-[11px] sm:text-xs tracking-widest px-3 py-1 rounded-full shadow">
            <Flame size={13} className="text-orange-600" />
            Live Now
          </span>
          <span className="text-white/90 text-[11px] sm:text-xs font-semibold uppercase tracking-widest hidden sm:inline">
            Anti-Aging Range
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-white font-black leading-tight text-2xl sm:text-4xl lg:text-5xl drop-shadow-sm">
              FLAT {pct}% OFF
              <span className="block text-white/90 text-sm sm:text-base font-medium tracking-wide mt-1">
                on the entire anti-aging range
              </span>
            </h2>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-black/25 text-white text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur">
            <Clock size={13} />
            {urgencyLine}
          </div>
        </div>

        {/* Row 3 — perk chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-5">
          <PerkChip
            icon={<Sparkles size={14} />}
            label={`${pct}% OFF price`}
            active
            testId="perk-flat-off"
          />
          {zeroShip && (
            <PerkChip
              icon={<Truck size={14} />}
              label="Zero Delivery"
              active
              testId="perk-zero-delivery"
            />
          )}
          {zeroTax && (
            <PerkChip
              icon={<Receipt size={14} />}
              label="Zero Tax"
              active
              testId="perk-zero-tax"
            />
          )}
        </div>

        {/* Row 4 — fine print, only if any zero-fee perk is on */}
        {(zeroTax || zeroShip) && (
          <p className="mt-4 text-[11px] sm:text-xs text-white/85 leading-relaxed">
            {zeroShip && zeroTax
              ? 'Delivery charges & platform tax waived automatically at checkout when your cart contains only anti-aging products.'
              : zeroShip
              ? 'Delivery charges waived automatically at checkout when your cart contains only anti-aging products.'
              : 'Platform tax waived automatically at checkout when your cart contains only anti-aging products.'}
          </p>
        )}
      </div>
    </section>
  );
}

function PerkChip({ icon, label, active, testId }) {
  return (
    <div
      data-testid={testId}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm text-white text-xs sm:text-sm font-semibold ${
        active ? 'bg-white/25 ring-1 ring-white/40' : 'bg-white/10 opacity-70'
      }`}
    >
      <span className="text-white/95">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
