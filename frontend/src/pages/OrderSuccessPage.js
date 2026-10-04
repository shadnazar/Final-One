import React, { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { Check, Package, Truck, Phone, Gift, Copy, Share2, MessageCircle, Sparkles, Camera, ChevronRight } from 'lucide-react';
import { trackPurchase } from '../utils/metaPixel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function OrderSuccessPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Instant render: prefer order passed via route state (from Checkout), then sessionStorage, then fetch.
  const stateOrder = location.state?.order;
  const cachedOrder = (() => {
    try {
      const raw = sessionStorage.getItem(`cg_order_${orderId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const initialOrder = stateOrder || cachedOrder || null;

  const [order, setOrder] = useState(initialOrder);
  // No loading spinner if we already have the order from Checkout – shows success instantly.
  const [loading, setLoading] = useState(!initialOrder);
  const [pixelFired, setPixelFired] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchOrderAndTrack = async () => {
      try {
        let orderData = order;
        // Only hit the network if we don't already have the order in memory
        if (!orderData) {
          const response = await axios.get(`${API}/orders/${orderId}`);
          orderData = response.data;
          setOrder(orderData);
        }
        // Cache for page refreshes
        try { sessionStorage.setItem(`cg_order_${orderId}`, JSON.stringify(orderData)); } catch {}

        // Fire Purchase event ONLY ONCE
        if (!pixelFired && orderData) {
          // Build contents[] from actual line items — Meta uses this for
          // value-based bidding / catalog matching / CAPI dedup.
          const items = Array.isArray(orderData.items) ? orderData.items : [];
          const contents = items.map(it => ({
            id: it.slug || it.combo_id || it.product_slug || 'celesta_glow',
            quantity: it.quantity || 1,
            item_price: it.price || 0,
          }));
          const numItems = items.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
          const contentName = items.map(i => i.name || i.slug).filter(Boolean).join(', ') || 'Celesta Glow Products';

          // Retry-capable Meta Pixel Purchase (waits for fbq stub → fbevents.js).
          trackPurchase(orderData.order_id, orderData.amount, {
            contents,
            num_items: numItems,
            content_name: contentName,
          });

          // Google Ads conversion tracking
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'conversion', {
              send_to: 'AW-16928253164/purchase',
              value: orderData.amount,
              currency: 'INR',
              transaction_id: orderData.order_id
            });
            console.log('[Google Ads] Conversion fired - order_id:', orderData.order_id);
          }

          // Track order_complete to backend analytics
          try {
            const visitorId = sessionStorage.getItem('visitor_id') || localStorage.getItem('visitor_id') || 'unknown';
            const sessionId = sessionStorage.getItem('session_id') || 'unknown';
            await axios.post(`${API}/track-action`, {
              visitor_id: visitorId,
              session_id: sessionId,
              action: 'order_complete',
              details: {
                order_id: orderData.order_id,
                amount: orderData.amount,
                payment_method: orderData.payment_method
              }
            });
            console.log('[Backend Analytics] order_complete tracked for:', orderData.order_id);
          } catch (trackErr) {
            console.error('[Backend Analytics] Failed to track order_complete:', trackErr);
          }

          setPixelFired(true);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderAndTrack();
    }
  }, [orderId, pixelFired]);

  const referralLink = order?.referral_link || `https://celestaglow.com?ref=${order?.referral_code || ''}`;

  // Niche-aware continue shopping — preserves the niche the customer came from.
  const continueShoppingTarget = (() => {
    if (!Array.isArray(order?.items)) return '/';
    const niches = new Set(order.items.map(it => it.niche).filter(Boolean));
    if (niches.size === 1) {
      const n = [...niches][0];
      if (n === 'skincare') return '/skincare';
      if (n === 'cosmetics') return '/cosmetics';
    }
    return '/';
  })();

  const downloadInvoice = () => {
    if (!order) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const itemsHtml = (order.items || []).map(it =>
      `<tr><td>${it.name || it.slug || 'Product'} × ${it.quantity || 1}</td><td style="text-align:right">₹${((it.price || 0) * (it.quantity || 1))}</td></tr>`
    ).join('');
    w.document.write(`<html><head><title>Invoice ${order.order_id}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111;}
        h1{color:#047857;margin-bottom:4px;}
        .meta{color:#6b7280;font-size:13px;margin-bottom:30px;}
        table{width:100%;border-collapse:collapse;margin:20px 0;}
        th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px;}
        .total{font-weight:bold;font-size:16px;color:#047857;}
        .footer{margin-top:40px;font-size:12px;color:#6b7280;text-align:center;}
      </style></head><body>
      <h1>Celesta Glow</h1>
      <div class="meta">Tax Invoice · Order ${order.order_id} · ${new Date(order.created_at || Date.now()).toLocaleDateString('en-IN')}</div>
      <div><strong>Bill to:</strong><br/>${order.name}<br/>+91 ${order.phone}<br/>${order.house_number}, ${order.area}<br/>${order.state} - ${order.pincode}</div>
      <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${itemsHtml || `<tr><td>Celesta Glow Products</td><td style="text-align:right">₹${order.amount}</td></tr>`}
      <tr><td class="total">Total</td><td class="total" style="text-align:right">₹${order.amount}</td></tr>
      <tr><td>Payment</td><td style="text-align:right">${order.payment_method}</td></tr></tbody></table>
      <div class="footer">Thank you for choosing Celesta Glow · support@celestaglow.com · +91 9446125745</div>
      <script>window.print();</script></body></html>`);
    w.document.close();
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const message = encodeURIComponent(
      `Hey! I just ordered from Celesta Glow and got amazing results! \n\nUse my link to get ₹50 OFF on India's #1 Anti-Aging Range:\n${referralLink}\n\nTrust me, your skin will thank you!`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const contactWhatsApp = () => {
    const message = encodeURIComponent(`Hi! I just placed order ${order?.order_id}. Need help with my order.`);
    window.open(`https://wa.me/919446125745?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-5">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Order not found</p>
          <button
            onClick={() => navigate('/')}
            className="bg-green-500 text-white px-6 py-2 rounded-full"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-6">
      <div className="max-w-2xl mx-auto pb-2"><BackButton to="/" label="Home" /></div>
      {/* Success Header */}
      <div className="text-center mb-6 mt-2">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={40} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1" data-testid="order-success-title">
          Order Confirmed!
        </h1>
        <p className="text-gray-500">Thank you for choosing Celesta Glow</p>
      </div>

      {/* Order ID Card */}
      <div className="bg-white rounded-2xl shadow-sm p-5 text-center mb-5" data-testid="order-id-card">
        <p className="text-gray-500 text-sm mb-1">Order ID</p>
        <p className="text-2xl font-bold text-green-500 tracking-wider">{order.order_id}</p>
      </div>

      {/* AI Skin Tracker + Routine CTA */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg p-5 mb-5 text-white" data-testid="order-tracker-cta">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={20} />
          <h3 className="font-bold text-lg">Start your AI skin journey</h3>
        </div>
        <p className="text-sm opacity-95 mb-4">
          Unlock your <b>FREE 1-month</b> AI Skin Progress Tracker — daily tasks, photo progress & improvement suggestions. Plus build your personalised routine.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/tracker" data-testid="order-open-tracker"
            className="flex-1 flex items-center justify-center gap-2 bg-white text-emerald-700 font-black py-3 rounded-xl hover:bg-emerald-50 transition-colors">
            <Camera size={18} /> Open my tracker <ChevronRight size={16} />
          </Link>
          <Link to="/routine"
            className="flex-1 flex items-center justify-center gap-2 bg-white/15 text-white font-bold py-3 rounded-xl hover:bg-white/25 transition-colors">
            <Sparkles size={18} /> Build my routine
          </Link>
        </div>
      </div>

      {/* 🎁 Referral Section - Prominent */}
      {order.referral_code && (
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl shadow-lg p-5 mb-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={24} />
            <h3 className="font-bold text-lg">Earn ₹100 - Share & Earn!</h3>
          </div>
          <p className="text-sm opacity-95 mb-4">
            Give your friends ₹50 off and get ₹100 cashback after their delivery!
          </p>
          
          {/* Referral Link Box */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4">
            <p className="text-xs opacity-80 mb-1">Your Referral Link:</p>
            <p className="text-sm font-mono break-all">{referralLink}</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={copyReferralLink}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-green-600 font-semibold py-3 rounded-xl hover:bg-green-50 transition-colors"
              data-testid="copy-referral-btn"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={shareOnWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 rounded-xl hover:bg-[#20BD5A] transition-colors"
              data-testid="whatsapp-share-btn"
            >
              <MessageCircle size={18} />
              Share on WhatsApp
            </button>
          </div>
          
          <p className="text-xs opacity-80 mt-3 text-center">
            Referral link also sent to your email: {order.email || 'Not provided'}
          </p>
        </div>
      )}

      {/* Order Timeline */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Order Placed</p>
              <p className="text-xs text-gray-500">Your order has been confirmed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <Package size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-400">Packing</p>
              <p className="text-xs text-gray-400">We're preparing your order</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <Truck size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-400">Shipping</p>
              <p className="text-xs text-gray-400">Expected: {order.delivery_timeline || '2-3 business days'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>

        {/* Per-item rows so admin/customer see exactly what was ordered + quantity */}
        {Array.isArray(order.items) && order.items.length > 0 ? (
          <div className="mb-3 border-b border-gray-100 pb-3 space-y-2" data-testid="order-items-list">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-sm" data-testid={`order-item-${idx}`}>
                <span className="text-gray-700 flex-1 pr-2">
                  {it.name || it.short_name || it.slug || 'Product'}
                  <span className="text-gray-400"> × {it.quantity || 1}</span>
                </span>
                {typeof it.price !== 'undefined' && (
                  <span className="text-gray-900 font-medium">₹{(it.price || 0) * (it.quantity || 1)}</span>
                )}
              </div>
            ))}
            {order.combo_id && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Combo</span>
                <span className="text-gray-900 font-medium">{order.combo_id}</span>
              </div>
            )}
            {order.free_gift && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2" data-testid="order-free-gift">
                {order.free_gift.image && (
                  <img src={order.free_gift.image} alt={order.free_gift.name} className="w-10 h-10 rounded-lg object-cover ring-1 ring-emerald-200 bg-white" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black tracking-[0.2em] text-emerald-700 uppercase">🎁 Included FREE</p>
                  <p className="text-sm font-black text-stone-900 leading-tight truncate">{order.free_gift.name}</p>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">FREE</span>
              </div>
            )}
          </div>
        ) : order.combo_id ? (
          <div className="mb-3 border-b border-gray-100 pb-3 flex justify-between text-sm">
            <span className="text-gray-700">{order.combo_id} <span className="text-gray-400">× 1</span></span>
            <span className="text-gray-900 font-medium">₹{order.amount}</span>
          </div>
        ) : null}

        <div className="space-y-3 text-sm">
          {(!order.items || order.items.length === 0) && !order.combo_id && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Product</span>
                <span className="text-gray-900 font-medium">Celesta Glow Products</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity</span>
                <span className="text-gray-900">1</span>
              </div>
            </>
          )}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Total Items</span>
              <span className="text-gray-900 font-medium" data-testid="order-total-qty">
                {order.items.reduce((sum, it) => sum + (it.quantity || 1), 0)}
              </span>
            </div>
          )}
          
          {/* Show full amount due at delivery for COD, paid amount for prepaid */}
          {order.payment_method?.includes('COD') ? (
            <div className="flex justify-between bg-yellow-50 -mx-5 px-5 py-2" data-testid="cod-amount-due">
              <span className="text-yellow-700 font-medium">Pay at Delivery</span>
              <span className="text-yellow-700 font-bold">₹{order.amount}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span className="text-gray-500">Amount Paid</span>
              <span className="text-green-600 font-bold">₹{order.amount}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method</span>
            <span className="text-gray-900">{order.payment_method}</span>
          </div>
          {order.referral_code_used && (
            <div className="flex justify-between">
              <span className="text-gray-500">Referral Used</span>
              <span className="text-purple-600 font-medium">{order.referral_code_used}</span>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <h3 className="font-semibold text-gray-900 mb-3">Delivery Address</h3>
        <p className="text-gray-600 text-sm">
          {order.name}<br />
          <span className="flex items-center gap-1 mt-1">
            <Phone size={14} />
            +91 {order.phone}
          </span>
          {order.house_number}, {order.area}<br />
          {order.state} - {order.pincode}
        </p>
      </div>

      {/* Primary CTAs — Track Order + Download Invoice */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          onClick={() => navigate(`/track-order?orderId=${order.order_id}`)}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold py-3.5 rounded-full hover:bg-emerald-700 transition-colors"
          data-testid="track-order-btn"
        >
          <Truck size={18} />
          Track Order
        </button>
        <button
          onClick={downloadInvoice}
          className="flex items-center justify-center gap-2 bg-white text-emerald-700 ring-1 ring-emerald-200 font-semibold py-3.5 rounded-full hover:bg-emerald-50 transition-colors"
          data-testid="download-invoice-btn"
        >
          <Package size={18} />
          Invoice
        </button>
      </div>

      {/* WhatsApp Support */}
      <button
        onClick={contactWhatsApp}
        className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-4 rounded-full mb-4"
        data-testid="whatsapp-support-btn"
      >
        <MessageCircle size={20} />
        Contact Us on WhatsApp
      </button>

      {/* Continue Shopping Button — niche-aware, brand green */}
      <button
        onClick={() => navigate(continueShoppingTarget)}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-full transition-colors"
        data-testid="continue-shopping-button"
      >
        Continue Shopping
      </button>

      {/* Support Info */}
      <p className="text-center text-xs text-gray-500 mt-4">
        Need help? WhatsApp: +91 9446125745
      </p>
    </div>
  );
}

export default OrderSuccessPage;
