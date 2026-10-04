import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Gift, Copy, Check, Share2, Wallet, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * ReferralWidget — embedded inside the customer's /account page.
 *
 * Shows:
 *  • The user's share link
 *  • Lifetime / withdrawable / pending balances
 *  • Per-order timeline of every referred purchase
 *  • "Request Withdrawal" form (UPI / bank) when balance > 0
 *
 * Identification: we look up by email first, then phone (the customer auth
 * flow is email-OTP, so email is the most reliable key).
 */
export default function ReferralWidget({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('upi');
  const [payoutDest, setPayoutDest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // {success, msg}

  const load = useCallback(async () => {
    if (!user?.email && !user?.phone) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user.email) params.set('email', user.email);
      if (user.phone) params.set('phone', user.phone);
      const r = await axios.get(`${API}/api/referral/customer-summary?${params.toString()}`);
      setSummary(r.data?.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm px-5 py-4" data-testid="referral-widget-loading">
        <p className="text-xs text-stone-500">Loading referral details…</p>
      </div>
    );
  }

  if (!summary) {
    // First-time customers won't have a referral record until they place an
    // order (that's where create_referral runs). Show a friendly empty state.
    return (
      <div className="bg-gradient-to-br from-emerald-50 via-stone-50 to-rose-50 rounded-3xl ring-1 ring-emerald-200 px-5 py-5" data-testid="referral-widget-empty">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={16} className="text-emerald-700" />
          <h2 className="font-heading text-base font-black text-stone-900">Earn ₹50 per friend</h2>
        </div>
        <p className="text-xs text-stone-600">Place your first order to unlock your referral link. Then share it — your friend gets ₹50 off (orders ₹500+) and you earn ₹50 cashback after their order is delivered.</p>
      </div>
    );
  }

  const link = summary.referral_link || `https://celestaglow.com?ref=${summary.referral_code}`;
  const balance = summary.earnings_withdrawable || 0;
  const pending = summary.earnings_pending || 0;
  const paid = summary.earnings_paid || 0;
  const lifetime = summary.total_earnings || 0;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nativeShare = async () => {
    const title = `Get ₹${summary.discount_per_referred} off at Celesta Glow`;
    const text  = `Hey! I love Celesta Glow's skincare. Use my link and get ₹${summary.discount_per_referred} off your first order over ₹${summary.min_order_amount}: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url: link }); return; } catch {}
    }
    copyLink();
  };

  const submitWithdraw = async () => {
    setSubmitting(true);
    setRequestStatus(null);
    try {
      const r = await axios.post(`${API}/api/referral/request-withdrawal`, {
        referral_code: summary.referral_code,
        payout_method: payoutMethod,
        payout_destination: payoutDest.trim(),
      });
      setRequestStatus({ success: true, msg: `Request sent — ₹${r.data.amount} will be paid within 2 business days.` });
      setShowWithdraw(false);
      setPayoutDest('');
      load();
    } catch (e) {
      setRequestStatus({ success: false, msg: e.response?.data?.detail || 'Withdrawal request failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-700 rounded-3xl text-white shadow-sm overflow-hidden" data-testid="referral-widget">
      {/* Top: balance + share */}
      <div className="px-5 py-5 relative">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} />
          <h2 className="font-heading text-base font-black tracking-wide">REFERRAL EARNINGS</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/10 ring-1 ring-white/15 rounded-xl px-2.5 py-2">
            <p className="text-[9px] font-black tracking-[0.18em] text-emerald-100/80 uppercase">Withdrawable</p>
            <p className="text-xl font-black mt-0.5" data-testid="referral-withdrawable">₹{balance}</p>
          </div>
          <div className="bg-white/10 ring-1 ring-white/15 rounded-xl px-2.5 py-2">
            <p className="text-[9px] font-black tracking-[0.18em] text-emerald-100/80 uppercase">Pending</p>
            <p className="text-xl font-black mt-0.5" data-testid="referral-pending">₹{pending}</p>
          </div>
          <div className="bg-white/10 ring-1 ring-white/15 rounded-xl px-2.5 py-2">
            <p className="text-[9px] font-black tracking-[0.18em] text-emerald-100/80 uppercase">Paid out</p>
            <p className="text-xl font-black mt-0.5" data-testid="referral-paid">₹{paid}</p>
          </div>
        </div>

        {/* Share link */}
        <div className="bg-white/10 ring-1 ring-white/15 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3">
          <span className="text-[11px] font-mono truncate flex-1" data-testid="referral-link">{link}</span>
          <button
            type="button"
            onClick={copyLink}
            className="bg-white text-emerald-800 px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-transform active:scale-95"
            data-testid="referral-copy-btn"
            aria-label="Copy referral link"
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
          <button
            type="button"
            onClick={nativeShare}
            className="bg-amber-300 text-amber-950 px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-transform active:scale-95"
            data-testid="referral-share-btn"
            aria-label="Share referral link"
          >
            <Share2 size={12} /> Share
          </button>
        </div>

        {/* Withdraw CTA */}
        {balance > 0 ? (
          <button
            type="button"
            onClick={() => setShowWithdraw(v => !v)}
            className="w-full bg-amber-300 hover:bg-amber-200 text-amber-950 font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            data-testid="referral-withdraw-btn"
          >
            <Wallet size={14} /> Request Withdrawal · ₹{balance}
          </button>
        ) : pending > 0 ? (
          <div className="w-full bg-white/10 ring-1 ring-white/15 text-emerald-50 py-2.5 rounded-xl text-xs text-center font-semibold flex items-center justify-center gap-1.5" data-testid="referral-pending-note">
            <Clock size={12} /> ₹{pending} unlocks after the 7-day return window
          </div>
        ) : (
          <p className="text-xs text-emerald-100/80 text-center">Earn ₹{summary.cashback_per_referral} per friend on orders ₹{summary.min_order_amount}+. Paid {summary.return_window_days} days after delivery.</p>
        )}

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="mt-3 bg-white text-stone-900 rounded-xl p-3 space-y-2" data-testid="referral-withdraw-form">
            <p className="text-[11px] font-bold text-stone-700">Withdrawal of ₹{balance}</p>
            <div className="flex gap-1.5">
              {[{k:'upi', l:'UPI'}, {k:'bank', l:'Bank A/C'}].map(o => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setPayoutMethod(o.k)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${payoutMethod === o.k ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-stone-300'}`}
                  data-testid={`payout-method-${o.k}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <input
              value={payoutDest}
              onChange={e => setPayoutDest(e.target.value)}
              placeholder={payoutMethod === 'upi' ? 'your-upi@bank' : 'A/C number + IFSC'}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              data-testid="payout-destination"
            />
            <button
              type="button"
              onClick={submitWithdraw}
              disabled={!payoutDest.trim() || submitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-400 text-white font-bold py-2 rounded-lg text-sm transition-colors"
              data-testid="payout-submit"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        )}

        {requestStatus && (
          <p
            className={`mt-2 text-[11px] font-semibold ${requestStatus.success ? 'text-emerald-100' : 'text-amber-200'}`}
            data-testid="referral-request-status"
          >
            {requestStatus.msg}
          </p>
        )}
      </div>

      {/* Order history toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full bg-emerald-800/50 hover:bg-emerald-800/70 px-5 py-2.5 flex items-center justify-between text-xs font-bold transition-colors"
        data-testid="referral-history-toggle"
      >
        <span>{summary.successful_purchases} successful referrals · {summary.total_clicks} link clicks</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <ul className="bg-white text-stone-900 divide-y divide-stone-100 max-h-72 overflow-y-auto" data-testid="referral-history">
          {summary.orders?.length === 0 ? (
            <li className="px-5 py-4 text-center text-xs text-stone-500">No referred orders yet — share your link to start earning.</li>
          ) : (
            summary.orders.map((o) => {
              const status = o.cashback_status;
              const pill =
                status === 'paid'           ? { c: 'bg-emerald-100 text-emerald-800', t: 'Paid' } :
                status === 'withdrawable'   ? { c: 'bg-amber-100 text-amber-800',     t: 'Ready ₹' + o.cashback_amount } :
                status === 'in_return_window' ? { c: 'bg-sky-100 text-sky-800',       t: 'Hold ₹' + o.cashback_amount } :
                status === 'ineligible'     ? { c: 'bg-stone-100 text-stone-500',     t: 'Below ₹500' } :
                                              { c: 'bg-stone-100 text-stone-700',     t: 'Pending delivery' };
              return (
                <li key={o.order_id} className="px-5 py-3 flex items-center gap-3" data-testid={`referral-order-${o.order_id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{o.buyer_name || 'Friend'} · ₹{o.order_amount}</p>
                    <p className="text-[10px] text-stone-500 truncate">#{o.order_id}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pill.c}`}>{pill.t}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
