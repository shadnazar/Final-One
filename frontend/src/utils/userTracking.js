/**
 * User Behavior Tracking Utility
 * Tracks visitor behavior across the site with unique visitor ID
 * Enhanced with DOM-level click tracking (like Meta Pixel)
 */

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Only log in development
const isDev = process.env.NODE_ENV === 'development';

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = 'G-LSJCVKB8BP';

// Get or create unique visitor ID
export const getVisitorId = () => {
  let visitorId = localStorage.getItem('visitorId');
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('visitorId', visitorId);
    localStorage.setItem('visitorFirstSeen', new Date().toISOString());
  }
  return visitorId;
};

// Get session ID (resets on browser close)
export const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionStart', new Date().toISOString());
  }
  return sessionId;
};

// ============ GOOGLE ANALYTICS INTEGRATION ============
export const initGoogleAnalytics = () => {
  if (typeof window === 'undefined') return;
  
  // Check if already loaded
  if (window.gtag) return;
  
  // Load Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  
  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
    user_id: getVisitorId()
  });
  
  isDev && console.log('[Google Analytics] Initialized with ID:', GA_MEASUREMENT_ID);
};

// Track event to Google Analytics
export const trackGAEvent = (eventName, eventParams = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...eventParams,
      visitor_id: getVisitorId(),
      session_id: getSessionId()
    });
    isDev && console.log('[Google Analytics] Event:', eventName, eventParams);
  }
};

// ============ DOM-LEVEL CLICK TRACKING (Like Meta Pixel) ============
export const initClickTracking = () => {
  if (typeof document === 'undefined') return;
  
  // Event delegation for button clicks
  document.addEventListener('click', function(e) {
    const target = e.target;
    const buttonText = target.innerText || '';
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    
    // Track Buy Now / Order Now clicks
    if (buttonText.includes('Buy Now') || buttonText.includes('Order Now')) {
      trackAction('button_click', {
        button_type: 'buy_now',
        button_text: buttonText,
        page: window.location.pathname
      });
      trackGAEvent('begin_checkout', { currency: 'INR', value: 699 });
      isDev && console.log('[User Tracking] Buy Now clicked');
    }
    
    // Track Add to Cart / Claim Offer clicks
    if (buttonText.includes('Claim') || buttonText.includes('Add to Cart')) {
      trackAction('button_click', {
        button_type: 'claim_offer',
        button_text: buttonText,
        page: window.location.pathname
      });
      trackGAEvent('add_to_cart', { currency: 'INR', value: 699 });
      isDev && console.log('[User Tracking] Claim/Add clicked');
    }
    
    // Track Place Order / Pay clicks
    if (buttonText.includes('Place Order') || buttonText.includes('Pay')) {
      trackAction('button_click', {
        button_type: 'place_order',
        button_text: buttonText,
        page: window.location.pathname
      });
      trackGAEvent('add_payment_info', { currency: 'INR', value: 699 });
      isDev && console.log('[User Tracking] Place Order clicked');
    }
    
    // Track Consultation / Skin Analysis clicks
    if (buttonText.includes('Skin Analysis') || buttonText.includes('Consultation') || buttonText.includes('Free Analysis')) {
      trackAction('button_click', {
        button_type: 'consultation',
        button_text: buttonText,
        page: window.location.pathname
      });
      trackGAEvent('generate_lead', { lead_type: 'consultation' });
      isDev && console.log('[User Tracking] Consultation clicked');
    }
    
    // Track WhatsApp clicks
    if (target.closest('a[href*="whatsapp"]') || buttonText.includes('WhatsApp')) {
      trackAction('button_click', {
        button_type: 'whatsapp',
        button_text: buttonText,
        page: window.location.pathname
      });
      trackGAEvent('contact', { method: 'whatsapp' });
      isDev && console.log('[User Tracking] WhatsApp clicked');
    }
    
    // Track generic button clicks for analytics
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      trackAction('button_click', {
        button_type: 'generic',
        button_text: buttonText.substring(0, 50),
        page: window.location.pathname
      });
    }
  }, true); // Capture phase for reliability
  
  isDev && console.log('[User Tracking] DOM click tracking initialized');
};

// Initialize all tracking on page load
export const initAllTracking = () => {
  initGoogleAnalytics();
  initClickTracking();
};

// Request browser geolocation permission and get precise location
export const requestLocationPermission = async () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: 'Geolocation not supported' });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        
        // Store in localStorage
        localStorage.setItem('userLocation', JSON.stringify(location));
        
        // Update visitor profile with location
        await updateVisitorLocation(location);
        
        resolve(location);
      },
      (error) => {
        isDev && console.log('Location permission denied:', error.message);
        resolve({ error: error.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
};

// Get stored location
export const getStoredLocation = () => {
  const stored = localStorage.getItem('userLocation');
  return stored ? JSON.parse(stored) : null;
};

// Update visitor profile with location
export const updateVisitorLocation = async (location) => {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  
  try {
    await fetch(`${API}/tracking/update-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        location: location
      })
    });
  } catch (err) {
    isDev && console.log('Location update error:', err);
  }
};

// Track blog view
export const trackBlogView = async (blogSlug, blogTitle) => {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  
  try {
    await fetch(`${API}/tracking/blog-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        blog_slug: blogSlug,
        blog_title: blogTitle,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    isDev && console.log('Blog view tracking error:', err);
  }
};

// Track page visit with detailed info
export const trackPageVisit = async (page, additionalData = {}) => {
  // Always track page visits for analytics - consent only affects detailed tracking
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const storedLocation = getStoredLocation();
  
  const trackingData = {
    visitor_id: visitorId,
    session_id: sessionId,
    page: page,
    timestamp: new Date().toISOString(),
    referrer: document.referrer || 'direct',
    user_agent: navigator.userAgent,
    screen_width: window.innerWidth,
    screen_height: window.innerHeight,
    location: storedLocation,
    ...additionalData
  };

  try {
    await fetch(`${API}/tracking/page-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackingData)
    });
  } catch (err) {
    isDev && console.log('Tracking error:', err);
  }
};

// Track time spent on page
export const trackTimeSpent = async (page, timeSpentSeconds) => {
  // Track time spent for all visitors
  const visitorId = getVisitorId();
  const sessionId = getSessionId();

  try {
    await fetch(`${API}/tracking/time-spent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        page: page,
        time_spent: timeSpentSeconds,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    isDev && console.log('Tracking error:', err);
  }
};

// Track user action (click, scroll, form fill, etc.)
export const trackAction = async (action, details = {}) => {
  // Track all user actions for analytics
  const visitorId = getVisitorId();
  const sessionId = getSessionId();

  try {
    await fetch(`${API}/tracking/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        action: action,
        details: details,
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    isDev && console.log('Tracking error:', err);
  }
};

// Track form completion
export const trackFormComplete = async (formName, formData = {}) => {
  return trackAction('form_complete', {
    form_name: formName,
    has_address: !!formData.address || !!formData.house_number,
    has_phone: !!formData.phone,
    has_email: !!formData.email,
    has_name: !!formData.name
  });
};

// Track scroll depth
export const trackScrollDepth = async (page, depth) => {
  return trackAction('scroll', { page, depth_percent: depth });
};

// Track checkout step
export const trackCheckoutStep = async (step, data = {}) => {
  return trackAction('checkout_step', { step, ...data });
};

// Hook for tracking page with time spent
export const usePageTracking = (pageName) => {
  const startTime = Date.now();
  
  // Track page visit on mount
  trackPageVisit(pageName);
  
  // Return cleanup function to track time spent
  return () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    trackTimeSpent(pageName, timeSpent);
  };
};

export default {
  getVisitorId,
  getSessionId,
  trackPageVisit,
  trackTimeSpent,
  trackAction,
  trackFormComplete,
  trackScrollDepth,
  trackCheckoutStep,
  trackBlogView,
  requestLocationPermission,
  getStoredLocation,
  updateVisitorLocation,
  usePageTracking,
  initGoogleAnalytics,
  trackGAEvent,
  initClickTracking,
  initAllTracking
};
