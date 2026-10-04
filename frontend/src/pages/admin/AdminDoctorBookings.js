import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Stethoscope, Users, Settings, Search, Phone, Mail, Calendar,
  Upload, FileText, Trash2, X, Loader2, Save, Plus, ChevronRight, IndianRupee,
  CheckCircle2, Clock, Image as ImageIcon,
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-amber-100 text-amber-800' },
  { value: 'consulted', label: 'Consulted', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'closed', label: 'Closed', color: 'bg-purple-100 text-purple-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
];

const fmtDate = (s) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return s;
  }
};

function StatusPill({ value }) {
  const s = STATUS_OPTIONS.find((x) => x.value === value) || STATUS_OPTIONS[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      {value === 'new' && <Clock size={10} />}
      {value === 'consulted' && <CheckCircle2 size={10} />}
      {s.label}
    </span>
  );
}

export default function AdminDoctorBookings() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  const [tab, setTab] = useState('bookings'); // bookings | config
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [config, setConfig] = useState(null);

  const headers = useMemo(
    () => (adminToken ? { 'X-Admin-Token': adminToken } : {}),
    [adminToken],
  );

  const fetchBookings = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (q.trim()) params.set('q', q.trim());
      const r = await axios.get(`${API}/doctor-consultation/admin/bookings?${params}`, { headers });
      setBookings(r.data.bookings || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    if (!adminToken) return;
    try {
      const r = await axios.get(`${API}/doctor-consultation/admin/config`, { headers });
      setConfig(r.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetchBookings();
    fetchConfig();
  }, [authLoading, isAuthenticated, filterStatus]);

  // Search debounce
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(fetchBookings, 350);
    return () => clearTimeout(t);
  }, [q]);

  const refreshSelected = async (id) => {
    try {
      const r = await axios.get(`${API}/doctor-consultation/admin/bookings/${id}`, { headers });
      setSelected(r.data);
      setBookings((b) => b.map((x) => (x.id === id ? r.data : x)));
    } catch {/* ignore */}
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/admin/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-rose-600" />
                Doctor Consultations
              </h1>
              <p className="text-xs text-gray-500">Manage bookings, pricing and doctor profiles</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab('bookings')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'bookings' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-bookings"
            >
              <Users className="inline w-4 h-4 mr-1" />
              Bookings ({total})
            </button>
            <button
              onClick={() => setTab('config')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'config' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-config"
            >
              <Settings className="inline w-4 h-4 mr-1" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {tab === 'bookings' && (
        <div className="max-w-6xl mx-auto px-4 py-5">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, phone, booking ID"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                data-testid="bookings-search"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setFilterStatus(s.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                    filterStatus === s.value ? 'bg-rose-600 text-white' : `${s.color} hover:opacity-80`
                  }`}
                  data-testid={`filter-${s.value}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Stethoscope className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No bookings yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-rose-300 hover:shadow-md p-4 transition-all flex items-center gap-4"
                  data-testid={`booking-row-${b.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700 flex items-center justify-center font-semibold shrink-0">
                    {(b.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{b.name}</p>
                      <StatusPill value={b.status} />
                      {(b.files || []).length > 0 && (
                        <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          <FileText size={10} /> {b.files.length}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><Phone size={11} />+91 {b.phone}</span>
                      <span className="inline-flex items-center gap-1"><Mail size={11} />{b.email}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={11} />{fmtDate(b.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-rose-700">₹{b.amount}</div>
                    <ChevronRight size={16} className="text-gray-400 ml-auto mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && config && (
        <ConfigEditor
          config={config}
          headers={headers}
          onSaved={(c) => setConfig(c)}
        />
      )}

      {selected && (
        <BookingDrawer
          booking={selected}
          headers={headers}
          onClose={() => setSelected(null)}
          onRefresh={() => refreshSelected(selected.id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config editor — price, doctors, reviews, copy
// ---------------------------------------------------------------------------
function ConfigEditor({ config, headers, onSaved }) {
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        price: Number(draft.price),
        title: draft.title,
        subtitle: draft.subtitle,
        promise: draft.promise,
        disclaimer: draft.disclaimer,
        doctors: draft.doctors,
        reviews: draft.reviews,
      };
      const r = await axios.put(`${API}/doctor-consultation/admin/config`, payload, { headers });
      onSaved(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateDoctor = (i, patch) =>
    setDraft({ ...draft, doctors: draft.doctors.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const removeDoctor = (i) =>
    setDraft({ ...draft, doctors: draft.doctors.filter((_, idx) => idx !== i) });
  const addDoctor = () =>
    setDraft({
      ...draft,
      doctors: [
        ...(draft.doctors || []),
        { id: `doc-${Date.now()}`, name: '', qualification: '', experience_years: 1, specialty: '', bio: '', photo: '' },
      ],
    });

  const updateReview = (i, patch) =>
    setDraft({ ...draft, reviews: draft.reviews.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const removeReview = (i) =>
    setDraft({ ...draft, reviews: draft.reviews.filter((_, idx) => idx !== i) });
  const addReview = () =>
    setDraft({
      ...draft,
      reviews: [
        ...(draft.reviews || []),
        { id: `r-${Date.now()}`, name: '', city: '', rating: 5, text: '' },
      ],
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
      {/* Pricing & copy */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-rose-600" /> Pricing & Page Copy
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Consultation price (₹)">
            <input
              type="number"
              min="1"
              value={draft.price ?? 999}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              className="input"
              data-testid="cfg-price-input"
            />
          </Field>
          <Field label="Page title">
            <input
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="input"
              data-testid="cfg-title-input"
            />
          </Field>
          <Field label="Subtitle" full>
            <input
              value={draft.subtitle || ''}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Promise line" full>
            <input
              value={draft.promise || ''}
              onChange={(e) => setDraft({ ...draft, promise: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Disclaimer (medicine cost not included, etc.)" full>
            <textarea
              value={draft.disclaimer || ''}
              onChange={(e) => setDraft({ ...draft, disclaimer: e.target.value })}
              rows={2}
              className="input resize-none"
            />
          </Field>
        </div>
      </div>

      {/* Doctors */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-rose-600" /> Expert Doctors
          </h3>
          <button
            onClick={addDoctor}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full font-semibold hover:bg-rose-200"
            data-testid="add-doctor-btn"
          >
            <Plus size={14} /> Add doctor
          </button>
        </div>
        <div className="space-y-3">
          {(draft.doctors || []).map((d, i) => (
            <div key={d.id || i} className="border border-gray-100 rounded-xl p-3 bg-rose-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input value={d.name || ''} onChange={(e) => updateDoctor(i, { name: e.target.value })} placeholder="Name" className="input" />
                <input value={d.qualification || ''} onChange={(e) => updateDoctor(i, { qualification: e.target.value })} placeholder="Qualification (MD, MBBS, etc.)" className="input" />
                <input type="number" min="0" value={d.experience_years ?? 1} onChange={(e) => updateDoctor(i, { experience_years: Number(e.target.value) })} placeholder="Experience years" className="input" />
                <input value={d.specialty || ''} onChange={(e) => updateDoctor(i, { specialty: e.target.value })} placeholder="Specialty" className="input" />
                <input value={d.photo || ''} onChange={(e) => updateDoctor(i, { photo: e.target.value })} placeholder="Photo URL (optional)" className="input sm:col-span-2" />
                <textarea value={d.bio || ''} onChange={(e) => updateDoctor(i, { bio: e.target.value })} placeholder="Short bio" rows={2} className="input sm:col-span-2 resize-none" />
              </div>
              <button onClick={() => removeDoctor(i)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Patient Reviews</h3>
          <button
            onClick={addReview}
            className="text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full font-semibold hover:bg-rose-200"
            data-testid="add-review-btn"
          >
            <Plus size={14} /> Add review
          </button>
        </div>
        <div className="space-y-3">
          {(draft.reviews || []).map((r, i) => (
            <div key={r.id || i} className="border border-gray-100 rounded-xl p-3 bg-amber-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <input value={r.name || ''} onChange={(e) => updateReview(i, { name: e.target.value })} placeholder="Patient name" className="input" />
                <input value={r.city || ''} onChange={(e) => updateReview(i, { city: e.target.value })} placeholder="City" className="input" />
                <input type="number" min="1" max="5" value={r.rating ?? 5} onChange={(e) => updateReview(i, { rating: Number(e.target.value) })} placeholder="Rating (1-5)" className="input" />
                <textarea value={r.text || ''} onChange={(e) => updateReview(i, { text: e.target.value })} placeholder="Review text" rows={2} className="input sm:col-span-3 resize-none" />
              </div>
              <button onClick={() => removeReview(i)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-full font-semibold shadow-lg disabled:opacity-70 flex items-center gap-2"
          data-testid="save-config-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>

      <style>{`.input{width:100%;padding:0.6rem 0.85rem;border:1px solid #e5e7eb;border-radius:0.65rem;font-size:0.875rem;outline:none}.input:focus{border-color:#fb7185;box-shadow:0 0 0 3px rgba(251,113,133,0.18)}`}</style>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Booking detail drawer with uploads
// ---------------------------------------------------------------------------
function BookingDrawer({ booking, headers, onClose, onRefresh }) {
  const [status, setStatus] = useState(booking.status || 'new');
  const [notes, setNotes] = useState(booking.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState(null);

  const files = booking.files || [];

  const patch = async (body) => {
    setSaving(true);
    try {
      await axios.patch(`${API}/doctor-consultation/admin/bookings/${booking.id}`, body, { headers });
      await onRefresh();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (kind, file) => {
    if (!file) return;
    setUploadingKind(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      await axios.post(`${API}/doctor-consultation/admin/bookings/${booking.id}/files`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      await onRefresh();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingKind(null);
    }
  };

  const removeFile = async (fid) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/doctor-consultation/admin/bookings/${booking.id}/files/${fid}`, { headers });
      await onRefresh();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Delete failed');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full sm:max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="booking-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-rose-600 to-pink-600 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-100">Booking</p>
            <p className="font-semibold">{booking.name}</p>
            <p className="text-[10px] text-rose-100 font-mono mt-0.5">{booking.id}</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info icon={Phone} label="Phone" value={`+91 ${booking.phone}`} />
            <Info icon={Mail} label="Email" value={booking.email} />
            <Info icon={IndianRupee} label="Paid" value={`₹${booking.amount}`} />
            <Info icon={Calendar} label="Booked" value={fmtDate(booking.created_at)} />
          </div>

          {booking.notes && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1 uppercase tracking-wider">
                Customer notes
              </p>
              <p className="text-sm text-gray-700">{booking.notes}</p>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setStatus(s.value); patch({ status: s.value }); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    status === s.value ? 'bg-rose-600 text-white' : `${s.color} hover:opacity-80`
                  }`}
                  data-testid={`set-status-${s.value}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Admin notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (booking.admin_notes || '') && patch({ admin_notes: notes })}
              rows={3}
              placeholder="Doctor's instructions, follow-up details, internal remarks…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none"
              data-testid="admin-notes-input"
            />
            {saving && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={12} /> Patient photos
              </p>
              <UploadBtn
                kind="photo"
                accept="image/*"
                onChange={(f) => onFile('photo', f)}
                loading={uploadingKind === 'photo'}
                testid="upload-photo-btn"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {files.filter((f) => f.kind === 'photo').map((f) => (
                <FileTile key={f.file_id} f={f} onRemove={() => removeFile(f.file_id)} />
              ))}
              {files.filter((f) => f.kind === 'photo').length === 0 && (
                <p className="text-xs text-gray-400 col-span-3">No photos uploaded yet.</p>
              )}
            </div>
          </div>

          {/* Reports */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} /> Consultation reports (PDF)
              </p>
              <UploadBtn
                kind="report"
                accept="application/pdf"
                onChange={(f) => onFile('report', f)}
                loading={uploadingKind === 'report'}
                testid="upload-report-btn"
              />
            </div>
            <div className="space-y-2">
              {files.filter((f) => f.kind === 'report').map((f) => (
                <a
                  key={f.file_id}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors"
                  data-testid={`report-${f.file_id}`}
                >
                  <FileText className="w-5 h-5 text-purple-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.name || 'Report.pdf'}</p>
                    <p className="text-xs text-gray-500">{fmtDate(f.uploaded_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); removeFile(f.file_id); }}
                    className="p-1.5 rounded-full hover:bg-red-100 text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </a>
              ))}
              {files.filter((f) => f.kind === 'report').length === 0 && (
                <p className="text-xs text-gray-400">No reports uploaded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
        <Icon size={10} /> {label}
      </p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}

function FileTile({ f, onRemove }) {
  return (
    <div className="relative group">
      <a href={f.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={f.url}
          alt={f.name}
          className="w-full aspect-square object-cover rounded-xl border border-gray-200"
          loading="lazy"
        />
      </a>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function UploadBtn({ kind, accept, onChange, loading, testid }) {
  const id = `upload-${kind}-${Math.random().toString(36).slice(2)}`;
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold cursor-pointer hover:bg-rose-200"
      data-testid={testid}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
      Upload
      <input
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}
