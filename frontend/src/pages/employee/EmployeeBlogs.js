import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, Search, RefreshCw, Eye, Calendar, Globe, Trash2, Edit,
  Plus, ExternalLink, ChevronLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function EmployeeBlogs() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const employeeToken = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/blogs`, {
        headers: { 'X-Employee-Token': employeeToken }
      });
      setBlogs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const filteredBlogs = blogs.filter(blog => 
    !searchQuery || 
    blog.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    blog.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <Link to="/employee/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
        <ChevronLeft size={20} />
        <span>Back to Dashboard</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-500 text-sm">{blogs.length} total posts</p>
        </div>
        <button
          onClick={fetchBlogs}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search blogs by title or category..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Blog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBlogs.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No blog posts found
          </div>
        ) : (
          filteredBlogs.map((blog) => (
            <div key={blog.slug} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              {blog.featured_image && (
                <img 
                  src={blog.featured_image} 
                  alt={blog.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {blog.category && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      {blog.category}
                    </span>
                  )}
                  {blog.state && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {blog.state}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{blog.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{blog.meta_description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(blog.created_at)}
                  </span>
                  <a 
                    href={`/blog/${blog.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-600 hover:underline"
                  >
                    <ExternalLink size={12} />
                    View
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmployeeBlogs;
