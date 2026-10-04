/**
 * AdminMissingImages — scanner page that lists every entity (concern / category
 * / subcategory / niche / product) currently missing an `image` value. Renders
 * each as a row with inline QuickImageEditor so the admin can fix the gaps in
 * one place instead of hunting through tabs.
 *
 * Route: /admin/missing-images
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Image as ImageIcon, Search, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { getAdminToken, clearAdminToken } from '../../utils/adminAuth';
import QuickImageEditor from '../../components/admin/QuickImageEditor';

const API = process.env.REACT_APP_BACKEND_URL;

const TYPES = [
  { id: 'concern', label: 'Concerns', endpoint: 'concerns', icon: '🎯', resourceType: 'concern' },
  { id: 'category', label: 'Categories', endpoint: 'categories', icon: '🧴', resourceType: 'category' },
  { id: 'subcategory', label: 'Subcategories', endpoint: 'subcategories', icon: '🏷️', resourceType: 'subcategory' },
];

export default function AdminMissingImages() {
  const navigate = useNavigate();
  const token = getAdminToken();
  const auth = { headers: { 'X-Admin-Token': token } };

  const [data, setData] = useState({ concern: [], category: [], subcategory: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        axios.get(`${API}/api/admin/concerns`, auth),
        axios.get(`${API}/api/admin/categories`, auth),
        axios.get(`${API}/api/admin/subcategories`, auth),
      ]);
      setData({ concern: a.data || [], category: b.data || [], subcategory: c.data || [] });
    } catch (e) {
      if (e?.response?.status === 401) { clearAdminToken(); navigate('/admin'); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const out = {};
    for (const t of TYPES) {
      let list = data[t.id] || [];
      if (!showAll) list = list.filter(r => !r.image);
      if (filter.trim()) {
        const q = filter.toLowerCase();
        list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.slug || '').toLowerCase().includes(q));
      }
      out[t.id] = list;
    }
    return out;
  }, [data, filter, showAll]);

  const total = (filtered.concern?.length || 0) + (filtered.category?.length || 0) + (filtered.subcategory?.length || 0);
  const totalMissing = (data.concern.filter(r => !r.image).length || 0)
                     + (data.category.filter(r => !r.image).length || 0)
                     + (data.subcategory.filter(r => !r.image).length || 0);

  return (
    <div className="min-h-screen bg-stone-50" data-testid="admin-missing-images">
      <div className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link to="/admin" className="text-stone-600 hover:text-stone-900 flex items-center gap-1.5 text-sm font-semibold" data-testid="back-to-admin">
            <ArrowLeft size={16} /> Admin
          </Link>
          <h1 className="text-xl font-black text-stone-900 flex items-center gap-2">
            <ImageIcon size={20} className="text-purple-600" /> Missing Images
          </h1>
          <span className="ml-auto text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800" data-testid="missing-count">
            {totalMissing} missing
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">
        {/* Hero */}
        <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 ring-1 ring-purple-200 rounded-2xl p-5 mb-5">
          <p className="text-sm font-black text-purple-900 mb-1.5">One-stop image health check</p>
          <p className="text-[12.5px] text-purple-800 leading-relaxed">
            Lists every concern, category, and subcategory currently missing an image — exactly what shows as
            a blank tile on the storefront. Upload directly here. Each upload mirrors automatically to its
            paired record (categories ↔ subcategories) so the user-facing hub picks it up immediately.
          </p>
        </div>

        {/* Filter + toggle */}
        <div className="bg-white ring-1 ring-stone-200 rounded-2xl p-3 mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Search size={15} className="text-stone-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or slug…"
              className="flex-1 text-sm bg-transparent outline-none"
              data-testid="missing-search"
            />
          </div>
          <label className="text-xs font-semibold flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              data-testid="show-all-toggle"
            />
            Show all (including those with images)
          </label>
          <button
            onClick={load}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
            data-testid="refresh-button"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="bg-white ring-1 ring-stone-200 rounded-2xl p-10 text-center text-sm text-stone-500" data-testid="loading-state">
            Scanning…
          </div>
        )}

        {!loading && total === 0 && (
          <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-10 text-center" data-testid="empty-state">
            <CheckCircle2 size={36} className="text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-black text-emerald-900">All clear!</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Every concern, category, and subcategory has an image set. {showAll ? '' : 'Toggle "Show all" to review what is currently set.'}
            </p>
          </div>
        )}

        {!loading && TYPES.map(t => {
          const list = filtered[t.id] || [];
          if (!list.length) return null;
          return (
            <section key={t.id} className="mb-6" data-testid={`section-${t.id}`}>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={15} className="text-stone-500" />
                <h2 className="text-sm font-black text-stone-900">{t.icon} {t.label}</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">{list.length}</span>
              </div>
              <div className="bg-white ring-1 ring-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100">
                {list.map(r => (
                  <div key={`${t.id}-${r.slug}`} className="flex items-center gap-3 px-4 py-3" data-testid={`row-${t.id}-${r.slug}`}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 flex items-center justify-center text-xl">
                      {r.image ? (
                        <img src={r.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span aria-hidden="true">{r.icon || '🖼️'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate flex items-center gap-1.5">
                        {r.name}
                        {!r.image && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" title="No image set" />}
                      </p>
                      <p className="text-[11px] text-stone-500 font-mono truncate">
                        /{r.slug}
                        {r.parent_category ? <span className="ml-1.5 text-stone-400">↳ in /{r.parent_category}</span> : null}
                        {r.niche || r.group ? <span className="ml-1.5 px-1.5 py-0.5 rounded bg-stone-100">{r.niche || r.group}</span> : null}
                      </p>
                    </div>
                    <QuickImageEditor
                      currentImage={r.image}
                      resourceType={t.resourceType}
                      slug={r.slug}
                      token={token}
                      onUpdated={() => load()}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
