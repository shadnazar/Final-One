import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { TrendingUp, IndianRupee, Package, CreditCard, ArrowRight, ShoppingBag } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * DailyOrdersPanel — top-of-dashboard widget that surfaces:
 *  - Today's orders count + revenue
 *  - Last 7-day totals
 *  - COD vs Prepaid split
 *  - Items sold today
 *
 * Backed by GET /api/admin/orders/daily-summary?days=30 — the endpoint returns
 * per-day totals which we aggregate client-side for the headline cards.
 */
export default function DailyOrdersPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = getAdminToken();

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API}/admin/orders/daily-summary?days=30`, { headers: { 'X-Admin-Token': token } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!data || !data.days) return null;

  const today = data.days[data.days.length - 1] || { orders: 0, revenue: 0, items_sold: 0, cod_pct: 0 };
  const last7 = data.days.slice(-7);
  const last7Orders = last7.reduce((s, d) => s + d.orders, 0);
  const last7Revenue = last7.reduce((s, d) => s + d.revenue, 0);
  const codTotal = last7.reduce((s, d) => s + d.cod_orders, 0);
  const codPct = last7Orders ? Math.round((codTotal / last7Orders) * 100) : 0;
  const aov = last7Orders ? Math.round(last7Revenue / last7Orders) : 0;

  // Peak revenue for sparkline scaling
  const peak = Math.max(1, ...last7.map((d) => d.revenue));

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-white to-stone-50 rounded-3xl ring-1 ring-emerald-100 p-4 sm:p-5 mb-6" data-testid="daily-orders-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.25em] uppercase text-emerald-700 mb-0.5">Sales Overview</p>
          <h3 className="font-heading text-base sm:text-lg font-black text-gray-900">Today &amp; Last 7 days</h3>
        </div>
        <Link to="/admin/orders" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1" data-testid="dop-view-orders">
          All orders <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          icon={ShoppingBag}
          color="emerald"
          label="Today's Orders"
          value={today.orders}
          sub={`${today.items_sold} items sold`}
        />
        <Card
          icon={IndianRupee}
          color="green"
          label="Today's Revenue"
          value={`₹${today.revenue.toLocaleString()}`}
          sub={`AOV ₹${today.orders ? Math.round(today.revenue / today.orders) : 0}`}
        />
        <Card
          icon={Package}
          color="indigo"
          label="7-day Orders"
          value={last7Orders}
          sub={`₹${last7Revenue.toLocaleString()} revenue`}
        />
        <Card
          icon={CreditCard}
          color="amber"
          label="COD share"
          value={`${codPct}%`}
          sub={`AOV (7d) ₹${aov}`}
        />
      </div>

      {/* Tiny revenue sparkline — 7 simple bars */}
      <div className="mt-4 pt-3 border-t border-emerald-100/60">
        <div className="flex items-end gap-1 h-12">
          {last7.map((d) => {
            const h = Math.max(6, Math.round((d.revenue / peak) * 48));
            const isToday = d.date === today.date;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end"
                title={`${d.date}: ₹${d.revenue.toLocaleString()} · ${d.orders} orders`}
              >
                <div
                  className={`w-full rounded-t-md transition-all ${isToday ? 'bg-emerald-700' : 'bg-emerald-300'}`}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium">
          {last7.map((d) => (
            <span key={d.date}>{d.date.slice(5)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

function Card({ icon: Icon, color = 'emerald', label, value, sub }) {
  const c = COLOR_MAP[color] || COLOR_MAP.emerald;
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 ring-1 ring-stone-200">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={14} className={c.text} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
