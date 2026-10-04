import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  ChevronLeft, Save, Eye, Globe, Tag, X, FileText
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminBlogEditor() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const adminToken = getAdminToken();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    meta_description: '',
    keywords: [],
    status: 'draft',
    language: 'en'
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorMode, setEditorMode] = useState('edit'); // 'edit' | 'preview'

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin');
      return;
    }

    if (isEditing) {
      fetchBlog();
    }
  }, [adminToken, navigate, isEditing, id]);

  const fetchBlog = async () => {
    try {
      const res = await axios.get(`${API}/admin/blogs`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      const blog = res.data.find(b => b.id === id);
      if (blog) {
        setFormData({
          title: blog.title || '',
          content: blog.content || '',
          meta_description: blog.meta_description || '',
          keywords: blog.keywords || [],
          status: blog.status || 'draft',
          language: blog.language || 'en'
        });
      } else {
        navigate('/admin/blogs');
      }
    } catch (err) {
      navigate('/admin/blogs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e, publishNow = false) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const data = {
      ...formData,
      status: publishNow ? 'published' : formData.status
    };

    try {
      if (isEditing) {
        await axios.put(`${API}/admin/blogs/${id}`, data, {
          headers: { 'X-Admin-Token': adminToken }
        });
      } else {
        await axios.post(`${API}/admin/blogs`, data, {
          headers: { 'X-Admin-Token': adminToken }
        });
      }
      navigate('/admin/blogs');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim().toLowerCase()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword)
    });
  };

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
            <Link to="/admin/blogs" className="text-gray-600">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Edit Blog Post' : 'New Blog Post'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleSubmit(e, false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              data-testid="save-draft-btn"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Save Draft</span>
            </button>
            <button
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
              data-testid="publish-btn"
            >
              <Eye size={18} />
              <span className="hidden sm:inline">Publish</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-lg"
              placeholder="Enter blog title..."
              required
              data-testid="title-input"
            />
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Content *
              </label>
              <div className="flex gap-2" data-testid="blog-editor-tabs">
                <button
                  type="button"
                  onClick={() => setEditorMode('edit')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md ${editorMode === 'edit' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  data-testid="blog-tab-edit"
                >Write</button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md inline-flex items-center gap-1 ${editorMode === 'preview' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  data-testid="blog-tab-preview"
                >
                  <Eye size={12} /> Preview
                </button>
              </div>
            </div>
            {editorMode === 'edit' ? (
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-h-[400px] resize-y font-mono text-sm"
                placeholder="Write your blog content here... (Supports HTML)"
                required
                data-testid="content-input"
              />
            ) : (
              <div
                className="prose prose-sm max-w-none min-h-[400px] px-4 py-3 border border-gray-200 rounded-xl bg-stone-50 overflow-y-auto"
                data-testid="blog-content-preview"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: formData.content || '<p class="text-gray-400 italic">Nothing to preview yet.</p>' }}
              />
            )}
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400">
                Tip: You can use HTML tags for formatting (h2, p, ul, strong, etc.)
              </p>
              <div className="flex items-center gap-3 text-[11px] font-bold" data-testid="blog-seo-score">
                <span className={`px-2 py-0.5 rounded ${formData.content.length >= 600 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {formData.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length} words
                </span>
                <span className={`px-2 py-0.5 rounded ${formData.title.length >= 30 && formData.title.length <= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  Title: {formData.title.length}/60
                </span>
                <span className={`px-2 py-0.5 rounded ${formData.meta_description.length >= 120 && formData.meta_description.length <= 160 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  Meta: {formData.meta_description.length}/160
                </span>
                <span className={`px-2 py-0.5 rounded ${formData.keywords.length >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  KW: {formData.keywords.length}
                </span>
              </div>
            </div>
          </div>

          {/* Meta & SEO */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} />
              SEO Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                <textarea
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="Brief description for search engines (150-160 characters)"
                  rows={3}
                  data-testid="meta-description-input"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formData.meta_description.length}/160 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Add keyword..."
                    data-testid="keyword-input"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                    >
                      <Tag size={12} />
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe size={18} />
              Settings
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                  data-testid="language-select"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                  data-testid="status-select"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminBlogEditor;
