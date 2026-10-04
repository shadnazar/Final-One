import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '../utils/productImage';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * CertificatesStrip — horizontal grid of every product's lab report image.
 * Renders inline on the homepage; the same data is also used by `/certificates`.
 * Silent no-op when the shop has zero certificates on file.
 */
export default function CertificatesStrip({ compact = false }) {
  const [items, setItems] = useState([]);
  const [openImg, setOpenImg] = useState(null);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API}/api/certificates`).then(r => {
      if (mounted) setItems(Array.isArray(r.data) ? r.data : []);
    }).catch(() => setItems([]));
    return () => { mounted = false; };
  }, []);

  if (!items.length) return null;

  return (
    <section
      className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12"
      data-testid="home-certificates-strip"
    >
      <div className="flex items-end justify-between mb-4 sm:mb-5">
        <div>
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.32em] text-emerald-700 uppercase mb-1 inline-flex items-center gap-1.5">
            <ShieldCheck size={12} /> Independent lab reports
          </p>
          <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 leading-tight">
            Every formula, <span className="italic text-emerald-700">verified</span>
          </h2>
        </div>
        {!compact && (
          <Link
            to="/certificates"
            className="text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
            data-testid="home-certificates-view-all"
          >
            View all <ChevronRight size={14} />
          </Link>
        )}
      </div>

      <div
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-6 sm:px-6 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.slice(0, compact ? 6 : 12).map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setOpenImg(p)}
            className="group relative shrink-0 w-40 sm:w-48 bg-white rounded-2xl ring-1 ring-emerald-100 hover:ring-emerald-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all snap-start overflow-hidden text-left"
            data-testid={`cert-strip-${p.slug}`}
            aria-label={`View certificate for ${p.short_name || p.name}`}
          >
            <div className="aspect-[4/5] bg-emerald-50 flex items-center justify-center overflow-hidden">
              <img
                src={resolveImageUrl(p.test_report_image)}
                alt={`Lab report for ${p.short_name || p.name}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-2.5 sm:p-3">
              <p className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase mb-0.5 flex items-center gap-1">
                <ShieldCheck size={10} /> Certified
              </p>
              <p className="text-xs sm:text-sm font-black text-stone-900 leading-snug line-clamp-2">
                {p.short_name || p.name}
              </p>
              {p.test_report_lab && (
                <p className="text-[10px] text-stone-500 truncate mt-0.5">{p.test_report_lab}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {openImg && (
        <div
          className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_180ms_ease-out]"
          onClick={() => setOpenImg(null)}
          data-testid="cert-strip-lightbox"
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl overflow-hidden">
              <img
                src={resolveImageUrl(openImg.test_report_image)}
                alt={`Lab report for ${openImg.short_name || openImg.name}`}
                className="w-full h-auto object-contain max-h-[85vh]"
              />
              <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-stone-900">{openImg.short_name || openImg.name}</p>
                  {openImg.test_report_lab && <p className="text-[11px] text-stone-500">{openImg.test_report_lab}</p>}
                </div>
                <Link
                  to={`/product/${openImg.slug}`}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  onClick={() => setOpenImg(null)}
                >
                  View product →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
