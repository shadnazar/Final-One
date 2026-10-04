import React, { useEffect, useState, useRef, memo } from 'react';
import axios from 'axios';
import { Star, BadgeCheck, Quote, Truck, Sparkles, ShieldCheck, Award, Headphones } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TAG_ICON = {
  product: Sparkles,
  brand: Award,
  delivery: Truck,
  quality: ShieldCheck,
  service: Headphones,
};

const TAG_LABEL = {
  product: 'Product',
  brand: 'Brand',
  delivery: 'Delivery',
  quality: 'Quality',
  service: 'Service',
};

/**
 * ReviewsCarousel
 * Pulls reviews from /api/reviews and renders an infinite, marquee-style
 * horizontal auto-scroll. Pauses on hover/touch. Ships on Homepage,
 * ProductDetailPage and CartPage.
 */
function ReviewsCarousel({ title = 'Loved by customers across India', eyebrow = 'Real reviews · Verified buyers' }) {
  const [reviews, setReviews] = useState([]);
  const trackRef = useRef(null);

  useEffect(() => {
    axios
      .get(`${API}/api/reviews?limit=40`)
      .then(r => setReviews(Array.isArray(r.data) ? r.data : []))
      .catch(() => setReviews([]));
  }, []);

  if (!reviews.length) return null;

  // Duplicate the list so the marquee scroll has no visible seam.
  const loop = [...reviews, ...reviews];

  return (
    <section className="bg-gradient-to-b from-white via-stone-50 to-white py-10 sm:py-14 overflow-hidden" data-testid="reviews-carousel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 sm:mb-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5 text-green-700">{eyebrow}</p>
            <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
              {title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="italic text-green-700">{title.split(' ').slice(-1)[0]}</span>
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
            ))}
            <span className="text-xs text-stone-600 font-bold ml-1">4.9 / 5 · 12,400+</span>
          </div>
        </div>
      </div>

      {/* Marquee track */}
      <div className="reviews-marquee group relative" data-testid="reviews-marquee">
        <div className="reviews-track flex gap-4 sm:gap-5 px-4 sm:px-6 will-change-transform" ref={trackRef}>
          {loop.map((r, i) => {
            const Icon = TAG_ICON[r.tag] || Sparkles;
            return (
              <article
                key={`${r.id || i}-${i}`}
                className="flex-shrink-0 w-[280px] sm:w-[320px] bg-white rounded-2xl ring-1 ring-stone-200 hover:ring-green-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all p-5 sm:p-6 relative"
                data-testid={`review-card-${i}`}
              >
                <Quote size={28} className="absolute top-3 right-3 text-stone-100" />
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(r.rating || 5)].map((_, k) => (
                    <Star key={k} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[13px] sm:text-sm leading-relaxed text-stone-700 mb-4 line-clamp-5">"{r.body}"</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-black text-stone-900 leading-tight">
                      {r.name}
                      {r.age && <span className="text-stone-400 font-medium"> · {r.age}</span>}
                    </p>
                    <p className="text-[11px] text-stone-500">{r.location}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-green-700">
                    <Icon size={11} />
                    <span>{TAG_LABEL[r.tag] || 'Customer'}</span>
                  </div>
                </div>
                {(r.verified !== false || r.days) && (
                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-3 text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    {r.verified !== false && (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <BadgeCheck size={11} /> Verified
                      </span>
                    )}
                    {r.days && <span>{r.days}-day result</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default memo(ReviewsCarousel);
