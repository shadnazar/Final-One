import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronDown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Niche-shared sections — rendered in 3 niche home pages (Anti-Aging / Skincare / Cosmetics)
 * when admin enables them on /admin/niches. All copy is overridable from niche_settings.
 *
 * NOTE: The customer ReviewsSection that previously lived here has been retired in
 * favour of the live, admin-managed <ReviewsCarousel /> (see /admin/reviews).
 */

export function DermatologistSection({ accent = '#0f766e', accentDark = '#115e59', cfg = {} }) {
  const eyebrow = cfg.eyebrow || 'Dermatologically formulated';
  const titlePart1 = cfg.title_part1 || 'Built with';
  const titleHighlight = cfg.title_highlight || 'board-certified dermatologists';
  const titleSuffix = cfg.title_suffix || ' for Indian skin.';
  const body = cfg.body || 'Every formulation goes through a 3-stage review with dermatology experts who specialize in tropical-climate skin.';
  const stats = (Array.isArray(cfg.stats) && cfg.stats.length > 0) ? cfg.stats : [
    { num: '4', label: 'Weeks to visible firming' },
    { num: '0', label: 'Parabens · Sulfates · Mineral oil' },
    { num: '98%', label: 'Reported softer skin in 30 days' },
  ];
  const cta_label = cfg.cta_label || 'Book free dermat consult';
  const cta_link = cfg.cta_link || '/consultation';
  const image = cfg.image || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80';
  return (
    <section className="bg-gradient-to-br from-stone-50 via-white to-stone-50 py-8 sm:py-12" data-testid="niche-dermat">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl ring-1 ring-stone-200 p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-[4/5] sm:aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-stone-200 bg-stone-50">
              <img src={image} alt="Board-certified dermatologist" className="w-full h-full object-cover object-top" />
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5 flex items-center gap-2" style={{ color: accentDark }}>
              <BadgeCheck size={12} style={{ color: accentDark }} /> {eyebrow}
            </p>
            <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black leading-tight text-stone-900 mb-3">
              {titlePart1} <span className="italic" style={{ color: accent }}>{titleHighlight}</span>{titleSuffix}
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed mb-5">{body}</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {stats.map((s, i) => (
                <div key={s.label || i} className="text-center p-3 rounded-xl bg-stone-50 ring-1 ring-stone-200">
                  <div className="font-heading text-2xl sm:text-3xl font-black leading-none" style={{ color: accentDark }}>{s.num}</div>
                  <p className="text-[10px] mt-1.5 leading-tight" style={{ color: accentDark }}>{s.label}</p>
                </div>
              ))}
            </div>
            <Link to={cta_link} className="inline-flex items-center gap-2 text-white font-black py-2.5 px-5 rounded-full text-xs sm:text-sm tracking-wide shadow-lg transition-all hover:-translate-y-0.5" style={{ background: accent }}>
              {cta_label} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, defaultOpen, accent }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-stone-50/60 transition-colors">
        <span className="text-sm sm:text-base font-bold text-stone-900 leading-snug">{q}</span>
        <ChevronDown size={18} className={`flex-shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} style={open ? { color: accent } : undefined} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 text-[13px] sm:text-sm text-stone-600 leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export function FaqSection({ accent = '#0f766e', faqs: customFaqs, title, eyebrow, niche }) {
  const defaults = [
    { q: 'How quickly will I see results?', a: 'Most users notice softer skin and a brighter complexion within 7–10 days. Visible improvements typically appear at 4 weeks of consistent use.' },
    { q: 'Are the products dermatologically tested?', a: 'Every formula passes a 3-stage review with board-certified dermatologists.' },
    { q: 'What if it doesn\'t work for me?', a: 'We accept 7-day returns on unopened, factory-sealed items only. Opened bottles cannot be returned for hygiene reasons — please WhatsApp us before breaking the seal and we\'ll guide you to the right product.' },
    { q: 'How is shipping & delivery?', a: 'Free shipping on orders over ₹499. Most metros receive within 2–3 business days. COD available.' },
  ];

  // 1) Prefer admin-curated faqs prop. 2) Otherwise fetch AI-generated FAQs for the niche. 3) Fallback to defaults.
  const hasCustom = Array.isArray(customFaqs) && customFaqs.length > 0;
  const [aiFaqs, setAiFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  useEffect(() => {
    if (hasCustom || !niche) return;
    let cancelled = false;
    setLoadingFaqs(true);
    fetch(`${API}/api/faqs/${niche}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.faqs?.length) return;
        setAiFaqs(d.faqs);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingFaqs(false); });
    return () => { cancelled = true; };
  }, [niche, hasCustom]);

  const faqs = hasCustom ? customFaqs : (aiFaqs.length > 0 ? aiFaqs : defaults);
  return (
    <section className="bg-white py-8 sm:py-12" data-testid="niche-faq">
      <div className="max-w-3xl mx-auto px-3 sm:px-6">
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5" style={{ color: accent }}>{eyebrow || 'Frequently asked'}</p>
          <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 leading-tight">
            {title ? (
              <>{title.split(' ').slice(0, -1).join(' ')} <span className="italic" style={{ color: accent }}>{title.split(' ').slice(-1)[0]}</span></>
            ) : (
              <>Got <span className="italic" style={{ color: accent }}>questions?</span></>
            )}
          </h2>
          {loadingFaqs && !aiFaqs.length && (
            <p className="text-[11px] text-stone-400 mt-2" data-testid="faq-loading">Loading detailed answers…</p>
          )}
        </div>
        <div className="space-y-3" data-testid="faq-list">
          {faqs.map((f, i) => <FaqItem key={f.q || i} q={f.q} a={f.a} defaultOpen={i === 0} accent={accent} />)}
        </div>
      </div>
    </section>
  );
}
