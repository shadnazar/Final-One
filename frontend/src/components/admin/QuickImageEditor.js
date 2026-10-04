import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, Image as ImageIcon, Loader2, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * QuickImageEditor — compact one-shot image uploader/replacer for entity cards.
 *
 * Props:
 *   • currentImage : string|null      — currently-saved image URL
 *   • resourceType : 'category'|'concern'|'subcategory'
 *   • slug         : string           — entity slug used in the PATCH URL
 *   • onUpdated    : (newUrl)=>void   — callback fired after a successful upload+save
 *   • token        : string           — X-Admin-Token (admin login token)
 *
 * Behaviour:
 *   1. Admin picks a file. We POST it to /api/admin/upload-image (Cloudinary).
 *   2. We then PUT the new URL onto /api/admin/{resourceType}s/{slug}
 *      via the `image` field. No other field is touched.
 *   3. We surface success / failure inline (no full-page modal).
 *
 * Cost: ZERO new backend endpoints — reuses upload-image + the existing
 * resource update endpoints we already trust.
 */
export default function QuickImageEditor({ currentImage, resourceType, slug, onUpdated, token }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const auth = { headers: { 'X-Admin-Token': token } };

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErr('File too large (max 8MB)');
      return;
    }
    setBusy(true); setErr(''); setOk(false);
    try {
      // 1. Upload to Cloudinary (persistent CDN — survives redeploys).
      //    Fall back to the legacy local-disk uploader if Cloudinary isn't
      //    configured (503), so the editor still works on dev / first boot.
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `celesta-glow/${resourceType}`);
      let newUrl = null;
      try {
        const up = await axios.post(`${API}/api/admin/cloudinary/upload`, fd, auth);
        newUrl = up.data?.url || up.data?.secure_url;
      } catch (e1) {
        // Fallback to legacy uploader on 503 (Cloudinary not configured)
        if (e1?.response?.status === 503) {
          const up2 = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
          newUrl = up2.data?.url;
        } else {
          throw e1;
        }
      }
      if (!newUrl) throw new Error('Upload succeeded but no URL returned');

      // 2. PATCH only the `image` field. The dedicated /image endpoint bypasses
      //    full-doc validation so legacy records with null accent colours /
      //    missing fields still update cleanly. This is the fix for the
      //    "subcategory image upload failing" bug on production.
      const resourcePath = resourceType === 'category' ? 'categories'
        : resourceType === 'subcategory' ? 'subcategories'
        : 'concerns';
      await axios.patch(`${API}/api/admin/${resourcePath}/${slug}/image`, { image: newUrl }, auth);

      setOk(true);
      onUpdated?.(newUrl);
      // Broadcast: tells SkincareHome/CosmeticsHome/CategoryHub to refetch
      // /api/categories so the new image lands on the hub tile without reload.
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
      setTimeout(() => setOk(false), 2500);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || e2?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1" data-testid={`quick-image-${resourceType}-${slug}`}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={pickFile}
        disabled={busy}
        title={currentImage ? 'Replace banner image' : 'Upload banner image'}
        className={`p-1.5 rounded transition ${ok ? 'text-green-600 bg-green-50' : err ? 'text-red-600 bg-red-50' : currentImage ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-400 hover:bg-gray-100'}`}
        data-testid={`quick-image-btn-${resourceType}-${slug}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : ok ? <Check size={14} /> : currentImage ? <Upload size={14} /> : <ImageIcon size={14} />}
      </button>
      {err && (
        <span className="text-[10px] text-red-600 truncate max-w-[120px]" title={err}>
          {err}
        </span>
      )}
    </div>
  );
}
