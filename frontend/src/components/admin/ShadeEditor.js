import React, { useState } from 'react';
import { Plus, Trash2, Palette, Sparkles, Upload, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * ShadeEditor — Admin UI for managing cosmetics shade variants.
 *
 * Features:
 *  - Manual hex picker
 *  - AI shade-name → hex lookup (calls /api/admin/shades/lookup-color with gpt-4o-mini)
 *  - Image upload (PNG/JPG/WEBP → Cloudinary if configured, local disk otherwise)
 *
 * Each shade: { id, name, hex, image, sku, stock_qty }
 */
export default function ShadeEditor({ shades = [], onChange }) {
  const [draft, setDraft] = useState({ name: '', hex: '#c08070', stock_qty: 50, sku: '', image: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [rowUploading, setRowUploading] = useState({}); // idx -> bool

  const adminToken = (typeof window !== 'undefined') ? localStorage.getItem('cg_admin_token') || 'celestaglow2024' : '';
  const authHeaders = { 'X-Admin-Token': adminToken };

  const slugify = (s) =>
    String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  const addShade = () => {
    const name = (draft.name || '').trim();
    if (!name) return;
    const baseId = slugify(name);
    let id = baseId, n = 2;
    while (shades.some((s) => s.id === id)) id = `${baseId}-${n++}`;
    onChange([
      ...shades,
      {
        id, name, hex: draft.hex || '#cccccc',
        stock_qty: parseInt(draft.stock_qty || 0, 10),
        sku: draft.sku || '', image: draft.image || '',
      },
    ]);
    setDraft({ name: '', hex: '#c08070', stock_qty: 50, sku: '', image: '' });
    setAiHint('');
  };

  const updateShade = (idx, patch) => {
    const next = shades.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };
  const removeShade = (idx) => onChange(shades.filter((_, i) => i !== idx));

  const lookupColor = async (name, applyTo) => {
    if (!name || !name.trim()) return;
    setAiLoading(true);
    setAiHint('');
    try {
      const r = await axios.get(`${API}/api/admin/shades/lookup-color`, {
        params: { name: name.trim() }, headers: authHeaders,
      });
      const hex = r.data.hex;
      const src = r.data.source;
      if (applyTo === 'draft') {
        setDraft({ ...draft, hex });
      } else if (typeof applyTo === 'number') {
        updateShade(applyTo, { hex });
      }
      setAiHint(src === 'ai' ? `AI matched "${name}" → ${hex}` : src === 'fallback' ? `Matched from library → ${hex}` : `No match found — using ${hex}`);
      setTimeout(() => setAiHint(''), 4000);
    } catch (e) {
      setAiHint(e.response?.data?.detail || 'Color lookup failed');
    } finally { setAiLoading(false); }
  };

  const uploadImage = async (file, applyTo) => {
    if (!file) return;
    const key = applyTo === 'draft' ? 'draft' : applyTo;
    setRowUploading((p) => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API}/api/admin/shades/upload-image`, fd, {
        headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
      });
      const url = r.data.url;
      if (applyTo === 'draft') setDraft({ ...draft, image: url });
      else updateShade(applyTo, { image: url });
    } catch (e) {
      alert('Image upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setRowUploading((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3" data-testid="shade-editor">
      <div className="flex items-center gap-2 mb-3">
        <Palette size={15} className="text-rose-600" />
        <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Shade Variants</p>
        <span className="text-[10px] text-stone-500">AI color lookup · image upload · stock per shade</span>
      </div>

      {shades.length > 0 && (
        <div className="space-y-2 mb-3">
          {shades.map((s, idx) => (
            <div key={s.id || idx} className="bg-white border border-stone-200 rounded-lg p-2.5" data-testid={`shade-row-${idx}`}>
              <div className="flex flex-wrap items-center gap-2">
                {/* Color picker */}
                <input
                  type="color" value={s.hex || '#cccccc'}
                  onChange={(e) => updateShade(idx, { hex: e.target.value })}
                  className="w-9 h-9 rounded-full cursor-pointer border-2 border-white shadow flex-shrink-0"
                  title={`Color for ${s.name}`}
                />
                {/* Shade thumbnail if uploaded */}
                {s.image && (
                  <img src={s.image} alt={s.name} className="w-9 h-9 rounded-lg object-cover ring-1 ring-stone-200 flex-shrink-0" />
                )}
                {/* Name */}
                <input
                  type="text" value={s.name || ''}
                  onChange={(e) => updateShade(idx, { name: e.target.value })}
                  placeholder="Shade name"
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-stone-200 rounded-md text-xs"
                  data-testid={`shade-name-${idx}`}
                />
                {/* AI lookup */}
                <button
                  type="button" onClick={() => lookupColor(s.name, idx)}
                  disabled={!s.name || aiLoading}
                  className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 text-white text-[10px] font-bold px-2 py-1.5 rounded-md"
                  title="AI: detect color from name"
                  data-testid={`shade-ai-${idx}`}
                >
                  {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  AI
                </button>
                {/* Image upload */}
                <label className="inline-flex items-center gap-1 bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-bold px-2 py-1.5 rounded-md cursor-pointer" data-testid={`shade-upload-${idx}`}>
                  {rowUploading[idx] ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  IMG
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], idx)} />
                </label>
                {/* Stock */}
                <input
                  type="number" value={s.stock_qty ?? 0}
                  onChange={(e) => updateShade(idx, { stock_qty: parseInt(e.target.value || '0', 10) })}
                  placeholder="Stock" min="0"
                  className="w-16 px-2 py-1.5 border border-stone-200 rounded-md text-xs"
                  data-testid={`shade-stock-${idx}`}
                />
                {/* SKU */}
                <input
                  type="text" value={s.sku || ''}
                  onChange={(e) => updateShade(idx, { sku: e.target.value })}
                  placeholder="SKU"
                  className="w-20 px-2 py-1.5 border border-stone-200 rounded-md text-xs"
                />
                <button
                  type="button" onClick={() => removeShade(idx)}
                  className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-md flex-shrink-0"
                  title="Remove shade" data-testid={`shade-remove-${idx}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {/* Image URL inline (read-only after upload, editable if pasted) */}
              {s.image && (
                <div className="mt-1.5">
                  <input
                    type="text" value={s.image}
                    onChange={(e) => updateShade(idx, { image: e.target.value })}
                    placeholder="Image URL"
                    className="w-full px-2.5 py-1 border border-stone-200 rounded text-[10px] text-stone-500 font-mono"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="bg-white border border-dashed border-rose-300 rounded-lg p-2.5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            type="color" value={draft.hex}
            onChange={(e) => setDraft({ ...draft, hex: e.target.value })}
            className="w-9 h-9 rounded-full cursor-pointer border-2 border-white shadow flex-shrink-0"
            title="Pick color"
          />
          {draft.image && (
            <img src={draft.image} alt="" className="w-9 h-9 rounded-lg object-cover ring-1 ring-stone-200 flex-shrink-0" />
          )}
          <input
            type="text" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && draft.name && (lookupColor(draft.name, 'draft'), e.preventDefault())}
            placeholder="Shade name (e.g. Nude Rose) — press Enter for AI"
            className="flex-1 min-w-[160px] px-2.5 py-1.5 border border-stone-200 rounded-md text-xs"
            data-testid="new-shade-name"
          />
          <button
            type="button" onClick={() => lookupColor(draft.name, 'draft')}
            disabled={!draft.name.trim() || aiLoading}
            className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md"
            title="Let AI pick the hex from name" data-testid="new-shade-ai"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Color
          </button>
          <label className="inline-flex items-center gap-1 bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-bold px-2.5 py-1.5 rounded-md cursor-pointer" data-testid="new-shade-upload">
            {rowUploading.draft ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
            <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], 'draft')} />
          </label>
          <input
            type="number" value={draft.stock_qty}
            onChange={(e) => setDraft({ ...draft, stock_qty: e.target.value })}
            placeholder="Stock" min="0"
            className="w-16 px-2 py-1.5 border border-stone-200 rounded-md text-xs"
            data-testid="new-shade-stock"
          />
          <button
            type="button" onClick={addShade} disabled={!draft.name.trim()}
            className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-md"
            data-testid="add-shade-btn"
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {aiHint && (
          <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1" data-testid="ai-hint">
            <Sparkles size={11} /> {aiHint}
          </p>
        )}
      </div>

      {shades.length > 0 && (
        <p className="text-[10px] text-stone-500 mt-2">
          Total shades: <strong>{shades.length}</strong> · Total stock:{' '}
          <strong>{shades.reduce((s, sh) => s + (parseInt(sh.stock_qty, 10) || 0), 0)}</strong>
        </p>
      )}
    </div>
  );
}
