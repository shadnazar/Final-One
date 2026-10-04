import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Stethoscope, Search, RefreshCw, Eye, Calendar, User, Phone, Mail,
  ChevronRight, CheckCircle, Clock, Image, ChevronLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function EmployeeConsultations() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  const employeeToken = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/consultations`, {
        headers: { 'X-Employee-Token': employeeToken }
      });
      setConsultations(res.data.consultations || res.data || []);
    } catch (err) {
      console.error('Failed to fetch consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const filteredConsultations = consultations.filter(c => {
    const matchesSearch = !searchQuery || 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'reviewed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Skin Consultations</h1>
          <p className="text-gray-500 text-sm">{consultations.length} total consultations</p>
        </div>
        <button
          onClick={fetchConsultations}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Consultations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Concerns</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredConsultations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No consultations found
                  </td>
                </tr>
              ) : (
                filteredConsultations.map((consultation, idx) => (
                  <tr key={consultation._id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{consultation.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{consultation.age} yrs, {consultation.gender}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="flex items-center gap-1 text-gray-900">
                          <Phone size={12} />
                          {consultation.phone}
                        </p>
                        {consultation.email && (
                          <p className="flex items-center gap-1 text-gray-500 text-xs">
                            <Mail size={12} />
                            {consultation.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(consultation.skin_concerns || []).slice(0, 2).map((concern, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {concern}
                          </span>
                        ))}
                        {(consultation.skin_concerns || []).length > 2 && (
                          <span className="text-xs text-gray-400">+{consultation.skin_concerns.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(consultation.status)}`}>
                        {consultation.status === 'completed' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {consultation.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(consultation.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedConsultation(consultation)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye size={18} className="text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consultation Detail Modal */}
      {selectedConsultation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Stethoscope className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedConsultation.name}</h2>
                    <p className="text-sm text-gray-500">{selectedConsultation.age} years, {selectedConsultation.gender}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedConsultation(null)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="font-medium">{selectedConsultation.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-medium">{selectedConsultation.email || 'N/A'}</p>
                </div>
              </div>

              {/* Skin Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">Skin Profile</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-gray-400">Type</p>
                    <p className="font-medium">{selectedConsultation.skin_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Sensitivity</p>
                    <p className="font-medium">{selectedConsultation.sensitivity || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Goal</p>
                    <p className="font-medium">{selectedConsultation.primary_goal || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Concerns */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Skin Concerns</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedConsultation.skin_concerns || []).map((concern, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {concern}
                    </span>
                  ))}
                </div>
              </div>

              {/* Face Images */}
              {selectedConsultation.face_images?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Face Images</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedConsultation.face_images.map((img, i) => (
                      <img 
                        key={i}
                        src={img}
                        alt={`Face ${i + 1}`}
                        className="w-full h-32 object-cover rounded-xl border border-gray-200"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendation */}
              {selectedConsultation.ai_recommendation && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-sm font-semibold text-green-800 mb-2">AI Recommendation</p>
                  <p className="text-sm text-green-700 whitespace-pre-line">{selectedConsultation.ai_recommendation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeConsultations;
