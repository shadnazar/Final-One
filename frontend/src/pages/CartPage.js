import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, Trash2, Minus, Plus, ChevronRight, Shield, Truck, Tag, ArrowLeft, Sparkles, Zap, Award, Check, Clock, Star, Lock, Package, BadgeCheck, Gift } from 'lucide-react';
import { getCart, saveCart } from './Homepage';
import { useTracking } from '../providers/TrackingProvider';
import ReviewsCarousel from '../components/ReviewsCarousel';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

function CartPage() {
  const navigate = useNavigate();
  const { trackAction } = useTracking();
  // PERF: seed cartData from sessionStorage so revisits paint instantly.
  // Server validation still runs in background and overwrites with fresh data.
  const _seedCart = (() => {
    try { return JSON.parse(sessionStorage.getItem('lastCartValidate') || 'null'); }
    catch (_) { return null; }
  })();
  const [cartData, setCartData] = useState(_seedCart);
  const [loading, setLoading] = useState(!_seedCart);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [giftCardError, setGiftCardError] = useState('');
  const [upsellProducts, setUpsellProducts] = useState([]);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [publicCoupons, setPublicCoupons] = useState([]);

  const appliedCouponRef = React.useRef(appliedCoupon);
  appliedCouponRef.current = appliedCoupon;

  // Day-wise analytics — record the cart page visit exactly once per mount so
  // the admin dashboard's `cart_visit_count` chart populates. Fires alongside
  // the existing initiate_checkout tracker, not in place of it.
  useEffect(() => {
    try { trackAction('cart_view', { source: 'cart_page' }); } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const appliedGiftCardRef = React.useRef(appliedGiftCard);
  appliedGiftCardRef.current = appliedGiftCard;
  const initialLoadRef = React.useRef(true);
  // Ref-mirror of cartData so callbacks (validateCart) can avoid stale-state flashes
  const cartDataRef = React.useRef(cartData);
  cartDataRef.current = cartData;
  // PERF: debounce timer for validateCart calls triggered by rapid +/- clicks
  const validateTimerRef = React.useRef(null);

  // Debounced cart re-validation — coalesces rapid quantity changes into a
  // single network call so the user can mash + / − without UI lag.
  const validateCartDebounced = useCallback((couponOverride, giftCardOverride, delay = 250) => {
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(() => {
      validateTimerRef.current = null;
      validateCart(couponOverride, giftCardOverride);
    }, delay);
  }, []);

  const validateCart = useCallback(async (couponOverride, giftCardOverride) => {
    // Don't flash a skeleton if we already have cartData (seeded from session or prior fetch)
    if (initialLoadRef.current && !cartDataRef.current) setLoading(true);
    const cart = getCart();
    if (!cart.items.length) {
      setCartData(null);
      setLoading(false);
      initialLoadRef.current = false;
      try { sessionStorage.removeItem('lastCartValidate'); } catch (_) { /* ignore */ }
      return;
    }
    const couponCodeToUse = couponOverride !== undefined ? couponOverride : (appliedCouponRef.current?.code || null);
    const giftCardToUse = giftCardOverride !== undefined ? giftCardOverride : (appliedGiftCardRef.current?.code || null);
    try {
      const res = await axios.post(`${API}/api/cart/validate`, { items: cart.items, coupon_code: couponCodeToUse, gift_card_code: giftCardToUse, payment_method: 'prepaid', session_id: (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sessionId')) || null });
      setCartData(res.data);
      // PERF: persist the validated summary so the next mount (navigate away
      // and back, or refresh) paints in one frame instead of waiting on the
      // network. Keyed per-session, 5 min TTL enforced on read.
      try { sessionStorage.setItem('lastCartValidate', JSON.stringify(res.data)); } catch (_) {}
      // ---- Sync localStorage with server-validated items ----
      // The server silently drops TBL / inactive / out-of-stock items. If we
      // leave them in localStorage, the navbar cart badge counts them while
      // the cart page renders only the server's list — that's the "navbar
      // shows 3 but cart page shows 4" mismatch users were hitting.
      try {
        const serverItems = res.data.items || [];
        const validKeys = new Set(serverItems.map(si => si.type === 'combo' ? `c:${si.combo_id}` : `p:${si.slug}`));
        const pruned = cart.items.filter(ci => validKeys.has(ci.combo_id ? `c:${ci.combo_id}` : `p:${ci.product_slug}`));
        // Mirror server-resolved quantities back so navbar count stays accurate
        // (e.g. when the server caps qty due to stock).
        const qtyByKey = {};
        serverItems.forEach(si => { qtyByKey[si.type === 'combo' ? `c:${si.combo_id}` : `p:${si.slug}`] = si.quantity; });
        pruned.forEach(pi => {
          const key = pi.combo_id ? `c:${pi.combo_id}` : `p:${pi.product_slug}`;
          if (qtyByKey[key] != null) pi.quantity = qtyByKey[key];
        });
        if (pruned.length !== cart.items.length || pruned.some((pi, idx) => pi.quantity !== cart.items[idx]?.quantity)) {
          saveCart({ ...cart, items: pruned });
        }
      } catch (_) { /* non-fatal */ }
      // Sync applied gift card state with server validation
      if (res.data.gift_card?.error) {
        setGiftCardError(res.data.gift_card.error);
        setAppliedGiftCard(null);
      } else if (res.data.gift_card?.code) {
        setAppliedGiftCard(res.data.gift_card);
        setGiftCardError('');
      }
      if (initialLoadRef.current) {
        // Cart-page perf: previously we fetched the ENTIRE 7,000+ product
        // catalog here just to compute upsell & recently-viewed. That single
        // request was ~5MB and the dominant slowdown on the cart page. Now we:
        //   1) batch-fetch ONLY the slugs the cart + recently-viewed need
        //      (~10 products = ~30KB), and
        //   2) fetch a small popular-products slice (24 items) as the upsell
        //      candidate pool — also lean & CDN-cached.
        const cartSlugs = new Set(cart.items.map(i => i.product_slug).filter(Boolean));
        const cartCombos = cart.items.map(i => i.combo_id).filter(Boolean);

        let recentlyViewed = [];
        try { recentlyViewed = JSON.parse(sessionStorage.getItem('recentlyViewed') || '[]'); } catch (e) {}
        const recentSet = new Set(recentlyViewed);

        // Slugs we need full product objects for = cart slugs ∪ recently-viewed slugs.
        const neededSlugs = Array.from(new Set([...cartSlugs, ...recentlyViewed])).slice(0, 200);

        const [batchRes, popularRes, comboRes] = await Promise.all([
          neededSlugs.length
            ? axios.post(`${API}/api/products/batch`, { slugs: neededSlugs }).then(r => r.data).catch(() => [])
            : Promise.resolve([]),
          cachedGet(`${API}/api/products?page=1&limit=24&sort=popular`, { ttl: 120_000 })
            .then(r => Array.isArray(r.data) ? r.data : (r.data.items || []))
            .catch(() => []),
          cachedGet(`${API}/api/combos`, { ttl: 60_000 }).then(r => r.data).catch(() => []),
        ]);

        const bySlug = new Map(batchRes.map(p => [p.slug, p]));
        const cartProducts = [...cartSlugs].map(slug => bySlug.get(slug)).filter(Boolean);
        const cartNiches = new Set(cartProducts.map(p => p.niche).filter(Boolean));
        const cartConcerns = new Set(cartProducts.flatMap(p => p.concerns || []).filter(Boolean));
        const cartCategories = new Set(cartProducts.map(p => p.category).filter(Boolean));

        // Dedicated "Recently viewed" list (preserves view order, excludes items in cart & TBL)
        const recentlyViewedList = recentlyViewed
          .filter(slug => !cartSlugs.has(slug))
          .map(slug => bySlug.get(slug))
          .filter(Boolean)
          .filter(p => !p.is_to_be_launched)
          .slice(0, 6);
        setRecentlyViewedProducts(recentlyViewedList);

        // Score the small popular pool for upsell relevance
        const scored = popularRes
          .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched)
          .map(p => {
            let score = 0;
            if (cartCategories.has(p.category)) score += 4;
            if ((p.concerns || []).some(c => cartConcerns.has(c))) score += 3;
            if (cartNiches.has(p.niche)) score += 2;
            if (recentSet.has(p.slug)) score += 5;
            return { p, score };
          })
          .sort((a, b) => b.score - a.score || (b.p.reviews_count || 0) - (a.p.reviews_count || 0))
          .map(x => x.p);

        // Fallback chain: relevance → same-niche bestsellers → overall most-reviewed
        let upsell = scored.filter(p => p);
        if (!upsell.length && cartNiches.size) {
          upsell = popularRes
            .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched && cartNiches.has(p.niche))
            .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
        }
        if (!upsell.length) {
          upsell = [...popularRes]
            .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched)
            .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
        }

        setUpsellProducts(upsell.slice(0, 8));
        setCombos((comboRes || []).filter(c => !cartCombos.includes(c.combo_id)));
      }
    } catch (err) {
      // Feb-2026: server-side "other brands out of stock" gate. On the cart
      // page we don't block — just log. The checkout page owns the final
      // block screen so shoppers can still browse/adjust the cart here.
      const d = err?.response?.data?.detail;
      if (err?.response?.status !== 409 || d?.reason !== 'other_brands_out_of_stock') {
        console.error(err);
      }
    }
    setLoading(false);
    initialLoadRef.current = false;
  }, []);

  useEffect(() => { validateCart(); }, []);

  useEffect(() => {
    // Meta Pixel — Cart PageView
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView', { page_name: 'cart', content_category: 'Cart' });
    }
  }, []);
  useEffect(() => {
    // Use a short TTL (60s) for public coupons so admin disable/delete reflects quickly
    cachedGet(`${API}/api/coupons/public`, { ttl: 60_000 })
      .then(r => setPublicCoupons(r.data || []))
      .catch(() => setPublicCoupons([]));
  }, []);

  // Auto-apply ONLY the coupon claimed via the discount popup (localStorage `discountClaimed`).
  // If the user did NOT claim a coupon via popup, do not auto-apply — they can still tap "Apply"
  // on any of the public coupons listed on the cart page.
  useEffect(() => {
    if (appliedCoupon || !cartData?.subtotal) return;
    let claimed = false;
    let claimedCode = '';
    try {
      claimed = localStorage.getItem('discountClaimed') === 'true';
      claimedCode = (localStorage.getItem('discountCode') || '').toUpperCase();
    } catch { /* ignore */ }
    if (!claimed || !claimedCode) return;
    // Best-effort apply via the same validate endpoint so totals + discount line update correctly.
    applyCouponCode(claimedCode).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartData?.subtotal]);

  // Listen for the popup-claim event so a coupon claimed AFTER the cart loaded
  // is applied immediately without requiring a refresh.
  useEffect(() => {
    const onClaimed = (e) => {
      if (appliedCoupon) return;
      const code = (e?.detail?.code || localStorage.getItem('discountCode') || '').toUpperCase();
      if (!code) return;
      applyCouponCode(code).catch(() => {});
    };
    const onStorage = (e) => {
      if (e.key !== 'discountCode' && e.key !== 'discountClaimed') return;
      onClaimed();
    };
    window.addEventListener('discountClaimed', onClaimed);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('discountClaimed', onClaimed);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, cartData?.subtotal]);

  const updateQuantity = (index, delta) => {
    const cart = getCart();
    cart.items[index].quantity = Math.max(1, (cart.items[index].quantity || 1) + delta);
    saveCart(cart);
    // Optimistic UI — mutate the displayed qty + line total instantly so the
    // input doesn't lag behind the navbar badge while /cart/validate is in flight.
    setCartData(prev => {
      if (!prev?.items) return prev;
      const items = prev.items.map((it, i) => i === index
        ? { ...it, quantity: cart.items[index].quantity, line_total: (it.price || 0) * cart.items[index].quantity }
        : it);
      return { ...prev, items };
    });
    validateCartDebounced();
  };
  const removeItem = (index) => {
    const cart = getCart();
    cart.items.splice(index, 1);
    saveCart(cart);
    setCartData(prev => prev?.items ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev);
    validateCartDebounced(undefined, undefined, 0); // immediate for removals
  };
  const addUpsellToCart = (slug) => { const cart = getCart(); const e = cart.items.find(i => i.product_slug === slug); if (e) e.quantity += 1; else cart.items.push({ product_slug: slug, quantity: 1 }); saveCart(cart); validateCartDebounced(undefined, undefined, 0); };

  const applyCouponCode = async (code) => {
    setCouponError('');
    if (!code?.trim()) return;
    try {
      const r = await axios.post(`${API}/api/validate-coupon?code=${code.trim()}&cart_total=${cartData?.subtotal || 0}`);
      const newCoupon = { code: code.trim().toUpperCase(), ...r.data };
      setAppliedCoupon(newCoupon);
      // Re-validate cart with the new coupon so totals/discount lines update
      await validateCart(newCoupon.code);
    } catch (e) {
      setCouponError(e.response?.data?.detail || 'Invalid coupon');
      setAppliedCoupon(null);
    }
  };

  const applyCoupon = () => applyCouponCode(couponCode);

  const removeCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    await validateCart(null);
  };

  const proceedToCheckout = () => {
    if (!cartData?.items?.length) return;
    if (cartData?.moq_block) {
      alert(`Minimum order amount is ₹${cartData.moq_amount || 300}. Add ₹${Math.ceil(cartData.moq_remaining)} more to checkout.`);
      return;
    }
    trackAction('initiate_checkout', { items: cartData.items.length, total: cartData.total });
    if (window.fbq) window.fbq('track', 'InitiateCheckout', { value: cartData.total, currency: 'INR', num_items: cartData.item_count });
    navigate('/checkout', { state: { cartData, paymentMethod: 'prepaid', coupon: appliedCoupon, giftCard: appliedGiftCard } });
  };

  if (loading) {
    // Render a lightweight skeleton instead of a full-page spinner so the page feels instant
    const cartItems = getCart().items || [];
    if (cartItems.length === 0) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-stone-50" data-testid="cart-page-loading">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => window.history.back()} className="p-2 hover:bg-white rounded-xl"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="text-xs text-gray-400">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-3.5 animate-pulse">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-100 rounded-xl flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-stone-100 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-stone-100 rounded w-1/3 mb-3" />
                    <div className="h-7 bg-stone-100 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="h-5 bg-stone-100 rounded w-1/2 mb-4" />
                <div className="h-4 bg-stone-100 rounded w-full mb-2" />
                <div className="h-4 bg-stone-100 rounded w-full mb-2" />
                <div className="h-10 bg-stone-100 rounded w-full mt-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cartData || !cartData.items?.length) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" data-testid="empty-cart">
        <div className="text-center"><ShoppingCart className="w-14 h-14 mx-auto mb-4 text-gray-200" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Explore our anti-aging range to get started.</p>
        <Link to="/shop" className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-green-700 inline-flex items-center gap-2">Shop Now <ChevronRight size={16} /></Link></div>
      </div>
    );
  }

  const kit = combos.find(c => c.combo_id === 'complete-anti-aging-kit');

  return (
    <div className="min-h-screen bg-stone-50" data-testid="cart-page">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = '/shop'; }} className="p-2 hover:bg-white rounded-xl transition-colors" data-testid="cart-back"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-xs text-gray-400">{cartData.item_count} {cartData.item_count === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {/* Stock warnings banner (CT-2 fix) */}
            {Array.isArray(cartData.stock_warnings) && cartData.stock_warnings.length > 0 && (
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-4" data-testid="cart-stock-warnings">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">⚠ Stock alert</p>
                <ul className="text-sm text-amber-800 space-y-1">
                  {cartData.stock_warnings.map((w, wi) => (
                    <li key={wi} data-testid={`cart-stock-warning-${wi}`}>
                      {w.message || `${w.name || w.slug}: ${w.available != null ? `only ${w.available} left` : 'limited stock'}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Items */}
            {cartData.items.map((item, index) => {
              const detailHref = item.type === 'combo' ? null : (item.slug ? `/product/${item.slug}` : null);
              const ImageWrap = detailHref ? Link : 'div';
              const imgWrapProps = detailHref ? { to: detailHref, 'data-testid': `cart-item-image-link-${index}` } : {};
              const TitleWrap = detailHref ? Link : 'div';
              const titleWrapProps = detailHref ? { to: detailHref, className: 'block hover:text-green-700', 'data-testid': `cart-item-title-link-${index}` } : {};
              return (
              <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-3.5" data-testid={`cart-item-${index}`}>
                <ImageWrap {...imgWrapProps} className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? <img src={item.image} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" /> : <Package size={20} className="text-green-300" />}
                </ImageWrap>
                <div className="flex-1 min-w-0">
                  <TitleWrap {...titleWrapProps}>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.type === 'combo' ? item.name : item.short_name || item.name}</h3>
                  </TitleWrap>
                  {item.type === 'combo' && <p className="text-xs text-green-600 font-medium">{item.product_slugs?.length} products included</p>}
                  {item.shade_name && (
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: item.shade_hex || '#cccccc' }} />
                      Shade: <span className="font-semibold text-gray-700">{item.shade_name}</span>
                    </p>
                  )}
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-bold text-gray-900">₹{item.price}</span>
                    {(item.mrp || item.mrp_total) > item.price && <span className="text-xs text-gray-400 line-through">₹{item.mrp || item.mrp_total}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white shadow-sm">
                      <button onClick={() => updateQuantity(index, -1)} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900" data-testid={`cart-qty-minus-${index}`}><Minus size={14} /></button>
                      <span className="w-7 text-center text-xs font-bold" data-testid={`cart-qty-value-${index}`}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900" data-testid={`cart-qty-plus-${index}`}><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeItem(index)} className="text-gray-300 hover:text-red-500 transition-colors" data-testid={`cart-remove-${index}`}><Trash2 size={14} /></button>
                    <span className="ml-auto font-bold text-gray-900">₹{item.line_total}</span>
                  </div>
                </div>
              </div>
              );
            })}

            {/* Bundle Push */}
            {kit && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-2"><Award size={15} className="text-amber-600" /><span className="text-xs font-bold text-amber-800 tracking-wide">UPGRADE & SAVE {kit.discount_percent}%</span></div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-gray-900">{kit.name}</p>
                    <p className="text-xs mt-0.5"><span className="font-bold text-green-700">₹{kit.combo_prepaid_price?.toLocaleString()}</span> <span className="text-gray-400 line-through text-xs">₹{kit.mrp_total?.toLocaleString()}</span></p>
                  </div>
                  <button onClick={() => { const c = getCart(); c.items = [{ combo_id: kit.combo_id, quantity: 1 }]; saveCart(c); validateCart(); }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm">Switch to Kit</button>
                </div>
              </div>
            )}

            {/* FREE DELIVERY highlight — every order above ₹100 ships free with
                zero delivery / tax / packaging charges. */}
            {cartData.free_delivery_applied ? (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-4 flex items-center gap-3 shadow-md" data-testid="cart-free-delivery-banner">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Truck size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black leading-tight">FREE delivery unlocked!</p>
                  <p className="text-[11px] text-emerald-50 leading-snug">No delivery, tax or packaging charges on your order.</p>
                </div>
                <BadgeCheck size={22} className="shrink-0" />
              </div>
            ) : (cartData.subtotal || 0) > 0 && (
              <div className="bg-white border border-dashed border-emerald-300 rounded-2xl p-4 flex items-center gap-3" data-testid="cart-free-delivery-nudge">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Truck size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-emerald-900">Add ₹{cartData.free_delivery_remaining} more for FREE delivery</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Orders above ₹{cartData.free_delivery_threshold || 100} ship free with zero charges.</p>
                </div>
              </div>
            )}
            {/* Free Gift teaser — server has already picked the actual product
                based on session_id. We reveal the name + image here so shoppers
                see exactly what they're getting for free (prepaid only). */}
            {cartData.free_gift && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3" data-testid="cart-free-gift-banner">
                {cartData.free_gift.image && (
                  <img src={cartData.free_gift.image} alt={cartData.free_gift.name} className="w-14 h-14 rounded-xl object-cover ring-1 ring-emerald-200 bg-white shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black tracking-[0.22em] text-emerald-700 uppercase mb-0.5">🎁 Free with your order</p>
                  <p className="text-sm font-black text-stone-900 leading-tight truncate">{cartData.free_gift.name}</p>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    Worth <b>₹{cartData.free_gift.mrp}</b> — free when paid prepaid at checkout
                  </p>
                </div>
              </div>
            )}
            {!cartData.free_gift && (cartData.subtotal || 0) > 800 && (cartData.subtotal || 0) <= (cartData.free_gift_min_subtotal || 1000) && (
              <div className="bg-white border border-dashed border-emerald-300 rounded-2xl p-4 flex items-center gap-3" data-testid="cart-free-gift-nudge">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Gift size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-emerald-900">Add ₹{Math.max(1, (cartData.free_gift_min_subtotal || 1000) + 1 - (cartData.subtotal || 0))} more</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">and pay prepaid to unlock a <b>surprise free product</b> at checkout.</p>
                </div>
              </div>
            )}

            {/* Combo Bonus banner + tiered progress bar. Shows current tier
                unlocked, next tier target, and how many items away. */}
            {(cartData.combo_bonus_tiers?.length > 0 || cartData.combo_bonus_applied > 0) && (() => {
              const tiers = cartData.combo_bonus_tiers || [];
              const aaCount = cartData.combo_bonus_aa_count || 0;
              const applied = cartData.combo_bonus_applied || 0;
              const next = cartData.combo_bonus_next_tier;
              const hasCombo = (cartData.items || []).some(it => it.type === 'combo');
              if (hasCombo || tiers.length === 0) return null;
              const maxItems = tiers[tiers.length - 1].items;
              const progressPct = Math.min(100, (aaCount / maxItems) * 100);
              return (
                <div className="bg-gradient-to-br from-purple-50 via-fuchsia-50 to-rose-50 border border-purple-200/70 rounded-2xl p-4 sm:p-5" data-testid="cart-combo-bonus-banner">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
                      <Award size={17} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {applied > 0 ? (
                        <>
                          <p className="text-sm font-black text-purple-900 leading-tight">Combo Bonus ₹{applied} OFF unlocked!</p>
                          {next && (
                            <p className="text-[11px] text-purple-700 mt-0.5">
                              Add <b>{next.items_needed} more</b> anti-aging product{next.items_needed > 1 ? 's' : ''} to jump to <b>₹{next.amount} OFF</b>
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-black text-purple-900 leading-tight">Combo Bonus — up to ₹{tiers[tiers.length - 1].amount} OFF</p>
                          {next ? (
                            <p className="text-[11px] text-purple-700 mt-0.5">
                              Add <b>{next.items_needed} more</b> anti-aging product{next.items_needed > 1 ? 's' : ''} to unlock <b>₹{next.amount} OFF</b>
                            </p>
                          ) : (
                            <p className="text-[11px] text-purple-700 mt-0.5">Any 2+ anti-aging products unlocks an automatic discount.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress rail */}
                  <div className="relative px-2 sm:px-3">
                    <div className="h-2 bg-white/70 rounded-full overflow-hidden ring-1 ring-purple-100" data-testid="cart-combo-progress">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {/* Tier markers — compact on mobile so they never overflow */}
                    <div className="relative mt-2 h-7 sm:h-8">
                      {tiers.map((t, i) => {
                        const pct = (t.items / maxItems) * 100;
                        const unlocked = aaCount >= t.items;
                        const isFirst = i === 0;
                        const isLast = i === tiers.length - 1;
                        // Anchor edges so labels don't clip off the rail on mobile
                        const alignClass = isFirst
                          ? 'left-0 items-start text-left'
                          : isLast
                            ? 'right-0 items-end text-right'
                            : 'left-1/2 -translate-x-1/2 items-center text-center';
                        const styleProp = isFirst || isLast ? undefined : { left: `${pct}%` };
                        return (
                          <div
                            key={i}
                            className={`absolute flex flex-col ${alignClass}`}
                            style={styleProp}
                            data-testid={`cart-combo-tier-${t.items}`}
                          >
                            <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full -mt-[20px] sm:-mt-[22px] ring-2 ${unlocked ? 'bg-purple-600 ring-white shadow' : 'bg-white ring-purple-300'} ${isFirst ? 'ml-0.5' : isLast ? 'mr-0.5' : ''}`} />
                            <div className={`text-[9px] sm:text-[10px] font-black leading-none mt-1 whitespace-nowrap ${unlocked ? 'text-purple-800' : 'text-stone-500'}`}>
                              {t.items} items
                            </div>
                            <div className={`text-[9px] sm:text-[10px] leading-none mt-0.5 whitespace-nowrap ${unlocked ? 'text-purple-700 font-bold' : 'text-stone-400'}`}>
                              ₹{t.amount} OFF
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Recently viewed — tracked from ProductDetailPage views */}
            {recentlyViewedProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-recently-viewed">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-green-700" />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.15em]">Recently viewed · Pick up where you left off</p>
                </div>
                <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                  {recentlyViewedProducts.map(p => (
                    <div key={p.slug} className="flex-shrink-0 w-28 text-center" data-testid={`cart-recent-${p.slug}`}>
                      <Link to={`/product/${p.slug}`}>
                        <div className="w-20 h-20 mx-auto bg-white rounded-xl flex items-center justify-center mb-1.5 overflow-hidden ring-1 ring-stone-200 hover:ring-green-300 hover:shadow-md transition-all">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              className={p.fill_card ? 'w-full h-full object-cover' : 'w-16 h-16 object-contain'}
                            />
                          ) : (
                            <Sparkles size={20} className="text-green-300" />
                          )}
                        </div>
                      </Link>
                      <Link to={`/product/${p.slug}`}><p className="text-xs font-semibold text-gray-800 line-clamp-1 hover:text-green-700">{p.short_name}</p></Link>
                      <p className="text-xs text-gray-500">₹{p.prepaid_price}</p>
                      <button onClick={() => addUpsellToCart(p.slug)} className="mt-1.5 w-full bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-700" data-testid={`cart-recent-add-${p.slug}`}>+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* You may also like — niche/concern/category-aware suggestions */}
            {upsellProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-similar-products">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">You may also like</p>
                <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                  {upsellProducts.slice(0, 6).map(p => (
                    <div key={p.slug} className="flex-shrink-0 w-28 text-center" data-testid={`cart-upsell-${p.slug}`}>
                      <Link to={`/product/${p.slug}`}>
                        <div className="w-20 h-20 mx-auto bg-stone-50 rounded-xl flex items-center justify-center mb-1.5 overflow-hidden hover:shadow-md transition-shadow">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.querySelector('.upsell-fallback').style.display = 'flex'; }}
                              className="w-16 h-16 object-contain"
                            />
                          ) : null}
                          <div className="upsell-fallback w-16 h-16 items-center justify-center text-green-300" style={{ display: p.images?.[0] ? 'none' : 'flex' }}>
                            <Sparkles size={20} />
                          </div>
                        </div>
                      </Link>
                      <Link to={`/product/${p.slug}`}><p className="text-xs font-semibold text-gray-800 line-clamp-1 hover:text-green-700">{p.short_name}</p></Link>
                      <p className="text-xs text-gray-500">₹{p.prepaid_price}</p>
                      <button onClick={() => addUpsellToCart(p.slug)} className="mt-1.5 w-full bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-700" data-testid={`cart-upsell-add-${p.slug}`}>+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust Bar */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-4 border border-green-100">
              <div className="grid grid-cols-3 gap-3">
                {[{ icon: Lock, t: '256-bit Secure', d: 'SSL Encrypted' }, { icon: Truck, t: 'Free Shipping', d: 'All India Delivery' }, { icon: Clock, t: '7-Day Return', d: 'Sealed items only' }].map((b, i) => (
                  <div key={i} className="text-center">
                    <div className="w-9 h-9 mx-auto mb-1.5 bg-white rounded-xl flex items-center justify-center shadow-sm"><b.icon size={16} className="text-green-600" /></div>
                    <p className="text-xs font-bold text-gray-800">{b.t}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Review carousel — auto-scrolling reviews from /admin/reviews */}
            <div className="-mx-4 sm:-mx-0">
              <ReviewsCarousel
                title="Customers love us"
                eyebrow="Verified · From across India"
              />
            </div>
          </div>

          {/* Summary Column */}
          <div className="space-y-3">
            {cartData.savings > 0 && (
              <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-3.5 text-center text-white shadow-lg shadow-green-200/30">
                <p className="text-sm font-bold">You're saving ₹{cartData.savings?.toLocaleString()}</p>
                <p className="text-xs text-green-100">on this order</p>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-coupon-block">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Have a Coupon?</p>
              {appliedCoupon ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                  <div><p className="font-bold text-green-700 text-sm">{appliedCoupon.code}</p><p className="text-xs text-green-600">Saving ₹{appliedCoupon.discount}</p></div>
                  <button onClick={removeCoupon} className="text-gray-400 text-xs hover:text-red-500">Remove</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-green-200" />
                    <button onClick={applyCoupon} className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800">Apply</button>
                  </div>
                  {/* Available coupons (admin-published) — tap to apply */}
                  {publicCoupons.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200" data-testid="cart-public-coupons">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.12em] mb-2">Available offers</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {publicCoupons.slice(0, 6).map(c => (
                          <div key={c.code} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-2.5 flex items-center gap-2" data-testid={`cart-coupon-${c.code}`}>
                            <Tag size={14} className="text-orange-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold font-mono text-gray-900 truncate">{c.code}</p>
                              {c.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
                            </div>
                            <button onClick={() => applyCouponCode(c.code)} className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0" data-testid={`apply-coupon-${c.code}`}>Apply</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            {/* Gift Card section */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="gift-card-section">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-rose-500" />
                <h3 className="font-bold text-sm text-gray-900">Have a Gift Card?</h3>
              </div>
              {appliedGiftCard && appliedGiftCard.code ? (
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between" data-testid="applied-giftcard">
                  <div>
                    <p className="font-bold text-rose-700 text-sm font-mono">{appliedGiftCard.code}</p>
                    <p className="text-xs text-rose-600">−₹{appliedGiftCard.discount} applied • ₹{appliedGiftCard.remaining_after} left on card</p>
                  </div>
                  <button onClick={() => { setAppliedGiftCard(null); setGiftCardCode(''); validateCart(undefined, null); }} className="text-gray-400 text-xs hover:text-red-500" data-testid="remove-giftcard">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                    placeholder="Enter gift card code"
                    data-testid="giftcard-input"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-rose-200 font-mono"
                  />
                  <button
                    onClick={() => { if (giftCardCode.trim()) { validateCart(undefined, giftCardCode.trim()); } }}
                    data-testid="giftcard-apply"
                    className="px-4 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700"
                  >Apply</button>
                </div>
              )}
              {giftCardError && <p className="text-red-500 text-xs mt-1" data-testid="giftcard-error">{giftCardError}</p>}
              <p className="text-[10px] text-gray-400 mt-2">💡 Gift cards work like cash. Unused balance stays on your card for future orders.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="order-summary">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Order Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400"><span>MRP</span><span className="line-through">₹{cartData.mrp_total?.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-700"><span>Subtotal</span><span className="font-medium">₹{cartData.subtotal?.toLocaleString()}</span></div>
                {cartData.discount > 0 && <div className="flex justify-between text-green-600"><span>Coupon Discount</span><span>-₹{cartData.discount}</span></div>}
                {cartData.combo_bonus_applied > 0 && (
                  <div className="flex justify-between text-purple-700 font-semibold" data-testid="cart-combo-bonus-row">
                    <span className="flex items-center gap-1.5">
                      <Award size={13} strokeWidth={2.5} /> Combo Bonus ₹{cartData.combo_bonus_applied} OFF
                    </span>
                    <span>-₹{cartData.combo_bonus_applied}</span>
                  </div>
                )}
                {cartData.gift_card_discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium" data-testid="gift-card-discount-row">
                    <span>🎁 Gift Card ({cartData.gift_card?.code})</span>
                    <span>-₹{cartData.gift_card_discount}</span>
                  </div>
                )}
                {/* Volume discount removed — no buy-more nudge on the cart summary */}
                {/* Taxes & charges — always visible; shows FREE when waived by the Anti-Aging sale perk. */}
                {(cartData.tax_charges > 0 || cartData.sale_perks?.tax) && (
                  <div className="flex justify-between text-gray-700" data-testid="tax-charges-row">
                    <span className="flex items-center gap-1.5">
                      Taxes &amp; Charges
                      {cartData.sale_perks?.tax ? (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {cartData.sale_perks.reason || 'FLAT 50% OFF'}
                        </span>
                      ) : cartData.tax_reduction_label && (
                        <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">{cartData.tax_reduction_label}</span>
                      )}
                    </span>
                    <span className="font-medium text-gray-900">
                      {cartData.sale_perks?.tax ? (
                        <>
                          {cartData.tax_charges_original > 0 && (
                            <span className="text-gray-400 line-through mr-1.5">₹{cartData.tax_charges_original}</span>
                          )}
                          <span className="text-green-600 font-bold">FREE</span>
                        </>
                      ) : (
                        <>
                          {cartData.tax_charges_original > cartData.tax_charges && (
                            <span className="text-gray-400 line-through mr-1.5">₹{cartData.tax_charges_original}</span>
                          )}
                          ₹{cartData.tax_charges}
                        </>
                      )}
                    </span>
                  </div>
                )}
                {/* Delivery — tiered (₹49 → ₹39 → ₹29 → ₹19). Explicit FREE display when sale perk waives it. */}
                <div className="flex justify-between text-gray-700">
                  <span className="flex items-center gap-1.5">
                    Delivery
                    {cartData.sale_perks?.delivery && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {cartData.sale_perks.reason || 'FLAT 50% OFF'}
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-gray-900" data-testid="delivery-fee">
                    {cartData.sale_perks?.delivery ? (
                      <>
                        {cartData.delivery_fee_original > 0 && (
                          <span className="text-gray-400 line-through mr-1.5">₹{cartData.delivery_fee_original}</span>
                        )}
                        <span className="text-green-600 font-bold">FREE</span>
                      </>
                    ) : (
                      <>
                        {cartData.delivery_fee_original > cartData.delivery_fee && cartData.delivery_fee > 0 && (
                          <span className="text-gray-400 line-through mr-1.5">₹{cartData.delivery_fee_original}</span>
                        )}
                        {cartData.delivery_fee > 0 ? <span className="text-orange-600">₹{cartData.delivery_fee}</span> : <span className="text-green-600">FREE</span>}
                      </>
                    )}
                  </span>
                </div>
                {/* Eco packaging */}
                {cartData.packaging_fee > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs" data-testid="packaging-row">
                    <span className="flex items-center gap-1">📦 Eco Packaging</span>
                    <span>₹{cartData.packaging_fee}</span>
                  </div>
                )}
                {/* Next-tier upsell nudge — shows for every band so customers always see the next save */}
                {cartData.next_tier && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 leading-snug" data-testid="next-tier-nudge">
                    🎁 Add <span className="font-bold">₹{cartData.next_tier.spend_more}</span> more to unlock <span className="font-semibold">{cartData.next_tier.next_tax_pct_off}% OFF taxes</span>{cartData.next_tier.next_delivery_fee < cartData.delivery_fee && (<> + delivery drops to <span className="font-semibold">₹{cartData.next_tier.next_delivery_fee}</span></>)}
                  </div>
                )}
                {cartData.charges_savings > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-[11px] text-green-800 leading-snug" data-testid="qualified-banner">
                    🎉 You're saving ₹{cartData.charges_savings} on this order — {cartData.tax_reduction_label || 'discounted'} taxes + ₹{cartData.delivery_fee} delivery!
                  </div>
                )}
                {cartData.moq_block && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-800 leading-snug" data-testid="moq-block-banner">
                    <span className="font-semibold">Minimum order ₹{cartData.moq_amount || 300}.</span> Add <b>₹{Math.ceil(cartData.moq_remaining)}</b> more to proceed.
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900 text-lg"><span>Total</span><span>₹{cartData.total?.toLocaleString()}</span></div>
              </div>
            </div>

            <button onClick={proceedToCheckout} disabled={cartData?.moq_block} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-base shadow-xl shadow-green-200/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed" data-testid="proceed-checkout-btn">
              {cartData?.moq_block ? `Add ₹${Math.ceil(cartData.moq_remaining)} more to checkout` : 'Proceed to Checkout'}
            </button>

            {/* Social Proof Badges */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-xl p-3 text-center border border-amber-100/60">
                <p className="text-xl font-black text-amber-700">127</p>
                <p className="text-xs text-amber-600 font-semibold tracking-wide">ORDERS TODAY</p>
              </div>
              <div className="bg-gradient-to-b from-rose-50 to-pink-50 rounded-xl p-3 text-center border border-rose-100/60">
                <p className="text-xl font-black text-rose-700">4.8</p>
                <p className="text-xs text-rose-600 font-semibold tracking-wide">AVG RATING</p>
              </div>
              <div className="bg-gradient-to-b from-purple-50 to-violet-50 rounded-xl p-3 text-center border border-purple-100/60">
                <p className="text-xl font-black text-purple-700">50K+</p>
                <p className="text-xs text-purple-600 font-semibold tracking-wide">CUSTOMERS</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
