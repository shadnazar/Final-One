/**
 * AdminTrackers — viewer for customer AI Skin Progress Trackers.
 * Lists every enrolled customer with plan/status + log counts, and a detail
 * drawer showing their full photo timeline, notes and AI suggestions.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles, Camera, Crown, Gift, TrendingUp } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTrackers() {
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const token = getAdminToken();
  const headers = { 'X-Admin-Token': token };

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/trackers`, { headers });
      setTrackers(r.data.trackers || []);
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };

  const openDetail = async (email) => {
    setDetailLoading(true); setDetail({ email });
    try {
      const r = await axios.get(`${API}/admin/trackers/${encodeURIComponent(email)}`, { headers });
      setDetail(r.data);
    } catch (e) { setDetail(null); } finally { setDetailLoading(false); }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const planBadge = (t) => {
    if (t.plan === 'free') return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"><Gift size={11} />FREE</span>;
    if (t.plan === 'paid') return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Crown size={11} />PAID</span>;
    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">PENDING</span>;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate('/admin/dashboard')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900">
            <ArrowLeft size={16} /> Dashboard
          </button>
          <button onClick={fetchData} className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-900">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <h1 className="font-heading text-2xl font-black text-stone-900 flex items-center gap-2 mb-1">
          <Sparkles size={22} className="text-emerald-600" /> AI Skin Trackers
        </h1>
        <p className="text-sm text-stone-500 mb-5">{trackers.length} enrolled customer{trackers.length !== 1 ? 's' : ''}</p>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : trackers.length === 0 ? (
          <p className="text-sm text-stone-400">No trackers yet.</p>
        ) : (
          <div className="grid gap-3">
            {trackers.map((t) => (
              <button key={t.email} onClick={() => openDetail(t.email)} data-testid={`tracker-row-${t.email}`}
                className="text-left bg-white rounded-2xl ring-1 ring-stone-200 hover:ring-emerald-300 p-4 transition-colors flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-stone-900 truncate">{t.email}</p>
                    {planBadge(t)}
                    {t.has_access ? <span className="text-[10px] font-bold text-emerald-600">ACTIVE</span> : <span className="text-[10px] font-bold text-rose-500">EXPIRED</span>}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {t.skin_type || '—'} skin · {(t.concerns || []).join(', ') || 'no concerns'} · {t.days_left} days left
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-stone-900 flex items-center gap-1 justify-end"><Camera size={15} className="text-stone-400" />{t.logs_count}</p>
                  <p className="text-[10px] text-stone-400">logs</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg bg-stone-50 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <p className="font-black text-stone-900 truncate">{detail.email}</p>
                {detail.tracker && <p className="text-xs text-stone-500">{detail.tracker.plan} · {detail.tracker.days_left} days left</p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-sm font-bold text-stone-500 hover:text-stone-900">Close</button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? (
                <p className="text-sm text-stone-400">Loading…</p>
              ) : detail.tracker ? (
                <>
                  <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-4 text-sm grid grid-cols-2 gap-2">
                    <Info k="Skin type" v={detail.tracker.skin_type} />
                    <Info k="Age" v={detail.tracker.age} />
                    <Info k="Concerns" v={(detail.tracker.concerns || []).join(', ')} />
                    <Info k="Baseline score" v={detail.tracker.baseline_score} />
                    <Info k="Status" v={detail.tracker.status} />
                    <Info k="Subscription" v={detail.tracker.subscription_status || '—'} />
                  </div>
                  <h3 className="font-black text-stone-900 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600" /> Progress timeline ({(detail.logs || []).length})</h3>
                  {(detail.logs || []).length === 0 && <p className="text-sm text-stone-400">No logs yet.</p>}
                  {(detail.logs || []).map((l) => (
                    <div key={l.id} className="bg-white rounded-2xl ring-1 ring-stone-200 p-3 flex gap-3">
                      {l.photo_url ? (
                        <a href={l.photo_url} target="_blank" rel="noreferrer">
                          <img src={l.photo_url} alt={`Day ${l.day_number}`} className="w-20 h-20 object-cover rounded-xl ring-1 ring-stone-200 shrink-0" />
                        </a>
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-stone-100 grid place-items-center shrink-0 text-stone-300"><Camera size={18} /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-stone-900">Day {l.day_number}</span>
                          <span className="text-[10px] text-stone-400">{l.date}</span>
                          {l.ai_trend && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{l.ai_trend}</span>}
                        </div>
                        {l.notes && <p className="text-xs text-stone-600 mt-1">{l.notes}</p>}
                        {l.ai_suggestion && <p className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-2 py-1.5 mt-1.5">{l.ai_suggestion}</p>}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-rose-500">Could not load tracker.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ k, v }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{k}</p>
      <p className="font-semibold text-stone-900 capitalize">{v || '—'}</p>
    </div>
  );
}
