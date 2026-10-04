import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Save, Upload, Trash2, Image as ImageIcon, Sparkles, Layers, Palette,
  Flame, MessageSquare, Eye, EyeOff, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { getAdminToken, clearAdminToken } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

const NICHES = [
  { key: 'anti-aging', label: 'Anti-Aging', emoji: '✨', color: '#0f766e' },
  { key: 'skincare', label: 'Skincare', emoji: '💧', color: '#0e7490' },
  { key: 'cosmetics', label: 'Cosmetics', emoji: '💄', color: '#be185d' },
];

const SORT_OPTIONS = [
  { value: 'reviews_count', label: 'Most reviewed' },
  { value: 'rating', label: 'Highest rating' },
  { value: 'sort_order', label: 'Manual sort order' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

function deepClone(o) { return JSON.parse(JSON.stringify(o || {})); }

function ImageInput({ value, onChange, headers, label = 'Image', testId }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      onChange(r.data.url);
    } catch (e) {
      alert(e.response?.data?.detail || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-24 h-16 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-gray-400" />}
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="https://… or click upload"
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
            data-testid={testId ? `${testId}-url` : undefined}
          />
          <div className="flex gap-1.5">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} data-testid={testId ? `${testId}-file` : undefined} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
              <Upload size={11} /> {busy ? 'Uploading…' : 'Upload'}
            </button>
            {value && <button type="button" onClick={() => onChange('')} className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold">Clear</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange, label, testId }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
      data-testid={testId}
    >
      {value ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {label}
    </button>
  );
}

export default function AdminNiches() {
  const navigate = useNavigate();
  const [activeNiche, setActiveNiche] = useState('anti-aging');
  const [activeTab, setActiveTab] = useState(() => {
    // Respect ?tab=sale-badge so "Quick Action → Sale Badge" lands directly here.
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t) return t;
    }
    return 'hero';
  });
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const token = getAdminToken();
  const headers = { 'X-Admin-Token': token };

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/site-settings`);
      setSettings(r.data || {});
      setDraft(deepClone(r.data?.niche_settings || {}));
    } catch (e) {
      if (e?.response?.status === 401) { clearAdminToken(); navigate('/admin'); }
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) { navigate('/admin'); return; }
    load();
  }, [load, navigate, token]);

  if (!draft || !settings) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Make sure all 3 niches exist in draft
  NICHES.forEach(n => { if (!draft[n.key]) draft[n.key] = {}; });
  const cur = draft[activeNiche] || {};
  const setCur = (next) => setDraft({ ...draft, [activeNiche]: next });
  const patchHero = (k, v) => setCur({ ...cur, hero: { ...(cur.hero || {}), [k]: v } });
  const patchBs = (k, v) => setCur({ ...cur, bestsellers: { ...(cur.bestsellers || {}), [k]: v } });
  const patchCta = (k, v) => setCur({ ...cur, cta_section: { ...(cur.cta_section || {}), [k]: v } });
  const patchShowcase = (k, v) => setCur({ ...cur, [k]: v });
  const patchShowcaseBanner = (k, v) => setCur({ ...cur, category_showcase_banner: { ...(cur.category_showcase_banner || {}), [k]: v } });
  const patchSale = (k, v) => setCur({ ...cur, sale_badge: { ...(cur.sale_badge || {}), [k]: v } });

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/admin/site-settings`, { niche_settings: draft }, { headers });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      await load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Save failed');
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'hero', label: 'Hero Banner', icon: ImageIcon },
    { id: 'sale-badge', label: 'Sale Badge', icon: Flame },
    { id: 'card-image', label: 'Niche Card (3-up)', icon: ImageIcon },
    { id: 'carousel', label: 'Banner Carousel', icon: Layers },
    { id: 'bestsellers', label: 'Bestsellers Grid', icon: Flame },
    { id: 'showcase', label: 'Shop by Category', icon: Sparkles },
    { id: 'cta', label: 'CTA Section', icon: MessageSquare },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
    { id: 'faq', label: 'FAQ', icon: MessageSquare },
    { id: 'dermat', label: 'Dermatologist', icon: Sparkles },
    { id: 'sections', label: 'Sections / Visibility', icon: Eye },
    { id: 'strip', label: 'Circular Strip', icon: Sparkles },
  ];

  const niche = NICHES.find(n => n.key === activeNiche);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white" data-testid="admin-niches">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2 text-gray-700 hover:text-green-700 text-sm font-semibold" data-testid="back-to-dashboard">
            <ArrowLeft size={18} /> Dashboard
          </button>
          <h1 className="font-heading text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
            <Palette size={18} className="text-green-600" /> Niche Customization
          </h1>
          <div className="flex items-center gap-2">
            {savedFlash && <span className="text-xs text-green-700 font-bold">✓ Saved</span>}
            <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5" data-testid="save-niches">
              <Save size={14} /> {saving ? 'Saving…' : 'Save All Changes'}
            </button>
          </div>
        </div>

        {/* Niche tabs */}
        <div className="max-w-7xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {NICHES.map(n => (
            <button
              key={n.key}
              onClick={() => setActiveNiche(n.key)}
              className={`px-5 py-3 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeNiche === n.key ? 'border-green-600 text-green-700 bg-green-50/40' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              data-testid={`niche-tab-${n.key}`}
              style={activeNiche === n.key ? { borderColor: n.color, color: n.color } : undefined}
            >
              <span className="text-lg">{n.emoji}</span> {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Section tabs */}
          <div className="border-b border-gray-200 bg-gray-50/50 px-2 flex gap-1 overflow-x-auto">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  data-testid={`section-tab-${t.id}`}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <p className="text-xs text-gray-500 -mt-1 mb-1">
              Editing <span className="font-bold" style={{ color: niche.color }}>{niche.emoji} {niche.label}</span> — changes apply to <span className="font-mono">{activeNiche === 'anti-aging' ? '/' : `/${activeNiche}`}</span>
            </p>

            {activeTab === 'hero' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ImageInput
                    value={cur.hero?.image_desktop}
                    onChange={v => patchHero('image_desktop', v)}
                    headers={headers}
                    label="Hero Image (Desktop)"
                    testId={`hero-img-desktop-${activeNiche}`}
                  />
                  <ImageInput
                    value={cur.hero?.image_mobile}
                    onChange={v => patchHero('image_mobile', v)}
                    headers={headers}
                    label="Hero Image (Mobile, optional)"
                    testId={`hero-img-mobile-${activeNiche}`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Eyebrow (uppercase tag)">
                    <input value={cur.hero?.eyebrow || ''} onChange={e => patchHero('eyebrow', e.target.value)} placeholder="Anti-Aging Niche" className="w-full px-3 py-2 border rounded-lg text-sm" data-testid={`hero-eyebrow-${activeNiche}`} />
                  </Field>
                  <Field label="Subtitle paragraph">
                    <input value={cur.hero?.subtitle || ''} onChange={e => patchHero('subtitle', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Title — Line 1">
                    <input value={cur.hero?.title_line1 || ''} onChange={e => patchHero('title_line1', e.target.value)} placeholder="Visible firming" className="w-full px-3 py-2 border rounded-lg text-sm" data-testid={`hero-title1-${activeNiche}`} />
                  </Field>
                  <Field label="Title — Line 2 (italic)">
                    <input value={cur.hero?.title_line2 || ''} onChange={e => patchHero('title_line2', e.target.value)} placeholder="& youthful glow." className="w-full px-3 py-2 border rounded-lg text-sm" data-testid={`hero-title2-${activeNiche}`} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="CTA 1 Label">
                    <input value={cur.hero?.cta1_label || ''} onChange={e => patchHero('cta1_label', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="CTA 1 Link">
                    <input value={cur.hero?.cta1_link || ''} onChange={e => patchHero('cta1_link', e.target.value)} placeholder="/categories" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="CTA 2 Label">
                    <input value={cur.hero?.cta2_label || ''} onChange={e => patchHero('cta2_label', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="CTA 2 Link">
                    <input value={cur.hero?.cta2_link || ''} onChange={e => patchHero('cta2_link', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Accent (primary)">
                    <input type="color" value={cur.hero?.accent || '#0f766e'} onChange={e => patchHero('accent', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                  <Field label="Accent dark (hover)">
                    <input type="color" value={cur.hero?.accent_dark || '#115e59'} onChange={e => patchHero('accent_dark', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                  <Field label="Accent BG (light pill)">
                    <input type="color" value={cur.hero?.accent_bg || '#d1fae5'} onChange={e => patchHero('accent_bg', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 'sale-badge' && (
              <div className="space-y-4" data-testid={`sale-badge-tab-${activeNiche}`}>
                <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-3 text-xs text-rose-900">
                  <strong>Sale Badge — Multiple Offers</strong>. Add as many offers as you like — they'll auto-rotate as a carousel with a left-swipe animation (pauses on hover, dots + arrows for manual nav).
                </div>

                {/* Top-level controls */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <Toggle
                    value={!!cur.sale_badge?.enabled}
                    onChange={v => patchSale('enabled', v)}
                    label={cur.sale_badge?.enabled ? 'VISIBLE on home' : 'HIDDEN'}
                    testId={`sale-badge-toggle-${activeNiche}`}
                  />
                  <Toggle
                    value={cur.sale_badge?.autoplay !== false}
                    onChange={v => patchSale('autoplay', v)}
                    label={cur.sale_badge?.autoplay !== false ? 'Auto-swipe ON' : 'Auto-swipe OFF'}
                    testId={`sale-badge-autoplay-${activeNiche}`}
                  />
                  <Field label="Placement">
                    <select
                      value={cur.sale_badge?.placement || 'inline'}
                      onChange={e => patchSale('placement', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      data-testid={`sale-badge-placement-${activeNiche}`}
                    >
                      <option value="inline">Inline ribbon (above hero)</option>
                      <option value="floating">Floating pill (bottom-right)</option>
                    </select>
                  </Field>
                  <Field label="Swipe interval (sec)">
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={Math.round(((cur.sale_badge?.interval_ms || 5000)) / 1000)}
                      onChange={e => patchSale('interval_ms', Math.max(2, Math.min(30, Number(e.target.value))) * 1000)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      data-testid={`sale-badge-interval-${activeNiche}`}
                    />
                  </Field>
                </div>

                {/* Offers list */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-200">
                  <div>
                    <p className="text-sm font-black text-stone-900">Offers</p>
                    <p className="text-[11px] text-stone-500">{(cur.sale_badge?.offers || []).length} {(cur.sale_badge?.offers || []).length === 1 ? 'offer' : 'offers'} — appear one after another</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const offers = Array.isArray(cur.sale_badge?.offers) ? [...cur.sale_badge.offers] : [];
                      offers.push({
                        text: 'New offer',
                        sub_text: 'LIMITED TIME',
                        code: '',
                        cta_label: 'Shop now',
                        cta_link: '/shop',
                        bg_from: '#dc2626',
                        bg_to: '#7c2d12',
                        text_color: '#ffffff',
                        icon: 'sparkles',
                      });
                      patchSale('offers', offers);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg"
                    data-testid={`sale-badge-add-${activeNiche}`}
                  >
                    + Add offer
                  </button>
                </div>

                {(cur.sale_badge?.offers || []).length === 0 && (
                  <div className="bg-stone-50 ring-1 ring-stone-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-stone-600 mb-2">No offers yet.</p>
                    <p className="text-[11px] text-stone-500">Click "+ Add offer" above to create your first promotional banner. You can add multiple offers and they'll rotate automatically.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {(cur.sale_badge?.offers || []).map((o, idx) => (
                    <div key={idx} className="rounded-2xl ring-1 ring-stone-200 bg-stone-50 overflow-hidden" data-testid={`sale-badge-offer-${activeNiche}-${idx}`}>
                      {/* Live preview strip */}
                      <div
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                        style={{ background: `linear-gradient(120deg, ${o.bg_from || '#dc2626'}, ${o.bg_to || '#7c2d12'})`, color: o.text_color || '#fff' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black tracking-[0.28em] uppercase opacity-85 truncate">{o.sub_text || 'LIMITED TIME'}</p>
                          <p className="text-sm font-black truncate">
                            {o.text || 'Special Offer'}
                            {o.code && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/95" style={{ color: o.bg_from }}>{o.code}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const offers = [...cur.sale_badge.offers];
                              [offers[idx - 1], offers[idx]] = [offers[idx], offers[idx - 1]];
                              patchSale('offers', offers);
                            }}
                            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center"
                            title="Move up"
                            data-testid={`sale-badge-up-${activeNiche}-${idx}`}
                          >↑</button>
                          <button
                            type="button"
                            disabled={idx === (cur.sale_badge.offers.length - 1)}
                            onClick={() => {
                              const offers = [...cur.sale_badge.offers];
                              [offers[idx], offers[idx + 1]] = [offers[idx + 1], offers[idx]];
                              patchSale('offers', offers);
                            }}
                            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center"
                            title="Move down"
                            data-testid={`sale-badge-down-${activeNiche}-${idx}`}
                          >↓</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Remove this offer?')) return;
                              patchSale('offers', cur.sale_badge.offers.filter((_, i) => i !== idx));
                            }}
                            className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/70 text-white flex items-center justify-center"
                            title="Delete"
                            data-testid={`sale-badge-remove-${activeNiche}-${idx}`}
                          >×</button>
                        </div>
                      </div>

                      {/* Editor */}
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={`Offer #${idx + 1} — Main text`}>
                          <input
                            value={o.text || ''}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], text: e.target.value };
                              patchSale('offers', offers);
                            }}
                            placeholder="Flat 20% OFF on first order"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                            data-testid={`sale-badge-text-${activeNiche}-${idx}`}
                          />
                        </Field>
                        <Field label="Eyebrow / sub-text">
                          <input
                            value={o.sub_text || ''}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], sub_text: e.target.value };
                              patchSale('offers', offers);
                            }}
                            placeholder="LIMITED TIME"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </Field>
                        <Field label="Coupon code (optional)">
                          <input
                            value={o.code || ''}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], code: e.target.value.toUpperCase() };
                              patchSale('offers', offers);
                            }}
                            placeholder="GLOW20"
                            className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                          />
                        </Field>
                        <Field label="Icon">
                          <select
                            value={o.icon || 'sparkles'}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], icon: e.target.value };
                              patchSale('offers', offers);
                            }}
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                          >
                            <option value="sparkles">Sparkles ✨</option>
                            <option value="flame">Flame 🔥</option>
                            <option value="tag">Tag 🏷️</option>
                          </select>
                        </Field>
                        <Field label="CTA label">
                          <input
                            value={o.cta_label || ''}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], cta_label: e.target.value };
                              patchSale('offers', offers);
                            }}
                            placeholder="Shop now"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </Field>
                        <Field label="CTA link">
                          <input
                            value={o.cta_link || ''}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], cta_link: e.target.value };
                              patchSale('offers', offers);
                            }}
                            placeholder="/shop"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </Field>
                        <Field label="Gradient — from">
                          <input
                            type="color"
                            value={o.bg_from || '#dc2626'}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], bg_from: e.target.value };
                              patchSale('offers', offers);
                            }}
                            className="w-full h-10 border rounded-lg"
                          />
                        </Field>
                        <Field label="Gradient — to">
                          <input
                            type="color"
                            value={o.bg_to || '#7c2d12'}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], bg_to: e.target.value };
                              patchSale('offers', offers);
                            }}
                            className="w-full h-10 border rounded-lg"
                          />
                        </Field>
                        <Field label="Text colour">
                          <input
                            type="color"
                            value={o.text_color || '#ffffff'}
                            onChange={e => {
                              const offers = [...cur.sale_badge.offers];
                              offers[idx] = { ...offers[idx], text_color: e.target.value };
                              patchSale('offers', offers);
                            }}
                            className="w-full h-10 border rounded-lg"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-stone-500 pt-2 border-t border-stone-100">
                  💡 The carousel auto-pauses when visitors hover. Floating pill placement is dismissible per niche (remembered in browser).
                </p>
              </div>
            )}

            {activeTab === 'card-image' && (
              <div className="space-y-4" data-testid={`card-image-tab-${activeNiche}`}>
                <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <strong>Niche card on the homepage</strong> — the 3-up grid (Anti-Aging / Skincare / Cosmetics) shown right above the bestsellers carousel. Upload a different image for each device so nothing important gets cropped on small/large screens. Mobile is the most important since most traffic comes from phones.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ImageInput
                    value={cur.card_image_mobile}
                    onChange={v => setCur({ ...cur, card_image_mobile: v })}
                    headers={headers}
                    label="📱 Mobile / phone card image (≤640px) — portrait 7:6 works best"
                    testId={`card-image-mobile-${activeNiche}`}
                  />
                  <ImageInput
                    value={cur.card_image_tablet}
                    onChange={v => setCur({ ...cur, card_image_tablet: v })}
                    headers={headers}
                    label="📲 Tablet card image (640-1024px) — 5:3 landscape"
                    testId={`card-image-tablet-${activeNiche}`}
                  />
                  <ImageInput
                    value={cur.card_image_desktop}
                    onChange={v => setCur({ ...cur, card_image_desktop: v })}
                    headers={headers}
                    label="💻 Desktop / PC card image (>1024px) — 5:3 landscape, leave headroom for buttons"
                    testId={`card-image-desktop-${activeNiche}`}
                  />
                  <ImageInput
                    value={cur.card_image_tv}
                    onChange={v => setCur({ ...cur, card_image_tv: v })}
                    headers={headers}
                    label="📺 TV / 4K card image (>1920px, optional) — falls back to desktop"
                    testId={`card-image-tv-${activeNiche}`}
                  />
                </div>
                <p className="text-[11px] text-stone-500">
                  When a slot is empty, the next-smallest image is used (TV → Desktop → Tablet → Mobile → built-in stock photo). Click Save at the top to publish.
                </p>
              </div>
            )}

            {activeTab === 'bestsellers' && (
              <div className="space-y-4">
                <Toggle value={cur.bestsellers?.enabled !== false} onChange={v => patchBs('enabled', v)} label={cur.bestsellers?.enabled !== false ? 'Section ENABLED' : 'Section HIDDEN'} testId={`bs-toggle-${activeNiche}`} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Eyebrow">
                    <input value={cur.bestsellers?.eyebrow || ''} onChange={e => patchBs('eyebrow', e.target.value)} placeholder="Trending now" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Title — prefix word(s)">
                    <input value={cur.bestsellers?.title_prefix || ''} onChange={e => patchBs('title_prefix', e.target.value)} placeholder="Anti-Aging" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Title — italic highlight">
                    <input value={cur.bestsellers?.title_highlight || ''} onChange={e => patchBs('title_highlight', e.target.value)} placeholder="Bestsellers" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Number of products to show" hint="Max 20">
                    <input type="number" min="1" max="20" value={cur.bestsellers?.limit || 10} onChange={e => patchBs('limit', Math.max(1, Math.min(20, Number(e.target.value))))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Sort order">
                    <select value={cur.bestsellers?.sort_by || 'reviews_count'} onChange={e => patchBs('sort_by', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 'showcase' && (
              <div className="space-y-4" data-testid={`showcase-tab-${activeNiche}`}>
                <Toggle
                  value={cur.show_category_showcase !== false}
                  onChange={v => patchShowcase('show_category_showcase', v)}
                  label={cur.show_category_showcase !== false ? 'Section ENABLED' : 'Section HIDDEN'}
                  testId={`showcase-toggle-${activeNiche}`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Section eyebrow (pill text)" hint="Shown as a small uppercase pill above the headline">
                    <input value={cur.category_showcase_title || ''} onChange={e => patchShowcase('category_showcase_title', e.target.value)} placeholder="Shop by Category" className="w-full px-3 py-2 border rounded-lg text-sm" data-testid={`showcase-title-${activeNiche}`} />
                  </Field>
                  <Field label="Big headline (subtitle)" hint="The italic-highlight word below comes from this">
                    <input value={cur.category_showcase_subtitle || ''} onChange={e => patchShowcase('category_showcase_subtitle', e.target.value)} placeholder="Find what you're looking for" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Highlight word" hint="This word will appear in italic-accent color in the headline">
                    <input value={cur.category_showcase_highlight || ''} onChange={e => patchShowcase('category_showcase_highlight', e.target.value)} placeholder="looking for" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Header decorative image (URL)" hint="Shown to the right of the headline on desktop. Leave empty to hide.">
                    <input
                      value={cur.category_showcase_header_image || ''}
                      onChange={e => patchShowcase('category_showcase_header_image', e.target.value)}
                      placeholder="https://… (paste URL or use upload)"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      data-testid={`showcase-header-image-${activeNiche}`}
                    />
                  </Field>
                  <Field label="Upload header image" hint="JPG/PNG, ≥ 1200px wide ideal">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const fd = new FormData();
                          fd.append('file', f);
                          const r = await axios.post(`${API}/api/admin/upload-image`, fd, {
                            headers: { 'X-Admin-Token': adminToken, 'Content-Type': 'multipart/form-data' },
                          });
                          patchShowcase('category_showcase_header_image', r.data.url);
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Upload failed');
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      data-testid={`showcase-header-upload-${activeNiche}`}
                    />
                  </Field>
                  {cur.category_showcase_header_image && (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-bold tracking-wider uppercase text-stone-500 mb-1.5">Preview</p>
                      <img src={cur.category_showcase_header_image} alt="" className="max-h-44 rounded-xl ring-1 ring-stone-200" />
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-stone-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-stone-800">Highlight Banner (above the grid)</p>
                      <p className="text-[11px] text-stone-500">Optional limited-time gradient banner shown above the category cards.</p>
                    </div>
                    <Toggle
                      value={!!cur.category_showcase_banner?.enabled}
                      onChange={v => patchShowcaseBanner('enabled', v)}
                      label={cur.category_showcase_banner?.enabled ? 'Banner ENABLED' : 'Banner HIDDEN'}
                      testId={`showcase-banner-toggle-${activeNiche}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Eyebrow"><input value={cur.category_showcase_banner?.eyebrow || ''} onChange={e => patchShowcaseBanner('eyebrow', e.target.value)} placeholder="LIMITED DROP" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="Main text"><input value={cur.category_showcase_banner?.text || ''} onChange={e => patchShowcaseBanner('text', e.target.value)} placeholder="Free shipping over ₹999" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="CTA label"><input value={cur.category_showcase_banner?.cta_label || ''} onChange={e => patchShowcaseBanner('cta_label', e.target.value)} placeholder="Shop now" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="CTA link"><input value={cur.category_showcase_banner?.cta_link || ''} onChange={e => patchShowcaseBanner('cta_link', e.target.value)} placeholder="/shop" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="Gradient — from"><input type="color" value={cur.category_showcase_banner?.bg_from || '#0e7490'} onChange={e => patchShowcaseBanner('bg_from', e.target.value)} className="w-full h-10 border rounded-lg" /></Field>
                    <Field label="Gradient — to"><input type="color" value={cur.category_showcase_banner?.bg_to || '#0f172a'} onChange={e => patchShowcaseBanner('bg_to', e.target.value)} className="w-full h-10 border rounded-lg" /></Field>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                  <strong>Tip:</strong> Make each category card pop by uploading a beautiful header image per category in <a href="/admin/concerns" className="underline font-bold">Categories & Concerns</a>. The image + product thumbnails are what make this section feel premium.
                </div>
              </div>
            )}

            {activeTab === 'cta' && (
              <div className="space-y-4">
                <Toggle value={cur.cta_section?.enabled !== false} onChange={v => patchCta('enabled', v)} label={cur.cta_section?.enabled !== false ? 'Section ENABLED' : 'Section HIDDEN'} testId={`cta-toggle-${activeNiche}`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Eyebrow">
                    <input value={cur.cta_section?.eyebrow || ''} onChange={e => patchCta('eyebrow', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Headline">
                    <input value={cur.cta_section?.title || ''} onChange={e => patchCta('title', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                </div>
                <Field label="Subtitle">
                  <textarea rows={2} value={cur.cta_section?.subtitle || ''} onChange={e => patchCta('subtitle', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Button label">
                    <input value={cur.cta_section?.button_label || ''} onChange={e => patchCta('button_label', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                  <Field label="Button link">
                    <input value={cur.cta_section?.button_link || ''} onChange={e => patchCta('button_link', e.target.value)} placeholder="/routine" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="BG gradient — From">
                    <input type="color" value={cur.cta_section?.bg_from || '#047857'} onChange={e => patchCta('bg_from', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                  <Field label="BG gradient — Via">
                    <input type="color" value={cur.cta_section?.bg_via || '#065f46'} onChange={e => patchCta('bg_via', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                  <Field label="BG gradient — To">
                    <input type="color" value={cur.cta_section?.bg_to || '#115e59'} onChange={e => patchCta('bg_to', e.target.value)} className="w-full h-10 border rounded-lg" />
                  </Field>
                </div>
                <div
                  className="rounded-xl px-5 py-6 text-white text-center"
                  style={{ background: `linear-gradient(to right, ${cur.cta_section?.bg_from || '#047857'}, ${cur.cta_section?.bg_via || '#065f46'}, ${cur.cta_section?.bg_to || '#115e59'})` }}
                >
                  <p className="text-[10px] font-black tracking-[0.4em] text-white/70 uppercase mb-1">{cur.cta_section?.eyebrow || 'Eyebrow'}</p>
                  <h3 className="font-heading text-xl font-black mb-1">{cur.cta_section?.title || 'Headline'}</h3>
                  <p className="text-xs text-white/80">{cur.cta_section?.subtitle || 'Subtitle…'}</p>
                </div>
              </div>
            )}

            {activeTab === 'carousel' && (
              <div className="space-y-4" data-testid={`carousel-${activeNiche}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Per-niche banner carousel — appears just under the Trust Strip.</p>
                    <p className="text-[10px] text-gray-400">Anti-Aging falls back to the global carousel if empty. Skincare/Cosmetics show no carousel when empty.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Field label="Autoplay ms (≥1500)">
                      <input type="number" min={1500} value={cur.carousel_autoplay_ms || 2000} onChange={e => setCur({ ...cur, carousel_autoplay_ms: Math.max(1500, Number(e.target.value) || 2000) })} className="w-24 px-2 py-1.5 border rounded-lg text-xs" />
                    </Field>
                    <button
                      onClick={() => {
                        const list = Array.isArray(cur.banner_carousel) ? [...cur.banner_carousel] : [];
                        list.push({ id: `b${Date.now()}`, image: '', cta_link: '/shop', sort_order: list.length + 1 });
                        setCur({ ...cur, banner_carousel: list });
                      }}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 self-end"
                      data-testid={`add-banner-${activeNiche}`}
                    >+ Add Banner</button>
                  </div>
                </div>
                {(cur.banner_carousel || []).length === 0 ? (
                  <div className="bg-stone-50 ring-1 ring-stone-200 rounded-xl p-6 text-center text-xs text-stone-600">No banners yet. Click "Add Banner" to create one.</div>
                ) : (
                  <div className="space-y-3">
                    {[...(cur.banner_carousel || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((b, i) => {
                      const list = cur.banner_carousel || [];
                      const idx = list.findIndex(x => x.id === b.id);
                      const update = (k, v) => {
                        const next = [...list];
                        next[idx] = { ...next[idx], [k]: v };
                        setCur({ ...cur, banner_carousel: next });
                      };
                      const remove = () => setCur({ ...cur, banner_carousel: list.filter(x => x.id !== b.id) });
                      const moveUp = () => {
                        const next = [...list];
                        const cs = next.filter(x => x.id !== b.id);
                        const newSort = (b.sort_order || 1) - 1;
                        cs.forEach(x => { if ((x.sort_order || 0) === newSort) x.sort_order = b.sort_order; });
                        next[idx] = { ...next[idx], sort_order: Math.max(1, newSort) };
                        setCur({ ...cur, banner_carousel: next });
                      };
                      const moveDown = () => {
                        const next = [...list];
                        const cs = next.filter(x => x.id !== b.id);
                        const newSort = (b.sort_order || 1) + 1;
                        cs.forEach(x => { if ((x.sort_order || 0) === newSort) x.sort_order = b.sort_order; });
                        next[idx] = { ...next[idx], sort_order: newSort };
                        setCur({ ...cur, banner_carousel: next });
                      };
                      return (
                        <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3" data-testid={`banner-row-${activeNiche}-${i}`}>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <ImageInput value={b.image} onChange={v => update('image', v)} headers={headers} label={`Banner ${b.sort_order || i + 1} image`} testId={`banner-img-${activeNiche}-${i}`} />
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Title (optional)"><input value={b.title || ''} onChange={e => update('title', e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" /></Field>
                              <Field label="Subtitle (optional)"><input value={b.subtitle || ''} onChange={e => update('subtitle', e.target.value)} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" /></Field>
                              <Field label="CTA Link"><input value={b.cta_link || ''} onChange={e => update('cta_link', e.target.value)} placeholder="/shop" className="w-full px-2.5 py-1.5 border rounded-lg text-xs" /></Field>
                              <Field label="Sort order"><input type="number" value={b.sort_order || 0} onChange={e => update('sort_order', Number(e.target.value))} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" /></Field>
                            </div>
                          </div>
                          <div className="flex sm:flex-col gap-1 justify-center">
                            <button onClick={moveUp} className="p-1.5 hover:bg-gray-100 rounded-lg text-xs" title="Up">↑</button>
                            <button onClick={moveDown} className="p-1.5 hover:bg-gray-100 rounded-lg text-xs" title="Down">↓</button>
                            <button onClick={remove} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg" title="Delete" data-testid={`delete-banner-${activeNiche}-${i}`}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-3" data-testid={`reviews-${activeNiche}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Section title"><input value={cur.reviews_title || ''} onChange={e => setCur({ ...cur, reviews_title: e.target.value })} placeholder="What our community says" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="Eyebrow"><input value={cur.reviews_eyebrow || ''} onChange={e => setCur({ ...cur, reviews_eyebrow: e.target.value })} placeholder="Real customers · Real results" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  </div>
                  <button onClick={() => setCur({ ...cur, reviews: [...(cur.reviews || []), { name: 'Customer', age: '', city: '', rating: 5, days: 30, body: '', verified: true }] })} className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold self-end">+ Add Review</button>
                </div>
                {(cur.reviews || []).length === 0 ? (
                  <div className="bg-stone-50 ring-1 ring-stone-200 rounded-xl p-5 text-center text-xs text-stone-600">No custom reviews — using built-in defaults. Click "+ Add Review" to override.</div>
                ) : (
                  <div className="space-y-2">
                    {(cur.reviews || []).map((r, i) => {
                      const update = (k, v) => {
                        const next = [...(cur.reviews || [])];
                        next[i] = { ...next[i], [k]: v };
                        setCur({ ...cur, reviews: next });
                      };
                      const remove = () => setCur({ ...cur, reviews: (cur.reviews || []).filter((_, x) => x !== i) });
                      return (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2" data-testid={`review-row-${activeNiche}-${i}`}>
                          <input value={r.name} onChange={e => update('name', e.target.value)} placeholder="Name" className="sm:col-span-2 px-2 py-1.5 border rounded-lg text-xs" />
                          <input value={r.age || ''} onChange={e => update('age', e.target.value)} placeholder="Age" className="sm:col-span-1 px-2 py-1.5 border rounded-lg text-xs" />
                          <input value={r.city || ''} onChange={e => update('city', e.target.value)} placeholder="City" className="sm:col-span-2 px-2 py-1.5 border rounded-lg text-xs" />
                          <input type="number" min="1" max="5" value={r.rating || 5} onChange={e => update('rating', Number(e.target.value))} placeholder="★" className="sm:col-span-1 px-2 py-1.5 border rounded-lg text-xs" />
                          <input type="number" value={r.days || 30} onChange={e => update('days', Number(e.target.value))} placeholder="Days" className="sm:col-span-1 px-2 py-1.5 border rounded-lg text-xs" />
                          <input value={r.body} onChange={e => update('body', e.target.value)} placeholder="Review text" className="sm:col-span-4 px-2 py-1.5 border rounded-lg text-xs" />
                          <button onClick={remove} className="sm:col-span-1 bg-red-50 text-red-600 rounded-lg p-1.5"><Trash2 size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="space-y-3" data-testid={`faq-${activeNiche}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Section title"><input value={cur.faq_title || ''} onChange={e => setCur({ ...cur, faq_title: e.target.value })} placeholder="Got questions?" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                    <Field label="Eyebrow"><input value={cur.faq_eyebrow || ''} onChange={e => setCur({ ...cur, faq_eyebrow: e.target.value })} placeholder="Frequently asked" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  </div>
                  <button onClick={() => setCur({ ...cur, faqs: [...(cur.faqs || []), { q: 'New question?', a: 'Answer here…' }] })} className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold self-end">+ Add Q&A</button>
                </div>
                {(cur.faqs || []).length === 0 ? (
                  <div className="bg-stone-50 ring-1 ring-stone-200 rounded-xl p-5 text-center text-xs text-stone-600">No custom FAQs — using built-in defaults. Click "+ Add Q&A" to override.</div>
                ) : (
                  <div className="space-y-2">
                    {(cur.faqs || []).map((f, i) => {
                      const update = (k, v) => {
                        const next = [...(cur.faqs || [])];
                        next[i] = { ...next[i], [k]: v };
                        setCur({ ...cur, faqs: next });
                      };
                      const remove = () => setCur({ ...cur, faqs: (cur.faqs || []).filter((_, x) => x !== i) });
                      return (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2" data-testid={`faq-row-${activeNiche}-${i}`}>
                          <input value={f.q} onChange={e => update('q', e.target.value)} placeholder="Question" className="w-full px-3 py-2 border rounded-lg text-sm font-bold" />
                          <textarea rows={2} value={f.a} onChange={e => update('a', e.target.value)} placeholder="Answer" className="w-full px-3 py-2 border rounded-lg text-sm" />
                          <div className="flex justify-end"><button onClick={remove} className="bg-red-50 text-red-600 rounded-lg px-2 py-1 text-xs flex items-center gap-1"><Trash2 size={12} /> Remove</button></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dermat' && (
              <div className="space-y-4" data-testid={`dermat-${activeNiche}`}>
                <p className="text-xs text-gray-500">Customize the dermatologist credibility section. All fields support leaving blank to use built-in defaults.</p>
                <ImageInput value={cur.dermatologist?.image} onChange={v => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), image: v } })} headers={headers} label="Dermatologist image" testId={`dermat-img-${activeNiche}`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Eyebrow"><input value={cur.dermatologist?.eyebrow || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), eyebrow: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  <Field label="Title — Part 1"><input value={cur.dermatologist?.title_part1 || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), title_part1: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  <Field label="Title — Italic highlight"><input value={cur.dermatologist?.title_highlight || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), title_highlight: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  <Field label="Title — Suffix"><input value={cur.dermatologist?.title_suffix || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), title_suffix: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                </div>
                <Field label="Body paragraph">
                  <textarea rows={3} value={cur.dermatologist?.body || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), body: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CTA label"><input value={cur.dermatologist?.cta_label || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), cta_label: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                  <Field label="CTA link"><input value={cur.dermatologist?.cta_link || ''} onChange={e => setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), cta_link: e.target.value } })} placeholder="/consultation" className="w-full px-3 py-2 border rounded-lg text-sm" /></Field>
                </div>
                <div>
                  <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1.5 block">Stat tiles (3 max)</label>
                  <div className="space-y-2">
                    {([0, 1, 2]).map(i => {
                      const stats = cur.dermatologist?.stats || [];
                      const s = stats[i] || { num: '', label: '' };
                      const update = (k, v) => {
                        const next = [...stats];
                        while (next.length <= i) next.push({ num: '', label: '' });
                        next[i] = { ...next[i], [k]: v };
                        setCur({ ...cur, dermatologist: { ...(cur.dermatologist || {}), stats: next } });
                      };
                      return (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input value={s.num} onChange={e => update('num', e.target.value)} placeholder={`Stat ${i + 1} number (e.g. 4)`} className="px-2 py-1.5 border rounded-lg text-xs" />
                          <input value={s.label} onChange={e => update('label', e.target.value)} placeholder={`Stat ${i + 1} label`} className="sm:col-span-2 px-2 py-1.5 border rounded-lg text-xs" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sections' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Toggle which page sections render on this niche home.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Toggle value={cur.show_complete_kit !== false} onChange={v => setCur({ ...cur, show_complete_kit: v })} label={`Complete Kit card (${cur.show_complete_kit !== false ? 'shown' : 'hidden'})`} testId={`vis-kit-${activeNiche}`} />
                  <Toggle value={cur.show_reviews !== false} onChange={v => setCur({ ...cur, show_reviews: v })} label={`Reviews section (${cur.show_reviews !== false ? 'shown' : 'hidden'})`} testId={`vis-reviews-${activeNiche}`} />
                  <Toggle value={cur.show_dermatologist !== false} onChange={v => setCur({ ...cur, show_dermatologist: v })} label={`Dermatologist section (${cur.show_dermatologist !== false ? 'shown' : 'hidden'})`} testId={`vis-derm-${activeNiche}`} />
                  <Toggle value={cur.show_faq !== false} onChange={v => setCur({ ...cur, show_faq: v })} label={`FAQ section (${cur.show_faq !== false ? 'shown' : 'hidden'})`} testId={`vis-faq-${activeNiche}`} />
                  {(activeNiche === 'skincare' || activeNiche === 'cosmetics') && (
                    <Toggle
                      value={cur.show_category_showcase !== false}
                      onChange={v => setCur({ ...cur, show_category_showcase: v })}
                      label={`Shop-by-Category preview cards (${cur.show_category_showcase !== false ? 'shown' : 'hidden'})`}
                      testId={`vis-category-showcase-${activeNiche}`}
                    />
                  )}
                  {activeNiche === 'skincare' && (
                    <Toggle
                      value={cur.show_hero_actives === true}
                      onChange={v => setCur({ ...cur, show_hero_actives: v })}
                      label={`Hero Actives (Retinol / Vit C) section (${cur.show_hero_actives === true ? 'shown' : 'hidden'})`}
                      testId={`vis-hero-actives-${activeNiche}`}
                    />
                  )}
                  {activeNiche === 'cosmetics' && (
                    <Toggle
                      value={cur.show_trending_looks === true}
                      onChange={v => setCur({ ...cur, show_trending_looks: v })}
                      label={`Inspiration / Trending Looks section (${cur.show_trending_looks === true ? 'shown' : 'hidden'})`}
                      testId={`vis-trending-looks-${activeNiche}`}
                    />
                  )}
                </div>
                {(activeNiche === 'skincare' || activeNiche === 'cosmetics') && (
                  <div className="bg-stone-50 rounded-2xl p-4 ring-1 ring-stone-200" data-testid={`category-showcase-config-${activeNiche}`}>
                    <h3 className="font-black text-sm text-gray-900 mb-2">Shop-by-Category Preview Cards</h3>
                    <p className="text-[11px] text-gray-500 mb-3">Rich category cards (with 4 product previews) shown after the bestsellers grid. They auto-populate from products you've assigned to each category.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Eyebrow (uppercase)">
                        <input
                          value={cur.category_showcase_title || 'Shop by Category'}
                          onChange={e => setCur({ ...cur, category_showcase_title: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          data-testid={`category-showcase-title-${activeNiche}`}
                          placeholder="Shop by Category"
                        />
                      </Field>
                      <Field label="Section heading">
                        <input
                          value={cur.category_showcase_subtitle || "Find what you're looking for"}
                          onChange={e => setCur({ ...cur, category_showcase_subtitle: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          data-testid={`category-showcase-subtitle-${activeNiche}`}
                          placeholder="Find what you're looking for"
                        />
                      </Field>
                      <Field label="Italic accent (must appear in heading)">
                        <input
                          value={cur.category_showcase_highlight || 'looking for'}
                          onChange={e => setCur({ ...cur, category_showcase_highlight: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          data-testid={`category-showcase-highlight-${activeNiche}`}
                          placeholder="looking for"
                        />
                      </Field>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Manage which categories appear (and create new ones) in
                      <button className="text-green-700 underline font-semibold ml-1" onClick={() => navigate('/admin/categories')}>
                        Concerns &amp; Categories
                      </button>.
                    </p>
                  </div>
                )}
                <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                  Reviews / Dermatologist / FAQ are now available on all 3 niches. Customize their content in the dedicated tabs above (Reviews, FAQ, Dermatologist).
                </div>
              </div>
            )}

            {activeTab === 'strip' && (
              <div className="space-y-4">
                {activeNiche === 'skincare' && (
                  <>
                    <Toggle value={cur.show_concern_strip !== false} onChange={v => setCur({ ...cur, show_concern_strip: v })} label={`Circular Concern Strip (${cur.show_concern_strip !== false ? 'shown' : 'hidden'})`} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Strip title (last word becomes italic accent)">
                        <input value={cur.concern_strip_title || 'Shop by Concern'} onChange={e => setCur({ ...cur, concern_strip_title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </Field>
                      <Field label="Strip subtitle">
                        <input value={cur.concern_strip_subtitle || 'Pick your skin problem'} onChange={e => setCur({ ...cur, concern_strip_subtitle: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </Field>
                    </div>
                    <p className="text-xs text-gray-500">Concerns are managed in <button className="text-green-700 underline font-semibold" onClick={() => navigate('/admin/concerns')}>Concerns &amp; Categories</button>.</p>
                  </>
                )}
                {activeNiche === 'cosmetics' && (
                  <>
                    <Toggle value={cur.show_category_strip !== false} onChange={v => setCur({ ...cur, show_category_strip: v })} label={`Circular Category Strip (${cur.show_category_strip !== false ? 'shown' : 'hidden'})`} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Strip title">
                        <input value={cur.category_strip_title || 'Shop by Category'} onChange={e => setCur({ ...cur, category_strip_title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </Field>
                      <Field label="Strip subtitle">
                        <input value={cur.category_strip_subtitle || 'Lip · Eye · Brow · Face'} onChange={e => setCur({ ...cur, category_strip_subtitle: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </Field>
                    </div>
                    <p className="text-xs text-gray-500">Categories are managed in <button className="text-green-700 underline font-semibold" onClick={() => navigate('/admin/concerns')}>Concerns &amp; Categories</button>.</p>
                  </>
                )}
                {activeNiche === 'anti-aging' && (
                  <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-700">
                    The Anti-Aging home doesn't use a circular strip by default — it features the Complete Kit + Bestsellers grid. Use the <strong>Sections / Visibility</strong> tab to toggle the Complete Kit card.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky save bar (mobile-friendly) */}
        <div className="sticky bottom-3 mt-4 bg-white/95 backdrop-blur ring-1 ring-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
          <p className="text-xs text-gray-500">Editing <span className="font-bold text-gray-900">{niche.label}</span> — unsaved changes won't appear on the site.</p>
          <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
