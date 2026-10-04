import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronLeft, Search, Filter, Download,
  Phone, MapPin, Calendar, IndianRupee, Truck, CheckCircle, X, Edit2, Save, ExternalLink, MessageCircle,
  Clock, ShoppingBag, RotateCcw, XCircle, CalendarDays, ChevronRight, Zap, Bike, Trash2,
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';
import { Calendar as CalendarUI } from '../../components/ui/calendar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Status visual config — single source of truth for icon + color + label.
// Used by the order card pill, the order detail banner, and the filter pills.
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed',  icon: ShoppingBag, pill: 'bg-amber-100 text-amber-800 border-amber-200',
               banner: 'from-amber-500 to-orange-500', dot: 'bg-amber-500' },
  processing:{ label: 'Processing', icon: Clock,       pill: 'bg-blue-100 text-blue-800 border-blue-200',
               banner: 'from-blue-500 to-sky-500',    dot: 'bg-blue-500' },
  shipped:   { label: 'Shipped',    icon: Truck,       pill: 'bg-indigo-100 text-indigo-800 border-indigo-200',
               banner: 'from-indigo-500 to-purple-500',dot: 'bg-indigo-500' },
  in_transit:{ label: 'In Transit', icon: Truck,       pill: 'bg-purple-100 text-purple-800 border-purple-200',
               banner: 'from-purple-500 to-fuchsia-500',dot: 'bg-purple-500' },
  delivered: { label: 'Delivered',  icon: CheckCircle, pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
               banner: 'from-emerald-500 to-green-500',dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled',  icon: XCircle,     pill: 'bg-rose-100 text-rose-800 border-rose-200',
               banner: 'from-rose-500 to-red-500',    dot: 'bg-rose-500' },
  returned:  { label: 'Returned',   icon: RotateCcw,   pill: 'bg-stone-200 text-stone-800 border-stone-300',
               banner: 'from-stone-500 to-stone-600', dot: 'bg-stone-500' },
};

function resolveStatus(order) {
  // Show "In Transit" when an AWB exists + status is shipped (Delhivery picked it up)
  const s = (order?.status || 'confirmed').toLowerCase();
  if (s === 'shipped' && order?.awb_number) return 'in_transit';
  return STATUS_CONFIG[s] ? s : 'confirmed';
}

function OrderStatusBadge({ order, size = 'sm' }) {
  const key = resolveStatus(order);
  const cfg = STATUS_CONFIG[key];
  const Icon = cfg.icon;
  const cls = size === 'lg' ? 'px-3 py-1.5 text-sm gap-2' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${cls} ${cfg.pill}`}
      data-testid={`order-status-badge-${order.order_id}`}
    >
      <Icon size={size === 'lg' ? 16 : 12} />
      {cfg.label}
    </span>
  );
}

function OrderStatusBanner({ order }) {
  const key = resolveStatus(order);
  const cfg = STATUS_CONFIG[key];
  const Icon = cfg.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${cfg.banner} text-white px-5 py-4 shadow-md`}
      data-testid="order-detail-status-banner"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Icon size={22} />
        </div>
        <div>
          <p className="text-[10px] tracking-widest font-semibold uppercase text-white/85">Order status</p>
          <p className="text-xl font-bold leading-tight">{cfg.label}</p>
        </div>
        {order?.awb_number && (
          <div className="ml-auto text-right">
            <p className="text-[10px] tracking-widest font-semibold uppercase text-white/80">AWB</p>
            <p className="text-sm font-mono font-semibold">{order.awb_number}</p>
          </div>
        )}
      </div>
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <span className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-white/5" />
    </div>
  );
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDeliveryType, setFilterDeliveryType] = useState('all'); // 'all' | 'instant' | 'standard'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [orderNotes, setOrderNotes] = useState([]);
  const [orderAudit, setOrderAudit] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  // Delivery-men roster + per-order selection (persisted server-side via `assigned_delivery_man_id`).
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [dmSelection, setDmSelection] = useState({}); // { [order_id]: delivery_man_id }
  const [assigningOrder, setAssigningOrder] = useState(null);
  const navigate = useNavigate();
  const adminToken = getAdminToken();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sorted unique dates that have orders — used by the calendar to highlight
  // dates with activity. Tapping any of those dates filters orders to that day.
  const orderDateModifier = useMemo(() => {
    const set = new Set();
    for (const o of orders) {
      if (!o?.created_at) continue;
      try {
        const d = new Date(o.created_at);
        set.add(d.toISOString().slice(0, 10));
      } catch (_) { /* ignore parse failures */ }
    }
    return Array.from(set).map((s) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    });
  }, [orders]);

  const selectedCalendarDate = useMemo(() => {
    if (dateFrom && dateFrom === dateTo) {
      const [y, m, d] = dateFrom.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return null;
  }, [dateFrom, dateTo]);

  const onCalendarPick = (d) => {
    if (!d) {
      setDateFrom('');
      setDateTo('');
      setCalendarOpen(false);
      return;
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateFrom(iso);
    setDateTo(iso);
    setCalendarOpen(false);
  };

  // Load notes + audit when order detail opens
  useEffect(() => {
    if (!selectedOrder) { setOrderNotes([]); setOrderAudit([]); return; }
    const oid = selectedOrder.order_id;
    setNotesLoading(true);
    Promise.all([
      axios.get(`${API}/admin/orders/${oid}/notes`, { headers: { 'X-Admin-Token': adminToken } }).then(r => r.data?.notes || []).catch(() => []),
      axios.get(`${API}/admin/orders/${oid}/audit-log`, { headers: { 'X-Admin-Token': adminToken } }).then(r => r.data?.events || []).catch(() => []),
    ]).then(([n, a]) => { setOrderNotes(n); setOrderAudit(a); setNotesLoading(false); });
  }, [selectedOrder, adminToken]);

  const addOrderNote = async () => {
    if (!newNote.trim() || !selectedOrder) return;
    try {
      const r = await axios.post(`${API}/admin/orders/${selectedOrder.order_id}/notes`,
        { note: newNote.trim(), author: 'admin' },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      setOrderNotes((prev) => [...prev, r.data.note]);
      setNewNote('');
    } catch (e) { alert('Failed to add note'); }
  };

  const openInvoice = (orderId) => {
    // Backend invoice route requires X-Admin-Token header — fetch + display in a new window.
    fetch(`${API}/admin/orders/${orderId}/invoice`, { headers: { 'X-Admin-Token': adminToken } })
      .then(r => r.text())
      .then(html => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
      })
      .catch(() => alert('Failed to open invoice'));
  };

  useEffect(() => {
    if (!adminToken) return;
    fetchOrders();
  }, [adminToken, dateFrom, dateTo, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load delivery-men roster once — used by every order card's dropdown.
  useEffect(() => {
    if (!adminToken) return;
    axios.get(`${API}/admin/delivery-men`, { headers: { 'X-Admin-Token': adminToken } })
      .then(r => setDeliveryMen((r.data || []).filter(m => m.active !== false)))
      .catch(() => setDeliveryMen([]));
  }, [adminToken]);

  // ------------------------------------------------------------------
  // Delivery-man selection + WhatsApp handoff helpers
  // ------------------------------------------------------------------
  const setOrderDm = (orderId, dmId) => {
    setDmSelection(prev => ({ ...prev, [orderId]: dmId }));
    // Persist to backend (best-effort, non-blocking).
    axios.patch(`${API}/admin/orders/${orderId}/delivery-assign`,
      { delivery_man_id: dmId || null },
      { headers: { 'X-Admin-Token': adminToken } }
    ).catch(() => { /* soft-fail — UI already updated */ });
  };

  const toggleInstantDelivery = async (order) => {
    setAssigningOrder(order.order_id);
    const nextType = order.delivery_type === 'instant' ? 'standard' : 'instant';
    try {
      await axios.patch(`${API}/admin/orders/${order.order_id}/delivery-assign`,
        { delivery_type: nextType },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      setOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, delivery_type: nextType } : o));
      if (selectedOrder?.order_id === order.order_id) {
        setSelectedOrder({ ...selectedOrder, delivery_type: nextType });
      }
    } catch (_) { alert('Failed to update delivery type'); }
    finally { setAssigningOrder(null); }
  };

  const buildAddress = (o) => [o.house_number, o.area, o.state, o.pincode]
    .filter(Boolean).join(', ');

  const buildMapsLink = (o) => {
    // Prefer stored coords if we ever add them; fall back to address search URL.
    if (o.delivery_lat && o.delivery_lng) {
      return `https://www.google.com/maps/search/?api=1&query=${o.delivery_lat},${o.delivery_lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildAddress(o))}`;
  };

  const buildWhatsAppMessage = (o) => {
    const items = (o.items || []).map(it => `• ${it.name || it.short_name || it.slug || 'Product'} × ${it.quantity || 1}`).join('\n');
    const lines = [
      `*Celesta Glow — Delivery Handoff*`,
      ``,
      `*Order:* ${o.order_id}`,
      items ? `*Items:*\n${items}` : `*Items:* Celesta Glow order`,
      ``,
      `*Customer:* ${o.name || '-'}`,
      `*Phone:* +91 ${o.phone || '-'}`,
      `*Address:* ${buildAddress(o) || '-'}`,
      ``,
      `*Amount:* ₹${o.amount || 0} (${o.payment_method || 'Prepaid'})`,
      o.delivery_type === 'instant' ? `*Type:* ⚡ INSTANT DELIVERY` : null,
      ``,
      `*Google Maps:* ${buildMapsLink(o)}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const sendToDeliveryMan = (o) => {
    const dmId = dmSelection[o.order_id] || o.assigned_delivery_man_id;
    const dm = deliveryMen.find(m => m.id === dmId);
    if (!dm) { alert('Select a delivery man first'); return; }
    const url = `https://wa.me/${dm.whatsapp_number}?text=${encodeURIComponent(buildWhatsAppMessage(o))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      params.set('limit', '500');
      const res = await axios.get(`${API}/admin/orders?${params.toString()}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick date presets
  const setDatePreset = (preset) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    if (preset === 'today') {
      setDateFrom(fmt(today));
      setDateTo(fmt(today));
    } else if (preset === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      setDateFrom(fmt(y)); setDateTo(fmt(y));
    } else if (preset === 'week') {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      setDateFrom(fmt(w)); setDateTo(fmt(today));
    } else if (preset === 'month') {
      const m = new Date(today); m.setDate(m.getDate() - 29);
      setDateFrom(fmt(m)); setDateTo(fmt(today));
    } else if (preset === 'clear') {
      setDateFrom(''); setDateTo('');
    }
  };

  const exportOrders = async (fmt = 'csv') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterPayment && filterPayment !== 'all') params.set('payment_method', filterPayment);
      params.set('fmt', fmt);
      const url = `${API}/admin/orders/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { 'X-Admin-Token': adminToken },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
      const dl = document.createElement('a');
      dl.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      dl.download = `celesta-orders-${dateFrom || 'all'}_to_${dateTo || stamp}.${fmt}`;
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (orderId) => {
    setSelectedIds((prev) => prev.includes(orderId) ? prev.filter(i => i !== orderId) : [...prev, orderId]);
  };
  const selectAll = () => setSelectedIds(filteredOrders.map(o => o.order_id));
  const clearSelection = () => setSelectedIds([]);
  const bulkUpdateStatus = async (newStatus) => {
    if (!selectedIds.length) return alert('Select orders first');
    if (!window.confirm(`Mark ${selectedIds.length} orders as "${newStatus}"?`)) return;
    setUpdatingStatus('bulk');
    let ok = 0; let fail = 0;
    for (const id of selectedIds) {
      try {
        await axios.put(`${API}/orders/${id}/status`, { status: newStatus }, { headers: { 'X-Admin-Token': adminToken } });
        ok++;
      } catch { fail++; }
    }
    setUpdatingStatus(null);
    clearSelection();
    fetchOrders();
    alert(`Updated ${ok} orders${fail ? `, failed ${fail}` : ''}`);
  };

  const createShipment = async (orderId) => {
    setUpdatingStatus(orderId);
    try {
      const res = await axios.post(
        `${API}/admin/shipping/create-shipment/${orderId}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      if (res.data.success) {
        const awb = res.data.awb;
        setOrders(orders.map(o => o.order_id === orderId ? { ...o, awb_number: awb, shipping_provider: 'delhivery' } : o));
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, awb_number: awb, shipping_provider: 'delhivery' });
        }
        alert(`Delhivery shipment created · AWB: ${awb}`);
      } else {
        alert(`Failed to create shipment: ${res.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to create shipment: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingStatus(orderId);
    try {
      const res = await axios.put(`${API}/orders/${orderId}/status`, 
        { status: newStatus },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      if (res.data.success) {
        // Update local state
        setOrders(orders.map(order => 
          order.order_id === orderId 
            ? { ...order, status: newStatus }
            : order
        ));
        
        // Update selected order if open
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
        
        // Show success message
        const emailMsg = res.data.email_sent ? ' (Email sent to customer)' : '';
        alert(`Order ${orderId} marked as ${newStatus}${emailMsg}`);
      }
    } catch (err) {
      alert('Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateOrderEmail = async (orderId, email) => {
    try {
      const res = await axios.put(
        `${API}/orders/${orderId}/email`,
        { email },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      if (res.data.success) {
        // Update local state
        setOrders(orders.map(order => 
          order.order_id === orderId 
            ? { ...order, email }
            : order
        ));
        
        // Update selected order
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, email });
        }
        
        setEditingEmail(false);
        setNewEmail('');
        alert('Email updated successfully!');
      }
    } catch (err) {
      alert('Failed to update email');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone?.includes(searchTerm);
    const matchesFilter = filterPayment === 'all' || order.payment_method === filterPayment;
    const matchesDelivery = filterDeliveryType === 'all'
      || (filterDeliveryType === 'instant' && order.delivery_type === 'instant')
      || (filterDeliveryType === 'standard' && order.delivery_type !== 'instant');
    return matchesSearch && matchesFilter && matchesDelivery;
  });

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  const codOrders = filteredOrders.filter(o => o.payment_method === 'COD').length;
  const prepaidOrders = filteredOrders.filter(o => o.payment_method !== 'COD').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="lg:hidden text-gray-600">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-500 hidden lg:block">
                View and manage customer orders
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            <p className="text-sm text-gray-500">Total Orders</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Revenue</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-blue-600">{prepaidOrders}</p>
            <p className="text-sm text-gray-500">Prepaid</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-yellow-600">{codOrders}</p>
            <p className="text-sm text-gray-500">COD</p>
          </div>
        </div>

        {/* Date range + Export toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" data-testid="orders-date-from" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" data-testid="orders-date-to" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setDatePreset('today')} className="text-xs font-semibold px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-md" data-testid="preset-today">Today</button>
              <button onClick={() => setDatePreset('yesterday')} className="text-xs font-semibold px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-gray-700 rounded-md">Yesterday</button>
              <button onClick={() => setDatePreset('week')} className="text-xs font-semibold px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-gray-700 rounded-md">Last 7d</button>
              <button onClick={() => setDatePreset('month')} className="text-xs font-semibold px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-gray-700 rounded-md">Last 30d</button>
              <button onClick={() => setDatePreset('clear')} className="text-xs font-semibold px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-gray-500 rounded-md">All time</button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-md inline-flex items-center gap-1 ${
                    selectedCalendarDate ? 'bg-emerald-600 text-white' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                  data-testid="open-calendar-btn"
                >
                  <CalendarDays size={13} />
                  {selectedCalendarDate
                    ? selectedCalendarDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : 'Calendar'}
                </button>
                {calendarOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setCalendarOpen(false)}
                    />
                    <div
                      className="absolute left-0 mt-2 z-40 bg-white border border-gray-200 rounded-xl shadow-2xl p-2"
                      data-testid="orders-calendar-popover"
                    >
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 pt-1 pb-2">
                        Tap a date to see orders for that day
                      </p>
                      <CalendarUI
                        mode="single"
                        selected={selectedCalendarDate || undefined}
                        onSelect={onCalendarPick}
                        modifiers={{ hasOrders: orderDateModifier }}
                        modifiersClassNames={{
                          hasOrders: 'relative font-semibold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-emerald-500 after:rounded-full',
                        }}
                      />
                      <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 text-[11px]">
                        <span className="text-gray-500">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                          Day with orders
                        </span>
                        <button
                          onClick={() => onCalendarPick(null)}
                          className="text-emerald-700 font-semibold hover:underline"
                          data-testid="calendar-clear-btn"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" data-testid="status-filter">
                <option value="all">All status</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
              <select value={filterDeliveryType} onChange={(e) => setFilterDeliveryType(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" data-testid="delivery-type-filter">
                <option value="all">All delivery</option>
                <option value="instant">⚡ Instant only</option>
                <option value="standard">Standard only</option>
              </select>
              <button
                onClick={() => exportOrders('csv')}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
                data-testid="export-csv-btn"
              >
                <Download size={14} /> {exporting ? 'Exporting…' : 'CSV'}
              </button>
              <button
                onClick={() => exportOrders('xlsx')}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
                data-testid="export-xlsx-btn"
              >
                <Download size={14} /> XLSX
              </button>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 flex-wrap" data-testid="bulk-actions-bar">
              <span className="text-xs font-bold text-gray-700">{selectedIds.length} selected</span>
              <button onClick={() => bulkUpdateStatus('processing')} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md">Mark Processing</button>
              <button onClick={() => bulkUpdateStatus('shipped')} className="text-xs font-semibold px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md">Mark Shipped</button>
              <button onClick={() => bulkUpdateStatus('delivered')} className="text-xs font-semibold px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md">Mark Delivered</button>
              <button onClick={() => bulkUpdateStatus('cancelled')} className="text-xs font-semibold px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const res = await axios.post(
                      `${API}/orders/labels/bulk?token=${encodeURIComponent(adminToken)}`,
                      { order_ids: selectedIds },
                      { responseType: 'blob' }
                    );
                    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    window.open(url, '_blank');
                  } catch (e) {
                    alert('Bulk label generation failed: ' + (e?.response?.data?.detail || e.message));
                  }
                }}
                className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md"
                data-testid="bulk-print-labels-btn"
              >
                📮 Print Labels (A4 4-up)
              </button>
              <button onClick={clearSelection} className="text-xs font-semibold px-2.5 py-1.5 text-gray-500 hover:underline">Clear</button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by order ID, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              data-testid="search-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'all' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterPayment('Prepaid')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'Prepaid' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Prepaid
            </button>
            <button
              onClick={() => setFilterPayment('COD')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'COD' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              COD
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">Orders will appear here once customers place them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select-all toolbar */}
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 flex items-center gap-3 text-xs">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                onChange={() => selectedIds.length === filteredOrders.length ? clearSelection() : selectAll()}
                className="w-4 h-4 rounded border-gray-300"
                data-testid="select-all"
              />
              <span className="text-gray-600">Select all on page ({filteredOrders.length})</span>
            </div>
            {filteredOrders.map((order) => (
              <div 
                key={order.order_id} 
                className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
                data-testid={`order-item-${order.order_id}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.order_id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(order.order_id)}
                    className="w-4 h-4 rounded border-gray-300 mt-1.5"
                    data-testid={`select-${order.order_id}`}
                  />
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900">{order.order_id}</span>
                      <OrderStatusBadge order={order} />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.payment_method === 'COD' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {order.payment_method}
                      </span>
                      {order.delivery_type === 'instant' ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
                          data-testid={`instant-badge-${order.order_id}`}
                        >
                          <Zap size={11} /> INSTANT
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600"
                          data-testid={`standard-badge-${order.order_id}`}
                        >
                          <Truck size={11} /> Standard
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">{order.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{order.amount}</p>
                    <p className="text-sm text-gray-400" data-testid={`order-timestamp-${order.order_id}`}>
                      {order.created_at ? new Date(order.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-4 text-sm text-gray-500 flex-wrap">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 font-mono text-gray-700 font-medium">
                      <Phone size={14} />
                      +91 {order.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {order.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:+91${order.phone}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors"
                      data-testid={`list-call-btn-${order.order_id}`}
                    >
                      <Phone size={12} />
                      Call
                    </a>
                    <a
                      href={
                        order.delivery_lat && order.delivery_lng
                          ? `https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.house_number, order.area, order.city, order.state, order.pincode].filter(Boolean).join(', '))}`
                      }
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-xs transition-colors"
                      data-testid={`list-map-btn-${order.order_id}`}
                    >
                      <MapPin size={12} /> Map
                    </a>
                    {!order.awb_number && (
                      <button
                        onClick={(e) => { e.stopPropagation(); createShipment(order.order_id); }}
                        disabled={updatingStatus === order.order_id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                        data-testid={`list-ship-btn-${order.order_id}`}
                      >
                        <Truck size={12} />
                        {updatingStatus === order.order_id ? '...' : 'Send'}
                      </button>
                    )}
                    {/* Per-row Cancel — quick way to flip status to `cancelled` without opening the drawer. */}
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Cancel order ${order.order_id}? Customer email will be triggered.`)) return;
                          updateOrderStatus(order.order_id, 'cancelled');
                        }}
                        disabled={updatingStatus === order.order_id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                        data-testid={`list-cancel-btn-${order.order_id}`}
                      >
                        Cancel
                      </button>
                    )}
                    {/* Per-row Delete — permanent hard-delete for test/spam rows. Confirms twice. */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm(`Permanently DELETE order ${order.order_id}? This cannot be undone.`)) return;
                        try {
                          await axios.delete(`${API}/api/admin/orders/${order.order_id}`, { headers: { 'X-Admin-Token': adminToken } });
                          setOrders((prev) => prev.filter((o) => o.order_id !== order.order_id));
                        } catch (err) {
                          alert('Delete failed: ' + (err.response?.data?.detail || err.message));
                        }
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors"
                      title="Delete order"
                      data-testid={`list-delete-btn-${order.order_id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Delivery-man handoff row — pick rider, send WhatsApp with order + maps link */}
                <div
                  className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`delivery-row-${order.order_id}`}
                >
                  <Bike size={14} className="text-emerald-600" />
                  <select
                    value={dmSelection[order.order_id] || order.assigned_delivery_man_id || ''}
                    onChange={(e) => setOrderDm(order.order_id, e.target.value)}
                    className="text-xs font-semibold px-2 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 max-w-[190px]"
                    data-testid={`dm-select-${order.order_id}`}
                  >
                    <option value="">Select delivery man…</option>
                    {(() => {
                      // If the order is routed to a specific warehouse, only show riders
                      // assigned to that warehouse (plus "Any warehouse" riders). Otherwise
                      // show everyone active — falls back to the full list.
                      const wh = order.assigned_warehouse_id;
                      const filtered = wh
                        ? deliveryMen.filter(m => !m.assigned_warehouse_id || m.assigned_warehouse_id === wh)
                        : deliveryMen;
                      return filtered.map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.assigned_warehouse_id ? ' ★' : ''}</option>
                      ));
                    })()}
                  </select>
                  <button
                    onClick={() => sendToDeliveryMan(order)}
                    disabled={!(dmSelection[order.order_id] || order.assigned_delivery_man_id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    data-testid={`send-whatsapp-${order.order_id}`}
                  >
                    <MessageCircle size={12} /> Send on WhatsApp
                  </button>
                  <button
                    onClick={() => toggleInstantDelivery(order)}
                    disabled={assigningOrder === order.order_id}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                      order.delivery_type === 'instant'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                    data-testid={`instant-toggle-${order.order_id}`}
                  >
                    <Zap size={12} /> {order.delivery_type === 'instant' ? 'Instant ✓' : 'Mark Instant'}
                  </button>
                  {deliveryMen.length === 0 && (
                    <Link to="/admin/delivery-men" className="text-[11px] text-emerald-700 hover:underline font-semibold">
                      + Add delivery men
                    </Link>
                  )}
                </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Order Details</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Prominent top-of-page status banner — "In Transit / Delivered" etc. */}
            <div className="mb-5">
              <OrderStatusBanner order={selectedOrder} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Order ID</span>
                <span className="font-bold">{selectedOrder.order_id}</span>
              </div>

              {/* Items + quantity — what the customer actually ordered */}
              {(Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0) || selectedOrder.combo_id ? (
                <div className="p-4 bg-white border border-gray-200 rounded-xl" data-testid="admin-order-items">
                  <p className="text-gray-600 text-sm font-medium mb-3">Items Ordered</p>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm" data-testid={`admin-order-item-${idx}`}>
                        <span className="text-gray-900 flex-1 pr-2">
                          {it.name || it.short_name || it.slug || 'Product'}
                          <span className="text-gray-400"> × {it.quantity || 1}</span>
                        </span>
                        {typeof it.price !== 'undefined' && (
                          <span className="text-gray-700 font-medium">₹{(it.price || 0) * (it.quantity || 1)}</span>
                        )}
                      </div>
                    ))}
                    {selectedOrder.combo_id && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-900">Combo: {selectedOrder.combo_id} <span className="text-gray-400">× 1</span></span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total Quantity</span>
                    <span className="font-bold text-gray-900">
                      {(selectedOrder.items || []).reduce((s, i) => s + (i.quantity || 1), 0) + (selectedOrder.combo_id ? 1 : 0)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Amount</span>
                <span className="font-bold text-green-600">₹{selectedOrder.amount}</span>
              </div>
              
              {/* Show full COD amount due (no advance/balance split — site is COD-only) */}
              {(selectedOrder.payment_method === 'COD' || selectedOrder.payment_method === 'COD (Advance Paid)') && (
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <span className="text-yellow-700">Pay at Delivery</span>
                  <span className="font-bold text-yellow-700">₹{selectedOrder.amount}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Payment</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedOrder.payment_method === 'COD' 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedOrder.payment_method}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedOrder.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  selectedOrder.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                  selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1) || 'Confirmed'}
                </span>
              </div>
              
              {/* Delhivery Tracking Info */}
              {selectedOrder.awb_number ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Delhivery Tracking</span>
                    <span className="text-blue-600 font-mono text-sm">{selectedOrder.awb_number}</span>
                  </div>
                  <a 
                    href={`https://www.delhivery.com/track/package/${selectedOrder.awb_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm underline flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Track on Delhivery
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-amber-800 font-semibold text-sm">No shipment yet</p>
                      <p className="text-amber-700/80 text-xs mt-0.5">Push this order to Delhivery to generate an AWB.</p>
                    </div>
                    <button
                      onClick={() => createShipment(selectedOrder.order_id)}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                      data-testid="create-shipment-btn"
                    >
                      <Truck size={16} />
                      {updatingStatus === selectedOrder.order_id ? 'Creating…' : 'Send to Delhivery'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Status Update Buttons */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl">
                <p className="text-gray-700 font-medium mb-3">Update Status:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openInvoice(selectedOrder.order_id)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-700 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors"
                    data-testid="admin-print-invoice-btn"
                  >
                    🧾 Print Invoice
                  </button>
                  <button
                    onClick={() => window.open(`${API}/orders/${selectedOrder.order_id}/label.pdf?token=${encodeURIComponent(adminToken)}`, '_blank')}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition-colors"
                    data-testid="admin-print-postoffice-label-btn"
                    title="A6 India Post shipping label (PDF)"
                  >
                    📮 Print Post Office Label
                  </button>
                  {selectedOrder.status !== 'shipped' && selectedOrder.status !== 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.order_id, 'shipped')}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                      data-testid="mark-shipped-btn"
                    >
                      <Truck size={18} />
                      {updatingStatus === selectedOrder.order_id ? 'Updating...' : 'Mark Shipped'}
                    </button>
                  )}
                  
                  {selectedOrder.status !== 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered')}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                      data-testid="mark-delivered-btn"
                    >
                      <CheckCircle size={18} />
                      {updatingStatus === selectedOrder.order_id ? 'Updating...' : 'Mark Delivered'}
                    </button>
                  )}
                  
                  {selectedOrder.status === 'delivered' && (
                    <span className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle size={18} />
                      Order Completed
                    </span>
                  )}
                </div>
                {selectedOrder.email && (
                  <p className="text-xs text-gray-500 mt-2">
                    📧 Customer will receive email notification at: {selectedOrder.email}
                  </p>
                )}
                {!selectedOrder.email && (
                  <p className="text-xs text-orange-500 mt-2">
                    ⚠️ No email provided - SMS/WhatsApp notification only
                  </p>
                )}
              </div>

              {/* Internal Notes (admin-only, audit-tracked) */}
              <div className="p-4 bg-amber-50/60 ring-1 ring-amber-100 rounded-xl" data-testid="admin-notes-block">
                <p className="text-gray-800 font-semibold text-sm mb-2 flex items-center gap-2">📝 Internal Notes <span className="text-[10px] font-normal text-stone-500">(visible to staff only)</span></p>
                {notesLoading ? (
                  <p className="text-xs text-stone-400">Loading…</p>
                ) : orderNotes.length === 0 ? (
                  <p className="text-xs text-stone-400 italic mb-3">No notes yet.</p>
                ) : (
                  <ul className="space-y-2 mb-3" data-testid="admin-notes-list">
                    {orderNotes.map((n, idx) => (
                      <li key={idx} className="bg-white rounded-lg p-2.5 text-xs text-stone-700 ring-1 ring-stone-100" data-testid={`admin-note-${idx}`}>
                        <p>{n.note}</p>
                        <p className="text-[10px] text-stone-400 mt-1">{n.author || 'admin'} · {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text" value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (addOrderNote(), e.preventDefault())}
                    placeholder="Add an internal note (RTO reason, WhatsApp follow-up, etc.)"
                    className="flex-1 px-3 py-2 text-xs rounded-lg ring-1 ring-stone-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    data-testid="admin-note-input"
                  />
                  <button onClick={addOrderNote} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white text-xs font-bold" data-testid="admin-note-add-btn">
                    Add
                  </button>
                </div>
              </div>

              {/* Audit Log (admin events history) */}
              <details className="p-4 bg-stone-50 rounded-xl" data-testid="admin-audit-block">
                <summary className="text-gray-800 font-semibold text-sm cursor-pointer flex items-center gap-2 select-none">
                  📜 Audit Log <span className="text-[10px] font-normal text-stone-500">({orderAudit.length} event{orderAudit.length !== 1 ? 's' : ''})</span>
                </summary>
                {orderAudit.length === 0 ? (
                  <p className="text-xs text-stone-400 italic mt-2">No events recorded.</p>
                ) : (
                  <ol className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-2" data-testid="admin-audit-list">
                    {orderAudit.map((ev, idx) => (
                      <li key={idx} className="text-[11px] text-stone-600 flex items-start gap-2 border-b border-stone-100 pb-1.5 last:border-b-0">
                        <span className="font-bold text-stone-500 whitespace-nowrap">{ev.created_at ? new Date(ev.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        <span>
                          <span className="font-bold text-stone-700">{ev.event}</span>
                          {ev.old_status && <span> · {ev.old_status} → {ev.new_status}</span>}
                          {ev.note && <span> · &quot;{ev.note.slice(0, 60)}{ev.note.length > 60 ? '…' : ''}&quot;</span>}
                          {ev.author && <span className="text-stone-400"> by {ev.author}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </details>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-gray-600 mb-2">Customer</p>
                <p className="font-semibold">{selectedOrder.name}</p>

                {/* Phone with one-tap Call (opens phone dialer) + WhatsApp */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-gray-800 text-base font-semibold tracking-wide" data-testid="customer-phone-text">+91 {selectedOrder.phone}</span>
                  <a
                    href={`tel:+91${selectedOrder.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors"
                    data-testid="customer-call-btn"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/91${selectedOrder.phone}?text=${encodeURIComponent('Hi ' + (selectedOrder.name?.split(' ')[0] || '') + ', this is Celesta Glow regarding your order ' + selectedOrder.order_id + '.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs transition-colors"
                    data-testid="customer-whatsapp-btn"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                </div>
                
                {/* Email with edit option */}
                <div className="mt-2">
                  {editingEmail ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter email"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => updateOrderEmail(selectedOrder.order_id, newEmail)}
                        className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => { setEditingEmail(false); setNewEmail(''); }}
                        className="p-1.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {selectedOrder.email ? (
                        <p className="text-gray-600">{selectedOrder.email}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">No email provided</p>
                      )}
                      <button
                        onClick={() => { setEditingEmail(true); setNewEmail(selectedOrder.email || ''); }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Edit email"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-gray-600 mb-2">Delivery Address</p>
                <p>{selectedOrder.house_number}, {selectedOrder.area}</p>
                <p>{selectedOrder.state} - {selectedOrder.pincode}</p>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Delivery Timeline</span>
                <span>{selectedOrder.delivery_timeline || 'N/A'}</span>
              </div>
            </div>
            
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around py-2">
          <Link to="/admin/dashboard" className="flex flex-col items-center p-2 text-gray-500">
            <Package size={20} />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link to="/admin/blogs" className="flex flex-col items-center p-2 text-gray-500">
            <Package size={20} />
            <span className="text-xs mt-1">Blogs</span>
          </Link>
          <Link to="/admin/orders" className="flex flex-col items-center p-2 text-green-600">
            <Package size={20} />
            <span className="text-xs mt-1">Orders</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default AdminOrders;
