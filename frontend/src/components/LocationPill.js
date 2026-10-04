import React, { useEffect, useState } from 'react';
import { MapPin, ChevronDown, Loader2, Search, X, Navigation as NavIcon } from 'lucide-react';

const STORAGE_KEY = 'cg_delivery_location';
const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

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
  if (!GMAPS_KEY) return null;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`);
    const d = await r.json();
    const first = d?.results?.[0];
    if (!first) return null;
    const comps = first.address_components || [];
    const grab = (types) => comps.find(c => types.some(t => c.types.includes(t)))?.long_name || '';
    return {
      lat, lng,
      formatted: first.formatted_address,
      locality: grab(['sublocality_level_1', 'sublocality', 'neighborhood']) || grab(['locality']),
      city: grab(['locality']) || grab(['administrative_area_level_2']),
      district: grab(['administrative_area_level_2']),
      state: grab(['administrative_area_level_1']),
      pincode: grab(['postal_code']),
      place_id: first.place_id,
    };
  } catch (_) { return null; }
}

/**
 * LocationPill — header pill matching the reference screenshot:
 *   "Delivering to Kottooli, Kozhikode · 30-45 min · Change"
 * Tap to open a modal where the customer can allow geolocation, search
 * for an area, or manually enter a pincode. Stored in localStorage; the
 * pill re-hydrates on every page.
 */
export default function LocationPill() {
  const [loc, setLoc] = useState(loadStored());
  const [open, setOpen] = useState(false);

  const detect = async () => {
    if (!navigator.geolocation) return alert('Location not supported on this browser');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const info = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (info) { save(info); setLoc(info); setOpen(false); }
      else alert('Could not identify your location. Please search manually.');
    }, () => alert('Please allow location permission'), { enableHighAccuracy: true, timeout: 12000 });
  };

  const label = loc ? `${loc.locality || loc.city || 'Set location'}${loc.district && loc.locality ? ', ' + loc.district : ''}` : 'Select delivery location';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 max-w-[220px] px-2.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-100 transition-colors"
        data-testid="location-pill"
      >
        <MapPin size={13} className="text-emerald-600 shrink-0" />
        <span className="truncate">{label}</span>
        {loc && <span className="text-[10px] text-emerald-600 hidden sm:inline">· 30-45 min</span>}
        <ChevronDown size={12} className="text-emerald-500 shrink-0" />
      </button>
      {open && <LocationModal onClose={() => setOpen(false)} onDetect={detect} onSelect={(l) => { save(l); setLoc(l); setOpen(false); }} />}
    </>
  );
}

function LocationModal({ onClose, onDetect, onSelect }) {
  const [q, setQ] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [busy, setBusy] = useState(false);

  // Debounced Google Places Autocomplete via REST API
  useEffect(() => {
    if (!q || q.length < 3 || !GMAPS_KEY) { setPredictions([]); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${GMAPS_KEY}`);
        const d = await r.json();
        setPredictions(d?.predictions || []);
      } catch (_) { setPredictions([]); }
      finally { setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (p) => {
    setBusy(true);
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&key=${GMAPS_KEY}`);
      const d = await r.json();
      const g = d?.result?.geometry?.location;
      if (g) {
        const info = await reverseGeocode(g.lat, g.lng);
        if (info) onSelect(info);
      }
    } catch (_) { alert('Could not resolve address'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="location-modal">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><MapPin size={16} /> Choose delivery location</h3>
            <p className="text-emerald-100 text-xs mt-0.5">Fast delivery available in select areas</p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1 rounded-full hover:bg-white/10"><X size={18} /></button>
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
                  <div className="font-medium text-gray-900 text-sm">{p.structured_formatting?.main_text || p.description}</div>
                  <div className="text-xs text-gray-500">{p.structured_formatting?.secondary_text}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
