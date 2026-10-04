/**
 * EmployeeRetention — re-uses the admin retention cockpit; backend endpoints accept
 * X-Employee-Token with the `retention` permission.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminRetention from '../admin/AdminRetention';

export default function EmployeeRetention() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');
    const data = sessionStorage.getItem('employeeData') || localStorage.getItem('employeeData');
    if (!token) { navigate('/employee/login'); return; }
    try {
      const parsed = JSON.parse(data || '{}');
      if (!parsed?.permissions?.retention) {
        navigate('/employee/dashboard');
        return;
      }
    } catch { /* ignore */ }
    sessionStorage.setItem('adminToken', token);
  }, [navigate]);

  return <AdminRetention />;
}
