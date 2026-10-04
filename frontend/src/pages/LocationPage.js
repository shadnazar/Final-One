import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Truck, Shield, ChevronRight, Check } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Actual Celesta Glow product image
const PRODUCT_IMAGE = 'https://celestaglow.com/cdn/shop/files/IMG_0538.png?v=1771463966&width=1000';

function LocationPage() {
  const { state, city } = useParams();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = city ? `${API}/location/${state}/${city}` : `${API}/location/${state}`;
    axios.get(url)
      .then(res => { setContent(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [state, city]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const location = city ? `${city}, ${state}` : state;
  const locationTitle = location.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  return (
    <div className="pb-24">
      {/* Hero */}
      <div className="px-5 py-10 bg-gray-50 text-center">
        <div className="inline-flex items-center gap-2 text-green-500 text-sm font-medium mb-3">
          <MapPin size={16} />
          <span data-testid="location-tag">{locationTitle}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4" data-testid="location-title">
          Celesta Glow in {locationTitle}
        </h1>
        <p className="text-gray-600 text-sm">
          Get India's first 4-in-1 anti-aging serum delivered to your doorstep in {locationTitle}.
        </p>
      </div>

      {/* Product Preview */}
      <div className="px-5 py-8 flex justify-center">
        <img src={PRODUCT_IMAGE} alt="Celesta Glow" className="w-48 h-auto" />
      </div>

      {/* Benefits */}
      <div className="px-5 py-8">
        <h2 className="font-bold text-lg text-gray-900 mb-4">Why Choose Celesta Glow?</h2>
        <div className="space-y-3">
          {[
            { id: 'loc-shield', icon: Shield, text: 'Dermatologist tested for all skin types' },
            { id: 'loc-truck', icon: Truck, text: `Free delivery across ${locationTitle}` },
            { id: 'loc-check', icon: Check, text: 'Cash on Delivery available' },
          ].map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-3 p-4 card-cg"
              data-testid={item.id}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <item.icon size={18} className="text-green-500" />
              </div>
              <span className="text-gray-700 text-sm">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mx-5 p-6 bg-green-500 rounded-2xl text-center">
        <h3 className="text-white text-lg font-bold mb-2">
          Order Now in {locationTitle}
        </h3>
        <p className="text-green-100 text-sm mb-4">
          Limited time offer - Save 53% today!
        </p>
        <Link 
          to="/shop"
          className="inline-flex items-center gap-2 bg-white text-green-600 font-semibold py-3 px-6 rounded-full"
          data-testid="location-cta"
        >
          Order Now — From ₹499 <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}

export default LocationPage;
