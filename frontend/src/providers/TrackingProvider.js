import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import useVisitorPing from '../hooks/useVisitorPing';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Context for tracking functions
const TrackingContext = createContext(null);

// Generate or retrieve visitor ID (persists across sessions)
const getVisitorId = () => {
  let visitorId = localStorage.getItem('visitorId');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('visitorId', visitorId);
  }
  return visitorId;
};

// Generate or retrieve session ID (persists within session)
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionStartTime', Date.now().toString());
  }
  return sessionId;
};

// Wait for fbq to be available
const waitForFbq = (callback, maxWait = 5000) => {
  const startTime = Date.now();
  const check = () => {
    if (typeof window.fbq === 'function') {
      callback();
    } else if (Date.now() - startTime < maxWait) {
      setTimeout(check, 100);
    }
  };
  check();
};

// Tracking Provider Component
export function TrackingProvider({ children }) {
  // Live presence ping for the admin's "Active Visitors" panel.
  // Runs only on customer pages (the hook self-skips /admin and /employee).
  useVisitorPing();
  const trackedPagesRef = useRef(new Set());
  const eventQueueRef = useRef([]);
  const flushTimeoutRef = useRef(null);
  const initialized = useRef(false);
  
  // Flush batched events to server
  const flushEvents = useCallback(async () => {
    if (eventQueueRef.current.length === 0) return;
    
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];
    
    try {
      await axios.post(`${API}/track-batch`, {
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        events
      }).catch(() => {
        // Fallback: send events individually if batch endpoint doesn't exist
        events.forEach(event => {
          axios.post(`${API}/track-action`, {
            visitor_id: getVisitorId(),
            session_id: getSessionId(),
            ...event
          }).catch(() => {});
        });
      });
    } catch (err) {
      console.log('[Tracking] Batch send failed, using individual calls');
    }
  }, []);
  
  // Queue event for batching
  const queueEvent = useCallback((action, data) => {
    eventQueueRef.current.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Clear existing timeout and set new one
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    
    // Flush after 3 seconds of inactivity or when queue reaches 10 events
    if (eventQueueRef.current.length >= 10) {
      flushEvents();
    } else {
      flushTimeoutRef.current = setTimeout(flushEvents, 3000);
    }
  }, [flushEvents]);
  
  // Track page visit (deduped within session)
  const trackPageVisit = useCallback((page) => {
    const pageKey = `${getSessionId()}_${page}`;
    if (trackedPagesRef.current.has(pageKey)) {
      return; // Already tracked this page in this session
    }
    trackedPagesRef.current.add(pageKey);
    
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    
    // Send to enhanced analytics (for page_visits collection)
    axios.post(`${API}/track-visit?page=${page}&session_id=${sessionId}`).catch(() => {});
    
    // ALSO send to user behavior tracker (for user_page_visits collection - Admin User Journey)
    axios.post(`${API}/tracking/page-visit`, {
      visitor_id: visitorId,
      session_id: sessionId,
      page: page,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      timestamp: new Date().toISOString()
    }).catch(() => {});
    
    // Queue for batch (for tracking_events collection)
    queueEvent('page_visit', { page });
  }, [queueEvent]);
  
  // Track action
  const trackAction = useCallback((action, data = {}) => {
    queueEvent(action, data);
  }, [queueEvent]);
  
  // Meta Pixel: ViewContent
  const trackViewContent = useCallback((contentName, value = 0) => {
    waitForFbq(() => {
      window.fbq('track', 'ViewContent', {
        content_name: contentName || 'Celesta Glow',
        content_category: 'Skincare',
        content_ids: ['celesta_glow'],
        content_type: 'product',
        value: value,
        currency: 'INR'
      });
    });
  }, []);
  
  // Meta Pixel: InitiateCheckout
  const trackInitiateCheckout = useCallback((value = 699) => {
    waitForFbq(() => {
      window.fbq('track', 'InitiateCheckout', {
        content_category: 'Skincare',
        content_ids: ['celesta_glow'],
        num_items: 1,
        value: value,
        currency: 'INR'
      });
    });
  }, []);
  
  // Meta Pixel: Purchase
  const trackPurchase = useCallback((orderId, value, paymentMethod) => {
    waitForFbq(() => {
      window.fbq('track', 'Purchase', {
        content_ids: ['celesta_glow'],
        content_type: 'product',
        value: value,
        currency: 'INR',
        order_id: orderId,
        payment_method: paymentMethod
      });
    });
  }, []);
  
  // Google Analytics event
  const trackGAEvent = useCallback((eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  }, []);
  
  // Initialize tracking on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Set up DOM click tracking
    const handleClick = (e) => {
      const target = e.target.closest('button, a, [data-track]');
      if (target) {
        const buttonText = target.innerText?.trim().slice(0, 50) || '';
        if (buttonText.includes('Buy Now') || buttonText.includes('Order Now')) {
          trackAction('button_click', { button_type: 'buy_now', button_text: buttonText });
          trackGAEvent('begin_checkout', { currency: 'INR', value: 699 });
        } else if (buttonText.includes('Claim') || buttonText.includes('Add to Cart')) {
          trackAction('button_click', { button_type: 'claim_offer', button_text: buttonText });
        }
      }
    };
    
    document.addEventListener('click', handleClick, { passive: true });
    
    // Flush events before page unload
    const handleUnload = () => flushEvents();
    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('beforeunload', handleUnload);
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, [trackAction, trackGAEvent, flushEvents]);
  
  const value = {
    trackPageVisit,
    trackAction,
    trackViewContent,
    trackInitiateCheckout,
    trackPurchase,
    trackGAEvent,
    getVisitorId,
    getSessionId
  };
  
  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}

// Hook to use tracking functions
export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    // Return no-op functions if not in provider (for admin pages)
    return {
      trackPageVisit: () => {},
      trackAction: () => {},
      trackViewContent: () => {},
      trackInitiateCheckout: () => {},
      trackPurchase: () => {},
      trackGAEvent: () => {},
      getVisitorId: () => localStorage.getItem('visitorId') || 'unknown',
      getSessionId: () => sessionStorage.getItem('sessionId') || 'unknown'
    };
  }
  return context;
}

// Export utility functions for backward compatibility
export { getVisitorId, getSessionId };
