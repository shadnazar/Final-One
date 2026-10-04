import React from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, Shield, Award, Users, Leaf, Heart, CheckCircle, Star, ChevronRight } from 'lucide-react';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';

function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="About Celesta Glow | Dermatologist Approved Skincare Brand"
        description="Discover Celesta Glow, a dermatologist recommended skin care brand in Kerala offering vegan skin care and dermatologist-approved skincare."
        canonicalPath="/about"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'About', url: '/about' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">About Celesta Glow</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            India's #1 Premium Anti-Aging Skincare Brand. We believe everyone deserves to feel confident in their skin at any age.
          </p>
        </div>

        {/* Our Story */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-4">
              Celesta Glow was born from a simple observation: effective anti-aging skincare shouldn't cost a fortune or require a 10-step routine. We set out to create a single, powerful serum that combines the best of science and nature.
            </p>
            <p className="text-gray-600 mb-4">
              After years of research and development, we created India's first complete anti-aging system — 5 clinically-formulated products that work together to fight aging from every angle. From our Advanced Face Serum to our SPF 50 Sunscreen, each product is packed with active ingredients like Retinoid, Niacinamide, Caffeine, Alpha Arbutin, and Vitamin C.
            </p>
            <p className="text-gray-600">
              Today, over 50,000 Indians trust Celesta Glow for their skincare needs. Our customers consistently report visible improvements in fine lines, skin texture, and overall radiance within just 2-4 weeks of use.
            </p>
          </div>
        </div>

        {/* Mission & Values */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-50 rounded-2xl p-6 border border-green-200">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Our Mission</h3>
            <p className="text-gray-600">
              To make premium, effective anti-aging skincare accessible to every Indian. We believe in transparent pricing, honest marketing, and products that actually work.
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-4">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Our Values</h3>
            <p className="text-gray-600">
              Quality over quantity. We'd rather perfect one product than rush dozens to market. Every batch is tested for purity, potency, and safety before reaching you.
            </p>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why 50,000+ Indians Choose Celesta Glow</h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: 'Dermatologist Tested', desc: 'Safe for all skin types, including sensitive skin' },
              { icon: Award, title: 'Clinically Proven', desc: '87% reduction in fine lines in clinical studies' },
              { icon: Users, title: 'Men & Women', desc: 'Effective anti-aging for ages 25-55+' },
              { icon: Leaf, title: 'No Harsh Chemicals', desc: 'Paraben-free, sulfate-free, cruelty-free' },
              { icon: CheckCircle, title: '7-Day Sealed Return', desc: 'Unopened items only. Opened bottles cannot be returned for hygiene reasons.' },
              { icon: Star, title: '4.8/5 Rating', desc: '2,340+ verified 5-star reviews' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Company Information</h2>
          
          <div className="space-y-4 text-gray-600">
            <div className="flex items-start gap-3">
              <span className="font-semibold text-gray-900 w-32 flex-shrink-0">Company Name:</span>
              <span>Veegal Enterprises LLP</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-gray-900 w-32 flex-shrink-0">Registered Office:</span>
              <span>1st Floor, 38, Booth No. 62, Ashwini Layout, 2nd Main, Egipura, Bengaluru, Karnataka – 560047, India</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-gray-900 w-32 flex-shrink-0">Support Email:</span>
              <a href="mailto:support@celestaglow.com" className="text-green-600 hover:underline">support@celestaglow.com</a>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-gray-900 w-32 flex-shrink-0">Support Phone:</span>
              <a href="tel:+919446125745" className="text-green-600 hover:underline">+91 94461 25745</a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 md:p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-3">Ready to Transform Your Skin?</h3>
          <p className="text-green-100 mb-6">Join 50,000+ happy customers and start your anti-aging journey today.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link 
              to="/shop"
              className="inline-flex items-center justify-center gap-2 bg-white text-green-600 font-semibold py-3 px-6 rounded-xl hover:bg-green-50 transition-colors"
            >
              Shop Now <ChevronRight size={20} />
            </Link>
            <Link 
              to="/consultation"
              className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-6 rounded-xl border-2 border-white/30 hover:bg-green-700 transition-colors"
            >
              Free Skin Analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
