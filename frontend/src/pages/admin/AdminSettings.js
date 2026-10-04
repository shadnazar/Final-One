/**
 * AdminSettings — Cloudinary credentials + admin password change.
 *
 * Cloudinary section lets the admin save cloud_name / api_key / api_secret.
 * The api_secret is sent to the server but never displayed once saved (we only
 * ever fetch the masked version back).
 *
 * Password section calls /api/admin/change-password and forces a re-login on success.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Cloud, Save, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getAdminToken, clearAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const navigate = useNavigate();
  const token = getAdminToken();

  // Cloudinary state
  const [cdn, setCdn] = useState({ cloud_name: '', api_key: '', api_secret: '', api_secret_masked: '', configured: false });
  const [cdnSaving, setCdnSaving] = useState(false);
  const [cdnMsg, setCdnMsg] = useState({ type: '', text: '' });
  const [showSecret, setShowSecret] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    (async () => {
      try {
        const r = await axios.get(`${API}/admin/cloudinary/settings`, { headers: { 'X-Admin-Token': token } });
        setCdn({
          cloud_name: r.data.cloud_name || '',
          api_key: r.data.api_key || '',
          api_secret: '',
          api_secret_masked: r.data.api_secret_masked || '',
          configured: !!r.data.configured,
        });
      } catch {
        // ignore
      }
    })();
  }, [token, navigate]);

  const saveCloudinary = async (e) => {
    e.preventDefault();
    setCdnMsg({ type: '', text: '' });
    if (!cdn.cloud_name.trim() || !cdn.api_key.trim() || !cdn.api_secret.trim()) {
      setCdnMsg({ type: 'err', text: 'cloud_name, api_key and api_secret are all required.' });
      return;
    }
    setCdnSaving(true);
    try {
      await axios.post(`${API}/admin/cloudinary/settings`, {
        cloud_name: cdn.cloud_name.trim(),
        api_key: cdn.api_key.trim(),
        api_secret: cdn.api_secret.trim(),
      }, { headers: { 'X-Admin-Token': token } });
      setCdnMsg({ type: 'ok', text: 'Cloudinary credentials saved. Image uploads now go to Cloudinary.' });
      setCdn(prev => ({ ...prev, api_secret: '', configured: true }));
      // Refresh masked view
      const r = await axios.get(`${API}/admin/cloudinary/settings`, { headers: { 'X-Admin-Token': token } });
      setCdn(prev => ({ ...prev, api_secret_masked: r.data.api_secret_masked || '' }));
    } catch (err) {
      setCdnMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to save credentials.' });
    } finally {
      setCdnSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (pw.next.length < 8) { setPwMsg({ type: 'err', text: 'New password must be at least 8 characters.' }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ type: 'err', text: 'New passwords do not match.' }); return; }
    setPwSaving(true);
    try {
      await axios.post(`${API}/admin/change-password`, {
        current_password: pw.current,
        new_password: pw.next,
      }, { headers: { 'X-Admin-Token': token } });
      setPwMsg({ type: 'ok', text: 'Password updated. Please sign in again with the new password.' });
      setTimeout(() => {
        clearAdminToken();
        navigate('/admin');
      }, 1800);
    } catch (err) {
      setPwMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-settings-page">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:ml-64">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-4" data-testid="settings-back">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Image hosting credentials and admin password.</p>

        {/* Cloudinary */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6" data-testid="cloudinary-section">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Cloud size={18} className="text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cloudinary (Image hosting)</h2>
              <p className="text-xs text-gray-500">All product / routine / consultation images upload here for fast delivery.</p>
            </div>
            {cdn.configured ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full"><CheckCircle2 size={12} /> Configured</span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full"><AlertCircle size={12} /> Needs cloud_name</span>
            )}
          </div>

          <form onSubmit={saveCloudinary} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cloud name</label>
              <input
                type="text"
                value={cdn.cloud_name}
                onChange={(e) => setCdn({ ...cdn, cloud_name: e.target.value })}
                placeholder="e.g. celesta-glow"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-blue-200"
                data-testid="cdn-cloud-name"
              />
              <p className="text-[11px] text-gray-400 mt-1">Find this on your Cloudinary dashboard (Account → Account Details).</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">API key</label>
              <input
                type="text"
                value={cdn.api_key}
                onChange={(e) => setCdn({ ...cdn, api_key: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-blue-200 font-mono"
                data-testid="cdn-api-key"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">API secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={cdn.api_secret}
                  onChange={(e) => setCdn({ ...cdn, api_secret: e.target.value })}
                  placeholder={cdn.api_secret_masked || 'Enter API secret'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-11 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-blue-200 font-mono"
                  data-testid="cdn-api-secret"
                />
                <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label="Toggle secret visibility">
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {cdn.api_secret_masked && !cdn.api_secret && (
                <p className="text-[11px] text-gray-400 mt-1">Currently saved: {cdn.api_secret_masked}. Re-enter to replace.</p>
              )}
            </div>

            {cdnMsg.text && (
              <div className={`px-3 py-2 rounded-lg text-xs ${cdnMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`} data-testid="cdn-msg">
                {cdnMsg.text}
              </div>
            )}

            <button type="submit" disabled={cdnSaving} className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-black disabled:opacity-50" data-testid="cdn-save">
              <Save size={14} /> {cdnSaving ? 'Saving…' : 'Save Cloudinary credentials'}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6" data-testid="password-section">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center"><KeyRound size={18} className="text-rose-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Admin password</h2>
              <p className="text-xs text-gray-500">After changing, sign in again with the new password.</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Current password</label>
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-rose-200" data-testid="pw-current" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">New password</label>
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-rose-200" data-testid="pw-new" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Confirm new password</label>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-rose-200" data-testid="pw-confirm" />
            </div>

            {pwMsg.text && (
              <div className={`px-3 py-2 rounded-lg text-xs ${pwMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`} data-testid="pw-msg">
                {pwMsg.text}
              </div>
            )}

            <button type="submit" disabled={pwSaving} className="inline-flex items-center gap-2 bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-rose-700 disabled:opacity-50" data-testid="pw-save">
              <Save size={14} /> {pwSaving ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
