import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, Plus, Edit, Trash2, Eye, Search, Filter,
  ChevronLeft, MoreVertical, Globe, Check
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();
  const adminToken = getAdminToken();

  useEffect(() => {
    if (!adminToken) return;
    fetchBlogs();
  }, [adminToken]);

  const fetchBlogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/blogs`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setBlogs(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blogId) => {
    try {
      await axios.delete(`${API}/admin/blogs/${blogId}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setBlogs(blogs.filter(b => b.id !== blogId));
      setDeleteConfirm(null);
    } catch (err) {
      alert('Failed to delete blog');
    }
  };

  const handlePublish = async (blogId) => {
    try {
      await axios.post(`${API}/admin/blogs/${blogId}/publish`, {}, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setBlogs(blogs.map(b => b.id === blogId ? { ...b, status: 'published' } : b));
    } catch (err) {
      alert('Failed to publish blog');
    }
  };

  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || blog.status === filterStatus;
    return matchesSearch && matchesFilter;
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
              <h1 className="text-xl font-bold text-gray-900">Blog Posts</h1>
              <p className="text-sm text-gray-500 hidden lg:block">
                Manage your blog content
              </p>
            </div>
          </div>
          <Link
            to="/admin/blogs/new"
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
            data-testid="create-blog-btn"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Post</span>
          </Link>
        </div>
      </header>

      <div className="p-4 lg:p-8">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              data-testid="search-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterStatus === 'all' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterStatus === 'published' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterStatus === 'draft' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Draft
            </button>
          </div>
        </div>

        {/* Blog List */}
        {filteredBlogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No blog posts found</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first blog post</p>
            <Link
              to="/admin/blogs/new"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              <Plus size={18} />
              Create Blog Post
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBlogs.map((blog) => (
              <div 
                key={blog.id} 
                className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
                data-testid={`blog-item-${blog.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        blog.status === 'published' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {blog.status}
                      </span>
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Globe size={12} />
                        {blog.language || 'en'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">{blog.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                      {blog.meta_description || blog.content?.substring(0, 100)}...
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {blog.view_count || 0} views
                      </span>
                      <span>
                        {new Date(blog.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {blog.status === 'draft' && (
                      <button
                        onClick={() => handlePublish(blog.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Publish"
                        data-testid={`publish-btn-${blog.id}`}
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <Link
                      to={`/admin/blogs/edit/${blog.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-btn-${blog.id}`}
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(blog.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`delete-btn-${blog.id}`}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Blog Post?</h3>
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
            <FileText size={20} />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link to="/admin/blogs" className="flex flex-col items-center p-2 text-green-600">
            <FileText size={20} />
            <span className="text-xs mt-1">Blogs</span>
          </Link>
          <Link to="/admin/locations" className="flex flex-col items-center p-2 text-gray-500">
            <FileText size={20} />
            <span className="text-xs mt-1">Locations</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default AdminBlogs;
