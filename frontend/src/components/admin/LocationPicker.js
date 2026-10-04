import React, { useEffect, useRef, useState } from 'react';
import { Locate, MapPin } from 'lucide-react';

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const FALLBACK = { lat: 11.2588, lng: 75.7804 };

let sdkPromise = null;
function loadMapsSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google);
    if (!GMAPS_KEY) return reject(new Error('Google Maps key missing'));
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * LocationPicker — compact Google-map with a draggable pin used to capture
 * lat/lng for an admin record (currently: warehouses). Uses the same JS SDK
 * loader as CheckoutMap so we don't fetch it twice.
 *
 * Props:
 *   value    : { lat, lng } | null (nullable — falls back to Kozhikode)
 *   onChange : ({ lat, lng }) => void
 *   height   : string  (Tailwind height class, default h-40)
 */
export default function LocationPicker({ value, onChange, height = 'h-40' }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [err, setErr] = useState('');
  const initial = value?.lat && value?.lng ? value : FALLBACK;

  useEffect(() => {
    let cancelled = false;
    loadMapsSdk().then((google) => {
      if (cancelled || !mapDivRef.current) return;
      const map = new google.maps.Map(mapDivRef.current, {
        center: initial, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        gestureHandling: 'greedy',
      });
      const marker = new google.maps.Marker({
        position: initial, map, draggable: true,
        animation: google.maps.Animation.DROP,
      });
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        onChange && onChange({ lat: p.lat(), lng: p.lng() });
      });
      map.addListener('click', (e) => {
        marker.setPosition(e.latLng);
        onChange && onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      mapRef.current = map;
      markerRef.current = marker;
    }).catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If parent updates value externally, move the marker.
  useEffect(() => {
    if (value?.lat && value?.lng && markerRef.current && mapRef.current) {
      markerRef.current.setPosition(value);
      mapRef.current.setCenter(value);
    }
  }, [value?.lat, value?.lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (markerRef.current) markerRef.current.setPosition(next);
      if (mapRef.current) { mapRef.current.setCenter(next); mapRef.current.setZoom(16); }
      onChange && onChange(next);
    }, () => {}, { enableHighAccuracy: true, timeout: 12000 });
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white" data-testid="location-picker">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-emerald-50/40">
        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
          <MapPin size={12} /> Drag or click on the map
        </div>
        <button type="button" onClick={useMyLocation}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-[11px] font-bold"
          data-testid="picker-locate">
          <Locate size={10} /> Locate me
        </button>
      </div>
      <div ref={mapDivRef} className={`w-full ${height} bg-gray-100`} data-testid="picker-map" />
      {err && <p className="text-xs text-rose-600 px-3 py-1">{err}</p>}
    </div>
  );
}
