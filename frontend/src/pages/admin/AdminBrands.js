/**
 * AdminBrands — admin panel for managing the "Shop by Brand" rails.
 *
 * Features:
 *  - List every brand (from products + manual brand_asset rows)
 *  - Upload / replace logo and banner per brand
 *  - Edit display name + description
 *  - Add a brand-asset row for a brand that doesn't have products yet
 *  - "View N products" link → public /brands/<slug>
 *  - "View products in admin" → AdminProducts filtered by brand
 *
 * Backend endpoints used:
 *  GET   /api/admin/brands/list          combined directory
 *  POST  /api/admin/brands                create a brand_asset row
 *  PATCH /api/admin/brands/{slug}         edit description / display name
 *  POST  /api/admin/brands/{slug}/logo    upload logo
 *  POST  /api/admin/brands/{slug}/banner  upload banner
 *  DELETE /api/admin/brands/{slug}        delete a brand_asset row
 */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Plus, Search, Save, Trash2, Upload, Loader2,
  ExternalLink, Image as ImageIcon, X, Pencil, Package, Check,
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

function classNames(...c) { return c.filter(Boolean).join(' '); }

function BrandImageUploader({ slug, brand, kind, currentUrl, onUploaded }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const token = getAdminToken();

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('Max 8MB'); return; }
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('brand', brand);
      const res = await axios.post(`${API}/api/admin/brands/${slug}/${kind}`, fd, {
        headers: { 'X-Admin-Token': token, 'Content-Type': 'multipart/form-data' },
      });
      onUploaded?.(res.data?.[kind]);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const label = kind === 'logo' ? 'Logo' : 'Banner';
  const aspect = kind === 'logo' ? 'aspect-square' : 'aspect-[16/9]';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-600">{label}</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
          data-testid={`brand-${slug}-${kind}-upload-btn`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {currentUrl ? 'Replace' : 'Upload'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={classNames(
          'relative w-full rounded-xl overflow-hidden border-2 border-dashed transition',
          aspect,
          currentUrl ? 'border-transparent' : 'border-stone-300 hover:border-emerald-500 bg-stone-50',
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={`${brand} ${label}`} className={kind === 'logo' ? 'w-full h-full object-contain bg-white' : 'w-full h-full object-cover'} />
        ) : (
          <div className="flex flex-col items-center justify-center text-stone-400 h-full">
            <ImageIcon size={28} />
            <span className="text-xs mt-1">Click to upload</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-white/70 grid place-items-center">
            <Loader2 className="animate-spin text-emerald-700" />
          </div>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handle} />
      {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
    </div>
  );
}

function BrandRow({ b, onChange, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(b.brand || '');
  const [desc, setDesc] = useState(b.description || '');
  const [saving, setSaving] = useState(false);
  const [okFlash, setOkFlash] = useState(false);
  const token = getAdminToken();

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/admin/brands/${b.slug}`,
        { brand: name, description: desc },
        { headers: { 'X-Admin-Token': token } });
      onChange?.({ ...b, brand: name, description: desc });
      setEdit(false);
      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 1500);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`Remove brand-asset for "${b.brand}"? Products keep their brand tag.`)) return;
    try {
      await axios.delete(`${API}/api/admin/brands/${b.slug}`, { headers: { 'X-Admin-Token': token } });
      onDelete?.(b.slug);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Delete failed');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5" data-testid={`brand-row-${b.slug}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          {edit ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg sm:text-xl font-black bg-stone-50 border border-stone-300 rounded-md px-2 py-1 w-full"
              data-testid={`brand-${b.slug}-name-input`}
            />
          ) : (
            <h3 className="text-lg sm:text-xl font-black text-stone-900 truncate">{b.brand}</h3>
          )}
          <div className="text-xs text-stone-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><Package size={12} /> {b.count} products</span>
            {b.niches?.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {b.niches.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] uppercase tracking-wide">{n}</span>
                ))}
              </span>
            )}
            <span className="text-stone-400">slug: {b.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {okFlash && <Check size={16} className="text-emerald-600" />}
          {b.count > 0 && (
            <Link
              to={`/brands/${b.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 inline-flex items-center gap-1"
              data-testid={`brand-${b.slug}-view-products`}
              title="View on customer site"
            >
              <ExternalLink size={12} /> View
            </Link>
          )}
          <button
            type="button"
            onClick={() => setEdit(e => !e)}
            className="text-xs px-2 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 inline-flex items-center gap-1"
            data-testid={`brand-${b.slug}-edit-btn`}
          >
            <Pencil size={12} /> {edit ? 'Cancel' : 'Edit'}
          </button>
          {b.has_asset && (
            <button
              type="button"
              onClick={del}
              className="text-xs px-2 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1"
              data-testid={`brand-${b.slug}-delete-btn`}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 sm:gap-5">
        <BrandImageUploader
          slug={b.slug}
          brand={b.brand}
          kind="logo"
          currentUrl={b.logo}
          onUploaded={(url) => onChange?.({ ...b, logo: url, has_asset: true })}
        />
        <BrandImageUploader
          slug={b.slug}
          brand={b.brand}
          kind="banner"
          currentUrl={b.banner}
          onUploaded={(url) => onChange?.({ ...b, banner: url, has_asset: true })}
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Description</p>
        {edit ? (
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short paragraph shown on the brand landing page hero."
            className="w-full text-sm bg-stone-50 border border-stone-300 rounded-md px-3 py-2 min-h-[70px]"
            data-testid={`brand-${b.slug}-description-input`}
          />
        ) : (
          <p className="text-sm text-stone-700 whitespace-pre-line min-h-[20px]">
            {b.description || <span className="text-stone-400 italic">No description</span>}
          </p>
        )}
        {edit && (
          <div className="flex justify-end mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-60"
              data-testid={`brand-${b.slug}-save-btn`}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const token = getAdminToken();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/brands/list`, {
        headers: { 'X-Admin-Token': token },
      });
      setBrands(res.data?.brands || []);
    } catch (e) {
      console.error('brand load failed', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(b =>
      (b.brand || '').toLowerCase().includes(q) ||
      (b.slug || '').toLowerCase().includes(q)
    );
  }, [brands, search]);

  const updateRow = (next) => {
    setBrands(prev => prev.map(b => b.slug === next.slug ? next : b));
  };
  const removeRow = (slug) => {
    setBrands(prev => prev.filter(b => b.slug !== slug || b.count > 0).map(b =>
      b.slug === slug ? { ...b, has_asset: false, logo: null, banner: null, description: '' } : b
    ));
  };

  const addBrand = async () => {
    const name = newName.trim();
    if (!name) { setAddErr('Name required'); return; }
    setAdding(true); setAddErr('');
    try {
      await axios.post(`${API}/api/admin/brands`, { brand: name }, {
        headers: { 'X-Admin-Token': token },
      });
      setNewName('');
      setShowAdd(false);
      await load();
    } catch (e) {
      setAddErr(e?.response?.data?.detail || 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const totals = useMemo(() => ({
    total: brands.length,
    withLogo: brands.filter(b => b.logo).length,
    withBanner: brands.filter(b => b.banner).length,
    withProducts: brands.filter(b => b.count > 0).length,
  }), [brands]);

  return (
    <div className="min-h-screen bg-stone-50" data-testid="admin-brands-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 mb-4">
          <ArrowLeft size={16} /> Back to admin
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900">Shop by Brand</h1>
            <p className="text-sm text-stone-600 mt-1">
              Upload logos, banners and bios for each brand. Visible on niche homes + dedicated brand pages.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            data-testid="admin-brands-add-btn"
          >
            <Plus size={16} /> Add new brand
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            ['Total brands', totals.total],
            ['With products', totals.withProducts],
            ['With logo', totals.withLogo],
            ['With banner', totals.withBanner],
          ].map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-stone-500">{k}</p>
              <p className="text-xl font-black text-stone-900">{v}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-5">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand name or slug…"
            className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm"
            data-testid="admin-brands-search-input"
          />
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-white border border-stone-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-stone-500">
            {search ? `No brands match "${search}".` : 'No brands yet. Add one to get started.'}
          </div>
        ) : (
          <div className="grid gap-4" data-testid="admin-brands-list">
            {visible.map(b => (
              <BrandRow key={b.slug} b={b} onChange={updateRow} onDelete={removeRow} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setShowAdd(false)}>
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            data-testid="admin-brands-add-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-stone-900">Add new brand</h2>
              <button onClick={() => setShowAdd(false)} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <p className="text-sm text-stone-600 mb-3">
              Creates a brand-asset row so you can upload a logo/banner before any product is tagged. Use the exact name you&apos;ll set on products (e.g. <span className="font-semibold">Fix Derma</span>).
            </p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBrand()}
              placeholder="Brand name (e.g. Fix Derma)"
              className="w-full text-sm bg-stone-50 border border-stone-300 rounded-md px-3 py-2 mb-2"
              data-testid="admin-brands-new-name-input"
            />
            {addErr && <p className="text-xs text-rose-600 mb-2">{addErr}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-sm font-semibold text-stone-700">Cancel</button>
              <button
                onClick={addBrand}
                disabled={adding}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                data-testid="admin-brands-create-btn"
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
