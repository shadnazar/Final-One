import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Plus, Trash2, Save, Edit, Sparkles, Package, Image as ImageIcon, Layers, Search, LayoutGrid } from 'lucide-react';
import { getAdminToken, clearAdminToken } from '../../utils/adminAuth';
import QuickImageEditor from '../../components/admin/QuickImageEditor';
import BannerImageDropzone from '../../components/admin/BannerImageDropzone';
import TilesPanel from './TilesPanel';

const API = process.env.REACT_APP_BACKEND_URL;

const EMPTY_CONCERN = {
  slug: '', name: '', tagline: '', icon: '✨', image: '',
  accent_from: '#dcfce7', accent_to: '#bbf7d0', accent_text: '#14532d',
  description: '', sort_order: 99, is_active: true, niche: 'skincare',
};
const EMPTY_CATEGORY = {
  slug: '', name: '', tagline: '', icon: '🧴', image: '',
  sort_order: 99, is_active: true, group: 'skincare', niche: 'skincare',
};
const EMPTY_SUBCATEGORY = {
  slug: '', name: '', parent_category: '', niche: 'skincare',
  tagline: '', icon: '✨', image: '',
  accent_from: '#dcfce7', accent_to: '#bbf7d0', accent_text: '#14532d',
  sort_order: 99, is_active: true,
};

export default function AdminConcerns() {
  const navigate = useNavigate();
  // Default tab: when the user lands on /admin/categories, jump straight to
  // the categories list rather than the concerns one.
  const initialTab = (typeof window !== 'undefined' && window.location.pathname.includes('/admin/categories'))
    ? 'skincare'
    : 'concerns';
  const [tab, setTab] = useState(initialTab);
  const [concerns, setConcerns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState(''); // parent slug filter
  const [editing, setEditing] = useState(null); // {type, data}
  const [loading, setLoading] = useState(true);
  // GLOBAL SEARCH — finds any entity (concern / category / subcategory) across
  // ALL tabs at once. Resolves the "Sunscreen card is missing" confusion: users
  // search "sunscreen" → find it in Skincare Categories without needing to know
  // which tab it lives in. Empty search → falls back to per-tab listing.
  const [globalSearch, setGlobalSearch] = useState('');
  const allEntities = useMemo(() => {
    const tag = (arr, type, label, badgeClass) => (arr || []).map(x => ({ ...x, _type: type, _typeLabel: label, _badgeClass: badgeClass }));
    return [
      ...tag(concerns.filter(c => (c.niche || 'skincare') !== 'cosmetics'), 'concern', 'Skincare Concern', 'bg-pink-100 text-pink-800'),
      ...tag(concerns.filter(c => c.niche === 'cosmetics'), 'concern', 'Cosmetic Concern', 'bg-rose-100 text-rose-800'),
      ...tag(categories.filter(c => (c.niche || c.group) === 'skincare'), 'category', 'Skincare Category', 'bg-green-100 text-green-800'),
      ...tag(categories.filter(c => (c.niche || c.group) === 'cosmetics'), 'category', 'Cosmetics Category', 'bg-rose-100 text-rose-800'),
      ...tag(subcategories, 'subcategory', 'Subcategory', 'bg-amber-100 text-amber-800'),
    ];
  }, [concerns, categories, subcategories]);
  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return allEntities.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.slug || '').toLowerCase().includes(q) ||
      (e.tagline || '').toLowerCase().includes(q)
    ).slice(0, 60);
  }, [globalSearch, allEntities]);

  const token = getAdminToken();
  const auth = { headers: { 'X-Admin-Token': token } };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, sc] = await Promise.all([
        axios.get(`${API}/api/admin/concerns`, auth),
        axios.get(`${API}/api/admin/categories`, auth),
        axios.get(`${API}/api/admin/subcategories`, auth),
      ]);
      setConcerns(a.data || []);
      setCategories(b.data || []);
      setSubcategories(sc.data || []);
    } catch (e) {
      if (e?.response?.status === 401) { clearAdminToken(); navigate('/admin'); }
    }
    setLoading(false);
  }, [navigate]); // eslint-disable-line

  useEffect(() => {
    if (!token) { navigate('/admin'); return; }
    load();
  }, [load, navigate, token]);

  const save = async () => {
    if (!editing) return;
    const { type, data, isNew } = editing;
    // Auto-derive slug from name if admin left it blank — prevents the "empty
    // slug" zombie row that breaks the API URL on update/delete.
    let payload = { ...data };
    if (!payload.slug || !payload.slug.trim()) {
      const auto = (payload.name || '').toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!auto) {
        alert('Please enter a Name first — slug will be derived from it automatically.');
        return;
      }
      payload.slug = type === 'subcategory' && payload.parent_category
        ? `${payload.parent_category}-${auto}`
        : auto;
    }
    try {
      if (type === 'concern') {
        if (isNew) await axios.post(`${API}/api/admin/concerns`, payload, auth);
        else await axios.put(`${API}/api/admin/concerns/${payload.slug}`, payload, auth);
      } else if (type === 'subcategory') {
        if (!payload.parent_category) {
          alert('Pick a parent category. A subcategory must live inside an existing category.');
          return;
        }
        if (isNew) await axios.post(`${API}/api/admin/subcategories`, payload, auth);
        else await axios.put(`${API}/api/admin/subcategories/${payload.slug}`, payload, auth);
      } else {
        if (isNew) await axios.post(`${API}/api/admin/categories`, payload, auth);
        else await axios.put(`${API}/api/admin/categories/${payload.slug}`, payload, auth);
      }
      setEditing(null);
      await load();
      // Tell every page (Home, Skincare, Cosmetics, hub tiles) to drop their cached
      // /api/categories + /api/subcategories responses so the new image/name/tile
      // shows up immediately without a hard refresh.
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save');
    }
  };

  const remove = async (type, slug) => {
    if (!window.confirm(`Delete ${type} "${slug}"?`)) return;
    try {
      const url = type === 'concern' ? 'concerns'
        : type === 'subcategory' ? 'subcategories'
        : 'categories';
      await axios.delete(`${API}/api/admin/${url}/${slug}`, auth);
      await load();
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
    } catch (e) {
      alert('Failed to delete');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2 text-gray-700 hover:text-green-700" data-testid="back-to-admin">
            <ArrowLeft size={18} /> <span className="font-semibold text-sm">Dashboard</span>
          </Link>
          <h1 className="font-heading text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-pink-600" /> Concerns &amp; Categories
          </h1>
          <button
            onClick={() => {
              if (tab === 'concerns' || tab === 'cosmetic-concerns') {
                const isCosmeticConcern = tab === 'cosmetic-concerns';
                setEditing({
                  type: 'concern',
                  data: {
                    ...EMPTY_CONCERN,
                    niche: isCosmeticConcern ? 'cosmetics' : 'skincare',
                  },
                  isNew: true,
                });
              } else if (tab === 'subcategories') {
                // Default subcategory niche to whatever the active filter is
                // (or fall back to skincare). Parent category is left empty
                // so the admin must explicitly pick one.
                const presetParent = subcategoryFilter || '';
                const presetNiche = (categories.find(c => c.slug === presetParent)?.niche
                  || categories.find(c => c.slug === presetParent)?.group
                  || 'skincare');
                setEditing({
                  type: 'subcategory',
                  data: {
                    ...EMPTY_SUBCATEGORY,
                    parent_category: presetParent,
                    niche: presetNiche,
                  },
                  isNew: true,
                });
              } else {
                // Pre-fill group + niche so the new category lands on the right tab
                const isCosmetics = tab === 'cosmetics';
                setEditing({
                  type: 'category',
                  data: {
                    ...EMPTY_CATEGORY,
                    group: isCosmetics ? 'cosmetics' : 'skincare',
                    niche: isCosmetics ? 'cosmetics' : 'skincare',
                  },
                  isNew: true,
                });
              }
            }}
            className={`bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 ${tab === 'shop-tiles' ? 'hidden' : ''}`}
            data-testid="add-new-btn"
          >
            <Plus size={14} /> Add {tab === 'concerns' ? 'skincare concern' : tab === 'cosmetic-concerns' ? 'cosmetic concern' : tab === 'subcategories' ? 'subcategory' : tab === 'cosmetics' ? 'cosmetic product type' : 'skincare product type'}
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {[
            { id: 'concerns', label: `Skincare Concerns (${concerns.filter(c => (c.niche || 'skincare') === 'skincare' || (c.niche || 'skincare') === 'anti-aging').length})`, icon: Sparkles },
            { id: 'cosmetic-concerns', label: `💄 Cosmetic Concerns (${concerns.filter(c => c.niche === 'cosmetics').length})`, icon: Sparkles },
            { id: 'skincare', label: `🧴 Skincare Product Types (${categories.filter(c => (c.niche || c.group) === 'skincare').length})`, icon: Package },
            { id: 'cosmetics', label: `💄 Cosmetics Product Types (${categories.filter(c => (c.niche || c.group) === 'cosmetics').length})`, icon: Package },
            { id: 'subcategories', label: `Subcategories (${subcategories.length})`, icon: Layers },
            { id: 'shop-tiles', label: 'Shop by Category tiles', icon: LayoutGrid },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-colors ${tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                data-testid={`tab-${t.id}`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* GLOBAL SEARCH — finds any record across all 5 tabs.
            Critical UX fix: admins kept missing entities like "Sunscreens" because
            it lives in Skincare Categories tab, not Subcategories. Now you just
            type the slug and the right card surfaces with its upload dropzone. */}
        <div className="mb-5 bg-white ring-2 ring-purple-300 rounded-2xl p-3 flex flex-wrap items-center gap-3" data-testid="admin-global-search">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Search size={16} className="text-purple-500" />
            <input
              type="search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="🔎 Search ANY image card across all tabs — try 'sunscreens', 'chemical exfoliant', 'lipstick'…"
              className="flex-1 text-sm bg-transparent outline-none font-medium placeholder:font-normal placeholder:text-stone-400"
              data-testid="admin-global-search-input"
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')} className="text-stone-400 hover:text-stone-700 text-xs font-bold" data-testid="admin-global-search-clear">CLEAR</button>
            )}
          </div>
          <span className="text-[11px] text-stone-500 font-semibold">
            {globalSearch ? `${globalResults.length} match${globalResults.length === 1 ? '' : 'es'}` : 'or pick a tab below ↓'}
          </span>
        </div>

        {/* GLOBAL SEARCH RESULTS — replaces the tab content while searching */}
        {globalSearch && (
          <div className="mb-6" data-testid="admin-global-search-results">
            {globalResults.length === 0 ? (
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-6 text-center">
                <p className="text-sm font-black text-amber-900">No matches for "{globalSearch}"</p>
                <p className="text-[11px] text-amber-800 mt-1">
                  This slug doesn't exist as a concern, category, or subcategory. Use the green "Add…" button in the right tab to create it,
                  or check spelling.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {globalResults.map(r => (
                  <div key={`${r._type}-${r.slug}`} className="bg-white ring-1 ring-stone-200 rounded-2xl overflow-hidden hover:ring-purple-300 transition-all" data-testid={`global-result-${r._type}-${r.slug}`}>
                    <BannerImageDropzone
                      currentImage={r.image}
                      resourceType={r._type}
                      slug={r.slug}
                      token={token}
                      onUpdated={() => load()}
                      gradient={r._type === 'concern' ? `linear-gradient(135deg, ${r.accent_from || '#fce7f3'} 0%, ${r.accent_to || '#fbcfe8'} 100%)` : 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)'}
                      alt={r.name}
                      className="aspect-[16/9]"
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r._badgeClass}`}>{r._typeLabel}</span>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{r.is_active ? 'Active' : 'Off'}</span>
                      </div>
                    </BannerImageDropzone>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        {r.icon && <span className="text-lg">{r.icon}</span>}
                        <h3 className="font-black text-gray-900 text-sm truncate">{r.name}</h3>
                      </div>
                      {r.parent_category && (
                        <p className="text-[11px] text-amber-700 font-bold mb-1">↳ inside {r.parent_category}</p>
                      )}
                      <p className="text-[11px] text-gray-500 font-mono truncate">/{r.slug}</p>
                      <button
                        onClick={() => setEditing({ type: r._type, data: { ...r }, isNew: false })}
                        className="mt-2 text-[11px] font-bold text-blue-600 hover:underline"
                        data-testid={`global-result-edit-${r._type}-${r.slug}`}
                      >
                        Open full edit ↗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick-image-edit explainer + sale-badge shortcut */}
        {!globalSearch && (
        <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="admin-concerns-helper">
          <div className="bg-purple-50 ring-1 ring-purple-200 rounded-2xl px-4 py-3">
            <p className="text-xs font-black text-purple-900 mb-0.5">📷 Replace banner images in one click</p>
            <p className="text-[11px] text-purple-800 leading-snug">
              Click the <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white ring-1 ring-purple-200 mx-0.5"><ImageIcon size={11} className="text-purple-600" /></span> /
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white ring-1 ring-purple-200 mx-0.5">⬆</span>
              icon on any card to upload a new banner — no need to open the full edit form.
            </p>
          </div>
          <Link to="/admin/niches" className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl px-4 py-3 text-white hover:opacity-95 transition flex items-start gap-2" data-testid="link-sale-badge-editor">
            <Sparkles size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black">🔥 Edit Sale Badge banners</p>
              <p className="text-[11px] opacity-90 leading-snug">
                Per-niche rotating offer ribbon shown on top of every page. Tap to open the editor under <strong>Niches → Sale Badge</strong> tab.
              </p>
            </div>
          </Link>
        </div>
        )}
        {!globalSearch && (tab === 'concerns' || tab === 'cosmetic-concerns') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {concerns
              .filter(c => {
                const cn = c.niche || 'skincare';
                if (tab === 'cosmetic-concerns') return cn === 'cosmetics';
                return cn === 'skincare' || cn === 'anti-aging';
              })
              .map(c => (
              <div key={c.slug} className="bg-white ring-1 ring-gray-200 rounded-2xl overflow-hidden hover:ring-pink-300 transition-all" data-testid={`concern-card-${c.slug}`}>
                <BannerImageDropzone
                  currentImage={c.image}
                  resourceType="concern"
                  slug={c.slug}
                  token={token}
                  onUpdated={() => load()}
                  gradient={`linear-gradient(135deg, ${c.accent_from || '#dcfce7'} 0%, ${c.accent_to || '#bbf7d0'} 100%)`}
                  alt={c.name}
                  className="aspect-[16/9]"
                >
                  {c.image && <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur w-8 h-8 rounded-full flex items-center justify-center text-base z-10">{c.icon}</div>
                  {c.image && (
                    <div className="absolute bottom-2 left-3 right-16 z-10">
                      <h3 className="text-white font-black text-base leading-tight">{c.name}</h3>
                      <p className="text-[11px] text-white/80 line-clamp-1">{c.tagline}</p>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{c.is_active ? 'Active' : 'Off'}</span>
                  </div>
                </BannerImageDropzone>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-mono truncate">/{c.slug}</span>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => setEditing({ type: 'concern', data: { ...c }, isNew: false })} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" data-testid={`edit-concern-${c.slug}`}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => remove('concern', c.slug)} className="text-red-600 hover:bg-red-50 p-1.5 rounded" data-testid={`delete-concern-${c.slug}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {concerns.filter(c => {
              const cn = c.niche || 'skincare';
              if (tab === 'cosmetic-concerns') return cn === 'cosmetics';
              return cn === 'skincare' || cn === 'anti-aging';
            }).length === 0 && (
              <div className="col-span-full bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-6 text-center text-sm text-amber-800" data-testid="concerns-empty">
                {tab === 'cosmetic-concerns'
                  ? 'No cosmetic concerns yet. Click "Add cosmetic concern" to create one (e.g. Full Coverage, Bridal Glam, Long-Wear).'
                  : 'No skincare concerns yet. Click "Add skincare concern" to create one (e.g. Pigmentation, Dryness, Acne).'}
              </div>
            )}
          </div>
        )}

        {!globalSearch && (tab === 'skincare' || tab === 'cosmetics') && (() => {
          // CANONICAL PRODUCT-TYPE GROUPING — mirrors the user-app structure used on
          // /skincare and /cosmetics hubs so the admin is laid out the same way
          // customers experience it. Each group is a routine step / cosmetics
          // family; any product type not in the canonical list lands in "Other"
          // so nothing is hidden from the admin.
          const SKINCARE_GROUPS = [
            { id: 'cleanse-prep', label: '🧼 Cleanse & Prep', desc: 'Step 1 — Wash, exfoliate, tone', slugs: ['cleansers','exfoliators','toners-mists'] },
            { id: 'treat',        label: '💧 Treat',          desc: 'Step 2 — Active ingredients',     slugs: ['serums-treatments','essences-ampoules','spot-treatments'] },
            { id: 'moisturize',   label: '🧴 Moisturize',     desc: 'Step 3 — Hydrate and seal',       slugs: ['moisturizers','face-oils','barrier-care'] },
            { id: 'protect',      label: '☀️ Protect',        desc: 'Step 4 — Sun + environment',      slugs: ['sunscreens'] },
            { id: 'target',       label: '🎯 Targeted Care',  desc: 'Eye, lip, brightening, anti-aging', slugs: ['eye-care','lip-care','brightening-products','anti-aging-products'] },
            { id: 'mask-body',    label: '🪞 Masks & Body',   desc: 'Once-a-week + body skincare',     slugs: ['masks-packs','body-skincare'] },
          ];
          const COSMETICS_GROUPS = [
            { id: 'face',  label: '🧑‍🎤 Face',         desc: 'Base + complexion',          slugs: ['face-makeup'] },
            { id: 'lips',  label: '👄 Lips',           desc: 'Lipstick, gloss, liner, balm', slugs: ['lips'] },
            { id: 'eyes',  label: '👁️ Eyes',          desc: 'Liner, mascara, shadow, brows',slugs: ['eyes'] },
            { id: 'nails', label: '💅 Nails',          desc: 'Polish + care',               slugs: ['nails'] },
            { id: 'tools', label: '🖌️ Tools & Brushes',desc: 'Applicators + tools',         slugs: ['tools-brushes'] },
            { id: 'kits',  label: '🎁 Makeup Kits',    desc: 'Curated multi-product sets',  slugs: ['makeup-kits'] },
          ];
          const groups = tab === 'cosmetics' ? COSMETICS_GROUPS : SKINCARE_GROUPS;
          const niche = tab === 'cosmetics' ? 'cosmetics' : 'skincare';
          const allInNiche = categories.filter(c => (c.niche || c.group) === niche);
          const inCanonical = new Set(groups.flatMap(g => g.slugs));
          const otherItems = allInNiche.filter(c => !inCanonical.has(c.slug));

          const renderCard = (c) => (
            <div key={c.slug} className="bg-white ring-1 ring-gray-200 rounded-2xl overflow-hidden hover:ring-green-300 transition-all" data-testid={`category-card-${c.slug}`}>
              <BannerImageDropzone
                currentImage={c.image}
                resourceType="category"
                slug={c.slug}
                token={token}
                onUpdated={() => load()}
                alt={c.name}
                className="aspect-[16/9]"
              >
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{c.is_active ? 'Active' : 'Off'}</span>
                </div>
              </BannerImageDropzone>
              <div className="p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{c.icon}</span>
                  <h3 className="font-black text-gray-900 text-sm">{c.name}</h3>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1 mb-2">{c.tagline}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-mono truncate">/{c.slug}</span>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => setEditing({ type: 'category', data: { ...c }, isNew: false })} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" data-testid={`edit-category-${c.slug}`}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => remove('category', c.slug)} className="text-red-600 hover:bg-red-50 p-1.5 rounded" data-testid={`delete-category-${c.slug}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );

          return (
            <div className="space-y-7" data-testid={`product-types-${niche}`}>
              <div className={`rounded-2xl px-4 py-3 ring-1 ${niche === 'cosmetics' ? 'bg-rose-50 ring-rose-200' : 'bg-emerald-50 ring-emerald-200'}`}>
                <p className={`text-xs font-black ${niche === 'cosmetics' ? 'text-rose-900' : 'text-emerald-900'}`}>
                  {niche === 'cosmetics' ? '💄 Cosmetics Product Types' : '🧴 Skincare Product Types'}
                </p>
                <p className={`text-[11px] mt-0.5 leading-snug ${niche === 'cosmetics' ? 'text-rose-800' : 'text-emerald-800'}`}>
                  Grouped exactly the way customers see them on the {niche === 'cosmetics' ? '/cosmetics' : '/skincare'} hub.
                  Click any banner to upload an image — that image will instantly appear on the storefront tile, concern pages, and category pages.
                </p>
              </div>
              {groups.map(g => {
                const items = g.slugs
                  .map(s => allInNiche.find(c => c.slug === s))
                  .filter(Boolean);
                const missingFromDb = g.slugs.filter(s => !allInNiche.find(c => c.slug === s));
                return (
                  <section key={g.id} data-testid={`group-${g.id}`}>
                    <div className="flex items-baseline justify-between mb-2.5 px-1">
                      <div>
                        <h2 className="text-base font-black text-stone-900">{g.label}</h2>
                        <p className="text-[11px] text-stone-500">{g.desc}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        {items.length}{missingFromDb.length ? ` / ${g.slugs.length}` : ''}
                      </span>
                    </div>
                    {items.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(renderCard)}
                      </div>
                    ) : (
                      <div className="bg-stone-50 ring-1 ring-stone-200 rounded-2xl p-5 text-center text-xs text-stone-500">
                        No product types in this group yet.
                      </div>
                    )}
                    {missingFromDb.length > 0 && (
                      <p className="text-[10px] text-amber-700 mt-1.5 px-1">
                        ⚠ Missing record(s) for canonical slug(s): <code className="bg-amber-50 px-1 rounded">{missingFromDb.join(', ')}</code> — click "Add {niche === 'cosmetics' ? 'cosmetic product type' : 'skincare product type'}" to create.
                      </p>
                    )}
                  </section>
                );
              })}
              {otherItems.length > 0 && (
                <section data-testid="group-other">
                  <div className="flex items-baseline justify-between mb-2.5 px-1">
                    <div>
                      <h2 className="text-base font-black text-stone-900">📦 Other</h2>
                      <p className="text-[11px] text-stone-500">Product types not in the canonical groups above. Re-classify or delete from full edit form.</p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{otherItems.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {otherItems.map(renderCard)}
                  </div>
                </section>
              )}
            </div>
          );
        })()}

        {!globalSearch && tab === 'subcategories' && (
          <div className="space-y-4" data-testid="subcategories-tab">
            <div className="bg-gradient-to-r from-amber-50 to-rose-50 ring-1 ring-amber-200 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-900 mb-1">How subcategories work</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                A subcategory is a real group <em>inside</em> a category — exactly how an e-commerce site nests
                products. Pick a parent category first, then create the subcategories that actually exist there.
                Examples: <span className="font-bold">Lipstick → Matte / Glossy / Liquid</span>,
                <span className="font-bold"> Foundation → Liquid / Stick / Cushion</span>,
                <span className="font-bold"> Eyeshadow → Single / Palette / Glitter</span>. Avoid generic tags
                ("Best Sellers", "Luxury") — those belong to badges or filters, not the taxonomy.
              </p>
            </div>
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 ring-1 ring-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-xs font-black text-emerald-900 mb-1">Images not showing on the public site?</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Some subcategory slugs (e.g. <code className="bg-white px-1 rounded">chemical-exfoliant</code>) exist in BOTH
                  the categories and subcategories collections. Older uploads only saved on one side. Click below to one-shot
                  sync every subcategory image into the matching category record so the user-facing hub renders correctly.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!window.confirm('Sync all subcategory images → category records?')) return;
                  try {
                    const r = await axios.post(`${API}/api/admin/subcategories/sync-images-to-categories`, {}, auth);
                    alert(`Synced ${r.data.updated} images. Skipped: ${r.data.skipped_already_set} (category already had image). No sibling: ${r.data.no_sibling}.`);
                    load();
                  } catch (e) { alert(e?.response?.data?.detail || e.message); }
                }}
                className="shrink-0 self-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm"
                data-testid="sync-subcategory-images"
              >
                Sync images now
              </button>
            </div>
            <div className="bg-white ring-1 ring-stone-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <label className="text-xs font-bold text-stone-700">Filter by category:</label>
              <select
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className="flex-1 max-w-xs px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white"
                data-testid="subcategory-filter"
              >
                <option value="">All parent categories</option>
                <optgroup label="Skincare">
                  {categories.filter(c => (c.niche || c.group) === 'skincare').map(c => (
                    <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Cosmetics">
                  {categories.filter(c => (c.niche || c.group) === 'cosmetics').map(c => (
                    <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                  ))}
                </optgroup>
              </select>
              <span className="text-[11px] text-stone-500">
                {subcategories.filter(s => !subcategoryFilter || s.parent_category === subcategoryFilter).length} subcategories
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subcategories
                .filter(s => !subcategoryFilter || s.parent_category === subcategoryFilter)
                .map(s => {
                  const parent = categories.find(c => c.slug === s.parent_category);
                  return (
                    <div key={s.slug} className="bg-white ring-1 ring-stone-200 rounded-2xl overflow-hidden hover:ring-green-300 transition-all" data-testid={`subcategory-card-${s.slug}`}>
                      <BannerImageDropzone
                        currentImage={s.image}
                        resourceType="subcategory"
                        slug={s.slug}
                        token={token}
                        onUpdated={() => load()}
                        gradient="linear-gradient(135deg, #fef3c7 0%, #fdf2f8 100%)"
                        alt={s.name}
                        className="aspect-[16/9]"
                      >
                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.niche === 'cosmetics' ? 'bg-rose-100 text-rose-800' : 'bg-green-100 text-green-800'}`}>{s.niche}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{s.is_active ? 'Active' : 'Off'}</span>
                        </div>
                      </BannerImageDropzone>
                      <div className="p-3.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{s.icon}</span>
                          <h3 className="font-black text-gray-900 text-sm">{s.name}</h3>
                        </div>
                        <p className="text-[11px] text-amber-700 font-bold mb-1.5">↳ inside {parent ? `${parent.icon} ${parent.name}` : s.parent_category}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2">{s.tagline}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 font-mono truncate">/{s.slug}</span>
                          <div className="flex gap-1 items-center">
                            <button onClick={() => setEditing({ type: 'subcategory', data: { ...s }, isNew: false })} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" data-testid={`edit-subcategory-${s.slug}`}>
                              <Edit size={14} />
                            </button>
                            <button onClick={() => remove('subcategory', s.slug)} className="text-red-600 hover:bg-red-50 p-1.5 rounded" data-testid={`delete-subcategory-${s.slug}`}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {subcategories.filter(s => !subcategoryFilter || s.parent_category === subcategoryFilter).length === 0 && (
                <div className="col-span-full bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-6 text-center text-sm text-amber-800" data-testid="subcategories-empty">
                  {subcategoryFilter
                    ? `No subcategories under "${subcategoryFilter}" yet. Click "Add subcategory" to create the first one.`
                    : 'No subcategories yet. Pick a parent category above and click "Add subcategory".'}
                </div>
              )}
            </div>
          </div>
        )}
        {!globalSearch && tab === 'shop-tiles' && (
          <TilesPanel auth={auth} />
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-black text-gray-900 text-lg">{editing.isNew ? 'Add' : 'Edit'} {editing.type}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Slug (url-safe)" disabled={!editing.isNew}>
                <input value={editing.data.slug} onChange={e => setEditing({ ...editing, data: { ...editing.data, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') } })} placeholder="anti-aging" data-testid="field-slug" />
              </Field>
              <Field label="Name">
                <input value={editing.data.name} onChange={e => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} placeholder="Anti-Aging" data-testid="field-name" />
              </Field>
              <Field label="Tagline (1 line)">
                <input value={editing.data.tagline} onChange={e => setEditing({ ...editing, data: { ...editing.data, tagline: e.target.value } })} placeholder="Wrinkles, fine lines, firmness" data-testid="field-tagline" />
              </Field>
              <Field label="Icon (emoji)">
                <input value={editing.data.icon} onChange={e => setEditing({ ...editing, data: { ...editing.data, icon: e.target.value } })} placeholder="✨" data-testid="field-icon" />
              </Field>
              <Field label="Image (URL or upload)">
                <input value={editing.data.image} onChange={e => setEditing({ ...editing, data: { ...editing.data, image: e.target.value } })} placeholder="https://..." data-testid="field-image" />
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="text-xs"
                    data-testid="field-image-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const r = await axios.post(`${API}/api/admin/upload-image`, fd, {
                          headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' },
                        });
                        setEditing(s => ({ ...s, data: { ...s.data, image: r.data.url } }));
                      } catch (err) { alert(err?.response?.data?.detail || 'Upload failed'); }
                      e.target.value = '';
                    }}
                  />
                </div>
                {editing.data.image && (
                  <div className="mt-2 aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
                    <img src={editing.data.image} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                )}
              </Field>
              <Field label="Niche (which niche home page this appears on)">
                <select value={editing.data.niche || (editing.type === 'category' ? (editing.data.group === 'cosmetics' ? 'cosmetics' : 'skin-care') : 'skin-care')} onChange={e => setEditing({ ...editing, data: { ...editing.data, niche: e.target.value } })} data-testid="field-niche">
                  <option value="skin-care">✨ Skin Care</option>
                </select>
              </Field>
              {editing.type === 'subcategory' && (
                <Field label="Parent category (REQUIRED — products will be grouped under this)">
                  <select
                    value={editing.data.parent_category || ''}
                    onChange={e => {
                      const slug = e.target.value;
                      const parent = categories.find(c => c.slug === slug);
                      setEditing({
                        ...editing,
                        data: {
                          ...editing.data,
                          parent_category: slug,
                          niche: parent ? (parent.niche || parent.group || editing.data.niche) : editing.data.niche,
                        },
                      });
                    }}
                    data-testid="field-parent-category"
                    required
                  >
                    <option value="">— Pick a parent —</option>
                    <optgroup label="Skincare">
                      {categories.filter(c => (c.niche || c.group) === 'skincare').map(c => (
                        <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Cosmetics">
                      {categories.filter(c => (c.niche || c.group) === 'cosmetics').map(c => (
                        <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
              )}
              {editing.type === 'concern' && (
                <>
                  <Field label="Description (long)">
                    <textarea rows={3} value={editing.data.description} onChange={e => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} data-testid="field-description" />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Accent From">
                      <input type="color" value={editing.data.accent_from} onChange={e => setEditing({ ...editing, data: { ...editing.data, accent_from: e.target.value } })} />
                    </Field>
                    <Field label="Accent To">
                      <input type="color" value={editing.data.accent_to} onChange={e => setEditing({ ...editing, data: { ...editing.data, accent_to: e.target.value } })} />
                    </Field>
                    <Field label="Accent Text">
                      <input type="color" value={editing.data.accent_text} onChange={e => setEditing({ ...editing, data: { ...editing.data, accent_text: e.target.value } })} />
                    </Field>
                  </div>
                </>
              )}
              {editing.type === 'category' && (
                <Field label="Group">
                  <select value={editing.data.group} onChange={e => setEditing({ ...editing, data: { ...editing.data, group: e.target.value } })} data-testid="field-group">
                    <option value="skincare">Skincare</option>
                    <option value="cosmetics">Cosmetics &amp; Makeup</option>
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sort order">
                  <input type="number" value={editing.data.sort_order} onChange={e => setEditing({ ...editing, data: { ...editing.data, sort_order: parseInt(e.target.value, 10) || 99 } })} data-testid="field-sort" />
                </Field>
                <Field label="Active">
                  <label className="flex items-center gap-2 mt-3">
                    <input type="checkbox" checked={editing.data.is_active} onChange={e => setEditing({ ...editing, data: { ...editing.data, is_active: e.target.checked } })} className="w-4 h-4" data-testid="field-active" />
                    <span className="text-sm font-semibold">{editing.data.is_active ? 'Live on site' : 'Hidden'}</span>
                  </label>
                </Field>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-2 rounded-b-3xl">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5" data-testid="save-btn">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, disabled }) {
  return (
    <label className={`block ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500 mb-1 inline-block">{label}</span>
      <div className="[&_input]:w-full [&_input]:px-3 [&_input]:py-2.5 [&_input]:rounded-lg [&_input]:border [&_input]:border-gray-200 [&_input]:focus:border-green-500 [&_input]:focus:outline-none [&_input]:text-sm [&_textarea]:w-full [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-gray-200 [&_textarea]:focus:border-green-500 [&_textarea]:focus:outline-none [&_textarea]:text-sm [&_select]:w-full [&_select]:px-3 [&_select]:py-2.5 [&_select]:rounded-lg [&_select]:border [&_select]:border-gray-200 [&_select]:text-sm">
        {children}
      </div>
    </label>
  );
}
