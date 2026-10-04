import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, FileText, Sparkles, Users, BarChart3, Globe, Stethoscope,
  LogOut, Menu, X, Home, RefreshCw, ShoppingBag, Phone
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MENU_ITEMS = [
  { key: 'orders', label: 'Orders', icon: Package, path: '/employee/orders' },
  { key: 'products', label: 'Products', icon: ShoppingBag, path: '/employee/products' },
  { key: 'customers', label: 'Customers', icon: Users, path: '/employee/customers' },
  { key: 'retention', label: 'Retention', icon: Phone, path: '/employee/retention' },
  { key: 'blogs', label: 'Blogs', icon: FileText, path: '/employee/blogs' },
  { key: 'ai_studio', label: 'AI Studio', icon: Sparkles, path: '/employee/ai-studio' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, path: '/employee/analytics' },
  { key: 'landing_pages', label: 'Landing Pages', icon: Globe, path: '/employee/landing-pages' },
  { key: 'consultations', label: 'Consultations', icon: Stethoscope, path: '/employee/consultations' },
];

function EmployeeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const verifyEmployee = async () => {
      const token = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');
      const storedData = sessionStorage.getItem('employeeData') || localStorage.getItem('employeeData');
      
      if (!token) {
        navigate('/employee/login');
        return;
      }

      try {
        const res = await axios.get(`${API}/api/employee/verify`, {
          headers: { 'X-Employee-Token': token }
        });
        
        if (res.data.valid) {
          setEmployee({
            username: res.data.username,
            permissions: res.data.permissions,
            ...JSON.parse(storedData || '{}')
          });
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error('Verification failed:', err);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    verifyEmployee();
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('employeeToken');
    sessionStorage.removeItem('employeeData');
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('employeeData');
    navigate('/employee/login');
  };

  const allowedMenuItems = MENU_ITEMS.filter(item => employee?.permissions?.[item.key]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu size={24} />
        </button>
        <h1 className="font-bold text-gray-900">Celesta Glow</h1>
        <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-lg text-red-500">
          <LogOut size={20} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 transform transition-transform
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">CG</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Employee Panel</h2>
                <p className="text-xs text-gray-500">@{employee.username}</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <Link
            to="/employee/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              location.pathname === '/employee/dashboard'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Home size={20} />
            Dashboard
          </Link>

          {allowedMenuItems.map(item => (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                location.pathname === item.path
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-6">
        {location.pathname === '/employee/dashboard' ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {employee.name || employee.username}!</h1>
              <p className="text-gray-500">Select a section from the menu to get started</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allowedMenuItems.map(item => (
                <Link
                  key={item.key}
                  to={item.path}
                  className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500 transition-colors">
                    <item.icon className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {item.key === 'orders' && 'View and manage orders'}
                    {item.key === 'products' && 'Add / edit products'}
                    {item.key === 'customers' && 'View customer information'}
                    {item.key === 'retention' && 'Run 15/30-day follow-up calls'}
                    {item.key === 'blogs' && 'Manage blog posts'}
                    {item.key === 'ai_studio' && 'AI content generation'}
                    {item.key === 'analytics' && 'View analytics data'}
                    {item.key === 'landing_pages' && 'Manage SEO pages'}
                    {item.key === 'consultations' && 'View skin consultations'}
                  </p>
                </Link>
              ))}
            </div>

            {allowedMenuItems.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
                <p className="text-yellow-800">No sections have been assigned to your account yet.</p>
                <p className="text-yellow-600 text-sm mt-1">Please contact your administrator.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <p className="text-gray-500">This section is under construction. Please use the admin panel for full functionality.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default EmployeeDashboard;
