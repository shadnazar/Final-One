import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * BackButton — universal back navigation pill for customer-facing pages.
 *
 * Behavior: navigate(-1) if there's history; otherwise navigate("/").
 * Designed to sit at the top-left of a page just under the global header.
 */
export default function BackButton({ to, label = 'Back', className = '', testId = 'back-button' }) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-stone-700 text-xs sm:text-sm font-semibold ring-1 ring-stone-200 hover:ring-stone-300 hover:bg-stone-50 active:scale-[0.98] transition-all ${className}`}
      data-testid={testId}
      aria-label={label}
    >
      <ArrowLeft size={14} /> <span>{label}</span>
    </button>
  );
}
