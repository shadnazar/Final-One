/**
 * useVisitorPing — anonymous presence ping for the Live Visitors panel.
 *
 * Fires once on mount (and after every route change) + every 60s while the tab
 * stays open + on tab-visibility resume. Fails silently — visitor tracking is
 * best-effort and must never break the storefront.
 *
 * Stable session id is stored in localStorage so reloads don't spawn ghost
 * visitors.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'cg_visitor_session';
const PING_INTERVAL_MS = 60_000;

function getSessionId() {
  if (typeof window === 'undefined') return 'srv';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = 'cg_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function nicheFromPath(pathname) {
  if (!pathname) return null;
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg === 'cosmetics') return 'cosmetics';
  if (seg === 'skincare') return 'skincare';
  if (seg === 'anti-aging') return 'anti-aging';
  return null;
}

function productSlugFromPath(pathname) {
  const m = /^\/product\/([^/?#]+)/.exec(pathname || '');
  return m ? decodeURIComponent(m[1]) : null;
}

export default function useVisitorPing() {
  const location = useLocation();

  useEffect(() => {
    // Skip admin / employee panels — those views are for staff, not customers,
    // and we don't want our own admins polluting the live visitors list.
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/employee')) {
      return undefined;
    }

    const sessionId = getSessionId();

    const buildPayload = () => {
      let customer = {};
      try {
        const raw = localStorage.getItem('cg_customer') || sessionStorage.getItem('cg_customer');
        if (raw) {
          const c = JSON.parse(raw);
          customer = {
            customer_email: c?.email || null,
            customer_phone: c?.phone || null,
            customer_name:  c?.name  || null,
          };
        }
      } catch { /* ignore */ }
      return {
        session_id:    sessionId,
        path:          location.pathname + (location.search || ''),
        title:         (typeof document !== 'undefined' ? document.title : '').slice(0, 140),
        niche:         nicheFromPath(location.pathname),
        product_slug:  productSlugFromPath(location.pathname),
        referrer:      typeof document !== 'undefined' ? document.referrer : '',
        ...customer,
      };
    };

    const ping = () => {
      axios.post(`${API}/api/visitor/ping`, buildPayload()).catch(() => {});
    };

    ping(); // immediate ping on route change
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        ping();
      }
    }, PING_INTERVAL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [location.pathname, location.search]);
}
