import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, DollarSign, MousePointer, ShoppingBag, 
  ArrowLeft, Copy, CheckCircle, RefreshCw, Gift,
  TrendingUp, Clock, ExternalLink, CreditCard, Eye, X, Plus, Loader2, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminReferrals() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  const [referrals, setReferrals] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [testReferralCode, setTestReferralCode] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);
  // Withdrawal queue (option-A manual payouts)
  const [withdrawals, setWithdrawals] = useState([]);
  const [wdLoading, setWdLoading] = useState(false);
  // Pagination + search
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [searchQ, setSearchQ] = useState('');
  // Manual referral create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);

  const fetchReferrals = async (token, opts = {}) => {
    if (!token) return;
    setLoading(true);
    try {
      const p = opts.page || page;
      const q = opts.q ?? searchQ;
      const qs = new URLSearchParams({ page: String(p), limit: '25' });
      if (q) qs.set('q', q);
      const res = await axios.get(`${API}/admin/referrals?${qs.toString()}`, {
        headers: { 'X-Admin-Token': token }
      });
      setReferrals(res.data.referrals || []);
      setSummary(res.data.summary || {});
      if (res.data.pagination) setPageInfo(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async ({ name, phone, email }) => {
    setCreateBusy(true);
    setCreatedInfo(null);
    try {
      const res = await axios.post(
        `${API}/admin/referrals/create-manual`,
        { name, phone, email: email || null },
        { headers: { 'X-Admin-Token': adminToken } },
      );
      setCreatedInfo(res.data);
      // Refresh list so the new referral appears at the top
      fetchReferrals(adminToken, { page: 1 });
      setPage(1);
    } catch (err) {
      alert('Create failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreateBusy(false);
    }
  };

  const fetchWithdrawals = async (token) => {
    if (!token) return;
    setWdLoading(true);
    try {
      const res = await axios.get(`${API}/admin/withdrawal-requests`, {
        headers: { 'X-Admin-Token': token }
      });
      setWithdrawals(res.data.requests || []);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    } finally {
      setWdLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && adminToken) {
      fetchReferrals(adminToken);
      fetchWithdrawals(adminToken);
    }
  }, [authLoading, isAuthenticated, adminToken]);

  const markWithdrawalPaid = async (requestId) => {
    const txnRef = window.prompt('Optional: enter UPI/Bank transaction reference (or leave blank).') || '';
    setProcessingPayment(requestId);
    try {
      await axios.post(
        `${API}/admin/withdrawal-requests/${requestId}/mark-paid`,
        { txn_ref: txnRef },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      await fetchWithdrawals(adminToken);
      await fetchReferrals(adminToken);
    } catch (err) {
      alert(err.response?.data?.detail || 'Mark-paid failed');
    } finally {
      setProcessingPayment(null);
    }
  };

  const rejectWithdrawal = async (requestId) => {
    const reason = window.prompt('Reason for rejecting this withdrawal request:');
    if (!reason) return;
    try {
      await axios.post(
        `${API}/admin/withdrawal-requests/${requestId}/reject`,
        { reason },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      fetchWithdrawals(adminToken);
    } catch (err) {
      alert(err.response?.data?.detail || 'Reject failed');
    }
  };

  const handleTestPurchase = async () => {
    if (!testReferralCode) return;
    
    try {
      const res = await axios.post(
        `${API}/admin/referrals/test-purchase?referral_code=${testReferralCode}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      setTestResult(res.data);
      if (res.data.success) {
        fetchReferrals(adminToken); // Refresh data
      }
    } catch (err) {
      setTestResult({ success: false, error: 'Test failed' });
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(`https://celestaglow.com?ref=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const viewReferralDetails = async (referralCode) => {
    try {
      const res = await axios.get(`${API}/admin/referrals/${referralCode}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setSelectedReferral(res.data);
    } catch (err) {
      console.error('Failed to fetch referral details:', err);
    }
  };

  const markOrderAsPaid = async (referralCode, orderId) => {
    setProcessingPayment(orderId);
    try {
      await axios.post(
        `${API}/admin/referrals/mark-order-paid?referral_code=${referralCode}&order_id=${orderId}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      // Refresh both the selected referral and the main list
      await viewReferralDetails(referralCode);
      await fetchReferrals(adminToken);
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    } finally {
      setProcessingPayment(null);
    }
  };

  const markAllPending = async (referralCode, pendingAmount) => {
    setProcessingPayment(referralCode);
    try {
      await axios.post(
        `${API}/admin/referrals/mark-paid?referral_code=${referralCode}&amount=${pendingAmount}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      await fetchReferrals(adminToken);
      if (selectedReferral) {
        await viewReferralDetails(referralCode);
      }
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    } finally {
      setProcessingPayment(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Referral Program</h1>
              <p className="text-sm text-gray-500">Track referrals and earnings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCreatedInfo(null); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold"
              data-testid="create-manual-referral-btn"
            >
              <Plus size={16} /> Create Referral Link
            </button>
            <button
              onClick={() => fetchReferrals(adminToken)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_referrers || 0}</p>
                <p className="text-xs text-gray-500">Total Referrers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_clicks || 0}</p>
                <p className="text-xs text-gray-500">Link Clicks</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_purchases || 0}</p>
                <p className="text-xs text-gray-500">Referral Purchases</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">₹{summary.total_earnings || 0}</p>
                <p className="text-xs text-gray-500">Total Earnings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Withdrawal Queue */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="withdrawal-queue">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard size={18} className="text-amber-600" />
              Withdrawal Requests
              {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <span className="ml-1 bg-amber-100 text-amber-800 text-xs font-black px-2 py-0.5 rounded-full">
                  {withdrawals.filter(w => w.status === 'pending').length} pending
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={() => fetchWithdrawals(adminToken)}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1"
              data-testid="withdrawals-refresh"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {wdLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
          ) : withdrawals.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500" data-testid="withdrawals-empty">
              No withdrawal requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] font-black tracking-wide text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-left">Method · Destination</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {withdrawals.map(w => (
                    <tr key={w.request_id} className="hover:bg-gray-50" data-testid={`withdrawal-${w.request_id}`}>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{(w.created_at || '').slice(0, 10)}</td>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-gray-900 truncate">{w.referrer_name || '—'}</p>
                        <p className="text-[11px] text-gray-500">{w.referrer_phone || w.referrer_email}</p>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span className="font-bold uppercase text-gray-700">{w.payout_method}</span>
                        <span className="text-gray-500"> · </span>
                        <span className="font-mono">{w.payout_destination}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-bold">₹{w.amount}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          w.status === 'paid' ? 'bg-green-100 text-green-800' :
                          w.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {w.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {w.status === 'pending' ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => markWithdrawalPaid(w.request_id)}
                              disabled={processingPayment === w.request_id}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold disabled:opacity-50"
                              data-testid={`withdrawal-pay-${w.request_id}`}
                            >
                              {processingPayment === w.request_id ? 'Processing…' : 'Mark Paid'}
                            </button>
                            <button
                              onClick={() => rejectWithdrawal(w.request_id)}
                              className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-[11px] font-bold"
                              data-testid={`withdrawal-reject-${w.request_id}`}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-500">{w.txn_ref ? `Ref: ${w.txn_ref}` : '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Test Section */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-green-500" />
            Test Referral Purchase
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Simulate a purchase through a referral link to test the system
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testReferralCode}
              onChange={(e) => setTestReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter referral code (e.g., CG12AB34)"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <button
              onClick={handleTestPurchase}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600"
            >
              Test Purchase
            </button>
          </div>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.success 
                ? `✅ Test purchase recorded! ₹${testResult.earnings_added} added to ${testResult.referrer_name}'s earnings.`
                : `❌ ${testResult.error || 'Test failed'}`
              }
            </div>
          )}
        </div>

        {/* Referrals Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Gift size={18} className="text-purple-500" />
              All Referrers ({pageInfo.total})
            </h3>
            {/* Search — server-side, debounced by submitting on Enter */}
            <form
              onSubmit={(e) => { e.preventDefault(); setPage(1); fetchReferrals(adminToken, { page: 1, q: searchQ }); }}
              className="flex items-center gap-1.5"
            >
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search name, phone, code…"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-56"
                  data-testid="referrals-search-input"
                />
              </div>
              {searchQ && (
                <button
                  type="button"
                  onClick={() => { setSearchQ(''); setPage(1); fetchReferrals(adminToken, { page: 1, q: '' }); }}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                  aria-label="Clear search"
                ><X size={12} /></button>
              )}
            </form>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No referrers yet</p>
              <p className="text-sm">Referral links are generated after each order</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Referrer</th>
                    <th className="px-4 py-3 text-left">Referral Link</th>
                    <th className="px-4 py-3 text-center">Clicks</th>
                    <th className="px-4 py-3 text-center">Purchases</th>
                    <th className="px-4 py-3 text-right">Earnings</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referrals.map((ref, idx) => (
                    <tr key={ref.referral_code || `ref-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{ref.referrer_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{ref.referrer_phone}</p>
                          <p className="text-xs text-gray-400">{formatDate(ref.created_at)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono truncate max-w-[180px]">
                            celestaglow.com?ref={ref.referral_code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(ref.referral_code)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-green-600"
                            title="Copy link"
                          >
                            {copiedCode === ref.referral_code ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-blue-600 font-medium">{ref.total_referrals || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-medium">{ref.successful_purchases || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-900">₹{ref.total_earnings || 0}</span>
                        {ref.earnings_paid > 0 && (
                          <p className="text-xs text-green-600">₹{ref.earnings_paid} paid</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(ref.earnings_pending || 0) > 0 ? (
                          <span className="text-amber-600 font-bold">₹{ref.earnings_pending}</span>
                        ) : (
                          <span className="text-gray-400">₹0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => viewReferralDetails(ref.referral_code)}
                            className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          {(ref.earnings_pending || 0) > 0 && (
                            <button
                              onClick={() => markAllPending(ref.referral_code, ref.earnings_pending)}
                              disabled={processingPayment === ref.referral_code}
                              className="p-2 hover:bg-green-50 rounded-lg text-gray-500 hover:text-green-600 disabled:opacity-50"
                              title="Mark all pending as paid"
                            >
                              {processingPayment === ref.referral_code ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <CreditCard size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination footer */}
          {pageInfo.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600" data-testid="referrals-pagination">
              <span>
                Page <b>{pageInfo.page}</b> of <b>{pageInfo.pages}</b> · {pageInfo.total} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={pageInfo.page <= 1}
                  onClick={() => { const p = pageInfo.page - 1; setPage(p); fetchReferrals(adminToken, { page: p }); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="pagination-prev"
                ><ChevronLeft size={14} /></button>
                <button
                  disabled={pageInfo.page >= pageInfo.pages}
                  onClick={() => { const p = pageInfo.page + 1; setPage(p); fetchReferrals(adminToken, { page: p }); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="pagination-next"
                ><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-r from-purple-50 to-green-50 rounded-xl p-4 border border-purple-100">
          <h4 className="font-semibold text-gray-900 mb-2">How Referral Program Works</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Customer buys → Gets unique referral link via email</li>
            <li>• Friend uses link → Gets ₹50 discount at checkout</li>
            <li>• Friend's order delivered → Original customer earns ₹100 cashback</li>
            <li>• Earnings tracked here → Pay manually or integrate UPI</li>
          </ul>
        </div>
      </div>

      {/* Referral Details Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-900">{selectedReferral.referrer_name}</h3>
                <p className="text-sm text-gray-500">{selectedReferral.referrer_phone}</p>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Referral Link */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800 mb-2">Referral Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded-lg text-sm font-mono text-green-700 border border-green-200">
                    https://celestaglow.com?ref={selectedReferral.referral_code}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedReferral.referral_code)}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    {copiedCode === selectedReferral.referral_code ? <CheckCircle size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">₹{selectedReferral.total_earnings || 0}</p>
                  <p className="text-xs text-gray-500">Total Earnings</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">₹{selectedReferral.earnings_paid || 0}</p>
                  <p className="text-xs text-gray-500">Paid</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">₹{selectedReferral.earnings_pending || 0}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>

              {/* Referred Orders */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Referred Orders ({selectedReferral.referred_orders?.length || 0})</h4>
                {selectedReferral.referred_orders && selectedReferral.referred_orders.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReferral.referred_orders.map((order, idx) => (
                      <div key={order.order_id || `order-${idx}`} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{order.buyer_name}</p>
                          <p className="text-xs text-gray-500">Order: {order.order_id}</p>
                          <p className="text-xs text-gray-400">{formatDate(order.purchased_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₹{order.order_amount}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {order.delivery_status === 'delivered' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Delivered</span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Pending Delivery</span>
                            )}
                            {order.cashback_status === 'paid' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle size={10} /> ₹100 Paid
                              </span>
                            ) : order.cashback_status === 'ready_to_pay' ? (
                              <button
                                onClick={() => markOrderAsPaid(selectedReferral.referral_code, order.order_id)}
                                disabled={processingPayment === order.order_id}
                                className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
                              >
                                {processingPayment === order.order_id ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <CreditCard size={10} />
                                )}
                                Pay ₹100
                              </button>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Awaiting Delivery</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No referred orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────── Create Manual Referral Link modal ─────── */}
      {showCreate && (
        <ManualReferralModal
          busy={createBusy}
          createdInfo={createdInfo}
          onSubmit={handleCreateManual}
          onClose={() => { setShowCreate(false); setCreatedInfo(null); }}
        />
      )}
    </div>
  );
}

// ─── Manual Referral modal ───────────────────────────────────────────────
function ManualReferralModal({ busy, createdInfo, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!name.trim() || cleanPhone.length < 10) {
      alert('Enter a name and a valid 10-digit phone number.');
      return;
    }
    onSubmit({ name: name.trim(), phone: cleanPhone, email: email.trim() || null });
  };

  const copyLink = async () => {
    if (!createdInfo?.referral_link) return;
    try {
      await navigator.clipboard.writeText(createdInfo.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {}
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="manual-referral-modal"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-black text-lg text-stone-900">Create Referral Link</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>

        {!createdInfo ? (
          <form onSubmit={submit} className="p-5 space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Priya Sharma"
                autoFocus
                data-testid="manual-referral-name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Phone *</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="9876543210"
                data-testid="manual-referral-phone"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Email (optional)</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="priya@example.com"
              />
            </label>
            <p className="text-[11px] text-stone-500 pt-1">
              Reusing the same phone number returns the existing referral code — safe to re-share the same link.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-full">Cancel</button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2 rounded-full disabled:opacity-50"
                data-testid="manual-referral-submit"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {busy ? 'Creating…' : 'Create Link'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4" data-testid="manual-referral-result">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
                {createdInfo.is_new ? 'Referral created' : 'Existing referral loaded'}
              </p>
              <p className="text-sm text-stone-700">
                For <b>{createdInfo.referrer_name}</b> · +91 {createdInfo.referrer_phone}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">Referral Code</p>
              <div className="font-mono text-base font-bold text-emerald-700 bg-stone-50 rounded-lg px-3 py-2 border border-stone-200">
                {createdInfo.referral_code}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">Shareable Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={createdInfo.referral_link}
                  className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg font-mono"
                />
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
                  data-testid="copy-referral-link"
                >
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-full">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminReferrals;
