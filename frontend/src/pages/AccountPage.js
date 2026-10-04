import React, { useEffect, useState, useCallback } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  User, Mail, LogOut, Package, ChevronRight, ChevronDown, Loader2,
  ShieldCheck, CheckCircle2, Truck, KeyRound, ArrowLeft, ExternalLink,
  MapPin, Clock, Box, Heart, Home,
} from 'lucide-react';
import ReferralWidget from '../components/ReferralWidget';
import { getWishlist, removeFromWishlist } from '../utils/wishlist';
import { addToCart } from './Homepage';
import { cachedGet } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'cg_auth_token';
const USER_KEY = 'cg_auth_user';

/**
 * ProfileTab — editable name + phone + multiple shipping addresses.
 */
function ProfileTab({ user, setUser, handleSignout }) {
  const token = (typeof window !== 'undefined') ? localStorage.getItem(TOKEN_KEY) : null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState(user.addresses || []);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home', name: user.name || '', phone: user.phone || '', house_number: '', area: '', pincode: '', state: '', is_default: false });

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const saveProfile = async () => {
    setError(''); setSaving(true);
    try {
      const r = await axios.patch(`${API}/api/customer/me`, { name, phone }, auth);
      setUser(r.data.user);
      try { localStorage.setItem(USER_KEY, JSON.stringify(r.data.user)); } catch {}
      setEditing(false);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const addAddress = async (e) => {
    e?.preventDefault();
    setError('');
    if (!newAddr.name || !newAddr.phone || !newAddr.pincode || !newAddr.house_number) {
      setError('Please fill all required fields');
      return;
    }
    try {
      const r = await axios.post(`${API}/api/customer/addresses`, newAddr, auth);
      setAddresses((prev) => [...prev, r.data.address]);
      setShowAddrForm(false);
      setNewAddr({ label: 'Home', name: user.name || '', phone: user.phone || '', house_number: '', area: '', pincode: '', state: '', is_default: false });
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add address');
    }
  };

  const deleteAddress = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await axios.delete(`${API}/api/customer/addresses/${id}`, auth);
      setAddresses((prev) => prev.filter(a => a.id !== id));
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-4 relative space-y-4" data-testid="account-profile-tab">
      {/* Profile basics */}
      <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-black text-stone-900 flex items-center gap-2">
            <User size={16} className="text-emerald-700" /> Profile
          </h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900" data-testid="profile-edit-btn">Edit</button>
          )}
        </div>
        {!editing ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
              <Mail size={16} className="text-stone-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-0.5">Email</p>
                <p className="font-semibold text-stone-900 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
              <User size={16} className="text-stone-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-0.5">Name</p>
                <p className="font-semibold text-stone-900">{user.name || <span className="text-stone-400">Not set</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
              <Box size={16} className="text-stone-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-0.5">Phone</p>
                <p className="font-semibold text-stone-900">{user.phone ? `+91 ${user.phone}` : <span className="text-stone-400">Not set</span>}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl ring-1 ring-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" data-testid="profile-name-input" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-1">Phone (10 digits)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className="w-full px-3 py-2.5 rounded-xl ring-1 ring-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" data-testid="profile-phone-input" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60" data-testid="profile-save-btn">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setError(''); setName(user.name || ''); setPhone(user.phone || ''); }} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Saved addresses */}
      <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm p-5" data-testid="account-addresses">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-black text-stone-900 flex items-center gap-2">
            <MapPin size={16} className="text-emerald-700" /> Saved addresses
          </h2>
          <button onClick={() => setShowAddrForm(!showAddrForm)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900" data-testid="address-add-btn">{showAddrForm ? 'Cancel' : '+ Add new'}</button>
        </div>
        {showAddrForm && (
          <form onSubmit={addAddress} className="space-y-2.5 mb-4 p-3 bg-stone-50 rounded-2xl" data-testid="address-form">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label (Home/Office)" value={newAddr.label} onChange={(e) => setNewAddr({...newAddr, label: e.target.value})} className="px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" />
              <input placeholder="Recipient name" value={newAddr.name} onChange={(e) => setNewAddr({...newAddr, name: e.target.value})} className="px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" required />
            </div>
            <input placeholder="Phone (10 digits)" value={newAddr.phone} maxLength={10} onChange={(e) => setNewAddr({...newAddr, phone: e.target.value.replace(/\D/g, '').slice(0,10)})} className="w-full px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" required />
            <input placeholder="House / Building no." value={newAddr.house_number} onChange={(e) => setNewAddr({...newAddr, house_number: e.target.value})} className="w-full px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" required />
            <input placeholder="Area / Street" value={newAddr.area} onChange={(e) => setNewAddr({...newAddr, area: e.target.value})} className="w-full px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Pincode" value={newAddr.pincode} maxLength={6} onChange={(e) => setNewAddr({...newAddr, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})} className="px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" required />
              <input placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr({...newAddr, state: e.target.value})} className="px-3 py-2 rounded-lg ring-1 ring-stone-200 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={newAddr.is_default} onChange={(e) => setNewAddr({...newAddr, is_default: e.target.checked})} /> Set as default
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm" data-testid="address-save-btn">Save address</button>
          </form>
        )}
        {addresses.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">No saved addresses yet. Add one for faster checkout.</p>
        ) : (
          <div className="space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="p-3 bg-stone-50 rounded-xl flex items-start justify-between gap-3" data-testid={`address-${a.id}`}>
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-stone-900">{a.label || 'Address'}</span>
                    {a.is_default && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Default</span>}
                  </div>
                  <p className="text-stone-700">{a.name} · +91 {a.phone}</p>
                  <p className="text-stone-500 text-xs mt-0.5">{a.house_number}, {a.area}, {a.state} - {a.pincode}</p>
                </div>
                <button onClick={() => deleteAddress(a.id)} className="text-xs font-bold text-red-600 hover:text-red-800" data-testid={`address-delete-${a.id}`}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSignout}
        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
        data-testid="profile-signout-btn"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}

/**
 * Email-OTP Account page:
 *  Step 1 → enter email, server sends 6-digit OTP to Gmail
 *  Step 2 → enter OTP, server returns session token + user
 *  Signed-in → shows orders (with Delhivery tracking links) + signout
 */
export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [activeTab, setActiveTab] = useState('orders'); // orders | wishlist | profile
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // OTP flow state
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [trackingDetails, setTrackingDetails] = useState({}); // { [orderId]: data | 'loading' | 'error' }

  /* Load persisted session on mount */
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch { /* ignore */ }
  }, []);

  /* Load wishlist products (resolves slugs → full product data) */
  const loadWishlist = useCallback(async () => {
    const slugs = getWishlist();
    if (!slugs.length) { setWishlistItems([]); return; }
    setWishlistLoading(true);
    try {
      const res = await cachedGet(`${API}/api/products`);
      const all = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      const items = slugs
        .map((slug) => all.find((p) => p.slug === slug))
        .filter(Boolean);
      setWishlistItems(items);
    } catch {
      setWishlistItems([]);
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'wishlist' && user) loadWishlist();
    const onUpd = () => loadWishlist();
    window.addEventListener('wishlistUpdated', onUpd);
    return () => window.removeEventListener('wishlistUpdated', onUpd);
  }, [activeTab, user, loadWishlist]);

  /* Fetch orders once logged in */
  const fetchOrders = useCallback(async (authToken) => {
    setOrdersLoading(true);
    try {
      const r = await axios.get(`${API}/api/auth/orders`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setOrders(r.data?.orders || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      }
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchOrders(token);
  }, [token, fetchOrders]);

  /* Resend cooldown ticker */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validateEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim());

  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    setError(''); setInfo('');
    if (!validateEmail(email)) return setError('Enter a valid email address');
    setSending(true);
    try {
      const r = await axios.post(`${API}/api/auth/send-otp`, { email: email.trim().toLowerCase() });
      setInfo(r.data?.message || 'Code sent. Check your email.');
      setStep('otp');
      setResendIn(30);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) return setError('Enter the 6-digit code from your email');
    setVerifying(true);
    try {
      const r = await axios.post(`${API}/api/auth/verify-otp`, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const authToken = r.data?.token;
      const userObj = r.data?.user;
      if (authToken && userObj) {
        localStorage.setItem(TOKEN_KEY, authToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userObj));
        setToken(authToken);
        setUser(userObj);
        setOtp(''); setEmail(''); setInfo(''); setError('');
        setStep('email');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Incorrect or expired code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSignout = async () => {
    try {
      if (token) {
        await axios.post(`${API}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null); setUser(null); setOrders([]);
  };

  // Toggle inline tracking details for an order. Lazy-fetches /api/track-order/:id
  // (which includes Delhivery scans + expected delivery + tracking_url).
  const toggleOrderTracking = useCallback(async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (trackingDetails[orderId] && trackingDetails[orderId] !== 'error') return;
    setTrackingDetails((prev) => ({ ...prev, [orderId]: 'loading' }));
    try {
      const r = await axios.get(`${API}/api/track-order/${orderId}`);
      setTrackingDetails((prev) => ({ ...prev, [orderId]: r.data }));
    } catch {
      setTrackingDetails((prev) => ({ ...prev, [orderId]: 'error' }));
    }
  }, [expandedOrderId, trackingDetails]);

  /* ============ SIGNED-OUT VIEW ============ */
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white pb-24" data-testid="account-page-signed-out">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="max-w-md mx-auto px-5 sm:px-6 pt-8">
          <div className="text-center mb-7">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 ring-1 ring-emerald-200 items-center justify-center shadow-sm mb-3">
              {step === 'email' ? (
                <User size={28} className="text-emerald-700" />
              ) : (
                <KeyRound size={28} className="text-emerald-700" />
              )}
            </div>
            <h1 className="font-heading text-3xl font-black text-stone-900 tracking-tight">
              {step === 'email' ? 'Sign in with email' : 'Enter your code'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {step === 'email'
                ? 'We’ll send a 6-digit login code to your email.'
                : `Sent a 6-digit code to ${email}`}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-6 shadow-sm space-y-3" data-testid="account-email-form">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="account-input-email"
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-base outline-none transition-colors"
                  style={{ fontSize: '16px' }}
                />
              </div>
              {error && <p className="text-xs text-rose-600 font-semibold" data-testid="account-error">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                data-testid="account-send-otp-btn"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-emerald-900/15 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {sending ? 'Sending…' : 'Send login code'}
              </button>
              <p className="text-center text-[11px] text-stone-400 pt-1">
                By continuing you agree to our Terms &amp; Privacy.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-6 shadow-sm space-y-3" data-testid="account-otp-form">
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  data-testid="account-input-otp"
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-lg tracking-[0.5em] font-bold outline-none transition-colors"
                  style={{ fontSize: '18px' }}
                />
              </div>
              {info && <p className="text-xs text-emerald-700 font-semibold">{info}</p>}
              {error && <p className="text-xs text-rose-600 font-semibold" data-testid="account-error">{error}</p>}
              <button
                type="submit"
                disabled={verifying}
                data-testid="account-verify-otp-btn"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-emerald-900/15 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {verifying ? 'Verifying…' : 'Verify &amp; sign in'}
              </button>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); setInfo(''); }}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1"
                  data-testid="account-back-to-email"
                >
                  <ArrowLeft size={12} /> Change email
                </button>
                <button
                  type="button"
                  disabled={resendIn > 0 || sending}
                  onClick={handleSendOtp}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:text-stone-400 disabled:cursor-not-allowed"
                  data-testid="account-resend-otp"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          <Link to="/track-order" className="block mt-4 text-center text-xs text-stone-500 hover:text-emerald-700 font-semibold" data-testid="account-guest-track">
            Or track an order as guest →
          </Link>
        </div>
      </div>
    );
  }

  /* ============ SIGNED-IN VIEW ============ */
  return (
    <div className="min-h-screen bg-stone-50/60 pb-24" data-testid="account-page-signed-in">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-800 text-white px-5 sm:px-6 pt-7 pb-12 rounded-b-[28px] relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 85% 20%, white 0%, transparent 45%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
            <User size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-emerald-200">Signed in</p>
            <p className="font-heading text-xl font-black truncate" data-testid="account-display-email">
              {user.email}
            </p>
            {user.phone && (
              <p className="text-xs text-emerald-100/80 truncate" data-testid="account-display-phone">+91 {user.phone}</p>
            )}
          </div>
          <button
            onClick={handleSignout}
            data-testid="account-signout-btn"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 ring-1 ring-white/15 px-3 py-2 rounded-full text-xs font-bold transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      {/* Referral widget */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-7 relative">
        <ReferralWidget user={user} />
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-4 relative">
        <div className="bg-white rounded-2xl ring-1 ring-stone-200 shadow-sm p-1 flex gap-1">
          {[
            { id: 'orders', label: 'Orders', icon: Package },
            { id: 'wishlist', label: 'Wishlist', icon: Heart },
            { id: 'profile', label: 'Profile', icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === t.id ? 'bg-emerald-700 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}`}
              data-testid={`account-tab-${t.id}`}
            >
              <t.icon size={14} /> {t.label}
              {t.id === 'wishlist' && wishlistItems.length > 0 && (
                <span className="ml-1 bg-white/20 text-[10px] px-1.5 rounded-full">{wishlistItems.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Wishlist Tab */}
      {activeTab === 'wishlist' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-4 relative" data-testid="account-wishlist-tab">
          <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
              <Heart size={16} className="text-rose-500" />
              <h2 className="font-heading text-base font-black text-stone-900">My Wishlist</h2>
              {wishlistItems.length > 0 && (
                <span className="ml-auto text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{wishlistItems.length}</span>
              )}
            </div>
            {wishlistLoading ? (
              <div className="px-5 py-8 text-center text-sm text-stone-500 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading wishlist…
              </div>
            ) : wishlistItems.length === 0 ? (
              <div className="px-5 py-10 text-center" data-testid="account-no-wishlist">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto flex items-center justify-center mb-3">
                  <Heart size={22} className="text-rose-300" />
                </div>
                <p className="text-sm font-bold text-stone-900 mb-1">No wishlist items yet</p>
                <p className="text-xs text-stone-500 mb-4">Tap the heart on any product to save it for later.</p>
                <Link to="/shop" className="inline-flex items-center gap-1.5 bg-rose-500 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-rose-600 transition-colors">
                  Discover products <ChevronRight size={13} />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {wishlistItems.map((p) => (
                  <li key={p.slug} className="px-5 py-3 flex items-center gap-3" data-testid={`wishlist-row-${p.slug}`}>
                    <Link to={`/product/${p.slug}`} className="w-14 h-14 rounded-xl bg-stone-50 ring-1 ring-stone-200 overflow-hidden flex-shrink-0">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.short_name || p.name} className="w-full h-full object-cover" />}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${p.slug}`} className="block font-semibold text-stone-900 text-sm truncate hover:text-rose-600">{p.short_name || p.name}</Link>
                      <p className="text-xs text-stone-500 mt-0.5">
                        <span className="font-bold text-stone-900">₹{p.prepaid_price}</span>
                        {p.mrp > p.prepaid_price && <span className="ml-1.5 line-through">₹{p.mrp}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        // If product has shades, redirect to PDP so user can pick a shade.
                        const hasShades = Array.isArray(p.shades) && p.shades.length > 0;
                        if (hasShades) {
                          window.location.href = `/product/${p.slug}`;
                          return;
                        }
                        addToCart(p.slug, 1);
                      }}
                      className="text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-full"
                      data-testid={`wishlist-add-${p.slug}`}
                    >{Array.isArray(p.shades) && p.shades.length > 0 ? 'Pick Shade' : 'Add to Bag'}</button>
                    <button
                      onClick={() => { removeFromWishlist(p.slug); }}
                      aria-label="Remove from wishlist"
                      className="text-rose-400 hover:text-rose-600 p-1"
                      data-testid={`wishlist-remove-${p.slug}`}
                    >
                      <Heart size={16} className="fill-rose-500 text-rose-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <ProfileTab user={user} setUser={setUser} handleSignout={handleSignout} />
      )}

      {/* Orders (default tab) */}
      {activeTab === 'orders' && (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-4 relative">
        <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm overflow-hidden" data-testid="account-orders-card">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Package size={16} className="text-emerald-700" />
            <h2 className="font-heading text-base font-black text-stone-900">My Orders</h2>
            {orders.length > 0 && (
              <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            )}
          </div>

          {ordersLoading ? (
            <div className="px-5 py-8 text-center text-sm text-stone-500 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="px-5 py-10 text-center" data-testid="account-no-orders">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
                <Package size={22} className="text-stone-400" />
              </div>
              <p className="text-sm font-bold text-stone-900 mb-1">No orders yet</p>
              <p className="text-xs text-stone-500 mb-4">When you place an order, it'll show up here.</p>
              <Link to="/" className="inline-flex items-center gap-1.5 bg-emerald-700 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-emerald-800 transition-colors">
                Start shopping <ChevronRight size={13} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {orders.map((o) => {
                const statusLc = (o.status || '').toLowerCase();
                const statusColor = statusLc.includes('deliver') ? 'text-emerald-700 bg-emerald-50' :
                  statusLc.includes('cancel') ? 'text-rose-700 bg-rose-50' :
                    statusLc.includes('ship') ? 'text-sky-700 bg-sky-50' :
                      'text-amber-700 bg-amber-50';
                const expanded = expandedOrderId === o.order_id;
                const tracking = trackingDetails[o.order_id];
                return (
                  <li key={o.order_id} className="px-5 py-4" data-testid={`account-order-${o.order_id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 to-stone-50 ring-1 ring-stone-200 flex items-center justify-center flex-shrink-0">
                        <Truck size={18} className="text-emerald-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-stone-900 truncate">#{o.order_id}</p>
                          <span className={`text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded-full ${statusColor}`}>
                            {o.status || 'Processing'}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 truncate">
                          ₹{o.total_amount?.toLocaleString?.() || o.total_amount} · {o.payment_method || 'Prepaid'}
                          {o.delivery_timeline && ` · ${o.delivery_timeline}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOrderTracking(o.order_id)}
                        data-testid={`account-track-${o.order_id}`}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                      >
                        {expanded ? 'Hide' : 'Track'}
                        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    </div>
                    {/* Items summary (always visible) */}
                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <p className="mt-2 ml-14 text-[11px] text-stone-500 truncate">
                        {o.items.map((it) => {
                          const shadeLabel = it.shade_name || it.shade_label || (it.shade_id ? ` · ${it.shade_id}` : '');
                          return `${it.name || it.slug}${shadeLabel ? ` (${shadeLabel.replace(/^\s*·\s*/, '')})` : ''}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`;
                        }).join(' · ')}
                      </p>
                    )}

                    {/* Reorder + Invoice quick actions */}
                    <div className="mt-2 ml-14 flex items-center gap-3">
                      {Array.isArray(o.items) && o.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            // Reorder: push all line items into the cart and route to /cart
                            try {
                              const raw = localStorage.getItem('cg_cart') || '{"items":[]}';
                              const cart = JSON.parse(raw);
                              for (const it of o.items) {
                                const slug = it.slug || it.product_slug;
                                if (!slug) continue;
                                const existing = (cart.items || []).find(c => (c.product_slug || c.slug) === slug && (c.shade_id || null) === (it.shade_id || null));
                                if (existing) existing.quantity = (existing.quantity || 1) + (it.quantity || 1);
                                else (cart.items = cart.items || []).push({ product_slug: slug, quantity: it.quantity || 1, shade_id: it.shade_id });
                              }
                              localStorage.setItem('cg_cart', JSON.stringify(cart));
                              window.dispatchEvent(new Event('cartUpdated'));
                              window.location.href = '/cart';
                            } catch (e) { console.error(e); }
                          }}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                          data-testid={`account-reorder-${o.order_id}`}
                        >
                          Reorder
                        </button>
                      )}
                      <a
                        href={`${API}/api/admin/orders/${o.order_id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-stone-500 hover:text-stone-700"
                        data-testid={`account-invoice-${o.order_id}`}
                        onClick={(e) => {
                          // The invoice endpoint requires admin token; for customers, open the printable
                          // route on the success page instead.
                          e.preventDefault();
                          window.open(`/order-success/${o.order_id}?print=1`, '_blank');
                        }}
                      >
                        Invoice
                      </a>
                    </div>

                    {/* Inline tracking details (expanded) */}
                    {expanded && (
                      <div className="mt-3 ml-14 bg-stone-50 rounded-xl p-3 ring-1 ring-stone-200" data-testid={`account-tracking-${o.order_id}`}>
                        {tracking === 'loading' && (
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <Loader2 size={13} className="animate-spin" /> Fetching live tracking…
                          </div>
                        )}
                        {tracking === 'error' && (
                          <p className="text-xs text-rose-600">Couldn't load tracking details. Please try again.</p>
                        )}
                        {tracking && tracking !== 'loading' && tracking !== 'error' && (
                          <div className="space-y-2.5">
                            {/* Status row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Box size={14} className="text-emerald-700" />
                                <span className="text-xs font-bold text-stone-800 capitalize">
                                  {(tracking.delivery_status || tracking.status || 'Processing').replace(/_/g, ' ')}
                                </span>
                              </div>
                              {tracking.expected_delivery && (
                                <span className="flex items-center gap-1 text-[11px] text-stone-500">
                                  <Clock size={11} /> ETA {tracking.expected_delivery}
                                </span>
                              )}
                            </div>

                            {/* AWB row */}
                            {tracking.awb_number && (
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Tracking #</p>
                                  <p className="font-mono font-bold text-stone-900">{tracking.awb_number}</p>
                                </div>
                                {tracking.tracking_url && (
                                  <a
                                    href={tracking.tracking_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-800"
                                    data-testid={`account-delhivery-${o.order_id}`}
                                  >
                                    Open Delhivery <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Status location */}
                            {tracking.status_location && (
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                <MapPin size={11} /> {tracking.status_location}
                              </div>
                            )}

                            {/* Scan timeline */}
                            {Array.isArray(tracking.scans) && tracking.scans.length > 0 && (
                              <ol className="space-y-1.5 pt-1.5 border-t border-stone-200">
                                {tracking.scans.slice(0, 6).map((s, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[11px]">
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                                    <div className="min-w-0">
                                      <p className="font-bold text-stone-800">{s.status || s.instruction || 'Update'}</p>
                                      <p className="text-stone-500">
                                        {[s.location, s.scan_date].filter(Boolean).join(' · ')}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}

                            {/* No AWB yet */}
                            {!tracking.awb_number && (
                              <p className="text-[11px] text-stone-500">
                                Your order is confirmed. Tracking number will appear here once it ships.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link to="/track-order" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-colors" data-testid="account-quick-track">
            <Truck size={16} className="text-emerald-700" />
            <div>
              <p className="text-xs font-black text-stone-900">Track Order</p>
              <p className="text-[10px] text-stone-500">Real-time status</p>
            </div>
          </Link>
          <Link to="/contact" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-colors" data-testid="account-quick-support">
            <CheckCircle2 size={16} className="text-emerald-700" />
            <div>
              <p className="text-xs font-black text-stone-900">Help &amp; Support</p>
              <p className="text-[10px] text-stone-500">Get answers fast</p>
            </div>
          </Link>
        </div>
      </div>
      )}
    </div>
  );
}
