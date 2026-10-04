import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ChevronLeft, Users, Clock, Calendar, Eye, MousePointer, 
  MapPin, Monitor, ChevronRight, ChevronDown, Home, Package,
  ShoppingCart, FileText, Filter, RefreshCw, User, Activity,
  CheckCircle, XCircle, Smartphone, Tablet, TrendingDown, TrendingUp,
  AlertTriangle, Lightbulb, Phone, Mail, CreditCard, ArrowRight,
  LogOut, Scroll, Target, BarChart3
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminUserJourney() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  
  const [visitors, setVisitors] = useState([]);
  const [stats, setStats] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDays, setSelectedDays] = useState(7);
  const [expandedVisitor, setExpandedVisitor] = useState(null);
  const [visitorJourney, setVisitorJourney] = useState(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('overview'); // overview, visitors, insights
  const itemsPerPage = 50; // Increased from 20 to 50 per page

  const fetchData = useCallback(async () => {
    if (!adminToken) return;

    setLoading(true);
    try {
      const headers = { 'X-Admin-Token': adminToken };
      
      let visitorsUrl = `${API}/admin/user-tracking/visitors?days=${selectedDays}&limit=1000`;
      let statsUrl = `${API}/admin/user-tracking/stats?days=${selectedDays}`;
      
      if (selectedDate) {
        visitorsUrl = `${API}/admin/user-tracking/visitors?date=${selectedDate}&limit=1000`;
        statsUrl = `${API}/admin/user-tracking/stats?date=${selectedDate}`;
      }
      
      const [visitorsRes, statsRes] = await Promise.all([
        axios.get(visitorsUrl, { headers }),
        axios.get(statsUrl, { headers })
      ]);
      
      setVisitors(visitorsRes.data.visitors || []);
      setStats(statsRes.data);
      
      // Calculate funnel data
      calculateFunnelData(visitorsRes.data.visitors || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  }, [adminToken, navigate, selectedDays, selectedDate]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [fetchData, authLoading, isAuthenticated]);

  const calculateFunnelData = useCallback((visitorsData) => {
    const total = visitorsData.length;
    if (total === 0) {
      setFunnelData(null);
      return;
    }

    const viewedProduct = visitorsData.filter(v => 
      v.pages_visited > 1 || v.profile?.pages_visited?.includes('product')
    ).length;
    
    const reachedCheckout = visitorsData.filter(v => 
      v.reached_checkout || v.profile?.reached_checkout
    ).length;
    
    const enteredAddress = visitorsData.filter(v => 
      v.address_entered || v.profile?.address_entered
    ).length;
    
    const claimedDiscount = visitorsData.filter(v => 
      v.discount_claimed || v.profile?.discount_claimed
    ).length;

    // Find drop-off points
    const dropOffPoints = [];
    
    if (total > viewedProduct) {
      dropOffPoints.push({
        stage: 'Homepage → Product',
        dropped: total - viewedProduct,
        percentage: Math.round(((total - viewedProduct) / total) * 100)
      });
    }
    
    if (viewedProduct > reachedCheckout) {
      dropOffPoints.push({
        stage: 'Product → Checkout',
        dropped: viewedProduct - reachedCheckout,
        percentage: Math.round(((viewedProduct - reachedCheckout) / Math.max(viewedProduct, 1)) * 100)
      });
    }
    
    if (reachedCheckout > enteredAddress) {
      dropOffPoints.push({
        stage: 'Checkout → Address',
        dropped: reachedCheckout - enteredAddress,
        percentage: Math.round(((reachedCheckout - enteredAddress) / Math.max(reachedCheckout, 1)) * 100)
      });
    }

    setFunnelData({
      total,
      viewedProduct,
      reachedCheckout,
      enteredAddress,
      claimedDiscount,
      conversionRate: Math.round((enteredAddress / total) * 100),
      dropOffPoints: dropOffPoints.sort((a, b) => b.dropped - a.dropped)
    });
  }, []);

  const fetchVisitorJourney = async (visitorId) => {
    if (expandedVisitor === visitorId) {
      setExpandedVisitor(null);
      setVisitorJourney(null);
      return;
    }

    setExpandedVisitor(visitorId);
    setLoadingJourney(true);
    
    try {
      const res = await axios.get(
        `${API}/admin/user-tracking/visitor/${visitorId}`,
        { headers: { 'X-Admin-Token': adminToken } }
      );
      setVisitorJourney(res.data);
    } catch (err) {
      console.error('Error fetching journey:', err);
    } finally {
      setLoadingJourney(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const date = new Date(ts);
    return date.toLocaleString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDeviceType = (screenWidth) => {
    if (!screenWidth) return { type: 'Unknown', icon: Monitor };
    const width = parseInt(screenWidth);
    if (width < 768) return { type: 'Mobile', icon: Smartphone };
    if (width < 1024) return { type: 'Tablet', icon: Tablet };
    return { type: 'Desktop', icon: Monitor };
  };

  const getPageIcon = (page) => {
    const p = (page || '').toLowerCase();
    if (p.includes('home') || p === '/') return <Home className="w-4 h-4 text-blue-500" />;
    if (p.includes('product')) return <Package className="w-4 h-4 text-purple-500" />;
    if (p.includes('checkout')) return <ShoppingCart className="w-4 h-4 text-green-500" />;
    if (p.includes('blog')) return <FileText className="w-4 h-4 text-orange-500" />;
    if (p.includes('consultation')) return <User className="w-4 h-4 text-pink-500" />;
    return <Eye className="w-4 h-4 text-gray-500" />;
  };

  const getActionIcon = (action) => {
    const a = (action || '').toLowerCase();
    if (a.includes('click') || a.includes('button')) return <MousePointer className="w-3 h-3" />;
    if (a.includes('scroll')) return <Scroll className="w-3 h-3" />;
    if (a.includes('checkout') || a.includes('payment')) return <CreditCard className="w-3 h-3" />;
    if (a.includes('discount') || a.includes('claim')) return <Target className="w-3 h-3" />;
    if (a.includes('form') || a.includes('address')) return <FileText className="w-3 h-3" />;
    if (a.includes('exit')) return <LogOut className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  // Pagination
  const totalPages = Math.ceil(visitors.length / itemsPerPage);
  const paginatedVisitors = visitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">User Journey Analytics</h1>
                <p className="text-sm text-gray-500">Comprehensive visitor behavior tracking</p>
              </div>
            </div>
            <button 
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200 -mb-px">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'visitors', label: `Visitors (${visitors.length})`, icon: Users },
              { id: 'insights', label: 'Insights', icon: Lightbulb }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
            </div>
            
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedDays(7);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                data-testid="date-picker"
              />
              {selectedDate && (
                <button
                  onClick={() => { setSelectedDate(''); setCurrentPage(1); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-gray-300">|</span>

            {/* Quick Filters */}
            <div className="flex gap-2">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => {
                    setSelectedDays(days);
                    setSelectedDate('');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedDays === days && !selectedDate
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Last {days}d
                </button>
              ))}
            </div>
          </div>
          
          {selectedDate && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              📅 Showing data for: <strong>{new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </div>
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className="text-xs text-gray-500">Total Visitors</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_visitors}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-green-500" />
                    <span className="text-xs text-gray-500">New</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.new_visitors}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-purple-500" />
                    <span className="text-xs text-gray-500">Returning</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.returning_visitors}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-5 h-5 text-orange-500" />
                    <span className="text-xs text-gray-500">Checkout</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.reached_checkout}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-xs text-gray-500">Address</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.address_entered}</p>
                </div>
                {/* Purchased/Conversions Card - NEW */}
                <div className="bg-gradient-to-br from-green-50 to-green-50 rounded-xl p-4 border border-green-200" data-testid="stat-purchased">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <span className="text-xs text-green-700 font-medium">Purchased</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{stats.conversions || 0}</p>
                  {stats.conversion_rate > 0 && (
                    <p className="text-xs text-green-600 mt-1">{stats.conversion_rate.toFixed(1)}% rate</p>
                  )}
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-cyan-500" />
                    <span className="text-xs text-gray-500">Avg Time</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatTime(stats.avg_time_spent)}</p>
                </div>
              </div>
            )}

            {/* Funnel Visualization */}
            {funnelData && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-orange-500" />
                  Conversion Funnel
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Total Visitors', value: funnelData.total, color: 'bg-blue-500' },
                    { label: 'Viewed Product', value: funnelData.viewedProduct, color: 'bg-purple-500' },
                    { label: 'Reached Checkout', value: funnelData.reachedCheckout, color: 'bg-orange-500' },
                    { label: 'Entered Address', value: funnelData.enteredAddress, color: 'bg-amber-500' },
                    { label: 'Purchased', value: stats?.conversions || 0, color: 'bg-green-500' },
                  ].map((stage, i) => (
                    <div key={stage.label} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                        <span className="text-sm font-bold text-gray-900">
                          {stage.value} 
                          <span className="text-gray-400 font-normal ml-1">
                            ({Math.round((stage.value / funnelData.total) * 100)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className={`h-full ${stage.color} transition-all duration-500`}
                          style={{ width: `${(stage.value / funnelData.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Conversion Rate */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Overall Conversion Rate</p>
                      <p className="text-3xl font-bold text-green-600">{funnelData.conversionRate}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Discount Claims</p>
                      <p className="text-2xl font-bold text-orange-500">{funnelData.claimedDiscount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Drop-off Analysis */}
            {funnelData?.dropOffPoints?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Major Drop-off Points
                </h3>
                <div className="space-y-3">
                  {funnelData.dropOffPoints.map((point, i) => (
                    <div key={point.stage || `dropoff-${i}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                          {i + 1}
                        </div>
                        <span className="font-medium text-gray-800">{point.stage}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{point.dropped} dropped</p>
                        <p className="text-xs text-gray-500">{point.percentage}% drop rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Visitors Tab */}
        {activeTab === 'visitors' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                All Visitors ({visitors.length})
              </h2>
              {/* Pagination Info */}
              {totalPages > 1 && (
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            {paginatedVisitors.length > 0 ? (
              <>
                <div className="divide-y divide-gray-100">
                  {paginatedVisitors.map((visitor) => {
                    const visitorId = visitor.visitor_id || visitor.profile?.visitor_id;
                    const screenWidth = visitor.profile?.screen_size?.split('x')[0] || visitor.screen_size?.split('x')[0];
                    const device = getDeviceType(screenWidth);
                    const DeviceIcon = device.icon;
                    
                    return (
                      <div key={visitorId} className="p-4 hover:bg-gray-50 transition-colors">
                        {/* Visitor Row */}
                        <button
                          onClick={() => fetchVisitorJourney(visitorId)}
                          className="w-full text-left"
                          data-testid={`visitor-row-${visitorId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                {(visitorId || '?').charAt(2).toUpperCase()}
                              </div>
                              <div>
                                {/* Name or Visitor ID */}
                                <p className="font-medium text-gray-900 text-sm">
                                  {visitor.profile?.name || visitor.name || visitorId?.substring(0, 16) + '...'}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                  {/* First Seen */}
                                  {(visitor.first_seen || visitor.profile?.first_seen) && (
                                    <span className="flex items-center gap-1 text-blue-600">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(visitor.first_seen || visitor.profile?.first_seen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                  {/* Device Type */}
                                  <span className="flex items-center gap-1">
                                    <DeviceIcon className="w-3 h-3" />
                                    {device.type}
                                  </span>
                                  {/* Pages */}
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {visitor.pages_visited || 0} pages
                                  </span>
                                  {/* Actions */}
                                  <span className="flex items-center gap-1">
                                    <MousePointer className="w-3 h-3" />
                                    {visitor.actions_count || 0} actions
                                  </span>
                                  {/* Time */}
                                  {(visitor.profile?.total_time_spent || visitor.total_time_spent) && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(visitor.profile?.total_time_spent || visitor.total_time_spent)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {/* Phone Badge */}
                              {(visitor.phone || visitor.profile?.phone) && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {visitor.phone || visitor.profile?.phone}
                                </span>
                              )}
                              {/* Location Badge */}
                              {(visitor.location_place?.state || visitor.profile?.location_place?.state) && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {visitor.location_place?.city || visitor.profile?.location_place?.city || ''} 
                                  {visitor.location_place?.state || visitor.profile?.location_place?.state}
                                </span>
                              )}
                              {/* Status Badges */}
                              {(visitor.reached_checkout || visitor.profile?.reached_checkout) && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                                  Checkout
                                </span>
                              )}
                              {(visitor.address_entered || visitor.profile?.address_entered) && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                  Address ✓
                                </span>
                              )}
                              {(visitor.discount_claimed || visitor.profile?.discount_claimed) && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                                  ₹{visitor.discount_amount || visitor.profile?.discount_amount || 50} OFF
                                </span>
                              )}
                              <ChevronDown 
                                className={`w-5 h-5 text-gray-400 transition-transform ${
                                  expandedVisitor === visitorId ? 'rotate-180' : ''
                                }`} 
                              />
                            </div>
                          </div>
                        </button>

                        {/* Expanded Journey Details */}
                        {expandedVisitor === visitorId && (
                          <div className="mt-4 border-t border-gray-100 pt-4">
                            {loadingJourney ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="w-5 h-5 animate-spin text-green-500" />
                              </div>
                            ) : visitorJourney ? (
                              <div className="space-y-6">
                                {/* Profile Summary Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">First Visit</p>
                                    <p className="text-sm font-medium">{formatTimestamp(visitorJourney.profile?.first_seen)}</p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">Last Seen</p>
                                    <p className="text-sm font-medium">{formatTimestamp(visitorJourney.profile?.last_seen)}</p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">Total Visits</p>
                                    <p className="text-sm font-medium">{visitorJourney.profile?.total_visits || 1}</p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">Device</p>
                                    <p className="text-sm font-medium flex items-center gap-1">
                                      <DeviceIcon className="w-4 h-4" />
                                      {device.type} ({visitorJourney.profile?.screen_size || '-'})
                                    </p>
                                  </div>
                                </div>

                                {/* Customer Info Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {/* Phone */}
                                  <div className={`rounded-lg p-4 border ${
                                    visitorJourney.profile?.phone 
                                      ? 'bg-purple-50 border-purple-200' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> Mobile Number
                                    </p>
                                    <p className={`text-lg font-bold ${
                                      visitorJourney.profile?.phone ? 'text-purple-800' : 'text-gray-400'
                                    }`}>
                                      {visitorJourney.profile?.phone || 'Not provided'}
                                    </p>
                                  </div>
                                  
                                  {/* Name */}
                                  <div className={`rounded-lg p-4 border ${
                                    visitorJourney.profile?.name 
                                      ? 'bg-blue-50 border-blue-200' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                      <User className="w-3 h-3" /> Customer Name
                                    </p>
                                    <p className={`text-lg font-bold ${
                                      visitorJourney.profile?.name ? 'text-blue-800' : 'text-gray-400'
                                    }`}>
                                      {visitorJourney.profile?.name || 'Not provided'}
                                    </p>
                                  </div>
                                  
                                  {/* Location */}
                                  <div className={`rounded-lg p-4 border ${
                                    visitorJourney.profile?.location_place?.state 
                                      ? 'bg-green-50 border-green-200' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> Location
                                    </p>
                                    <p className={`text-lg font-bold ${
                                      visitorJourney.profile?.location_place?.state ? 'text-green-800' : 'text-gray-400'
                                    }`}>
                                      {visitorJourney.profile?.location_place?.city && `${visitorJourney.profile.location_place.city}, `}
                                      {visitorJourney.profile?.location_place?.state || 'Unknown'}
                                    </p>
                                    {visitorJourney.profile?.location_place?.pincode && (
                                      <p className="text-xs text-green-600">PIN: {visitorJourney.profile.location_place.pincode}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Journey Status */}
                                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4">
                                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Journey Progress</h4>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {[
                                      { label: 'Homepage', done: true },
                                      { label: 'Product', done: visitorJourney.page_visits?.some(p => p.page?.toLowerCase().includes('product')) },
                                      { label: 'Checkout', done: visitorJourney.profile?.reached_checkout },
                                      { label: 'Address', done: visitorJourney.profile?.address_entered },
                                      { label: 'Payment', done: visitorJourney.actions?.some(a => a.action?.toLowerCase().includes('razorpay') || a.action?.toLowerCase().includes('payment')) },
                                    ].map((step, i) => (
                                      <React.Fragment key={step.label}>
                                        <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                          step.done 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-gray-100 text-gray-400'
                                        }`}>
                                          {step.done && <CheckCircle className="w-3 h-3 inline mr-1" />}
                                          {step.label}
                                        </div>
                                        {i < 4 && <ArrowRight className="w-4 h-4 text-gray-300" />}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  
                                  {/* Exit Point */}
                                  {visitorJourney.profile?.last_page && (
                                    <div className="mt-3 flex items-center gap-2 text-sm">
                                      <LogOut className="w-4 h-4 text-red-500" />
                                      <span className="text-gray-600">Exited from:</span>
                                      <span className="font-medium text-red-600">{visitorJourney.profile.last_page}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Time by Page */}
                                {visitorJourney.time_by_page && Object.keys(visitorJourney.time_by_page).length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-cyan-500" />
                                      Time Spent by Page
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {Object.entries(visitorJourney.time_by_page).map(([page, time]) => (
                                        <div key={page} className="flex items-center gap-2 bg-cyan-50 px-3 py-2 rounded-lg border border-cyan-100">
                                          {getPageIcon(page)}
                                          <div>
                                            <p className="text-xs text-gray-600">{page}</p>
                                            <p className="text-sm font-bold text-cyan-700">{formatTime(time)}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Actions Timeline */}
                                {visitorJourney.actions?.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                      <Activity className="w-4 h-4 text-purple-500" />
                                      Actions Taken ({visitorJourney.actions.length})
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                      {visitorJourney.actions.slice().reverse().slice(0, 20).map((action, i) => (
                                        <div key={action.timestamp || `action-${i}`} className="flex items-start gap-3 p-2 bg-purple-50 rounded-lg border border-purple-100">
                                          <div className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-purple-700">
                                            {getActionIcon(action.action)}
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-800">{action.action}</p>
                                            {action.details && Object.keys(action.details).length > 0 && (
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                {JSON.stringify(action.details).substring(0, 80)}...
                                              </p>
                                            )}
                                          </div>
                                          <span className="text-xs text-gray-400">{formatTimestamp(action.timestamp)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Page Visits Timeline */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-blue-500" />
                                    Page Visits ({visitorJourney.page_visits?.length || 0})
                                  </h4>
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {visitorJourney.page_visits?.slice().reverse().slice(0, 15).map((visit, i) => (
                                      <div key={visit.timestamp || `visit-${i}`} className="flex items-center gap-3">
                                        <div className="w-8 text-center">
                                          {getPageIcon(visit.page)}
                                        </div>
                                        <div className="flex-1 bg-gray-50 rounded-lg p-2 flex items-center justify-between">
                                          <span className="text-sm font-medium text-gray-900">{visit.page}</span>
                                          <span className="text-xs text-gray-500">{formatTimestamp(visit.timestamp)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm text-center py-4">No journey data available</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-10 h-10 rounded-lg text-sm font-medium ${
                              currentPage === pageNum
                                ? 'bg-green-500 text-white'
                                : 'border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No visitors found for this period</p>
                <p className="text-sm text-gray-400 mt-1">Try selecting a different date range</p>
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* Suggestions */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                AI-Powered Suggestions
              </h3>
              <div className="space-y-3">
                {funnelData?.dropOffPoints?.[0]?.stage?.includes('Product → Checkout') && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="font-medium text-yellow-800 mb-1">High drop-off at Checkout</p>
                    <p className="text-sm text-yellow-700">
                      {funnelData.dropOffPoints[0].percentage}% of users leave at checkout. Consider adding trust badges, clearer pricing, or a progress indicator.
                    </p>
                  </div>
                )}
                {funnelData?.dropOffPoints?.[0]?.stage?.includes('Homepage → Product') && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-medium text-blue-800 mb-1">Users not viewing product</p>
                    <p className="text-sm text-blue-700">
                      {funnelData.dropOffPoints[0].percentage}% leave without viewing the product. Improve homepage CTA visibility and product showcase.
                    </p>
                  </div>
                )}
                {funnelData?.claimedDiscount > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-medium text-green-800 mb-1">Discount strategy working</p>
                    <p className="text-sm text-green-700">
                      {funnelData.claimedDiscount} users claimed discounts. This shows price sensitivity - consider A/B testing discount amounts.
                    </p>
                  </div>
                )}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="font-medium text-purple-800 mb-1">Meta Pixel Tracking Active</p>
                  <p className="text-sm text-purple-700">
                    ViewContent, InitiateCheckout, and Purchase events are configured. Check Meta Events Manager for detailed attribution data.
                  </p>
                </div>
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-500" />
                Device Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {(() => {
                  const mobile = visitors.filter(v => {
                    const w = parseInt((v.profile?.screen_size || v.screen_size || '0').split('x')[0]);
                    return w > 0 && w < 768;
                  }).length;
                  const tablet = visitors.filter(v => {
                    const w = parseInt((v.profile?.screen_size || v.screen_size || '0').split('x')[0]);
                    return w >= 768 && w < 1024;
                  }).length;
                  const desktop = visitors.filter(v => {
                    const w = parseInt((v.profile?.screen_size || v.screen_size || '0').split('x')[0]);
                    return w >= 1024;
                  }).length;
                  const total = visitors.length || 1;
                  
                  return [
                    { label: 'Mobile', count: mobile, icon: Smartphone, color: 'bg-green-100 text-green-700' },
                    { label: 'Tablet', count: tablet, icon: Tablet, color: 'bg-blue-100 text-blue-700' },
                    { label: 'Desktop', count: desktop, icon: Monitor, color: 'bg-purple-100 text-purple-700' },
                  ].map(d => (
                    <div key={d.label} className={`p-4 rounded-xl ${d.color}`}>
                      <d.icon className="w-8 h-8 mb-2 opacity-70" />
                      <p className="text-2xl font-bold">{d.count}</p>
                      <p className="text-sm">{d.label} ({Math.round((d.count / total) * 100)}%)</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUserJourney;
