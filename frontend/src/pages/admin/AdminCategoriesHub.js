import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Save, Image as ImageIcon, Sparkles, Layers, Plus, Trash2, Eye, ToggleLeft, ToggleRight, Loader2, Upload,
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

/* Same defaults used by /categories page — mirror exactly so admins see the same shape. */
const HUB_DEFAULTS = {
  hero: {
    eyebrow: 'EXPLORE THE COLLECTION',
    title_line1: 'Shop by',
    title_line2: 'Category.',
    subtitle: "From clinical anti-aging to luxe cosmetics — find what you're looking for in seconds.",
    image_desktop: '',
    image_mobile: '',
    accent: '#0f766e',
    search_placeholder: 'Search categories, concerns, products…',
  },
  niche_cards: {
    anti_aging: { enabled: true, eyebrow: 'Youthful Radiance', title: 'Anti-Aging', subtitle: 'Clinical retinol, peptides & vitamin-C built for Indian skin.', image: '', cta_label: 'Discover', cta_link: '/', accent: '#0f766e', bg_from: '#ecfdf5', bg_to: '#a7f3d0' },
    skincare:   { enabled: true, eyebrow: 'Healthy Glowing Skin', title: 'Skincare', subtitle: 'Acne, pigmentation, dryness, dullness — pick your concern, get the routine.', image: '', cta_label: 'Pick your concern', cta_link: '/skincare', accent: '#0e7490', bg_from: '#ecfeff', bg_to: '#a5f3fc' },
    cosmetics:  { enabled: true, eyebrow: 'Enhance Your Beauty', title: 'Cosmetics', subtitle: 'Long-wear lip, satin foundation, hydrating blush — colour that loves your skin.', image: '', cta_label: 'Shop the shades', cta_link: '/cosmetics', accent: '#be185d', bg_from: '#fdf2f8', bg_to: '#fbcfe8' },
  },
  ribbon: { enabled: true, text: 'New customer? Flat ₹50 OFF with code', code: 'WELCOME50', cta_label: 'Shop now', cta_link: '/shop', bg_from: '#0f766e', bg_to: '#115e59' },
  ingredient_strip: {
    enabled: true,
    title: 'Powered by clinical ingredients',
    subtitle: 'Hand-picked for Indian skin tones and the Indian climate.',
    items: [
      { name: 'Retinol', hex: '#fef3c7', img: '' },
      { name: 'Vitamin C', hex: '#fef9c3', img: '' },
      { name: 'Niacinamide', hex: '#fce7f3', img: '' },
      { name: 'Hyaluronic', hex: '#cffafe', img: '' },
    ],
  },
  editors_picks: { enabled: true, eyebrow: "EDITOR'S PICKS", title: "This month's most-loved", slugs: [] },
};

/* Lightweight image uploader — uploads to /api/admin/upload-image, returns URL */
function ImageInput({ value, onChange, headers, label = 'Image', testId }) {
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
    } finally { setBusy(false); }
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
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full"
            data-testid={testId}
          />
          <label className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {busy ? 'Uploading…' : 'Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
          </label>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, onChange, placeholder, testId, multiline }) => (
  <div>
    <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1.5 block">{label}</label>
    {multiline ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y"
        data-testid={testId}
      />
    ) : (
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        data-testid={testId}
      />
    )}
  </div>
);

const ColorPicker = ({ label, value, onChange, testId }) => (
  <div>
    <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1.5 block">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="w-10 h-10 border rounded-lg cursor-pointer" data-testid={`${testId}-color`} />
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" data-testid={testId} />
    </div>
  </div>
);

const Toggle = ({ enabled, onChange, label, testId }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}
    data-testid={testId}
  >
    {enabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
    {label || (enabled ? 'Enabled' : 'Disabled')}
  </button>
);

const SectionCard = ({ title, eyebrow, children, action }) => (
  <section className="bg-white ring-1 ring-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        {eyebrow && <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-700 mb-0.5">{eyebrow}</p>}
        <h3 className="font-heading text-lg sm:text-xl font-black text-stone-900 tracking-tight">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </section>
);

export default function AdminCategoriesHub() {
  const navigate = useNavigate();
  const adminToken = getAdminToken();
  const headers = { 'X-Admin-Token': adminToken };

  const [draft, setDraft] = useState(HUB_DEFAULTS);
  const [houseOnly, setHouseOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!adminToken) navigate('/admin'); }, [adminToken, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/site-settings`);
      const existing = r.data?.categories_hub || {};
      setHouseOnly(!!r.data?.house_categories_only);
      // Deep merge with defaults so admins see every field
      setDraft({
        hero: { ...HUB_DEFAULTS.hero, ...(existing.hero || {}) },
        niche_cards: {
          anti_aging: { ...HUB_DEFAULTS.niche_cards.anti_aging, ...((existing.niche_cards || {}).anti_aging || {}) },
          skincare:   { ...HUB_DEFAULTS.niche_cards.skincare,   ...((existing.niche_cards || {}).skincare   || {}) },
          cosmetics:  { ...HUB_DEFAULTS.niche_cards.cosmetics,  ...((existing.niche_cards || {}).cosmetics  || {}) },
        },
        ribbon: { ...HUB_DEFAULTS.ribbon, ...(existing.ribbon || {}) },
        ingredient_strip: {
          ...HUB_DEFAULTS.ingredient_strip,
          ...(existing.ingredient_strip || {}),
          items: existing.ingredient_strip?.items || HUB_DEFAULTS.ingredient_strip.items,
        },
        editors_picks: { ...HUB_DEFAULTS.editors_picks, ...(existing.editors_picks || {}) },
      });
    } catch (e) {
      console.error('Failed to load hub settings', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await axios.put(`${API}/api/admin/site-settings`, { categories_hub: draft, house_categories_only: houseOnly }, { headers });
      setSaved(true);
      // Invalidate cached site-settings so /categories picks up changes immediately
      try { if (window.localStorage) window.localStorage.removeItem('apiCache:/api/site-settings'); } catch { /* noop */ }
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  // Patchers
  const patchHero = (k, v) => setDraft(d => ({ ...d, hero: { ...d.hero, [k]: v } }));
  const patchCard = (which, k, v) => setDraft(d => ({ ...d, niche_cards: { ...d.niche_cards, [which]: { ...d.niche_cards[which], [k]: v } } }));
  const patchRibbon = (k, v) => setDraft(d => ({ ...d, ribbon: { ...d.ribbon, [k]: v } }));
  const patchIngStrip = (k, v) => setDraft(d => ({ ...d, ingredient_strip: { ...d.ingredient_strip, [k]: v } }));
  const patchIngItem = (idx, k, v) => setDraft(d => ({
    ...d,
    ingredient_strip: {
      ...d.ingredient_strip,
      items: d.ingredient_strip.items.map((it, i) => i === idx ? { ...it, [k]: v } : it),
    },
  }));
  const addIngItem = () => setDraft(d => ({
    ...d,
    ingredient_strip: { ...d.ingredient_strip, items: [...d.ingredient_strip.items, { name: '', hex: '#fef3c7', img: '' }] },
  }));
  const removeIngItem = (idx) => setDraft(d => ({
    ...d,
    ingredient_strip: { ...d.ingredient_strip, items: d.ingredient_strip.items.filter((_, i) => i !== idx) },
  }));
  const patchPicks = (k, v) => setDraft(d => ({ ...d, editors_picks: { ...d.editors_picks, [k]: v } }));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={28} className="animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24" data-testid="admin-categories-hub">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="p-2 hover:bg-stone-100 rounded-lg" aria-label="Back" data-testid="hub-back">
              <ArrowLeft size={18} className="text-stone-600" />
            </button>
            <div>
              <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-700">PREMIUM HUB</p>
              <h1 className="font-heading text-lg sm:text-2xl font-black text-stone-900 tracking-tight">Shop by Category — Hub Editor</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/categories" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold" data-testid="hub-preview">
              <Eye size={13} /> Live preview
            </a>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-black tracking-wider uppercase shadow-md"
              data-testid="hub-save"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 space-y-6">

        {/* House-only categories toggle (Feb-2026) */}
        <SectionCard
          eyebrow="MODE"
          title="Show only Celesta Glow products?"
          action={
            <Toggle
              enabled={houseOnly}
              onChange={setHouseOnly}
              label={houseOnly ? 'House-only' : 'Multi-brand'}
              testId="hub-house-only-toggle"
            />
          }
        >
          <p className="text-sm text-stone-600">
            When ON, <b>/categories</b> hides the three multi-brand niche cards / ribbon and
            shows ONLY Celesta Glow-branded products grouped by their category
            (Serums, Sunscreens, Toners, etc.). Turn OFF to restore the full multi-brand hub.
          </p>
        </SectionCard>

        {/* HERO */}
        <SectionCard
          eyebrow="HERO BANNER"
          title="Big hero at the top of /categories"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Eyebrow" value={draft.hero.eyebrow} onChange={v => patchHero('eyebrow', v)} placeholder="EXPLORE THE COLLECTION" testId="hub-hero-eyebrow" />
            <Field label="Search placeholder" value={draft.hero.search_placeholder} onChange={v => patchHero('search_placeholder', v)} placeholder="Search categories…" testId="hub-hero-placeholder" />
            <Field label="Title — line 1" value={draft.hero.title_line1} onChange={v => patchHero('title_line1', v)} placeholder="Shop by" testId="hub-hero-title1" />
            <Field label="Title — line 2 (highlighted)" value={draft.hero.title_line2} onChange={v => patchHero('title_line2', v)} placeholder="Category." testId="hub-hero-title2" />
            <div className="md:col-span-2"><Field label="Subtitle" value={draft.hero.subtitle} onChange={v => patchHero('subtitle', v)} multiline /></div>
            <ImageInput value={draft.hero.image_desktop} onChange={v => patchHero('image_desktop', v)} headers={headers} label="Background image (desktop)" testId="hub-hero-img-desktop" />
            <ImageInput value={draft.hero.image_mobile} onChange={v => patchHero('image_mobile', v)} headers={headers} label="Background image (mobile, optional)" testId="hub-hero-img-mobile" />
            <ColorPicker label="Accent colour" value={draft.hero.accent} onChange={v => patchHero('accent', v)} testId="hub-hero-accent" />
          </div>
        </SectionCard>

        {/* NICHE CARDS */}
        {[
          { key: 'anti_aging', emoji: '✨', niceName: 'Anti-Aging' },
          { key: 'skincare', emoji: '💧', niceName: 'Skincare' },
          { key: 'cosmetics', emoji: '💄', niceName: 'Cosmetics' },
        ].map(({ key, emoji, niceName }) => {
          const c = draft.niche_cards[key];
          return (
            <SectionCard
              key={key}
              eyebrow={`NICHE CARD · ${niceName.toUpperCase()}`}
              title={`${emoji}  Big editorial card — ${niceName}`}
              action={<Toggle enabled={c.enabled} onChange={v => patchCard(key, 'enabled', v)} label={c.enabled ? 'Visible' : 'Hidden'} testId={`hub-card-toggle-${key}`} />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Eyebrow" value={c.eyebrow} onChange={v => patchCard(key, 'eyebrow', v)} testId={`hub-card-${key}-eyebrow`} />
                <Field label="Title" value={c.title} onChange={v => patchCard(key, 'title', v)} testId={`hub-card-${key}-title`} />
                <div className="md:col-span-2"><Field label="Subtitle" value={c.subtitle} onChange={v => patchCard(key, 'subtitle', v)} multiline /></div>
                <ImageInput value={c.image} onChange={v => patchCard(key, 'image', v)} headers={headers} label="Hero image" testId={`hub-card-${key}-img`} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CTA label" value={c.cta_label} onChange={v => patchCard(key, 'cta_label', v)} placeholder="Discover" testId={`hub-card-${key}-cta`} />
                  <Field label="CTA link" value={c.cta_link} onChange={v => patchCard(key, 'cta_link', v)} placeholder="/skincare" testId={`hub-card-${key}-link`} />
                </div>
                <ColorPicker label="Accent" value={c.accent} onChange={v => patchCard(key, 'accent', v)} testId={`hub-card-${key}-accent`} />
                <div className="grid grid-cols-2 gap-3">
                  <ColorPicker label="BG from" value={c.bg_from} onChange={v => patchCard(key, 'bg_from', v)} />
                  <ColorPicker label="BG to" value={c.bg_to} onChange={v => patchCard(key, 'bg_to', v)} />
                </div>
              </div>
            </SectionCard>
          );
        })}

        {/* PROMO RIBBON */}
        <SectionCard
          eyebrow="PROMO RIBBON"
          title="🎉  Limited-time gradient banner between sections"
          action={<Toggle enabled={draft.ribbon.enabled} onChange={v => patchRibbon('enabled', v)} testId="hub-ribbon-toggle" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Field label="Main text" value={draft.ribbon.text} onChange={v => patchRibbon('text', v)} placeholder="New customer? Flat ₹50 OFF with code" /></div>
            <Field label="Coupon code (optional)" value={draft.ribbon.code} onChange={v => patchRibbon('code', v)} placeholder="WELCOME50" />
            <Field label="CTA label" value={draft.ribbon.cta_label} onChange={v => patchRibbon('cta_label', v)} placeholder="Shop now" />
            <Field label="CTA link" value={draft.ribbon.cta_link} onChange={v => patchRibbon('cta_link', v)} placeholder="/shop" />
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker label="Gradient from" value={draft.ribbon.bg_from} onChange={v => patchRibbon('bg_from', v)} />
              <ColorPicker label="Gradient to" value={draft.ribbon.bg_to} onChange={v => patchRibbon('bg_to', v)} />
            </div>
          </div>
        </SectionCard>

        {/* EDITOR'S PICKS */}
        <SectionCard
          eyebrow="EDITOR'S PICKS"
          title="🔥  Horizontal product strip"
          action={<Toggle enabled={draft.editors_picks.enabled} onChange={v => patchPicks('enabled', v)} testId="hub-picks-toggle" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Eyebrow" value={draft.editors_picks.eyebrow} onChange={v => patchPicks('eyebrow', v)} />
            <Field label="Title" value={draft.editors_picks.title} onChange={v => patchPicks('title', v)} />
            <div className="md:col-span-2">
              <Field
                label="Product slugs (comma-separated) — leave empty to auto-pick top rated"
                value={(draft.editors_picks.slugs || []).join(', ')}
                onChange={v => patchPicks('slugs', v.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="anti-aging-serum, sunscreen, under-eye-cream"
                testId="hub-picks-slugs"
              />
            </div>
          </div>
        </SectionCard>

        {/* INGREDIENT STRIP */}
        <SectionCard
          eyebrow="INGREDIENT STRIP"
          title="🧪  Hero ingredient bubbles"
          action={
            <div className="flex items-center gap-2">
              <Toggle enabled={draft.ingredient_strip.enabled} onChange={v => patchIngStrip('enabled', v)} testId="hub-ing-toggle" />
              <button onClick={addIngItem} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md" data-testid="hub-ing-add">
                <Plus size={12} /> Add
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Title" value={draft.ingredient_strip.title} onChange={v => patchIngStrip('title', v)} />
            <Field label="Subtitle" value={draft.ingredient_strip.subtitle} onChange={v => patchIngStrip('subtitle', v)} />
          </div>
          <div className="space-y-3">
            {(draft.ingredient_strip.items || []).map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-stone-50 rounded-xl p-3 ring-1 ring-stone-200" data-testid={`hub-ing-row-${idx}`}>
                <div className="sm:col-span-4">
                  <Field label={`Ingredient #${idx + 1}`} value={it.name} onChange={v => patchIngItem(idx, 'name', v)} placeholder="Retinol" />
                </div>
                <div className="sm:col-span-3">
                  <ColorPicker label="BG colour" value={it.hex} onChange={v => patchIngItem(idx, 'hex', v)} />
                </div>
                <div className="sm:col-span-4">
                  <ImageInput value={it.img} onChange={v => patchIngItem(idx, 'img', v)} headers={headers} label="Icon image (optional)" />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button onClick={() => removeIngItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-md" title="Remove" data-testid={`hub-ing-remove-${idx}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {draft.ingredient_strip.items?.length === 0 && (
              <p className="text-xs text-stone-400 italic">No ingredients yet — click "Add".</p>
            )}
          </div>
        </SectionCard>

        {/* Save banner at bottom too */}
        <div className="sticky bottom-3 z-20 flex justify-center pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white rounded-full text-xs font-black tracking-wider uppercase shadow-2xl"
            data-testid="hub-save-bottom"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
