import React, { useState } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, Phone, Mail, MapPin, MessageCircle, Clock, Send, CheckCircle } from 'lucide-react';
import axios from 'axios';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WHATSAPP_NUMBER = '919446125745';
const SUPPORT_EMAIL = 'support@celestaglow.com';

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'general',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await axios.post(`${API}/contact`, formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: 'general', message: '' });
    } catch (err) {
      setError('Failed to send message. Please try WhatsApp or email instead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEOHead
        title="Contact Celesta Glow | WhatsApp +91-94461-25745 | Customer Support India"
        description="Contact Celesta Glow customer support — WhatsApp +91-94461-25745, email support@celestaglow.com. Office in Bengaluru. Mon-Sat 10 AM-7 PM IST."
        canonicalPath="/contact"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-600">We're here to help! Reach out to us anytime.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Get In Touch</h2>
              
              <div className="space-y-4">
                {/* WhatsApp - Primary */}
                <a 
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi! I need help with my Celesta Glow order.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp Support</p>
                    <p className="text-sm text-gray-600">+91 94461 25745</p>
                    <p className="text-xs text-green-600 mt-1">Fastest Response - Click to chat</p>
                  </div>
                </a>

                {/* Phone */}
                <a 
                  href={`tel:+${WHATSAPP_NUMBER}`}
                  className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Call Us</p>
                    <p className="text-sm text-gray-600">+91 94461 25745</p>
                    <p className="text-xs text-blue-600 mt-1">Mon-Sat: 10 AM - 7 PM</p>
                  </div>
                </a>

                {/* Email */}
                <a 
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Email Us</p>
                    <p className="text-sm text-gray-600">{SUPPORT_EMAIL}</p>
                    <p className="text-xs text-purple-600 mt-1">Response within 24 hours</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Business Address */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Our Office</h2>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <address className="not-italic text-gray-600 text-sm leading-relaxed">
                  <strong className="text-gray-900">Veegal Enterprises LLP</strong><br />
                  1st Floor, 38, Booth No. 62,<br />
                  Ashwini Layout, 2nd Main, Egipura,<br />
                  Bengaluru, Karnataka – 560047<br />
                  India
                </address>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                <Clock className="w-5 h-5 text-gray-400" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">Business Hours</p>
                  <p>Monday - Saturday: 10:00 AM - 7:00 PM</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Send Us a Message</h2>
            
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600 mb-4">We'll get back to you within 24 hours.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="text-green-600 font-medium hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="order">Order Related</option>
                    <option value="product">Product Question</option>
                    <option value="return">Return / Refund</option>
                    <option value="complaint">Complaint</option>
                    <option value="feedback">Feedback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* FAQ Quick Links */}
        <div className="mt-8 bg-gradient-to-r from-green-50 to-green-50 rounded-2xl p-6 border border-green-200">
          <h3 className="font-semibold text-gray-900 mb-3">Looking for quick answers?</h3>
          <div className="flex flex-wrap gap-2">
            <Link to="/shipping-policy" className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-green-100 transition-colors border border-gray-200">
              Shipping Info
            </Link>
            <Link to="/refund-policy" className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-green-100 transition-colors border border-gray-200">
              Refund Policy
            </Link>
            <Link to="/terms" className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-green-100 transition-colors border border-gray-200">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-green-100 transition-colors border border-gray-200">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
