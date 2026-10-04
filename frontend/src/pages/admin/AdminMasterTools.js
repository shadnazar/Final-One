import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Upload, Layers, Percent, FileDown, RefreshCw, AlertTriangle, CheckCircle, Truck, Edit2, X, Sparkles, Link as LinkIcon, Zap, Shield, TrendingUp, Tag } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const getAdminAuthHeaders = () => ({ 'X-Admin-Token': getAdminToken() || '' });

/**
 * AdminMasterTools — single-page admin panel for:
 *  1. Master List bulk upload (ULTRA_GRANULAR_MASTER_LIST.xlsx)
 *  2. Product Groups viewer + pagination
 *  3. Bulk margin updater (+/- % across scope)
 *  4. Niche-segmented order downloads (dealer / in-house HTML→PDF)
 *  5. Delhivery auto-sync
 */
export default function AdminMasterTools() {
  const [tab, setTab] = useState('upload');
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-black tracking-tight mb-1">Master Tools</h1>
      <p className="text-sm text-gray-500 mb-5">Bulk upload, product groups, margin updater, and order downloads.</p>

      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'upload', icon: Upload, label: 'Master Upload' },
          { id: 'canonical', icon: Zap, label: 'Apply Canonical Taxonomy' },
          { id: 'revenue', icon: TrendingUp, label: 'Revenue & Orders' },
          { id: 'brands', icon: Tag, label: 'Brand Manager' },
          { id: 'audit', icon: Sparkles, label: 'AI Taxonomy Audit' },
          { id: 'ai-fill', icon: Sparkles, label: 'Bulk AI Fill' },
          { id: 'groups', icon: Layers, label: 'Product Groups' },
          { id: 'margin', icon: Percent, label: 'Margin Bulk' },
          { id: 'orders', icon: FileDown, label: 'Order Export' },
          { id: 'delhivery', icon: Truck, label: 'Delhivery Sync' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`mt-tab-${t.id}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              tab === t.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <MasterUploadPanel />}
      {tab === 'canonical' && <CanonicalApplyPanel />}
      {tab === 'revenue' && <RevenuePanel />}
      {tab === 'brands' && <BrandManagerPanel />}
      {tab === 'audit' && <AITaxonomyAuditPanel />}
      {tab === 'ai-fill' && <BulkAIFillPanel />}
      {tab === 'groups' && <ProductGroupsPanel />}
      {tab === 'margin' && <MarginBulkPanel />}
      {tab === 'orders' && <OrderExportPanel />}
      {tab === 'delhivery' && <DelhiverySyncPanel />}
    </div>
  );
}

// ============================================================
// Canonical Apply Panel — background job + live progress bar
// ============================================================
function CanonicalApplyPanel() {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [err, setErr] = useState('');
  const pollRef = React.useRef(null);

  const STAGE_LABELS = {
    queued: 'Queued — waiting to start…',
    seeding: 'Step 1 — Re-seeding canonical taxonomy…',
    classifying: 'Step 2 — Re-classifying products through the keyword engine…',
    cleaning_empty_tiles: 'Step 3 — Hiding empty sub-tiles…',
    repairing_brands: 'Step 4 — Repairing bad brand values…',
    computing_tags: 'Step 5 — Computing bestseller / luxury / trending tags…',
    flagship_guard: 'Step 6 — Enforcing Celesta-Glow-only anti-aging niche…',
    completed: 'Done.',
    failed: 'Failed',
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => stopPolling, []);

  const start = async () => {
    setBusy(true); setErr(''); setJob(null);
    try {
      const { data } = await axios.post(
        `${API}/admin/taxonomy/reset-canonical/start`, {},
        { headers: getAdminAuthHeaders(), timeout: 30000 }
      );
      setJob({ ...data, percent: 0 });
      // Begin polling
      pollRef.current = setInterval(async () => {
        try {
          const r = await axios.get(
            `${API}/admin/taxonomy/job/${data.job_id}`,
            { headers: getAdminAuthHeaders(), timeout: 15000 }
          );
          setJob(r.data);
          if (r.data.stage === 'completed' || r.data.stage === 'failed') {
            stopPolling();
            setBusy(false);
            if (r.data.stage === 'failed') {
              setErr(r.data.error || 'Job failed');
            }
          }
        } catch (e) {
          // Transient poll errors — keep trying
        }
      }, 2000);
    } catch (e) {
      stopPolling();
      setBusy(false);
      setErr(e?.response?.data?.detail || e?.message || 'Unable to start job');
    }
  };

  const stage = job?.stage || '';
  const percent = job?.percent ?? 0;
  const processed = job?.processed ?? 0;
  const total = job?.total ?? 0;
  const result = job?.result;
  const cls = result?.classified || {};
  const flag = result?.flagship || {};

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5" data-testid="canonical-apply-panel">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Zap size={20} className="text-amber-500" /> Apply Canonical Taxonomy
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          One-click button to re-seed the canonical taxonomy
          (Skincare 16 cats + 79 subs · Cosmetics 7 cats + 56 subs · 13 concerns),
          re-classify every existing product through the keyword classifier, and
          lock the Anti-Aging niche to Celesta&nbsp;Glow products only. Runs as a
          background job — survives long catalogs (7k+ products).
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        <b>What this does (idempotent — safe to re-run):</b>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Wipes &amp; re-seeds the categories / subcategories / concerns collections from the canonical spec.</li>
          <li>Re-classifies every product (name + description) into the new niche / category / subcategory / concerns.</li>
          <li>Auto-deactivates sub-tiles that end up with 0 products (clean hub UI).</li>
          <li>Repairs any bad brand values (sheet-names, blanks, &quot;nan&quot; etc.).</li>
          <li>Demotes any non-Celesta-Glow product currently sitting in the flagship anti-aging niche back to skincare.</li>
        </ol>
      </div>

      <button
        onClick={start}
        disabled={busy}
        data-testid="canonical-apply-btn"
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm transition-all shadow-md"
      >
        {busy ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
        {busy ? 'Running…' : 'Apply Canonical Taxonomy + Flagship Guard'}
      </button>

      {job && (
        <div className="space-y-3" data-testid="canonical-progress">
          <div className="flex items-center justify-between text-sm">
            <div className="font-semibold text-gray-800">
              {STAGE_LABELS[stage] || stage}
            </div>
            <div className="text-gray-600 tabular-nums">
              {processed.toLocaleString()} / {total.toLocaleString()} ({percent}%)
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
            <div
              className={`h-full transition-all duration-500 ${stage === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`}
              style={{ width: `${percent}%` }}
              data-testid="canonical-progress-bar"
            />
          </div>
          <div className="text-xs text-gray-500">
            Job ID: <code className="font-mono">{job.job_id || job._id || '—'}</code>
          </div>
        </div>
      )}

      {err && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div><b>Failed:</b> {err}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-4 text-sm" data-testid="canonical-result">
            <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="font-bold">Canonical taxonomy applied successfully.</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Reclassified" value={cls.updated ?? 0} />
                <Stat label="Skincare" value={cls.by_niche?.skincare ?? 0} />
                <Stat label="Cosmetics" value={cls.by_niche?.cosmetics ?? 0} />
                <Stat label="Anti-Aging (CG)" value={cls.by_niche?.['anti-aging'] ?? 0} />
                <Stat label="Haircare" value={cls.by_niche?.haircare ?? 0} />
                <Stat label="Sub-tiles filled" value={Object.keys(cls.by_subcat || {}).length} />
                <Stat label="Empty tiles hidden" value={cls.cleanup?.deactivated ?? 0} />
                <Stat label="Bad brands fixed" value={cls.brand_fix?.updated ?? 0} />
              </div>
              <div className="pt-2 border-t border-emerald-200 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Flagship scanned" value={flag.scanned ?? 0} />
                <Stat label="Foreign brands demoted" value={flag.demoted ?? 0} />
                <Stat label="Celesta SKUs kept" value={flag.kept_celesta_glow ?? 0} />
              </div>
            </div>
          </div>

          {flag?.demoted_sample?.length > 0 && (
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
              <summary className="cursor-pointer font-semibold">Demoted from anti-aging ({flag.demoted_sample.length} sample)</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {flag.demoted_sample.map(s => (
                  <li key={s.slug} className="text-gray-700">
                    <b>{s.brand}</b> — {s.name} <span className="text-gray-400">→ skincare / {s.new_category}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Revenue Panel — Orders Placed vs Delivered Revenue split
// ============================================================
function RevenuePanel() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [synBusy, setSynBusy] = useState(false);
  const [synMsg, setSynMsg] = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const { data: d } = await axios.get(
        `${API}/admin/revenue/summary?period=${period}`,
        { headers: getAdminAuthHeaders() },
      );
      setData(d);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const sync = async () => {
    setSynBusy(true); setSynMsg('');
    try {
      const { data: r } = await axios.post(
        `${API}/admin/revenue/delhivery/sync?limit=200`, {},
        { headers: getAdminAuthHeaders(), timeout: 120000 },
      );
      setSynMsg(`Checked ${r.checked} AWBs, updated ${r.updated} order statuses.`);
      load();
    } catch (e) {
      setSynMsg(`Sync failed: ${e?.response?.data?.detail || e?.message}`);
    } finally {
      setSynBusy(false);
    }
  };

  const downloadExport = (fmt) => {
    const url = `${API}/admin/revenue/export-full?fmt=${fmt}`;
    fetch(url, { headers: getAdminAuthHeaders() }).then(r => r.blob()).then(b => {
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = `celesta-orders-full.${fmt}`;
      a.click(); URL.revokeObjectURL(u);
    });
  };

  const t = data?.totals || {};
  const series = data?.series || [];
  return (
    <div className="space-y-5" data-testid="revenue-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-600" /> Revenue & Orders
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            data-testid="rev-period-select"
            className="text-sm px-3 py-2 rounded-lg border border-gray-300"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 days</option>
            <option value="month">This Month</option>
            <option value="ytd">Year to Date</option>
            <option value="year">Last 12 months</option>
          </select>
          <button onClick={load} disabled={busy}
            data-testid="rev-refresh-btn"
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
            {busy ? <RefreshCw size={14} className="animate-spin"/> : 'Refresh'}
          </button>
          <button onClick={sync} disabled={synBusy}
            data-testid="rev-sync-btn"
            className="text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {synBusy ? 'Syncing…' : 'Sync Delhivery Statuses'}
          </button>
          <button onClick={() => downloadExport('xlsx')}
            data-testid="rev-export-xlsx-btn"
            className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            Export XLSX
          </button>
        </div>
      </div>

      {synMsg && <div className="text-xs text-gray-700">{synMsg}</div>}
      {err && <div className="text-sm text-red-700">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Orders Placed" value={t.orders_placed ?? 0} />
        <Stat label="Placed Revenue (₹)" value={t.placed_revenue ?? 0} />
        <Stat label="Orders Delivered" value={t.orders_delivered ?? 0} />
        <Stat label="Delivered Revenue (₹)" value={t.delivered_revenue ?? 0} />
        <Stat label="Placed AOV (₹)" value={t.placed_aov ?? 0} />
        <Stat label="Delivered AOV (₹)" value={t.delivered_aov ?? 0} />
        <Stat label="Returns" value={t.orders_returned ?? 0} />
        <Stat label="Returned Value (₹)" value={t.returned_value ?? 0} />
        <Stat label="COD orders" value={t.cod_count ?? 0} />
        <Stat label="Prepaid orders" value={t.prepaid_count ?? 0} />
        <Stat label="Delivery rate" value={`${t.delivery_rate ?? 0}%`} />
        <Stat label="Window bucket" value={data?.window?.bucket ?? '-'} />
      </div>

      {series.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3 text-gray-700">
            {data?.window?.bucket === 'month' ? 'Monthly' : 'Daily'} breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Placed</th>
                  <th className="py-2 pr-3 text-right">Placed ₹</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2 pr-3 text-right">Delivered ₹</th>
                </tr>
              </thead>
              <tbody>
                {series.slice(-30).map(s => (
                  <tr key={s.label} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 font-mono">{s.label}</td>
                    <td className="py-1.5 pr-3 text-right">{s.orders_placed}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.placed_revenue}</td>
                    <td className="py-1.5 pr-3 text-right">{s.orders_delivered}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700 font-semibold">{s.delivered_revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Brand Manager Panel — group by niche, price-bulk per brand
// ============================================================
function BrandManagerPanel() {
  const [data, setData] = useState(null);
  const [openBrand, setOpenBrand] = useState(null);
  const [brandPage, setBrandPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [priceMode, setPriceMode] = useState('discount_percent');
  const [priceValue, setPriceValue] = useState('');
  const [priceMsg, setPriceMsg] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const { data: d } = await axios.get(
        `${API}/admin/brands/by-niche`,
        { headers: getAdminAuthHeaders() },
      );
      setData(d);
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const openBrandPanel = async (brand) => {
    setOpenBrand(brand); setBrandPage(null); setPriceMsg('');
    try {
      const { data: d } = await axios.get(
        `${API}/admin/brands/${encodeURIComponent(brand)}/products?limit=200`,
        { headers: getAdminAuthHeaders() },
      );
      setBrandPage(d);
    } catch {}
  };

  const applyBulkPrice = async (dryRun) => {
    if (!openBrand || !priceValue) return;
    setPriceMsg('Applying…');
    try {
      const v = parseFloat(priceValue);
      const params = new URLSearchParams({ [priceMode]: String(v), dry_run: String(!!dryRun) });
      const { data: r } = await axios.post(
        `${API}/admin/brands/${encodeURIComponent(openBrand)}/price-bulk?${params}`, {},
        { headers: getAdminAuthHeaders() },
      );
      setPriceMsg(`${dryRun ? 'Would update' : 'Updated'} ${dryRun ? r.would_update : r.updated} products. Sample: ${(r.preview_sample || []).slice(0,3).map(p => `${p.slug}: ${p.old_listing}→${p.new_listing}`).join(' | ')}`);
      if (!dryRun) openBrandPanel(openBrand);
    } catch (e) {
      setPriceMsg('Failed: ' + (e?.response?.data?.detail || e?.message));
    }
  };

  return (
    <div className="space-y-5" data-testid="brand-manager-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Tag size={20} className="text-purple-600" /> Brand Manager — by Niche
        </h2>
        <button onClick={load} disabled={busy} className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
          {busy ? <RefreshCw size={14} className="animate-spin"/> : 'Refresh'}
        </button>
      </div>

      {(data?.niches || []).map(n => (
        <div key={n.niche} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold capitalize">{n.niche}</h3>
            <div className="text-xs text-gray-500">{n.brand_count} brands · {n.total_products} products</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {n.brands.map(b => (
              <button
                key={b.brand}
                onClick={() => openBrandPanel(b.brand)}
                data-testid={`brand-${b.brand}`}
                className="text-left p-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
              >
                <div className="font-bold text-sm truncate">{b.brand}</div>
                <div className="text-xs text-gray-500">{b.count} products · {b.categories.length} cats</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {openBrand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpenBrand(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
              <h3 className="text-lg font-bold">{openBrand}</h3>
              <button onClick={() => setOpenBrand(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-2">
              <div className="font-semibold text-sm">Bulk price update for this brand</div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={priceMode} onChange={(e) => setPriceMode(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300">
                  <option value="discount_percent">Discount % (off MRP → listing)</option>
                  <option value="markup_percent">Listing % markup (+ / -)</option>
                  <option value="set_mrp_multiplier">MRP multiplier (e.g. 1.25)</option>
                  <option value="fixed_listing_price">Fixed listing price ₹</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  placeholder="Value"
                  className="w-32 text-sm px-3 py-2 rounded-lg border border-gray-300"
                  data-testid="brand-price-input"
                />
                <button onClick={() => applyBulkPrice(true)}
                  data-testid="brand-price-preview"
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                  Preview
                </button>
                <button onClick={() => applyBulkPrice(false)}
                  data-testid="brand-price-apply"
                  className="text-sm px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600">
                  Apply to all
                </button>
              </div>
              {priceMsg && <div className="text-xs text-gray-700 pt-1">{priceMsg}</div>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-12">
                  <tr className="text-left text-gray-600">
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2 text-right">MRP</th>
                    <th className="py-2 px-2 text-right">Listing</th>
                    <th className="py-2 px-2 text-right">Stock</th>
                    <th className="py-2 px-2 text-right">Shades</th>
                  </tr>
                </thead>
                <tbody>
                  {(brandPage?.items || []).map(p => (
                    <tr key={p.slug} className="border-t border-gray-100">
                      <td className="py-1.5 px-2 truncate max-w-xs">{p.name}</td>
                      <td className="py-1.5 px-2 text-gray-500">{p.subcategory || p.category}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.mrp}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{p.prepaid_price}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.stock_qty}</td>
                      <td className="py-1.5 px-2 text-right">{(p.shades || []).length || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-500 mt-2">Total {brandPage?.total ?? 0} products</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AI Taxonomy Audit Panel — one-click re-route the catalogue
// ============================================================
function AITaxonomyAuditPanel() {
  const [scope, setScope] = useState('needs_taxonomy');
  const [niche, setNiche] = useState('skincare');
  const [limit, setLimit] = useState('');
  const [concurrency, setConcurrency] = useState(6);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!job?.job_id || job?.status === 'completed' || job?.status === 'failed') return;
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/admin/taxonomy/ai-audit/${job.job_id}`, { headers: getAdminAuthHeaders() });
        setJob(data);
      } catch (e) { /* keep polling */ }
    }, 3000);
    return () => clearInterval(t);
  }, [job?.job_id, job?.status]);

  const start = async () => {
    setBusy(true); setErr(''); setJob(null);
    try {
      const payload = {
        scope,
        niche: scope === 'niche' ? niche : null,
        limit: limit ? parseInt(limit) : null,
        concurrency,
        only_missing: onlyMissing,
      };
      const { data } = await axios.post(`${API}/admin/taxonomy/ai-audit`, payload, { headers: getAdminAuthHeaders() });
      if (data.job_id) setJob({ job_id: data.job_id, status: 'queued', total: 0, done: 0, failed: 0, created_categories: [], created_subcategories: [], created_concerns: [] });
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const pct = job?.total > 0 ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="ai-audit-panel">
      <div className="flex items-start gap-3 mb-5">
        <Sparkles className="text-violet-600 mt-1" size={22} />
        <div>
          <h2 className="text-lg font-bold">AI Taxonomy Audit</h2>
          <p className="text-sm text-gray-500">
            Re-route every product into the right <b>niche → category → subcategory → concerns</b> using Claude.
            New sub-categories, filters and concerns are <b>auto-created</b> when needed — wired into the storefront tabs.
            Run this <b>once after a bulk upload</b>.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Scope</label>
          <select value={scope} onChange={e => setScope(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white" data-testid="audit-scope">
            <option value="needs_taxonomy">Products missing taxonomy (recommended)</option>
            <option value="niche">Only one niche</option>
            <option value="all">All products (heaviest — uses most LLM credits)</option>
          </select>
        </div>
        {scope === 'niche' && (
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Niche</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white" data-testid="audit-niche">
              <option value="anti-aging">Anti-Aging</option>
              <option value="skincare">Skincare</option>
              <option value="cosmetics">Cosmetics</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Limit (blank = no cap)</label>
          <input type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="e.g. 500" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" data-testid="audit-limit" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Concurrency (1–10)</label>
          <input type="number" value={concurrency} onChange={e => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 6)))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" data-testid="audit-concurrency" />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="w-4 h-4" data-testid="audit-only-missing" />
          <span>Only re-audit products that have <b>missing category / concerns / never audited</b> (recommended — cheaper).</span>
        </label>
      </div>

      <button
        onClick={start}
        disabled={busy || (job && job.status === 'running')}
        data-testid="audit-start-btn"
        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md"
      >
        <Sparkles size={16} /> {busy ? 'Starting…' : 'Start AI Taxonomy Audit'}
      </button>

      {err && <div className="mt-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{err}</div>}

      {job && (
        <div className="mt-6 p-4 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200" data-testid="audit-progress">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-700 mb-2">
            <span className="font-mono">{job.job_id}</span>
            <span className={`px-2 py-0.5 rounded ${job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{job.status}</span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden ring-1 ring-violet-200">
            <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 text-xs text-gray-700 mt-2">
            <span><b>{job.done || 0}</b> done</span>
            <span><b>{job.failed || 0}</b> failed</span>
            <span><b>{job.total}</b> total · {pct}%</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-3 text-xs">
            <div className="bg-white rounded-lg p-2 border border-violet-100">
              <p className="font-bold text-violet-700">📂 +{job.created_categories?.length || 0} categories</p>
              <p className="text-gray-500 truncate">{(job.created_categories || []).slice(0, 6).join(', ') || '—'}</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-violet-100">
              <p className="font-bold text-violet-700">🔖 +{job.created_subcategories?.length || 0} sub-categories</p>
              <p className="text-gray-500 truncate">{(job.created_subcategories || []).slice(0, 6).join(', ') || '—'}</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-violet-100">
              <p className="font-bold text-violet-700">🎯 +{job.created_concerns?.length || 0} concerns</p>
              <p className="text-gray-500 truncate">{(job.created_concerns || []).slice(0, 6).join(', ') || '—'}</p>
            </div>
          </div>
          {job.last_slug && <p className="text-[11px] text-gray-500 mt-2 font-mono">Last: {job.last_slug}</p>}
          {job.errors?.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-rose-600 font-semibold">{job.errors.length} error(s) — click to view</summary>
              <pre className="mt-2 bg-rose-50 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(job.errors.slice(0, 20), null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Bulk AI Fill Panel
// ============================================================
function BulkAIFillPanel() {
  const [scope, setScope] = useState('needs_enrichment');
  const [niche, setNiche] = useState('skincare');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(100);
  const [concurrency, setConcurrency] = useState(5);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Poll job status every 2s while running
  useEffect(() => {
    if (!job?.job_id || job?.status === 'completed' || job?.status === 'failed') return;
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/admin/products/bulk-ai-fill/${job.job_id}`, { headers: getAdminAuthHeaders() });
        setJob(data);
      } catch (e) { /* ignore */ }
    }, 2000);
    return () => clearInterval(t);
  }, [job?.job_id, job?.status]);

  const start = async () => {
    setBusy(true); setErr(''); setJob(null);
    try {
      const { data } = await axios.post(
        `${API}/admin/products/bulk-ai-fill`,
        { scope, niche: scope === 'niche' ? niche : null, category: scope === 'category' ? category : null, limit, concurrency, only_missing: scope === 'needs_enrichment' },
        { headers: getAdminAuthHeaders() }
      );
      if (data.queued === 0) {
        setErr('No products match — try a different scope.');
      } else {
        setJob({ job_id: data.job_id, total: data.queued, done: 0, failed: 0, status: 'running' });
      }
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const pct = job?.total > 0 ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="bulk-ai-fill-panel">
      <div className="flex items-start gap-3 mb-5">
        <Sparkles className="text-fuchsia-600 mt-1" size={22} />
        <div>
          <h2 className="text-lg font-bold">Bulk AI Fill</h2>
          <p className="text-sm text-gray-500">Generate descriptions, key ingredients, benefits, how-to-use and taglines for many products using Claude. Price is never touched.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Scope</label>
          <select value={scope} onChange={e => setScope(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white" data-testid="bulk-ai-scope">
            <option value="needs_enrichment">Products needing enrichment</option>
            <option value="niche">All in a niche</option>
            <option value="category">All in a category</option>
            <option value="all">All products</option>
          </select>
        </div>
        {scope === 'niche' && (
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Niche</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white" data-testid="bulk-ai-niche">
              <option value="anti-aging">Anti-Aging</option>
              <option value="skincare">Skincare</option>
              <option value="cosmetics">Cosmetics</option>
            </select>
          </div>
        )}
        {scope === 'category' && (
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Category slug</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. moisturizers" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" data-testid="bulk-ai-category" />
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Limit (max 2000)</label>
          <input type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 100)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" data-testid="bulk-ai-limit" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Concurrency (1–10)</label>
          <input type="number" value={concurrency} onChange={e => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" data-testid="bulk-ai-concurrency" />
        </div>
      </div>

      <button
        onClick={start}
        disabled={busy || (job && job.status === 'running')}
        data-testid="bulk-ai-start"
        className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2"
      >
        <Sparkles size={16} /> {busy ? 'Starting…' : 'Start Bulk AI Fill'}
      </button>

      {err && <div className="mt-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{err}</div>}

      {job && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200" data-testid="bulk-ai-progress">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-600 mb-2">
            <span>Job: {job.job_id}</span>
            <span className={`px-2 py-0.5 rounded ${job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{job.status}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-fuchsia-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span><b>{job.done || 0}</b> done</span>
            <span><b>{job.failed || 0}</b> failed</span>
            <span><b>{job.total}</b> total · {pct}%</span>
          </div>
          {job.last_slug && <p className="text-[11px] text-gray-500 mt-2 font-mono">Last: {job.last_slug}</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 1. Master Upload Panel
// ============================================================
function MasterUploadPanel() {
  const [file, setFile] = useState(null);
  const [wipeFirst, setWipeFirst] = useState(true);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [err, setErr] = useState('');

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true); setErr(''); setAnalysis(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(
        `${API}/admin/master-import/analyze`,
        fd,
        { headers: { ...getAdminAuthHeaders(), 'Content-Type': 'multipart/form-data' }, timeout: 180000 }
      );
      setAnalysis(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true); setErr(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(
        `${API}/admin/master-import/upload?wipe_first=${wipeFirst}&use_ai=${useAi}`,
        fd,
        { headers: { ...getAdminAuthHeaders(), 'Content-Type': 'multipart/form-data' }, timeout: 600000 }
      );
      setResult(data);
      // Bust frontend cache so /skincare, /cosmetics and admin lists refresh
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="font-bold text-lg mb-2">Upload Master List</h2>
      <p className="text-sm text-gray-500 mb-4">
        Drop any product Excel. Dedupes by (brand + name). Auto-grouped into 80 products per group.
        <b> AI scans the sheet first</b> and auto-creates any missing categories/concerns.
      </p>

      <label className="block">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => { setFile(e.target.files?.[0]); setAnalysis(null); setResult(null); setErr(''); }}
          data-testid="mt-upload-input"
          className="block w-full text-sm border border-gray-300 rounded-lg p-3 cursor-pointer file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold hover:file:bg-emerald-100"
        />
      </label>

      <label className="flex items-center gap-2 mt-4 text-sm">
        <input
          type="checkbox"
          checked={wipeFirst}
          onChange={e => setWipeFirst(e.target.checked)}
          data-testid="mt-wipe-first"
          className="w-4 h-4"
        />
        <span>Wipe existing <b>cosmetics</b> + <b>skincare</b> products first (recommended for clean re-import; anti-aging is preserved)</span>
      </label>

      <label className="flex items-center gap-2 mt-2 text-sm">
        <input
          type="checkbox"
          checked={useAi}
          onChange={e => setUseAi(e.target.checked)}
          data-testid="mt-use-ai"
          className="w-4 h-4"
        />
        <span>
          <b>Inline AI categorization during import</b> — slower (~5–10 LLM calls per minute). Leave OFF for fast import and run the <b>AI Taxonomy Audit</b> tab after upload (recommended).
        </span>
      </label>

      {wipeFirst && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-900">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>Existing cosmetics + skincare products will be deleted. Anti-aging products will remain untouched.</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={analyze}
          disabled={!file || analyzing || busy}
          data-testid="mt-analyze-btn"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {analyzing ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {analyzing ? 'Analyzing…' : '1. AI Analyze Sheet'}
        </button>
        <button
          onClick={upload}
          disabled={!file || busy || analyzing}
          data-testid="mt-upload-btn"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {busy ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? 'Uploading & importing...' : '2. Upload & Import'}
        </button>
      </div>

      {err && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {analysis && (
        <div className="mt-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3" data-testid="mt-analysis-result">
          <div className="flex items-center gap-2 font-bold text-indigo-800">
            <Sparkles size={18} /> Sheet analysis preview
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <Stat label="Total rows" value={analysis.total_rows} />
            <Stat label="Unique brands" value={analysis.unique_brands} />
            <Stat label="Niche split" value={Object.entries(analysis.by_niche || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
          </div>
          {(analysis.auto_will_create?.categories?.length > 0 || analysis.auto_will_create?.concerns?.length > 0) && (
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-900 mb-1.5">Auto-create on upload:</p>
              {analysis.auto_will_create.categories.length > 0 && (
                <p className="text-xs text-indigo-700 mb-1"><b>{analysis.auto_will_create.categories.length} new categories:</b> {analysis.auto_will_create.categories.join(', ')}</p>
              )}
              {analysis.auto_will_create.concerns.length > 0 && (
                <p className="text-xs text-indigo-700"><b>{analysis.auto_will_create.concerns.length} new concerns:</b> {analysis.auto_will_create.concerns.join(', ')}</p>
              )}
            </div>
          )}
          {analysis.misclassification_total > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <b>⚠ {analysis.misclassification_total} potential misclassifications</b> (e.g. a skincare-shaped product in a cosmetics row). These will still import — review after upload.
            </div>
          )}
          <details>
            <summary className="text-xs text-indigo-800 cursor-pointer hover:underline">Show full analysis JSON</summary>
            <pre className="mt-2 text-[11px] text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded max-h-96 overflow-auto">{JSON.stringify(analysis, null, 2)}</pre>
          </details>
        </div>
      )}

      {result && (
        <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
            <CheckCircle size={18} /> Import complete
          </div>
          {result.import?.auto_created && (
            <div className="mb-3 bg-white rounded-lg p-3 border border-emerald-100 space-y-1">
              <p className="text-xs font-bold text-emerald-900">AI auto-created:</p>
              <p className="text-xs text-emerald-700">📂 <b>{result.import.auto_created.categories_created?.length || 0}</b> categories: {(result.import.auto_created.categories_created || []).slice(0, 12).join(', ') || '—'}</p>
              <p className="text-xs text-emerald-700">🎯 <b>{result.import.auto_created.concerns_created?.length || 0}</b> concerns: {(result.import.auto_created.concerns_created || []).slice(0, 12).join(', ') || '—'}</p>
              <p className="text-xs text-emerald-700">🔖 <b>{result.import.auto_created.subcategories_created?.length || 0}</b> sub-categories: {(result.import.auto_created.subcategories_created || []).slice(0, 12).join(', ') || '—'}</p>
            </div>
          )}
          <pre className="text-xs text-emerald-900 whitespace-pre-wrap font-mono max-h-96 overflow-auto">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg p-2.5 border border-indigo-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ============================================================
// 2. Product Groups Panel
// ============================================================
export function ProductGroupsPanel() {
  const [niche, setNiche] = useState('cosmetics');
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState(null);
  const [selected, setSelected] = useState(null);
  const [groupProducts, setGroupProducts] = useState(null);
  const [groupPage, setGroupPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const loadGroups = useCallback(async () => {
    setGroups(null);
    const { data } = await axios.get(`${API}/admin/product-groups?niche=${niche}&page=${page}&limit=50`, {
      headers: getAdminAuthHeaders(),
    });
    setGroups(data);
  }, [niche, page]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const openGroup = async (gid, gp = 1) => {
    setSelected(gid);
    setGroupPage(gp);
    setGroupProducts(null);
    const { data } = await axios.get(`${API}/admin/product-groups/${gid}?page=${gp}&limit=80`, {
      headers: getAdminAuthHeaders(),
    });
    setGroupProducts(data);
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-1 bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex gap-2 mb-3">
          {['cosmetics', 'skincare', 'anti-aging'].map(n => (
            <button
              key={n}
              onClick={() => { setNiche(n); setPage(1); setSelected(null); }}
              data-testid={`mt-niche-${n}`}
              className={`flex-1 text-xs font-bold py-2 rounded-lg ${niche === n ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-2">Groups: {groups?.total || '...'}</p>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {(groups?.items || []).map(g => (
            <button
              key={g.group_id}
              onClick={() => openGroup(g.group_id)}
              data-testid={`mt-group-${g.group_id}`}
              className={`block w-full text-left text-sm px-3 py-2.5 rounded-lg transition ${
                selected === g.group_id ? 'bg-emerald-100 text-emerald-900 font-semibold' : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-gray-500">{g.size} products</div>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 p-4">
        {!selected && <p className="text-sm text-gray-400 text-center py-12">Select a group to view its products.</p>}
        {selected && !groupProducts && <p className="text-sm text-gray-400 text-center py-12">Loading...</p>}
        {selected && groupProducts && (
          <>
            <GroupNameEditor
              group={groupProducts.group}
              total={groupProducts.total}
              onRenamed={(newName) => {
                // optimistically update list + detail
                setGroupProducts(g => g ? { ...g, group: { ...g.group, name: newName } } : g);
                setGroups(s => s ? { ...s, items: (s.items || []).map(it => it.group_id === groupProducts.group.group_id ? { ...it, name: newName } : it) } : s);
              }}
            />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b">
                <tr>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Brand</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">MRP</th>
                  <th className="text-right py-2">Edit</th>
                </tr>
              </thead>
              <tbody>
                {(groupProducts.items || []).map(p => (
                  <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 truncate max-w-xs">{p.name}</td>
                    <td className="py-2 text-gray-500">{p.brand}</td>
                    <td className="py-2 text-right font-semibold">₹{p.prepaid_price}</td>
                    <td className="py-2 text-right text-gray-400 line-through">₹{p.mrp}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => setEditing(p)} data-testid={`mt-edit-${p.slug}`} className="text-emerald-600 hover:text-emerald-800 p-1"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center mt-3 text-xs">
              <button onClick={() => openGroup(selected, Math.max(1, groupPage - 1))} disabled={groupPage <= 1} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Prev</button>
              <span>Page {groupPage}</span>
              <button onClick={() => openGroup(selected, groupPage + 1)} disabled={!groupProducts?.has_next} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Next</button>
            </div>
          </>
        )}
      </div>

      {editing && <ProductEditModal product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); openGroup(selected, groupPage); }} />}
    </div>
  );
}

// ============================================================
// Group Name Editor — shown at the top of the group products view
// Lets admin rename a 80-product group inline ("Save" persists via PATCH).
// ============================================================
function GroupNameEditor({ group, total, onRenamed }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(group?.name || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => { setName(group?.name || ''); setEditing(false); setErr(''); }, [group?.group_id]);

  const save = async () => {
    const v = (name || '').trim();
    if (!v) { setErr('Name is required'); return; }
    setBusy(true); setErr('');
    try {
      await axios.patch(`${API}/admin/product-groups/${group.group_id}`,
        { name: v },
        { headers: getAdminAuthHeaders() }
      );
      onRenamed?.(v);
      setEditing(false);
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to rename');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-3 border-b border-gray-100">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editing ? (
          <>
            <input
              type="text"
              value={name}
              maxLength={120}
              autoFocus
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setName(group?.name || ''); }}}
              className="flex-1 min-w-0 px-3 py-1.5 text-sm font-bold border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
              data-testid="mt-group-name-input"
              placeholder="Group name…"
            />
            <button onClick={save} disabled={busy} data-testid="mt-group-name-save" className="text-xs font-bold px-3 py-1.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setName(group?.name || ''); setErr(''); }} disabled={busy} className="text-xs font-bold px-2 py-1.5 text-gray-500 hover:text-gray-800">Cancel</button>
          </>
        ) : (
          <>
            <h3 className="font-bold text-base truncate" data-testid="mt-group-name">{group?.name || 'Untitled group'}</h3>
            <button onClick={() => setEditing(true)} data-testid="mt-group-name-edit" className="text-emerald-600 hover:text-emerald-800 p-1" title="Rename group">
              <Edit2 size={14} />
            </button>
          </>
        )}
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap" data-testid="mt-group-total">{total} products</span>
      {err && <p className="w-full text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ============================================================
// Product Edit Modal — with URL Analyze + Fill with AI
// ============================================================
function ProductEditModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product.name || '',
    brand: product.brand || '',
    tagline: product.tagline || '',
    description: product.description || '',
    key_ingredients: product.key_ingredients || '',
    benefits: (product.benefits || []).join('\n'),
    how_to_use: product.how_to_use || '',
    size: product.size || '',
    stock_qty: product.stock_qty ?? 100,
    // Price fields (editable — fast path for merchant price corrections)
    mrp: product.mrp ?? 0,
    prepaid_price: product.prepaid_price ?? 0,
    image: product.image || '',
  });
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);
  const [err, setErr] = useState('');

  const analyzeUrl = async () => {
    if (!url.trim()) return;
    setUrlBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/admin/products/analyze-url`,
        { url: url.trim() },
        { headers: getAdminAuthHeaders(), timeout: 60000 }
      );
      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        tagline: data.tagline || prev.tagline,
        description: data.description || prev.description,
        key_ingredients: data.key_ingredients || prev.key_ingredients,
        benefits: (data.benefits || []).join('\n') || prev.benefits,
        how_to_use: data.how_to_use || prev.how_to_use,
        size: data.size || prev.size,
      }));
    } catch (e) {
      setErr(`URL analyze failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setUrlBusy(false);
    }
  };

  const fillAI = async () => {
    setAiBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/admin/products/${product.slug}/fill-with-ai`,
        {},
        { headers: getAdminAuthHeaders(), timeout: 60000 }
      );
      const upd = data.updated || {};
      setForm(prev => ({
        ...prev,
        description: upd.description || prev.description,
        key_ingredients: upd.key_ingredients || prev.key_ingredients,
        benefits: (upd.benefits || []).join('\n') || prev.benefits,
        how_to_use: upd.how_to_use || prev.how_to_use,
        tagline: upd.tagline || prev.tagline,
      }));
    } catch (e) {
      setErr(`AI fill failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = {
        name: form.name,
        brand: form.brand,
        tagline: form.tagline,
        description: form.description,
        key_ingredients: form.key_ingredients,
        benefits: form.benefits.split('\n').filter(b => b.trim()),
        how_to_use: form.how_to_use,
        size: form.size,
        stock_qty: Number(form.stock_qty),
        // Price + image are now editable directly from the group editor.
        mrp: Number(form.mrp) || 0,
        prepaid_price: Number(form.prepaid_price) || 0,
        image: form.image,
        allow_price_change: true,
      };
      await axios.put(`${API}/admin/products/${product.slug}`, body, { headers: getAdminAuthHeaders() });
      onSaved();
    } catch (e) {
      setErr(`Save failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold">Edit Product</h3>
            <p className="text-xs text-gray-500 font-mono">{product.slug}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        {/* TOP: Analyze URL */}
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <LinkIcon size={12} /> Analyze URL (paste brand product URL → AI extracts everything except price)
          </label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              data-testid="pe-url-input"
              placeholder="https://www.purplle.com/product/..."
              className="flex-1 border border-blue-300 rounded-lg p-2 text-sm"
            />
            <button onClick={analyzeUrl} disabled={urlBusy || !url.trim()} data-testid="pe-url-analyze" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
              {urlBusy ? <RefreshCw className="animate-spin" size={14} /> : <LinkIcon size={14} />} Analyze
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <Row label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="pe-name" className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <Row label="Brand"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} data-testid="pe-brand" className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <Row label="Tagline"><input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <Row label="Description (long form)"><textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="pe-desc" className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <Row label="Key Ingredients"><input value={form.key_ingredients} onChange={e => setForm({ ...form, key_ingredients: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <Row label="Benefits (one per line)"><textarea rows="3" value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono" /></Row>
          <Row label="How to Use"><textarea rows="2" value={form.how_to_use} onChange={e => setForm({ ...form, how_to_use: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Size"><input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
            <Row label="Stock"><input type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></Row>
          </div>

          {/* Price (editable) */}
          <div className="grid grid-cols-2 gap-3">
            <Row label="MRP (₹)">
              <input
                type="number" min="0"
                value={form.mrp}
                onChange={e => setForm({ ...form, mrp: e.target.value })}
                data-testid="pe-mrp"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </Row>
            <Row label="Listing Price (₹)">
              <input
                type="number" min="0"
                value={form.prepaid_price}
                onChange={e => setForm({ ...form, prepaid_price: e.target.value })}
                data-testid="pe-price"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </Row>
          </div>

          {/* Image URL with live preview (upload via Admin → Products if Cloudinary needed) */}
          <Row label="Image URL">
            <div className="flex gap-2 items-start">
              {form.image && (
                <img src={form.image} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <input
                type="url"
                value={form.image}
                onChange={e => setForm({ ...form, image: e.target.value })}
                data-testid="pe-image"
                placeholder="https://… (paste brand image or CDN url)"
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
          </Row>

          {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{err}</div>}
        </div>

        {/* BOTTOM: Fill with AI + Save */}
        <div className="p-4 border-t bg-gray-50 sticky bottom-0 flex gap-2 justify-end">
          <button onClick={fillAI} disabled={aiBusy} data-testid="pe-fill-ai" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {aiBusy ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />} Fill with AI
          </button>
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold px-4 py-2.5 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} data-testid="pe-save" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>{children}</div>;
}

// ============================================================
// 3. Margin Bulk Panel
// ============================================================
function MarginBulkPanel() {
  const [scope, setScope] = useState('niche');
  const [niche, setNiche] = useState('cosmetics');
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState('');
  const [delta, setDelta] = useState(5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const apply = async () => {
    if (!window.confirm(`Apply ${delta > 0 ? '+' : ''}${delta}% to ${scope}? This updates listing prices in DB.`)) return;
    setBusy(true); setResult(null); setErr('');
    try {
      const body = { scope, delta_percent: Number(delta) };
      if (scope === 'niche') body.niche = niche;
      if (scope === 'group') body.group_id = groupId;
      if (scope === 'category') body.category = category;
      const { data } = await axios.post(`${API}/admin/products/margin-bulk`, body, { headers: getAdminAuthHeaders() });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
      <h2 className="font-bold text-lg mb-1">Bulk Margin Updater</h2>
      <p className="text-sm text-gray-500 mb-4">Apply a percentage shift to listing prices. +5 raises by 5%; -5 lowers by 5%.</p>

      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Scope</label>
      <select value={scope} onChange={e => setScope(e.target.value)} data-testid="mt-margin-scope" className="w-full border border-gray-300 rounded-lg p-2.5 mb-3">
        <option value="all">All products</option>
        <option value="niche">By niche</option>
        <option value="group">By product group</option>
        <option value="category">By category slug</option>
      </select>

      {scope === 'niche' && (
        <select value={niche} onChange={e => setNiche(e.target.value)} data-testid="mt-margin-niche" className="w-full border border-gray-300 rounded-lg p-2.5 mb-3">
          <option value="cosmetics">Cosmetics</option>
          <option value="skincare">Skincare</option>
          <option value="anti-aging">Anti-Aging</option>
        </select>
      )}
      {scope === 'group' && (
        <input value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="e.g. grp-cosmetics-001" data-testid="mt-margin-group" className="w-full border border-gray-300 rounded-lg p-2.5 mb-3" />
      )}
      {scope === 'category' && (
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. lipstick-gloss" data-testid="mt-margin-cat" className="w-full border border-gray-300 rounded-lg p-2.5 mb-3" />
      )}

      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Delta % (use negative to lower)</label>
      <div className="flex gap-2 items-center mb-4">
        <button onClick={() => setDelta(Number(delta) - 1)} className="px-3 py-2 bg-gray-100 rounded font-bold">-</button>
        <input
          type="number"
          value={delta}
          onChange={e => setDelta(e.target.value)}
          data-testid="mt-margin-delta"
          className="flex-1 border border-gray-300 rounded-lg p-2.5 text-center text-lg font-bold"
        />
        <button onClick={() => setDelta(Number(delta) + 1)} className="px-3 py-2 bg-gray-100 rounded font-bold">+</button>
      </div>

      <button onClick={apply} disabled={busy} data-testid="mt-margin-apply" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
        {busy ? <RefreshCw className="animate-spin" size={16} /> : <Percent size={16} />}
        Apply Margin
      </button>

      {err && <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{err}</div>}
      {result && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          ✓ {result.affected} products updated by {result.delta_percent > 0 ? '+' : ''}{result.delta_percent}%
        </div>
      )}
    </div>
  );
}

// ============================================================
// 4. Order Export Panel
// ============================================================
function OrderExportPanel() {
  // Default to today in IST (so admins in India see today's date by default).
  const todayIST = (() => {
    const now = new Date();
    const istMs = now.getTime() + (5.5 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000);
    return new Date(istMs).toISOString().slice(0, 10);
  })();
  const [date, setDate] = useState(todayIST);

  const download = (niche, sheetType) => {
    const url = `${API}/admin/orders/export-sheet?niche=${niche}&sheet_type=${sheetType}&date=${date}`;
    // Open with header via fetch then save HTML
    fetch(url, { headers: getAdminAuthHeaders() })
      .then(r => r.text())
      .then(html => {
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${niche}-${sheetType}-${date}.html`;
        a.click();
        // Also open in new tab so user can print directly
        const win = window.open();
        if (win) win.document.write(html);
      });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="font-bold text-lg mb-1">Niche-Segmented Order Downloads</h2>
      <p className="text-sm text-gray-500 mb-4">2 sheets per niche: <b>Dealer</b> (one row per order — products grouped) and <b>In-House</b> (full — address, phone, prices, AWB). Open the HTML and use browser Print → Save as PDF.</p>

      <div className="flex items-center gap-3 mb-5 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
        <label htmlFor="export-date" className="text-sm font-semibold text-emerald-900">Order date (IST):</label>
        <input
          id="export-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayIST}
          data-testid="mt-export-date-picker"
          className="border border-emerald-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <button
          type="button"
          onClick={() => setDate(todayIST)}
          data-testid="mt-export-date-today"
          className="text-xs text-emerald-700 hover:text-emerald-900 underline"
        >
          Today
        </button>
      </div>

      {['anti-aging', 'skincare', 'cosmetics'].map(niche => (
        <div key={niche} className="border-t border-gray-100 py-4 first:border-t-0">
          <h3 className="font-bold capitalize mb-2">{niche.replace('-', ' ')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => download(niche, 'dealer')}
              data-testid={`mt-export-${niche}-dealer`}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 px-4 rounded-lg inline-flex items-center gap-2"
            >
              <FileDown size={14} /> Dealer Sheet
            </button>
            <button
              onClick={() => download(niche, 'inhouse')}
              data-testid={`mt-export-${niche}-inhouse`}
              className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold py-2 px-4 rounded-lg inline-flex items-center gap-2"
            >
              <FileDown size={14} /> In-House Sheet
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 5. Delhivery Sync Panel
// ============================================================
function DelhiverySyncPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const sync = async () => {
    setBusy(true); setResult(null); setErr('');
    try {
      const { data } = await axios.post(`${API}/admin/orders/sync-delhivery`, {}, { headers: getAdminAuthHeaders(), timeout: 120000 });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
      <h2 className="font-bold text-lg mb-1">Delhivery Auto-Status Sync</h2>
      <p className="text-sm text-gray-500 mb-4">Pulls latest tracking from Delhivery for every order with an AWB. Updates statuses: <b>shipped → in-transit → delivered / returned</b>.</p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-4">
        <b>Note:</b> Set <code>DELHIVERY_API_KEY</code> environment variable for this to work. Without it, the call will report "not configured".
      </div>
      <button onClick={sync} disabled={busy} data-testid="mt-delhivery-sync" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
        {busy ? <RefreshCw className="animate-spin" size={16} /> : <Truck size={16} />} Sync Now
      </button>
      {err && <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{err}</div>}
      {result && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          ✓ Synced {result.synced} orders, updated {result.updated}, errors {result.errors}
        </div>
      )}
    </div>
  );
}
