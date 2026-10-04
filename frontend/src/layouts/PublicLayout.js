import React, { useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Navigation from '../components/Navigation';
import MobileBottomNav from '../components/MobileBottomNav';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import { useTracking } from '../providers/TrackingProvider';

// Lazy load heavy components that aren't immediately visible
const CookieConsent = lazy(() => import('../components/CookieConsent'));

// Simple loading fallback (empty, so no flash)
const EmptyFallback = () => null;

function PublicLayout({ children }) {
  const { trackPageVisit } = useTracking();
  const location = useLocation();

  // Fire trackPageVisit on every route change so admin live visitors stay accurate
  useEffect(() => {
    try {
      // Normalise some dynamic routes (product/blog detail) so we don't blow up cardinality
      let page = location.pathname || '/';
      if (page.startsWith('/product/')) page = '/product';
      if (page.startsWith('/blog/')) page = '/blog-detail';
      if (page.startsWith('/order-success')) page = '/order-success';
      if (page.startsWith('/landing/')) page = '/landing';
      trackPageVisit(page);
    } catch { /* ignore */ }
  }, [location.pathname, trackPageVisit]);

  return (
    <div className="app-container min-h-screen">
      {/* Navigation - always visible */}
      <Navigation />

      {/* Main content */}
      <main className="pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav (Home / Categories / Routine / Account / Cart) */}
      <MobileBottomNav />

      {/* Footer - site-wide */}
      <Footer />

      {/* WhatsApp floating button - always visible */}
      <WhatsAppButton phoneNumber="919446125745" />

      {/* "Other Brands" availability is now controlled from the Admin panel
          (Admin → Settings), not from a floating homepage control. */}

      {/* Discount popup removed (Feb-2026) — replaced by an inline ₹50 flash-timer
          discount message on the Checkout page. See CheckoutPage.js. */}

      <Suspense fallback={<EmptyFallback />}>
        <CookieConsent />
      </Suspense>
    </div>
  );
}

export default PublicLayout;
