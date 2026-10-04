import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Handshake, TrendingUp, HeartPulse, Phone, Mail, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * LeadsPanel — renders the three lead-generation streams (Partner With Us,
 * Invest Now, Free Skin Advice) as clearly-headed sections. Extracted from
 * AdminExtras so it can be embedded inside AdminCustomers (where marketing
 * & retention teams naturally look for prospects).
 */
const STREAMS = [
  { key: 'partner',      label: 'Partner With Us',   sub: 'Retailers, salons & clinics interested in stocking Celesta Glow.', Icon: Handshake, accent: 'from-emerald-500 to-teal-500' },
  { key: 'invest',       label: 'Invest Now',        sub: 'Angel / seed cheque enquiries — hand these to founders directly.', Icon: TrendingUp, accent: 'from-amber-500 to-orange-500' },
  { key: 'skin_concern', label: 'Free Skin Advice',  sub: 'Consumer skin-concern submissions — high-intent, needs a call within 24h.', Icon: HeartPulse, accent: 'from-rose-500 to-pink-500' },
];

export default function LeadsPanel({ auth }) {
  const [byType, setByType] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // stream key currently expanded

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/leads`, auth);
      const grouped = {};
      (r.data?.leads || []).forEach((l) => {
        (grouped[l.type] = grouped[l.type] || []).push(l);
      });
      setByType(grouped);
      setCounts(r.data?.counts || {});
    } catch (_) { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const setStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/api/admin/leads/${id}`, { status }, auth);
      await load();
    } catch (_) { /* noop */ }
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-3" data-testid="leads-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Lead submissions</h2>
        <button onClick={load} className="text-xs text-emerald-700 font-semibold hover:underline">Refresh</button>
      </div>

      {STREAMS.map(({ key, label, sub, Icon, accent }) => {
        const leads = byType[key] || [];
        const count = counts[key] ?? leads.length;
        const isOpen = expanded === key;
        return (
          <section
            key={key}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            data-testid={`leads-stream-${key}`}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : key)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  {label}
                  <span className="text-[10px] font-black bg-gray-900 text-white px-1.5 py-0.5 rounded-full">{count}</span>
                </h3>
                <p className="text-xs text-gray-500 leading-snug">{sub}</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 shrink-0">{isOpen ? 'Hide' : 'View'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                {leads.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-6">No submissions yet in this stream.</p>
                ) : leads.map(l => (
                  <div key={l.id} className="rounded-xl border border-gray-100 p-3 flex items-start gap-3" data-testid={`lead-row-${l.id}`}>
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Icon size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{l.name}</p>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">{l.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        <a href={`tel:+91${l.phone}`} className="inline-flex items-center gap-1 hover:text-emerald-700"><Phone size={10} />+91 {l.phone}</a>
                        {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-emerald-700"><Mail size={10} />{l.email}</a>}
                        {l.investment_amount && <span>Cheque size: ₹{l.investment_amount}</span>}
                        {l.concern && <span>Concern: {l.concern}</span>}
                        {l.business_name && <span>Business: {l.business_name}</span>}
                      </div>
                      {l.message && <p className="text-xs text-gray-600 mt-1 italic line-clamp-2">"{l.message}"</p>}
                    </div>
                    <select
                      value={l.status}
                      onChange={e => setStatus(l.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 shrink-0"
                      data-testid={`lead-status-${l.id}`}
                    >
                      {['new', 'contacted', 'qualified', 'converted', 'closed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
