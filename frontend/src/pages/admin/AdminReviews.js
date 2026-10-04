import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Plus, Trash2, Sparkles, Star, BadgeCheck, Truck, ShieldCheck, Award, Headphones, Filter } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TAGS = [
  { id: 'product',  label: 'Product specialty', icon: Sparkles },
  { id: 'brand',    label: 'Brand',             icon: Award },
  { id: 'delivery', label: 'Delivery',          icon: Truck },
  { id: 'quality',  label: 'Quality',           icon: ShieldCheck },
  { id: 'service',  label: 'Customer service',  icon: Headphones },
];

const TAG_ICON = Object.fromEntries(TAGS.map(t => [t.id, t.icon]));

export default function AdminReviews() {
  const navigate = useNavigate();
  const adminToken = getAdminToken();
  const headers = { 'X-Admin-Token': adminToken };

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [genCount, setGenCount] = useState(20);
  const [genTag, setGenTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({ name: '', location: '', rating: 5, body: '', tag: 'product' });
  const [formErr, setFormErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', location: '', rating: 5, body: '' });
  const [aiBusy, setAiBusy] = useState(null); // review id currently being AI-checked
  const [aiSuggestions, setAiSuggestions] = useState({}); // { reviewId: { decision, reason, source } }

  const aiModerate = async (id) => {
    setAiBusy(id);
    try {
      const r = await axios.post(`${API}/admin/reviews/${id}/ai-moderate`, {}, { headers });
      setAiSuggestions((p) => ({ ...p, [id]: r.data }));
    } catch (e) {
      alert(e.response?.data?.detail || 'AI moderation failed');
    } finally {
      setAiBusy(null);
    }
  };

  useEffect(() => {
    if (!adminToken) navigate('/admin');
  }, [adminToken, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/reviews`, { headers });
      setReviews(r.data || []);
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load reviews');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const generate = async () => {
    setBusy(true); setErr('');
    try {
      const body = { count: Number(genCount) };
      if (genTag) body.tag = genTag;
      await axios.post(`${API}/admin/reviews/generate`, body, { headers });
      await load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Generation failed');
    }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await axios.delete(`${API}/admin/reviews/${id}`, { headers });
      setReviews(rs => rs.filter(r => r.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed');
    }
  };

  const moderate = async (id, patch) => {
    try {
      await axios.patch(`${API}/admin/reviews/${id}`, patch, { headers });
      setReviews(rs => rs.map(r => r.id === id ? { ...r, ...patch, moderated_at: new Date().toISOString() } : r));
    } catch (e) {
      alert(e.response?.data?.detail || 'Update failed');
    }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setEditForm({ name: r.name || '', location: r.location || '', rating: r.rating || 5, body: r.body || '' });
  };

  const saveEdit = async () => {
    if (!editForm.body.trim() || editForm.body.trim().length < 10) { alert('Review body must be at least 10 characters'); return; }
    await moderate(editId, { ...editForm, rating: Number(editForm.rating) });
    setEditId(null);
  };

  const setReply = async (id) => {
    const existing = reviews.find(r => r.id === id)?.reply || '';
    const reply = window.prompt('Admin reply (shown beneath the review). Leave empty to clear.', existing);
    if (reply === null) return;
    await moderate(id, { reply });
  };

  const wipeAll = async () => {
    if (!window.confirm('This will permanently delete every review. Continue?')) return;
    try {
      await axios.delete(`${API}/admin/reviews`, { headers });
      setReviews([]);
    } catch (e) {
      alert(e.response?.data?.detail || 'Wipe failed');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.name.trim() || form.name.trim().length < 2) return setFormErr('Name is required');
    if (!form.location.trim() || form.location.trim().length < 2) return setFormErr('Location is required');
    if (!form.body.trim() || form.body.trim().length < 10) return setFormErr('Review body must be at least 10 characters');
    try {
      await axios.post(`${API}/admin/reviews`, { ...form, rating: Number(form.rating) }, { headers });
      setForm({ name: '', location: '', rating: 5, body: '', tag: form.tag });
      await load();
    } catch (ex) {
      setFormErr(ex.response?.data?.detail || 'Save failed');
    }
  };

  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.tag === filter);
  const counts = TAGS.reduce((acc, t) => {
    acc[t.id] = reviews.filter(r => r.tag === t.id).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-stone-50" data-testid="admin-reviews-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/dashboard" className="p-2 hover:bg-white rounded-xl transition-colors" data-testid="reviews-back">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">Customer Reviews</h1>
            <p className="text-xs text-gray-500">Manage homepage / product / cart carousel content. {reviews.length} review{reviews.length === 1 ? '' : 's'} live.</p>
          </div>
        </div>

        {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{err}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: Add new review */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-heading text-lg font-black text-gray-900 mb-1">Add a review</h2>
            <p className="text-xs text-gray-500 mb-4">Hand-write a review or use the bulk generator on the right.</p>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Priya S."
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none"
                    data-testid="review-form-name" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">City</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Mumbai"
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none"
                    data-testid="review-form-location" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">Rating</label>
                  <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-green-200"
                    data-testid="review-form-rating">
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">Topic</label>
                  <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-green-200"
                    data-testid="review-form-tag">
                    {TAGS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Review body</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4}
                  placeholder="Share what made the customer's experience genuinely great…"
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none resize-none"
                  data-testid="review-form-body" />
                <p className="text-xs text-gray-400 mt-1">{form.body.length}/400 characters</p>
              </div>
              {formErr && <p className="text-xs text-red-600">{formErr}</p>}
              <button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white font-black py-3 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 transition-colors" data-testid="review-form-submit">
                <Plus size={16} /> Add review
              </button>
            </form>
          </div>

          {/* MIDDLE: Bulk generator */}
          <div className="bg-gradient-to-br from-amber-50 via-white to-green-50 rounded-2xl border border-amber-100 p-5">
            <h2 className="font-heading text-lg font-black text-gray-900 mb-1">Generate review batch</h2>
            <p className="text-xs text-gray-600 mb-4">
              Pulls from a curated bank of realistic Indian reviews covering product specialty, brand experience,
              delivery, quality and service. No AI, no credits — purely free.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">How many to add</label>
                <input type="number" min={1} max={60} value={genCount}
                  onChange={e => setGenCount(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-200"
                  data-testid="generate-count" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Focus topic (optional)</label>
                <select value={genTag} onChange={e => setGenTag(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-200"
                  data-testid="generate-tag">
                  <option value="">Mix of all topics</option>
                  {TAGS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <button onClick={generate} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-amber-950 font-black py-3 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 transition-colors" data-testid="generate-btn">
                <Sparkles size={16} /> {busy ? 'Generating…' : `Generate ${genCount} reviews`}
              </button>
              <button onClick={wipeAll} className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors" data-testid="wipe-all-btn">
                <Trash2 size={14} /> Wipe all reviews
              </button>
            </div>

            <div className="mt-5 pt-5 border-t border-amber-100">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.18em] mb-2">By topic</p>
              <div className="grid grid-cols-2 gap-2">
                {TAGS.map(t => {
                  const Icon = t.icon;
                  return (
                    <div key={t.id} className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5">
                      <Icon size={12} className="text-green-700" />
                      <span className="text-[11px] font-bold text-gray-700 flex-1 truncate">{t.label}</span>
                      <span className="text-[11px] text-gray-500">{counts[t.id] || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Filter widget */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-heading text-lg font-black text-gray-900 mb-1">Quick stats</h2>
            <p className="text-xs text-gray-500 mb-4">Live counts across the carousel.</p>
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-3 border border-green-100">
                <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-green-700">Total reviews</p>
                <p className="font-heading font-black text-3xl text-gray-900 leading-none mt-1">{reviews.length}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-3 border border-amber-100">
                <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-amber-700">Avg. rating</p>
                <p className="font-heading font-black text-3xl text-gray-900 leading-none mt-1">
                  {reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length).toFixed(2) : '—'}
                </p>
              </div>
              <div className="bg-gradient-to-br from-stone-50 to-white rounded-xl p-3 border border-stone-200">
                <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-stone-700">5-star reviews</p>
                <p className="font-heading font-black text-3xl text-gray-900 leading-none mt-1">{reviews.filter(r => r.rating === 5).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 p-5 border-b border-stone-100">
            <h2 className="font-heading text-lg font-black text-gray-900">All reviews</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-gray-400" />
              <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === 'all' ? 'bg-green-700 text-white' : 'bg-stone-100 text-gray-700 hover:bg-stone-200'}`} data-testid="filter-all">All ({reviews.length})</button>
              {TAGS.map(t => (
                <button key={t.id} onClick={() => setFilter(t.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === t.id ? 'bg-green-700 text-white' : 'bg-stone-100 text-gray-700 hover:bg-stone-200'}`} data-testid={`filter-${t.id}`}>
                  {t.label} ({counts[t.id] || 0})
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">Loading reviews…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">No reviews yet. Add one or generate a batch.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
              {filtered.map(r => {
                const Icon = TAG_ICON[r.tag] || Sparkles;
                const status = r.status || 'approved';
                const statusColor = status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                return (
                  <div key={r.id} className={`bg-stone-50/60 rounded-2xl border p-4 relative ${r.featured ? 'border-amber-300 ring-2 ring-amber-200' : 'border-stone-200'}`} data-testid={`admin-review-${r.id}`}>
                    {/* Status badge top-left + Delete top-right */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`} data-testid={`status-${r.id}`}>
                        {status}
                      </span>
                      <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" data-testid={`delete-review-${r.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(r.rating || 5)].map((_, k) => <Star key={k} size={11} className="fill-amber-400 text-amber-400" />)}
                    </div>
                    {editId === r.id ? (
                      /* Inline edit form */
                      <div className="space-y-2 mb-3" data-testid={`edit-form-${r.id}`}>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name"
                            className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-200" data-testid={`edit-name-${r.id}`} />
                          <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="City"
                            className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-200" data-testid={`edit-location-${r.id}`} />
                        </div>
                        <select value={editForm.rating} onChange={e => setEditForm({ ...editForm, rating: e.target.value })}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-green-200" data-testid={`edit-rating-${r.id}`}>
                          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                        </select>
                        <textarea value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} rows={3}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-200 resize-none" data-testid={`edit-body-${r.id}`} />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-2 rounded-lg text-xs" data-testid={`edit-save-${r.id}`}>Save</button>
                          <button onClick={() => setEditId(null)} className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold py-2 rounded-lg text-xs" data-testid={`edit-cancel-${r.id}`}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 leading-relaxed mb-3">"{r.body}"</p>
                    )}
                    {r.reply && (
                      <div className="mt-2 mb-3 p-2.5 bg-emerald-50 border-l-4 border-emerald-600 rounded">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-0.5">Brand reply</p>
                        <p className="text-xs text-emerald-900 leading-snug">{r.reply}</p>
                      </div>
                    )}
                    <div className="flex items-end justify-between text-xs">
                      <div>
                        <p className="font-black text-gray-900">{r.name}</p>
                        <p className="text-gray-500">{r.location}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-green-700">
                        <Icon size={11} />
                        <span>{(TAGS.find(x => x.id === r.tag) || {}).label || 'Customer'}</span>
                      </div>
                    </div>
                    {r.verified !== false && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-green-700">
                        <BadgeCheck size={11} /> Verified
                      </div>
                    )}
                    {/* Moderation actions */}
                    <div className="mt-3 pt-3 border-t border-stone-200 flex flex-wrap gap-1.5">
                      <button onClick={() => startEdit(r)} className="text-[10px] font-bold px-2 py-1 bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-md" data-testid={`edit-review-${r.id}`}>Edit</button>
                      {status !== 'approved' && (
                        <button onClick={() => moderate(r.id, { status: 'approved' })} className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md" data-testid={`approve-${r.id}`}>Approve</button>
                      )}
                      {status !== 'rejected' && (
                        <button onClick={() => moderate(r.id, { status: 'rejected' })} className="text-[10px] font-bold px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-md" data-testid={`reject-${r.id}`}>Reject</button>
                      )}
                      <button onClick={() => moderate(r.id, { featured: !r.featured })} className={`text-[10px] font-bold px-2 py-1 rounded-md ${r.featured ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`} data-testid={`feature-${r.id}`}>
                        {r.featured ? '★ Featured' : '☆ Feature'}
                      </button>
                      <button onClick={() => setReply(r.id)} className="text-[10px] font-bold px-2 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md" data-testid={`reply-${r.id}`}>
                        {r.reply ? 'Edit reply' : 'Add reply'}
                      </button>
                      <button
                        onClick={() => aiModerate(r.id)}
                        disabled={aiBusy === r.id}
                        className="text-[10px] font-bold px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md disabled:opacity-50 inline-flex items-center gap-1"
                        data-testid={`ai-mod-${r.id}`}
                        title="AI checks review for spam/profanity/authenticity"
                      >
                        {aiBusy === r.id ? '...' : '✨'} AI Check
                      </button>
                    </div>
                    {aiSuggestions[r.id] && (
                      <div className={`mt-2 text-[11px] rounded-md p-2 ${aiSuggestions[r.id].decision === 'approve' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : aiSuggestions[r.id].decision === 'reject' ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`} data-testid={`ai-suggest-${r.id}`}>
                        <span className="font-bold uppercase">AI: {aiSuggestions[r.id].decision}</span>
                        <span className="ml-1.5">{aiSuggestions[r.id].reason}</span>
                        <span className="ml-1 opacity-70">({aiSuggestions[r.id].source})</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
