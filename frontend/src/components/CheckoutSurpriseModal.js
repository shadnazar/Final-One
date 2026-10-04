import React, { useEffect, useState, useRef } from 'react';
import { Gift, Clock, X, Sparkles, Check } from 'lucide-react';

/**
 * ScratchCard — <canvas> overlay that erases as the user drags a finger /
 * mouse across it. Once the erased area exceeds `revealThreshold` (default
 * 45 %), we fire `onReveal` so the parent can swap in the prize UI. Falls
 * back to a plain "Tap to reveal" button if canvas isn't supported.
 */
function ScratchCard({ onReveal, gift, amount, revealThreshold = 0.45 }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const revealedRef = useRef(false);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) { setReady(false); return; }
    // Paint the scratch layer with a warm gradient and a "SCRATCH HERE" label
    const grad = ctx.createLinearGradient(0, 0, cvs.width, cvs.height);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#f97316');
    grad.addColorStop(1, '#e11d48');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH HERE', cvs.width / 2, cvs.height / 2 - 8);
    ctx.font = 'bold 10px system-ui,-apple-system,sans-serif';
    ctx.fillText('drag to reveal', cvs.width / 2, cvs.height / 2 + 10);
    setReady(true);
  }, []);

  const scratchAt = (x, y) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkProgress = () => {
    if (revealedRef.current) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const { data } = ctx.getImageData(0, 0, cvs.width, cvs.height);
    let cleared = 0;
    // Sample every 4th pixel to keep this cheap enough for mousemove
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] === 0) cleared += 1;
    }
    const total = data.length / 16;
    const pct = cleared / total;
    setProgress(pct);
    if (pct >= revealThreshold) {
      revealedRef.current = true;
      onReveal && onReveal();
    }
  };

  const onPointer = (e) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (cvs.width / rect.width);
    const y = (clientY - rect.top) * (cvs.height / rect.height);
    scratchAt(x, y);
    checkProgress();
  };

  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-3xl overflow-hidden ring-4 ring-white/70 shadow-[0_20px_50px_-10px_rgba(245,158,11,0.55)]"
      style={{ background: '#fff' }}
      data-testid="checkout-surprise-scratch-card"
    >
      {/* The prize preview underneath the scratch layer */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
        {gift && gift.image ? (
          <img src={gift.image} alt={gift.name || 'Free gift'} className="w-20 h-20 object-contain mb-1" />
        ) : (
          <Gift size={44} className="text-amber-600 mb-1" strokeWidth={2.2} />
        )}
        <p className="text-[10px] font-black tracking-[0.2em] text-orange-700 uppercase">
          {gift ? 'FREE' : `₹${amount} OFF`}
        </p>
        {gift && gift.mrp && (
          <p className="text-[10px] font-bold text-emerald-700">Worth ₹{gift.mrp}</p>
        )}
      </div>

      {ready && (
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => { setDragging(true); onPointer(e); }}
          onMouseMove={(e) => { if (dragging) onPointer(e); }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onTouchStart={(e) => { setDragging(true); onPointer(e); }}
          onTouchMove={(e) => { if (dragging) { e.preventDefault(); onPointer(e); } }}
          onTouchEnd={() => setDragging(false)}
        />
      )}
      {/* Progress hint */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/90 tracking-widest pointer-events-none">
        {Math.min(100, Math.round(progress * 100))}%
      </div>
    </div>
  );
}

/**
 * CheckoutSurpriseModal — one-shot flash gift reveal that greets the customer
 * the first time they land on /checkout. Presentation only (server-side
 * enforcement of the ₹50 discount still lives in /api/cart/validate — this
 * modal just makes the perk feel earned).
 *
 * Behaviour:
 *   • Renders after a short delay so the checkout paints first
 *   • Two-step reveal: closed gift box → confetti + ₹50 headline
 *   • "Claim my ₹50" auto-dismisses; also closes on backdrop + X click
 *   • sessionStorage guard so the modal never fires twice in one session
 */
export default function CheckoutSurpriseModal({
  amount = 50,
  gift = null,          // { slug, name, image, mrp } — when set, reveals a free product instead
  minSubtotal = 1000,
  timerLabel = '10-minute flash offer',
  onClaim,
  storageKey = 'cg_checkout_surprise_v2',
}) {
  const [show, setShow] = useState(false);
  // Reveal is instant now (no scratch interaction). Kept as state to preserve
  // the confetti / glow animation trigger that fires on the first paint.
  const [revealed] = useState(true);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(storageKey) === '1'; } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => {
      setShow(true);
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }, 700);
    return () => clearTimeout(t);
  }, [storageKey]);

  const close = () => {
    setShow(false);
  };

  const claim = () => {
    try { onClaim && onClaim(amount); } catch { /* ignore */ }
    close();
  };

  if (!show) return null;

  return (
    <div
      data-testid="checkout-surprise-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-[fadeIn_240ms_ease-out]"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={close}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.06) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes wiggle { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
        @keyframes confetti { 0% { transform: translateY(-40px) rotate(0deg); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(140px) rotate(360deg); opacity: 0 } }
        @keyframes glow { 0%,100% { box-shadow: 0 20px 60px -10px rgba(245,158,11,0.55) } 50% { box-shadow: 0 20px 90px -6px rgba(245,158,11,0.85) } }
      `}</style>

      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden ring-1 ring-amber-200/60"
        style={{ animation: 'popIn 380ms cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warm gradient shell */}
        <div className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-6 py-7 sm:py-8">
          {/* Close */}
          <button
            onClick={close}
            aria-label="Close surprise"
            data-testid="checkout-surprise-close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-stone-500 hover:text-stone-800 flex items-center justify-center shadow-sm"
          >
            <X size={16} />
          </button>

          {/* Eyebrow */}
          <p className="text-[10px] font-black tracking-[0.32em] text-orange-700 uppercase mb-2 text-center flex items-center justify-center gap-1.5">
            <Sparkles size={12} /> A little surprise for you
          </p>

          {/* Gift / Reveal — shows the prize directly (no interaction needed) */}
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="relative w-full flex flex-col items-center">
              {/* Confetti dots */}
              {['#f59e0b','#ef4444','#10b981','#8b5cf6','#f43f5e','#0ea5e9','#eab308'].map((c, i) => (
                <span
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    top: 0,
                    left: `${10 + i * 12}%`,
                    background: c,
                    animation: `confetti ${900 + i * 120}ms ${i * 60}ms ease-in forwards`,
                  }}
                />
              ))}
              <div
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white ring-4 ring-amber-200/70 flex items-center justify-center mb-2 overflow-hidden"
                style={{ animation: 'glow 2s ease-in-out infinite' }}
              >
                {gift && gift.image ? (
                  <img src={gift.image} alt={gift.name} className="w-full h-full object-contain p-1" data-testid="checkout-surprise-gift-image" />
                ) : (
                  <div className="text-center leading-none">
                    <p className="text-[10px] font-black tracking-[0.2em] text-amber-700 uppercase mb-1">FLAT</p>
                    <p className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-amber-600 to-rose-600 bg-clip-text text-transparent">₹{amount}</p>
                    <p className="text-[10px] font-black tracking-[0.24em] text-orange-700 uppercase mt-0.5">OFF</p>
                  </div>
                )}
              </div>
              {/* MRP callout — always show for a free product so the value
                  of the giveaway is unmistakable. */}
              {gift && gift.mrp && (
                <div className="mt-1 flex items-center gap-2" data-testid="checkout-surprise-gift-mrp">
                  <span className="text-[10px] font-bold tracking-[0.24em] text-stone-500 uppercase">Worth</span>
                  <span className="text-lg font-black text-emerald-700">₹{gift.mrp}</span>
                  <span className="text-[11px] line-through text-stone-400">MRP ₹{gift.mrp}</span>
                </div>
              )}
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-center font-heading text-lg sm:text-xl font-black text-stone-900 leading-tight">
            {gift ? (
              <>You unlocked a <span className="italic text-emerald-700">FREE {gift.name}</span></>
            ) : (
              <>You just unlocked <span className="italic text-orange-700">₹{amount} OFF</span></>
            )}
          </h2>

          {/* Sub */}
          <p className="text-center text-[12px] sm:text-[13px] text-stone-600 mt-1.5 leading-snug px-1">
            {gift ? (
              <>Worth <b>₹{gift.mrp}</b> — added FREE to your order when paid <b>prepaid</b>. No code needed.</>
            ) : (
              <>Applied automatically at checkout when your cart is above <b>₹{minSubtotal}</b> and paid <b>prepaid</b>.</>
            )}
          </p>

          {/* Timer + CTA */}
          <div className="mt-5 space-y-2">
            <button
              onClick={claim}
              data-testid="checkout-surprise-claim"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full font-black text-sm py-3 shadow-lg transition-all bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-white active:scale-[0.98]"
            >
              {gift
                ? (<><Check size={16} strokeWidth={2.8} /> Claim my FREE gift</>)
                : (<><Check size={16} strokeWidth={2.8} /> Claim my ₹{amount} OFF</>)}
            </button>
            <p className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
              <Clock size={11} /> Locked to this checkout session
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
