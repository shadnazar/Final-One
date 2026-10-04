import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Plus, Edit, Trash2, Key, Shield, Eye, EyeOff,
  Package, FileText, Sparkles, UserCheck, BarChart3, Globe, Stethoscope,
  Check, X, RefreshCw, Copy, CheckCircle
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = process.env.REACT_APP_BACKEND_URL;

const PERMISSION_OPTIONS = [
  { key: 'orders', label: 'Orders', icon: Package, description: 'View and manage orders' },
  { key: 'products', label: 'Products', icon: Package, description: 'Add / edit products + combos' },
  { key: 'customers', label: 'Customers', icon: UserCheck, description: 'View customer data' },
  { key: 'retention', label: 'Retention', icon: RefreshCw, description: 'Run 15/30-day follow-up calls' },
  { key: 'blogs', label: 'Blogs', icon: FileText, description: 'Manage blog posts' },
  { key: 'ai_studio', label: 'AI Studio', icon: Sparkles, description: 'Access AI content tools' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, description: 'View analytics data' },
  { key: 'landing_pages', label: 'Landing Pages', icon: Globe, description: 'Manage SEO pages' },
  { key: 'consultations', label: 'Consultations', icon: Stethoscope, description: 'View skin consultations' },
];

function AdminEmployees() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  
  const [newEmployee, setNewEmployee] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    permissions: {
      orders: false,
      products: false,
      customers: false,
      retention: false,
      blogs: false,
      ai_studio: false,
      analytics: false,
      landing_pages: false,
      consultations: false
    }
  });
  
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchEmployees = async (token) => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/admin/employees`, {
        headers: { 'X-Admin-Token': token }
      });
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && adminToken) {
      fetchEmployees(adminToken);
    }
  }, [authLoading, isAuthenticated, adminToken]);

  const handleCreateEmployee = async () => {
    if (!newEmployee.username || !newEmployee.name) return;
    
    try {
      const res = await axios.post(`${API}/api/admin/employees`, newEmployee, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      if (res.data.success) {
        setCreatedCredentials({
          username: res.data.username,
          email: res.data.email,
          password: res.data.password,
          login_url: res.data.login_url,
          login_message: res.data.login_message,
        });
        fetchEmployees(adminToken);
        setNewEmployee({
          username: '',
          name: '',
          email: '',
          password: '',
          permissions: {
            orders: false,
            products: false,
            customers: false,
            retention: false,
            blogs: false,
            ai_studio: false,
            analytics: false,
            landing_pages: false,
            consultations: false
          }
        });
      } else {
        alert(res.data.error || 'Failed to create employee');
      }
    } catch (err) {
      alert('Failed to create employee');
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedEmployee || !newPassword) return;
    
    try {
      await axios.post(`${API}/api/admin/employees/update-password`, {
        username: selectedEmployee.username,
        new_password: newPassword
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      setShowPasswordModal(false);
      setSelectedEmployee(null);
      setNewPassword('');
      alert('Password updated successfully!');
    } catch (err) {
      alert('Failed to update password');
    }
  };

  const handleTogglePermission = async (employee, permKey) => {
    const newPermissions = {
      ...employee.permissions,
      [permKey]: !employee.permissions[permKey]
    };
    
    try {
      await axios.post(`${API}/api/admin/employees/update-permissions`, {
        username: employee.username,
        permissions: newPermissions
      }, {
        headers: { 'X-Admin-Token': adminToken }
      });
      
      fetchEmployees(adminToken);
    } catch (err) {
      alert('Failed to update permissions');
    }
  };

  const handleDeleteEmployee = async (username) => {
    if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    
    try {
      await axios.delete(`${API}/api/admin/employees/${username}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      fetchEmployees(adminToken);
    } catch (err) {
      alert('Failed to delete employee');
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-500 text-sm">Create and manage employee accounts with role-based access</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Permissions</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Last Login</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No employees yet. Create your first employee account.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.username} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{emp.name}</p>
                          <p className="text-sm text-gray-500">@{emp.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {PERMISSION_OPTIONS.map(perm => (
                          <button
                            key={perm.key}
                            onClick={() => handleTogglePermission(emp, perm.key)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              emp.permissions[perm.key]
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                            title={`Click to ${emp.permissions[perm.key] ? 'disable' : 'enable'} ${perm.label}`}
                          >
                            {perm.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {emp.last_login ? new Date(emp.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowPasswordModal(true);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Change Password"
                        >
                          <Key size={18} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.username)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Employee"
                        >
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Employee</h2>
              <p className="text-sm text-gray-500 mt-1">Set up account and permissions</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={newEmployee.username}
                  onChange={(e) => setNewEmployee({...newEmployee, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="johndoe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal text-xs">(optional — they can sign in with username OR email)</span></label>
                <input
                  type="email"
                  autoComplete="off"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value.toLowerCase().trim()})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="employee@yourcompany.com"
                  data-testid="new-employee-email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400 font-normal text-xs">(optional — auto-generated if blank)</span></label>
                <input
                  type="text"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  placeholder="Leave blank to auto-generate"
                />
                <p className="text-[11px] text-gray-400 mt-1">Tip: leading/trailing spaces are auto-trimmed so copy-paste always works.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {PERMISSION_OPTIONS.map(perm => (
                    <label key={perm.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={newEmployee.permissions[perm.key]}
                        onChange={(e) => setNewEmployee({
                          ...newEmployee,
                          permissions: {...newEmployee.permissions, [perm.key]: e.target.checked}
                        })}
                        className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <perm.icon size={20} className="text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedCredentials(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEmployee}
                disabled={!newEmployee.username || !newEmployee.name}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                Create Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Credentials Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Employee Created!</h2>
              <p className="text-sm text-gray-500 mb-4">Share these credentials with the employee:</p>
              
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Username</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded-lg border text-sm">{createdCredentials.username}</code>
                    <button
                      onClick={() => copyToClipboard(createdCredentials.username, 'username')}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      {copiedField === 'username' ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Password</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded-lg border text-sm">{createdCredentials.password}</code>
                    <button
                      onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      {copiedField === 'password' ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                    </button>
                  </div>
                </div>
                {createdCredentials.login_url && (
                  <div>
                    <label className="text-xs text-gray-500">Login URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded-lg border text-xs truncate" data-testid="employee-login-url">{createdCredentials.login_url}</code>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.login_url, 'url')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        {copiedField === 'url' ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                      </button>
                    </div>
                  </div>
                )}
                {createdCredentials.login_message && (
                  <div>
                    <label className="text-xs text-gray-500">Share message (paste in WhatsApp/email)</label>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 bg-white px-3 py-2 rounded-lg border text-xs whitespace-pre-wrap font-sans" data-testid="employee-share-msg">{createdCredentials.login_message}</pre>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.login_message, 'msg')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        {copiedField === 'msg' ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-red-500 mt-3">Save these credentials! The password won't be shown again.</p>
              
              <button
                onClick={() => {
                  setCreatedCredentials(null);
                  setShowCreateModal(false);
                }}
                className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Password Modal */}
      {showPasswordModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Update Password</h2>
              <p className="text-sm text-gray-500 mt-1">For {selectedEmployee.name} (@{selectedEmployee.username})</p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff size={18} className="text-gray-400" /> : <Eye size={18} className="text-gray-400" />}
                </button>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedEmployee(null);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={!newPassword}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmployees;
