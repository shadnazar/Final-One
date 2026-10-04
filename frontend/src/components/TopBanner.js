import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * TopBanner — admin-editable hero image at the very top of the homepage.
 * Fetches its own config from /api/top-banner (independent of niche hero).
 * Renders nothing if unset or disabled by admin.
 */
export default function TopBanner() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API}/api/top-banner`).then(r => {
      if (mounted) setCfg(r.data || {});
    }).catch(() => { if (mounted) setCfg({}); });
    return () => { mounted = false; };
  }, []);

  if (!cfg || !cfg.is_active || !(cfg.image_desktop || cfg.image_mobile)) return null;

  const to = cfg.link_url || '/shop?niche=anti-aging';
  const external = /^https?:\/\//.test(to);

  const inner = (
    <picture>
      {cfg.image_mobile && <source media="(max-width: 640px)" srcSet={cfg.image_mobile} />}
      <img
        src={cfg.image_desktop || cfg.image_mobile}
        alt="Celesta Glow Anti-Aging — shop the collection"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="w-full h-auto block object-cover"
      />
    </picture>
  );

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-2 sm:pt-3" data-testid="homepage-top-banner">
      {external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" className="block rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-emerald-100 shadow-sm hover:shadow-md transition-shadow bg-white">
          {inner}
        </a>
      ) : (
        <Link to={to} className="block rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-emerald-100 shadow-sm hover:shadow-md transition-shadow bg-white">
          {inner}
        </Link>
      )}
    </section>
  );
}
