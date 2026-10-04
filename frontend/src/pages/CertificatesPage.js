import React from 'react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, ChevronLeft } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { resolveImageUrl } from '../utils/productImage';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * CertificatesPage — one-page trust hub showing every product certificate
 * (lab reports, dermatological approvals, safety tests). Reached via the
 * "View all" link on the homepage strip or the footer.
 */
export default function CertificatesPage() {
  const [items, setItems] = useState([]);
  const [openImg, setOpenImg] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/certificates`).then(r => {
      setItems(Array.isArray(r.data) ? r.data : []);
    }).catch(() => setItems([]));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50/40" data-testid="certificates-page">
      <SEOHead
        title="Independent Lab Reports & Certificates | Celesta Glow"
        description="Every Celesta Glow formula is independently tested and certified. Browse the full list of dermatological approvals, ingredient assays and safety reports."
        canonicalPath="/certificates"
      />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 mb-4" data-testid="certificates-back">
          <ChevronLeft size={14} /> Home
        </Link>

        <div className="mb-8 sm:mb-10 text-center">
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.32em] text-emerald-700 uppercase mb-2 inline-flex items-center gap-1.5">
            <ShieldCheck size={12} /> Independent lab reports · Third-party verified
          </p>
          <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-black text-stone-900 leading-tight">
            Every formula, <span className="italic text-emerald-700">verified</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-stone-600 max-w-2xl mx-auto">
            No stock photos, no fine print. Tap any card to zoom into the actual signed lab report we hold on file for that product.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-sm text-stone-500">Certificates are being prepared. Please check back shortly.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setOpenImg(p)}
                className="group bg-white rounded-2xl ring-1 ring-emerald-100 hover:ring-emerald-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all overflow-hidden text-left"
                data-testid={`cert-page-${p.slug}`}
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
                <div className="p-3">
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
        )}
      </div>

      {openImg && (
        <div
          className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpenImg(null)}
          data-testid="cert-page-lightbox"
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
    </div>
  );
}
