import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import BackButton from '../components/BackButton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function BlogPost() {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/blogs/${slug}`)
      .then(res => { 
        setBlog(res.data); 
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="px-5 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Article Not Found</h1>
        <Link to="/blog" className="text-green-500 font-medium">← Back to Beauty Tips</Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 py-6 border-b border-gray-100">
        <div className="mb-3"><BackButton label="Back" testId="blog-post-back" /></div>
        <Link 
          to="/blog" 
          className="inline-flex items-center gap-2 text-gray-500 text-sm mb-4"
          data-testid="back-to-blog"
        >
          <ArrowLeft size={16} /> Back to Beauty Tips
        </Link>
        
        <div className="flex items-center gap-2 text-gray-400 text-xs mb-3">
          <Clock size={14} />
          <span>{new Date(blog.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>•</span>
          <span>{blog.read_time || '5 min read'}</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 leading-tight" data-testid="blog-post-title">
          {blog.title}
        </h1>
      </div>

      {/* Hero Image */}
      {blog.image_url && (
        <div className="w-full h-56 sm:h-72 bg-gray-100 overflow-hidden">
          <img 
            src={blog.image_url} 
            alt={blog.title}
            className="w-full h-full object-cover"
            data-testid="blog-hero-image"
            onError={(e) => {
              e.target.onerror = null;
              e.target.parentElement.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Product CTA */}
      <div className="mx-5 mt-6 p-4 bg-green-50 border border-green-100 rounded-xl">
        <p className="text-sm text-gray-700">
          Looking for effective anti-aging solutions? Try{' '}
          <Link to="/shop" className="text-green-600 font-semibold">
            Celesta Glow Advanced Serum
          </Link>
          {' '}— India's first 4-in-1 formula.
        </p>
      </div>

      {/* Content */}
      <div className="px-5 py-8">
        <div 
          data-testid="blog-content"
          className="prose prose-gray max-w-none
            prose-headings:text-gray-900 prose-headings:font-bold
            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-5
            prose-ul:list-disc prose-ul:pl-5 prose-ul:my-4
            prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-4
            prose-li:text-gray-600 prose-li:mb-2
            prose-strong:text-gray-800 prose-strong:font-semibold
            prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content) }}
        />
      </div>

      {/* Bottom CTA */}
      <div className="mx-5 p-6 bg-gray-900 rounded-2xl text-center">
        <h3 className="text-white text-lg font-bold mb-2">Ready to Transform Your Skin?</h3>
        <p className="text-gray-400 text-sm mb-4">Join 10,000+ happy customers</p>
        <Link 
          to="/shop"
          className="btn-cg-primary inline-flex"
          data-testid="blog-cta"
        >
          Shop Now — From ₹499 <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}

export default BlogPost;
