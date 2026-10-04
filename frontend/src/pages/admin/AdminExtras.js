import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, Layers, Percent, Copy, ExternalLink, Loader2, Save, Trash2, Plus, Image as ImageIcon, Handshake, TrendingUp, HeartPulse, Phone, Mail, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import LocationPicker from '../../components/admin/LocationPicker';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminExtras() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const [tab, setTab] = useState('flat50');
  const auth = useMemo(() => adminToken ? { headers: { 'X-Admin-Token': adminToken } } : {}, [adminToken]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></Link>
            <h1 className="text-xl font-bold">Growth & Sale Manager</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { k: 'flat50', label: 'Flat 50% OFF Switch', icon: Percent },
              { k: 'warehouse', label: 'Warehouse', icon: WarehouseIcon },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 ${tab === t.k ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                data-testid={`extras-tab-${t.k}`}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-5">
        {tab === 'flat50' && <Flat50Tab auth={auth} />}
        {tab === 'warehouse' && <WarehouseTab auth={auth} />}
      </div>
    </div>
  );
}

function Flat50Tab({ auth }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    try {
      const r = await axios.get(`${API}/sale-mode`);
      setCfg(r.data);
    } catch (_) { /* noop */ }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const save = async (patch) => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/admin/sale-mode`, patch, auth);
      setCfg(r.data);
    } catch (e) { alert(e?.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (!cfg) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />;
  const on = !!cfg.enabled;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 p-5 ${on ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg">Flat 50% OFF — Anti-Aging Niche</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enables 50% off + free shipping/tax on all anti-aging products only.</p>
          </div>
          <button
            onClick={() => save({ enabled: !on })}
            disabled={saving}
            className={`relative w-14 h-8 rounded-full transition-colors ${on ? 'bg-red-600' : 'bg-gray-300'}`}
            data-testid="flat50-toggle"
          >
            <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
          </button>
        </div>
        <p className={`text-sm font-semibold ${on ? 'text-red-700' : 'text-gray-400'}`}>
          {on ? 'LIVE — customers on /anti-aging see the 50% off banner + discounted prices' : 'OFF — normal prices'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h4 className="font-semibold text-sm">Copy & appearance</h4>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Badge label</span>
          <input defaultValue={cfg.badge_label} onBlur={e => e.target.value !== cfg.badge_label && save({ badge_label: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="flat50-badge-label" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Homepage banner text</span>
          <input defaultValue={cfg.banner_text} onBlur={e => e.target.value !== cfg.banner_text && save({ banner_text: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="flat50-banner-text" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Urgency line</span>
          <input defaultValue={cfg.urgency_line} onBlur={e => e.target.value !== cfg.urgency_line && save({ urgency_line: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Discount %</span>
          <input type="number" min="1" max="95" defaultValue={cfg.discount_percent} onBlur={e => Number(e.target.value) !== cfg.discount_percent && save({ discount_percent: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h4 className="font-semibold text-sm">Anti-Aging niche banners</h4>
        <p className="text-[11px] text-gray-500">Shown at the top of /shop?niche=anti-aging <b>only when the sale toggle above is ON.</b></p>
        <BannerUpload label="Desktop banner" auth={auth} field="banner_image_desktop" current={cfg.banner_image_desktop} onSaved={load} />
        <BannerUpload label="Mobile banner" auth={auth} field="banner_image_mobile" current={cfg.banner_image_mobile} onSaved={load} />
      </div>

      <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-3 bg-gradient-to-br from-emerald-50/40 to-white">
        <h4 className="font-semibold text-sm flex items-center gap-2"><ImageIcon size={14} className="text-emerald-600" /> Anti-Aging landing page banner</h4>
        <p className="text-[11px] text-gray-500">Always visible on the anti-aging niche page — <b>independent of the sale toggle</b>. Upload separate images for desktop and mobile for best quality.</p>
        <BannerUpload label="Desktop landing banner" auth={auth} field="landing_banner_anti_aging_desktop" current={cfg.landing_banner_anti_aging_desktop} onSaved={load} />
        <BannerUpload label="Mobile landing banner" auth={auth} field="landing_banner_anti_aging_mobile" current={cfg.landing_banner_anti_aging_mobile} onSaved={load} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Warehouse tab — MULTI-warehouse roster (Instant Delivery).
// Each row has name, address, lat/lng, service_radius_km, phone. The lat/lng
// is what powers the /api/delivery/coverage check at checkout.
// Named-exported so the standalone /admin/warehouses page can mount it.
// ----------------------------------------------------------------------------
export function WarehouseTab({ auth }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', pincode: '', phone: '', lat: '', lng: '', service_radius_km: 15, is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [dmForms, setDmForms] = useState({}); // per-warehouse quick-add delivery agent forms
  const [dmBusy, setDmBusy] = useState(false);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/admin/warehouses`, auth);
      setRows(r.data || []);
    } catch (_) { setRows([]); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const add = async () => {
    if (!form.name.trim()) return alert('Warehouse name required');
    setBusy(true);
    try {
      const payload = {
        ...form,
        lat: form.lat === '' ? null : parseFloat(form.lat),
        lng: form.lng === '' ? null : parseFloat(form.lng),
        service_radius_km: parseFloat(form.service_radius_km) || 15,
      };
      await axios.post(`${API}/admin/warehouses`, payload, auth);
      setForm({ name: '', address: '', pincode: '', phone: '', lat: '', lng: '', service_radius_km: 15, is_active: true });
      await load();
    } catch (e) { alert(e?.response?.data?.detail || 'Failed to add'); }
    finally { setBusy(false); }
  };

  const patch = async (id, upd) => {
    try {
      await axios.patch(`${API}/admin/warehouses/${id}`, upd, auth);
      await load();
    } catch (e) { alert('Update failed'); }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete warehouse "${name}"?`)) return;
    try { await axios.delete(`${API}/admin/warehouses/${id}`, auth); await load(); }
    catch (_) { alert('Delete failed'); }
  };

  const startEdit = (w) => {
    setEditingId(w.id);
    setEditForm({ ...w, lat: w.lat ?? '', lng: w.lng ?? '', service_radius_km: w.service_radius_km ?? 15 });
  };
  const saveEdit = async () => {
    try {
      await axios.patch(`${API}/admin/warehouses/${editingId}`, {
        name: editForm.name, address: editForm.address, pincode: editForm.pincode, phone: editForm.phone,
        lat: editForm.lat === '' ? null : parseFloat(editForm.lat),
        lng: editForm.lng === '' ? null : parseFloat(editForm.lng),
        service_radius_km: parseFloat(editForm.service_radius_km) || 15,
      }, auth);
      setEditingId(null);
      await load();
    } catch (e) { alert(e?.response?.data?.detail || 'Save failed'); }
  };

  // Quick-add delivery agent inside a warehouse row — pre-assigns the rider to
  // this warehouse. Uses the same /admin/delivery-men endpoint.
  const setDmForm = (wid, patch2) => setDmForms(prev => ({ ...prev, [wid]: { ...(prev[wid] || {}), ...patch2 } }));
  const addAgent = async (wid) => {
    const f = dmForms[wid] || {};
    if (!f.name?.trim() || !f.whatsapp_number?.trim()) return alert('Rider name + WhatsApp required');
    setDmBusy(true);
    try {
      await axios.post(`${API}/admin/delivery-men`, { name: f.name, whatsapp_number: f.whatsapp_number, assigned_warehouse_id: wid, active: true }, auth);
      setDmForms(prev => ({ ...prev, [wid]: {} }));
      alert(`Rider added and linked to this warehouse`);
    } catch (e) { alert(e?.response?.data?.detail || 'Failed to add rider'); }
    finally { setDmBusy(false); }
  };

  if (rows === null) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />;

  return (
    <div className="space-y-5" data-testid="warehouse-tab">
      {/* Add form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <WarehouseIcon size={18} className="text-emerald-600" />
          <div>
            <h3 className="font-bold text-lg">Add warehouse</h3>
            <p className="text-xs text-gray-500">Coordinates + radius are what enables Instant Delivery. Grab lat/lng from Google Maps → right-click on the pin → copy the numbers.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Warehouse name (e.g. Kozhikode HQ)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-name" />
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-phone" />
          <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Full postal address" rows={2} className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-address" />
          <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })}
            placeholder="Pincode" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-pincode" />
          <input type="number" step="0.5" min="1" max="100" value={form.service_radius_km} onChange={e => setForm({ ...form, service_radius_km: e.target.value })}
            placeholder="Radius km (default 15)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-radius" />
          <input type="number" step="0.000001" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })}
            placeholder="Latitude (e.g. 11.2588)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-lat" />
          <input type="number" step="0.000001" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })}
            placeholder="Longitude (e.g. 75.7804)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" data-testid="wh-lng" />
        </div>
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">Or pick on the map</p>
          <LocationPicker
            value={form.lat !== '' && form.lng !== '' ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : null}
            onChange={({ lat, lng }) => setForm({ ...form, lat: lat.toFixed(6), lng: lng.toFixed(6) })}
            height="h-48"
          />
        </div>
        <button onClick={add} disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm disabled:bg-gray-300"
          data-testid="wh-add">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add warehouse
        </button>
      </div>

      {/* Roster */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-wider">Warehouses ({rows.length})</h3>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <WarehouseIcon size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm">No warehouses yet. Add the first one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" data-testid="warehouse-list">
            {rows.map(w => (
              <li key={w.id} className="p-4 sm:p-5" data-testid={`wh-row-${w.id}`}>
                {editingId === w.id ? (
                  <div className="space-y-2" data-testid={`wh-edit-${w.id}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <textarea value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="Address" rows={2} className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input value={editForm.pincode || ''} onChange={e => setEditForm({ ...editForm, pincode: e.target.value })} placeholder="Pincode" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input type="number" step="0.5" value={editForm.service_radius_km ?? 15} onChange={e => setEditForm({ ...editForm, service_radius_km: e.target.value })} placeholder="Radius km" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input type="number" step="0.000001" value={editForm.lat ?? ''} onChange={e => setEditForm({ ...editForm, lat: e.target.value })} placeholder="Latitude" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input type="number" step="0.000001" value={editForm.lng ?? ''} onChange={e => setEditForm({ ...editForm, lng: e.target.value })} placeholder="Longitude" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <LocationPicker
                      value={editForm.lat && editForm.lng ? { lat: parseFloat(editForm.lat), lng: parseFloat(editForm.lng) } : null}
                      onChange={({ lat, lng }) => setEditForm({ ...editForm, lat: lat.toFixed(6), lng: lng.toFixed(6) })}
                      height="h-40"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-sm" data-testid={`wh-save-${w.id}`}>
                        <Save size={13} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900">{w.name}
                          {w.is_active === false && <span className="ml-2 text-[10px] font-semibold uppercase text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inactive</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{w.address}</p>
                        <p className="text-[11px] text-gray-400 mt-1 font-mono">
                          {w.lat && w.lng ? `${w.lat.toFixed?.(4) || w.lat}, ${w.lng.toFixed?.(4) || w.lng}` : '⚠ no coords'} · radius {w.service_radius_km ?? 15} km
                          {w.phone ? ` · ${w.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(w)} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100" data-testid={`wh-edit-btn-${w.id}`}>
                          Edit
                        </button>
                        <button onClick={() => patch(w.id, { is_active: !(w.is_active !== false) })}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
                          data-testid={`wh-toggle-${w.id}`}>
                          {w.is_active === false ? 'Enable' : 'Disable'}
                        </button>
                        <button onClick={() => remove(w.id, w.name)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" data-testid={`wh-delete-${w.id}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Quick-add delivery agent for this warehouse */}
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        value={dmForms[w.id]?.name || ''}
                        onChange={e => setDmForm(w.id, { name: e.target.value })}
                        placeholder="Rider name"
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                        data-testid={`wh-agent-name-${w.id}`}
                      />
                      <input
                        value={dmForms[w.id]?.whatsapp_number || ''}
                        onChange={e => setDmForm(w.id, { whatsapp_number: e.target.value })}
                        placeholder="Rider WhatsApp"
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                        data-testid={`wh-agent-phone-${w.id}`}
                      />
                      <button
                        onClick={() => addAgent(w.id)}
                        disabled={dmBusy}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs disabled:bg-gray-300"
                        data-testid={`wh-agent-add-${w.id}`}
                      >
                        <Plus size={11} /> Assign rider
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BannerUpload({ label, auth, field, current, onSaved }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      // Reuse the existing shop-by-category image endpoint by manually uploading via Cloudinary through a lightweight sale-mode banner upload
      const fd = new FormData();
      fd.append('file', file);
      // Use brand logo endpoint pattern — post to /admin/sale-mode-banner
      const r = await axios.post(`${API}/admin/sale-mode/banner?field=${field}`, fd, {
        ...auth,
        headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' },
      });
      onSaved(r.data);
    } catch (e) { alert(e?.response?.data?.detail || 'Upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-16 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden shrink-0">
        {current ? <img src={current} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">No image</div>}
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <label className="text-xs inline-flex items-center gap-1 mt-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold cursor-pointer">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Upload
          <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

function TilesTab({ auth }) {
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState({ slug: '', name: '', niche: 'skincare', sort_order: 0 });

  const load = async () => {
    try { const r = await axios.get(`${API}/admin/shop-by-category?niche=skincare`, auth); setTiles(r.data || []); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const create = async () => {
    if (!creating.slug || !creating.name) return alert('Slug and Name required');
    try {
      await axios.post(`${API}/admin/shop-by-category`, { ...creating, is_active: true }, auth);
      setCreating({ slug: '', name: '', niche: 'skincare', sort_order: 0 });
      load();
    } catch (e) { alert(e?.response?.data?.detail || 'Create failed'); }
  };
  const uploadImg = async (slug, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await axios.post(`${API}/admin/shop-by-category/${slug}/image`, fd, { ...auth, headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' } }); load(); }
    catch (e) { alert(e?.response?.data?.detail || 'Upload failed'); }
  };
  const del = async (slug) => {
    if (!confirm(`Delete tile "${slug}"?`)) return;
    await axios.delete(`${API}/admin/shop-by-category/${slug}`, auth); load();
  };
  const patch = async (t, upd) => {
    await axios.put(`${API}/admin/shop-by-category/${t.slug}`, { ...t, ...upd }, auth); load();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold mb-3 text-sm">Add a new tile (Skincare &quot;Shop by Category&quot;)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input placeholder="slug (sunscreens)" value={creating.slug} onChange={e => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input" data-testid="tile-slug-input" />
          <input placeholder="Display name" value={creating.name} onChange={e => setCreating({ ...creating, name: e.target.value })} className="input" data-testid="tile-name-input" />
          <input type="number" placeholder="sort" value={creating.sort_order} onChange={e => setCreating({ ...creating, sort_order: Number(e.target.value) })} className="input" />
          <button onClick={create} className="bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700" data-testid="tile-create-btn"><Plus size={15} className="inline mr-1" />Add</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map(t => (
          <div key={t.slug} className="bg-white rounded-2xl border border-gray-100 p-3" data-testid={`tile-row-${t.slug}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border">
                {t.image ? <img src={t.image} alt={t.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
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
            <label className="text-xs ml-2 inline-flex items-center gap-1"><input type="checkbox" checked={t.is_active !== false} onChange={e => patch(t, { is_active: e.target.checked })} />Active</label>
            <button onClick={() => del(t.slug)} className="text-xs text-red-600 ml-2 hover:underline"><Trash2 size={11} className="inline" /> Delete</button>
          </div>
        ))}
        {tiles.length === 0 && <p className="col-span-full text-center text-sm text-gray-500 py-8">No tiles yet. Add your first Skincare category tile above.</p>}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}

function LeadsTab({ auth }) {
  const [data, setData] = useState({ leads: [], counts: {} });
  const [type, setType] = useState('all');
  const load = async () => {
    const r = await axios.get(`${API}/admin/leads${type !== 'all' ? `?type=${type}` : ''}`, auth); setData(r.data || { leads: [], counts: {} });
  };
  useEffect(() => { load(); }, [type]); // eslint-disable-line

  const setStatus = async (id, status) => {
    await axios.patch(`${API}/admin/leads/${id}`, { status }, auth); load();
  };

  const iconFor = (t) => t === 'partner' ? Handshake : t === 'invest' ? TrendingUp : HeartPulse;
  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {[['all', 'All'], ['partner', 'Partner'], ['invest', 'Invest'], ['skin_concern', 'Skin Concern']].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${type === k ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`} data-testid={`lead-filter-${k}`}>
            {l} {data.counts[k] > 0 && <span className="opacity-80">({data.counts[k]})</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {data.leads.map(l => {
          const I = iconFor(l.type);
          return (
            <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3" data-testid={`lead-row-${l.id}`}>
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><I size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{l.name}</p>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">{l.type}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">{l.status}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  <span className="inline-flex items-center gap-1"><Phone size={10} />+91 {l.phone}</span>
                  {l.email && <span className="inline-flex items-center gap-1"><Mail size={10} />{l.email}</span>}
                  {l.investment_amount && <span>💰 ₹{l.investment_amount}</span>}
                  {l.concern && <span>🩺 {l.concern}</span>}
                  {l.business_name && <span>🏢 {l.business_name}</span>}
                </div>
                {l.message && <p className="text-xs text-gray-600 mt-1 italic">&quot;{l.message}&quot;</p>}
              </div>
              <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1" data-testid={`lead-status-${l.id}`}>
                {['new', 'contacted', 'qualified', 'converted', 'closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          );
        })}
        {data.leads.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No leads yet.</p>}
      </div>
    </div>
  );
}

function SalesTab({ auth }) {
  const [rows, setRows] = useState([]);
  const [creating, setCreating] = useState({ slug: '', title: '', discount_percent: 50 });
  const load = async () => { const r = await axios.get(`${API}/admin/sale-campaigns`, auth); setRows(r.data || []); };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const origin = window.location.origin;
  const create = async () => {
    if (!creating.slug || !creating.title) return alert('Slug and Title required');
    try { await axios.post(`${API}/admin/sale-campaigns`, { ...creating, is_active: true }, auth); setCreating({ slug: '', title: '', discount_percent: 50 }); load(); }
    catch (e) { alert(e?.response?.data?.detail || 'Create failed'); }
  };
  const del = async (slug) => { if (confirm(`Delete campaign "${slug}"?`)) { await axios.delete(`${API}/admin/sale-campaigns/${slug}`, auth); load(); } };
  const patch = async (r, upd) => { await axios.put(`${API}/admin/sale-campaigns/${r.slug}`, { ...r, ...upd }, auth); load(); };
  const copy = (t) => { navigator.clipboard.writeText(t); alert('Link copied!'); };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold mb-3 text-sm">Create a new sale campaign</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input placeholder="slug (flat-50)" value={creating.slug} onChange={e => setCreating({ ...creating, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input" data-testid="sale-slug-input" />
          <input placeholder="Title (e.g. Anti-Aging Kit)" value={creating.title} onChange={e => setCreating({ ...creating, title: e.target.value })} className="input" data-testid="sale-title-input" />
          <input type="number" min="1" max="95" placeholder="% off" value={creating.discount_percent} onChange={e => setCreating({ ...creating, discount_percent: Number(e.target.value) })} className="input" data-testid="sale-pct-input" />
          <button onClick={create} className="bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700" data-testid="sale-create-btn"><Plus size={15} className="inline mr-1" />Create</button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(r => {
          const url = `${origin}/sale/${r.slug}`;
          return (
            <div key={r.slug} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`sale-row-${r.slug}`}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-2xl font-black text-emerald-700">{r.discount_percent}%</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-gray-500">/sale/{r.slug}</p>
                </div>
                <label className="text-xs inline-flex items-center gap-1"><input type="checkbox" checked={r.is_active} onChange={e => patch(r, { is_active: e.target.checked })} />Active</label>
                <button onClick={() => del(r.slug)} className="text-xs text-red-600 hover:underline"><Trash2 size={11} className="inline" /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button onClick={() => copy(url)} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 font-mono" data-testid={`copy-link-${r.slug}`}><Copy size={11} /> Copy link</button>
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"><ExternalLink size={11} /> Preview</a>
                <span className="ml-auto text-gray-500">Orders: <b>{r.orders_count || 0}</b> · Revenue: <b>₹{Math.round(r.revenue || 0).toLocaleString('en-IN')}</b></span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Subtitle" defaultValue={r.subtitle || ''} onBlur={e => e.target.value !== (r.subtitle || '') && patch(r, { subtitle: e.target.value })} className="input" />
                <input placeholder="Trust line" defaultValue={r.trust_line || ''} onBlur={e => e.target.value !== (r.trust_line || '') && patch(r, { trust_line: e.target.value })} className="input" />
                <input placeholder="Featured slugs (comma-separated)" defaultValue={(r.featured_slugs || []).join(',')} onBlur={e => { const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean); if (arr.join(',') !== (r.featured_slugs || []).join(',')) patch(r, { featured_slugs: arr }); }} className="input sm:col-span-2" />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No campaigns yet.</p>}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}
