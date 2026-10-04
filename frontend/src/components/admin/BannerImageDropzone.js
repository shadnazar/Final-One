/**
 * BannerImageDropzone — turns the big 16:9 banner area on admin cards into a
 * dedicated upload zone when there is no image set yet.
 *
 * Replaces the previous UX where the only upload affordance was a tiny icon
 * tucked in the action row. Admins were missing it on dozens of cards, so the
 * banner area itself now says "Click to upload image" in a clearly clickable
 * style — and the small icon in the action row stays for replacing an
 * already-set image.
 *
 * Props:
 *   currentImage — string|null
 *   resourceType — 'concern' | 'category' | 'subcategory'
 *   slug         — string
 *   token        — admin token
 *   onUpdated    — callback fired after a successful upload
 *   gradient     — optional CSS background gradient for the empty state
 *   alt          — alt text when image is present
 *   className    — extra classes (e.g. aspect-ratio overrides)
 *   children     — overlay content (badges etc.) rendered above the image/upload UI
 */
import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, Image as ImageIcon, Loader2, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BannerImageDropzone({
  currentImage,
  resourceType,
  slug,
  token,
  onUpdated,
  gradient = 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)',
  alt = '',
  className = 'aspect-[16/9]',
  children = null,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const auth = { headers: { 'X-Admin-Token': token } };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('Max 8MB'); return; }
    setBusy(true); setErr(''); setOk(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `celesta-glow/${resourceType}`);
      let newUrl = null;
      try {
        const up = await axios.post(`${API}/api/admin/cloudinary/upload`, fd, auth);
        newUrl = up.data?.url || up.data?.secure_url;
      } catch (e1) {
        if (e1?.response?.status === 503) {
          const up2 = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
          newUrl = up2.data?.url;
        } else { throw e1; }
      }
      if (!newUrl) throw new Error('Upload failed');
      const path = resourceType === 'category' ? 'categories'
        : resourceType === 'subcategory' ? 'subcategories'
        : 'concerns';
      await axios.patch(`${API}/api/admin/${path}/${slug}/image`, { image: newUrl }, auth);
      setOk(true);
      onUpdated?.(newUrl);
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
      setTimeout(() => setOk(false), 2500);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || e2?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const empty = !currentImage;
  const pick = () => fileRef.current?.click();

  return (
    <div
      className={`relative overflow-hidden ${className} ${empty ? 'cursor-pointer group' : ''}`}
      style={empty ? { background: gradient } : undefined}
      onClick={empty && !busy ? pick : undefined}
      role={empty ? 'button' : undefined}
      tabIndex={empty ? 0 : -1}
      onKeyDown={empty ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
      data-testid={`banner-dropzone-${resourceType}-${slug}`}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Image fill (when present) */}
      {!empty && (
        <img src={currentImage} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Empty-state upload prompt */}
      {empty && !busy && !ok && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 transition-all group-hover:bg-purple-100/40">
          <div className="w-10 h-10 rounded-full bg-white shadow ring-1 ring-purple-200 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
            <ImageIcon size={18} className="text-purple-600" />
          </div>
          <p className="text-[11px] font-black text-purple-900 leading-tight">Click to upload image</p>
          <p className="text-[10px] text-purple-700/80 mt-0.5">JPG/PNG/WebP · max 8MB</p>
        </div>
      )}

      {/* Busy / success / error states */}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 size={20} className="animate-spin text-purple-600" />
        </div>
      )}
      {ok && empty && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/85">
          <Check size={26} className="text-emerald-600" />
        </div>
      )}
      {err && (
        <div className="absolute bottom-1 left-1 right-1 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded text-center" title={err}>
          {err}
        </div>
      )}

      {/* "Replace image" affordance shown only when image is present */}
      {!empty && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); pick(); }}
          disabled={busy}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 text-purple-700 text-[11px] font-bold shadow ring-1 ring-purple-200 hover:bg-purple-50"
          data-testid={`banner-replace-${resourceType}-${slug}`}
        >
          <Upload size={11} /> Replace
        </button>
      )}

      {/* Overlay content (status badges etc.) */}
      {children}
    </div>
  );
}
