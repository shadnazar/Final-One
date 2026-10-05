import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Sparkles, Camera, Loader2, Mail, KeyRound, ArrowLeft, TrendingUp, Package,
  LogOut, Upload, Check, Leaf, Ban, Sun, Moon, ChevronRight, Star, CalendarDays,
  User, ClipboardList, ShoppingBag, Gift, ArrowRight, Apple, Droplets,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'cg_auth_token';
const USER_KEY = 'cg_auth_user';

const authHeader = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ----------------------------------------------------------------- LOGIN GATE */
function LoginGate({ onLogin }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/api/auth/send-otp`, { email: email.trim().toLowerCase() });
      setMsg(r.data.message || 'Code sent to your email.');
      setStep('otp');
    } catch (e2) {
      setError(e2.response?.data?.detail || 'Could not send code. Try again.');
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/api/auth/verify-otp`, { email: email.trim().toLowerCase(), otp: otp.trim() });
      try {
        localStorage.setItem(TOKEN_KEY, r.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(r.data.user));
      } catch {}
      onLogin(r.data.token, r.data.user);
    } catch (e2) {
      setError(e2.response?.data?.detail || 'Invalid code. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 mt-10">
      <div className="bg-white rounded-3xl border border-stone-100 shadow-xl shadow-stone-200/50 p-7">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="text-emerald-600" size={26} />
        </div>
        <h1 className="text-xl font-black text-stone-900 text-center">Your Glow Dashboard</h1>
        <p className="text-sm text-stone-500 text-center mt-1 mb-6">
          Login with your email to access your skin scan, daily routine, progress & orders.
        </p>
        {step === 'email' ? (
          <form onSubmit={sendOtp} className="space-y-3">
            <div className="flex items-center gap-2 border border-stone-200 rounded-xl px-3 py-3 focus-within:ring-2 ring-emerald-500">
              <Mail size={18} className="text-stone-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com" data-testid="tracker-login-email"
                className="flex-1 outline-none text-sm bg-transparent" />
            </div>
            <button disabled={loading} data-testid="tracker-send-otp"
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Send login code
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-3">
            {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
            <input type="text" inputMode="numeric" required value={otp} maxLength={6}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code" data-testid="tracker-otp-input"
              className="w-full border border-stone-200 rounded-xl px-3 py-3 outline-none text-center text-lg tracking-[0.4em] font-bold focus:ring-2 ring-emerald-500" />
            <button disabled={loading} data-testid="tracker-verify-otp"
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Verify & continue
            </button>
            <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              className="w-full text-xs text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1 pt-1">
              <ArrowLeft size={13} /> Use a different email
            </button>
          </form>
        )}
        {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
        <p className="text-[11px] text-stone-400 text-center mt-5 flex items-center justify-center gap-1">
          <Gift size={12} className="text-emerald-500" /> FREE for 1 month — no payment needed to start.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- SCORE RING */
function ScoreRing({ score = 0, size = 96 }) {
  const r = 34, c = 2 * Math.PI * r, off = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e7f2ec" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#059669" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-stone-900 leading-none">{score}</span>
        <span className="text-[10px] text-stone-400 font-semibold">/100</span>
      </div>
    </div>
  );
}

const SCORE_LABELS = {
  pores: 'Pores', acne: 'Acne', dark_spots: 'Dark Spots',
  even_tone: 'Even Tone', fine_lines: 'Fine Lines', hydration: 'Hydration',
};

/* ------------------------------------------------- SKIN ANALYSIS VISUAL */
// Owner-supplied before/after close-up, stored permanently on Cloudinary and
// delivered as WebP (f_webp) at a capped width so it loads fast on mobile.
const SKIN_ANALYSIS_IMG =
  'https://res.cloudinary.com/dcvuqcqjn/image/upload/f_webp,q_auto:good,w_900/celesta-glow/brand/skin-analysis-before-after';

function SkinAnalysisVisual() {
  return (
    <figure className="mt-4" data-testid="skin-analysis-visual">
      <img
        src={SKIN_ANALYSIS_IMG}
        alt="Before and after skin analysis close-up showing acne and texture improvement"
        width="900"
        height="900"
        loading="lazy"
        decoding="async"
        className="w-full rounded-2xl border border-stone-100 bg-stone-50"
      />
      <figcaption className="text-[11px] text-stone-400 mt-2 text-center">
        Real comparison — acne, texture &amp; tone improvement our AI tracks for you
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------------- REPORT VIEW */
function ReportView({ report, onStartRoutine }) {
  if (!report) return null;
  const scores = report.scores || {};
  const Routine = ({ title, icon: Icon, steps }) => (
    <div className="bg-white rounded-2xl border border-stone-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-emerald-600" />
        <span className="text-sm font-black text-stone-900">{title}</span>
      </div>
      <ol className="space-y-2.5">
        {(steps || []).map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
            <div>
              <p className="text-[13px] font-bold text-stone-800">{s.step}{s.product ? <span className="font-medium text-emerald-700"> · {s.product}</span> : null}</p>
              {s.how && <p className="text-[12px] text-stone-500">{s.how}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
  const Bullets = ({ title, icon: Icon, items, tone }) => (
    <div className="bg-white rounded-2xl border border-stone-100 p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={16} className={tone === 'bad' ? 'text-rose-500' : 'text-emerald-600'} />
        <span className="text-sm font-black text-stone-900">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {(items || []).map((t, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-stone-700">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${tone === 'bad' ? 'bg-rose-400' : 'bg-emerald-500'}`} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* score + summary */}
      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-4 flex gap-4 items-center">
        <ScoreRing score={report.skin_score || 0} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Your Skin Score</p>
          <p className="text-sm text-stone-700 leading-snug">{report.summary || report.personalized_tip}</p>
        </div>
      </div>
      {/* scores grid */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <p className="text-sm font-black text-stone-900 mb-3">Skin Analysis</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
          {Object.entries(scores).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-stone-600">{SCORE_LABELS[k] || k}</span>
                <span className="font-bold text-stone-800">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Owner-requested before/after visual, directly below Skin Analysis */}
        <SkinAnalysisVisual />
      </div>
      {/* routine */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Routine title="Morning Routine" icon={Sun} steps={report.am_routine} />
        <Routine title="Night Routine" icon={Moon} steps={report.pm_routine} />
      </div>
      {/* diet + control */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Bullets title="Diet to glow" icon={Leaf} items={report.diet} />
        <Bullets title="What to control / avoid" icon={Ban} items={report.control} tone="bad" />
      </div>
      {report.weekly?.length ? <Bullets title="Weekly treatments" icon={Star} items={report.weekly} /> : null}
      {/* recommended products */}
      {report.recommended_products?.length ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <p className="text-sm font-black text-stone-900 mb-3">Recommended for your skin</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.recommended_products.map((p) => (
              <Link to={p.slug ? `/product/${p.slug}` : '/shop'} key={p.slug || p.name} className="group">
                <div className="rounded-xl bg-stone-50 border border-stone-100 aspect-square flex items-center justify-center overflow-hidden">
                  {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform" />
                    : <ShoppingBag size={24} className="text-stone-300" />}
                </div>
                <p className="text-[12px] font-bold text-stone-800 mt-1 truncate">{p.name}</p>
                {p.price ? <p className="text-[11px] text-emerald-700 font-bold">₹{p.price}</p> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- SCAN PANEL */
const PLAN_GOALS = [
  'Clear Acne', 'Fade Dark Spots', 'Brighten & Glow', 'Reduce Fine Lines',
  'Even Skin Tone', 'Hydrate & Repair', 'Control Oil', 'Shrink Pores',
];
const PLAN_GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];
const PLAN_AGES = ['18–24', '25–34', '35–44', '45+'];
const PLAN_SKIN_TYPES = ['normal', 'dry', 'oily', 'combination', 'sensitive'];

/**
 * ScanPanel — the scanning page. This is the ONLY place the 30-day plan
 * details are collected: photo, goals, gender, age and skin type, all behind
 * the OTP login. Submitting runs the AI scan, starts + saves the plan, then
 * hands control to the Progress page where the routine runs.
 */
function ScanPanel({ token, onScanned, latest, onPlanStarted }) {
  const [preview, setPreview] = useState(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(latest || null);
  const [goals, setGoals] = useState([]);
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState('25–34');
  const [skinType, setSkinType] = useState('combination');
  const fileRef = useRef(null);

  const toggleGoal = (g) => setGoals((prev) => {
    if (prev.includes(g)) return prev.filter((x) => x !== g);
    if (prev.length >= 2) return [prev[1], g];
    return [...prev, g];
  });

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    const url = await fileToDataUrl(f);
    setPreview(URL.createObjectURL(f));
    setDataUrl(url);
  };

  const scan = async () => {
    if (!dataUrl) { setError('A photo is required to build your routine.'); return; }
    if (!goals.length) { setError('Pick at least one goal for your 30-day plan.'); return; }
    setLoading(true); setError('');
    try {
      const r = await axios.post(`${API}/api/tracker/scan`, {
        photo_base64: dataUrl,
        goals, gender, age, skin_type: skinType,
        start_plan: true,
      }, authHeader(token));
      setReport(r.data.report);
      onScanned?.(r.data.report);
      // Routine has started and is saved — move to the progress page.
      onPlanStarted?.(r.data.plan || null);
    } catch (e2) {
      setError(e2.response?.data?.detail || 'Scan failed. Please try a clearer selfie.');
    } finally { setLoading(false); }
  };

  const Chips = ({ label, options, value, onPick, testid, multi = false }) => (
    <div className="mt-4">
      <p className="text-[10px] font-black tracking-[0.22em] uppercase text-stone-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          const active = multi ? value.includes(val) : value === val;
          return (
            <button key={val} type="button" onClick={() => onPick(val)}
              data-testid={`${testid}-${String(val).toLowerCase().replace(/\s+/g, '-')}`}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all flex items-center gap-1.5 ${
                active ? 'bg-emerald-600 text-white shadow' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {active && <Check size={11} />}{lbl}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-stone-100 p-5" data-testid="scan-onboarding">
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 mb-3">
          <Sparkles size={13} /> <span className="text-[11px] font-black uppercase tracking-wide">30-Day Complete Routine Plan</span>
        </div>
        <div className="flex items-start gap-2 mb-1">
          <Camera size={18} className="text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-black text-stone-900">Scan your skin &amp; set your plan</p>
            <p className="text-[12px] text-stone-500">A clear front selfie is <b className="text-stone-700">required</b> — our AI reads your skin, then builds and saves your 30-day routine.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center shrink-0">
            {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover" />
              : <Upload size={24} className="text-stone-300" />}
          </div>
          <div className="flex-1 w-full">
            <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={pick} className="hidden" data-testid="scan-file-input" />
            <button onClick={() => fileRef.current?.click()} data-testid="scan-pick-photo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-sm px-5 py-3 rounded-xl hover:bg-emerald-100 transition-colors">
              <Camera size={16} /> {preview ? 'Change photo' : 'Upload / take photo'}
            </button>
            {!dataUrl && <p className="text-[11px] text-stone-400 mt-2">Photo is mandatory to generate your routine.</p>}
          </div>
        </div>

        {/* Plan details — collected here, after login */}
        <Chips label="Your goal (pick 1–2)" options={PLAN_GOALS} value={goals} onPick={toggleGoal} testid="plan-goal" multi />
        <Chips label="Gender" options={PLAN_GENDERS} value={gender} onPick={setGender} testid="plan-gender" />
        <Chips label="Age" options={PLAN_AGES} value={age} onPick={setAge} testid="plan-age" />
        <Chips label="Skin type" options={PLAN_SKIN_TYPES} value={skinType} onPick={setSkinType} testid="plan-skin-type" />

        <button onClick={scan} disabled={!dataUrl || loading} data-testid="scan-run"
          className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm px-6 py-4 rounded-xl transition-all disabled:opacity-50">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Generating your routine…</>
            : <><Sparkles size={16} /> Start &amp; Generate My Routine <ArrowRight size={15} /></>}
        </button>
        {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-3" data-testid="scan-error">{error}</p>}
      </div>

      {report && <ReportView report={report} />}
    </div>
  );
}

/* ----------------------------------------------------------------- PROGRESS */
function PlanCard({ plan }) {
  if (!plan) return null;
  const day = plan.current_day || 1;
  const total = plan.total_days || 30;
  const pct = Math.min(100, Math.round((day / total) * 100));
  const Steps = ({ title, icon: Icon, steps }) => (
    <div className="bg-white rounded-2xl border border-stone-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-emerald-600" />
        <span className="text-sm font-black text-stone-900">{title}</span>
      </div>
      <ol className="space-y-2">
        {(steps || []).map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
            <div>
              <p className="text-[13px] font-bold text-stone-800">{s.step}{s.product ? <span className="font-medium text-emerald-700"> · {s.product}</span> : null}</p>
              {s.how && <p className="text-[12px] text-stone-500">{s.how}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="space-y-4" data-testid="plan-card">
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">Your 30-Day Routine Plan</p>
            <p className="text-lg font-black text-stone-900">Day {day} of {total}</p>
          </div>
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 rounded-full px-3 py-1.5 text-[11px] font-black" data-testid="plan-status">
            <Check size={12} /> Routine active &amp; saved
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-amber-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {plan.goals?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {plan.goals.map((g) => (
              <span key={g} className="text-[11px] font-bold bg-white border border-amber-200 text-amber-800 rounded-full px-2.5 py-1">{g}</span>
            ))}
          </div>
        ) : null}
      </div>
      {(plan.am_routine?.length || plan.pm_routine?.length) ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Steps title="Morning Routine" icon={Sun} steps={plan.am_routine} />
          <Steps title="Night Routine" icon={Moon} steps={plan.pm_routine} />
        </div>
      ) : null}
    </div>
  );
}

/* --- Daily scorecard: score ring + 30-day progress + streak --- */
function DayScoreCard({ day, score }) {
  const progressDay = day?.progress_day || 1;
  const total = day?.total_days || 30;
  const streak = day?.streak || 0;
  const completedDays = day?.completed_days || 0;
  const pct = Math.min(100, Math.round((completedDays / total) * 100));
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5" data-testid="day-scorecard">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <ScoreRing score={score || 0} size={84} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Your Skin Score</p>
          <p className="text-[13px] text-stone-500 leading-snug">Keep glowing — follow today's ritual and log a selfie to unlock tomorrow.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800"><CalendarDays size={12} /> Day {progressDay} of {total}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800"><Sparkles size={12} /> {streak}-day streak</span>
          </div>
        </div>
      </div>
      <div className="relative mt-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mb-1">
          <span>Progress</span><span>{completedDays}/{total} days</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/70 overflow-hidden ring-1 ring-emerald-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-amber-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ProgressPanel({ token, plan }) {
  const [day, setDay] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState({});
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        axios.get(`${API}/api/tracker/day`, authHeader(token)).catch(() => ({ data: {} })),
        axios.get(`${API}/api/tracker/scans`, authHeader(token)).catch(() => ({ data: {} })),
      ]);
      setDay(d.data || {});
      setCompleted((d.data && d.data.completed) || {});
      setScans((s.data && s.data.scans) || []);
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const tasks = React.useMemo(() => {
    const am = (day?.am_routine || []).map((s, i) => ({ key: `am-${i}`, slot: 'AM', ...s }));
    const pm = (day?.pm_routine || []).map((s, i) => ({ key: `pm-${i}`, slot: 'PM', ...s }));
    return [...am, ...pm];
  }, [day]);

  const doneCount = tasks.filter((t) => completed[t.key]).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const todayDone = !!day?.today_done;

  const toggle = (key) => setCompleted((c) => ({ ...c, [key]: !c[key] }));

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(await fileToDataUrl(f));
  };

  const submitDay = async () => {
    if (!photo) { setErr("Add today's photo to unlock the next day."); return; }
    setErr(''); setSubmitting(true);
    try {
      const r = await axios.post(`${API}/api/tracker/day/complete`,
        { completed, photo_base64: photo }, authHeader(token));
      const pd = r.data?.progress_day || (day?.progress_day || 1);
      setCelebrate(r.data?.plan_complete
        ? `Incredible — you completed all 30 days! 🌿`
        : `Day ${day?.progress_day || pd} complete! Day ${Math.min(pd, day?.total_days || 30)} is unlocked.`);
      setPhoto(null);
      await load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not save today. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="py-16 text-center text-stone-400"><Loader2 className="animate-spin mx-auto" /></div>;

  const latestScore = day?.skin_score || scans[0]?.skin_score || 0;
  const hasScan = day?.has_scan || scans.length > 0;

  if (!hasScan) return (
    <div className="space-y-4">
      <PlanCard plan={plan} />
      <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
        <TrendingUp size={28} className="text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-500">No scan yet. Run your first skin scan to build your 30-day plan and start tracking progress.</p>
      </div>
    </div>
  );

  const max = Math.max(...scans.map((s) => s.skin_score || 0), 100);

  return (
    <div className="space-y-5">
      <DayScoreCard day={day} score={latestScore} />

      {celebrate && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 flex items-center gap-2" data-testid="day-celebrate">
          <Check size={16} /> {celebrate}
        </div>
      )}

      {/* ---- Today's ritual: tick each step, then share a selfie ---- */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-100 p-5" data-testid="today-ritual">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-black text-stone-900">Today&apos;s Ritual · Day {day?.progress_day || 1}</p>
            <span className="text-[11px] font-black text-emerald-700">{doneCount}/{tasks.length} done</span>
          </div>
          <p className="text-[12px] text-stone-500 mb-4">Tick off each step, then share today&apos;s photo to unlock tomorrow&apos;s plan.</p>

          <div className="space-y-2.5">
            {tasks.map((t) => {
              const on = !!completed[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => !todayDone && toggle(t.key)}
                  disabled={todayDone}
                  data-testid={`ritual-step-${t.key}`}
                  className={`w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${on ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'} ${todayDone ? 'opacity-70 cursor-default' : ''}`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${t.slot === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {t.slot === 'AM' ? <Sun size={13} /> : <Moon size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-stone-800">{t.step}{t.product ? <span className="font-medium text-emerald-700"> · {t.product}</span> : null}</span>
                    {t.how && <span className="block text-[12px] text-stone-500">{t.how}</span>}
                  </span>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300'}`}>
                    {on && <Check size={12} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Eat / Avoid / Do naturally — personalised per day */}
          {(day?.eat?.length || day?.avoid?.length || day?.natural?.length) ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="daily-guidance">
              {[
                { title: 'What to Eat', items: day?.eat || [], icon: <Apple size={14} />, cls: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', head: 'text-emerald-800' },
                { title: 'What to Avoid', items: day?.avoid || [], icon: <Ban size={14} />, cls: 'border-rose-200 bg-rose-50', dot: 'bg-rose-500', head: 'text-rose-800' },
                { title: 'Do Naturally', items: day?.natural || [], icon: <Droplets size={14} />, cls: 'border-sky-200 bg-sky-50', dot: 'bg-sky-500', head: 'text-sky-800' },
              ].map((col) => (
                <div key={col.title} className={`rounded-2xl border p-3.5 ${col.cls}`}>
                  <p className={`flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wide mb-2 ${col.head}`}>{col.icon} {col.title}</p>
                  <ul className="space-y-1.5">
                    {col.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-stone-700">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {/* Share today's photo — unlocks after all steps done */}
          <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
            {todayDone ? (
              <div className="flex items-center gap-3">
                {day?.today_photo
                  ? <img src={day.today_photo} alt="today" className="h-14 w-14 rounded-xl object-cover" />
                  : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Check size={20} /></span>}
                <div>
                  <p className="text-[13px] font-black text-emerald-800">Today&apos;s photo saved ✓</p>
                  <p className="text-[12px] text-stone-500">Come back tomorrow for Day {Math.min((day?.progress_day || 1) + 1, day?.total_days || 30)}.</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[13px] font-black text-amber-900 flex items-center gap-1.5"><Camera size={15} /> Share today&apos;s photo</p>
                <p className="text-[12px] text-stone-500 mt-0.5 mb-3">{allDone ? 'All steps done! Add a selfie to log Day ' + (day?.progress_day || 1) + ' and unlock tomorrow.' : 'Finish all the steps above, then add a front selfie here.'}</p>
                <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={pickPhoto} className="hidden" />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {photo && <img src={photo} alt="preview" className="h-16 w-16 rounded-xl object-cover" />}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={!allDone}
                    data-testid="day-pick-photo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-[13px] font-black text-amber-800 disabled:opacity-50"
                  >
                    <Upload size={15} /> {photo ? 'Change photo' : 'Add today\u2019s photo'}
                  </button>
                  <button
                    onClick={submitDay}
                    disabled={!allDone || !photo || submitting}
                    data-testid="day-complete-btn"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-[13px] font-black text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                  >
                    {submitting ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <>Complete Day &amp; Unlock Next <ArrowRight size={14} /></>}
                  </button>
                </div>
                {err && <p className="mt-2 text-[12px] font-bold text-rose-600">{err}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Score history ---- */}
      {scans.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <p className="text-sm font-black text-stone-900 mb-3">Skin Score over time</p>
          <div className="flex items-end gap-2 h-32">
            {[...scans].reverse().map((s) => (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-emerald-100 rounded-t-md flex items-end justify-center" style={{ height: `${((s.skin_score || 0) / max) * 100}%` }}>
                  <div className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md" style={{ height: '100%' }} />
                </div>
                <span className="text-[10px] font-bold text-stone-600">{s.skin_score}</span>
                <span className="text-[9px] text-stone-400">{(s.date || '').slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- ORDERS */
function OrdersPanel({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/auth/orders`, authHeader(token));
        setOrders(r.data.orders || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="py-16 text-center text-stone-400"><Loader2 className="animate-spin mx-auto" /></div>;
  if (!orders.length) return (
    <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
      <Package size={28} className="text-stone-300 mx-auto mb-2" />
      <p className="text-sm text-stone-500 mb-3">You have no orders yet.</p>
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">Start shopping <ChevronRight size={15} /></Link>
    </div>
  );
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.order_id} className="bg-white rounded-2xl border border-stone-100 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-stone-900">#{o.order_id}</span>
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{o.status || 'placed'}</span>
          </div>
          <p className="text-[12px] text-stone-400 mt-0.5">{(o.created_at || '').slice(0, 10)} · ₹{o.total_amount} · {o.payment_method}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(o.items || []).slice(0, 4).map((it, i) => (
              <span key={i} className="text-[11px] bg-stone-50 border border-stone-100 rounded-lg px-2 py-1 text-stone-600">
                {(it.name || it.short_name)} ×{it.quantity || it.qty || 1}
              </span>
            ))}
          </div>
          {o.tracking_url && (
            <a href={o.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 mt-2">
              Track package <ChevronRight size={14} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- DASHBOARD */
const TABS = [
  { id: 'scan', label: 'Scan & Routine', icon: Sparkles },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'profile', label: 'Profile', icon: User },
];

function Dashboard({ token, user, onLogout }) {
  const [tab, setTab] = useState('scan');
  const [latest, setLatest] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/tracker/scans`, authHeader(token));
        setLatest(r.data.latest || null);
      } catch {}
      // Resume the saved 30-day plan so it persists across logins/reloads.
      try {
        const p = await axios.get(`${API}/api/tracker/plan`, authHeader(token));
        if (p.data?.plan) setPlan(p.data.plan);
      } catch {}
    })();
  }, [token]);

  // Routine generated → the plan is running; hand the user to the progress page.
  const handlePlanStarted = useCallback((started) => {
    if (started) setPlan(started);
    setTab('progress');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
      {/* header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 sm:p-6 text-white mb-5 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Welcome back</p>
            <h1 className="text-xl sm:text-2xl font-black">{user?.name || user?.email?.split('@')[0] || 'Glow member'}</h1>
            <span className="inline-flex items-center gap-1 mt-2 bg-white/15 rounded-full px-2.5 py-1 text-[11px] font-bold">
              <Gift size={12} /> Free plan active · 1 month
            </span>
          </div>
          <button onClick={onLogout} data-testid="dashboard-logout" className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-3 py-2 text-xs font-bold transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`dash-tab-${t.id}`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${tab === t.id ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'scan' && <ScanPanel token={token} latest={latest} onScanned={setLatest} onPlanStarted={handlePlanStarted} />}
      {tab === 'progress' && <ProgressPanel token={token} plan={plan} />}
      {tab === 'orders' && <OrdersPanel token={token} />}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3 max-w-md">
          <div className="flex items-center gap-2"><User size={16} className="text-emerald-600" /><span className="text-sm font-black text-stone-900">Profile</span></div>
          <div className="text-sm text-stone-600"><span className="text-stone-400">Email</span><p className="font-bold text-stone-800">{user?.email}</p></div>
          {user?.phone && <div className="text-sm text-stone-600"><span className="text-stone-400">Phone</span><p className="font-bold text-stone-800">{user.phone}</p></div>}
          <Link to="/routine" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700"><ClipboardList size={15} /> Build a routine</Link>
          <button onClick={onLogout} className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-stone-200 text-stone-700 font-bold text-sm py-3 rounded-xl hover:bg-stone-50"><LogOut size={15} /> Logout</button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- PAGE */
export default function TrackerPage() {
  const [token, setToken] = useState(() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } });
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } });

  const logout = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch {}
    setToken(null); setUser(null);
  }, []);

  // Validate the saved session on mount. IMPORTANT: only force a logout when
  // the token is genuinely rejected (401/403). Transient network / 5xx errors
  // must KEEP the cached session so returning users aren't bounced back to the
  // OTP screen every visit. The 30-day server session + localStorage token mean
  // their progress-tracker data (keyed by email) is always waiting for them.
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/api/auth/me`, authHeader(token)).then((r) => {
      if (r.data?.user) { setUser(r.data.user); try { localStorage.setItem(USER_KEY, JSON.stringify(r.data.user)); } catch {} }
    }).catch((e) => {
      const status = e?.response?.status;
      if (status === 401 || status === 403) logout();
      // else: keep the cached session (offline / server hiccup) — do not log out.
    });
  }, [token, logout]);

  const TopBack = () => (
    <div className="max-w-5xl mx-auto px-4 pt-5">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft size={15} /> Back to shop</Link>
    </div>
  );

  // The 30-day plan onboarding (photo + goals + gender + age) deliberately
  // does NOT live here any more. Before login we only show the login gate;
  // all details are collected on the scanning page inside the dashboard.
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 pb-16">
        <TopBack />
        <LoginGate onLogin={(t, u) => { setToken(t); setUser(u); }} />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <TopBack />
      <Dashboard token={token} user={user} onLogout={logout} />
    </div>
  );
}
