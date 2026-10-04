import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Search, Phone, Mail, MapPin, Package, ShoppingCart,
  CheckCircle, Clock, RefreshCw, ChevronRight, Filter, User
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';
import LeadsPanel from './LeadsPanel';

const API = process.env.REACT_APP_BACKEND_URL;

/** Heuristic customer segmentation — purely client-side. */
function customerSegment(c) {
  const total = c.total_spent || 0;
  const orders = c.orders?.length || 0;
  const lastTs = c.last_contact ? new Date(c.last_contact).getTime() : 0;
  const daysSince = lastTs ? Math.floor((Date.now() - lastTs) / 86400000) : 9999;

  if (total >= 5000 || orders >= 5) {
    return { label: 'VIP', cls: 'bg-purple-100 text-purple-700 ml-1', title: '₹5k+ spent or 5+ orders' };
  }
  if (orders >= 2 && daysSince <= 60) {
    return { label: 'Loyal', cls: 'bg-blue-100 text-blue-700 ml-1', title: '2+ orders in last 60 days' };
  }
  if (c.has_purchased && daysSince > 90 && daysSince <= 180) {
    return { label: 'At-Risk', cls: 'bg-amber-100 text-amber-700 ml-1', title: '90–180 days since last contact' };
  }
  if (c.has_purchased && daysSince > 180) {
    return { label: 'Dormant', cls: 'bg-rose-100 text-rose-700 ml-1', title: '180+ days inactive' };
  }
  return null;
}

function AdminCustomers() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, purchased, leads
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = async (token) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/customers?limit=200`, {
        headers: { 'X-Admin-Token': token }
      });
      setCustomers(res.data.customers || []);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async (query) => {
    if (!query.trim()) {
      fetchCustomers(adminToken);
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/customers/search?q=${encodeURIComponent(query)}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && adminToken) {
      fetchCustomers(adminToken);
    }
  }, [authLoading, isAuthenticated, adminToken]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchCustomers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const filteredCustomers = customers.filter(c => {
    if (filterStatus === 'purchased') return c.has_purchased;
    if (filterStatus === 'leads') return !c.has_purchased;
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 text-sm">View all customers, leads, and their order history</p>
      </div>

      {/* Lead-generation submissions (Partner With Us / Invest Now / Free Skin Advice) */}
      <LeadsPanel auth={{ headers: { 'X-Admin-Token': adminToken } }} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Total Customers</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total_customers || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Purchased</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.purchased || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-orange-500" />
            <span className="text-sm text-gray-500">Leads</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.leads || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">₹{(stats.total_revenue || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'purchased', 'leads'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status === 'purchased' ? 'Purchased' : 'Leads'}
            </button>
          ))}
          <button
            onClick={() => fetchCustomers(adminToken)}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Spent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Contact</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer, idx) => (
                  <tr key={customer.phone + idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          customer.has_purchased ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <User className={`w-5 h-5 ${customer.has_purchased ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer.name || 'Unknown'}</p>
                          {customer.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`tel:+91${customer.phone}`} className="text-blue-600 hover:underline font-mono text-sm">
                        +91 {customer.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {customer.address?.city && (
                          <p className="text-gray-900">{customer.address.city}</p>
                        )}
                        {customer.address?.state && (
                          <p className="text-gray-500 text-xs">{customer.address.state}</p>
                        )}
                        {!customer.address?.city && !customer.address?.state && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.has_purchased ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle size={12} />
                          Purchased
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          <Clock size={12} />
                          Lead
                        </span>
                      )}
                      {/* Segment badge: VIP / Loyal / At-Risk / Dormant */}
                      {(() => {
                        const seg = customerSegment(customer);
                        if (!seg) return null;
                        return (
                          <span
                            className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${seg.cls}`}
                            data-testid={`segment-${customer.phone}`}
                            title={seg.title}
                          >
                            {seg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{customer.orders?.length || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${customer.total_spent > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        ₹{(customer.total_spent || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(customer.last_contact)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight size={18} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedCustomer.has_purchased ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <User className={`w-6 h-6 ${selectedCustomer.has_purchased ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name || 'Unknown'}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedCustomer.has_purchased ? 'Customer' : 'Lead'} • via {selectedCustomer.source}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Contact Information</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-gray-400" />
                    <a href={`tel:+91${selectedCustomer.phone}`} className="text-blue-600 hover:underline">
                      +91 {selectedCustomer.phone}
                    </a>
                  </div>
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-gray-400" />
                      <a href={`mailto:${selectedCustomer.email}`} className="text-blue-600 hover:underline">
                        {selectedCustomer.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              {(selectedCustomer.address?.house || selectedCustomer.address?.city) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Delivery Address</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-gray-400 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        {selectedCustomer.address.house && <p>{selectedCustomer.address.house}</p>}
                        {selectedCustomer.address.area && <p>{selectedCustomer.address.area}</p>}
                        <p>
                          {[selectedCustomer.address.city, selectedCustomer.address.state, selectedCustomer.address.pincode]
                            .filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Orders */}
              {selectedCustomer.orders?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Order History ({selectedCustomer.orders.length})</h3>
                  <div className="space-y-2">
                    {selectedCustomer.orders.map((order, idx) => (
                      <div key={order.order_id || idx} className="bg-gray-50 rounded-xl p-4" data-testid={`customer-order-${order.order_id || idx}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm font-semibold text-gray-900">{order.order_id}</p>
                            <p className="text-xs text-gray-500">{formatDate(order.date)} • {order.payment_method}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">₹{order.amount?.toLocaleString()}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Items breakdown — name × qty @ ₹price */}
                        {(Array.isArray(order.items) && order.items.length > 0) || order.combo_id ? (
                          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                            {(order.items || []).map((it, j) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 flex-1 pr-2">
                                  {it.name || it.short_name || it.slug || 'Product'}
                                  <span className="text-gray-400"> × {it.quantity || 1}</span>
                                </span>
                                {typeof it.price !== 'undefined' && (
                                  <span className="text-gray-700 font-medium">₹{(it.price || 0) * (it.quantity || 1)}</span>
                                )}
                              </div>
                            ))}
                            {order.combo_id && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-700">Combo: {order.combo_id} <span className="text-gray-400">× 1</span></span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-gray-500">Total qty</span>
                              <span className="font-semibold text-gray-900">
                                {(order.items || []).reduce((s, i) => s + (i.quantity || 1), 0) + (order.combo_id ? 1 : 0)}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">₹{selectedCustomer.total_spent?.toLocaleString() || 0}</p>
                  <p className="text-xs text-green-700">Total Spent</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedCustomer.orders?.length || 0}</p>
                  <p className="text-xs text-blue-700">Total Orders</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCustomers;
