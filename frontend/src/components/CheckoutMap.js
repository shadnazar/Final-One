import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MapPin, Zap, Truck, Loader2, Locate } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Kozhikode centre as a sensible starting fallback.
const FALLBACK = { lat: 11.2588, lng: 75.7804 };

let sdkPromise = null;
function loadMapsSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google);
    if (!GMAPS_KEY) return reject(new Error('Google Maps key missing'));
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * CheckoutMap — draggable pin on Google Maps, integrated with the coverage
 * checker so we can decide Instant vs Standard delivery in real time.
 *
 * Props:
 *   initial     : { lat, lng } | null       (from LocationStrip)
 *   onChange    : ({ lat, lng, coverage, address }) => void
 *
 * Behaviour:
 *   1. Auto-drops the pin on `initial` (falls back to Kozhikode).
 *   2. On every drag-end → reverse-geocode + hit /api/delivery/coverage.
 *   3. Emits { lat, lng, coverage, address } via onChange.
 */
export default function CheckoutMap({ initial, onChange }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [center, setCenter] = useState(initial || FALLBACK);
  const [coverage, setCoverage] = useState(null);
  const [geo, setGeo] = useState(null);   // full reverse-geocode payload (city/state/pincode)
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  // Emit changes upstream — parent uses this to populate order payload +
  // auto-fill the address form (city / state / pincode / area).
  useEffect(() => {
    if (!coverage) return;
    onChange && onChange({
      lat: center.lat,
      lng: center.lng,
      coverage,
      address: geo?.formatted || '',
      city: geo?.city || '',
      state: geo?.state || '',
      pincode: geo?.pincode || '',
      locality: geo?.locality || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverage, center.lat, center.lng, geo]);

  // Boot: load SDK, mount map + marker.
  useEffect(() => {
    let cancelled = false;
    loadMapsSdk()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          center: initial || FALLBACK,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });
        const marker = new google.maps.Marker({
          position: initial || FALLBACK,
          map, draggable: true,
          animation: google.maps.Animation.DROP,
        });
        marker.addListener('dragend', () => {
          const p = marker.getPosition();
          const next = { lat: p.lat(), lng: p.lng() };
          setCenter(next);
          resolvePoint(next);
        });
        map.addListener('click', (e) => {
          const next = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(next);
          setCenter(next);
          resolvePoint(next);
        });
        mapRef.current = map;
        markerRef.current = marker;
        resolvePoint(initial || FALLBACK);
      })
      .catch((e) => { if (!cancelled) { setErr(e.message); setBusy(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse-geocode + coverage check in parallel.
  const resolvePoint = async ({ lat, lng }) => {
    setBusy(true);
    try {
      const [rg, cov] = await Promise.all([
        axios.get(`${API}/geo/reverse-geocode`, { params: { lat, lng } }).then(r => r.data).catch(() => null),
        axios.get(`${API}/delivery/coverage`, { params: { lat, lng } }).then(r => r.data).catch(() => null),
      ]);
      if (rg) setGeo(rg);
      if (cov) setCoverage(cov);
    } finally { setBusy(false); }
  };

  // "Use my current location" — GPS + drop the pin there.
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCenter(next);
      if (markerRef.current) markerRef.current.setPosition(next);
      if (mapRef.current) { mapRef.current.setCenter(next); mapRef.current.setZoom(16); }
      resolvePoint(next);
    }, () => { /* denied — do nothing */ }, { enableHighAccuracy: true, timeout: 12000 });
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white" data-testid="checkout-map-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-emerald-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={16} className="text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest font-black uppercase text-emerald-700">Delivery Point</p>
            <p className="text-xs text-gray-600 truncate">Drag the pin to your exact door</p>
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-bold"
          data-testid="use-my-location-btn"
        >
          <Locate size={12} /> Locate me
        </button>
      </div>

      <div ref={mapDivRef} className="w-full h-56 sm:h-64 bg-gray-100" data-testid="checkout-map" />

      <div className="px-4 py-3 space-y-2">
        {err && <p className="text-xs text-rose-600">{err}</p>}
        {geo?.formatted && (
          <p className="text-xs text-gray-600 line-clamp-2" data-testid="checkout-map-address">
            <span className="font-semibold text-gray-800">Pin address:</span> {geo.formatted}
          </p>
        )}
        {busy ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Checking coverage…
          </div>
        ) : coverage?.instant_available ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200" data-testid="delivery-badge-instant">
            <Zap size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs leading-snug">
              <p className="font-bold text-amber-700">Instant delivery available</p>
              <p className="text-gray-500 mt-0.5">
                {coverage.nearest_warehouse?.distance_km <= 5
                  ? 'Fastest · arrives in 45–55 minutes'
                  : 'Fast · arrives in 1–2 hours'}
              </p>
            </div>
          </div>
        ) : coverage ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200" data-testid="delivery-badge-standard">
            <Truck size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <div className="text-xs leading-snug">
              <p className="font-bold text-slate-700">Standard delivery</p>
              <p className="text-gray-500 mt-0.5">Arrives in 3–5 business days via courier</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
