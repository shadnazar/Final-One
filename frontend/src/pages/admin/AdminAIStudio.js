import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { 
  ChevronLeft, Sparkles, FileText, MapPin, Lightbulb, 
  Loader2, Check, AlertCircle, Copy, Save, Zap, Clock, History, Globe, Tag,
  TrendingUp, Newspaper, Share2, Timer, RefreshCw
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminAIStudio() {
  const navigate = useNavigate();
  const adminToken = getAdminToken();
  
  const [activeMode, setActiveMode] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [generationHistory, setGenerationHistory] = useState([]);
  
  // Blog generation
  const [blogTopic, setBlogTopic] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('');
  const [blogAudience, setBlogAudience] = useState('Indian adults 28+');
  
  // Location generation
  const [locState, setLocState] = useState('');
  const [locCity, setLocCity] = useState('');
  
  // Topic suggestions
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  
  // Auto generation
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [blogCount, setBlogCount] = useState(12);
  
  // Batch location generation
  const [locationGenerating, setLocationGenerating] = useState(false);
  const [locationResult, setLocationResult] = useState(null);
  const [selectedStates, setSelectedStates] = useState([]);
  
  // Batch topic generation
  const [topicGenerating, setTopicGenerating] = useState(false);
  const [topicResult, setTopicResult] = useState(null);
  const [customTopics, setCustomTopics] = useState('');
  const [loadingTopics, setLoadingTopics] = useState(false);
  
  // Cron status and timer
  const [cronStatus, setCronStatus] = useState(null);
  const [countdown, setCountdown] = useState('');
  
  // Trending news
  const [trendingNews, setTrendingNews] = useState([]);
  const [trendingGenerating, setTrendingGenerating] = useState(false);
  const [trendingResult, setTrendingResult] = useState(null);
  const [trendingStats, setTrendingStats] = useState(null);

  const fetchCronStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/cron/status`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setCronStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch cron status');
    }
  }, [adminToken]);

  const fetchTrendingStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/ai/trending-stats`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setTrendingStats(res.data);
    } catch (err) {
      console.error('Failed to fetch trending stats');
    }
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) return;
    
    fetchGenerationHistory();
    fetchCronStatus();
    fetchTrendingStats();
    
    // Update countdown every second
    const timer = setInterval(() => {
      if (cronStatus?.time_until_next_seconds > 0) {
        const secs = cronStatus.time_until_next_seconds - Math.floor((Date.now() - cronStatus._fetchedAt) / 1000);
        if (secs > 0) {
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = secs % 60;
          setCountdown(`${h}h ${m}m ${s}s`);
        } else {
          setCountdown('Generating...');
          fetchCronStatus(); // Refresh status
        }
      }
    }, 1000);
    
    // Store fetch time
    if (cronStatus) {
      cronStatus._fetchedAt = Date.now();
    }
    
    return () => clearInterval(timer);
  }, [adminToken, navigate, cronStatus, fetchCronStatus, fetchTrendingStats]);

  const fetchGenerationHistory = async () => {
    try {
      const res = await axios.get(`${API}/admin/ai/generation-history`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setGenerationHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const handleAutoGenerateBlogs = async () => {
    setAutoGenerating(true);
    setError('');
    setAutoResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/auto-generate-blogs`, 
        { count: blogCount },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      setAutoResult(res.data);
      fetchGenerationHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate blogs');
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleBatchLocationBlogs = async () => {
    if (selectedStates.length === 0) {
      setError('Please select at least one state');
      return;
    }
    
    setLocationGenerating(true);
    setError('');
    setLocationResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/batch-location-blogs`, 
        { states: selectedStates },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      setLocationResult(res.data);
      fetchGenerationHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate location blogs');
    } finally {
      setLocationGenerating(false);
    }
  };

  const handleBatchTopicBlogs = async () => {
    const topics = customTopics.split('\n').filter(t => t.trim());
    if (topics.length === 0) {
      setError('Please enter at least one topic');
      return;
    }
    
    setTopicGenerating(true);
    setError('');
    setTopicResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/batch-topic-blogs`, 
        { topics },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      setTopicResult(res.data);
      fetchGenerationHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate topic blogs');
    } finally {
      setTopicGenerating(false);
    }
  };

  // Load AI-generated trending topic suggestions
  const handleLoadTrendingTopics = async () => {
    setLoadingTopics(true);
    setError('');
    
    try {
      // Use format=simple to get just topic title strings
      const res = await axios.get(`${API}/admin/ai/suggest-topics?count=6&format=simple`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      if (res.data.topics && res.data.topics.length > 0) {
        // Handle both string and object topics (extract 'topic' field if object)
        const topicStrings = res.data.topics.map(t => 
          typeof t === 'string' ? t : (t.topic || t.title || String(t))
        );
        setCustomTopics(topicStrings.join('\n'));
      } else if (res.data.error) {
        setError(res.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load trending topics');
    } finally {
      setLoadingTopics(false);
    }
  };

  // Fetch trending news
  const fetchTrendingNews = async () => {
    try {
      const res = await axios.get(`${API}/admin/ai/trending-news?feed_type=celebrity_india`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setTrendingNews(res.data.news || []);
    } catch (err) {
      console.error('Failed to fetch trending news');
    }
  };

  // Generate trending blogs
  const handleGenerateTrendingBlogs = async () => {
    setTrendingGenerating(true);
    setError('');
    setTrendingResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/generate-trending-blogs?count=3`, {}, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      setTrendingResult(res.data);
      fetchGenerationHistory();
      fetchTrendingStats();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate trending blogs');
    } finally {
      setTrendingGenerating(false);
    }
  };

  const handleGenerateBlog = async () => {
    if (!blogTopic.trim()) {
      setError('Please enter a topic');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/generate-blog`, {
        topic: blogTopic,
        keywords: blogKeywords ? blogKeywords.split(',').map(k => k.trim()) : null,
        target_audience: blogAudience
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      setResult({ type: 'blog', data: res.data.article });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLocation = async () => {
    if (!locState.trim()) {
      setError('Please select a state');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const res = await axios.post(`${API}/admin/ai/generate-location`, {
        state: locState,
        city: locCity || null
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      setResult({ type: 'location', data: res.data.content });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestTopics = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.get(`${API}/admin/ai/suggest-topics?count=5`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      setSuggestedTopics(res.data.topics);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBlog = async () => {
    if (!result?.data) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/admin/blogs`, {
        title: result.data.title,
        content: result.data.content,
        meta_description: result.data.meta_description,
        keywords: result.data.keywords,
        status: 'draft',
        language: 'en'
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      navigate('/admin/blogs');
    } catch (err) {
      setError('Failed to save blog');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!result?.data) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/admin/locations`, {
        state: locState,
        city: locCity || null,
        title: result.data.title,
        description: result.data.description,
        climate: result.data.climate,
        skin_issues: result.data.skin_issues,
        recommendations: result.data.recommendations
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      navigate('/admin/locations');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const INDIAN_STATES = [
    'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 
    'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Kerala', 'Telangana',
    'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Madhya Pradesh'
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="text-gray-600">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-purple-500" size={24} />
              AI Content Studio
            </h1>
            <p className="text-sm text-gray-500">Generate SEO content with AI</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Credit Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Credit Usage Warning</p>
            <p className="text-sm text-amber-700">Each AI generation uses credits. Use sparingly for best ROI.</p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => { setActiveMode('auto'); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'auto' 
                ? 'bg-green-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-auto"
          >
            <Zap size={18} /> Auto (12 Blogs)
          </button>
          <button
            onClick={() => { setActiveMode('location-batch'); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'location-batch' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-location-batch"
          >
            <Globe size={18} /> Location Blogs
          </button>
          <button
            onClick={() => { setActiveMode('topic-batch'); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'topic-batch' 
                ? 'bg-orange-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-topic-batch"
          >
            <Tag size={18} /> Topic Blogs
          </button>
          <button
            onClick={() => { setActiveMode('blog'); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'blog' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-single"
          >
            <FileText size={18} /> Single Blog
          </button>
          <button
            onClick={() => { setActiveMode('location'); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'location' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-location"
          >
            <MapPin size={18} /> Location Page
          </button>
          <button
            onClick={() => { setActiveMode('topics'); handleSuggestTopics(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'topics' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-ideas"
          >
            <Lightbulb size={18} /> Ideas
          </button>
          <button
            onClick={() => { setActiveMode('trending'); fetchTrendingNews(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeMode === 'trending' 
                ? 'bg-pink-500 text-white' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
            data-testid="tab-trending"
          >
            <TrendingUp size={18} /> Trending
          </button>
        </div>

        {/* Auto-Generation Timer Card */}
        {cronStatus && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 mb-6 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Timer className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-indigo-100 text-sm">Next: {cronStatus.next_run_type || 'Auto-Generation'}</p>
                  <p className="text-2xl font-bold">{countdown || cronStatus.time_until_next_formatted}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-sm">{cronStatus.schedule}</p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-xl font-bold">{cronStatus.today_blogs_generated}</p>
                    <p className="text-xs text-indigo-200">Today</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{cronStatus.total_blogs}</p>
                    <p className="text-xs text-indigo-200">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{cronStatus.blogs_per_run}</p>
                    <p className="text-xs text-indigo-200">Per Run</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={fetchCronStatus}
              className="mt-3 text-sm text-indigo-200 hover:text-white flex items-center gap-1"
            >
              <RefreshCw size={14} /> Refresh Status
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Auto Generate Section */}
        {activeMode === 'auto' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Auto Blog Generator</h2>
                  <p className="text-green-100 text-sm">Generate 12 SEO-optimized beauty blogs instantly</p>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-100 mb-3">What you'll get:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check size={16} /> 12 unique, trending beauty topics
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> SEO-optimized titles & meta descriptions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Location-targeted content for Indian audience
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Auto-published to your blog
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Conversion-optimized with product mentions
                  </li>
                </ul>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm">Number of blogs:</label>
                <select
                  value={blogCount}
                  onChange={(e) => setBlogCount(parseInt(e.target.value))}
                  className="bg-white/20 border-0 rounded-lg px-3 py-2 text-white"
                >
                  <option value="6">6 blogs</option>
                  <option value="12">12 blogs</option>
                </select>
              </div>
              
              <button
                onClick={handleAutoGenerateBlogs}
                disabled={autoGenerating}
                className="w-full py-4 bg-white text-green-600 font-bold rounded-xl hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="auto-generate-btn"
              >
                {autoGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating {blogCount} blogs... (This may take a few minutes)
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    Generate {blogCount} Blogs Now
                  </>
                )}
              </button>
            </div>

            {/* Auto Generation Result */}
            {autoResult && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="text-green-500" size={24} />
                  <h3 className="font-semibold text-gray-900">
                    Generated {autoResult.generated} blogs successfully!
                  </h3>
                </div>
                
                {autoResult.failed > 0 && (
                  <p className="text-amber-600 text-sm mb-4">{autoResult.failed} blogs failed to generate</p>
                )}
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {autoResult.blogs?.map((blog) => (
                    <div key={blog.slug || blog.title} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{blog.title}</p>
                        <span className="text-xs text-gray-500">{blog.category}</span>
                      </div>
                      <Link 
                        to={`/blog/${blog.slug}`}
                        target="_blank"
                        className="text-green-500 text-sm hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
                
                <Link
                  to="/admin/blogs"
                  className="block w-full mt-4 py-3 bg-gray-900 text-white text-center rounded-xl font-medium hover:bg-gray-800"
                >
                  View All Blogs
                </Link>
              </div>
            )}

            {/* Generation History */}
            {generationHistory.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History size={18} />
                  Generation History
                </h3>
                <div className="space-y-2">
                  {generationHistory.map((log) => (
                    <div key={log.timestamp || log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-gray-600">
                          {new Date(log.timestamp).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium">{log.generated} generated</span>
                        {log.failed > 0 && <span className="text-red-500">{log.failed} failed</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location Batch Generation */}
        {activeMode === 'location-batch' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Location-Based Blogs</h2>
                  <p className="text-blue-100 text-sm">Generate blogs targeting specific Indian states</p>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-100 mb-3">Select states to generate blogs for:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INDIAN_STATES.map(state => (
                    <label key={state} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStates.includes(state)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStates([...selectedStates, state]);
                          } else {
                            setSelectedStates(selectedStates.filter(s => s !== state));
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{state}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setSelectedStates(INDIAN_STATES)}
                  className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedStates([])}
                  className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30"
                >
                  Clear All
                </button>
              </div>
              
              <button
                onClick={handleBatchLocationBlogs}
                disabled={locationGenerating || selectedStates.length === 0}
                className="w-full py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="location-batch-btn"
              >
                {locationGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating {selectedStates.length} location blogs...
                  </>
                ) : (
                  <>
                    <Globe size={20} />
                    Generate {selectedStates.length} Location Blogs
                  </>
                )}
              </button>
            </div>

            {/* Location Generation Result */}
            {locationResult && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="text-green-500" size={24} />
                  <h3 className="font-semibold text-gray-900">
                    Generated {locationResult.generated} location blogs!
                  </h3>
                </div>
                
                {locationResult.failed > 0 && (
                  <p className="text-amber-600 text-sm mb-4">{locationResult.failed} blogs failed</p>
                )}
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {locationResult.blogs?.map((blog) => (
                    <div key={blog.slug || blog.title} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{blog.title}</p>
                        <span className="text-xs text-blue-500">{blog.location_target}</span>
                      </div>
                      <Link 
                        to={`/blog/${blog.slug}`}
                        target="_blank"
                        className="text-blue-500 text-sm hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
                
                <Link
                  to="/admin/blogs"
                  className="block w-full mt-4 py-3 bg-gray-900 text-white text-center rounded-xl font-medium hover:bg-gray-800"
                >
                  View All Blogs
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Topic Batch Generation */}
        {activeMode === 'topic-batch' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Topic-Based Blogs</h2>
                  <p className="text-orange-100 text-sm">Generate blogs for specific topics you define</p>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <p className="text-sm text-orange-100 mb-3">Enter topics (one per line):</p>
                <textarea
                  value={customTopics}
                  onChange={(e) => setCustomTopics(e.target.value)}
                  className="w-full h-40 px-4 py-3 bg-white/20 border-0 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 outline-none resize-none"
                  placeholder="Best anti-aging ingredients for Indian skin&#10;How to reduce wrinkles naturally&#10;Night skincare routine for 30+&#10;Benefits of retinol serum"
                  data-testid="custom-topics-input"
                />
              </div>
              
              <div className="flex gap-3 mb-4">
                <button
                  onClick={handleLoadTrendingTopics}
                  disabled={loadingTopics}
                  className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 flex items-center gap-2"
                >
                  {loadingTopics ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Loading...
                    </>
                  ) : (
                    <>
                      <TrendingUp size={14} />
                      Load Trending Topics
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCustomTopics('')}
                  className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30"
                >
                  Clear
                </button>
              </div>
              
              <button
                onClick={handleBatchTopicBlogs}
                disabled={topicGenerating || !customTopics.trim()}
                className="w-full py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="topic-batch-btn"
              >
                {topicGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating {customTopics.split('\n').filter(t => t.trim()).length} topic blogs...
                  </>
                ) : (
                  <>
                    <Tag size={20} />
                    Generate {customTopics.split('\n').filter(t => t.trim()).length || 0} Topic Blogs
                  </>
                )}
              </button>
            </div>

            {/* Topic Generation Result */}
            {topicResult && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="text-green-500" size={24} />
                  <h3 className="font-semibold text-gray-900">
                    Generated {topicResult.generated} topic blogs!
                  </h3>
                </div>
                
                {topicResult.failed > 0 && (
                  <p className="text-amber-600 text-sm mb-4">{topicResult.failed} blogs failed</p>
                )}
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {topicResult.blogs?.map((blog) => (
                    <div key={blog.slug || blog.title} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{blog.title}</p>
                        <span className="text-xs text-orange-500">{blog.original_topic}</span>
                      </div>
                      <Link 
                        to={`/blog/${blog.slug}`}
                        target="_blank"
                        className="text-orange-500 text-sm hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
                
                <Link
                  to="/admin/blogs"
                  className="block w-full mt-4 py-3 bg-gray-900 text-white text-center rounded-xl font-medium hover:bg-gray-800"
                >
                  View All Blogs
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Trending News Blog Generator */}
        {activeMode === 'trending' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Trending News Blogs</h2>
                  <p className="text-pink-100 text-sm">Generate skincare blogs from real-time celebrity & beauty news</p>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <p className="text-sm text-pink-100 mb-3">Powered by Google News:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Real-time celebrity beauty news
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Bollywood skincare trends
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> AI connects news to skincare tips
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} /> Shareable, viral content
                  </li>
                </ul>
              </div>
              
              {/* Trending Stats */}
              {trendingStats && (
                <div className="flex items-center gap-4 mb-4 bg-white/10 rounded-xl p-3">
                  <div>
                    <p className="text-2xl font-bold">{trendingStats.total_trending_blogs}</p>
                    <p className="text-xs text-pink-200">Total Trending</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trendingStats.today_trending_blogs}</p>
                    <p className="text-xs text-pink-200">Today</p>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleGenerateTrendingBlogs}
                disabled={trendingGenerating}
                className="w-full py-3 bg-white text-pink-600 font-bold rounded-xl hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="generate-trending-btn"
              >
                {trendingGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating from News...
                  </>
                ) : (
                  <>
                    <Newspaper size={20} />
                    Generate 3 Trending Blogs
                  </>
                )}
              </button>
            </div>
            
            {/* Trending News Preview */}
            {trendingNews.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Newspaper size={18} className="text-pink-500" />
                  Current Trending News
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {trendingNews.map((news) => (
                    <div key={news.link || news.title} className="p-3 bg-gray-50 rounded-xl">
                      <p className="font-medium text-gray-900 text-sm line-clamp-2">{news.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{news.source}</span>
                        <a 
                          href={news.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-pink-500 hover:underline"
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={fetchTrendingNews}
                  className="mt-3 text-sm text-gray-500 hover:text-pink-500 flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Refresh News
                </button>
              </div>
            )}
            
            {/* Trending Generation Result */}
            {trendingResult && (
              <div className="bg-white rounded-2xl p-6 border border-green-200">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-green-800">
                    Generated {trendingResult.successful} of {trendingResult.total_attempted} trending blogs!
                  </span>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trendingResult.blogs?.map((blog) => (
                    <div key={blog.slug || blog.title} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{blog.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded">{blog.category}</span>
                          <span className="text-xs text-gray-500 truncate">{blog.news_source}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigator.share ? navigator.share({title: blog.title, url: `/blog/${blog.slug}`}) : copyToClipboard(`${window.location.origin}/blog/${blog.slug}`)}
                          className="p-2 text-gray-400 hover:text-pink-500"
                        >
                          <Share2 size={16} />
                        </button>
                        <Link 
                          to={`/blog/${blog.slug}`}
                          target="_blank"
                          className="text-pink-500 text-sm hover:underline"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                
                {trendingResult.errors?.length > 0 && (
                  <div className="mt-3 text-xs text-red-500">
                    Errors: {trendingResult.errors.slice(0, 2).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Blog Generation Form */}
        {activeMode === 'blog' && !result && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Topic *</label>
              <input
                type="text"
                value={blogTopic}
                onChange={(e) => setBlogTopic(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="e.g., Best anti-aging tips for women over 30"
                data-testid="blog-topic-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Keywords (comma-separated)</label>
              <input
                type="text"
                value={blogKeywords}
                onChange={(e) => setBlogKeywords(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="anti-aging, skincare, serum, wrinkles"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
              <input
                type="text"
                value={blogAudience}
                onChange={(e) => setBlogAudience(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="Indian adults 28+"
              />
            </div>
            <button
              onClick={handleGenerateBlog}
              disabled={loading}
              className="w-full py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="generate-blog-btn"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              {loading ? 'Generating...' : 'Generate Blog Article'}
            </button>
          </div>
        )}

        {/* Location Generation Form */}
        {activeMode === 'location' && !result && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
              <select
                value={locState}
                onChange={(e) => setLocState(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                data-testid="location-state-select"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City (Optional)</label>
              <input
                type="text"
                value={locCity}
                onChange={(e) => setLocCity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="e.g., Mumbai, Bangalore"
              />
            </div>
            <button
              onClick={handleGenerateLocation}
              disabled={loading}
              className="w-full py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="generate-location-btn"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              {loading ? 'Generating...' : 'Generate Location Content'}
            </button>
          </div>
        )}

        {/* Topic Suggestions */}
        {activeMode === 'topics' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Suggested Blog Topics</h3>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin mx-auto mb-3 text-purple-500" size={32} />
                <p className="text-gray-500">Generating topic ideas...</p>
              </div>
            ) : suggestedTopics.length > 0 ? (
              <div className="space-y-3">
                {suggestedTopics.map((topic) => (
                  <div key={topic.topic} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{topic.topic}</h4>
                        <p className="text-sm text-gray-500 mt-1">{topic.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {topic.keywords?.map(kw => (
                            <span key={kw} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setBlogTopic(topic.topic);
                          setBlogKeywords(topic.keywords?.join(', ') || '');
                          setActiveMode('blog');
                        }}
                        className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Click to generate topic suggestions</p>
              </div>
            )}
          </div>
        )}

        {/* Generated Blog Result */}
        {result?.type === 'blog' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                Blog Generated Successfully
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="px-3 py-1 border border-gray-200 rounded-lg text-gray-600 text-sm"
                >
                  New
                </button>
                <button
                  onClick={handleSaveBlog}
                  disabled={loading}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1"
                >
                  <Save size={14} /> Save as Draft
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Title</span>
                <button onClick={() => copyToClipboard(result.data.title)} className="text-gray-400 hover:text-gray-600">
                  <Copy size={14} />
                </button>
              </div>
              <p className="font-semibold text-gray-900">{result.data.title}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Meta Description</span>
                <button onClick={() => copyToClipboard(result.data.meta_description)} className="text-gray-400 hover:text-gray-600">
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-gray-700">{result.data.meta_description}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Content Preview</span>
                <button onClick={() => copyToClipboard(result.data.content)} className="text-gray-400 hover:text-gray-600">
                  <Copy size={14} />
                </button>
              </div>
              <div 
                className="prose prose-sm max-w-none text-gray-700 max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.data.content) }}
              />
            </div>
            
            <div className="flex flex-wrap gap-1">
              {result.data.keywords?.map(kw => (
                <span key={kw} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Generated Location Result */}
        {result?.type === 'location' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                Location Content Generated
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="px-3 py-1 border border-gray-200 rounded-lg text-gray-600 text-sm"
                >
                  New
                </button>
                <button
                  onClick={handleSaveLocation}
                  disabled={loading}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1"
                >
                  <Save size={14} /> Save Location
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-500">Title</span>
                <p className="font-semibold text-gray-900 mt-1">{result.data.title}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-500">Description</span>
                <p className="text-gray-700 mt-1">{result.data.description}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-500">Climate</span>
                <p className="text-gray-700 mt-1">{result.data.climate}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-500">Common Skin Issues</span>
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.data.skin_issues?.map(issue => (
                    <span key={issue} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-500">Recommendations</span>
                <p className="text-gray-700 mt-1">{result.data.recommendations}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAIStudio;
