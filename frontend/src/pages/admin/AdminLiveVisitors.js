import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Activity, Users, Eye, Clock, Cookie, BadgePercent, Search,
  RefreshCw, ChevronLeft, MapPin, Phone, X, Smartphone, Monitor,
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const REFRESH_MS = 5_000; // 5-second auto-refresh for live data

const getAdminHeaders = () => ({ 'X-Admin-Token': getAdminToken() || '' });

const Stat = ({ icon: Icon, label, value, accent = 'green' }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${accent}-50`}>
        <Icon className={`w-5 h-5 text-${accent}-600`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-gray-500 font-bold">{label}</div>
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</div>
      </div>
    </div>
  </div>
);

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatPageName(page, productNames = {}) {
  if (!page) return '/';
  if (page === '/') return 'Homepage';
  // Product page — show the friendly product name instead of the raw slug
  // so admins can see WHICH product the visitor is looking at.
  const m = page.match(/^\/product\/([^/?#]+)/);
  if (m) {
    const slug = m[1];
    const name = productNames[slug];
    return name ? `Product · ${name}` : `Product · ${slug}`;
  }
  if (page.startsWith('/shop')) return 'Shop';
  if (page.startsWith('/cart')) return 'Cart';
  if (page.startsWith('/checkout')) return 'Checkout';
  if (page.startsWith('/concern/')) return `Concern · ${page.split('/')[2] || ''}`;
  if (page.startsWith('/category/')) return `Category · ${page.split('/')[2] || ''}`;
  if (page.startsWith('/routine')) return 'Routine Generator';
  if (page.startsWith('/consultation')) return 'Doctor Consultation';
  if (page.startsWith('/investor') || page.startsWith('/invest')) return 'Investor Form';
  if (page.startsWith('/skin-issue') || page.startsWith('/skin-advice')) return 'Skin Advice Form';
  return page.length > 30 ? page.slice(0, 30) + '…' : page;
}

function formatTimeAgo(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function AdminLiveVisitors() {
  const [authChecked, setAuthChecked] = useState(false);
  const [live, setLive] = useState({ total: 0, by_page: {} });
  const [stats, setStats] = useState({});
  const [visitors, setVisitors] = useState([]);
  // Slug → short_name map so live visitor rows can show the actual product
  // name instead of the raw /product/{slug} path. Bumped to 1000 so brands
  // with large catalogs don't drop product names for shoppers on the "tail".
  const [productNames, setProductNames] = useState({});
  useEffect(() => {
    axios.get(`${API}/api/products?limit=1000`).then((r) => {
      const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
      const map = {};
      items.forEach((p) => { if (p.slug) map[p.slug] = p.short_name || p.name || p.slug; });
      setProductNames(map);
    }).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | claimed | accepted_cookies | mobile | desktop
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Auth gate
  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      window.location.href = '/admin';
      return;
    }
    setAuthChecked(true);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      // Fire BOTH endpoints in parallel:
      //   • /admin/analytics/live  — legacy in-memory enhanced_analytics (fast,
      //     but resets on pod restart)
      //   • /admin/visitors/active — Mongo-backed TTL pings (durable, exact
      //     "X people on /product/Y right now" feed)
      // We prefer Mongo numbers when available because they survive deploys.
      const [legacy, mongo] = await Promise.allSettled([
        axios.get(`${API}/admin/analytics/live`, { headers: getAdminHeaders() }),
        axios.get(`${API}/admin/visitors/active`, { headers: getAdminHeaders() }),
      ]);

      const legacyData = legacy.status === 'fulfilled' ? legacy.value.data : {};
      const mongoData  = mongo.status  === 'fulfilled' ? mongo.value.data  : {};

      // Merge — Mongo wins on `total` and `by_page` if it has data.
      let total = legacyData?.live_visitors?.total ?? 0;
      let byPage = legacyData?.live_visitors?.by_page || {};
      if (mongoData?.success) {
        total = mongoData.count;
        byPage = Object.fromEntries(mongoData.by_page || []);
      }
      setLive({ total, by_page: byPage });

      // Surface the live ping rows for the table (replaces the 7-day legacy
      // visitors list when Mongo data is fresher).
      if (mongoData?.success && Array.isArray(mongoData.visitors)) {
        setVisitors(mongoData.visitors.map(v => ({
          visitor_id:        v.session_id,
          current_page:      v.path,
          last_seen:         v.last_seen,
          first_seen:        v.first_seen,
          niche:             v.niche,
          product_slug:      v.product_slug,
          customer_email:    v.customer_email,
          customer_phone:    v.customer_phone,
          customer_name:     v.customer_name,
          referrer:          v.referrer,
          page_title:        v.title,
          ping_count:        v.ping_count,
          source:            'mongo',
        })));
      }

      setStats({
        total_visits: legacyData?.total_visits,
        page_totals: legacyData?.page_totals || {},
        top_locations: legacyData?.top_locations || [],
      });
      setLastRefresh(new Date());
    } catch (e) {
      // Silent fail - show last good data
    }
  }, []);

  const fetchVisitors = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/user-tracking/visitors?days=7`, {
        headers: getAdminHeaders(),
      });
      setVisitors(r.data?.visitors || []);
    } catch (e) {
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!authChecked) return;
    fetchLive();
    fetchVisitors();
  }, [authChecked, fetchLive, fetchVisitors]);

  // Auto-refresh live data
  useEffect(() => {
    if (!autoRefresh || !authChecked) return;
    const i = setInterval(() => fetchLive(), REFRESH_MS);
    return () => clearInterval(i);
  }, [autoRefresh, authChecked, fetchLive]);

  // Filtering
  const filteredVisitors = useMemo(() => {
    let list = visitors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.visitor_id || '').toLowerCase().includes(q) ||
        (v.phone || '').includes(q) ||
        (v.last_page || '').toLowerCase().includes(q) ||
        (v.location?.city || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'claimed') list = list.filter(v => v.discount_claimed);
    if (filter === 'accepted_cookies') list = list.filter(v => v.cookie_consent === 'accepted');
    if (filter === 'mobile') list = list.filter(v => (v.device_type || '').includes('mobile'));
    if (filter === 'desktop') list = list.filter(v => (v.device_type || '').includes('desktop'));
    return list;
  }, [visitors, search, filter]);

  const openJourney = async (visitor) => {
    setSelectedVisitor(visitor);
    setJourney(null);
    setJourneyLoading(true);
    try {
      const r = await axios.get(`${API}/admin/user-tracking/visitor/${visitor.visitor_id}`, {
        headers: getAdminHeaders(),
      });
      setJourney(r.data || {});
    } catch {
      setJourney({ error: 'Failed to load journey' });
    } finally {
      setJourneyLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sort live by_page entries by visitor count
  const liveByPage = Object.entries(live.by_page || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="text-green-600" size={20} />
                Live Visitors
              </h1>
              <p className="text-xs text-gray-500">
                {lastRefresh
                  ? `Updated ${formatTimeAgo(lastRefresh.toISOString())}`
                  : 'Loading…'}
                {autoRefresh && <span className="ml-2 text-green-600">● Auto-refresh on</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                autoRefresh
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={() => { fetchLive(); fetchVisitors(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={Users} label="Live now" value={live.total} accent="green" />
          <Stat icon={Eye} label="Total visits (7d)" value={visitors.length} accent="blue" />
          <Stat
            icon={BadgePercent}
            label="Discounts claimed"
            value={visitors.filter(v => v.discount_claimed).length}
            accent="purple"
          />
          <Stat
            icon={Cookie}
            label="Cookie accepted"
            value={visitors.filter(v => v.cookie_consent === 'accepted').length}
            accent="orange"
          />
        </div>

        {/* Live by page */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Visitors right now — by page</h2>
          {liveByPage.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No live visitors right now.
            </p>
          ) : (
            <div className="space-y-2">
              {liveByPage.map(([page, count]) => {
                const pct = live.total ? (count / live.total) * 100 : 0;
                return (
                  <div key={page} className="flex items-center gap-3">
                    <div className="w-40 sm:w-56 truncate text-xs font-medium text-gray-700">
                      {formatPageName(page, productNames)}
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs font-bold text-gray-900">{count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter + search */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search visitor ID, phone, page, city…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            {[
              { k: 'all', l: 'All' },
              { k: 'claimed', l: 'Claimed discount' },
              { k: 'accepted_cookies', l: 'Cookie accepted' },
              { k: 'mobile', l: 'Mobile' },
              { k: 'desktop', l: 'Desktop' },
            ].map(o => (
              <button
                key={o.k}
                onClick={() => setFilter(o.k)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  filter === o.k
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Visitor table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              Recent visitors
              <span className="text-gray-400 font-normal ml-2">({filteredVisitors.length})</span>
            </h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading visitors…</div>
          ) : filteredVisitors.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No visitors match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-2 text-left font-semibold">Visitor</th>
                    <th className="px-5 py-2 text-left font-semibold">Last page</th>
                    <th className="px-5 py-2 text-left font-semibold">Time spent</th>
                    <th className="px-5 py-2 text-center font-semibold">Pages</th>
                    <th className="px-5 py-2 text-center font-semibold">Cookie</th>
                    <th className="px-5 py-2 text-center font-semibold">Offer</th>
                    <th className="px-5 py-2 text-left font-semibold">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.slice(0, 100).map(v => {
                    const isMobile = (v.device_type || '').toLowerCase().includes('mobile');
                    return (
                      <tr
                        key={v.visitor_id}
                        onClick={() => openJourney(v)}
                        className="border-t border-gray-100 hover:bg-stone-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isMobile ? (
                              <Smartphone size={14} className="text-gray-400" />
                            ) : (
                              <Monitor size={14} className="text-gray-400" />
                            )}
                            <div className="min-w-0">
                              <div className="font-mono text-xs text-gray-700 truncate max-w-[140px]">
                                {v.visitor_id}
                              </div>
                              {v.phone && (
                                <div className="text-[11px] text-green-600 flex items-center gap-1">
                                  <Phone size={10} /> {v.phone}
                                </div>
                              )}
                              {v.location?.city && (
                                <div className="text-[11px] text-gray-400 flex items-center gap-1">
                                  <MapPin size={10} /> {v.location.city}
                                  {v.location.country && `, ${v.location.country}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700">
                          {formatPageName(v.last_page, productNames)}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700">
                          {formatDuration(v.total_time_spent)}
                        </td>
                        <td className="px-5 py-3 text-center text-xs font-bold text-gray-700">
                          {v.page_count || 0}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {v.cookie_consent === 'accepted' ? (
                            <span className="inline-flex w-2 h-2 rounded-full bg-green-500" title="Accepted" />
                          ) : v.cookie_consent === 'rejected' ? (
                            <span className="inline-flex w-2 h-2 rounded-full bg-red-400" title="Rejected" />
                          ) : (
                            <span className="inline-flex w-2 h-2 rounded-full bg-gray-200" title="No response" />
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {v.discount_claimed ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                              CLAIMED
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {formatTimeAgo(v.last_seen)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Visitor detail drawer */}
      {selectedVisitor && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSelectedVisitor(null)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">Visitor Journey</h3>
                <p className="text-xs text-gray-500 font-mono truncate">
                  {selectedVisitor.visitor_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedVisitor(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Quick facts */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Pages viewed</div>
                  <div className="font-bold text-gray-900">
                    {selectedVisitor.page_count || 0}
                  </div>
                </div>
                <div className="bg-stone-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Time on site</div>
                  <div className="font-bold text-gray-900">
                    {formatDuration(selectedVisitor.total_time_spent)}
                  </div>
                </div>
                <div className="bg-stone-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Cookie consent</div>
                  <div className="font-bold text-gray-900 capitalize">
                    {selectedVisitor.cookie_consent || 'no response'}
                  </div>
                </div>
                <div className="bg-stone-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Discount claimed</div>
                  <div className="font-bold text-gray-900">
                    {selectedVisitor.discount_claimed ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              {selectedVisitor.phone && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs">
                  <div className="text-gray-600 mb-1">Lead captured</div>
                  <div className="font-bold text-green-800 flex items-center gap-1">
                    <Phone size={12} /> +91 {selectedVisitor.phone}
                  </div>
                </div>
              )}

              {/* Journey events */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">
                  Activity timeline
                </h4>
                {journeyLoading ? (
                  <div className="text-center text-xs text-gray-400 py-6">Loading…</div>
                ) : journey?.error ? (
                  <div className="text-center text-xs text-red-500 py-6">{journey.error}</div>
                ) : journey?.events?.length ? (
                  <div className="relative pl-5">
                    <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-3">
                      {journey.events.slice(0, 30).map((ev, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow" />
                          <div className="text-xs">
                            <div className="font-semibold text-gray-900 capitalize">
                              {ev.action || ev.event_type || 'page_visit'}
                            </div>
                            <div className="text-gray-600">
                              {ev.page || ev.data?.page || ev.url || '—'}
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {formatTimeAgo(ev.timestamp)}
                              {ev.time_spent ? (
                                <>
                                  <span>•</span>
                                  <span>{formatDuration(ev.time_spent)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-6">
                    No detailed events recorded.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
