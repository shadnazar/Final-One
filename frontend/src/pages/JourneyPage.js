import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Sparkles, Loader2, Check, Camera, ArrowRight, Trophy, Lock, ShieldCheck,
  Flame, Upload, TrendingUp, Gift, CheckCircle2,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function compressImage(file, { maxWidth = 720, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function ScoreRing({ score = 60, size = 84 }) {
  const r = 32, c = 2 * Math.PI * r, off = c - (score / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e7f2ec" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#059669" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-stone-900 leading-none">{score}</span>
        <span className="text-[9px] text-stone-400 font-semibold">/100</span>
      </div>
    </div>
  );
}

export function JourneyView({ jid, onNewJourney }) {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [doneIds, setDoneIds] = useState([]);
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsPay, setNeedsPay] = useState(false);
  const [payPrice, setPayPrice] = useState(499);
  const [paying, setPaying] = useState(false);
  const [report, setReport] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/journey/${jid}`);
      setJourney(r.data);
      if (r.data?.report) setReport(r.data.report);
      if (r.data?.status === 'locked') { setNeedsPay(true); }
    } catch (e) {
      setErr('Journey not found. Please start a new one from the Routine page.');
    } finally { setLoading(false); }
  }, [jid]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;
  }
  if (err || !journey) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-stone-600">{err}</p>
        <Link to="/routine" className="bg-emerald-700 text-white px-5 py-2.5 rounded-full font-bold text-sm">Start a Journey</Link>
      </div>
    );
  }

  const total = journey.total_days || 30;
  const days = journey.days || {};
  const completedCount = Object.values(days).filter((d) => d.submitted).length;
  const progressPct = Math.round((completedCount / total) * 100);
  const curDay = journey.current_day;
  const cur = days[String(curDay)];
  const curSubmitted = cur?.submitted;

  const toggleTask = (id) => setDoneIds((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const pickProof = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setProof(await compressImage(f)); } catch { alert('Could not read that image.'); }
  };

  const submitDay = async () => {
    if (!proof) { alert('Please upload today\'s proof photo with your face to complete the day.'); return; }
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/api/journey/${jid}/day/${curDay}/submit`, {
        proof, completed: doneIds,
      });
      setProof(null); setDoneIds([]);
      if (r.data?.journey) setJourney(r.data.journey);
      if (r.data?.completed_journey && r.data?.report) {
        setReport(r.data.report);
      } else if (r.data?.needs_payment) {
        setNeedsPay(true);
        setPayPrice(r.data.subscription_price || 499);
      }
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not submit today. Please try again.');
    } finally { setSubmitting(false); }
  };

  const startPayment = async () => {
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { alert('Could not load payment. Check your connection.'); setPaying(false); return; }
      const r = await axios.post(`${API}/api/journey/${jid}/subscribe`);
      const { order, key_id } = r.data;
      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Celesta Glow',
        description: 'Skin Journey — next 30 days (auto-pay)',
        order_id: order.id,
        theme: { color: '#047857' },
        handler: async (resp) => {
          try {
            const v = await axios.post(`${API}/api/journey/${jid}/subscribe/verify`, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (v.data?.journey) { setJourney(v.data.journey); setNeedsPay(false); }
          } catch { alert('Payment captured but activation failed — contact support.'); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not start payment.');
    } finally { setPaying(false); }
  };

  // ---------- Day 30 completed report ----------
  if (report) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide mb-3"><Trophy size={13} /> 30-Day Journey Complete</div>
          <h1 className="font-heading text-3xl font-black text-stone-900">Your Glow-Up Report</h1>
          <p className="text-stone-500 mt-1 text-sm">{report.summary}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[{ label: 'Day 1', img: report.before_photo }, { label: 'Day 30', img: report.after_photo }].map((b) => (
            <div key={b.label} className="relative rounded-2xl overflow-hidden aspect-square bg-stone-100 ring-1 ring-stone-200">
              <img src={`${API}${b.img}`} alt={b.label} className="w-full h-full object-cover" />
              <span className="absolute left-2 bottom-2 text-white text-xs font-bold bg-black/40 rounded px-2 py-0.5">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 bg-white rounded-2xl ring-1 ring-stone-200 p-5 mb-5">
          <div className="text-center"><ScoreRing score={report.start_score} size={72} /><p className="text-[11px] text-stone-500 mt-1 font-semibold">Day 1</p></div>
          <ArrowRight className="text-emerald-500" />
          <div className="text-center"><ScoreRing score={report.final_score} size={72} /><p className="text-[11px] text-stone-500 mt-1 font-semibold">Day 30</p></div>
          <div className="text-center pl-2">
            <div className="inline-flex items-center gap-1 text-emerald-600 font-black text-2xl"><TrendingUp size={20} /> +{report.improvement_percent}%</div>
            <p className="text-[11px] text-stone-500 font-semibold">Improvement</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-5 mb-5">
          <p className="text-[11px] font-black uppercase tracking-wide text-stone-400 mb-3">Your Wins</p>
          <ul className="space-y-2">
            {(report.wins || []).map((w, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-stone-700"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> {w}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-emerald-700 to-emerald-900 text-white">
          <Gift className="mx-auto mb-2 text-amber-300" />
          <h3 className="font-heading text-xl font-black">Keep the momentum going</h3>
          <p className="text-emerald-100 text-sm mt-1 mb-4">Your results are just beginning. Continue your journey with the next 30 days of AI-personalised care.</p>
          <button onClick={startPayment} disabled={paying} className="bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 font-black px-6 py-3 rounded-full text-sm inline-flex items-center gap-2">
            {paying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Continue · ₹{payPrice}/month auto-pay
          </button>
        </div>
      </div>
    );
  }

  // ---------- Payment gate for next 30 days ----------
  if (needsPay) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-xl p-7 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4"><Lock className="text-amber-600" /></div>
          <h1 className="font-heading text-2xl font-black text-stone-900">Your free 30 days are complete! 🎉</h1>
          <p className="text-stone-500 text-sm mt-2">You've built an incredible habit. Unlock the next 30 days of daily AI-personalised tasks and keep your glow-up going.</p>
          <div className="my-5 flex items-end justify-center gap-1">
            <span className="text-4xl font-black text-emerald-700">₹{payPrice}</span>
            <span className="text-stone-400 font-semibold mb-1">/month</span>
          </div>
          <ul className="text-left text-sm text-stone-600 space-y-2 mb-5">
            {['New AI tasks every day', 'Daily progress tracking', 'Auto-pay — never lose a streak', 'Cancel anytime'].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> {f}</li>
            ))}
          </ul>
          <button onClick={startPayment} disabled={paying} className="w-full bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 font-black py-3.5 rounded-full text-sm inline-flex items-center justify-center gap-2">
            {paying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Enable Auto-Pay & Continue
          </button>
          <p className="text-[11px] text-stone-400 mt-3">Secured by Razorpay · Your streak resumes instantly</p>
        </div>
      </div>
    );
  }

  // ---------- Active journey ----------
  const allTasksDone = cur?.tasks?.every((t) => doneIds.includes(t.id));
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm p-4 flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 ring-1 ring-stone-200 shrink-0">
          <img src={`${API}${journey.before_photo}`} alt="Your Day 1" className="w-full h-full object-cover" />
          <span className="absolute left-0 bottom-0 right-0 text-[8px] font-bold text-white bg-black/50 text-center">Day 1</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {(journey.goals || []).map((g) => (
              <span key={g} className="text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{g}</span>
            ))}
          </div>
          <p className="text-[12px] text-stone-500">{journey.analysis?.summary}</p>
        </div>
        <ScoreRing score={journey.analysis?.skin_score || 60} />
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-black text-stone-800 flex items-center gap-1.5"><Flame size={14} className="text-amber-500" /> Day {curDay} of {total}</span>
          <span className="text-[12px] font-black text-emerald-600">{progressPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-[11px] text-stone-400 mt-2">{completedCount} days completed · {total - completedCount} to your goal. Keep going — consistency is everything! 💪</p>
      </div>

      {/* Product ad (some days) */}
      {cur?.ad && (
        <Link to={`/product/${cur.ad.slug}`} className="block bg-gradient-to-r from-emerald-50 to-amber-50 rounded-2xl ring-1 ring-emerald-100 p-3 mb-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          {cur.ad.image && <img src={cur.ad.image} alt={cur.ad.name} className="w-14 h-14 rounded-xl object-cover bg-white shrink-0" />}
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-amber-600">Celesta Glow · New for you</span>
            <p className="text-[13px] font-black text-stone-900 truncate">{cur.ad.name}</p>
            <p className="text-[11px] text-stone-500 truncate">{cur.ad.benefit}</p>
          </div>
          <ArrowRight size={16} className="text-emerald-600 shrink-0" />
        </Link>
      )}

      {/* Today's tasks */}
      <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-black text-stone-900">Day {curDay} Tasks</h2>
          {curSubmitted && <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={14} /> Done</span>}
        </div>
        {cur?.ai_note && <p className="text-[12px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{cur.ai_note}</p>}
        <div className="space-y-2.5">
          {(cur?.tasks || []).map((t) => {
            const done = curSubmitted || doneIds.includes(t.id);
            return (
              <button key={t.id} disabled={curSubmitted} onClick={() => toggleTask(t.id)}
                className={`w-full text-left flex items-start gap-3 rounded-2xl p-3 ring-1 transition-all ${done ? 'bg-emerald-50 ring-emerald-200' : 'bg-stone-50 ring-stone-200 hover:ring-emerald-300'}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-white ring-1 ring-stone-300'}`}>
                  {done && <Check size={12} />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-stone-900">{t.title}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-600">{t.time}</span>
                  {t.desc && <p className="text-[12px] text-stone-500 leading-snug mt-0.5">{t.desc}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Proof + submit */}
      {!curSubmitted && (
        <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm p-5">
          <p className="text-[13px] font-black text-stone-900 mb-1">Upload today's proof selfie</p>
          <p className="text-[11px] text-stone-500 mb-3">Your face must be clearly visible — it unlocks tomorrow's AI plan and tracks your progress.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={pickProof} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-stone-300 rounded-2xl p-4 flex flex-col items-center gap-1.5 text-stone-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors mb-3">
            {proof ? <img src={proof} alt="proof" className="w-24 h-24 rounded-xl object-cover" /> : <><Camera size={26} /><span className="text-[12px] font-bold">Tap to add your proof photo</span></>}
          </button>
          <button onClick={submitDay} disabled={submitting || !proof}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-black py-3.5 rounded-full text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting to AI…</> : <><Upload size={16} /> {curDay >= total ? 'Finish & See My Results' : `Complete Day ${curDay} & Unlock Day ${curDay + 1}`}</>}
          </button>
        </div>
      )}
      {curSubmitted && (
        <div className="text-center text-sm text-stone-500 py-4">Day {curDay} submitted. Your next day is being prepared ✨</div>
      )}
    </div>
  );
}

export default function JourneyPage() {
  const { jid } = useParams();
  return <JourneyView jid={jid} />;
}
