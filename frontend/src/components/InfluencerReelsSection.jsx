import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Play, X, Instagram, Youtube, Users } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * InfluencerReelsSection
 * ────────────────────────
 * Auto-swiping horizontal carousel of creator videos assigned to a product.
 *
 *  • Tap a card → full-screen video modal.
 *  • Cards ratio 9:16 (portrait reel), thumbnails prefer `thumbnail_url`,
 *    fall back to a poster frame from the video (`<video preload="metadata">`).
 *  • Auto-scrolls every 4s (pauses on hover / when modal open).
 *  • Silent no-op when no reels exist for this product.
 */
export default function InfluencerReelsSection({ productSlug }) {
  const [reels, setReels] = useState([]);
  const [openReel, setOpenReel] = useState(null);
  const railRef = useRef(null);
  const [pauseAuto, setPauseAuto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = productSlug
      ? `${API}/api/reels/list?product_slug=${encodeURIComponent(productSlug)}&limit=200`
      : `${API}/api/reels/list?limit=200`;
    axios.get(url).then((r) => {
      if (!cancelled) setReels(r.data?.items || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [productSlug]);

  // Auto-swipe every 4s
  useEffect(() => {
    if (!reels.length || pauseAuto || openReel) return;
    const id = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;
      const card = rail.querySelector('[data-reel-card]');
      const step = card ? card.offsetWidth + 12 : 240;
      const atEnd = Math.abs(rail.scrollLeft + rail.clientWidth - rail.scrollWidth) < 20;
      rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + step, behavior: 'smooth' });
    }, 4000);
    return () => clearInterval(id);
  }, [reels, pauseAuto, openReel]);

  const openVideo = (reel) => {
    setOpenReel(reel);
    // Fire-and-forget view counter
    axios.post(`${API}/api/reels/${reel.id}/view`).catch(() => {});
  };

  if (!reels.length) return null;

  return (
    <section
      className="max-w-5xl mx-auto px-4 my-10"
      data-testid="influencer-reels-section"
      onMouseEnter={() => setPauseAuto(true)}
      onMouseLeave={() => setPauseAuto(false)}
    >
      {/* Heading */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[11px] font-black tracking-widest uppercase text-rose-600 mb-1">
            <Users size={12} className="inline mb-0.5 mr-1" /> Real creators, real routines
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Loved by Creators
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-gray-500 hidden sm:inline">
          Tap any reel to play →
        </span>
      </div>

      {/* Horizontal auto-swiping rail */}
      <div
        ref={railRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        data-testid="reels-rail"
      >
        <style>{`[data-testid="reels-rail"]::-webkit-scrollbar{display:none}`}</style>
        {reels.map((reel) => (
          <button
            key={reel.id}
            data-reel-card
            onClick={() => openVideo(reel)}
            data-testid={`reel-card-${reel.id}`}
            className="relative flex-shrink-0 w-[150px] sm:w-[180px] aspect-[9/16] rounded-2xl overflow-hidden bg-black snap-start group focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {reel.thumbnail_url ? (
              <img
                src={reel.thumbnail_url}
                alt={reel.creator_name || 'Reel'}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <video
                src={reel.video_url}
                muted
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Gradient scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            {/* Play badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play size={16} className="text-rose-600 ml-0.5" fill="currentColor" />
            </div>
            {/* Bottom overlay text */}
            <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
              <p className="text-white text-[12px] font-bold leading-tight truncate">
                {reel.creator_name || 'Creator'}
              </p>
              {reel.creator_handle && (
                <p className="text-white/85 text-[10px] font-medium truncate">
                  {reel.creator_handle}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Full-screen video modal */}
      {openReel && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpenReel(null)}
          data-testid="reel-modal"
        >
          <button
            onClick={() => setOpenReel(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
            aria-label="Close video"
            data-testid="reel-modal-close"
          >
            <X size={20} />
          </button>
          <div
            className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={openReel.id}
              src={openReel.video_url}
              controls
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
          </div>
          {/* Caption row */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[420px] w-[calc(100%-32px)] px-4 text-center text-white pointer-events-none">
            <p className="font-bold text-[15px] truncate">{openReel.creator_name}</p>
            {openReel.creator_handle && (
              <a
                href={
                  openReel.creator_handle.startsWith('http')
                    ? openReel.creator_handle
                    : `https://instagram.com/${openReel.creator_handle.replace(/^@/, '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-white/85 hover:text-white pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram size={12} /> {openReel.creator_handle}
              </a>
            )}
            {openReel.caption && (
              <p className="text-[12px] text-white/80 mt-1 line-clamp-2">{openReel.caption}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
