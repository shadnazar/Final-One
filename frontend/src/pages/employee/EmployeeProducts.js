/**
 * EmployeeProducts — same product CRUD as the admin panel but auth via X-Employee-Token.
 *
 * Implementation: render AdminProducts inside an employee shell that mirrors the
 * employee token into `sessionStorage.adminToken`. The mirroring happens
 * SYNCHRONOUSLY (during the lazy import resolution, before AdminProducts ever
 * mounts) — putting it in useEffect would race AdminProducts' own bootstrap
 * effect, which redirects to `/admin` when no token is found.
 *
 * Backend's `verify_auth` accepts employee tokens in the X-Admin-Token header
 * transparently, so all of AdminProducts' axios calls just work.
 */
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminProducts from '../admin/AdminProducts';

function syncEmployeeTokenToAdminToken() {
  if (typeof window === 'undefined') return null;
  const token =
    sessionStorage.getItem('employeeToken') ||
    localStorage.getItem('employeeToken');
  if (token) {
    sessionStorage.setItem('adminToken', token);
  }
  return token;
}

// Run once at module load so AdminProducts sees the token on its very first
// render. Subsequent navigations call the same helper inside the component to
// keep the mirror fresh.
syncEmployeeTokenToAdminToken();

export default function EmployeeProducts() {
  const [token] = useState(() => syncEmployeeTokenToAdminToken());

  if (!token) return <Navigate to="/employee/login" replace />;

  // Permission gate — keeps the page locked even if the route is hit directly
  let allowed = true;
  try {
    const data =
      sessionStorage.getItem('employeeData') ||
      localStorage.getItem('employeeData');
    const parsed = JSON.parse(data || '{}');
    allowed = !!parsed?.permissions?.products;
  } catch {
    allowed = false;
  }
  if (!allowed) return <Navigate to="/employee/dashboard" replace />;

  return <AdminProducts />;
}
