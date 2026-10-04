import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Package, Loader2 } from 'lucide-react';
import { getAdminToken } from '../utils/adminAuth';

/**
 * AdminHomeToggle — floating master-switch that only shows when the admin
 * is authenticated. Toggles `site_settings.other_brands_in_stock` — when
 * OFF, /cart/validate rejects any cart with a non-Celesta-Glow-brand SKU
 * and the storefront bounces the customer back to the homepage. When ON,
 * all products behave normally.
 *
 * Sits bottom-left on the homepage, behind the WhatsApp bubble.
 */
const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminHomeToggle() {
  const [token, setToken] = useState('');
  const [inStock, setInStock] = useState(null); // null=loading, bool otherwise
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = getAdminToken();
    setToken(t || '');
    if (!t) return;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/site-settings`);
        setInStock(!!r.data?.other_brands_in_stock);
      } catch (_) { setInStock(false); }
    })();
  }, []);

  if (!token) return null; // hidden for regular shoppers

  const toggle = async () => {
    if (inStock === null) return;
    const next = !inStock;
    setSaving(true);
    setInStock(next);
    try {
      await axios.put(
        `${API}/api/admin/site-settings`,
        { other_brands_in_stock: next },
        { headers: { 'X-Admin-Token': token } },
      );
    } catch (e) {
      setInStock(!next); // revert
      alert(`Toggle failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed bottom-24 left-4 z-40"
      data-testid="admin-home-toggle"
      style={{ pointerEvents: 'auto' }}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-11 h-11 rounded-full bg-stone-900 text-white shadow-lg flex items-center justify-center"
          title="Admin controls"
          data-testid="admin-home-toggle-expand"
        >
          <Package size={18} />
        </button>
      ) : (
        <div className="bg-white ring-1 ring-stone-200 shadow-xl rounded-2xl p-3 pr-4 flex items-center gap-3 max-w-[280px]">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center flex-shrink-0">
            <Package size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-stone-400">Other Brands</p>
            <p className="text-xs font-bold text-stone-800 truncate">
              {inStock === null ? 'Loading…' : inStock ? 'In stock — purchasable' : 'Out of stock (blocked at checkout)'}
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={saving || inStock === null}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${inStock ? 'bg-emerald-500' : 'bg-stone-300'} disabled:opacity-60`}
            data-testid="admin-home-toggle-switch"
            title={inStock ? 'Click to mark OUT of stock' : 'Click to mark IN stock'}
          >
            {saving ? (
              <Loader2 size={12} className="absolute inset-0 m-auto text-white animate-spin" />
            ) : (
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${inStock ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            )}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-stone-300 hover:text-stone-500 text-xs pl-1"
            title="Collapse"
            data-testid="admin-home-toggle-collapse"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
