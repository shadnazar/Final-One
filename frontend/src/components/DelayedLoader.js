import React, { useState, useEffect } from 'react';

/**
 * DelayedLoader — only renders a loading spinner after `delay` ms.
 * This prevents flashes of loading UI on fast lazy-chunk loads / cached chunks
 * (which is the usual case), eliminating the "in-between blank/loading page"
 * a user sees when navigating between already-visited routes.
 */
export default function DelayedLoader({ delay = 280 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="page-loader">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-xs">Loading…</p>
      </div>
    </div>
  );
}
