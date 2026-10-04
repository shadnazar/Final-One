import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  MapPin, Plus, Edit, Trash2, Eye, Search,
  ChevronLeft, Globe
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();
  const adminToken = getAdminToken();

  useEffect(() => {
    if (!adminToken) return;
    fetchLocations();
  }, [adminToken]);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API}/admin/locations`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setLocations(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (locationId) => {
    try {
      await axios.delete(`${API}/admin/locations/${locationId}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setLocations(locations.filter(l => l.id !== locationId));
      setDeleteConfirm(null);
    } catch (err) {
      alert('Failed to delete location');
    }
  };

  const filteredLocations = locations.filter(location => {
    const searchLower = searchTerm.toLowerCase();
    return (
      location.state?.toLowerCase().includes(searchLower) ||
      location.city?.toLowerCase().includes(searchLower) ||
      location.content?.title?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="lg:hidden text-gray-600">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Location Pages</h1>
              <p className="text-sm text-gray-500 hidden lg:block">
                Manage geo-targeted landing pages
              </p>
            </div>
          </div>
          <Link
            to="/admin/locations/new"
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
            data-testid="create-location-btn"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Location</span>
          </Link>
        </div>
      </header>

      <div className="p-4 lg:p-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by state or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{locations.length}</p>
            <p className="text-sm text-gray-500">Total Locations</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">
              {new Set(locations.map(l => l.state)).size}
            </p>
            <p className="text-sm text-gray-500">States Covered</p>
          </div>
        </div>

        {/* Location List */}
        {filteredLocations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No location pages found</h3>
            <p className="text-gray-500 mb-6">Create geo-targeted pages to improve local SEO</p>
            <Link
              to="/admin/locations/new"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              <Plus size={18} />
              Create Location Page
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocations.map((location) => (
              <div 
                key={location.id} 
                className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
                data-testid={`location-item-${location.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/locations/edit/${location.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-btn-${location.id}`}
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(location.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`delete-btn-${location.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-1">
                  {location.city ? `${location.city}, ${location.state}` : location.state}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                  {location.content?.description || 'No description'}
                </p>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Eye size={14} />
                    {location.view_count || 0} views
                  </span>
                  <a
                    href={location.city 
                      ? `/${location.state.toLowerCase()}/${location.city.toLowerCase()}`
                      : `/${location.state.toLowerCase()}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:underline flex items-center gap-1"
                  >
                    <Globe size={14} />
                    View Page
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Location Page?</h3>
            <p className="text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600"
                data-testid="confirm-delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around py-2">
          <Link to="/admin/dashboard" className="flex flex-col items-center p-2 text-gray-500">
            <MapPin size={20} />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link to="/admin/blogs" className="flex flex-col items-center p-2 text-gray-500">
            <MapPin size={20} />
            <span className="text-xs mt-1">Blogs</span>
          </Link>
          <Link to="/admin/locations" className="flex flex-col items-center p-2 text-green-600">
            <MapPin size={20} />
            <span className="text-xs mt-1">Locations</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default AdminLocations;
