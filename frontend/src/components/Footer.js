import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, Clock, Shield, Truck, CreditCard, MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '919446125745';
const SUPPORT_EMAIL = 'support@celestaglow.com';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-24" data-testid="site-footer">
      <div className="max-w-6xl mx-auto px-5">
        {/* Top Section - Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 pb-8 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <Truck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Free Shipping</p>
              <p className="text-xs text-gray-500">On all orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Secure Payment</p>
              <p className="text-xs text-gray-500">100% Protected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">COD Available</p>
              <p className="text-xs text-gray-500">Pay on delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Fast Delivery</p>
              <p className="text-xs text-gray-500">2-3 Business Days</p>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Company Info */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4">Celesta Glow</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              India's #1 Complete Skin Care Solution. 5 clinically-formulated products for radiant skin — Serum, Night Cream, Under Eye Cream, Sunscreen & Cleanser.
            </p>
            
            {/* Company Address — heading on top, address below */}
            <div className="border-t border-gray-800 pt-4 mt-2">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-2">Sold &amp; Marketed By:</h3>
              <address className="not-italic text-sm text-gray-400 leading-relaxed">
                <strong className="text-gray-200 block">Veegal Enterprises LLP</strong>
                1st Floor, 38, Booth No. 62,<br />
                Ashwini Layout, 2nd Main, Egipura,<br />
                Bengaluru, Karnataka – 560047, India
              </address>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/shop" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Shop Now
                </Link>
              </li>
              <li>
                <Link to="/routine" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Free Skin Analysis
                </Link>
              </li>
              <li>
                <Link to="/skin-issue" className="text-sm text-gray-400 hover:text-green-400 transition-colors" data-testid="footer-link-skin-issue">
                  Free Skin Advice
                </Link>
              </li>
              <li>
                <Link to="/investor" className="text-sm text-gray-400 hover:text-green-400 transition-colors" data-testid="footer-link-investor">
                  Investor Relations
                </Link>
              </li>
              <li>
                <Link to="/partner" className="text-sm text-gray-400 hover:text-green-400 transition-colors" data-testid="footer-link-partner">
                  Partner With Us
                </Link>
              </li>
              <li>
                <Link to="/blogs" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Skincare Blog
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Customer Support</h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href={`tel:+${WHATSAPP_NUMBER}`}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +91 94461 25745
                </a>
              </li>
              <li>
                <a 
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Support
                </a>
              </li>
              <li>
                <a 
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>

            {/* Legal Links */}
            <h3 className="text-sm font-semibold text-white mt-6 mb-3 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                  Shipping Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500">
              © {currentYear} Celesta Glow by Veegal Enterprises LLP. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">Secure Payments:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-800 px-2 py-1 rounded">Razorpay</span>
                <span className="text-xs bg-gray-800 px-2 py-1 rounded">UPI</span>
                <span className="text-xs bg-gray-800 px-2 py-1 rounded">Cards</span>
                <span className="text-xs bg-gray-800 px-2 py-1 rounded">COD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
