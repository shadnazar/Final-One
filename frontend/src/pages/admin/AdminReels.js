import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronLeft, Plus, Loader2, Check, Trash2, Edit3, X, Video, Upload, Eye, ExternalLink,
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AdminReels — CRUD for influencer video reels shown under Loved by Creators
 * on the storefront (PDP + optionally the homepage niche section).
 */
export default function AdminReels() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const auth = useMemo(() => ({ headers: { 'X-Admin-Token': adminToken } }), [adminToken]);

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // reel object OR "new"
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    Promise.all([
      axios.get(`${API}/api/admin/reels`, auth).catch(() => ({ data: { items: [] } })),
      axios.get(`${API}/api/products?limit=1000`).catch(() => ({ data: { items: [] } })),
      axios.get(`${API}/api/admin/reels/analytics`, auth).catch(() => ({ data: null })),
    ]).then(([r, p, a]) => {
      setReels(r.data?.items || []);
      const items = Array.isArray(p.data) ? p.data : (p.data.items || p.data.products || []);
      setProducts(items.map((x) => ({ slug: x.slug, name: x.short_name || x.name })));
      setAnalytics(a.data || null);
    }).finally(() => setLoading(false));
  }, [adminToken, auth]);

  const refresh = () => Promise.all([
    axios.get(`${API}/api/admin/reels`, auth).then((r) => setReels(r.data?.items || [])),
    axios.get(`${API}/api/admin/reels/analytics`, auth).then((r) => setAnalytics(r.data)).catch(() => {}),
  ]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reel? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/admin/reels/${id}`, auth);
      refresh();
    } catch (e) { alert('Delete failed: ' + (e.response?.data?.detail || e.message)); }
  };

  if (isLoading || !isAuthenticated || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-stone-100" data-testid="back-to-admin">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2">
              <Video size={20} className="text-rose-600" /> Influencer Reels
            </h1>
            <p className="text-xs text-stone-500">Creator videos shown under &ldquo;Loved by Creators&rdquo; on product pages</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold px-4 py-2 rounded-full"
            data-testid="reel-add-btn"
          >
            <Plus size={16} /> Add Reel
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Analytics strip */}
        {analytics && (
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="reels-analytics">
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-3">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Total Reels</p>
              <p className="text-2xl font-black text-stone-900 mt-0.5">{analytics.total_reels}</p>
            </div>
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-3">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Active</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{analytics.active_reels}</p>
            </div>
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-3">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Total Views</p>
              <p className="text-2xl font-black text-rose-600 mt-0.5">{analytics.total_views.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-3">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Top Creator</p>
              <p className="text-sm font-black text-stone-900 mt-0.5 truncate">
                {analytics.top_creators?.[0]?.creator_name || '—'}
              </p>
              <p className="text-[10px] text-stone-500">
                {analytics.top_creators?.[0]?.views?.toLocaleString('en-IN') || 0} views
              </p>
            </div>
          </div>
        )}

        {reels.length === 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-10 text-center">
            <Video size={32} className="mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-500 mb-4">No reels yet. Add your first creator video.</p>
            <button
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold px-4 py-2 rounded-full"
            >
              <Plus size={16} /> Add Reel
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reels.map((reel) => (
            <div key={reel.id} className="bg-white rounded-2xl ring-1 ring-stone-200 overflow-hidden">
              <div className="relative aspect-[9/16] bg-black">
                {reel.thumbnail_url ? (
                  <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <video src={reel.video_url} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-sm font-bold truncate">{reel.creator_name}</p>
                  {reel.creator_handle && <p className="text-white/85 text-[11px] truncate">{reel.creator_handle}</p>}
                </div>
                {!reel.is_active && (
                  <span className="absolute top-2 left-2 text-[10px] font-black bg-gray-800 text-white px-2 py-0.5 rounded-full">HIDDEN</span>
                )}
              </div>
              <div className="p-3 text-xs space-y-1.5">
                <p className="text-stone-500 flex items-center gap-1"><Eye size={11} /> {reel.views || 0} views</p>
                <p className="text-stone-700 line-clamp-2">
                  {reel.product_slugs?.length
                    ? `Assigned: ${reel.product_slugs.slice(0, 2).join(', ')}${reel.product_slugs.length > 2 ? ` +${reel.product_slugs.length - 2}` : ''}`
                    : 'Global (shown on all product pages)'}
                </p>
                <div className="flex items-center justify-between pt-2">
                  <a
                    href={reel.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800"
                  >
                    <ExternalLink size={11} /> Video URL
                  </a>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(reel)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
                      data-testid={`reel-edit-${reel.id}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(reel.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                      data-testid={`reel-delete-${reel.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <ReelEditor
          reel={editing === 'new' ? null : editing}
          products={products}
          onSave={async (payload) => {
            if (editing === 'new') {
              await axios.post(`${API}/api/admin/reels`, payload, auth);
            } else {
              await axios.put(`${API}/api/admin/reels/${editing.id}`, payload, auth);
            }
            await refresh();
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
          auth={auth}
        />
      )}
    </div>
  );
}

// ─── Editor modal ────────────────────────────────────────────────────────

function ReelEditor({ reel, products, onSave, onClose, auth }) {
  const [videoUrl, setVideoUrl] = useState(reel?.video_url || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(reel?.thumbnail_url || '');
  const [creatorName, setCreatorName] = useState(reel?.creator_name || '');
  const [creatorHandle, setCreatorHandle] = useState(reel?.creator_handle || '');
  const [caption, setCaption] = useState(reel?.caption || '');
  const [productSlugs, setProductSlugs] = useState(reel?.product_slugs || []);
  const [isActive, setIsActive] = useState(reel?.is_active !== false);
  const [sortOrder, setSortOrder] = useState(reel?.sort_order || 0);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const handleUpload = async (file, setUrl, setBusy) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'influencer-reels');
      const r = await axios.post(`${API}/api/admin/upload-image`, fd, auth);
      setUrl(r.data.url || r.data.secure_url || '');
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!videoUrl || !creatorName) {
      alert('Video URL and Creator Name are required');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        video_url: videoUrl.trim(),
        thumbnail_url: thumbnailUrl.trim() || null,
        creator_name: creatorName.trim(),
        creator_handle: creatorHandle.trim() || null,
        caption: caption.trim() || null,
        product_slugs: productSlugs,
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
      });
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="reel-editor-modal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-black text-lg text-stone-900">{reel ? 'Edit Reel' : 'Add New Reel'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-stone-100" data-testid="reel-editor-close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Video URL + Upload */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Video URL *</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/…/reel.mp4"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                data-testid="reel-video-url"
              />
              <label className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer text-xs font-bold">
                <Upload size={13} /> {uploadingVideo ? 'Uploading…' : 'Upload'}
                <input type="file" accept="video/*" hidden onChange={(e) => handleUpload(e.target.files?.[0], setVideoUrl, setUploadingVideo)} />
              </label>
            </div>
            <p className="mt-1 text-[10px] text-stone-400">Direct MP4 URL. YouTube/Instagram embeds not supported in this v1.</p>
          </div>
          {/* Thumbnail */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Thumbnail (optional)</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/…/thumb.jpg"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                data-testid="reel-thumb-url"
              />
              <label className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer text-xs font-bold">
                <Upload size={13} /> {uploadingThumb ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0], setThumbnailUrl, setUploadingThumb)} />
              </label>
            </div>
          </div>
          {/* Creator name + handle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Creator Name *</label>
              <input
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Priya Sharma"
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                data-testid="reel-creator-name"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Handle / IG</label>
              <input
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                placeholder="@priya_glowup"
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                data-testid="reel-creator-handle"
              />
            </div>
          </div>
          {/* Caption */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              placeholder="How I use the Anti-Aging Serum in my night routine"
              className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>
          {/* Product assignment */}
          <div>
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Assign to Products</label>
            <p className="text-[10px] text-stone-400 mt-0.5">Empty = show on all product pages (global). Pick specific products to show this reel only there.</p>
            <div className="mt-1.5 max-h-40 overflow-y-auto p-2 border border-stone-200 rounded-lg space-y-1">
              {products.map((p) => (
                <label key={p.slug} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={productSlugs.includes(p.slug)}
                    onChange={(e) => {
                      setProductSlugs((cur) => e.target.checked ? [...cur, p.slug] : cur.filter((s) => s !== p.slug));
                    }}
                    className="rounded"
                  />
                  <span className="text-stone-700 truncate">{p.name}</span>
                  <span className="text-[10px] text-stone-400 ml-auto">{p.slug}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200"
              />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} data-testid="reel-active-toggle" />
              <span className="text-sm text-stone-700">Active (visible to shoppers)</span>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-full">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold px-5 py-2 rounded-full disabled:opacity-50"
            data-testid="reel-editor-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : 'Save Reel'}
          </button>
        </div>
      </div>
    </div>
  );
}
