import { useEffect } from 'react';

/**
 * Cookie Consent Component
 * Auto-accepts cookies when user interacts with any CTA button
 * No popup shown - consent is implied by using the site
 * (Consent notice is included in the Discount Popup)
 */
function CookieConsent() {
  useEffect(() => {
    // Initialize visitor tracking immediately (consent implied by site usage)
    initializeTracking();
    
    // Also listen for any CTA clicks to ensure consent is recorded
    const handleClick = (e) => {
      const target = e.target.closest('button, a');
      if (target) {
        const text = target.innerText?.toLowerCase() || '';
        const isCTA = text.includes('buy') || 
                      text.includes('order') || 
                      text.includes('claim') || 
                      text.includes('start') ||
                      text.includes('shop') ||
                      text.includes('get');
        
        if (isCTA) {
          acceptCookies();
        }
      }
    };
    
    document.addEventListener('click', handleClick, { passive: true });
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const initializeTracking = () => {
    // Generate unique visitor ID if not exists
    if (!localStorage.getItem('visitorId')) {
      const visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('visitorId', visitorId);
      localStorage.setItem('visitorFirstSeen', new Date().toISOString());
    }
    
    // Generate session ID if not exists
    if (!sessionStorage.getItem('sessionId')) {
      const sessionId = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
      sessionStorage.setItem('sessionStartTime', Date.now().toString());
    }
  };

  const acceptCookies = () => {
    if (!localStorage.getItem('cookieConsent')) {
      localStorage.setItem('cookieConsent', 'accepted');
      localStorage.setItem('cookieConsentDate', new Date().toISOString());
    }
  };

  // No UI - consent is implied
  return null;
}

export default CookieConsent;
