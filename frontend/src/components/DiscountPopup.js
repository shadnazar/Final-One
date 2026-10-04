import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { X, Sparkles, Check, Loader2, BadgeCheck, ShieldCheck } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Safe localStorage access
const safeLocalStorage = {
  getItem: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
};

const safeTrack = (action, data) => {
  try {
    fetch(`${API}/tracking/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data, timestamp: new Date().toISOString() }),
    }).catch(() => {});
  } catch { /* ignore */ }
};

/**
 * DiscountPopup — rebuilt with the website's product-page palette
 *  - Pure white surface (no purple/green gradient header)
 *  - Black headline + body text on white (high contrast, mixed-tone accents
 *    pulled from the product page: stone-50 background, ring-stone-200,
 *    green-700 + amber-500 highlights for the offer chip)
 *  - Same mobile-first layout, no AI noise
 */
function DiscountPopup({ sessionId, currentPage, onClose }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  useEffect(() => {
    if (safeLocalStorage.getItem('discountClaimed')) onClose();
  }, [onClose]);

  const handleClose = () => {
    safeTrack('popup_dismissed', { popup: 'discount' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the terms and conditions');
      return;
    }
    setLoading(true);
    setError('');
    try {
      safeLocalStorage.setItem('cookieConsent', 'accepted');
      const res = await axios.post(`${API}/claim-discount`, {
        phone: cleanPhone,
        session_id: sessionId || 'unknown',
        page: currentPage || 'homepage',
      });
      if (res.data.success) {
        setSuccess(true);
        const code = res.data.discount_code || 'WELCOME50';
        setDiscountCode(code);
        safeLocalStorage.setItem('discountClaimed', 'true');
        safeLocalStorage.setItem('discountCode', code);
        window.dispatchEvent(new CustomEvent('discountClaimed', { detail: { amount: 50, code } }));
        safeTrack('discount_claimed', { phone: cleanPhone, amount: 50 });
      } else if (res.data.already_claimed) {
        setError('This number has already claimed the discount');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="discount-popup"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.35)] ring-1 ring-stone-200 animate-in fade-in zoom-in-95 duration-300">
        {!success ? (
          <>
            {/* Header — clean white surface, mixed tones from product page */}
            <div className="relative bg-white pt-7 pb-5 px-6">
              <button
                onClick={handleClose}
                type="button"
                aria-label="Close"
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
                data-testid="close-discount-popup"
              >
                <X size={16} />
              </button>

              {/* Eyebrow chip — green-700 + amber-500 inline (matching product-page mixed tones) */}
              <div className="inline-flex items-center gap-1.5 bg-stone-50 ring-1 ring-stone-200 rounded-full px-2.5 py-1 mb-3">
                <Sparkles size={12} className="text-amber-500" />
                <span className="text-[10px] font-bold tracking-[0.32em] uppercase text-green-700">First-Time Offer</span>
              </div>

              <h2 className="font-heading text-3xl font-black text-stone-900 leading-[1.05] tracking-tight">
                Unlock <span className="italic text-green-700">₹50 off</span><br />
                your first order.
              </h2>
              <p className="text-sm text-stone-500 mt-2.5 leading-relaxed">
                Drop your number — we'll save the code to your cart and SMS it to you so checkout is one tap.
              </p>
            </div>

            {/* Form — black on white */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              {error && (
                <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold tracking-[0.2em] uppercase text-stone-700 mb-1.5">
                  Mobile number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3.5 border border-r-0 border-stone-200 bg-stone-50 text-stone-600 text-sm font-bold rounded-l-xl">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 px-4 py-3 border border-stone-200 rounded-r-xl text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all"
                    placeholder="98765 43210"
                    maxLength={10}
                    data-testid="discount-phone-input"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-green-700 focus:ring-green-500"
                  data-testid="terms-checkbox"
                />
                <span className="text-[11px] leading-snug text-stone-500">
                  I agree to the{' '}
                  <Link to="/terms" className="text-stone-900 underline hover:text-green-700" target="_blank">Terms</Link>
                  {' '}&{' '}
                  <Link to="/privacy" className="text-stone-900 underline hover:text-green-700" target="_blank">Privacy Policy</Link>{' '}
                  including marketing texts. Unsubscribe any time.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || phone.length !== 10 || !acceptedTerms}
                className="w-full py-3.5 bg-stone-900 hover:bg-black text-white font-black rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-stone-900/15 hover:shadow-lg active:scale-[0.99]"
                data-testid="claim-discount-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Claiming…
                  </>
                ) : (
                  <>
                    Claim my ₹50 off
                  </>
                )}
              </button>

              {/* Trust strip — mixed accents from product page */}
              <div className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500 pt-2">
                <span className="inline-flex items-center gap-1"><BadgeCheck size={11} className="text-green-700" /> Verified offer</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck size={11} className="text-amber-500" /> SMS-only</span>
                <span className="inline-flex items-center gap-1"><Sparkles size={11} className="text-green-700" /> No spam</span>
              </div>
            </form>
          </>
        ) : (
          /* Success — same white-on-white aesthetic */
          <div className="px-6 pt-8 pb-7 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 ring-1 ring-green-200 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-700" />
            </div>
            <h2 className="font-heading text-2xl font-black text-stone-900 leading-tight">
              You're <span className="italic text-green-700">in</span>.
            </h2>
            <p className="text-sm text-stone-500 mt-1.5">Use this code at checkout to save ₹50.</p>

            <div className="mt-5 mb-5 bg-stone-50 ring-1 ring-stone-200 rounded-2xl py-4 px-5">
              <p className="text-[10px] tracking-[0.32em] uppercase font-bold text-stone-500 mb-1">Your code</p>
              <p className="font-mono text-2xl font-black tracking-[0.2em] text-stone-900">{discountCode || 'WELCOME50'}</p>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="w-full py-3.5 bg-stone-900 hover:bg-black text-white font-black rounded-xl text-sm tracking-wide transition-colors"
              data-testid="start-shopping-btn"
            >
              Start shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscountPopup;
