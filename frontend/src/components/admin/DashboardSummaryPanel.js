import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, IndianRupee, Package, BarChart3, Target, AlertTriangle, Star, Stethoscope, Activity } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * DashboardSummaryPanel — top-row widgets for admin dashboard.
 *
 * Renders 4 KPI cards + 4 action items + activity feed in a tight layout.
 * Auto-refreshes every 30 seconds.
 */
export default function DashboardSummaryPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const adminToken = getAdminToken();

  const load = async () => {
    if (!adminToken) return;
    try {
      const r = await axios.get(`${API}/admin/dashboard/summary`, { headers: { 'X-Admin-Token': adminToken } });
      setData(r.data);
    } catch (e) {
      console.error('[dashboard] failed', e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-stone-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }
  if (!data) return null;

  const { today, yesterday, action_items, last_7d, last_30d, daily_chart_30d, top_skus_30d, activity_feed, payment_split_30d } = data;

  const trend = (curr, prev) => {
    if (!prev) return null;
    const pct = ((curr - prev) / prev * 100);
    const positive = pct >= 0;
    return { pct: pct.toFixed(1), positive };
  };
  const salesTrend = trend(today.sales, yesterday.sales);
  const ordersTrend = trend(today.orders, yesterday.orders);

  const KPICard = ({ icon: Icon, label, value, subline, trendData, color = 'emerald', testid }) => {
    const colorMap = {
      emerald: 'from-emerald-50 to-white text-emerald-700 ring-emerald-100',
      blue: 'from-blue-50 to-white text-blue-700 ring-blue-100',
      amber: 'from-amber-50 to-white text-amber-700 ring-amber-100',
      purple: 'from-purple-50 to-white text-purple-700 ring-purple-100',
    };
    return (
      <div className={`bg-gradient-to-br ${colorMap[color]} ring-1 rounded-2xl p-4`} data-testid={testid}>
        <div className="flex items-start justify-between mb-2">
          <Icon size={18} />
          {trendData && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trendData.positive ? 'text-emerald-700' : 'text-rose-600'}`}>
              {trendData.positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {trendData.positive ? '+' : ''}{trendData.pct}%
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl sm:text-2xl font-black text-stone-900 mb-0.5">{value}</p>
        {subline && <p className="text-[11px] text-stone-500">{subline}</p>}
      </div>
    );
  };

  const ActionCard = ({ icon: Icon, label, count, color, testid }) => (
    <div className={`flex items-center gap-3 bg-white rounded-xl p-3 ring-1 ring-stone-100 ${count > 0 ? 'shadow-sm' : 'opacity-70'}`} data-testid={testid}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${count > 0 ? color : 'bg-stone-100 text-stone-400'}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-black text-stone-900">{count}</p>
      </div>
    </div>
  );

  // Sparkline / mini chart of 30-day daily revenue
  const maxSales = Math.max(1, ...daily_chart_30d.map(d => d.sales));

  return (
    <div className="mb-6" data-testid="dashboard-summary-panel">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard icon={IndianRupee} label="Today's Sales" value={`₹${today.sales.toLocaleString('en-IN')}`} subline={`${today.orders} orders`} trendData={salesTrend} color="emerald" testid="kpi-today-sales" />
        <KPICard icon={Package} label="Today's Orders" value={today.orders} subline={`yesterday: ${yesterday.orders}`} trendData={ordersTrend} color="blue" testid="kpi-today-orders" />
        <KPICard icon={BarChart3} label="Today's AOV" value={`₹${today.aov.toLocaleString('en-IN')}`} subline="avg order value" color="purple" testid="kpi-today-aov" />
        <KPICard icon={Target} label="Conversion" value={`${today.conversion}%`} subline={`${today.visits || '—'} visits`} color="amber" testid="kpi-conversion" />
      </div>

      {/* Action items row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ActionCard icon={Package} label="Pending Orders" count={action_items.pending_orders} color="bg-blue-100 text-blue-700" testid="action-pending-orders" />
        <ActionCard icon={AlertTriangle} label="Low Stock SKUs" count={action_items.low_stock_skus} color="bg-amber-100 text-amber-700" testid="action-low-stock" />
        <ActionCard icon={Star} label="Pending Reviews" count={action_items.pending_reviews} color="bg-purple-100 text-purple-700" testid="action-pending-reviews" />
        <ActionCard icon={Stethoscope} label="Consultations" count={action_items.pending_consultations} color="bg-emerald-100 text-emerald-700" testid="action-pending-consultations" />
      </div>

      {/* Charts + activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 30-day revenue mini chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 ring-1 ring-stone-100" data-testid="chart-30d-revenue">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">30-day revenue</p>
            <div className="flex gap-3 text-[11px]">
              <span className="text-stone-500">7d: <b className="text-stone-900">₹{last_7d.sales.toLocaleString('en-IN')}</b></span>
              <span className="text-stone-500">30d: <b className="text-stone-900">₹{last_30d.sales.toLocaleString('en-IN')}</b></span>
            </div>
          </div>
          {daily_chart_30d.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-12 text-center">No orders in the last 30 days.</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {daily_chart_30d.map((d, i) => {
                const h = Math.max(2, (d.sales / maxSales) * 100);
                return (
                  <div key={i} className="flex-1 bg-emerald-200 hover:bg-emerald-400 rounded-t transition-colors group relative" style={{ height: `${h}%` }} title={`${d.day}: ₹${d.sales}`}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-stone-700 bg-white shadow rounded px-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">₹{d.sales}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-2xl p-4 ring-1 ring-stone-100" data-testid="dashboard-activity-feed">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-emerald-600" />
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Recent activity</p>
          </div>
          {activity_feed.length === 0 ? (
            <p className="text-xs text-stone-400 italic">No activity yet.</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activity_feed.map((ev, i) => (
                <li key={i} className="text-xs flex items-start gap-2 border-b border-stone-100 pb-2 last:border-b-0" data-testid={`activity-${i}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${ev.type === 'new_order' ? 'bg-emerald-500' : ev.type === 'bulk_status_change' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-700 truncate">
                      {ev.type === 'new_order' && (<><b>New order</b> {ev.order_id} · {ev.customer} · ₹{ev.amount}</>)}
                      {ev.type === 'note_added' && (<><b>Note</b> on {ev.order_id}: "{(ev.note || '').slice(0, 50)}"</>)}
                      {ev.type === 'bulk_status_change' && (<><b>Status</b> on {ev.order_id}</>)}
                      {!['new_order','note_added','bulk_status_change'].includes(ev.type) && (<><b>{ev.type}</b> on {ev.order_id}</>)}
                    </p>
                    <p className="text-[10px] text-stone-400">{ev.ts ? new Date(ev.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top SKUs + payment split */}
      {(top_skus_30d.length > 0 || payment_split_30d.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
          <div className="lg:col-span-2 bg-white rounded-2xl p-4 ring-1 ring-stone-100" data-testid="dashboard-top-skus">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Top SKUs · 30 days</p>
            {top_skus_30d.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No data yet.</p>
            ) : (
              <ul className="space-y-2">
                {top_skus_30d.map((s, i) => (
                  <li key={s.slug} className="flex items-center gap-3 text-sm" data-testid={`top-sku-${i}`}>
                    <span className="w-5 text-xs font-bold text-stone-400 text-right">#{i+1}</span>
                    {s.image ? <img src={s.image} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-stone-100" />}
                    <span className="flex-1 truncate text-stone-800">{s.name}</span>
                    <span className="text-xs text-stone-500">{s.qty} sold</span>
                    <span className="text-xs font-bold text-stone-900 w-20 text-right">₹{s.revenue.toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 ring-1 ring-stone-100" data-testid="dashboard-payment-split">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Payment split · 30 days</p>
            {payment_split_30d.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No data yet.</p>
            ) : (
              <ul className="space-y-2">
                {payment_split_30d.map(p => {
                  const totalAll = payment_split_30d.reduce((s, x) => s + x.count, 0) || 1;
                  const pct = ((p.count / totalAll) * 100).toFixed(0);
                  return (
                    <li key={p.method} className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-stone-700 font-semibold">{p.method}</span>
                        <span className="text-xs text-stone-500">{p.count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
