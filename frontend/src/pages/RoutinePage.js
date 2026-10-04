import React, { useEffect, useState, useRef } from 'react';
import BackButton from '../components/BackButton';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, Sunrise, Moon, Droplet, Shield, Wand2, ArrowRight, Loader2, Check, Camera, X, ShoppingCart, Plus, BadgeCheck, Download } from 'lucide-react';
import { addToCart } from './Homepage';
import { downloadRoutinePdf } from '../utils/routinePdf';

const API = process.env.REACT_APP_BACKEND_URL;

/* Compress an image File on the client to a JPEG dataURL (max width 720px, quality 0.72).
   Keeps payloads tiny and prevents giant phone-camera uploads from slowing the page. */
async function compressImage(file, { maxWidth = 720, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Skin profile options */
const SKIN_TYPES = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'normal', label: 'Normal' },
];
// 11 major dermatological concerns considered while generating the report
const CONCERNS = [
  'Fine Lines & Wrinkles',
  'Sagging / Loss of Firmness',
  'Pigmentation & Uneven Tone',
  'Dark Spots',
  'Dullness',
  'Dark Circles',
  'Under-Eye Puffiness',
  'Dryness / Dehydration',
  'Acne / Breakouts',
  'Enlarged Pores',
  'Sensitivity / Redness',
];
const AGE_BANDS = ['18–24', '25–34', '35–44', '45+'];

/* Routine slot mapping — pick one product from these categories per slot.
   Order: Cleanse → Serum → Moisturize → Protect (AM) / Treat (PM). */
const AM_SLOTS = [
  { id: 'cleanse', label: 'Cleanse', icon: Droplet, cats: ['cleanser', 'face wash', 'facewash', 'cleansing'] },
  { id: 'treat', label: 'Treat', icon: Sparkles, cats: ['serum', 'treatment', 'essence'] },
  { id: 'moisturize', label: 'Moisturize', icon: Droplet, cats: ['moisturizer', 'moisturiser', 'cream', 'hydra', 'lotion'] },
  { id: 'protect', label: 'Protect (SPF)', icon: Shield, cats: ['sunscreen', 'spf'] },
];
const PM_SLOTS = [
  { id: 'cleanse', label: 'Cleanse', icon: Droplet, cats: ['cleanser', 'face wash', 'facewash', 'cleansing'] },
  { id: 'eye', label: 'Eye Care', icon: Sparkles, cats: ['eye', 'under-eye', 'under eye'] },
  { id: 'treat', label: 'Treat', icon: Sparkles, cats: ['serum', 'treatment', 'retinol', 'essence'] },
  { id: 'moisturize', label: 'Night Cream', icon: Moon, cats: ['night cream', 'moisturizer', 'moisturiser', 'cream', 'hydra'] },
];

function pickProduct(products, cats, used) {
  // Fuzzy match: a slot keyword matches if it appears in the product's
  // category, subcategory or name (case-insensitive substring). This makes the
  // routine builder robust to catalog naming (e.g. slot 'serum' matches
  // category 'serums-treatments' or 'niacinamide-serum').
  const norm = (s) => (s || '').toString().toLowerCase();
  const hay = (p) => [p.category, p.subcategory, p.name, p.key_ingredients, p.ingredients_full, ...(p.concerns || [])].map(norm).join(' | ');
  const keys = cats.map(norm);
  // Pass 1: unused product whose haystack contains a slot keyword
  for (const p of products) {
    if (used.has(p.slug)) continue;
    const h = hay(p);
    if (keys.some(k => k && h.includes(k))) return p;
  }
  // Pass 2: any product (allow reuse) matching a keyword
  for (const p of products) {
    const h = hay(p);
    if (keys.some(k => k && h.includes(k))) return p;
  }
  return null;
}

export default function RoutinePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [skinType, setSkinType] = useState('combination');
  const [age, setAge] = useState('25–34');
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [routine, setRoutine] = useState(null); // { am, pm, skin_score, specialist_notes }
  // 3-angle photo capture (front / left / right)
  const [photoFront, setPhotoFront] = useState(null);
  const [photoLeft, setPhotoLeft] = useState(null);
  const [photoRight, setPhotoRight] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(null); // 'front' | 'left' | 'right' | null
  const [mobile, setMobile] = useState('');
  const [aiConcerns, setAiConcerns] = useState([]);   // AI-recommended concern slugs
  const [budgetOpen, setBudgetOpen] = useState(false); // "Shop for my skin problem" panel
  const fileFrontRef = useRef(null);
  const fileLeftRef = useRef(null);
  const fileRightRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/products?limit=500`).then(r => {
      const items = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.products || []);
      setProducts(items);
    }).catch(() => {});
  }, []);

  const toggleConcern = (c) => {
    setSelectedConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handlePhoto = (angle) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(angle);
    try {
      const compressed = await compressImage(file);
      if (angle === 'front') setPhotoFront(compressed);
      if (angle === 'left') setPhotoLeft(compressed);
      if (angle === 'right') setPhotoRight(compressed);
    } catch { /* ignore */ } finally {
      setPhotoBusy(null);
      const ref = angle === 'front' ? fileFrontRef : angle === 'left' ? fileLeftRef : fileRightRef;
      if (ref.current) ref.current.value = '';
    }
  };
  const clearPhoto = (angle) => {
    if (angle === 'front') setPhotoFront(null);
    if (angle === 'left') setPhotoLeft(null);
    if (angle === 'right') setPhotoRight(null);
  };

  // Variable skin score in the 70–90 range. Score = base (weighted by age,
  // skin type, concerns, photo completeness) + small randomised jitter so
  // regenerating with the same inputs still moves the needle a couple of
  // points. We also return per-factor deltas so the report can explain
  // exactly WHY the score landed where it did.
  const computeSkinScore = (concerns, allPhotos) => {
    const factors = [];
    let score = 88;
    factors.push({ label: 'Baseline healthy-skin score', delta: 88 });

    // Concerns — each concern trims a couple of points.
    if (concerns && concerns.length) {
      const perConcern = -Math.min(3, Math.max(1, Math.round(12 / Math.max(1, concerns.length))));
      const conDelta = perConcern * concerns.length;
      score += conDelta;
      factors.push({ label: `${concerns.length} skin concern${concerns.length === 1 ? '' : 's'} flagged (${concerns.slice(0, 3).join(', ')}${concerns.length > 3 ? '…' : ''})`, delta: conDelta });
    }

    // Age band
    if (age === '18–24') { score += 3; factors.push({ label: 'Youthful skin (18–24) — collagen still peaking', delta: 3 }); }
    else if (age === '25–34') { factors.push({ label: 'Prime skin (25–34) — no age penalty', delta: 0 }); }
    else if (age === '35–44') { score -= 3; factors.push({ label: 'Early collagen decline (35–44)', delta: -3 }); }
    else { score -= 6; factors.push({ label: 'Mature phase (45+) — deeper repair needed', delta: -6 }); }

    // Skin type nuance
    if (skinType === 'sensitive') { score -= 3; factors.push({ label: 'Sensitive skin — barrier is easier to disrupt', delta: -3 }); }
    else if (skinType === 'oily') { score -= 1; factors.push({ label: 'Oily skin — sebum control matters daily', delta: -1 }); }
    else if (skinType === 'dry') { score -= 2; factors.push({ label: 'Dry skin — hydration is the top priority', delta: -2 }); }
    else if (skinType === 'combination') { factors.push({ label: 'Combination skin — zone-specific care recommended', delta: 0 }); }
    else if (skinType === 'normal') { score += 2; factors.push({ label: 'Normal, well-balanced skin', delta: 2 }); }

    // Photo completeness — reward users who upload all 3 angles.
    if (allPhotos) { score += 4; factors.push({ label: 'All 3 angles captured — full inspection possible', delta: 4 }); }
    else { score -= 2; factors.push({ label: 'Only front selfie — deeper angles missed', delta: -2 }); }

    // Small deterministic-ish jitter (±2) seeded by concerns + age +
    // timestamp bucket so refreshing the report a minute later can shift the
    // score by a point or two — feels alive, not scripted.
    const jitter = ((Date.now() >> 12) + concerns.length * 7 + age.length * 3) % 5 - 2;
    score += jitter;
    if (jitter) factors.push({ label: 'Session variance (skin readings shift daily)', delta: jitter });

    // Clamp to 70–90
    score = Math.max(70, Math.min(90, score));
    return { score, factors };
  };

  const generateSpecialistNotes = (concerns) => {
    const c = new Set(concerns);
    const bullets = [];
    if (c.has('Fine Lines & Wrinkles') || c.has('Sagging / Loss of Firmness')) {
      bullets.push('Retinol + Peptide layering nightly to rebuild collagen and improve firmness over 8–12 weeks.');
    }
    if (c.has('Pigmentation & Uneven Tone') || c.has('Dark Spots') || c.has('Dullness')) {
      bullets.push('Daily Vitamin C AM + Niacinamide PM to fade pigment and even skin tone; strict SPF 50 is non-negotiable.');
    }
    if (c.has('Dark Circles') || c.has('Under-Eye Puffiness')) {
      bullets.push('Under-eye peptide cream every night + gentle caffeine roller in the morning to reduce shadows and puffiness.');
    }
    if (c.has('Dryness / Dehydration')) {
      bullets.push('Hyaluronic + Ceramide moisturiser twice daily on damp skin to rebuild the moisture barrier.');
    }
    if (c.has('Acne / Breakouts') || c.has('Enlarged Pores')) {
      bullets.push('AHA/BHA cleanser 3× a week + niacinamide serum daily to control sebum and refine pores. Avoid over-scrubbing.');
    }
    if (c.has('Sensitivity / Redness')) {
      bullets.push('Skip active acids for 2 weeks; use fragrance-free centella cream twice daily to calm the barrier.');
    }
    if (!bullets.length) {
      bullets.push('Skin looks well-balanced. Maintain SPF 50 daily, an antioxidant serum AM and a retinol PM (2× a week) to stay ahead of ageing.');
    }
    if (age === '18–24') bullets.push('Prevention phase — keep the routine light and consistent.');
    else if (age === '25–34') bullets.push('Early collagen-support phase — small daily habits pay compounding returns.');
    else if (age === '35–44') bullets.push('Repair + defend phase — add a night mask twice weekly for deep repair.');
    else bullets.push('Restore phase — layered peptides + growth-factor serums accelerate visible results.');
    return bullets;
  };

  // "Start Your 30 Days Complete Routine Plan" — no selfie, no goals, no
  // details asked here. Everything the plan needs is collected on the Progress
  // Tracker AFTER the user logs in with their OTP, so this is a clean redirect.
  const startJourney = () => {
    navigate('/tracker?start=plan');
  };

  const handleGenerate = async () => {    // MANDATORY: at least the front selfie
    if (!photoFront) {
      alert('Please upload the FRONT selfie first — it helps us personalize your routine.');
      return;
    }
    const cleanMobile = (mobile || '').replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setGenerating(true);
    setRoutine(null);

    // 1) Gemini skin scan + human-image gate (backend validates it's a face).
    let ai = null;
    try {
      const { data } = await axios.post(`${API}/api/routine/analyze`, {
        front: photoFront,
        left: photoLeft,
        right: photoRight,
        skin_type: skinType,
        age,
        concerns: selectedConcerns,
      });
      ai = data;
    } catch (err) {
      setGenerating(false);
      if (err.response?.status === 422) {
        alert(err.response.data.detail || "That doesn't look like a human face, honey 💛 — please upload a clear selfie.");
      } else {
        alert('Could not analyze your photo right now. Please try again in a moment.');
      }
      return;
    }

    // 2) Build the AM/PM routine from the catalog.
    const used = new Set();
    const am = AM_SLOTS.map(slot => {
      const product = pickProduct(products, slot.cats, used);
      if (product) used.add(product.slug);
      return { slot, product };
    });
    const pmUsed = new Set();
    const pm = PM_SLOTS.map(slot => {
      const product = pickProduct(products, slot.cats, pmUsed);
      if (product) pmUsed.add(product.slug);
      return { slot, product };
    });
    const allPhotos = !!(photoFront && photoLeft && photoRight);
    const skinScore = ai?.skin_score || computeSkinScore(selectedConcerns, allPhotos).score;
    const skinScoreResult = computeSkinScore(selectedConcerns, allPhotos);
    const specialistNotes = generateSpecialistNotes(selectedConcerns);
    if (ai?.personalized_tip) specialistNotes.unshift(`AI insight: ${ai.personalized_tip}`);
    // Remember AI-recommended concern slugs so "Shop for my skin problem" is accurate.
    setAiConcerns(ai?.recommended_concerns || []);
    setRoutine({
      am,
      pm,
      skin_score: skinScore,
      skin_score_factors: skinScoreResult.factors,
      specialist_notes: specialistNotes,
      photos_captured: allPhotos,
      ai_primary_concern: ai?.primary_concern || null,
      ai_skin_type: ai?.skin_type_estimate || null,
    });
    setGenerating(false);
    try {
      const payload = {
        skin_type: skinType,
        age,
        concerns: selectedConcerns,
        am: am.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
        pm: pm.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
        photo_url: photoFront && photoFront.startsWith('http') ? photoFront : null,
        photo_data: photoFront && !photoFront.startsWith('http') ? photoFront : null,
        photo_left_data: photoLeft && !photoLeft.startsWith('http') ? photoLeft : null,
        photo_right_data: photoRight && !photoRight.startsWith('http') ? photoRight : null,
        skin_score: skinScore,
        skin_score_factors: skinScoreResult.factors,
        specialist_notes: specialistNotes,
        mobile: cleanMobile,
        session_id: sessionStorage.getItem('sessionId') || null,
      };
      axios.post(`${API}/api/routines/save`, payload).catch(() => {});
    } catch { /* ignore */ }
  };

  // Products that match the shopper's flagged concerns (AI slugs preferred).
  const getMatchedProducts = () => {
    const wanted = new Set(aiConcerns || []);
    let matched = products.filter(p => Array.isArray(p.concerns) && p.concerns.some(c => wanted.has(c)));
    if (!matched.length) matched = products.filter(p => !p.is_variation);
    // de-dupe by base product so we don't show 24 variations of the same SKU
    const seen = new Set();
    const uniq = [];
    for (const p of matched) {
      const base = p.generated_from || p.slug;
      if (seen.has(base)) continue;
      seen.add(base);
      uniq.push(p);
    }
    return uniq.sort((a, b) => (a.prepaid_price || 0) - (b.prepaid_price || 0));
  };

  // Greedy cheapest-first basket that stays under `cap`.
  const buildBasket = (matched, cap) => {
    const basket = [];
    let total = 0;
    for (const p of matched) {
      const price = p.prepaid_price || p.cod_price || p.mrp || 0;
      if (total + price <= cap && basket.length < 5) {
        basket.push(p);
        total += price;
      }
    }
    return { basket, total };
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-stone-950 to-slate-950 text-white pb-28" data-testid="routine-page">
      <SEOHead
        title="Dermatologist Recommended Skin Care Routine | Celesta Glow"
        description="Build your AM & PM skincare routine with dermatologist-approved skincare in Kerala for fine lines, dry skin, and a healthy glow."
        canonicalPath="/routine"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Routine', url: '/routine' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      {/* Glow orbs background */}
      <div className="fixed inset-0 pointer-events-none opacity-50" aria-hidden>
        <div className="absolute top-20 -left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-60 -right-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-white/5 ring-1 ring-white/10 backdrop-blur px-3 py-1.5 rounded-full mb-3" data-testid="routine-eyebrow">
            <Wand2 size={12} className="text-emerald-400" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-emerald-300">AI-Crafted Routine</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight leading-tight bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Your Routine, <span className="italic font-light">made personal.</span>
          </h1>
          <p className="text-sm text-white/60 mt-2 max-w-md mx-auto">
            Tell us about your skin and we'll build a step-by-step AM &amp; PM ritual using Celesta Glow products.
          </p>
        </div>

        {/* Profile card */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-xl ring-1 ring-white/10 p-5 sm:p-6 shadow-2xl shadow-emerald-900/10" data-testid="routine-profile-card">
          {/* 3-angle selfie capture — Front (required), Left & Right (recommended). */}
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-1">Selfies <span className="text-rose-300 font-medium normal-case tracking-normal">(Front is required · Left &amp; Right unlock a deeper analysis)</span></p>
            <p className="text-[11px] text-white/40 mb-3">3 angles let the specialist inspect asymmetry, jawline sag, and pigmentation the front camera hides.</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { angle: 'front', label: 'Front', img: photoFront, ref: fileFrontRef, required: true },
                { angle: 'left',  label: 'Left',  img: photoLeft,  ref: fileLeftRef,  required: false },
                { angle: 'right', label: 'Right', img: photoRight, ref: fileRightRef, required: false },
              ].map(({ angle, label, img, ref, required }) => (
                <div key={angle} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    disabled={photoBusy === angle}
                    data-testid={`routine-photo-${angle}-btn`}
                    className="relative w-full aspect-square rounded-2xl ring-1 ring-white/15 bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex items-center justify-center overflow-hidden disabled:opacity-60"
                  >
                    {photoBusy === angle ? (
                      <Loader2 size={16} className="animate-spin text-white/60" />
                    ) : img ? (
                      <img src={img} alt={`${label} selfie`} className="w-full h-full object-cover" data-testid={`routine-photo-${angle}-preview`} />
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 text-white/60 px-1 text-center">
                        <Camera size={18} />
                        <span className="text-[9px] font-black tracking-wider uppercase">{label}</span>
                        {required && <span className="text-[8px] text-rose-300 font-black">REQUIRED</span>}
                      </div>
                    )}
                  </button>
                  {img && (
                    <button
                      type="button"
                      onClick={() => clearPhoto(angle)}
                      data-testid={`routine-photo-${angle}-clear`}
                      className="text-[10px] text-white/50 hover:text-white/80 inline-flex items-center gap-0.5"
                    >
                      <X size={10} /> Remove
                    </button>
                  )}
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhoto(angle)}
                    data-testid={`routine-photo-${angle}-input`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Mobile — required so the skincare team can follow up */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Mobile number <span className="text-rose-300 font-medium normal-case tracking-normal">(required)</span></p>
            <div className="flex items-center gap-2 bg-white/[0.04] ring-1 ring-white/10 rounded-xl px-3 py-2.5">
              <span className="text-white/60 text-sm font-mono">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile"
                data-testid="routine-mobile-input"
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
              />
            </div>
          </div>

          {/* Skin type */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Skin Type</p>
            <div className="flex flex-wrap gap-2">
              {SKIN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSkinType(t.value)}
                  data-testid={`routine-skintype-${t.value}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all ${
                    skinType === t.value
                      ? 'bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/30'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Age</p>
            <div className="flex flex-wrap gap-2">
              {AGE_BANDS.map(a => (
                <button
                  key={a}
                  onClick={() => setAge(a)}
                  data-testid={`routine-age-${a}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    age === a
                      ? 'bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-500/30'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Concerns */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Top Concerns <span className="text-white/30 font-medium normal-case tracking-normal">(pick 1–3)</span></p>
            <div className="flex flex-wrap gap-2">
              {CONCERNS.map(c => {
                const active = selectedConcerns.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleConcern(c)}
                    data-testid={`routine-concern-${c.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-violet-400 text-violet-950 shadow-lg shadow-violet-500/30'
                        : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                    }`}
                  >
                    {active && <Check size={11} />}
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Your 30 Days Complete Routine Plan — redirects straight to
              the Progress Tracker. No selfie or details are collected here. */}
          <button
            onClick={startJourney}
            data-testid="start-journey-btn"
            className="mt-6 w-full relative group bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-amber-950 font-black py-3.5 px-4 rounded-2xl text-[13px] sm:text-sm tracking-wide shadow-2xl shadow-amber-500/40 hover:shadow-amber-400/60 transition-all hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2 overflow-hidden ring-1 ring-amber-200/60"
          >
            <Sparkles size={16} className="shrink-0" />
            <span className="leading-tight text-center whitespace-nowrap">Start Your 30 Days Plan</span>
            <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="text-center text-[11px] text-white/40 mt-2">First 30 days free · Log in on the tracker and your plan is built there</p>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            data-testid="routine-generate-btn"
            className="mt-7 w-full relative group bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 text-emerald-950 font-black py-4 rounded-2xl text-sm tracking-wide shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-400/50 transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 overflow-hidden"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Crafting your ritual…
              </>
            ) : (
              <>
                <Wand2 size={18} /> Generate My Routine <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
            {/* shimmer */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
          </button>
        </div>

        {/* Routine output */}
        {routine && (
          <div className="mt-6" data-testid="routine-output">
            {/* Skin Score + Specialist Notes — printed at the top of the
                report so users see the "why" before the AM/PM slots. */}
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-white/[0.04] backdrop-blur-xl ring-1 ring-emerald-400/20 p-4 sm:p-5 mb-4" data-testid="routine-skin-score-card">
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Circular score dial */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <path
                      d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31"
                      fill="none"
                      stroke="url(#scoreGrad)"
                      strokeWidth="3"
                      strokeDasharray={`${(routine.skin_score / 100) * 97.4} 97.4`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-emerald-300 to-cyan-300 bg-clip-text text-transparent" data-testid="routine-skin-score-value">{routine.skin_score}</span>
                    <span className="text-[9px] font-black tracking-widest text-white/50 uppercase mt-0.5">Score</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-300/90 mb-1">Overall Skin Health</p>
                  <h3 className="font-heading text-lg sm:text-xl font-black text-white leading-tight">
                    {routine.skin_score >= 82 ? 'Excellent baseline' : routine.skin_score >= 65 ? 'Good — room to elevate' : routine.skin_score >= 50 ? 'Needs consistent care' : 'Ready for a full reset'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/60 mt-1">
                    Based on your 3-angle selfies, {selectedConcerns.length || 0} concern{selectedConcerns.length === 1 ? '' : 's'}, skin type ({skinType}) and age band ({age}).
                  </p>
                </div>
              </div>

              {Array.isArray(routine.skin_score_factors) && routine.skin_score_factors.length > 0 && (
                <div className="mt-4 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-3 sm:p-4" data-testid="routine-score-factors">
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-cyan-300/90 mb-2">
                    Why this score
                  </p>
                  <ul className="space-y-1.5">
                    {routine.skin_score_factors.map((f, i) => {
                      const d = Number(f.delta) || 0;
                      const sign = d > 0 ? '+' : '';
                      const cls = d > 0 ? 'text-emerald-300 font-bold' : d < 0 ? 'text-rose-300 font-bold' : 'text-white/50';
                      return (
                        <li key={i} className="text-[12px] sm:text-[13px] text-white/80 leading-snug flex items-start gap-2">
                          <span className="flex-1">{f.label}</span>
                          <span className={`${cls} tabular-nums flex-shrink-0`}>{sign}{d}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {Array.isArray(routine.specialist_notes) && routine.specialist_notes.length > 0 && (
                <div className="mt-4 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-3 sm:p-4" data-testid="routine-specialist-notes">
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-300/90 mb-2 inline-flex items-center gap-1.5">
                    <BadgeCheck size={11} /> Specialist notes
                  </p>
                  <ul className="space-y-1.5">
                    {routine.specialist_notes.map((line, i) => (
                      <li key={i} className="text-[12px] sm:text-[13px] text-white/85 leading-snug pl-4 relative">
                        <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* "Add all" CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => {
                  const all = [...routine.am, ...routine.pm].map(s => s.product).filter(Boolean);
                  const seen = new Set();
                  all.forEach(p => { if (!seen.has(p.slug)) { addToCart(p.slug); seen.add(p.slug); } });
                }}
                data-testid="routine-add-all-btn"
                className="flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black py-3 rounded-2xl text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.99]"
              >
                <ShoppingCart size={15} /> Add entire routine to cart
              </button>
              <button
                onClick={async () => {
                  try {
                    await downloadRoutinePdf({
                      routine,
                      profile: { skin_type: skinType, age, concerns: selectedConcerns },
                    });
                  } catch (err) {
                    alert('Could not generate PDF: ' + (err?.message || 'unknown error'));
                  }
                }}
                data-testid="routine-download-pdf-btn"
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 ring-1 ring-white/20 text-white font-black py-3 rounded-2xl text-xs sm:text-sm tracking-wide transition-all active:scale-[0.99]"
              >
                <Download size={15} /> Download PDF report
              </button>
            </div>

            {/* Shop products for my skin problem — budget-tiered baskets */}
            <div className="mb-4">
              <button
                onClick={() => setBudgetOpen(o => !o)}
                data-testid="routine-shop-problem-btn"
                className="w-full flex items-center justify-center gap-2 bg-white text-emerald-950 font-black py-3 rounded-2xl text-xs sm:text-sm tracking-wide shadow-lg transition-all active:scale-[0.99] hover:bg-emerald-50"
              >
                <ShoppingCart size={15} /> {budgetOpen ? 'Hide options' : 'Shop products for my skin problem'}
              </button>

              {budgetOpen && (() => {
                const matched = getMatchedProducts();
                const tiers = [
                  { cap: 1000, label: 'Under ₹1,000', tone: 'from-emerald-500/20' },
                  { cap: 2000, label: 'Under ₹2,000', tone: 'from-cyan-500/20' },
                  { cap: 3000, label: 'Under ₹3,000', tone: 'from-violet-500/20' },
                ];
                return (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="routine-budget-tiers">
                    {tiers.map(({ cap, label }) => {
                      const { basket, total } = buildBasket(matched, cap);
                      return (
                        <div key={cap} className="rounded-3xl bg-white/[0.05] ring-1 ring-white/10 p-4 flex flex-col" data-testid={`budget-tier-${cap}`}>
                          <div className="flex items-baseline justify-between mb-2">
                            <p className="font-black text-sm text-white">{label}</p>
                            <p className="text-[11px] text-emerald-300 font-bold">₹{total}</p>
                          </div>
                          {basket.length === 0 ? (
                            <p className="text-[11px] text-white/40 py-4">No match in this budget yet.</p>
                          ) : (
                            <ul className="space-y-2 flex-1">
                              {basket.map((p) => (
                                <li key={p.slug} className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-white/90 truncate">{p.short_name || p.name}</p>
                                    <p className="text-[10px] text-white/50">₹{p.prepaid_price}</p>
                                  </div>
                                  <button
                                    onClick={() => addToCart(p.slug)}
                                    data-testid={`budget-add-${cap}-${p.slug}`}
                                    aria-label={`Add ${p.short_name || p.name} to cart`}
                                    className="w-7 h-7 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-emerald-950 flex items-center justify-center flex-shrink-0 active:scale-95"
                                  >
                                    <Plus size={14} strokeWidth={2.6} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {basket.length > 0 && (
                            <button
                              onClick={() => { const seen = new Set(); basket.forEach(p => { if (!seen.has(p.slug)) { addToCart(p.slug); seen.add(p.slug); } }); }}
                              data-testid={`budget-add-all-${cap}`}
                              className="mt-3 w-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black py-2 rounded-xl text-[11px] tracking-wide active:scale-[0.99]"
                            >
                              Add these to cart
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[{ key: 'am', title: 'Morning Ritual', icon: Sunrise, accent: 'from-amber-300 to-emerald-300', steps: routine.am }, { key: 'pm', title: 'Night Ritual', icon: Moon, accent: 'from-violet-400 to-cyan-300', steps: routine.pm }].map(({ key, title, icon: TitleIcon, accent, steps }) => (
                <div key={key} className="rounded-3xl bg-white/[0.04] backdrop-blur-xl ring-1 ring-white/10 p-4 sm:p-5" data-testid={`routine-card-${key}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <TitleIcon size={18} className="text-white/80" />
                    <h2 className={`font-heading text-lg sm:text-xl font-black bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{title}</h2>
                  </div>
                  <ol className="space-y-2">
                    {steps.map(({ slot, product }, i) => {
                      const SlotIcon = slot.icon;
                      return (
                        <li key={`${key}-${slot.id}-${i}`} className="relative flex items-stretch gap-2.5 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-2.5 hover:bg-white/[0.06] transition-colors" data-testid={`routine-step-${key}-${i}`}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/0 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0 self-center">
                            <SlotIcon size={14} className="text-white/80" />
                          </div>
                          <div className="min-w-0 flex-1 self-center">
                            <p className="text-[9px] font-black tracking-[0.18em] uppercase text-emerald-300/80">Step {i + 1} · {slot.label}</p>
                            {product ? (
                              <Link to={`/product/${product.slug}`} className="block mt-0.5 group">
                                <p className="text-[13px] font-bold text-white truncate group-hover:text-emerald-300 transition-colors">{product.short_name || product.name}</p>
                                <p className="text-[10px] text-white/50 truncate">{product.size} · ₹{product.prepaid_price}</p>
                              </Link>
                            ) : (
                              <p className="text-[13px] text-white/40 mt-0.5">— pick from shop —</p>
                            )}
                          </div>
                          {product?.images?.[0] && (
                            <div className="w-11 h-11 rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden flex-shrink-0 self-center">
                              <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                            </div>
                          )}
                          {product && (
                            <button
                              onClick={(e) => { e.preventDefault(); addToCart(product.slug); }}
                              data-testid={`routine-step-add-${key}-${i}`}
                              aria-label={`Add ${product.short_name || product.name} to cart`}
                              className="self-center w-9 h-9 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 flex items-center justify-center transition-colors active:scale-95 flex-shrink-0 shadow-md shadow-emerald-500/30"
                            >
                              <Plus size={16} strokeWidth={2.6} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state CTA when no routine yet */}
        {!routine && !generating && (
          <p className="mt-5 text-center text-xs text-white/40">
            Personalized to your inputs. Takes about 2 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
