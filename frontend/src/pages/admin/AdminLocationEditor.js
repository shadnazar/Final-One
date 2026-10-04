import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  ChevronLeft, Save, MapPin, X, Plus
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Indian states for dropdown
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh'
];

function AdminLocationEditor() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const adminToken = getAdminToken();

  const [formData, setFormData] = useState({
    state: '',
    city: '',
    title: '',
    description: '',
    climate: '',
    skin_issues: [],
    recommendations: ''
  });
  const [issueInput, setIssueInput] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin');
      return;
    }

    if (isEditing) {
      fetchLocation();
    }
  }, [adminToken, navigate, isEditing, id]);

  const fetchLocation = async () => {
    try {
      const res = await axios.get(`${API}/admin/locations`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      const location = res.data.find(l => l.id === id);
      if (location) {
        setFormData({
          state: location.state || '',
          city: location.city || '',
          title: location.content?.title || '',
          description: location.content?.description || '',
          climate: location.content?.climate || '',
          skin_issues: location.content?.skin_issues || [],
          recommendations: location.content?.recommendations || ''
        });
      } else {
        navigate('/admin/locations');
      }
    } catch (err) {
      navigate('/admin/locations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (isEditing) {
        await axios.put(`${API}/admin/locations/${id}`, {
          title: formData.title,
          description: formData.description,
          climate: formData.climate,
          skin_issues: formData.skin_issues,
          recommendations: formData.recommendations
        }, {
          headers: { 'X-Admin-Token': adminToken }
        });
      } else {
        await axios.post(`${API}/admin/locations`, formData, {
          headers: { 'X-Admin-Token': adminToken }
        });
      }
      navigate('/admin/locations');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const addSkinIssue = () => {
    if (issueInput.trim() && !formData.skin_issues.includes(issueInput.trim())) {
      setFormData({
        ...formData,
        skin_issues: [...formData.skin_issues, issueInput.trim()]
      });
      setIssueInput('');
    }
  };

  const removeSkinIssue = (issue) => {
    setFormData({
      ...formData,
      skin_issues: formData.skin_issues.filter(i => i !== issue)
    });
  };

  // Auto-generate title when state/city changes
  useEffect(() => {
    if (!isEditing && (formData.state || formData.city)) {
      const location = formData.city 
        ? `${formData.city}, ${formData.state}`
        : formData.state;
      setFormData(prev => ({
        ...prev,
        title: `Anti-Aging Skincare in ${location}`,
        description: `Get Celesta Glow anti-aging products delivered to ${location}. Free shipping and Cash on Delivery available.`
      }));
    }
  }, [formData.state, formData.city, isEditing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/locations" className="text-gray-600">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Edit Location Page' : 'New Location Page'}
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
            data-testid="save-btn"
          >
            <Save size={18} />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 lg:p-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={18} />
              Location Details
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                  required
                  disabled={isEditing}
                  data-testid="state-select"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City (Optional)
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="e.g., Mumbai, Bangalore"
                  disabled={isEditing}
                  data-testid="city-input"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Page Content</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="Anti-Aging Skincare in Mumbai"
                  required
                  data-testid="title-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-h-[120px]"
                  placeholder="Describe the page content..."
                  required
                  data-testid="description-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Climate Info
                </label>
                <input
                  type="text"
                  value={formData.climate}
                  onChange={(e) => setFormData({ ...formData, climate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="e.g., Humid tropical climate"
                  data-testid="climate-input"
                />
              </div>
            </div>
          </div>

          {/* Skin Issues */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Common Skin Issues</h3>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={issueInput}
                onChange={(e) => setIssueInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkinIssue())}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="Add skin issue..."
                data-testid="issue-input"
              />
              <button
                type="button"
                onClick={addSkinIssue}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {formData.skin_issues.map((issue) => (
                <span
                  key={issue}
                  className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                >
                  {issue}
                  <button
                    type="button"
                    onClick={() => removeSkinIssue(issue)}
                    className="ml-1 text-orange-600 hover:text-orange-800"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              {formData.skin_issues.length === 0 && (
                <p className="text-gray-400 text-sm">No skin issues added</p>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
            
            <textarea
              value={formData.recommendations}
              onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-h-[100px]"
              placeholder="Skincare recommendations for this location..."
              data-testid="recommendations-input"
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminLocationEditor;
