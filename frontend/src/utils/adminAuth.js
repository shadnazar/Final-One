/**
 * Admin Authentication Utilities
 * Uses sessionStorage with localStorage fallback for backward compatibility
 */

import { useState, useEffect, useCallback } from 'react';

// Get admin token from sessionStorage, with localStorage fallback
export const getAdminToken = () => {
  // First check sessionStorage (primary)
  const sessionToken = sessionStorage.getItem('adminToken');
  if (sessionToken) return sessionToken;
  
  // Backward compatibility: check localStorage and migrate
  const localToken = localStorage.getItem('adminToken');
  if (localToken) {
    // Migrate to sessionStorage
    sessionStorage.setItem('adminToken', localToken);
    localStorage.removeItem('adminToken');
    return localToken;
  }
  
  return null;
};

// Set admin token in sessionStorage
export const setAdminToken = (token) => {
  sessionStorage.setItem('adminToken', token);
  localStorage.removeItem('adminToken'); // Clean up any old localStorage token
};

// Clear admin token from both storages
export const clearAdminToken = () => {
  sessionStorage.removeItem('adminToken');
  localStorage.removeItem('adminToken');
};

// Check if admin is authenticated
export const isAdminAuthenticated = () => {
  const token = getAdminToken();
  return token && token.length > 0;
};

// Admin logout helper
export const adminLogout = async (navigate, apiUrl) => {
  try {
    await fetch(`${apiUrl}/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (e) {
    // Ignore errors during logout
  }
  clearAdminToken();
  if (navigate) {
    navigate('/admin');
  }
};

/**
 * Custom hook for admin authentication
 * Properly handles the async nature of storage access and navigation
 */
export const useAdminAuth = (navigate) => {
  // Initialize with current token value synchronously
  const initialToken = getAdminToken();
  const [adminToken, setToken] = useState(initialToken);
  const [isLoading, setIsLoading] = useState(!initialToken); // Only loading if no initial token
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialToken);

  useEffect(() => {
    // Double-check token on mount (handles edge cases)
    const token = getAdminToken();
    
    if (token) {
      setToken(token);
      setIsAuthenticated(true);
      setIsLoading(false);
    } else {
      // No token found - redirect to login after a small delay
      // This delay allows for any async storage operations to complete
      setIsLoading(false);
      setIsAuthenticated(false);
      if (navigate) {
        navigate('/admin');
      }
    }
  }, []); // Run only on mount

  // Listen for storage changes (in case token is cleared in another tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'adminToken' || e.key === null) {
        const token = getAdminToken();
        setToken(token);
        setIsAuthenticated(!!token);
        if (!token && navigate) {
          navigate('/admin');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  const logout = useCallback(async (apiUrl) => {
    await adminLogout(navigate, apiUrl);
  }, [navigate]);

  return { adminToken, isLoading, isAuthenticated, logout };
};
