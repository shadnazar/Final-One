import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Globe, Search, RefreshCw, Eye, ExternalLink, Calendar, Tag, ChevronLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function EmployeeLandingPages() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const employeeToken = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');

  const fetchPages = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/landing-pages/admin/all`, {
        headers: { 'X-Employee-Token': employeeToken }
      });
      setPages(res.data.pages || res.data || []);
    } catch (err) {
      console.error('Failed to fetch landing pages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const categories = [...new Set(pages.map(p => p.category).filter(Boolean))];

  const filteredPages = pages.filter(page => {
    const matchesSearch = !searchQuery || 
      page.problem_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.slug?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || page.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
          <h1 className="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-500 text-sm">{pages.length} SEO pages created</p>
        </div>
        <button
          onClick={fetchPages}
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
            placeholder="Search by title or slug..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No landing pages found
          </div>
        ) : (
          filteredPages.map((page) => (
            <div key={page.slug} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <a 
                  href={`/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                {page.problem_title || page.slug}
              </h3>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {page.category && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                    <Tag size={10} />
                    {page.category}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-mono text-gray-500">/{page.slug}</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(page.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmployeeLandingPages;
