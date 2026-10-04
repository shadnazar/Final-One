/**
 * AdminLandingPages.js
 * Admin panel for managing problem-specific landing pages
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ChevronLeft, Plus, Eye, Copy, Edit, Trash2, Check, X,
  BarChart3, ExternalLink, Loader2, Search, Filter, RefreshCw,
  Globe, TrendingUp, Zap, ChevronDown, ChevronUp, Link2
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const APP_DOMAIN = 'https://celestaglow.com';

// Category colors
const CATEGORY_COLORS = {
  early_aging: 'bg-purple-100 text-purple-700 border-purple-200',
  wrinkles: 'bg-red-100 text-red-700 border-red-200',
  under_eye: 'bg-blue-100 text-blue-700 border-blue-200',
  dry_skin: 'bg-amber-100 text-amber-700 border-amber-200',
  lifestyle: 'bg-green-100 text-green-700 border-green-200',
  preventive: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  results: 'bg-orange-100 text-orange-700 border-orange-200',
  psychological: 'bg-pink-100 text-pink-700 border-pink-700',
};

const CATEGORY_NAMES = {
  early_aging: 'Early Aging',
  wrinkles: 'Wrinkles',
  under_eye: 'Under-Eye / Tired',
  dry_skin: 'Dry / Dull Skin',
  lifestyle: 'Lifestyle Aging',
  preventive: 'Preventive',
  results: 'Results-Driven',
  psychological: 'Psychological',
};

function AdminLandingPages() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  
  const [landingPages, setLandingPages] = useState([]);
  const [predefinedProblems, setPredefinedProblems] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTopic, setCustomTopic] = useState({ title: '', slug: '', category: 'early_aging' });

  const fetchData = useCallback(async () => {
    if (!adminToken) return;
    
    setLoading(true);
    try {
      const headers = { 'X-Admin-Token': adminToken };
      
      const [pagesRes, predefinedRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/landing-pages/admin/all?include_inactive=true`, { headers }),
        axios.get(`${API}/landing-pages/admin/predefined`, { headers }),
        axios.get(`${API}/landing-pages/admin/analytics`, { headers })
      ]);
      
      setLandingPages(pagesRes.data);
      setPredefinedProblems(predefinedRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      if (err.response?.status === 403 || err.response?.status === 401) {
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  }, [adminToken, navigate]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [fetchData, authLoading, isAuthenticated]);

  const handleBulkCreate = async (categories = null) => {
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/landing-pages/admin/bulk-create`,
        categories,
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      alert(`Created ${res.data.created} landing pages!\nSkipped ${res.data.skipped} (already exist)`);
      fetchData();
    } catch (err) {
      alert('Failed to create landing pages: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateSelected = async () => {
    if (selectedProblems.length === 0) {
      alert('Please select at least one problem');
      return;
    }
    
    setGenerating(true);
    try {
      for (const problem of selectedProblems) {
        await axios.post(
          `${API}/landing-pages/admin/create`,
          {
            problem_title: problem.title,
            problem_slug: problem.slug,
            category: problem.category,
            is_active: true
          },
          { headers: { 'X-Admin-Token': adminToken } }
        );
      }
      
      alert(`Created ${selectedProblems.length} landing pages!`);
      setSelectedProblems([]);
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to create: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!customTopic.title || !customTopic.slug) {
      alert('Please enter both title and slug');
      return;
    }
    
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(customTopic.slug)) {
      alert('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }
    
    setGenerating(true);
    try {
      await axios.post(
        `${API}/landing-pages/admin/create`,
        {
          problem_title: customTopic.title,
          problem_slug: customTopic.slug,
          category: customTopic.category,
          is_active: true
        },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      alert(`Custom landing page created successfully!\nURL: ${APP_DOMAIN}/${customTopic.slug}`);
      setCustomTopic({ title: '', slug: '', category: 'early_aging' });
      setShowCustomModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to create: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate slug from title
  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  };

  const handleToggle = async (pageId, currentStatus) => {
    try {
      await axios.post(
        `${API}/landing-pages/admin/${pageId}/toggle`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      fetchData();
    } catch (err) {
      alert('Failed to toggle: ' + err.message);
    }
  };

  const handleDelete = async (pageId) => {
    if (!window.confirm('Are you sure you want to delete this landing page?')) return;
    
    try {
      await axios.delete(
        `${API}/landing-pages/admin/${pageId}`,
        { headers: { 'X-Admin-Token': adminToken } }
      );
      fetchData();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const copyLink = (slug) => {
    const link = `${APP_DOMAIN}/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(slug);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getPageLink = (slug) => `${APP_DOMAIN}/${slug}`;

  // Filter pages
  const filteredPages = landingPages.filter(page => {
    const matchesSearch = page.problem_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         page.problem_slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || page.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const pagesByCategory = filteredPages.reduce((acc, page) => {
    if (!acc[page.category]) acc[page.category] = [];
    acc[page.category].push(page);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Globe className="text-purple-500" size={24} />
                Landing Pages
              </h1>
              <p className="text-sm text-gray-500">{landingPages.length} pages created</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600"
            >
              <Plus size={18} /> Custom Topic
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600"
            >
              <Plus size={18} /> From Presets
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* Analytics Summary */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.total_pages}</p>
                  <p className="text-sm text-gray-500">Total Pages</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(analytics.by_category).reduce((sum, c) => sum + c.views, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Total Views</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(analytics.by_category).reduce((sum, c) => sum + c.conversions, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Conversions</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {(() => {
                      const totalViews = Object.values(analytics.by_category).reduce((sum, c) => sum + c.views, 0);
                      const totalConv = Object.values(analytics.by_category).reduce((sum, c) => sum + c.conversions, 0);
                      return totalViews > 0 ? ((totalConv / totalViews) * 100).toFixed(1) : '0';
                    })()}%
                  </p>
                  <p className="text-sm text-gray-500">Conv. Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Quick Generate</h2>
              <p className="text-purple-100 text-sm">Create all 32 problem-specific landing pages at once</p>
            </div>
            <button
              onClick={() => handleBulkCreate()}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-purple-50 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={20} />
                  Generate All 32 Pages
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </div>

        {/* Pages by Category */}
        {Object.keys(pagesByCategory).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Landing Pages Yet</h3>
            <p className="text-gray-500 mb-6">Create problem-specific landing pages to boost conversions</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600"
            >
              Create Your First Page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(pagesByCategory).map(([category, pages]) => (
              <div key={category} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[category]}`}>
                      {CATEGORY_NAMES[category]}
                    </span>
                    <span className="text-gray-500 text-sm">{pages.length} pages</span>
                  </div>
                  {expandedCategory === category ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedCategory === category && (
                  <div className="border-t border-gray-100">
                    {pages.map((page) => (
                      <div 
                        key={page.id} 
                        className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{page.problem_title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Link2 size={12} />
                                /{page.problem_slug}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${page.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {page.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye size={14} /> {page.views || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp size={14} /> {page.conversions || 0}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyLink(page.problem_slug)}
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                              title="Copy Link"
                            >
                              {copiedLink === page.problem_slug ? (
                                <Check size={18} className="text-green-500" />
                              ) : (
                                <Copy size={18} />
                              )}
                            </button>
                            <a
                              href={getPageLink(page.problem_slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                              title="Preview"
                            >
                              <ExternalLink size={18} />
                            </a>
                            <button
                              onClick={() => handleToggle(page.id, page.is_active)}
                              className={`p-2 rounded-lg ${page.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                              title={page.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {page.is_active ? <Check size={18} /> : <X size={18} />}
                            </button>
                            <button
                              onClick={() => handleDelete(page.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && predefinedProblems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Create Landing Pages</h3>
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedProblems([]); }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {Object.entries(predefinedProblems.problems).map(([category, problems]) => {
                const existingSlugs = landingPages.map(p => p.problem_slug);
                const availableProblems = problems.filter(p => !existingSlugs.includes(p.slug));
                
                if (availableProblems.length === 0) return null;
                
                return (
                  <div key={category} className="mb-6">
                    <h4 className={`text-sm font-semibold mb-3 px-3 py-1 rounded-lg inline-block ${CATEGORY_COLORS[category]}`}>
                      {CATEGORY_NAMES[category]} ({availableProblems.length} available)
                    </h4>
                    <div className="space-y-2">
                      {availableProblems.map((problem) => {
                        const isSelected = selectedProblems.some(p => p.slug === problem.slug);
                        return (
                          <label
                            key={problem.slug}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 hover:bg-gray-100'
                            } border`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProblems([...selectedProblems, { ...problem, category }]);
                                } else {
                                  setSelectedProblems(selectedProblems.filter(p => p.slug !== problem.slug));
                                }
                              }}
                              className="w-5 h-5 rounded text-purple-500"
                            />
                            <span className="flex-1 text-sm text-gray-700">{problem.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {selectedProblems.length} selected
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowCreateModal(false); setSelectedProblems([]); }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSelected}
                    disabled={generating || selectedProblems.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Create {selectedProblems.length} Pages
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Topic Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="text-green-500" size={24} />
                Create Custom Landing Page
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your own topic to generate a unique landing page
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic / Problem Title *
                </label>
                <input
                  type="text"
                  value={customTopic.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setCustomTopic({
                      ...customTopic,
                      title,
                      slug: generateSlug(title)
                    });
                  }}
                  placeholder="e.g., How to reduce forehead wrinkles naturally"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug *
                </label>
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm mr-2">celestaglow.com/</span>
                  <input
                    type="text"
                    value={customTopic.slug}
                    onChange={(e) => setCustomTopic({ ...customTopic, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="forehead-wrinkles"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={customTopic.category}
                  onChange={(e) => setCustomTopic({ ...customTopic, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Category determines product name styling and content focus</p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowCustomModal(false); setCustomTopic({ title: '', slug: '', category: 'early_aging' }); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustom}
                  disabled={generating || !customTopic.title || !customTopic.slug}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Create Page
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLandingPages;
