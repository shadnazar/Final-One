import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  BarChart3, Users, ShoppingCart, TrendingUp, Eye, Clock,
  RefreshCw, Calendar, Package, CreditCard, ChevronLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function EmployeeAnalytics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const employeeToken = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, liveRes] = await Promise.all([
        axios.get(`${API}/api/admin/user-tracking/stats?days=${days}`, {
          headers: { 'X-Employee-Token': employeeToken }
        }),
        axios.get(`${API}/api/admin/analytics/live`, {
          headers: { 'X-Employee-Token': employeeToken }
        })
      ]);
      setStats(statsRes.data);
      setLiveData(liveRes.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/employee/dashboard" data-testid="back-to-dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
        <ChevronLeft size={20} />
        <span>Back to Dashboard</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm">Website performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_visitors || 0}</p>
          <p className="text-sm text-gray-500">Total Visitors</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.conversions || 0}</p>
          <p className="text-sm text-gray-500">Purchases</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{liveData?.live_visitors?.total || 0}</p>
          <p className="text-sm text-gray-500">Live Visitors</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.reached_checkout || 0}</p>
          <p className="text-sm text-gray-500">Reached Checkout</p>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Conversion Funnel</h2>
        <div className="space-y-3">
          {[
            { label: 'Total Visitors', value: stats?.total_visitors || 0, color: 'bg-blue-500', percent: 100 },
            { label: 'Viewed Product', value: stats?.reached_checkout ? Math.round((stats.reached_checkout / (stats.total_visitors || 1)) * 150) : 0, color: 'bg-purple-500', percent: 60 },
            { label: 'Reached Checkout', value: stats?.reached_checkout || 0, color: 'bg-orange-500', percent: ((stats?.reached_checkout || 0) / (stats?.total_visitors || 1)) * 100 },
            { label: 'Entered Address', value: stats?.address_entered || 0, color: 'bg-yellow-500', percent: ((stats?.address_entered || 0) / (stats?.total_visitors || 1)) * 100 },
            { label: 'Purchased', value: stats?.conversions || 0, color: 'bg-green-500', percent: ((stats?.conversions || 0) / (stats?.total_visitors || 1)) * 100 },
          ].map((stage, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600">{stage.label}</div>
              <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${stage.color} transition-all duration-500`}
                  style={{ width: `${Math.min(stage.percent, 100)}%` }}
                />
              </div>
              <div className="w-20 text-right font-semibold text-gray-900">{stage.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-cyan-500" />
            <span className="text-sm text-gray-500">Avg Time on Site</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {Math.round((stats?.avg_time_spent || 0) / 60)}m {Math.round((stats?.avg_time_spent || 0) % 60)}s
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Checkout Rate</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {stats?.checkout_rate?.toFixed(1) || 0}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Returning Visitors</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{stats?.returning_visitors || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeAnalytics;
