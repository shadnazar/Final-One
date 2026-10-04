import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, Upload, Trash2, Save, Loader2, Images, GripVertical } from 'lucide-react';

/**
 * AdminImageGalleryEditor — search a product, edit its gallery with
 * per-image alt keywords (Google-facing SEO), reorder, remove, save.
 *
 * Uploads go through the existing /api/admin/upload/product-image endpoint
 * (Cloudinary) so we don't reinvent storage.
 */
const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'cg_admin_token';
const authHeaders = () => ({ 'X-Admin-Token': localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem('adminToken') || '' });

// Fixed niche list — mirrors the site's three active niches.
const NICHES = [
  { key: '', label: 'All niches' },
  { key: 'anti-aging', label: 'Anti-Aging' },
  { key: 'skincare', label: 'Skincare' },
  { key: 'cosmetics', label: 'Cosmetics' },
];

export default function AdminImageGallery() {
  const [q, setQ] = useState('');
  const [niche, setNiche] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [product, setProduct] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [loadingList, setLoadingList] = useState(false);

  const canSave = useMemo(() => selectedSlug && Array.isArray(gallery), [selectedSlug, gallery]);

  // Load an initial list (top 30) on mount and whenever the niche changes.
  // Also re-runs when the search term is cleared so the merchant always sees
  // *some* products even without typing.
  const doSearch = React.useCallback(async (term, nicheFilter) => {
    setLoadingList(true);
    try {
      const r = await axios.get(`${API}/api/admin/image-gallery/products`, {
        params: { q: term || '', niche: nicheFilter || undefined, limit: 30 },
        headers: authHeaders(),
      });
      setResults(r.data?.items || []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { doSearch(q, niche); }, [niche, doSearch]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Debounce free-text search so we don't hammer the API on every keystroke.
    const t = setTimeout(() => doSearch(q, niche), 220);
    return () => clearTimeout(t);
  }, [q, doSearch]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadProduct = async (slug) => {
    setSelectedSlug(slug);
    setProduct(null);
    setGallery([]);
    try {
      const r = await axios.get(`${API}/api/admin/image-gallery/${slug}`, { headers: authHeaders() });
      setProduct({ slug: r.data.slug, name: r.data.name });
      setGallery(r.data.image_gallery || []);
    } catch (e) {
      alert(`Load failed: ${e.response?.data?.detail || e.message}`);
    }
  };

  const onUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        // Reuse the existing shades upload endpoint for Cloudinary uploads
        const r = await axios.post(`${API}/api/admin/shades/upload-image`, fd, {
          headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
        });
        if (r.data?.url) uploaded.push({ url: r.data.url, alt: '' });
      }
      setGallery((g) => [...g, ...uploaded]);
    } catch (e) {
      alert(`Upload failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const setAlt = (i, alt) => setGallery((g) => g.map((it, idx) => (idx === i ? { ...it, alt } : it)));
  const removeAt = (i) => setGallery((g) => g.filter((_, idx) => idx !== i));

  const onDrop = (target) => {
    if (dragIndex === null || dragIndex === target) return;
    setGallery((g) => {
      const next = [...g];
      const [picked] = next.splice(dragIndex, 1);
      next.splice(target, 0, picked);
      return next;
    });
    setDragIndex(null);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/admin/image-gallery/${selectedSlug}`,
        { image_gallery: gallery, sync_images: true },
        { headers: authHeaders() },
      );
      alert('Saved. Live on the product page.');
    } catch (e) {
      alert(`Save failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="admin-image-gallery">
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 flex items-center gap-2">
          <Images className="text-indigo-600" /> Product Image Gallery
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Search a product, upload / reorder / remove images, and tag each one with
          an <b>alt keyword</b> so Google indexes it.
        </p>
      </header>

      {/* Niche selector — filters the product list to the site's 3 niches */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1" data-testid="ig-niche-filter">
        {NICHES.map((n) => (
          <button
            key={n.key || 'all'}
            onClick={() => setNiche(n.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap ${niche === n.key ? 'bg-indigo-600 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
            data-testid={`ig-niche-${n.key || 'all'}`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, slug or brand…"
          className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl text-sm bg-white"
          data-testid="ig-search"
        />
      </div>

      {!selectedSlug && (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y max-h-[420px] overflow-y-auto mb-6">
          {loadingList && (
            <div className="p-4 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Loading products…
            </div>
          )}
          {!loadingList && results.length === 0 && (
            <div className="p-6 text-center text-sm text-stone-400">
              No products match {q ? `“${q}”` : 'this niche'}.
            </div>
          )}
          {results.map((p) => (
            <button
              key={p.slug}
              onClick={() => loadProduct(p.slug)}
              className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 text-left"
              data-testid={`ig-select-${p.slug}`}
            >
              {p.primary_image && <img src={p.primary_image} alt="" className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-stone-900 truncate">{p.name}</p>
                <p className="text-xs text-stone-500 truncate">
                  {p.slug} · {p.brand || 'unbranded'} · <span className="uppercase tracking-wider text-indigo-500">{p.niche || (p.active_niches || [])[0] || '—'}</span>
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600">{p.gallery_count || p.flat_count} imgs</span>
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      {selectedSlug && product && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5" data-testid="ig-editor">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Editing</p>
              <h2 className="text-lg font-black text-stone-900 truncate">{product.name}</h2>
              <p className="text-[11px] text-stone-500 truncate">{product.slug}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <label className="cursor-pointer px-3 py-2 rounded-lg bg-stone-100 text-stone-700 text-xs font-black flex items-center gap-1 hover:bg-stone-200">
                <Upload size={14} /> Add
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => { onUploadFiles(e.target.files); e.target.value = ''; }}
                  disabled={uploading}
                  data-testid="ig-upload-input"
                />
              </label>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1 disabled:opacity-50"
                data-testid="ig-save-btn"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              <button
                onClick={() => { setSelectedSlug(''); setProduct(null); setGallery([]); }}
                className="px-3 py-2 rounded-lg bg-white border border-stone-200 text-stone-500 text-xs font-black"
              >
                Close
              </button>
            </div>
          </div>

          {uploading && (
            <p className="text-xs text-indigo-600 mb-3 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading…</p>
          )}

          {gallery.length === 0 && (
            <p className="text-sm text-stone-500 italic py-8 text-center">No images yet. Click <b>Add</b> to upload.</p>
          )}

          <div className="space-y-2">
            {gallery.map((g, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="flex items-center gap-3 border border-stone-200 rounded-xl p-2 bg-stone-50/40"
                data-testid={`ig-row-${i}`}
              >
                <GripVertical size={16} className="text-stone-400 cursor-grab flex-shrink-0" />
                <img src={g.url} alt={g.alt} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={g.alt || ''}
                    onChange={(e) => setAlt(i, e.target.value)}
                    placeholder="Alt keyword (e.g. hyaluronic acid serum India)"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white"
                    data-testid={`ig-alt-${i}`}
                  />
                  <p className="text-[10px] text-stone-400 truncate mt-0.5">{g.url}</p>
                </div>
                <button
                  onClick={() => removeAt(i)}
                  className="px-2 py-2 rounded-lg text-red-500 hover:bg-red-50"
                  data-testid={`ig-remove-${i}`}
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
