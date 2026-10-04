import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Percent, ChevronLeft, Zap, Sparkles, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';
import BannerImageDropzone from '../../components/admin/BannerImageDropzone';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AdminOffers — dedicated page for the anti-aging Flat 50% OFF toggle and
 * the anti-aging landing banner uploads. Split out of AdminExtras so it has
 * its own sidebar entry and gets a hero-style layout that's obvious to use.
 * Only affects the anti-aging niche (per user requirement).
 */
export default function AdminOffers() {
  const navigate = useNavigate();
  const { adminToken, isLoading, isAuthenticated } = useAdminAuth(navigate);
  const auth = { headers: { 'X-Admin-Token': adminToken } };
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('offer');
  // Payment-policy toggle — separate from sale-mode. When ON, COD is only
  // offered to customers whose cart is 100% anti-aging OR whose pin is in an
  // instant-delivery warehouse zone. When OFF (default), COD works everywhere.
  const [codRestrictionEnabled, setCodRestrictionEnabled] = useState(false);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/api/sale-mode`);
      setCfg(r.data);
    } catch (_) { setCfg({ enabled: false }); }
    try {
      const p = await axios.get(`${API}/api/payment-policy`);
      setCodRestrictionEnabled(!!p.data?.cod_restriction_enabled);
    } catch (_) { /* leave default false */ }
  };
  useEffect(() => { if (adminToken) load(); }, [adminToken]);

  const savePaymentPolicy = async (nextValue) => {
    setCodRestrictionEnabled(nextValue); // optimistic
    try {
      await axios.put(`${API}/api/admin/payment-policy`, { cod_restriction_enabled: nextValue }, auth);
    } catch (e) {
      setCodRestrictionEnabled(!nextValue); // rollback
      alert('Save failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;
  }

  const patch = async (upd) => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/api/admin/sale-mode`, upd, auth);
      setCfg(r.data);
    } catch (e) { alert(e?.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const uploadBanner = async (field, file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API}/api/admin/sale-mode/banner?field=${field}`, fd, {
        ...auth, headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' },
      });
      setCfg(r.data);
    } catch (e) { alert('Upload failed'); }
  };

  if (!cfg) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>;

  const enabled = !!cfg.enabled;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/40 via-white to-white pb-20 lg:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="lg:hidden text-gray-600"><ChevronLeft size={22} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Percent size={22} className="text-rose-600" /> Offers & Sale
            </h1>
            <p className="text-sm text-gray-500 hidden lg:block">
              Master switch for the Anti-Aging Flat 50% OFF campaign. Toggle affects the anti-aging niche only.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Master switch hero card */}
        <div
          className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all ${
            enabled
              ? 'bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500 text-white border-transparent shadow-xl'
              : 'bg-white text-gray-800 border-gray-200'
          }`}
          data-testid="offer-hero"
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] tracking-[0.25em] font-black uppercase ${enabled ? 'text-white/80' : 'text-rose-600'}`}>
                Anti-Aging Master Switch
              </p>
              <h2 className="text-3xl sm:text-4xl font-black mt-1 leading-tight">
                Flat <span className="tabular-nums">{cfg.discount_percent || 50}%</span> OFF
              </h2>
              <p className={`text-sm mt-2 max-w-md ${enabled ? 'text-white/90' : 'text-gray-500'}`}>
                {enabled
                  ? 'ACTIVE — every anti-aging product shows the sale price, the homepage strip is visible, and the badge is on every card.'
                  : 'Currently OFF. Your website looks normal. Toggle ON to run the campaign — only the anti-aging niche is affected.'}
              </p>
            </div>
            <button
              onClick={() => patch({ enabled: !enabled })}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-6 py-4 rounded-2xl font-black uppercase text-sm tracking-wider transition-all disabled:opacity-60 ${
                enabled
                  ? 'bg-white text-rose-600 hover:bg-rose-50'
                  : 'bg-gray-900 text-white hover:bg-rose-600'
              }`}
              data-testid="offer-master-toggle"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : enabled ? <Check size={16} /> : <Zap size={16} />}
              {enabled ? 'ON' : 'Turn ON'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { k: 'offer', label: 'Offer settings', icon: Sparkles },
            { k: 'banner', label: 'Landing banners', icon: ImageIcon },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-1.5 ${
                tab === t.k ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
              data-testid={`offer-tab-${t.k}`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'offer' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4" data-testid="offer-settings">
            <Field label="Discount percent" hint="Applied on every anti-aging product when the toggle is ON.">
              <input type="number" min="10" max="90" value={cfg.discount_percent || 50}
                onChange={e => setCfg({ ...cfg, discount_percent: Number(e.target.value) })}
                onBlur={e => patch({ discount_percent: Number(e.target.value) })}
                className="input" data-testid="offer-discount-input" />
            </Field>
            <Field label="Badge text" hint="Shown as a chip on each anti-aging product card.">
              <input value={cfg.badge_label || ''} onChange={e => setCfg({ ...cfg, badge_label: e.target.value })}
                onBlur={e => patch({ badge_label: e.target.value })}
                className="input" data-testid="offer-badge-input" />
            </Field>
            <Field label="Homepage strip text" hint="Scrolls at the top of the homepage while the sale is ON.">
              <input value={cfg.banner_text || ''} onChange={e => setCfg({ ...cfg, banner_text: e.target.value })}
                onBlur={e => patch({ banner_text: e.target.value })}
                className="input" data-testid="offer-strip-input" />
            </Field>
            <Field label="Urgency line" hint="Small copy that plays under the strip (e.g. 'Ends tonight').">
              <input value={cfg.urgency_line || ''} onChange={e => setCfg({ ...cfg, urgency_line: e.target.value })}
                onBlur={e => patch({ urgency_line: e.target.value })}
                className="input" data-testid="offer-urgency-input" />
            </Field>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <ToggleRow label="Free shipping while ON" checked={!!cfg.zero_shipping} onChange={v => patch({ zero_shipping: v })} testid="offer-shipping-toggle" />
              <ToggleRow label="Zero tax while ON" checked={!!cfg.zero_tax} onChange={v => patch({ zero_tax: v })} testid="offer-tax-toggle" />
            </div>

            {/* Payment policy — separate lifecycle from sale mode. When OFF (default)
                COD is offered to everyone. When ON, COD is gated to Celesta Glow's
                own anti-aging products OR instant-delivery warehouse zones. */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2">COD Restriction Policy</p>
              <ToggleRow
                label={codRestrictionEnabled
                  ? 'ON — COD limited to anti-aging + instant-delivery zones'
                  : 'OFF (default) — COD available on all orders'}
                checked={codRestrictionEnabled}
                onChange={savePaymentPolicy}
                testid="offer-cod-restriction-toggle"
              />
              <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                When ON: skincare / cosmetics carts must go prepaid, unless the delivery pin is inside a warehouse coverage area (instant delivery available).
              </p>
            </div>
          </div>
        )}

        {tab === 'banner' && (
          <div className="space-y-4" data-testid="offer-banner-section">
            <BannerUpload title="Anti-Aging Sale banner — Desktop" description="Shown at the top of /shop?niche=anti-aging when the sale is ON." current={cfg.banner_image_desktop} onUpload={(f) => uploadBanner('banner_image_desktop', f)} testid="offer-banner-desktop" />
            <BannerUpload title="Anti-Aging Sale banner — Mobile" description="Mobile-optimised version of the same banner." current={cfg.banner_image_mobile} onUpload={(f) => uploadBanner('banner_image_mobile', f)} testid="offer-banner-mobile" />
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">Landing page banner (always visible)</p>
              <p className="text-xs text-gray-500 mb-3">Shown on the anti-aging landing page regardless of the sale toggle above.</p>
              <BannerUpload title="Landing banner — Desktop" description="" current={cfg.landing_banner_anti_aging_desktop} onUpload={(f) => uploadBanner('landing_banner_anti_aging_desktop', f)} testid="offer-landing-desktop" />
              <BannerUpload title="Landing banner — Mobile" description="" current={cfg.landing_banner_anti_aging_mobile} onUpload={(f) => uploadBanner('landing_banner_anti_aging_mobile', f)} testid="offer-landing-mobile" />
            </div>
          </div>
        )}
      </div>
      <style>{`.input{padding:0.55rem 0.8rem;border:1px solid #e5e7eb;border-radius:0.6rem;font-size:0.85rem;outline:none;width:100%}.input:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.2)}`}</style>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
      {hint && <p className="text-[11px] text-gray-500 mb-1">{hint}</p>}
      {children}
    </label>
  );
}

function ToggleRow({ label, checked, onChange, testid }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold ${
        checked ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-600'
      }`}
      data-testid={testid}
    >
      <span>{label}</span>
      <span className={`ml-2 w-8 h-4 rounded-full relative transition-all ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function BannerUpload({ title, description, current, onUpload, testid }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-3 items-start" data-testid={testid}>
      <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
        {current ? <img src={current} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-gray-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {description && <p className="text-[11px] text-gray-500 leading-snug">{description}</p>}
        <BannerImageDropzone onFile={onUpload} />
      </div>
    </div>
  );
}
