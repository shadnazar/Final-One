/**
 * AdminAuthWrapper.jsx
 * Wraps admin routes to ensure authentication before rendering
 * SIMPLIFIED - just check token once on mount, don't recheck on every route change
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminToken } from '../utils/adminAuth';

const AdminAuthWrapper = ({ children }) => {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState('checking'); // 'checking', 'authenticated', 'unauthenticated'

  useEffect(() => {
    // Check token immediately
    const token = getAdminToken();
    
    if (token) {
      setAuthState('authenticated');
    } else {
      setAuthState('unauthenticated');
      navigate('/admin', { replace: true });
    }
  }, []); // Only run once on mount - NOT on route changes

  // Show loading while checking
  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If not authenticated, don't render
  if (authState === 'unauthenticated') {
    return null;
  }

  return children;
};

export default AdminAuthWrapper;
