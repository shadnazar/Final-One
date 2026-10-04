import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, History, X, Gift, RefreshCw } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const H = () => ({ 'X-Admin-Token': getAdminToken() || '' });

export default function AdminGiftCards() {
  const [cards, setCards] = useState(null);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    setCards(null);
    const { data } = await axios.get(`${API}/admin/gift-cards?page=${page}&limit=50`, { headers: H() });
    setCards(data);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (form) => {
    try {
      await axios.post(`${API}/admin/gift-cards`, form, { headers: H() });
      setShowCreate(false);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
  };

  const onDelete = async (code) => {
    if (!window.confirm(`Delete gift card ${code}?`)) return;
    await axios.delete(`${API}/admin/gift-cards/${code}`, { headers: H() });
    load();
  };

  const onUpdate = async (form) => {
    try {
      await axios.put(`${API}/admin/gift-cards/${editing.code}`, form, { headers: H() });
      setEditing(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
  };

  const loadHistory = async (code) => {
    setHistoryFor(code); setHistory([]);
    const { data } = await axios.get(`${API}/admin/gift-cards/${code}/history`, { headers: H() });
    setHistory(data.redemptions || []);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Gift size={22} className="text-rose-600" /> Gift Cards</h1>
          <p className="text-sm text-gray-500 mt-1">Create reusable gift cards. Balance is redeemed across multiple orders until ₹0.</p>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="gc-new-btn" className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2">
          <Plus size={16} /> New Gift Card
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Label</th>
              <th className="text-right p-3">Issued</th>
              <th className="text-right p-3">Balance</th>
              <th className="text-center p-3">Used</th>
              <th className="text-center p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!cards && <tr><td colSpan="7" className="p-8 text-center text-gray-400">Loading...</td></tr>}
            {cards && cards.items?.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-gray-400">No gift cards yet</td></tr>}
            {cards?.items?.map(g => (
              <tr key={g.code} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-mono font-bold">{g.code}</td>
                <td className="p-3 text-gray-600">{g.label || '—'}</td>
                <td className="p-3 text-right">₹{g.initial_balance}</td>
                <td className="p-3 text-right font-bold text-emerald-700">₹{g.remaining_balance}</td>
                <td className="p-3 text-center">{g.redemption_count}×</td>
                <td className="p-3 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{g.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => loadHistory(g.code)} data-testid={`gc-history-${g.code}`} className="text-gray-500 hover:text-gray-900 mr-2" title="History"><History size={15} /></button>
                  <button onClick={() => setEditing(g)} data-testid={`gc-edit-${g.code}`} className="text-blue-600 hover:text-blue-800 mr-2"><Edit2 size={15} /></button>
                  <button onClick={() => onDelete(g.code)} data-testid={`gc-del-${g.code}`} className="text-red-600 hover:text-red-800"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CardForm onClose={() => setShowCreate(false)} onSubmit={onCreate} />}
      {editing && <CardForm card={editing} onClose={() => setEditing(null)} onSubmit={onUpdate} />}
      {historyFor && (
        <Modal onClose={() => setHistoryFor(null)} title={`History — ${historyFor}`}>
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm">No redemptions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr><th className="text-left p-2">Order</th><th className="text-right p-2">Used</th><th className="text-right p-2">After</th><th className="text-left p-2">When</th></tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2 font-mono text-xs">{h.order_id}</td>
                    <td className="p-2 text-right font-bold text-rose-700">-₹{h.amount}</td>
                    <td className="p-2 text-right">₹{h.balance_after}</td>
                    <td className="p-2 text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

function CardForm({ card, onClose, onSubmit }) {
  const isEdit = !!card;
  const [form, setForm] = useState({
    code: card?.code || '',
    initial_balance: card?.initial_balance || 500,
    label: card?.label || '',
    expiry_date: card?.expiry_date || '',
    is_active: card?.is_active ?? true,
    remaining_balance: card?.remaining_balance,
  });
  return (
    <Modal onClose={onClose} title={isEdit ? `Edit ${card.code}` : 'New Gift Card'}>
      <div className="space-y-3">
        {!isEdit && (
          <Field label="Code (leave blank for auto-generate)">
            <input data-testid="gc-form-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-lg p-2.5 font-mono" placeholder="DIWALI500" />
          </Field>
        )}
        <Field label={`${isEdit ? 'Remaining Balance' : 'Initial Balance'} (₹)`}>
          <input
            type="number"
            value={isEdit ? form.remaining_balance : form.initial_balance}
            onChange={e => setForm(isEdit ? { ...form, remaining_balance: Number(e.target.value) } : { ...form, initial_balance: Number(e.target.value) })}
            data-testid="gc-form-balance"
            className="w-full border border-gray-300 rounded-lg p-2.5"
          />
        </Field>
        <Field label="Label (internal note)">
          <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} data-testid="gc-form-label" className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="e.g. Diwali campaign 2026" />
        </Field>
        <Field label="Expiry (optional)">
          <input type="date" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })} data-testid="gc-form-expiry" className="w-full border border-gray-300 rounded-lg p-2.5" />
        </Field>
        {isEdit && (
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        )}
        <button onClick={() => onSubmit(form)} data-testid="gc-form-save" className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-lg w-full mt-2">
          {isEdit ? 'Save Changes' : 'Create Gift Card'}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>{children}</div>;
}

function Modal({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} data-testid="modal-close" className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
