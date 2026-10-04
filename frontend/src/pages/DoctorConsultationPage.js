import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import {
  ShieldCheck, Stethoscope, Award, CheckCircle2, Star, Phone, Mail,
  User, MessageSquare, Loader2, Sparkles, Pill, Clock, ChevronRight,
} from 'lucide-react';
import BackButton from '../components/BackButton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Load the Razorpay checkout script lazily so it doesn't bloat the first paint.
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

function StarRow({ rating = 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={14}
          className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  );
}

export default function DoctorConsultationPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/doctor-consultation/config`)
      .then((r) => setConfig(r.data))
      .catch(() => setError('Could not load consultation details. Please refresh.'));
  }, []);

  // Skeleton placeholder data used while the API call is in flight. Lets the
  // page render INSTANTLY (no blank screen / spinner) with the price, copy
  // and form already visible — admin-customised values just replace these
  // when the network response lands.
  const cfg = config || {
    price: 999,
    currency: 'INR',
    title: 'Dermatologist Consultation',
    subtitle: 'Personalised skincare backed by certified dermatologists',
    disclaimer: 'Consultation fee covers the doctor call & report. Medicine cost (if prescribed) is not included.',
    doctors: [],
    reviews: [],
  };

  const validate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) return 'Please enter your full name';
    const phone = form.phone.replace(/\D/g, '');
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) return 'Enter a valid 10-digit mobile number';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email';
    return null;
  };

  const handleBook = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const phone = form.phone.replace(/\D/g, '');
      const orderRes = await axios.post(`${API}/doctor-consultation/create-order`, {
        name: form.name.trim(),
        phone,
        email: form.email.trim().toLowerCase(),
        notes: form.notes.trim() || null,
      });
      const order = orderRes.data;
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Could not load payment gateway');

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Celesta Glow',
        description: 'Dermatologist Consultation',
        order_id: order.razorpay_order_id,
        prefill: { name: form.name, email: form.email, contact: phone },
        theme: { color: '#059669' },
        handler: async (resp) => {
          try {
            await axios.post(`${API}/doctor-consultation/verify-payment`, {
              booking_id: order.booking_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setSuccess({
              booking_id: order.booking_id,
              name: form.name,
              phone,
              email: form.email,
            });
            setForm({ name: '', phone: '', email: '', notes: '' });
          } catch (e) {
            setError(e?.response?.data?.detail || 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      rzp.on('payment.failed', (resp) => {
        setError(resp?.error?.description || 'Payment failed. Please try again.');
        setSubmitting(false);
      });
      rzp.open();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Something went wrong. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cfg) {
    // Defensive — shouldn't hit this since cfg has skeleton defaults
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 flex flex-col">
        <div className="max-w-2xl mx-auto px-5 pt-6 w-full">
          <BackButton />
        </div>
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-emerald-100 p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2" data-testid="booking-success-title">
              Consultation Booked!
            </h2>
            <p className="text-gray-600 mb-4">
              Hi <strong>{success.name}</strong>, our certified dermatologist will call you on{' '}
              <strong>+91 {success.phone}</strong> within 24 hours.
            </p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800 mb-5">
              Booking ID: <span className="font-mono font-semibold">{success.booking_id}</span>
              <br />
              A confirmation has been sent to <strong>{success.email}</strong>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold hover:from-emerald-700 hover:to-green-700 transition-all"
              data-testid="back-to-home-btn"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-green-50 pb-16">
      <Helmet>
        <title>{`Dermatologist Consultation — Celesta Glow | ₹${cfg.price} only`}</title>
        <meta
          name="description"
          content="Book a ₹999 dermatologist consultation with Celesta Glow. Certified doctors, personalised skincare prescription, and WhatsApp follow-up."
        />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <BackButton />
      </div>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold tracking-wider uppercase mb-4">
            <Stethoscope size={14} />
            Dermatologist Backed
          </div>
          <h1
            className="text-3xl sm:text-5xl text-gray-900 leading-tight mb-3"
            style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}
            data-testid="doctor-consult-title"
          >
            {cfg.title || 'Dermatologist Consultation'}
          </h1>
          <p className="text-gray-600 text-base sm:text-lg mb-6">{cfg.subtitle}</p>

          <div className="inline-flex items-baseline gap-3 bg-white border border-emerald-200 rounded-2xl px-5 py-3 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Consultation</span>
            <span className="text-3xl font-bold text-emerald-700" data-testid="consult-price">
              ₹{cfg.price}
            </span>
            <span className="text-xs text-gray-400 line-through">₹1499</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-100">
              <Clock size={14} className="text-emerald-500" /> 30-min call
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-100">
              <ShieldCheck size={14} className="text-emerald-500" /> Certified MD
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-100">
              <MessageSquare size={14} className="text-green-500" /> WhatsApp follow-up
            </span>
          </div>
        </div>
      </section>

      {/* BOOKING FORM */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 mb-12">
        <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5 text-white">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles size={18} /> Book Your Consultation
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              Fill your details, pay ₹{cfg.price} securely and a dermatologist will call you within 24 hours.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <User size={12} /> Full Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="As per your prescription"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                data-testid="dc-name-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Phone size={12} /> Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-4 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 rounded-l-xl">
                  +91
                </span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  data-testid="dc-phone-input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mail size={12} /> Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                data-testid="dc-email-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <MessageSquare size={12} /> Anything specific to share? (optional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Your skin concern, current routine, allergies, etc."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                data-testid="dc-notes-input"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5" data-testid="dc-error">
                {error}
              </div>
            )}

            <button
              onClick={handleBook}
              disabled={submitting}
              className="w-full py-4 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg"
              data-testid="dc-pay-btn"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  Pay ₹{cfg.price} & Book Consultation
                  <ChevronRight size={18} />
                </>
              )}
            </button>
            <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-500" />
              100% secure payment via Razorpay
            </div>
          </div>
        </div>
      </section>

      {/* DOCTORS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-14">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-semibold tracking-wider uppercase mb-2">
            <Award size={14} /> Our Experts
          </div>
          <h2
            className="text-2xl sm:text-3xl text-gray-900"
            style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}
          >
            Meet our certified dermatologists
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(cfg.doctors || []).map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-emerald-100 p-5 hover:shadow-lg transition-shadow"
              data-testid={`doctor-card-${d.id}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center overflow-hidden border border-emerald-200 shrink-0">
                  {d.photo ? (
                    <img src={d.photo} alt={d.name} className="w-full h-full object-cover" />
                  ) : (
                    <Stethoscope className="w-7 h-7 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 leading-tight">{d.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{d.qualification}</p>
                  <p className="text-xs text-emerald-700 font-medium mt-1">
                    {d.experience_years}+ years experience
                  </p>
                </div>
              </div>
              {d.specialty && (
                <p className="text-xs font-semibold text-gray-700 mb-1">Specialty:</p>
              )}
              <p className="text-xs text-gray-600 mb-2">{d.specialty}</p>
              {d.bio && <p className="text-sm text-gray-600">{d.bio}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-14">
        <h2
          className="text-2xl sm:text-3xl text-gray-900 text-center mb-8"
          style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { icon: User, title: 'Share details', desc: 'Fill name, phone & email' },
            { icon: ShieldCheck, title: 'Pay ₹999', desc: 'Secure Razorpay checkout' },
            { icon: Phone, title: 'Doctor calls', desc: 'Within 24 hours' },
            { icon: Pill, title: 'Get routine', desc: 'Custom Rx + WhatsApp follow-up' },
          ].map((s, i) => (
            <div key={s.title} className="text-center bg-white rounded-2xl border border-emerald-50 p-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600 flex items-center justify-center mb-2">
                <s.icon size={22} />
              </div>
              <div className="text-xs text-emerald-600 font-semibold mb-1">Step {i + 1}</div>
              <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-14">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-semibold tracking-wider uppercase mb-2">
            <Star size={14} className="fill-amber-400 text-amber-400" /> Patient stories
          </div>
          <h2
            className="text-2xl sm:text-3xl text-gray-900"
            style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}
          >
            What our patients say
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(cfg.reviews || []).map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-emerald-50 p-5"
              data-testid={`review-card-${r.id}`}
            >
              <StarRow rating={r.rating || 5} />
              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{r.text}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-200 to-green-200 flex items-center justify-center text-emerald-700 font-semibold text-sm">
                  {(r.name || '?').charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none">{r.name}</p>
                  {r.city && <p className="text-xs text-gray-400 mt-0.5">{r.city}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 flex items-start gap-3">
          <Pill className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p>{cfg.disclaimer}</p>
        </div>
      </section>
    </div>
  );
}
