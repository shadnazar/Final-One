import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// This component scrolls to top when route changes
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top immediately when route changes
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default ScrollToTop;
