import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import { Flame, Clock, ShieldCheck, Truck, RotateCcw, CheckCircle2, Star, ChevronRight, Loader2 } from 'lucide-react';
import { cldOptim } from '../utils/productImage';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function useCountdown(endIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!endIso) return null;
  const diff = new Date(endIso).getTime() - now;
  if (diff <= 0) return { h: 0, m: 0, s: 0, ended: true };
  return { h: Math.floor(diff / 3.6e6), m: Math.floor(diff % 3.6e6 / 6e4), s: Math.floor(diff % 6e4 / 1000), ended: false };
}

export default function SalePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    axios.get(`${API}/sale/${slug}`).then(r => setC(r.data)).catch(e => setErr(e?.response?.data?.detail || 'Sale not found'));
    // Tag session so orders can be attributed to this campaign
    try { sessionStorage.setItem('sale_campaign_slug', slug); } catch (_) { /* noop */ }
  }, [slug]);

  const t = useCountdown(c?.urgency_end_at);

  const kit = c?.kit_bundle;
  const priceView = useMemo(() => {
    if (!kit) return null;
    const mrp = Number(kit.mrp || 0);
    const sale = Number(kit.sale_price || Math.round(mrp * (1 - (c.discount_percent || 50) / 100)));
    return { mrp, sale, save: mrp - sale, pct: c.discount_percent || 50 };
  }, [kit, c]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-red-600">{err}</div>;
  if (!c) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-rose-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-emerald-50 pb-24" data-testid="sale-page">
      <Helmet><title>{`${c.title} — ${c.discount_percent}% OFF | Celesta Glow`}</title></Helmet>

      {/* Urgency ribbon */}
      <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white text-center py-2 px-3 sticky top-0 z-30 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold">
        <Flame size={14} /> BIGGEST SALE OF THE YEAR — LIMITED TIME ONLY
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-4 text-center">
        {t && !t.ended && (
          <div className="inline-flex items-center gap-2 mb-4 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <Clock size={12} /> ENDS IN {String(t.h).padStart(2, '0')}:{String(t.m).padStart(2, '0')}:{String(t.s).padStart(2, '0')}
          </div>
        )}
        <p className="text-xs tracking-widest text-emerald-700 font-semibold uppercase mb-2">LIMITED TIME OFFER</p>
        <h1 className="text-6xl sm:text-8xl font-black text-emerald-800 leading-none" data-testid="sale-headline">FLAT<br /><span className="text-7xl sm:text-9xl">{c.discount_percent}%</span> OFF</h1>
        <p className="text-lg text-gray-700 mt-2 font-medium">{c.title}</p>
        {c.subtitle && <p className="text-sm text-gray-600 mt-1">{c.subtitle}</p>}
        {c.hero_image && (
          <div className="max-w-md mx-auto mt-6">
            <img src={cldOptim(c.hero_image, {w: 800})} alt="" className="w-full rounded-3xl shadow-xl" loading="eager" />
          </div>
        )}
      </section>

      {/* Kit price panel */}
      {kit && priceView && (
        <section className="max-w-2xl mx-auto px-4 sm:px-6 mb-8">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-200 p-6">
            <div className="grid grid-cols-3 gap-4 items-center mb-5">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">MRP</p>
                <p className="text-xl font-bold text-gray-400 line-through">₹{priceView.mrp.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 mb-1">SALE PRICE</p>
                <p className="text-3xl font-black text-emerald-700">₹{priceView.sale.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-center bg-emerald-600 text-white rounded-2xl py-3">
                <p className="text-[10px] uppercase tracking-widest opacity-90">YOU SAVE</p>
                <p className="text-lg font-black">₹{priceView.save.toLocaleString('en-IN')}</p>
              </div>
            </div>
            <button onClick={() => { const first = c.featured?.[0]; if (first) navigate(`/product/${first.slug}?campaign=${slug}`); else navigate('/shop'); }} className="w-full py-4 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-lg shadow-xl hover:opacity-95 flex items-center justify-center gap-2" data-testid="sale-cta">
              Shop Now & Save {priceView.pct}% <ChevronRight size={20} />
            </button>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Truck, label: 'Free Shipping', sub: 'On Prepaid Orders', hi: c.zero_shipping },
            { icon: RotateCcw, label: '7 Days Return', sub: 'No Questions Asked' },
            { icon: ShieldCheck, label: 'Secure Payment', sub: '100% Safe' },
            { icon: CheckCircle2, label: 'Dermatologist', sub: 'Tested' },
          ].map((f) => (
            <div key={f.label} className={`bg-white rounded-2xl p-3 border ${f.hi ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100'} text-center`}>
              <f.icon size={20} className="mx-auto text-emerald-600 mb-1" />
              <p className="text-xs font-semibold text-gray-900">{f.label}</p>
              <p className="text-[10px] text-gray-500">{f.sub}</p>
            </div>
          ))}
        </div>
        {c.trust_line && <p className="text-center text-sm text-gray-600 mt-4 font-medium">{c.trust_line}</p>}
      </section>

      {/* Featured products */}
      {c.featured?.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Featured products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {c.featured.map(p => {
              const mrp = Number(p.mrp || p.prepaid_price || 0);
              const sale = Math.round(mrp * (1 - c.discount_percent / 100));
              return (
                <a key={p.slug} href={`/product/${p.slug}?campaign=${slug}`} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow" data-testid={`sale-product-${p.slug}`}>
                  <div className="relative aspect-square bg-gray-50">
                    <span className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">{c.discount_percent}% OFF</span>
                    {p.images?.[0] && <img src={cldOptim(p.images[0], {w:400})} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">{p.brand}</p>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.short_name || p.name}</p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-bold text-emerald-700">₹{sale.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-gray-400 line-through">₹{mrp.toLocaleString('en-IN')}</span>
                    </div>
                    {p.average_rating > 0 && <div className="flex items-center gap-1 mt-1 text-xs"><Star size={11} className="fill-amber-400 text-amber-400" /> {p.average_rating.toFixed(1)} · {p.reviews_count || 0}</div>}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-3 shadow-2xl flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">🔥 THE BIGGEST SALE IS LIVE!</p>
          <p className="text-[11px] opacity-90">Flat {c.discount_percent}% off — limited stock</p>
        </div>
        <button onClick={() => { const first = c.featured?.[0]; if (first) navigate(`/product/${first.slug}?campaign=${slug}`); else navigate('/shop'); }} className="bg-white text-red-600 font-bold px-4 py-2 rounded-full text-sm whitespace-nowrap shadow" data-testid="sale-sticky-cta">SHOP NOW →</button>
      </div>
    </div>
  );
}
