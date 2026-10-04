/**
 * LandingPage.js
 * Public-facing problem-specific landing page
 * Renders customized content based on the problem slug
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Star, Check, ChevronRight, Shield, Truck, Clock, Award,
  AlertCircle, Sparkles, ArrowRight, Phone, Gift
} from 'lucide-react';
import { useTracking } from '../providers/TrackingProvider';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PREPAID_PRICE = 699;
const MRP = 1499;

const PRODUCT_IMAGE = 'https://customer-assets.emergentagent.com/job_050b785b-bdfe-40d2-9088-b4c5bddc18c5/artifacts/f3fkk4tr_IMG_9115.png';

// Default product details in case backend doesn't provide them
const DEFAULT_PRODUCT = {
  name: 'Celesta Glow Anti-Aging Serum',
  tagline: '4-in-1 Advanced Formula',
  description: 'Premium anti-aging serum with clinically proven ingredients.'
};

function LandingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { trackPageVisit, trackViewContent, trackAction } = useTracking();
  
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 47, seconds: 33 });
  
  const pageStartTime = useRef(Date.now());

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const res = await axios.get(`${API}/landing-pages/public/${slug}`);
        setPageData(res.data);
        
        // Track visit
        trackPageVisit(`landing_${slug}`);
        trackViewContent(res.data.problem_title, PREPAID_PRICE);
        trackAction('landing_page_view', { slug, category: res.data.category });
        
        // Meta Pixel tracking
        if (typeof window !== 'undefined' && window.fbq) {
          window.fbq('track', 'ViewContent', {
            content_name: res.data.problem_title,
            content_category: res.data.category,
            content_type: 'landing_page',
            value: PREPAID_PRICE,
            currency: 'INR'
          });
        }
      } catch (err) {
        setError('Page not found');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPage();
    
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        seconds--;
        if (seconds < 0) { seconds = 59; minutes--; }
        if (minutes < 0) { minutes = 59; hours--; }
        if (hours < 0) { hours = 23; minutes = 59; seconds = 59; }
        return { hours, minutes, seconds };
      });
    }, 1000);
    
    return () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      trackAction('landing_time_on_page', { slug, seconds: timeOnPage });
      clearInterval(timer);
    };
  }, [slug, trackPageVisit, trackViewContent, trackAction]);

  const handleBuyNow = () => {
    // Track conversion intent
    trackAction('landing_cta_click', { slug, button: 'buy_now' });
    
    // Store landing page reference for conversion tracking
    sessionStorage.setItem('landing_page_slug', slug);
    
    // Meta Pixel
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: pageData?.problem_title,
        content_category: pageData?.category,
        value: PREPAID_PRICE,
        currency: 'INR'
      });
    }
    
    // Navigate to product page with checkout
    navigate('/product?checkout=true&from_lp=' + slug);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-500 mb-6">This landing page doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-purple-500 text-white rounded-xl font-semibold"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  const content = pageData.content || {};
  
  // Get dynamic product details from content or use defaults
  const productName = content.product_name || DEFAULT_PRODUCT.name;
  const productTagline = content.product_tagline || DEFAULT_PRODUCT.tagline;
  const productDescription = content.product_description || DEFAULT_PRODUCT.description;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* SEO Meta Tags would go here in a real implementation via Helmet */}
      
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-purple-50 via-white to-white px-5 py-10">
        {/* Urgency Banner */}
        <div className="bg-red-500 text-white text-center py-2 px-4 rounded-xl mb-6 animate-pulse">
          <p className="text-sm font-semibold">
            ⏰ Limited Offer Ends In: {String(timeLeft.hours).padStart(2,'0')}:{String(timeLeft.minutes).padStart(2,'0')}:{String(timeLeft.seconds).padStart(2,'0')}
          </p>
        </div>
        
        {/* Main Headline */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4 leading-tight">
          {content.hero_headline || pageData.problem_title}
        </h1>
        
        <p className="text-center text-purple-600 font-semibold mb-6">
          {content.hero_subheadline || "India's #1 Anti-Aging Solution Is Here"}
        </p>
        
        {/* Product Image */}
        <div className="relative max-w-xs mx-auto mb-6">
          <img 
            src={PRODUCT_IMAGE} 
            alt={productName} 
            className="w-full h-auto"
          />
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            53% OFF
          </div>
        </div>
        
        {/* Dynamic Product Name Badge */}
        <div className="text-center mb-4">
          <span className="inline-block px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full font-semibold text-sm border border-purple-200">
            {productName}
          </span>
          <p className="text-sm text-gray-600 mt-2 italic">{productTagline}</p>
        </div>
        
        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-bold text-green-600">₹{PREPAID_PRICE}</span>
            <span className="text-xl text-gray-400 line-through">₹{MRP}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Free Delivery • COD Available</p>
        </div>
        
        {/* Primary CTA */}
        <button
          onClick={handleBuyNow}
          className="w-full max-w-md mx-auto block py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
          data-testid="hero-cta-btn"
        >
          {content.cta_primary || "Get Your Solution Now"} →
        </button>
        
        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Shield size={14} /> Secure</span>
          <span className="flex items-center gap-1"><Truck size={14} /> Free Ship</span>
          <span className="flex items-center gap-1"><Clock size={14} /> 2-3 Days</span>
        </div>
      </section>

      {/* Problem Section */}
      <section className="px-5 py-10 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
          {content.problem_title || "Sound Familiar?"}
        </h2>
        
        <p className="text-gray-600 text-center mb-6">
          {content.hero_problem_statement}
        </p>
        
        <div className="space-y-3 max-w-md mx-auto">
          {(content.problem_points || []).map((point, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle size={14} className="text-red-500" />
              </div>
              <p className="text-gray-700">{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution Section */}
      <section className="px-5 py-10">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-3">
            THE SOLUTION
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {content.solution_title || "The Science-Backed Solution"}
          </h2>
          <p className="text-gray-600 mb-2">
            {content.solution_description}
          </p>
          {productDescription && (
            <p className="text-sm text-purple-600 font-medium mt-2">
              {productDescription}
            </p>
          )}
        </div>
        
        <div className="space-y-3 max-w-md mx-auto mb-8">
          {(content.solution_benefits || []).map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-white" />
              </div>
              <p className="text-gray-700">{benefit}</p>
            </div>
          ))}
        </div>
        
        {/* Secondary CTA */}
        <button
          onClick={handleBuyNow}
          className="w-full max-w-md mx-auto block py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg"
          data-testid="solution-cta-btn"
        >
          {content.cta_secondary || "Start Your Transformation"} →
        </button>
      </section>

      {/* Ingredients Section */}
      <section className="px-5 py-10 bg-gradient-to-b from-purple-50 to-white">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
          Powered By Science
        </h2>
        
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {[
            { name: '0.3% Retinol', desc: 'Reduces wrinkles', color: 'from-purple-500 to-indigo-500' },
            { name: 'Hyaluronic Acid', desc: 'Deep hydration', color: 'from-blue-500 to-cyan-500' },
            { name: '5% Niacinamide', desc: 'Brightens skin', color: 'from-amber-500 to-orange-500' },
            { name: 'Vitamin E', desc: 'Protects skin', color: 'from-green-500 to-green-500' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-3`}>
                <Sparkles size={20} className="text-white" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-5 py-10">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
          Join 10,000+ Happy Customers
        </h2>
        
        <div className="space-y-4 max-w-md mx-auto">
          {[
            { name: 'Priya S.', location: 'Mumbai', text: 'Saw visible results in just 2 weeks! My skin feels so much smoother.' },
            { name: 'Anita K.', location: 'Delhi', text: 'Finally found something that actually works for my fine lines!' },
            { name: 'Rekha M.', location: 'Bangalore', text: 'Best investment for my skin. Everyone asks my secret now!' },
          ].map((review, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                  {review.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{review.name}</p>
                  <p className="text-xs text-gray-500">{review.location}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 text-sm">"{review.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-5 py-10 bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Skin?</h2>
          <p className="text-green-100 mb-6">Join thousands who've already started their anti-aging journey</p>
          
          <div className="bg-white/20 backdrop-blur rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-4">
              <div>
                <p className="text-3xl font-bold">₹{PREPAID_PRICE}</p>
                <p className="text-sm text-green-200">One-time purchase</p>
              </div>
              <div className="w-px h-12 bg-white/30" />
              <div>
                <p className="text-3xl font-bold line-through opacity-50">₹{MRP}</p>
                <p className="text-sm text-green-200">Regular price</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleBuyNow}
            className="w-full py-4 bg-white text-green-600 font-bold rounded-xl shadow-lg text-lg"
            data-testid="final-cta-btn"
          >
            Get My Serum Now - ₹{PREPAID_PRICE}
          </button>
          
          <p className="text-sm text-green-200 mt-4">
            ✓ Free Shipping • ✓ COD Available • ✓ 7-Day Sealed Return
          </p>
        </div>
      </section>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-green-500 p-3 z-50 shadow-2xl max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold text-gray-900">₹{PREPAID_PRICE} <span className="text-sm text-gray-400 line-through">₹{MRP}</span></p>
            <p className="text-xs text-green-600">Save ₹{MRP - PREPAID_PRICE} Today!</p>
          </div>
          <button
            onClick={handleBuyNow}
            className="py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl"
          >
            Order Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
