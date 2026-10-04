import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * NicheHero — single banner card with the artwork as background and text overlay
 * on the LEFT half. Compact on mobile (no wasted space).
 *
 * Props:
 *  - bgImage           Desktop banner artwork URL (used everywhere if mobileBgImage absent)
 *  - mobileBgImage     Optional separate banner image for screens < sm (more compact crop)
 *  - eyebrow           Small uppercase tagline (e.g. "SKINCARE NICHE")
 *  - eyebrowDot        Hex color for the pulsing dot
 *  - eyebrowText       Hex color for the eyebrow chip text
 *  - title             ReactNode — first line + italic second line
 *  - subtitle          Paragraph
 *  - cta1 / cta2       { label, to } pill button objects
 *  - accent / accentDark   Hex — primary button bg / hover bg
 *  - testId
 */
export default function NicheHero({
  bgImage,
  mobileBgImage,
  eyebrow,
  eyebrowDot = '#0e7490',
  eyebrowText = '#155e75',
  title,
  subtitle,
  cta1,
  cta2,
  accent = '#0e7490',
  accentDark = '#155e75',
  testId = 'niche-hero',
}) {
  const mobileImg = mobileBgImage || bgImage;
  return (
    <section className="px-3 sm:px-6 pt-3 sm:pt-6" data-testid={testId}>
      <div className="max-w-7xl mx-auto relative overflow-hidden rounded-2xl sm:rounded-3xl ring-1 ring-stone-200/70 shadow-sm bg-stone-100">
        {/* Background banner artwork — separate <img> for mobile vs desktop.
            Mobile gets a proper min-height + centered crop so the banner is
            never awkwardly cut/squished on small screens. */}
        <img src={mobileImg} alt="" loading="eager" fetchpriority="high" decoding="async" aria-hidden className="absolute inset-0 w-full h-full object-cover object-center sm:hidden" />
        <img src={bgImage}    alt="" loading="eager" fetchpriority="high" decoding="async" aria-hidden className="absolute inset-0 w-full h-full object-cover object-right hidden sm:block" />

        {/* Left-fading legibility overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.62) 30%, rgba(255,255,255,0.22) 56%, rgba(255,255,255,0) 75%)',
          }}
        />

        {/* Content overlay */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12">
          <div className="col-span-7 px-4 py-5 sm:px-8 sm:pt-12 sm:pb-6 lg:px-12 lg:pt-16 lg:pb-8 max-w-[680px] min-h-[380px] sm:min-h-0 flex flex-col justify-end">
            {eyebrow && (
              <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur ring-1 ring-stone-200 px-2.5 py-1 rounded-full mb-2 sm:mb-4 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: eyebrowDot }} />
                <span className="text-[9px] sm:text-[10px] font-black tracking-[0.28em] uppercase" style={{ color: eyebrowText }}>
                  {eyebrow}
                </span>
              </div>
            )}
            <h1 className="font-heading text-[22px] sm:text-4xl lg:text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight text-stone-900 mb-1.5 sm:mb-3">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] sm:text-base lg:text-lg text-stone-700/80 max-w-md leading-snug sm:leading-relaxed mb-3 sm:mb-6">
                {subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {cta1 && (
                <Link
                  to={cta1.to}
                  data-testid={`${testId}-cta1`}
                  className="text-white px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-bold text-[11px] sm:text-sm tracking-tight flex items-center gap-1.5 shadow-lg transition-all hover:-translate-y-0.5"
                  style={{ background: accent }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = accentDark)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = accent)}
                >
                  {cta1.label} <ArrowRight size={12} />
                </Link>
              )}
              {cta2 && (
                <Link
                  to={cta2.to}
                  data-testid={`${testId}-cta2`}
                  className="bg-white/95 backdrop-blur ring-1 ring-stone-300 text-stone-900 hover:bg-white px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-bold text-[11px] sm:text-sm tracking-tight flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
                >
                  <Sparkles size={11} style={{ color: accent }} /> {cta2.label}
                </Link>
              )}
            </div>
          </div>
          {/* Right column reserves space so artwork product remains visible (desktop only) */}
          <div className="col-span-5 hidden sm:block min-h-[260px] lg:min-h-[360px]" />
        </div>
      </div>
    </section>
  );
}
