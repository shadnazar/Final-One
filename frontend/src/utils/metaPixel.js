/**
 * Meta Pixel Conversion Tracking for Celestaglow.com
 * Pixel ID: 690863659974240
 * 
 * Implements: ViewContent, InitiateCheckout, Purchase events
 * No AddToCart event needed (direct Buy Now flow)
 */

const PIXEL_ID = '690863659974240';

// Helper function to ensure fbq is ready before calling
const waitForFbq = (callback, maxAttempts = 10) => {
  let attempts = 0;
  
  const checkFbq = () => {
    attempts++;
    if (typeof window !== 'undefined' && window.fbq) {
      callback();
    } else if (attempts < maxAttempts) {
      setTimeout(checkFbq, 200); // Retry every 200ms
    } else {
      console.warn('[Meta Pixel] fbq not available after', maxAttempts, 'attempts');
    }
  };
  
  checkFbq();
};

// Initialize Meta Pixel (backup if not loaded in HTML)
export const initMetaPixel = () => {
  if (typeof window === 'undefined') return;
  
  // Avoid re-initialization
  if (window.fbq) return;
  
  // Facebook Pixel Code
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;
    n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];
    t=b.createElement(e);t.async=!0;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
  }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
  
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
};

// ==================== STANDARD CONVERSION EVENTS ====================

/**
 * ViewContent Event - Fire on Product Page
 * Trigger: When user views the product details page
 * 
 * @param {number} value - Product price (default 699.00)
 */
export const trackViewContent = (productName = 'Celesta Glow Products', value = 999, productIds = ['celesta_glow']) => {
  waitForFbq(() => {
    window.fbq('track', 'ViewContent', {
      content_name: productName,
      content_category: 'Skincare',
      content_ids: productIds,
      content_type: 'product',
      value: value,
      currency: 'INR'
    });
    console.log('[Meta Pixel] ViewContent fired - value:', value);
  });
};

/**
 * InitiateCheckout Event - Fire on Checkout Page
 * Trigger: When user clicks "Buy Now" and lands on checkout/shipping details
 * 
 * @param {number} value - Cart value (default 699.00)
 */
export const trackInitiateCheckout = (value = 999, numItems = 1, contentIds = ['celesta_glow']) => {
  waitForFbq(() => {
    window.fbq('track', 'InitiateCheckout', {
      content_category: 'Skincare',
      content_ids: contentIds,
      num_items: numItems,
      value: value,
      currency: 'INR'
    });
    console.log('[Meta Pixel] InitiateCheckout fired - value:', value);
  });
};

/**
 * Purchase Event - Fire on Order Confirmation/Thank You Page
 * Trigger: When user successfully completes a purchase (prepaid OR COD)
 *
 * @param {string} orderId - Unique order ID (REQUIRED for dedup + CAPI event_id)
 * @param {number} value - Purchase amount (REQUIRED)
 * @param {object} extra - Optional { contents: [{id, quantity, item_price}], num_items, content_name }
 */
export const trackPurchase = (orderId, value, extra = {}) => {
  if (!orderId) {
    console.error('[Meta Pixel] Purchase event requires order_id');
    return;
  }

  waitForFbq(() => {
    const contents = Array.isArray(extra.contents) ? extra.contents : null;
    const contentIds = contents ? contents.map(c => c.id).filter(Boolean) : ['celesta_glow'];
    const numItems = extra.num_items || (contents ? contents.reduce((s, c) => s + (c.quantity || 1), 0) : 1);

    const payload = {
      value: Number(value) || 0,
      currency: 'INR',
      content_name: extra.content_name || 'Celesta Glow Products',
      content_category: 'Skincare',
      content_ids: contentIds,
      content_type: 'product',
      num_items: numItems,
      order_id: orderId,
    };
    if (contents) payload.contents = contents;

    // eventID enables server-side CAPI dedup with the same order_id key.
    window.fbq('track', 'Purchase', payload, { eventID: orderId });
    console.log('[Meta Pixel] Purchase fired - order_id:', orderId, 'value:', value, 'items:', numItems);
  });
};

// ==================== ADDITIONAL TRACKING EVENTS ====================

/**
 * Lead Event - Fire when user provides contact info (discount popup)
 */
export const trackLead = (source = 'discount_popup') => {
  waitForFbq(() => {
    window.fbq('track', 'Lead', {
      content_name: 'Celesta Glow Anti-Aging Range',
      content_category: 'Skincare',
      lead_source: source
    });
    console.log('[Meta Pixel] Lead fired - source:', source);
  });
};

/**
 * CompleteRegistration Event - Fire on consultation form submission
 */
export const trackCompleteRegistration = (source = 'consultation') => {
  waitForFbq(() => {
    window.fbq('track', 'CompleteRegistration', {
      content_name: 'Skin Consultation',
      status: 'completed',
      registration_source: source
    });
    console.log('[Meta Pixel] CompleteRegistration fired - source:', source);
  });
};

/**
 * Search Event - Fire when user searches blogs
 */
export const trackSearch = (searchQuery) => {
  waitForFbq(() => {
    window.fbq('track', 'Search', {
      search_string: searchQuery,
      content_category: 'Blog'
    });
  });
};

/**
 * Contact Event - Fire when user contacts via WhatsApp
 */
export const trackContact = (method = 'whatsapp') => {
  waitForFbq(() => {
    window.fbq('track', 'Contact', {
      contact_method: method
    });
    console.log('[Meta Pixel] Contact fired - method:', method);
  });
};

// ==================== CTA TRACKING ====================

/**
 * Track CTA button clicks as custom events
 */
export const trackCTAClick = (ctaName, location) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'CTAClick', {
      cta_name: ctaName,
      page_location: location,
      content_name: 'Super Anti-Aging Serum'
    });
  });
};

/**
 * Track form step completion
 */
export const trackFormStep = (stepName, stepNumber) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'FormStep', {
      step_name: stepName,
      step_number: stepNumber
    });
  });
};

/**
 * Track exit intent popup shown
 */
export const trackExitIntent = () => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'ExitIntentShown', {
      content_name: 'Super Anti-Aging Serum',
      offer: '₹100 OFF'
    });
  });
};

// ==================== PAGE VIEW TRACKING ====================

/**
 * Track specific page views with custom parameters
 */
export const trackPageView = (pageName, additionalParams = {}) => {
  waitForFbq(() => {
    window.fbq('track', 'PageView', {
      page_name: pageName,
      ...additionalParams
    });
  });
};

// ==================== LEGACY EXPORTS (for backward compatibility) ====================

// AddToCart not needed for direct Buy Now flow
export const trackAddToCart = (price = 999, quantity = 1, productName = 'Celesta Glow Products', productIds = ['celesta_glow']) => {
  waitForFbq(() => {
    window.fbq('track', 'AddToCart', {
      content_name: productName,
      content_category: 'Skincare',
      content_ids: productIds,
      value: price * quantity,
      currency: 'INR',
      num_items: quantity
    });
    console.log('[Meta Pixel] AddToCart fired - value:', price * quantity);
  });
};

// AddPaymentInfo
export const trackAddPaymentInfo = (paymentMethod, price, productIds = ['celesta_glow']) => {
  waitForFbq(() => {
    window.fbq('track', 'AddPaymentInfo', {
      content_name: 'Celesta Glow Products',
      content_category: 'Skincare',
      content_ids: productIds,
      value: price,
      currency: 'INR',
      payment_method: paymentMethod
    });
    console.log('[Meta Pixel] AddPaymentInfo fired - method:', paymentMethod);
  });
};

// Legacy tracking functions for backward compatibility
export const trackPopupDismissed = (popupType) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'PopupDismissed', { popup_type: popupType });
  });
};

export const trackBlogViewPixel = (blogTitle, blogCategory) => {
  waitForFbq(() => {
    window.fbq('track', 'ViewContent', {
      content_name: blogTitle,
      content_category: blogCategory || 'Blog',
      content_type: 'article'
    });
  });
};

// Alias for backward compatibility
export const trackBlogView = trackBlogViewPixel;

export const trackPopupShown = (popupType) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'PopupShown', { popup_type: popupType });
  });
};

export const trackViewTestimonials = () => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'ViewTestimonials', { content_name: 'Customer Testimonials' });
  });
};

export const trackTimeOnPage = (pageName, seconds) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'TimeOnPage', { page_name: pageName, time_seconds: seconds });
  });
};

export const trackFAQInteraction = (question) => {
  waitForFbq(() => {
    window.fbq('trackCustom', 'FAQInteraction', { question: question });
  });
};

// Export all functions
export default {
  initMetaPixel,
  trackViewContent,
  trackInitiateCheckout,
  trackPurchase,
  trackLead,
  trackCompleteRegistration,
  trackSearch,
  trackContact,
  trackCTAClick,
  trackFormStep,
  trackExitIntent,
  trackPageView,
  trackAddToCart,
  trackAddPaymentInfo,
  trackPopupDismissed,
  trackBlogViewPixel,
  trackBlogView,
  trackPopupShown,
  trackViewTestimonials,
  trackTimeOnPage,
  trackFAQInteraction
};
