import React, { useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Sparkles, Handshake, TrendingUp, HeartPulse, Loader2, CheckCircle2, Phone, Mail, User, MessageSquare, IndianRupee, Building2 } from 'lucide-react';
import BackButton from '../components/BackButton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPES = {
  partner: { icon: Handshake, title: 'Partner With Us', accent: 'from-indigo-600 to-purple-600', bg: 'from-indigo-50 to-purple-50', pill: 'bg-indigo-100 text-indigo-700', badge: 'PARTNERSHIP', subtitle: "Distributor, reseller, or franchise — let's build together." },
  invest: { icon: TrendingUp, title: 'Invest In Celesta Glow', accent: 'from-amber-600 to-orange-600', bg: 'from-amber-50 to-orange-50', pill: 'bg-amber-100 text-amber-700', badge: 'INVESTMENT', subtitle: "Join us as we redefine India's skincare category." },
  skin_concern: { icon: HeartPulse, title: 'Free Skin Advice', accent: 'from-emerald-600 to-teal-600', bg: 'from-emerald-50 to-teal-50', pill: 'bg-emerald-100 text-emerald-700', badge: 'FREE ADVICE', subtitle: "Tell us your concern — we'll recommend the right routine." },
};

export default function LeadFormPage({ type: propType }) {
  const location = useLocation();
  const type = propType || (location.pathname.includes('partner') ? 'partner' : location.pathname.includes('invest') ? 'invest' : 'skin_concern');
  const cfg = TYPES[type];
  const Icon = cfg.icon;

  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', business_name: '', investment_amount: '', concern: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const validate = () => {
    if (form.name.trim().length < 2) return 'Please enter your name';
    if (form.phone.replace(/\D/g, '').length !== 10) return 'Please enter a valid 10-digit mobile';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email';
    if (type === 'invest' && !form.investment_amount) return 'Please enter your investment amount';
    if (type === 'skin_concern' && !form.concern.trim()) return 'Please describe your skin concern';
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(''); setBusy(true);
    try {
      const payload = { type, name: form.name.trim(), phone: form.phone.replace(/\D/g, ''), email: form.email.trim() || undefined, message: form.message.trim() || undefined };
      if (type === 'partner') payload.business_name = form.business_name.trim();
      if (type === 'invest') payload.investment_amount = form.investment_amount.trim();
      if (type === 'skin_concern') { payload.concern = form.concern.trim(); payload.city = form.city.trim(); }
      await axios.post(`${API}/leads`, payload);
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Could not submit. Please retry.');
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-b ${cfg.bg} px-4`}>
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2" data-testid="lead-success-title">Thanks, {form.name}!</h2>
          <p className="text-gray-600 mb-5">We&apos;ve received your details. Our team will reach out on <strong>+91 {form.phone.replace(/\D/g,'')}</strong> within 24 hours.</p>
          <a href="/" className={`inline-block px-6 py-3 rounded-full bg-gradient-to-r ${cfg.accent} text-white font-semibold`}>Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${cfg.bg} pb-16`}>
      <Helmet><title>{`${cfg.title} — Celesta Glow`}</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4"><BackButton /></div>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 text-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.pill} text-xs font-semibold tracking-wider uppercase mb-4`}>
          <Icon size={14} /> {cfg.badge}
        </div>
        <h1 className="text-3xl sm:text-5xl text-gray-900 mb-2" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }} data-testid="lead-title">{cfg.title}</h1>
        <p className="text-gray-600 text-base sm:text-lg mb-8">{cfg.subtitle}</p>
      </section>

      <section className="max-w-xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className={`bg-gradient-to-r ${cfg.accent} text-white px-6 py-4`}>
            <h2 className="font-semibold flex items-center gap-2"><Sparkles size={18} /> Fill your details</h2>
            <p className="text-white/80 text-xs mt-1">Takes less than 30 seconds.</p>
          </div>
          <div className="p-6 space-y-4">
            <Field icon={User} label="Full Name" value={form.name} onChange={v => setForm({...form, name: v})} testid="lead-name" />
            <Field icon={Phone} label="Mobile Number" value={form.phone} onChange={v => setForm({...form, phone: v.replace(/\D/g, '').slice(0,10)})} testid="lead-phone" prefix="+91" />
            <Field icon={Mail} label="Email (optional)" value={form.email} onChange={v => setForm({...form, email: v})} testid="lead-email" />
            {type === 'partner' && (
              <Field icon={Building2} label="Business / Company (optional)" value={form.business_name} onChange={v => setForm({...form, business_name: v})} testid="lead-business" />
            )}
            {type === 'invest' && (
              <Field icon={IndianRupee} label="Investment Amount (₹)" value={form.investment_amount} onChange={v => setForm({...form, investment_amount: v})} testid="lead-amount" />
            )}
            {type === 'skin_concern' && (
              <>
                <Field icon={HeartPulse} label="Your Skin Concern" value={form.concern} onChange={v => setForm({...form, concern: v})} testid="lead-concern" placeholder="Acne, pigmentation, dryness…" />
                <Field icon={MessageSquare} label="City (optional)" value={form.city} onChange={v => setForm({...form, city: v})} testid="lead-city" />
              </>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 block">Anything else? (optional)</label>
              <textarea rows={3} value={form.message} onChange={e => setForm({...form, message: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none" data-testid="lead-message" />
            </div>
            {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5" data-testid="lead-error">{err}</div>}
            <button onClick={submit} disabled={busy} className={`w-full py-4 rounded-full bg-gradient-to-r ${cfg.accent} text-white font-semibold hover:opacity-95 disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg`} data-testid="lead-submit">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : <>Submit</>}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ icon: I, label, value, onChange, testid, prefix, placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><I size={12} /> {label}</label>
      <div className="flex">
        {prefix && <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 rounded-l-xl text-sm">{prefix}</span>}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`flex-1 px-4 py-3 border border-gray-200 ${prefix ? 'rounded-r-xl' : 'rounded-xl'} focus:ring-2 focus:ring-emerald-500 outline-none`} data-testid={testid} />
      </div>
    </div>
  );
}
