import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bike, Plus, Trash2, ChevronLeft, MessageCircle, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDeliveryMen() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', whatsapp_number: '', assigned_warehouse_id: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [rMen, rWh] = await Promise.all([
        axios.get(`${API}/admin/delivery-men`, { headers: { 'X-Admin-Token': adminToken } }),
        axios.get(`${API}/admin/warehouses`, { headers: { 'X-Admin-Token': adminToken } }).catch(() => ({ data: [] })),
      ]);
      setRows(rMen.data || []);
      setWarehouses(rWh.data || []);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (adminToken) load(); }, [adminToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!form.name.trim() || !form.whatsapp_number.trim()) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/delivery-men`, {
        ...form,
        assigned_warehouse_id: form.assigned_warehouse_id || null,
      }, { headers: { 'X-Admin-Token': adminToken } });
      setForm({ name: '', whatsapp_number: '', assigned_warehouse_id: '' });
      await load();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to add'); }
    finally { setBusy(false); }
  };

  const setWarehouse = async (id, wid) => {
    try {
      await axios.patch(`${API}/admin/delivery-men/${id}`, { assigned_warehouse_id: wid || '' }, { headers: { 'X-Admin-Token': adminToken } });
      await load();
    } catch (_) { alert('Failed to update'); }
  };

  const toggleActive = async (m) => {
    try {
      await axios.patch(`${API}/admin/delivery-men/${m.id}`, { active: !m.active }, { headers: { 'X-Admin-Token': adminToken } });
      await load();
    } catch (e) { alert('Failed to update'); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.name}?`)) return;
    try {
      await axios.delete(`${API}/admin/delivery-men/${m.id}`, { headers: { 'X-Admin-Token': adminToken } });
      await load();
    } catch (e) { alert('Failed to delete'); }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="lg:hidden text-gray-600"><ChevronLeft size={22} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bike size={22} className="text-emerald-600" /> Delivery Men
            </h1>
            <p className="text-sm text-gray-500 hidden lg:block">
              Add local riders and send order handoff on WhatsApp from the Orders tab.
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Add form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5" data-testid="delivery-man-add-card">
          <h2 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wider">Add delivery man</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Rider name (e.g. Suresh)"
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              data-testid="dm-name-input"
            />
            <input
              value={form.whatsapp_number}
              onChange={(e) => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
              placeholder="WhatsApp number"
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              data-testid="dm-number-input"
            />
            <select
              value={form.assigned_warehouse_id}
              onChange={(e) => setForm(f => ({ ...f, assigned_warehouse_id: e.target.value }))}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              data-testid="dm-warehouse-input"
            >
              <option value="">Any warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button
              onClick={add}
              disabled={busy || !form.name.trim() || !form.whatsapp_number.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm disabled:bg-gray-300"
              data-testid="dm-add-btn"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Numbers get +91 auto-prepended for 10-digit Indian mobiles. Riders assigned to a warehouse only receive orders routed there.
          </p>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Roster ({rows.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 size={22} className="animate-spin text-emerald-600" /></div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Bike size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm">No delivery men yet. Add your first rider above.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="delivery-men-list">
              {rows.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-4" data-testid={`dm-row-${m.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    <Bike size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs font-mono text-gray-500">+{m.whatsapp_number}</p>
                  </div>
                  <select
                    value={m.assigned_warehouse_id || ''}
                    onChange={(e) => setWarehouse(m.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white"
                    data-testid={`dm-warehouse-${m.id}`}
                    title="Which warehouse this rider covers"
                  >
                    <option value="">Any warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <a
                    href={`https://wa.me/${m.whatsapp_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold"
                    data-testid={`dm-test-wa-${m.id}`}
                  >
                    <MessageCircle size={12} /> Test
                  </a>
                  <button
                    onClick={() => toggleActive(m)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${m.active ? 'text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
                    data-testid={`dm-toggle-${m.id}`}
                    title={m.active ? 'Active — click to disable' : 'Disabled — click to enable'}
                  >
                    {m.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                    data-testid={`dm-delete-${m.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
