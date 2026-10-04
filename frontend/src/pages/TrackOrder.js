import React, { useState } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Search, Phone, Mail, Truck, CheckCircle, Clock, 
  MapPin, ChevronLeft, ExternalLink, AlertCircle, Box
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function TrackOrder() {
  const [mode, setMode] = useState('phone'); // 'phone' | 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    setError('');
    setOrders(null);

    if (mode === 'phone') {
      if (phone.length < 10) {
        setError('Please enter valid 10-digit phone number');
        return;
      }
    } else {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setLoading(true);
    try {
      const body = mode === 'phone' ? { phone } : { email: email.trim().toLowerCase() };
      const res = await axios.post(`${API}/track-order`, body);
      if (res.data?.success) {
        setOrders(res.data.orders || []);
        if ((res.data.orders || []).length === 0) {
          setError(`No orders found for this ${mode === 'phone' ? 'phone number' : 'email'}.`);
        }
      } else {
        setError(res.data?.error || 'No orders found');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to track order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'text-green-600 bg-green-100';
      case 'shipped':
      case 'in transit':
        return 'text-blue-600 bg-blue-100';
      case 'out_for_delivery':
      case 'out for delivery':
        return 'text-orange-600 bg-orange-100';
      case 'confirmed':
      case 'processing':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5" />;
      case 'shipped':
      case 'in transit':
        return <Truck className="w-5 h-5" />;
      case 'out_for_delivery':
      case 'out for delivery':
        return <MapPin className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-gray-600 hover:text-green-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Track Your Order</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Track Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Track Your Order</h2>
            <p className="text-gray-500">
              {mode === 'phone'
                ? 'Enter the phone number used during order placement'
                : 'Enter the email used during order placement'}
            </p>
          </div>

          {/* Phone / Email toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-4" data-testid="track-mode-toggle">
            <button
              type="button"
              onClick={() => { setMode('phone'); setError(''); setOrders(null); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                mode === 'phone' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="track-mode-phone"
            >
              <Phone size={15} /> Phone
            </button>
            <button
              type="button"
              onClick={() => { setMode('email'); setError(''); setOrders(null); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                mode === 'email' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="track-mode-email"
            >
              <Mail size={15} /> Email
            </button>
          </div>

          <form onSubmit={handleTrack} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {mode === 'phone' ? <Phone className="w-5 h-5 text-gray-400" /> : <Mail className="w-5 h-5 text-gray-400" />}
              </div>
              {mode === 'phone' ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter your phone number"
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors text-lg outline-none"
                  maxLength={10}
                  data-testid="track-input-phone"
                />
              ) : (
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors text-base outline-none"
                  data-testid="track-input-email"
                />
              )}
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || (mode === 'phone' ? phone.length < 10 : !email.trim())}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              data-testid="track-submit-btn"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Track Order
                </>
              )}
            </button>
          </form>
        </div>

        {/* Orders List */}
        {orders && orders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Found {orders.length} order{orders.length > 1 ? 's' : ''}
            </h3>
            
            {orders.map((order) => (
              <div key={order.order_id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Order Header */}
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Order ID</p>
                      <p className="font-bold text-gray-900">{order.order_id}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${getStatusColor(order.delivery_status || order.status)}`}>
                      {getStatusIcon(order.delivery_status || order.status)}
                      <span className="font-medium capitalize">
                        {(order.delivery_status || order.status || 'Processing').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Visual horizontal progress timeline */}
                {(() => {
                  const status = (order.delivery_status || order.status || 'confirmed').toLowerCase();
                  const steps = [
                    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
                    { key: 'shipped', label: 'Shipped', icon: Package },
                    { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
                    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
                  ];
                  const order_status_index = { confirmed: 0, processing: 0, shipped: 1, in_transit: 1, out_for_delivery: 2, delivered: 3 };
                  const reached = order_status_index[status] ?? 0;
                  return (
                    <div className="px-4 sm:px-6 py-5 bg-white border-b border-stone-100" data-testid={`timeline-${order.order_id}`}>
                      <div className="flex items-center justify-between max-w-2xl mx-auto">
                        {steps.map((s, i) => {
                          const done = i <= reached;
                          const Icon = s.icon;
                          return (
                            <React.Fragment key={s.key}>
                              <div className="flex flex-col items-center flex-shrink-0 z-10">
                                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors ${done ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                                  <Icon size={18} />
                                </div>
                                <p className={`text-[10px] sm:text-xs font-semibold mt-1.5 text-center ${done ? 'text-emerald-700' : 'text-stone-400'}`}>{s.label}</p>
                              </div>
                              {i < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 sm:mx-2 -mt-5 sm:-mt-6 ${i < reached ? 'bg-emerald-600' : 'bg-stone-200'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Order Details */}
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Customer</p>
                      <p className="font-medium text-gray-900">{order.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="font-bold text-green-600">₹{order.total_amount}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-500">Payment</p>
                      <p className="font-medium text-gray-900 capitalize">{order.payment_method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">Ordered On</p>
                      <p className="font-medium text-gray-900">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* AWB / Tracking */}
                  {order.awb_number && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Tracking Number</p>
                          <p className="font-mono font-medium text-gray-900">{order.awb_number}</p>
                        </div>
                        {order.tracking_url && (
                          <a 
                            href={order.tracking_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium text-sm"
                          >
                            Track on Delhivery
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      
                      {order.expected_delivery && (
                        <p className="text-sm text-gray-500 mt-2">
                          Expected Delivery: <span className="font-medium text-gray-900">{order.expected_delivery}</span>
                        </p>
                      )}
                      
                      {order.status_location && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin size={14} />
                          Currently at: <span className="font-medium text-gray-900">{order.status_location}</span>
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Tracking Timeline */}
                  {order.scans && order.scans.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium text-gray-700 mb-3">Tracking History</p>
                      <div className="space-y-3">
                        {order.scans.slice(0, 5).map((scan, i) => (
                          <div key={`${order.order_id}-scan-${scan.ScanDetail?.ScanDateTime || i}`} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              {i < order.scans.length - 1 && i < 4 && (
                                <div className="w-0.5 h-full bg-gray-200 my-1"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-2">
                              <p className="text-sm font-medium text-gray-900">
                                {scan.ScanDetail?.Scan || scan.Activity || 'Update'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {scan.ScanDetail?.ScannedLocation || scan.Location || '-'} • {' '}
                                {scan.ScanDetail?.ScanDateTime || scan.Time || '-'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Orders State */}
        {orders && orders.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-500 mb-6">
              We couldn't find any orders with this phone number.
            </p>
            <Link
              to="/product"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-green-600"
            >
              Shop Now
            </Link>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
          <h4 className="font-bold text-amber-800 mb-2">Need Help?</h4>
          <p className="text-amber-700 text-sm mb-3">
            If you have any questions about your order, please contact us:
          </p>
          <a 
            href="https://wa.me/919446125745" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
          >
            WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default TrackOrder;
