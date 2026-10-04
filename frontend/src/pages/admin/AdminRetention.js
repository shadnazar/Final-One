/**
 * AdminRetention — 3-tab follow-up cockpit:
 *   • 15-Day  (call & qualify customer 2 weeks after delivery)
 *   • 30-Day  (call to drive the reorder; cycles back after another 30 days)
 *   • Reorder pipeline (28-90 day window, hides anyone marked in last 30 days)
 *
 * Note status options: interested · not_interested · reorder · callback. After
 * 30 days the customer reappears here automatically so the retention agent
 * keeps a steady follow-up cadence without crons.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Phone, RefreshCw, MessageCircle, ShoppingCart, Calendar, ExternalLink, ArrowLeft } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TAB_DAYS = { '15': 15, '30': 30, 'reorder': null };

function StatusPill({ status }) {
  const map = {
    interested: 'bg-green-100 text-green-700',
    not_interested: 'bg-red-100 text-red-700',
    reorder: 'bg-blue-100 text-blue-700',
    callback: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace('_', ' ') || 'pending'}
    </span>
  );
}

export default function AdminRetention() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('15');           // '15' | '30' | 'reorder'
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(null);
  const [noteStatus, setNoteStatus] = useState('interested');
  const [noteText, setNoteText] = useState('');
  const adminToken = getAdminToken();
  const headers = { 'X-Admin-Token': adminToken };

  const fetchCustomers = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const url = tab === 'reorder'
        ? `${API}/admin/retention/reorder`
        : `${API}/admin/retention/customers?days=${TAB_DAYS[tab]}`;
      const res = await axios.get(url, { headers });
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken) { navigate('/admin'); return; }
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const saveNote = async () => {
    if (!noteModal) return;
    try {
      await axios.post(`${API}/admin/retention/note`, {
        order_id: noteModal.order_id,
        status: noteStatus,
        notes: noteText,
      }, { headers });
      setNoteModal(null);
      setNoteText('');
      setNoteStatus('interested');
      fetchCustomers();
    } catch {
      alert('Failed to save note');
    }
  };

  return (
    <div className="space-y-6 lg:ml-64 px-4 py-8 max-w-6xl mx-auto" data-testid="admin-retention">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer retention</h1>
          <p className="text-gray-500 text-sm">Call your customers at 15 / 30 days, then push the reorder.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: '15', label: '15-Day call' },
            { id: '30', label: '30-Day call' },
            { id: 'reorder', label: 'Reorder pipeline' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === t.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              data-testid={`retention-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
          <button onClick={fetchCustomers} className="p-2 hover:bg-white border border-gray-200 rounded-xl"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {tab === 'reorder' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800 flex items-center gap-2">
          <ShoppingCart size={16} /> Customers between 28-90 days post-purchase. Marked rows recycle back into this list after 30 days.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Products & Qty</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Last status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><RefreshCw className="inline-block animate-spin" /> Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No customers in this bucket right now.</td></tr>
            ) : customers.map((c, i) => {
              const phone = (c.phone || '').replace(/\D/g, '');
              const items = Array.isArray(c.items) ? c.items : [];
              const totalQty = items.reduce((s, it) => s + (it.quantity || 1), 0) + (c.combo_id ? 1 : 0);
              return (
                <tr key={c.order_id || i} className="hover:bg-gray-50 align-top" data-testid={`retention-row-${c.order_id || i}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{c.order_id}</p>
                    <p className="text-xs text-gray-500 font-semibold">₹{c.amount}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-[260px]" data-testid={`retention-items-${c.order_id}`}>
                    {items.length === 0 && !c.combo_id ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {items.map((it, j) => (
                          <div key={j} className="flex items-baseline justify-between gap-2">
                            <span className="truncate" title={it.name || it.slug}>
                              {it.name || it.short_name || it.slug || 'Product'}
                              <span className="text-gray-400"> × {it.quantity || 1}</span>
                            </span>
                            {typeof it.price !== 'undefined' && (
                              <span className="text-gray-500 whitespace-nowrap">₹{(it.price || 0) * (it.quantity || 1)}</span>
                            )}
                          </div>
                        ))}
                        {c.combo_id && (
                          <div className="text-gray-700">Combo: {c.combo_id} <span className="text-gray-400">× 1</span></div>
                        )}
                        {totalQty > 0 && (
                          <div className="text-[11px] text-gray-500 pt-0.5">Total qty: <span className="font-semibold text-gray-700">{totalQty}</span></div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <Calendar size={12} className="inline-block mr-1" />
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={c.retention_note?.status} />
                    {c.retention_note?.notes && (
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[180px]" title={c.retention_note.notes}>{c.retention_note.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`tel:${phone}`} className="p-1.5 hover:bg-green-50 rounded-lg" title="Dial number" data-testid={`retention-call-${c.order_id}`}>
                        <Phone size={16} className="text-green-600" />
                      </a>
                      <a href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-green-50 rounded-lg" title="WhatsApp">
                        <MessageCircle size={16} className="text-green-600" />
                      </a>
                      {tab === 'reorder' && (
                        <a href="/shop" target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-blue-50 rounded-lg" title="Shop link to share">
                          <ExternalLink size={16} className="text-blue-600" />
                        </a>
                      )}
                      <button
                        onClick={() => { setNoteModal(c); setNoteStatus(c.retention_note?.status || (tab === 'reorder' ? 'reorder' : 'interested')); setNoteText(c.retention_note?.notes || ''); }}
                        className="px-2.5 py-1.5 hover:bg-blue-50 rounded-lg text-blue-600 text-xs font-medium"
                        data-testid={`retention-note-${c.order_id}`}
                      >Update</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {noteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg text-gray-900 mb-1">Follow-up note</h3>
            <p className="text-sm text-gray-500 mb-4">{noteModal.name} · {noteModal.phone}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { v: 'interested', l: 'Interested' },
                { v: 'reorder', l: 'Reordered' },
                { v: 'callback', l: 'Callback later' },
                { v: 'not_interested', l: 'Not interested' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setNoteStatus(opt.v)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${noteStatus === opt.v ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                  data-testid={`status-opt-${opt.v}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add notes…" className="w-full px-3 py-2 border rounded-xl text-sm mb-4" rows={3} data-testid="retention-note-text" />
            <div className="flex gap-2">
              <button onClick={saveNote} className="flex-1 bg-green-600 text-white font-bold py-2 rounded-xl" data-testid="retention-note-save">Save</button>
              <button onClick={() => setNoteModal(null)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
