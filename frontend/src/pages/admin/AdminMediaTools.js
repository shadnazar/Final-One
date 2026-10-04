import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronLeft, Loader2, Check, Upload, X, Search, Tag as TagIcon,
  ShieldCheck, Sparkles, Image as ImageIcon, Users as UsersIcon, Trash2,
  Layout as LayoutIcon, Plus, Smartphone,
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AdminMediaTools — one admin page, two related workflows:
 *
 *  Tab A: Test Reports
 *   Per-product uploader for the dermatologist / lab test-report certificate.
 *   Saves `test_report_image`, `test_report_lab`, `test_report_date`, and
 *   flips `is_dermat_tested=true`. The storefront renders a green "Dermat
 *   Tested" badge on every product that has a report on file.
 *
 *  Tab B: SEO Keywords
 *   Per-product alt-text + multi-keyword injector. Press Enter to add each
 *   keyword as a chip. Saves `image_alt_text` and `seo_keywords[]`. These
 *   get emitted as <img alt> and a JSON-LD keywords block on public pages.
 */
export default function AdminMediaTools() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const auth = useMemo(() => ({ headers: { 'X-Admin-Token': adminToken } }), [adminToken]);

  const [tab, setTab] = useState('reports');
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(null);

  useEffect(() => {
    if (!adminToken) return;
    // Show ONLY Celesta Glow's own anti-aging SKUs (the flagship 6) — the
    // ~8k third-party products are irrelevant for certificate / SEO admin.
    axios.get(`${API}/api/products?niche=anti-aging&limit=50`, auth)
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
        setProducts(items);
      })
      .catch(() => setProducts([]));
  }, [adminToken, auth]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      (p.short_name || p.name || '').toLowerCase().includes(needle)
      || (p.slug || '').toLowerCase().includes(needle),
    );
  }, [products, q]);

  const selected = useMemo(
    () => products.find((p) => p.slug === selectedSlug) || null,
    [products, selectedSlug],
  );

  const saveProduct = async (patch) => {
    if (!selectedSlug) return;
    const r = await axios.put(`${API}/api/admin/products/${selectedSlug}`, patch, auth);
    if (r.data?.success) {
      setProducts((prev) => prev.map((p) => (p.slug === selectedSlug ? { ...p, ...patch } : p)));
    }
    return r.data;
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-stone-100" data-testid="back-to-admin">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900">Media, SEO &amp; Branding</h1>
            <p className="text-xs text-stone-500">Certificates · Before/After · Top Banner · Splash · Niche &amp; Combo</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} testId="tab-reports">
            <ShieldCheck size={14} /> Certificates
          </TabButton>
          <TabButton active={tab === 'seo'} onClick={() => setTab('seo')} testId="tab-seo">
            <TagIcon size={14} /> SEO Keywords
          </TabButton>
          <TabButton active={tab === 'broadcast'} onClick={() => setTab('broadcast')} testId="tab-broadcast">
            <Sparkles size={14} /> Global Broadcast
          </TabButton>
          <TabButton active={tab === 'top-banner'} onClick={() => setTab('top-banner')} testId="tab-top-banner">
            <LayoutIcon size={14} /> Top Banner
          </TabButton>
          <TabButton active={tab === 'splash'} onClick={() => setTab('splash')} testId="tab-splash">
            <Smartphone size={14} /> Splash Screen
          </TabButton>
          <TabButton active={tab === 'before-after'} onClick={() => setTab('before-after')} testId="tab-before-after">
            <UsersIcon size={14} /> Before / After
          </TabButton>
          <TabButton active={tab === 'niche-mode'} onClick={() => setTab('niche-mode')} testId="tab-niche-mode">
            <ShieldCheck size={14} /> Niche &amp; Combo
          </TabButton>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: product list — hidden on top-banner + splash + before-after + niche-mode tabs */}
        {tab !== 'top-banner' && tab !== 'splash' && tab !== 'before-after' && tab !== 'niche-mode' && (
        <div className="lg:col-span-4 bg-white rounded-2xl ring-1 ring-stone-200 overflow-hidden">
          <div className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                data-testid="product-search-input"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-stone-100">
            {filtered.map((p) => {
              const hasReport = !!p.test_report_image;
              const hasSeo = !!(p.image_alt_text || (p.seo_keywords && p.seo_keywords.length));
              const active = p.slug === selectedSlug;
              return (
                <button
                  key={p.slug}
                  onClick={() => setSelectedSlug(p.slug)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${active ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}
                  data-testid={`product-row-${p.slug}`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                    {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{p.short_name || p.name}</p>
                    <p className="text-[11px] text-stone-500 truncate">{p.slug}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {hasReport && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">RPT</span>}
                    {hasSeo && <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">SEO</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-stone-500">No products found</div>
            )}
          </div>
        </div>
        )}

        {/* Right: editor pane */}
        <div className={tab === 'top-banner' || tab === 'splash' || tab === 'before-after' || tab === 'niche-mode' ? 'lg:col-span-12' : 'lg:col-span-8'}>
          {tab === 'broadcast' && (
            <GlobalKeywordBroadcast auth={auth} />
          )}
          {tab === 'top-banner' && (
            <TopBannerManager auth={auth} />
          )}
          {tab === 'splash' && (
            <SplashScreenManager auth={auth} />
          )}
          {tab === 'before-after' && (
            <BeforeAfterManager auth={auth} products={products} />
          )}
          {tab === 'niche-mode' && (
            <NicheModeManager auth={auth} />
          )}
          {tab !== 'broadcast' && tab !== 'top-banner' && tab !== 'splash' && tab !== 'before-after' && tab !== 'niche-mode' && !selected && tab === 'reports' && (
            <ExistingCertificatesGrid auth={auth} onPick={(slug) => setSelectedSlug(slug)} />
          )}
          {tab !== 'broadcast' && tab !== 'top-banner' && tab !== 'splash' && tab !== 'before-after' && tab !== 'niche-mode' && !selected && tab !== 'reports' && (
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-10 text-center">
              <ImageIcon size={28} className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-500">Select a product on the left to edit its {tab === 'reports' ? 'certificate / lab report' : 'SEO metadata'}.</p>
            </div>
          )}
          {tab !== 'broadcast' && tab !== 'top-banner' && tab !== 'splash' && tab !== 'before-after' && tab !== 'niche-mode' && selected && tab === 'reports' && (
            <>
              <TestReportEditor product={selected} onSave={saveProduct} auth={auth} />
              <div className="mt-5">
                <ExistingCertificatesGrid auth={auth} onPick={(slug) => setSelectedSlug(slug)} activeSlug={selectedSlug} />
              </div>
            </>
          )}
          {tab !== 'broadcast' && tab !== 'top-banner' && tab !== 'splash' && tab !== 'before-after' && tab !== 'niche-mode' && selected && tab === 'seo' && (
            <SeoEditor product={selected} onSave={saveProduct} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab C — Global Broadcast (adds a keyword to EVERY product in one click)
// ─────────────────────────────────────────────────────────────────────────

function GlobalKeywordBroadcast({ auth }) {
  const [keywords, setKeywords] = useState([]);
  const [draft, setDraft] = useState('');
  const [niche, setNiche] = useState('');       // '' = all niches
  const [onlyActive, setOnlyActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const addDraft = () => {
    const c = draft.trim().toLowerCase();
    if (!c || keywords.includes(c)) { setDraft(''); return; }
    setKeywords((p) => [...p, c]);
    setDraft('');
  };
  const remove = (k) => setKeywords((p) => p.filter((x) => x !== k));

  const broadcast = async () => {
    if (!keywords.length) { alert('Add at least one keyword first'); return; }
    const label = niche ? `all ${niche} products` : 'ALL products in the catalog';
    if (!window.confirm(`Broadcast "${keywords.join(', ')}" to ${label}?`)) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await axios.post(
        `${API}/api/admin/seo-keywords/broadcast`,
        { keywords, only_niche: niche || null, only_active: onlyActive },
        auth,
      );
      setResult(r.data);
      setKeywords([]);
    } catch (e) {
      alert('Broadcast failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="global-broadcast-tab">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-emerald-600" />
        <h2 className="text-base font-black text-stone-900">Global SEO Keyword Injector</h2>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        Add one or more keywords, then press <b>Broadcast</b>. Every product in the catalog gets those keywords appended to its <code>seo_keywords[]</code> (duplicates ignored).
      </p>

      <label className="block mb-4">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Keywords to broadcast</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-stone-200 focus-within:ring-2 focus-within:ring-emerald-500/30">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
              {kw}
              <button onClick={() => remove(kw)} className="w-4 h-4 rounded-full hover:bg-emerald-200 flex items-center justify-center">
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addDraft(); }
              else if (e.key === 'Backspace' && draft === '' && keywords.length) {
                setKeywords((p) => p.slice(0, -1));
              }
            }}
            onBlur={() => draft && addDraft()}
            placeholder={keywords.length ? 'Add another…' : 'Type a keyword, press Enter to add'}
            className="flex-1 min-w-[160px] px-1 py-1 text-sm bg-transparent focus:outline-none"
            data-testid="broadcast-keyword-input"
          />
        </div>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label>
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Scope</span>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
            data-testid="broadcast-niche-select"
          >
            <option value="">All niches</option>
            <option value="anti-aging">Anti-Aging only</option>
            <option value="skincare">Skincare only</option>
            <option value="cosmetics">Cosmetics only</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} data-testid="broadcast-active-only" />
          <span className="text-sm text-stone-700">Only active products (skip inactive)</span>
        </label>
      </div>

      <button
        onClick={broadcast}
        disabled={busy || !keywords.length}
        className="inline-flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-700 disabled:opacity-50"
        data-testid="broadcast-submit"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {busy ? 'Broadcasting…' : `Broadcast to ${niche || 'All'} Products`}
      </button>

      {result && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-bold text-emerald-800 mb-1 flex items-center gap-1.5"><Check size={14} /> Broadcast complete</p>
          <p className="text-xs text-emerald-700">
            {result.products_modified} of {result.products_matched} products updated · Keywords: {(result.keywords_added || []).join(', ')}
          </p>
        </div>
      )}

      {/* ─── Bulk alt-text auto-fill ─── */}
      <div className="mt-8 pt-6 border-t border-dashed border-stone-200">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon size={14} className="text-blue-600" />
          <h3 className="text-sm font-black text-stone-900">Auto-Fill Alt Text (all products)</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Backfills <code>image_alt_text</code> on every active product using<br />
          <b><code>{'{Product Name} — dermatologist recommended {niche} from Celesta Glow Kerala'}</code></b>
          <br />Skips products that already have alt text. This is what Google image search reads.
        </p>
        <button
          onClick={async () => {
            if (!window.confirm('Auto-fill alt text on all active products missing it?')) return;
            try {
              const r = await axios.post(
                `${API}/api/admin/seo-keywords/bulk-alt-text`,
                { only_active: true, overwrite: false },
                auth,
              );
              alert(`Alt text backfilled — ${r.data.products_modified} of ${r.data.products_matched} products updated.`);
            } catch (e) { alert('Failed: ' + (e.response?.data?.detail || e.message)); }
          }}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-full"
          data-testid="alt-text-backfill-btn"
        >
          <Sparkles size={14} /> Auto-Fill Alt Text
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab A — Test Report editor
// ─────────────────────────────────────────────────────────────────────────

function TestReportEditor({ product, onSave, auth }) {
  const [image, setImage] = useState(product.test_report_image || '');
  const [lab, setLab] = useState(product.test_report_lab || '');
  const [date, setDate] = useState(product.test_report_date || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setImage(product.test_report_image || '');
    setLab(product.test_report_lab || '');
    setDate(product.test_report_date || '');
    setSaved(false);
  }, [product]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'test-reports');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setImage(r.data.url || r.data.secure_url || '');
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        test_report_image: image || null,
        test_report_lab: lab || null,
        test_report_date: date || null,
        is_dermat_tested: !!image,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="test-report-editor">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-emerald-600" />
        <h2 className="text-base font-black text-stone-900">Dermatologist Test Report</h2>
      </div>

      <p className="text-xs text-stone-500 mb-5">Upload the certificate PDF or image. The badge auto-appears on {product.short_name || product.name}&apos;s card and detail page.</p>

      {/* Preview + upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-stone-200 bg-stone-50 flex items-center justify-center">
          {image ? (
            <img src={image} alt="Test report" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-stone-400">
              <ImageIcon size={28} className="mx-auto mb-2" />
              <p className="text-xs">No report uploaded yet</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Upload Report</span>
            <label className="mt-1.5 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors">
              <Upload size={14} />
              <span className="text-sm">{uploading ? 'Uploading…' : 'Choose file'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleUpload(e.target.files?.[0])}
                className="hidden"
                data-testid="test-report-upload-input"
              />
            </label>
          </label>
          {image && (
            <button
              onClick={() => setImage('')}
              className="text-xs text-red-600 flex items-center gap-1 hover:underline"
              data-testid="test-report-remove"
            >
              <X size={12} /> Remove uploaded report
            </button>
          )}
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Lab / Dermatologist</span>
            <input
              value={lab}
              onChange={(e) => setLab(e.target.value)}
              placeholder="e.g. Cosmoderm Labs · Bangalore"
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              data-testid="test-report-lab-input"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tested On</span>
            <input
              type="date"
              value={date ? date.slice(0, 10) : ''}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              data-testid="test-report-date-input"
            />
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-700 disabled:opacity-50"
        data-testid="test-report-save"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : null)}
        {saved ? 'Saved!' : (saving ? 'Saving…' : 'Save Report')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab B — SEO Keywords editor
// ─────────────────────────────────────────────────────────────────────────

function SeoEditor({ product, onSave }) {
  const [alt, setAlt] = useState(product.image_alt_text || '');
  const [keywords, setKeywords] = useState(product.seo_keywords || []);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAlt(product.image_alt_text || '');
    setKeywords(product.seo_keywords || []);
    setDraft('');
    setSaved(false);
  }, [product]);

  const addDraft = () => {
    const cleaned = draft.trim().toLowerCase();
    if (!cleaned || keywords.includes(cleaned)) {
      setDraft('');
      return;
    }
    setKeywords((prev) => [...prev, cleaned]);
    setDraft('');
  };

  const remove = (kw) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        image_alt_text: alt || null,
        seo_keywords: keywords,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="seo-editor">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-purple-600" />
        <h2 className="text-base font-black text-stone-900">SEO · Alt Text &amp; Keywords</h2>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        Alt text goes into every &lt;img&gt; tag on {product.short_name || product.name}&apos;s public pages.
        Keywords are emitted as a JSON-LD block for search engines to widen your organic reach.
      </p>

      <label className="block mb-5">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Image Alt Text</span>
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="e.g. Celesta Glow Anti-Aging Serum bottle with Retinol formula"
          className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          data-testid="seo-alt-input"
        />
        <p className="mt-1 text-[10px] text-stone-400">Aim for 80–120 characters, describe the visible product + main benefit.</p>
      </label>

      <label className="block mb-3">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Keywords</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-stone-200 focus-within:ring-2 focus-within:ring-purple-500/30">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
              {kw}
              <button
                onClick={() => remove(kw)}
                className="w-4 h-4 rounded-full hover:bg-purple-200 flex items-center justify-center"
                data-testid={`seo-remove-${kw}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addDraft();
              } else if (e.key === 'Backspace' && draft === '' && keywords.length) {
                setKeywords((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => draft && addDraft()}
            placeholder={keywords.length ? 'Add another…' : 'Type a keyword then press Enter'}
            className="flex-1 min-w-[140px] px-1 py-1 text-sm bg-transparent focus:outline-none"
            data-testid="seo-keyword-input"
          />
        </div>
        <p className="mt-1 text-[10px] text-stone-400">Press Enter or comma to add each keyword.  Backspace with empty input removes the last chip.</p>
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-purple-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-purple-700 disabled:opacity-50"
        data-testid="seo-save"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : null)}
        {saved ? 'Saved!' : (saving ? 'Saving…' : 'Save SEO')}
      </button>
    </div>
  );
}

function TabButton({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 -mb-px inline-flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${
        active ? 'text-emerald-700 border-emerald-600' : 'text-stone-500 border-transparent hover:text-stone-800'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Tab D — Before / After Manager (global + per-product transformation strip)
// ─────────────────────────────────────────────────────────────────────────

function BeforeAfterManager({ auth, products }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    is_global: true,
    product_slug: '',
    customer_name: '',
    image: '',
    before_image: '',
    after_image: '',
    duration: '',
    description: '',
    sort_order: 0,
  });

  const load = async () => {
    try {
      const r = await axios.get(`${API}/api/admin/before-after`, auth);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setRows([]);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const uploadFile = async (field, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'before-after');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setForm((prev) => ({ ...prev, [field]: r.data.url || r.data.secure_url || '' }));
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.image && !(form.before_image && form.after_image)) {
      alert('Upload either a single stitched B/A image OR both a before + after image.');
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/api/admin/before-after`, {
        ...form,
        product_slug: form.is_global ? null : (form.product_slug || null),
      }, auth);
      setForm({ is_global: true, product_slug: '', customer_name: '', image: '', before_image: '', after_image: '', duration: '', description: '', sort_order: 0 });
      await load();
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  const remove = async (ba_id) => {
    if (!window.confirm('Delete this before/after entry?')) return;
    await axios.delete(`${API}/api/admin/before-after/${ba_id}`, auth);
    await load();
  };

  return (
    <div className="space-y-5" data-testid="before-after-manager">
      <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <UsersIcon size={16} className="text-fuchsia-600" />
          <h2 className="text-base font-black text-stone-900">Add Before / After Transformation</h2>
        </div>
        <p className="text-xs text-stone-500 mb-5">
          Upload one stitched image (Before | After side-by-side) — that&apos;s the format Celesta Glow uses on the homepage strip. Or upload separate before + after images.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Placement</span>
            <select
              value={form.is_global ? 'global' : 'product'}
              onChange={(e) => setForm(p => ({ ...p, is_global: e.target.value === 'global' }))}
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
              data-testid="ba-placement"
            >
              <option value="global">Global (homepage strip)</option>
              <option value="product">Per-product (PDP strip)</option>
            </select>
          </label>
          {!form.is_global && (
            <label className="block">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Product</span>
              <select
                value={form.product_slug}
                onChange={(e) => setForm(p => ({ ...p, product_slug: e.target.value }))}
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
                data-testid="ba-product-select"
              >
                <option value="">— pick a product —</option>
                {products.filter(p => (p.niche || '') === 'anti-aging').map(p => (
                  <option key={p.slug} value={p.slug}>{p.short_name || p.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <BaFileField label="Stitched B/A Image (recommended)" value={form.image} onFile={(f) => uploadFile('image', f)} onClear={() => setForm(p => ({ ...p, image: '' }))} testId="ba-image" />
          <BaFileField label="Before Image (separate)" value={form.before_image} onFile={(f) => uploadFile('before_image', f)} onClear={() => setForm(p => ({ ...p, before_image: '' }))} testId="ba-before" />
          <BaFileField label="After Image (separate)" value={form.after_image} onFile={(f) => uploadFile('after_image', f)} onClear={() => setForm(p => ({ ...p, after_image: '' }))} testId="ba-after" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Customer name</span>
            <input value={form.customer_name} onChange={(e) => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="e.g. Aisha, Kochi" className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200" data-testid="ba-customer" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Duration</span>
            <input value={form.duration} onChange={(e) => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g. 6 weeks" className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200" data-testid="ba-duration" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Sort order</span>
            <input type="number" value={form.sort_order} onChange={(e) => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200" data-testid="ba-sort" />
          </label>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Description</span>
          <input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Cleared pigmentation and dark spots" className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200" data-testid="ba-description" />
        </label>

        <button
          onClick={submit}
          disabled={busy || uploading}
          className="inline-flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-sm px-5 py-2.5 rounded-full disabled:opacity-50"
          data-testid="ba-submit"
        >
          {busy || uploading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {uploading ? 'Uploading…' : busy ? 'Saving…' : 'Save Transformation'}
        </button>
      </div>

      {/* Existing list */}
      <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6">
        <h3 className="text-sm font-black text-stone-900 mb-3">Uploaded transformations ({rows.length})</h3>
        {rows.length === 0 ? (
          <p className="text-xs text-stone-500">No before/after images yet. Add your first one above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => (
              <div key={r.ba_id} className="ring-1 ring-stone-200 rounded-xl overflow-hidden bg-stone-50" data-testid={`ba-row-${r.ba_id}`}>
                <div className="aspect-video bg-white flex items-center justify-center">
                  {r.image ? (
                    <img src={r.image} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                      <img src={r.before_image} alt="Before" className="w-full h-full object-cover" />
                      <img src={r.after_image} alt="After" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-stone-900">{r.customer_name || 'Anonymous'}</p>
                    <p className="text-stone-500">
                      {r.is_global ? 'Global' : (r.product_slug || 'Product')}
                      {r.duration ? ` · ${r.duration}` : ''}
                    </p>
                  </div>
                  <button onClick={() => remove(r.ba_id)} className="text-red-500 hover:text-red-700 p-1" data-testid={`ba-delete-${r.ba_id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab G — Splash Screen Manager (upload the loading screen image)
// ─────────────────────────────────────────────────────────────────────────

function SplashScreenManager({ auth }) {
  const [image, setImage] = useState('');
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/site-settings`).then(r => {
      setImage(r.data?.splash_image || '');
      setInitialLoaded(true);
    }).catch(() => setInitialLoaded(true));
  }, []);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'splash');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setImage(r.data.url || r.data.secure_url || '');
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally { setUploading(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await axios.put(`${API}/api/admin/site-settings`, { splash_image: image || '' }, auth);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  if (!initialLoaded) return <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-emerald-500" /></div>;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="splash-screen-manager">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone size={16} className="text-emerald-600" />
        <h2 className="text-base font-black text-stone-900">Splash Screen Image</h2>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        The full-screen image every visitor sees on their <b>first page load</b> of a browser session.
        Portrait 1080×1920 works best. Leave empty to use the bundled Celesta Glow default.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <label className="block">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Upload image</span>
          <div className="mt-1.5 flex flex-col items-center justify-center gap-1 py-4 px-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors min-h-[180px]">
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span className="text-xs">Uploading…</span>
              </>
            ) : image ? (
              <img src={image} alt="Current splash" className="max-h-40 object-contain" />
            ) : (
              <>
                <Upload size={16} />
                <span className="text-xs">Choose splash image</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} className="hidden" data-testid="splash-upload-input" />
          </div>
          {image && (
            <button
              onClick={() => setImage('')}
              className="mt-1 text-[10px] text-red-600 flex items-center gap-1 hover:underline"
              data-testid="splash-clear"
            >
              <X size={10} /> Remove (reverts to default)
            </button>
          )}
        </label>

        {/* Live phone-frame preview */}
        <div>
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Live preview</span>
          <div className="mt-1.5 mx-auto max-w-[220px] aspect-[9/19] rounded-[28px] ring-8 ring-stone-900/90 bg-white shadow-2xl overflow-hidden flex items-center justify-center relative" data-testid="splash-preview-frame">
            <img
              src={image || (process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/splash-celesta-glow.png` : '/splash-celesta-glow.png')}
              alt="Splash preview"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-stone-900 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || uploading}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-full disabled:opacity-50"
          data-testid="splash-save"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : <Smartphone size={14} />)}
          {saved ? 'Saved!' : (busy ? 'Saving…' : 'Save Splash Screen')}
        </button>
        <p className="text-[11px] text-stone-500">
          Changes appear on the next fresh browser session (clears session cache).
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Existing Certificates grid — shows all products already carrying a lab
// report so admin can instantly see coverage + jump into any one to update.
// ─────────────────────────────────────────────────────────────────────────

function ExistingCertificatesGrid({ auth, onPick, activeSlug }) {
  const [rows, setRows] = useState(null);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/api/admin/certificates`, auth);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setRows([]);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (rows === null) return null;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="existing-certificates-grid">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h3 className="text-sm sm:text-base font-black text-stone-900">Existing certificates</h3>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {rows.length}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Tap any card to update its lab report.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-stone-500 py-4">No products have a certificate uploaded yet. Pick a product from the left list to add one.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onPick && onPick(p.slug)}
              className={`text-left group rounded-xl ring-1 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all bg-stone-50 ${activeSlug === p.slug ? 'ring-emerald-500 ring-2' : 'ring-stone-200'}`}
              data-testid={`existing-cert-${p.slug}`}
            >
              <div className="aspect-[4/5] bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={p.test_report_image}
                  alt={`Certificate for ${p.short_name || p.name}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-black text-stone-900 leading-snug line-clamp-2">{p.short_name || p.name}</p>
                {p.test_report_lab && <p className="text-[10px] text-stone-500 truncate mt-0.5">{p.test_report_lab}</p>}
                <p className="text-[10px] font-bold text-emerald-700 mt-1 inline-flex items-center gap-1">
                  <Check size={10} /> Uploaded
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Tab F — Top Banner Manager (independent from niche hero)
// ─────────────────────────────────────────────────────────────────────────

function TopBannerManager({ auth }) {
  const [cfg, setCfg] = useState(null);
  const [uploading, setUploading] = useState(null); // 'desktop' | 'mobile' | null
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/admin/top-banner`, auth)
      .then(r => setCfg(r.data))
      .catch(() => setCfg({ image_desktop: '', image_mobile: '', link_url: '/shop?niche=anti-aging', is_active: true }));
  }, [auth]);

  const uploadFile = async (field, file) => {
    if (!file) return;
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'top-banner');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setCfg(prev => ({ ...prev, [field === 'desktop' ? 'image_desktop' : 'image_mobile']: r.data.url || r.data.secure_url || '' }));
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally { setUploading(null); }
  };

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await axios.put(`${API}/api/admin/top-banner`, cfg, auth);
      setCfg(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  if (!cfg) return <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-emerald-500" /></div>;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="top-banner-manager">
      <div className="flex items-center gap-2 mb-3">
        <LayoutIcon size={16} className="text-emerald-600" />
        <h2 className="text-base font-black text-stone-900">Homepage Top Banner</h2>
      </div>
      <p className="text-xs text-stone-500 mb-5">
        The wide landscape image that renders at the very top of the homepage — right below the delivery
        location strip. Independent from the niche hero card. Upload separate desktop &amp; mobile artwork
        for the sharpest fit. Turn off to hide it entirely.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <TbFileField
          label="Desktop image"
          value={cfg.image_desktop}
          uploading={uploading === 'desktop'}
          onFile={(f) => uploadFile('desktop', f)}
          onClear={() => setCfg(p => ({ ...p, image_desktop: '' }))}
          testId="topbanner-desktop"
          hint="Wide landscape (e.g. 2400×900)"
        />
        <TbFileField
          label="Mobile image (optional)"
          value={cfg.image_mobile}
          uploading={uploading === 'mobile'}
          onFile={(f) => uploadFile('mobile', f)}
          onClear={() => setCfg(p => ({ ...p, image_mobile: '' }))}
          testId="topbanner-mobile"
          hint="Portrait-friendly (e.g. 1080×1440)"
        />
      </div>

      <label className="block mb-4">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Click destination</span>
        <input
          value={cfg.link_url || ''}
          onChange={(e) => setCfg(p => ({ ...p, link_url: e.target.value }))}
          placeholder="/shop?niche=anti-aging"
          className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          data-testid="topbanner-link"
        />
        <p className="mt-1 text-[10px] text-stone-400">Where the banner sends tappers. Use a full https:// URL for external sites.</p>
      </label>

      <label className="inline-flex items-center gap-2 mb-6 cursor-pointer" data-testid="topbanner-active-label">
        <input
          type="checkbox"
          checked={!!cfg.is_active}
          onChange={(e) => setCfg(p => ({ ...p, is_active: e.target.checked }))}
          className="w-4 h-4 accent-emerald-600"
          data-testid="topbanner-active"
        />
        <span className="text-sm font-bold text-stone-800">Show banner on homepage</span>
      </label>

      <div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-full disabled:opacity-50"
          data-testid="topbanner-save"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : (saved ? <Check size={14} /> : <LayoutIcon size={14} />)}
          {saved ? 'Saved!' : (busy ? 'Saving…' : 'Save Banner')}
        </button>
      </div>
    </div>
  );
}

function TbFileField({ label, value, uploading, onFile, onClear, testId, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">{label}</span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <label className="flex flex-col items-center justify-center gap-1 py-4 px-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors min-h-[140px]">
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin text-emerald-600" />
            <span className="text-xs">Uploading…</span>
          </>
        ) : value ? (
          <img src={value} alt="" className="max-h-32 object-contain" />
        ) : (
          <>
            <Upload size={16} />
            <span className="text-xs">Choose image</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" data-testid={`${testId}-input`} />
      </label>
      {value && !uploading && (
        <button onClick={onClear} className="mt-1 text-[10px] text-red-600 flex items-center gap-1 hover:underline" data-testid={`${testId}-clear`}>
          <X size={10} /> Remove
        </button>
      )}
    </div>
  );
}


function BaFileField({ label, value, onFile, onClear, testId }) {  return (
    <div>
      <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">{label}</span>
      <label className="mt-1.5 flex flex-col items-center justify-center gap-1 py-3 px-4 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-fuchsia-500 hover:bg-fuchsia-50/30 transition-colors min-h-[100px]">
        {value ? (
          <img src={value} alt="" className="max-h-24 object-contain" />
        ) : (
          <>
            <Upload size={16} />
            <span className="text-xs">Choose file</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" data-testid={`${testId}-input`} />
      </label>
      {value && (
        <button onClick={onClear} className="mt-1 text-[10px] text-red-600 flex items-center gap-1 hover:underline" data-testid={`${testId}-clear`}>
          <X size={10} /> Remove
        </button>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Tab E — Niche Mode Manager (Anti-Aging Only vs Three-Niche)
// ─────────────────────────────────────────────────────────────────────────

function NicheModeManager({ auth }) {
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [combo, setCombo] = useState(null);
  const [comboBusy, setComboBusy] = useState(false);
  const [comboSaved, setComboSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/niche-mode`).then(r => setActive(r.data.active_niches || ['anti-aging'])).catch(() => setActive(['anti-aging']));
    axios.get(`${API}/api/admin/combo-bonus`, auth).then(r => setCombo(r.data)).catch(() => setCombo({ tiers: [{items:2,amount:99},{items:3,amount:150},{items:4,amount:200}], min_subtotal: 500 }));
  }, [auth]);

  const save = async (list) => {
    setBusy(true);
    try {
      const r = await axios.put(`${API}/api/admin/niche-mode`, { active_niches: list }, auth);
      setActive(r.data.active_niches);
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  const saveCombo = async () => {
    if (!combo) return;
    setComboBusy(true);
    try {
      const r = await axios.put(`${API}/api/admin/combo-bonus`, {
        tiers: (combo.tiers || []).map(t => ({ items: parseInt(t.items) || 2, amount: parseInt(t.amount) || 0 })).filter(t => t.items >= 2 && t.amount > 0),
        min_subtotal: parseInt(combo.min_subtotal) || 0,
      }, auth);
      setCombo(r.data);
      setComboSaved(true);
      setTimeout(() => setComboSaved(false), 2500);
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally { setComboBusy(false); }
  };

  if (!active) return <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-emerald-500" /></div>;

  const isAntiOnly = active.length === 1 && active[0] === 'anti-aging';
  const isThree = active.length >= 3;

  return (
    <div className="space-y-5" data-testid="niche-mode-manager">
      {/* ─── Niche Mode ─── */}
      <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-emerald-600" />
          <h2 className="text-base font-black text-stone-900">Niche Mode</h2>
        </div>
        <p className="text-xs text-stone-500 mb-6">
          Controls which niches the public storefront can see. In <b>Anti-Aging Only</b> mode ~8,000 third-party
          skincare &amp; cosmetics products are hidden from the API entirely — dramatically speeding up mobile
          load. Admin sees the full catalog either way.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => save(['anti-aging'])}
            disabled={busy || isAntiOnly}
            className={`text-left p-4 rounded-2xl border-2 transition-all ${isAntiOnly ? 'border-emerald-600 bg-emerald-50 shadow-inner' : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30'}`}
            data-testid="niche-mode-anti-aging-only"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🎯</span>
              <span className="font-black text-stone-900 text-sm">Anti-Aging Only</span>
              {isAntiOnly && <Check size={16} className="text-emerald-600 ml-auto" />}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">Show only Celesta Glow&apos;s own 6 flagship anti-aging SKUs. Fastest experience. Recommended for pure-play brand focus.</p>
          </button>
          <button
            onClick={() => save(['anti-aging', 'skincare', 'cosmetics'])}
            disabled={busy || isThree}
            className={`text-left p-4 rounded-2xl border-2 transition-all ${isThree ? 'border-emerald-600 bg-emerald-50 shadow-inner' : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30'}`}
            data-testid="niche-mode-three-niche"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🛍️</span>
              <span className="font-black text-stone-900 text-sm">Three Niche</span>
              {isThree && <Check size={16} className="text-emerald-600 ml-auto" />}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">Enable Anti-Aging + Skincare + Cosmetics. Full catalog (~8k products) visible on storefront.</p>
          </button>
        </div>

        <p className="mt-4 text-[11px] text-stone-500">
          Currently active: <b className="text-emerald-700">{active.join(', ')}</b>
        </p>
      </div>

      {/* ─── Combo Bonus Config (tiered) ─── */}
      <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 sm:p-6" data-testid="combo-bonus-manager">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-fuchsia-600" />
          <h2 className="text-base font-black text-stone-900">Combo Bonus — Tiered Discounts</h2>
        </div>
        <p className="text-xs text-stone-500 mb-5">
          Auto-applied when the customer&apos;s cart has that many anti-aging products <b>and</b> the subtotal
          is at least <b>₹{combo?.min_subtotal ?? 500}</b>. The customer sees a live progress bar on the Cart
          page showing the next tier they can unlock.
        </p>

        {!combo ? (
          <div className="p-6 text-center"><Loader2 className="mx-auto animate-spin text-fuchsia-500" /></div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {(combo.tiers || []).map((t, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-stone-200 bg-stone-50" data-testid={`combo-tier-row-${idx}`}>
                  <div className="w-8 h-8 rounded-full bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-black text-xs shrink-0">
                    T{idx + 1}
                  </div>
                  <label className="flex-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Min items</span>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={t.items}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 2;
                        setCombo(prev => ({ ...prev, tiers: prev.tiers.map((x, i) => i === idx ? { ...x, items: v } : x) }));
                      }}
                      className="w-full mt-0.5 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                      data-testid={`combo-tier-items-${idx}`}
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Amount (₹)</span>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={t.amount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setCombo(prev => ({ ...prev, tiers: prev.tiers.map((x, i) => i === idx ? { ...x, amount: v } : x) }));
                      }}
                      className="w-full mt-0.5 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                      data-testid={`combo-tier-amount-${idx}`}
                    />
                  </label>
                  <button
                    onClick={() => setCombo(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }))}
                    className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0"
                    aria-label="Remove tier"
                    data-testid={`combo-tier-delete-${idx}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const last = (combo.tiers || []).slice(-1)[0];
                  const next = last ? { items: last.items + 1, amount: last.amount + 50 } : { items: 2, amount: 99 };
                  setCombo(prev => ({ ...prev, tiers: [...(prev.tiers || []), next] }));
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-fuchsia-300 text-fuchsia-700 text-xs font-bold hover:bg-fuchsia-50"
                data-testid="combo-tier-add"
              >
                <Plus size={13} /> Add another tier
              </button>
            </div>

            <label className="block mb-4">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Min subtotal (₹)</span>
              <input
                type="number"
                min="0"
                value={combo.min_subtotal}
                onChange={(e) => setCombo(prev => ({ ...prev, min_subtotal: e.target.value }))}
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                data-testid="combo-bonus-min-subtotal"
              />
              <p className="mt-1 text-[10px] text-stone-400">Blocks the discount on tiny carts</p>
            </label>

            <button
              onClick={saveCombo}
              disabled={comboBusy}
              className="inline-flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-sm px-5 py-2.5 rounded-full disabled:opacity-50"
              data-testid="combo-bonus-save"
            >
              {comboBusy ? <Loader2 size={14} className="animate-spin" /> : (comboSaved ? <Check size={14} /> : <Sparkles size={14} />)}
              {comboSaved ? 'Saved!' : (comboBusy ? 'Saving…' : 'Save Combo Tiers')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

