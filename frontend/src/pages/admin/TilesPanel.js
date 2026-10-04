import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Image as ImageIcon, Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * TilesPanel — "Shop by Category" tile CRUD for the Skincare niche.
 * Extracted so it can live where category-editing already lives
 * (AdminConcerns → Categories tab) instead of the separate Extras page.
 *
 * "Sync from catalog" walks the product taxonomy and creates a tile record
 * for every unique parent category that doesn't already have one — so admins
 * can upload images for EVERY category derived from the actual catalog.
 */
export default function TilesPanel({ auth }) {
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState({ slug: '', name: '', niche: 'skincare', sort_order: 0 });

  const load = async () => {
    try {
      const r = await axios.get(`${API}/api/admin/shop-by-category?niche=skincare`, auth);
      setTiles(r.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const create = async () => {
    if (!creating.slug || !creating.name) return alert('Slug and Name required');
    try {
      await axios.post(`${API}/api/admin/shop-by-category`, { ...creating, is_active: true }, auth);
      setCreating({ slug: '', name: '', niche: 'skincare', sort_order: 0 });
      load();
    } catch (e) { alert(e?.response?.data?.detail || 'Create failed'); }
  };

  const uploadImg = async (slug, file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/api/admin/shop-by-category/${slug}/image`, fd, {
        ...auth,
        headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' },
      });
      load();
    } catch (e) { alert(e?.response?.data?.detail || 'Upload failed'); }
  };

  const del = async (slug) => {
    if (!window.confirm(`Delete tile "${slug}"?`)) return;
    await axios.delete(`${API}/api/admin/shop-by-category/${slug}`, auth);
    load();
  };
  const patch = async (t, upd) => {
    await axios.put(`${API}/api/admin/shop-by-category/${t.slug}`, { ...t, ...upd }, auth);
    load();
  };

  // Sync from catalog: pull /api/categories (skincare) and create a tile for
  // every parent category that doesn't yet have one. This unlocks image-upload
  // for EVERY derived category shown on /skincare Shop by Category.
  const syncFromCatalog = async () => {
    setSyncing(true);
    try {
      const r = await axios.get(`${API}/api/categories`);
      const cats = (r.data || []).filter(c => (c.group === 'skincare' || c.niche === 'skincare' || (!c.group && !c.niche)) && c.is_active !== false);
      // Prefer explicit parents; fall back to any unique parent slug referenced.
      let picks = cats.filter(c => c.is_parent === true);
      if (picks.length < 6) {
        const parentSlugs = [...new Set(cats.map(c => c.parent).filter(Boolean))];
        const byParent = parentSlugs.map(slug => cats.find(c => c.slug === slug)
          || { slug, name: slug.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) });
        picks = [...picks, ...byParent.filter(p => !picks.some(x => x.slug === p.slug))];
      }
      const existing = new Set(tiles.map(t => t.slug));
      const toCreate = picks.filter(p => !existing.has(p.slug));
      let added = 0;
      for (const p of toCreate) {
        try {
          await axios.post(`${API}/api/admin/shop-by-category`,
            { slug: p.slug, name: p.name, niche: 'skincare', sort_order: added, is_active: true, image: p.image || null },
            auth);
          added += 1;
        } catch (_) { /* skip conflicts */ }
      }
      alert(`Synced from catalog · ${added} new tile${added === 1 ? '' : 's'} added.`);
      load();
    } catch (e) { alert(e?.response?.data?.detail || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />;

  return (
    <div className="space-y-4" data-testid="tiles-panel">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="font-semibold mb-0.5 text-sm">Skincare &ldquo;Shop by Category&rdquo; tiles</h3>
            <p className="text-xs text-gray-500">Upload an image per tile — replaces the placeholder icon.</p>
          </div>
          <button
            onClick={syncFromCatalog}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs border border-emerald-200 disabled:opacity-60"
            data-testid="tile-sync-btn"
            title="Create tile records for every parent category in the product catalog so you can upload images for them"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Sync from catalog
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            placeholder="slug (sunscreens)"
            value={creating.slug}
            onChange={e => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            className="input"
            data-testid="tile-slug-input"
          />
          <input
            placeholder="Display name"
            value={creating.name}
            onChange={e => setCreating({ ...creating, name: e.target.value })}
            className="input"
            data-testid="tile-name-input"
          />
          <input
            type="number"
            placeholder="sort"
            value={creating.sort_order}
            onChange={e => setCreating({ ...creating, sort_order: Number(e.target.value) })}
            className="input"
          />
          <button
            onClick={create}
            className="bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 py-2.5"
            data-testid="tile-create-btn"
          >
            <Plus size={15} className="inline mr-1" />Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map(t => (
          <div key={t.slug} className="bg-white rounded-2xl border border-gray-100 p-3" data-testid={`tile-row-${t.slug}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border">
                {t.image
                  ? <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.slug}</p>
              </div>
            </div>
            <label className="text-xs inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full cursor-pointer font-semibold">
              <ImageIcon size={11} /> Upload image
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImg(t.slug, e.target.files[0])} />
            </label>
            <label className="text-xs ml-2 inline-flex items-center gap-1">
              <input type="checkbox" checked={t.is_active !== false} onChange={e => patch(t, { is_active: e.target.checked })} />Active
            </label>
            <button onClick={() => del(t.slug)} className="text-xs text-red-600 ml-2 hover:underline">
              <Trash2 size={11} className="inline" /> Delete
            </button>
          </div>
        ))}
        {tiles.length === 0 && <p className="col-span-full text-center text-sm text-gray-500 py-8">No tiles yet. Add your first Skincare category tile above.</p>}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}
