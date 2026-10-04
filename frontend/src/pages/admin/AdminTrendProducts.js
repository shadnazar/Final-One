import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Wand2, Save, Eye, EyeOff, Loader2, PlusCircle, Trash2 } from 'lucide-react';

/**
 * AdminTrendProducts — merchant-facing tab for spinning up "trend-based"
 * SKUs from a single blueprint. The generator (Gemini-backed) writes the
 * long-form copy, keywords, alt-tags and trust reviews; the merchant only
 * signs off on the numbers and flips the visibility toggle.
 *
 * Flow:
 *   1. Merchant picks a base product (image gallery cloned from it)
 *   2. Fills the blueprint (name, description, keywords, gallery slides, FAQs)
 *   3. Clicks Generate → we call /api/admin/trend-products/generate
 *   4. Preview lands in the right pane; Save → POST /api/admin/trend-products
 *   5. Trend products land hidden (is_active=false); toggle to publish.
 */
const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'cg_admin_token';
const authHeaders = () => ({ 'X-Admin-Token': localStorage.getItem(TOKEN_KEY) || '' });

const EMPTY_BLUEPRINT = {
  name: '',
  internal_name: '',
  hero_ingredient: '',
  description: '',
  target_keywords: [],
  gallery_slides: [],
  faqs: [],
  category: 'serums',
  subcategory: '',
  niche: 'anti-aging',
  price_mrp: 999,
  price_prepaid: 799,
  price_cod: 849,
  stock_qty: 50,
};

export default function AdminTrendProducts() {
  const [blueprint, setBlueprint] = useState(EMPTY_BLUEPRINT);
  const [baseSlug, setBaseSlug] = useState('');
  const [baseSearch, setBaseSearch] = useState('');
  const [baseResults, setBaseResults] = useState([]);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [existing, setExisting] = useState([]);
  const [tab, setTab] = useState('create');

  const setField = (k, v) => setBlueprint((b) => ({ ...b, [k]: v }));

  const searchBase = async (q) => {
    setBaseSearch(q);
    if (q.length < 2) { setBaseResults([]); return; }
    try {
      const r = await axios.get(`${API}/api/products?search=${encodeURIComponent(q)}&limit=8`);
      const items = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      setBaseResults(items.slice(0, 8));
    } catch {}
  };

  const fetchExisting = async () => {
    try {
      const r = await axios.get(`${API}/api/admin/trend-products`, { headers: authHeaders() });
      setExisting(r.data?.items || []);
    } catch {}
  };
  useEffect(() => { if (tab === 'list') fetchExisting(); }, [tab]);

  const generate = async () => {
    if (!blueprint.name.trim()) return alert('Product name is required.');
    setGenerating(true);
    setPreview(null);
    try {
      const r = await axios.post(
        `${API}/api/admin/trend-products/generate`,
        { blueprint, base_slug: baseSlug || null, niche: blueprint.niche },
        { headers: authHeaders() },
      );
      setPreview(r.data?.product || null);
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 429 && detail?.reason === 'llm_budget_exceeded') {
        alert('Universal Key budget exceeded.\n\nOpen Profile → Manage plan → Universal Key → Add Balance to top up, then retry.');
      } else {
        alert(`Generate failed: ${typeof detail === 'string' ? detail : (detail?.message || e.message)}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/trend-products`, { product: preview }, { headers: authHeaders() });
      alert(`Saved (${preview.slug}). Toggle "Publish" from the list tab to make it live.`);
      setPreview(null);
      setBlueprint(EMPTY_BLUEPRINT);
      setTab('list');
    } catch (e) {
      alert(`Save failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (slug, next) => {
    try {
      await axios.patch(`${API}/api/admin/trend-products/${slug}`, { is_active: next }, { headers: authHeaders() });
      fetchExisting();
    } catch (e) {
      alert(`Toggle failed: ${e.response?.data?.detail || e.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="admin-trend-products">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 flex items-center gap-2">
          <Sparkles className="text-fuchsia-600" /> Trend-Based Products
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Spin up ingredient-boosted SKUs from a shared image base. Gemini writes the copy — you approve the numbers.
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        <button
          data-testid="trend-tab-create"
          onClick={() => setTab('create')}
          className={`px-4 py-2 rounded-full text-sm font-bold ${tab === 'create' ? 'bg-fuchsia-600 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
        >Create</button>
        <button
          data-testid="trend-tab-list"
          onClick={() => setTab('list')}
          className={`px-4 py-2 rounded-full text-sm font-bold ${tab === 'list' ? 'bg-fuchsia-600 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
        >Existing ({existing.length || 0})</button>
      </div>

      {tab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* --- Blueprint form --- */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-black text-stone-800 flex items-center gap-2"><Wand2 size={18} /> Blueprint</h2>

            <Field label="Customer-facing name" value={blueprint.name} onChange={(v) => setField('name', v)} testId="tp-name" />
            <Field label="Internal / concept name" value={blueprint.internal_name} onChange={(v) => setField('internal_name', v)} testId="tp-internal" />
            <Field label="Hero ingredient" value={blueprint.hero_ingredient} onChange={(v) => setField('hero_ingredient', v)} testId="tp-hero" />

            <div>
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Base product (clones image gallery)</label>
              <input
                type="text"
                placeholder="Type to search…"
                value={baseSearch}
                onChange={(e) => searchBase(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
                data-testid="tp-base-search"
              />
              {baseResults.length > 0 && !baseSlug && (
                <div className="mt-1 max-h-40 overflow-y-auto border border-stone-200 rounded-lg divide-y">
                  {baseResults.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => { setBaseSlug(p.slug); setBaseSearch(p.name); setBaseResults([]); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-fuchsia-50 flex items-center gap-2"
                    >
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                      <span className="flex-1">{p.name}</span>
                      <span className="text-stone-400">{p.brand}</span>
                    </button>
                  ))}
                </div>
              )}
              {baseSlug && (
                <p className="mt-1 text-[11px] text-emerald-700 font-bold">Cloning from: {baseSlug} <button onClick={() => { setBaseSlug(''); setBaseSearch(''); }} className="ml-2 text-stone-400 underline">clear</button></p>
              )}
            </div>

            <TextArea label="Description hint" value={blueprint.description} onChange={(v) => setField('description', v)} testId="tp-desc" rows={4} />
            <TagList label="Target keywords (comma-separated)" value={blueprint.target_keywords} onChange={(v) => setField('target_keywords', v)} testId="tp-keywords" />

            <FaqEditor faqs={blueprint.faqs} onChange={(v) => setField('faqs', v)} />

            <div className="grid grid-cols-3 gap-2">
              <NumField label="MRP" value={blueprint.price_mrp} onChange={(v) => setField('price_mrp', v)} testId="tp-mrp" />
              <NumField label="Prepaid" value={blueprint.price_prepaid} onChange={(v) => setField('price_prepaid', v)} testId="tp-prepaid" />
              <NumField label="COD" value={blueprint.price_cod} onChange={(v) => setField('price_cod', v)} testId="tp-cod" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Category" value={blueprint.category} onChange={(v) => setField('category', v)} testId="tp-cat" />
              <Field label="Niche" value={blueprint.niche} onChange={(v) => setField('niche', v)} testId="tp-niche" />
            </div>
            <NumField label="Stock qty" value={blueprint.stock_qty} onChange={(v) => setField('stock_qty', v)} testId="tp-stock" />

            <button
              onClick={generate}
              disabled={generating || !blueprint.name.trim()}
              data-testid="trend-generate-btn"
              className="w-full py-3 rounded-xl bg-fuchsia-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating with Gemini…</> : <><Sparkles size={16} /> Generate with Gemini</>}
            </button>
          </div>

          {/* --- Preview pane --- */}
          <div className="bg-gradient-to-br from-fuchsia-50 to-white rounded-2xl border border-fuchsia-100 p-5">
            <h2 className="font-black text-stone-800 flex items-center gap-2 mb-3"><Eye size={18} /> Preview</h2>
            {!preview && <p className="text-sm text-stone-500">Fill the blueprint and hit <b>Generate</b>. Gemini will draft the marketing copy, keywords and trust reviews here.</p>}
            {preview && (
              <div className="space-y-3 text-sm" data-testid="trend-preview">
                <h3 className="text-lg font-black text-stone-900">{preview.name}</h3>
                {preview.tagline && <p className="text-stone-600 italic">{preview.tagline}</p>}
                {preview.image_gallery?.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {preview.image_gallery.slice(0, 4).map((g, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-white border border-stone-200">
                        <img src={g.url} alt={g.alt} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: preview.description || '' }} className="prose prose-sm max-w-none text-stone-700" />
                {preview.highlights?.length > 0 && (
                  <ul className="list-disc pl-5 text-stone-700 text-xs space-y-1">
                    {preview.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                )}
                {preview.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {preview.keywords.slice(0, 12).map((k, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 font-bold">{k}</span>
                    ))}
                  </div>
                )}
                {preview.reviews_seed?.length > 0 && (
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-[11px] font-black text-stone-500 uppercase tracking-wider">Seed Reviews</p>
                    {preview.reviews_seed.slice(0, 3).map((r, i) => (
                      <div key={i} className="text-xs bg-white rounded-lg p-2 border border-stone-100">
                        <p className="font-bold text-stone-800">{r.name} · {r.rating}★ · <span className="text-stone-500">{r.location}</span></p>
                        <p className="text-stone-600">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  data-testid="trend-save-btn"
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save (hidden)</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          {existing.length === 0 && <p className="text-sm text-stone-500 py-6 text-center">No trend products yet. Create one from the Create tab.</p>}
          <div className="divide-y divide-stone-100">
            {existing.map((p) => (
              <div key={p.slug} className="py-3 flex items-center gap-3" data-testid={`trend-row-${p.slug}`}>
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-stone-900 truncate">{p.name}</p>
                  <p className="text-xs text-stone-500 truncate">{p.slug} · ₹{p.prepaid_price} · stock {p.stock_qty}</p>
                </div>
                <button
                  onClick={() => togglePublish(p.slug, !p.is_active)}
                  className={`px-3 py-1.5 text-xs rounded-full font-black flex items-center gap-1 ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}
                  data-testid={`trend-toggle-${p.slug}`}
                >
                  {p.is_active ? <><Eye size={12} /> LIVE</> : <><EyeOff size={12} /> HIDDEN</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
        data-testid={testId}
      />
    </div>
  );
}

function NumField({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
        data-testid={testId}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, testId, rows = 3 }) {
  return (
    <div>
      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
        data-testid={testId}
      />
    </div>
  );
}

function TagList({ label, value, onChange, testId }) {
  const [text, setText] = useState((value || []).join(', '));
  useEffect(() => { setText((value || []).join(', ')); }, [value]);
  return (
    <div>
      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split(',').map((t) => t.trim()).filter(Boolean))}
        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
        data-testid={testId}
      />
    </div>
  );
}

function FaqEditor({ faqs, onChange }) {
  const add = () => onChange([...(faqs || []), { q: '', a: '' }]);
  const remove = (i) => onChange((faqs || []).filter((_, idx) => idx !== i));
  const set = (i, k, v) => {
    const next = [...(faqs || [])];
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">FAQs</label>
        <button type="button" onClick={add} className="text-xs text-fuchsia-600 font-bold flex items-center gap-1"><PlusCircle size={12} /> Add</button>
      </div>
      {(faqs || []).map((f, i) => (
        <div key={i} className="mt-2 border border-stone-200 rounded-lg p-2 space-y-1">
          <input placeholder="Question" value={f.q} onChange={(e) => set(i, 'q', e.target.value)} className="w-full px-2 py-1.5 border border-stone-200 rounded text-xs" />
          <textarea placeholder="Answer" value={f.a} onChange={(e) => set(i, 'a', e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-stone-200 rounded text-xs" />
          <button type="button" onClick={() => remove(i)} className="text-[10px] text-red-500 flex items-center gap-1"><Trash2 size={10} /> Remove</button>
        </div>
      ))}
    </div>
  );
}
