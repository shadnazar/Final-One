import React, { useState } from 'react';
import axios from 'axios';
import { Star, PenLine, CheckCircle2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * WriteReviewForm — lets a shopper submit a manual review from the product page.
 * Posts to the public POST /api/reviews endpoint. The review is stored as
 * "pending" so an admin approves/edits it before it appears on the storefront.
 */
export default function WriteReviewForm({ productSlug, productName }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', rating: 5, body: '' });
  const [hover, setHover] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (form.name.trim().length < 2) return setErr('Please enter your name');
    if (form.body.trim().length < 10) return setErr('Your review must be at least 10 characters');
    setBusy(true);
    try {
      await axios.post(`${API}/reviews`, {
        name: form.name.trim(),
        location: form.location.trim() || 'India',
        rating: Number(form.rating),
        body: form.body.trim(),
        product_slug: productSlug,
        tag: 'product',
      });
      setDone(true);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Could not submit your review. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-start gap-3" data-testid="review-submitted">
        <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
        <div>
          <p className="font-black text-emerald-900">Thank you for your review!</p>
          <p className="text-sm text-emerald-700">It will appear once our team verifies it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8" data-testid="write-review-section">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-white ring-1 ring-stone-300 hover:ring-emerald-400 text-stone-800 font-bold text-sm px-5 py-3 rounded-full transition-colors"
          data-testid="write-review-open"
        >
          <PenLine size={16} /> Write a review
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-2xl bg-stone-50 border border-stone-200 p-5 space-y-3 max-w-lg" data-testid="write-review-form">
          <p className="font-heading text-lg font-black text-stone-900">Review {productName || 'this product'}</p>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })}
                onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                aria-label={`${n} star`} data-testid={`review-star-${n}`}>
                <Star size={26} className={(hover || form.rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name"
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" data-testid="review-name" />
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City (optional)"
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" data-testid="review-location" />
          </div>

          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} maxLength={400}
            placeholder="Share your honest experience with this product…"
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none" data-testid="review-body" />
          <p className="text-xs text-stone-400">{form.body.length}/400</p>

          {err && <p className="text-xs text-red-600" data-testid="review-error">{err}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-black py-3 rounded-xl text-sm transition-colors" data-testid="review-submit">
              {busy ? 'Submitting…' : 'Submit review'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-5 bg-white ring-1 ring-stone-300 text-stone-700 font-bold rounded-xl text-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
