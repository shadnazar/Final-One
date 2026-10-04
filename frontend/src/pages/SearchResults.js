import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../components/BackButton';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Search, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const nicheFilter = searchParams.get('niche') || '';
  const sortBy = searchParams.get('sort') || 'relevance';

  const [products, setProducts] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Unified search — /api/search now returns { products, blogs } in one call
    axios.get(`${API}/search?q=${encodeURIComponent(query)}&limit=60`)
      .then(r => r.data)
      .catch(() => ({ products: [], blogs: [] }))
      .then(d => {
        let prodList = Array.isArray(d?.products) ? d.products : [];
        if (nicheFilter) prodList = prodList.filter(p => p.niche === nicheFilter);
        setProducts(prodList);
        setBlogs(Array.isArray(d?.blogs) ? d.blogs : []);
        setLoading(false);
      });
  }, [query, nicheFilter]);

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    if (sortBy === 'price_asc') arr.sort((a, b) => (a.prepaid_price || 0) - (b.prepaid_price || 0));
    else if (sortBy === 'price_desc') arr.sort((a, b) => (b.prepaid_price || 0) - (a.prepaid_price || 0));
    else if (sortBy === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'newest') arr.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return arr;
  }, [products, sortBy]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    setSearchParams(next);
  };

  const totalResults = sortedProducts.length + blogs.length;

  if (loading) {
    return (
      <div className="min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-8 pb-24">
      <BackButton />
      <div className="flex items-center gap-3 mb-4 mt-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Search size={18} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-gray-900" data-testid="search-results-title">"{query}"</h1>
          <p className="text-gray-500 text-sm" data-testid="search-results-count">
            {totalResults} result{totalResults !== 1 ? 's' : ''} · {sortedProducts.length} products · {blogs.length} articles
          </p>
        </div>
      </div>

      {/* Filter + Sort bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-1 flex-wrap" data-testid="search-niche-pills">
          {[
            { k: '', label: 'All' },
            { k: 'anti-aging', label: 'Anti-Aging' },
            { k: 'skincare', label: 'Skincare' },
            { k: 'cosmetics', label: 'Cosmetics' },
          ].map(n => (
            <button
              key={n.k || 'all'}
              onClick={() => setParam('niche', n.k)}
              data-testid={`search-niche-${n.k || 'all'}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                nicheFilter === n.k
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white ring-1 ring-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <select
          value={sortBy}
          onChange={(e) => setParam('sort', e.target.value === 'relevance' ? '' : e.target.value)}
          className="bg-white ring-1 ring-stone-200 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-700"
          data-testid="search-sort"
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="rating">Top rated</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {totalResults === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center ring-1 ring-stone-100" data-testid="search-empty">
          <p className="text-gray-700 font-semibold mb-2">No results for "{query}"</p>
          <p className="text-gray-500 text-sm mb-5">Try a broader keyword, check spelling, or browse our bestsellers.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/shop" className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold">Browse all products</Link>
            <Link to="/blog" className="px-5 py-2 rounded-full bg-white ring-1 ring-emerald-200 text-emerald-700 text-sm font-semibold">Read the blog</Link>
          </div>
        </div>
      ) : (
        <>
          {sortedProducts.length > 0 && (
            <section className="mb-10" data-testid="search-products-section">
              <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-3">Products</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                {sortedProducts.map((p, i) => (
                  <Link
                    key={p.slug}
                    to={`/product/${p.slug}`}
                    className="bg-white rounded-2xl ring-1 ring-stone-100 overflow-hidden hover:shadow-lg transition-shadow"
                    data-testid={`search-product-${i}`}
                  >
                    <div className="aspect-square bg-stone-50">
                      {p.images?.[0] && (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">{p.niche || ''}</p>
                      <p className="font-semibold text-sm text-stone-900 line-clamp-2 mb-2">{p.short_name || p.name}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-emerald-700 font-bold">₹{p.prepaid_price || p.mrp}</span>
                        {p.mrp && p.mrp > (p.prepaid_price || 0) && (
                          <span className="text-stone-400 text-xs line-through">₹{p.mrp}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {blogs.length > 0 && (
            <section data-testid="search-blogs-section">
              <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-3">Beauty Tips & Articles</h2>
              <div className="space-y-3">
                {blogs.map((blog, i) => (
                  <Link
                    key={blog.id || blog.slug}
                    to={`/blog/${blog.slug}`}
                    className="block bg-white rounded-2xl p-5 ring-1 ring-stone-100 hover:shadow-md transition-shadow"
                    data-testid={`search-blog-${i}`}
                  >
                    <h3 className="font-bold text-base text-gray-900 mb-1.5">{blog.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-2">{(blog.content || '').replace(/<[^>]+>/g, '').substring(0, 150)}…</p>
                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      Read more <ChevronRight size={16} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default SearchResults;
