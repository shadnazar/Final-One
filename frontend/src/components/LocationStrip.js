import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { MapPin, ChevronDown, Loader2, Search, X, Navigation as NavIcon, Truck, Star, Sparkles, Quote } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = 'cg_delivery_location';
const PROMPTED_KEY = 'cg_delivery_prompted_v1';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function save(loc) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch (_) { /* noop */ }
}

async function reverseGeocode(lat, lng) {
  // Backend proxies Google — bypasses CORS + keeps key server-side.
  try {
    const r = await axios.get(`${API}/geo/reverse-geocode`, { params: { lat, lng } });
    return r.data;
  } catch (_) { return null; }
}

/**
 * LocationStrip — sits directly below the fixed header, matching the reference
 *   screenshot: "Delivering to <Area>, <City>  |  Delivery available 30-45 mins  |  Change"
 * Auto-prompts the user to pick a location the first time they scroll on the page
 * (so we don't nag on landing, but still capture intent before checkout).
 */
export default function LocationStrip() {
  const [loc, setLoc] = useState(loadStored());
  const [open, setOpen] = useState(false);
  const scrollFiredRef = useRef(false);

  // Cross-component sync — if location updated elsewhere, re-hydrate.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setLoc(loadStored()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-prompt: on the first scroll ever (per browser), if no location + not
  // yet prompted, pop the modal so we capture delivery area early.
  useEffect(() => {
    if (loc) return;                              // already have location
    if (localStorage.getItem(PROMPTED_KEY)) return; // already prompted once
    const onScroll = () => {
      if (scrollFiredRef.current) return;
      if (window.scrollY < 40) return;            // ignore stray micro-scrolls
      scrollFiredRef.current = true;
      try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (_) { /* noop */ }
      setOpen(true);
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loc]);

  const detect = async () => new Promise((resolve) => {
    if (!navigator.geolocation) { alert('Location not supported on this browser'); return resolve(false); }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const info = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (info) { save(info); setLoc(info); setOpen(false); resolve(true); }
      else { alert('Could not identify your location. Please search manually.'); resolve(false); }
    }, () => { alert('Please allow location permission'); resolve(false); },
    { enableHighAccuracy: true, timeout: 12000 });
  });

  const primary = loc ? (loc.locality || loc.city || 'Set location') : 'Select delivery location';
  const secondary = loc ? [loc.district && loc.district !== loc.locality ? loc.district : null, loc.city && loc.city !== loc.locality ? loc.city : null].filter(Boolean).join(', ') : '';

  return (
    <>
      <div
        className="bg-white border-b border-gray-100 px-4 py-2 lg:px-6"
        data-testid="location-strip"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* Left: address */}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left"
            data-testid="location-strip-open"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] tracking-wider text-gray-500 font-semibold uppercase">Delivering to</p>
              <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1">
                <span className="truncate">{primary}{secondary ? `, ${secondary}` : ''}</span>
                <ChevronDown size={14} className="text-gray-500 shrink-0" />
              </p>
            </div>
          </button>
          {/* Middle: delivery ETA (hidden on very small screens) */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-100 shrink-0">
            <Truck size={16} className="text-emerald-700" />
            <div className="leading-tight">
              <p className="text-[10px] tracking-wider text-gray-500 font-semibold uppercase">Delivery available</p>
              <p className="text-sm font-bold text-emerald-700">30–45 mins</p>
            </div>
          </div>
          {/* Right: change link */}
          <button
            onClick={() => setOpen(true)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm shrink-0"
            data-testid="location-strip-change"
          >
            Change
          </button>
        </div>
      </div>
      {open && (
        <LocationModal
          onClose={() => setOpen(false)}
          onDetect={detect}
          onSelect={(l) => { save(l); setLoc(l); setOpen(false); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rotating slogan + review carousel — shown inside the LocationModal so the
// user has something engaging to look at while we detect / search location.
// Content is baked in on purpose (fast, no API round-trip while modal loads).
// ---------------------------------------------------------------------------
const AD_SLIDES = [
  {
    kind: 'slogan',
    body: 'Celesta Glow products loved by 50,000+ customers',
    sub: 'Clinical-grade anti-aging • cruelty-free • dermatologist tested',
  },
  {
    kind: 'review',
    body: 'Fine lines faded in 3 weeks. Skin honestly looks a decade younger.',
    author: 'Priya · verified buyer',
    stars: 5,
    tag: 'Anti-Aging Serum',
  },
  {
    kind: 'review',
    body: 'Order landed in 45 mins. Genuinely quicker than my food delivery!',
    author: 'Aditi · Bengaluru',
    stars: 5,
    tag: 'Delivery',
  },
  {
    kind: 'review',
    body: 'Rich formula, no sticky finish. My Retinol night routine is set.',
    author: 'Rekha · Mumbai',
    stars: 5,
    tag: 'Age Reset Cream',
  },
  {
    kind: 'review',
    body: 'Packaging is premium and the ingredients list is finally transparent.',
    author: 'Sameera · Kochi',
    stars: 5,
    tag: 'Quality',
  },
];

function AdCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % AD_SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);
  const s = AD_SLIDES[i];
  return (
    <div className="mt-1 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 border border-emerald-100" data-testid="location-modal-ads">
      <div key={i} className="p-4 min-h-[110px] flex flex-col justify-center animate-[fadeIn_.5s_ease-out]">
        {s.kind === 'slogan' ? (
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-black text-emerald-900 leading-snug">{s.body}</p>
              <p className="text-[11px] text-emerald-700/80 mt-1">{s.sub}</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: s.stars }).map((_, k) => <Star key={k} size={11} className="fill-amber-400 text-amber-400" />)}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">{s.tag}</span>
            </div>
            <div className="flex items-start gap-2">
              <Quote size={14} className="text-emerald-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] italic text-gray-800 leading-snug">&ldquo;{s.body}&rdquo;</p>
                <p className="text-[11px] text-gray-500 mt-1">— {s.author}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-1 justify-center pb-2">
        {AD_SLIDES.map((_, k) => (
          <span key={k} className={`h-1 rounded-full transition-all ${k === i ? 'w-4 bg-emerald-600' : 'w-1.5 bg-emerald-200'}`} />
        ))}
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(4px);} to { opacity:1; transform:translateY(0);} }`}</style>
    </div>
  );
}

function LocationModal({ onClose, onDetect, onSelect }) {
  const [q, setQ] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [busy, setBusy] = useState(false);

  // Debounced Places Autocomplete via our backend proxy (no CORS pain).
  useEffect(() => {
    if (!q || q.length < 3) { setPredictions([]); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/geo/autocomplete`, { params: { q } });
        setPredictions(r.data?.predictions || []);
      } catch (_) { setPredictions([]); }
      finally { setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (p) => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/geo/place-details`, { params: { place_id: p.place_id } });
      if (r.data && r.data.lat) onSelect(r.data);
      else alert('Could not resolve that address');
    } catch (_) { alert('Could not resolve address'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="location-modal">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><MapPin size={16} /> Choose delivery location</h3>
            <p className="text-emerald-100 text-xs mt-0.5">Fast delivery available in select areas</p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1 rounded-full hover:bg-white/10" data-testid="location-modal-close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <button
            onClick={onDetect}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-sm border border-emerald-200"
            data-testid="detect-location-btn"
          >
            <NavIcon size={15} /> Use my current location
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search area, locality, landmark or pincode"
              className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              data-testid="location-search-input"
            />
          </div>
          {busy && <div className="text-center text-gray-400"><Loader2 size={16} className="animate-spin inline" /></div>}
          {predictions.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1">
              {predictions.map((p) => (
                <button key={p.place_id} onClick={() => pick(p)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-emerald-50 text-sm">
                  <div className="font-medium text-gray-900 text-sm">{p.main_text || p.description}</div>
                  <div className="text-xs text-gray-500">{p.secondary_text}</div>
                </button>
              ))}
            </div>
          )}
          {/* Ad carousel — keeps the user engaged while they choose location */}
          <AdCarousel />

        </div>
      </div>
    </div>
  );
}
