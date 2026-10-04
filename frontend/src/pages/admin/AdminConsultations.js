import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Users, TrendingUp, Download, Phone, MapPin, 
  Clock, ChevronDown, ChevronUp, Eye, FileText, AlertCircle,
  BarChart3, Target, Zap
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminConsultations() {
  const [consultations, setConsultations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // list, stats
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetchData();
  }, [authLoading, isAuthenticated]);

  const fetchData = async () => {
    if (!adminToken) return;

    try {
      const [consultRes, statsRes] = await Promise.all([
        axios.get(`${API}/consultation/admin/all`, {
          headers: { 'X-Admin-Token': adminToken }
        }),
        axios.get(`${API}/consultation/admin/stats`, {
          headers: { 'X-Admin-Token': adminToken }
        })
      ]);

      setConsultations(consultRes.data.consultations || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch consultation data');
      if (err.response?.status === 403 || err.response?.status === 401) {
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAgingLevelColor = (level) => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      moderate: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700'
    };
    return colors[level] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/admin" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Consultations</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'list'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            All Data
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'stats'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            Analytics
          </button>
        </div>
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div className="p-4 space-y-4">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.consultation_stats?.total_consultations || 0}
              </p>
              <p className="text-xs text-gray-500">Consultations</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Download className="w-5 h-5" />
                <span className="text-sm font-medium">Downloads</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.consultation_stats?.pdf_downloads || 0}
              </p>
              <p className="text-xs text-gray-500">PDF Reports</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-sm font-medium">Completion</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.funnel_stats?.completion_rate || 0}%
              </p>
              <p className="text-xs text-gray-500">Rate</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Zap className="w-5 h-5" />
                <span className="text-sm font-medium">Started</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.funnel_stats?.started || 0}
              </p>
              <p className="text-xs text-gray-500">Sessions</p>
            </div>
          </div>

          {/* Aging Level Distribution */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Aging Level Distribution</h3>
            <div className="space-y-3">
              {['high', 'moderate', 'low'].map((level) => {
                const count = stats.consultation_stats?.by_aging_level?.[level] || 0;
                const total = stats.consultation_stats?.total_consultations || 1;
                const percent = Math.round((count / total) * 100);
                
                return (
                  <div key={level}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-600">{level}</span>
                      <span className="font-medium">{count} ({percent}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          level === 'high' ? 'bg-red-500' :
                          level === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Funnel Stats */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Funnel Analysis</h3>
            <div className="space-y-2">
              {[
                { label: 'Started', value: stats.funnel_stats?.started || 0 },
                { label: 'Completed', value: stats.funnel_stats?.completed || 0 },
                { label: 'PDF Downloads', value: stats.funnel_stats?.pdf_downloads || 0 },
              ].map((item, i) => (
                <div key={`consult-stat-${item.label}`} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
              <div className="pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Drop-off Rate</span>
                  <span className="font-semibold text-red-600">
                    {stats.funnel_stats?.drop_off_rate || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="p-4">
          {consultations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No consultations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Card Header */}
                  <button
                    onClick={() => setExpandedId(expandedId === consultation.id ? null : consultation.id)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center relative">
                        <Phone className="w-5 h-5 text-green-600" />
                        {consultation.face_images?.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                            <Eye className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">+91 {consultation.phone}</p>
                        <p className="text-xs text-gray-500">{formatDate(consultation.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgingLevelColor(consultation.result?.aging_level)}`}>
                        {consultation.result?.aging_level?.toUpperCase()}
                      </span>
                      {expandedId === consultation.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedId === consultation.id && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {/* Location & Language */}
                      <div className="flex gap-4 py-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-4 h-4" />
                          {consultation.location?.state || 'India'}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <span className="uppercase">{consultation.language}</span>
                        </div>
                        {consultation.pdf_downloaded && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Download className="w-4 h-4" />
                            PDF Downloaded
                          </div>
                        )}
                      </div>

                      {/* Answers */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <h4 className="font-medium text-gray-900 text-sm mb-2">Answers</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Age:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.age_group}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Skin:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.skin_type}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Concerns:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.concerns?.join(', ')}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Sun:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.sun_exposure}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Sunscreen:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.sunscreen_usage}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Lifestyle:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.lifestyle}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Skincare:</span>{' '}
                            <span className="text-gray-900">{consultation.answers?.skincare_usage}</span>
                          </div>
                        </div>
                      </div>

                      {/* Causes */}
                      <div className="bg-orange-50 rounded-lg p-3 mb-3">
                        <h4 className="font-medium text-orange-800 text-sm mb-2">Identified Causes</h4>
                        <ul className="text-xs text-orange-700 space-y-1">
                          {consultation.result?.causes?.map((cause, i) => (
                            <li key={`cause-${i}`}>• {cause}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Face Images */}
                      {consultation.face_images?.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-3 mb-3">
                          <h4 className="font-medium text-purple-800 text-sm mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Uploaded Photos ({consultation.face_images.length})
                          </h4>
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {consultation.face_images.map((img, i) => (
                              <div key={`photo-${consultation.id}-${i}`} className="flex-shrink-0 text-center">
                                <img
                                  src={img}
                                  alt={`Face ${i + 1}`}
                                  className="w-24 h-24 object-cover rounded-xl border-2 border-purple-200 shadow-sm"
                                  data-testid={`admin-photo-${consultation.id}-${i}`}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                                  }}
                                />
                                <p className="text-xs text-purple-600 mt-1 font-medium">
                                  {i === 0 ? 'Front' : i === 1 ? 'Left' : 'Right'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Product Usage */}
                      <div className="bg-green-50 rounded-lg p-3">
                        <h4 className="font-medium text-green-800 text-sm mb-2">Personalized Recommendation</h4>
                        <p className="text-xs text-green-700">{consultation.result?.product_usage}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminConsultations;
