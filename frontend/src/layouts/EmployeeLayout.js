import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, FileText, Sparkles, Users, BarChart3, Globe, Stethoscope,
  LogOut, Menu, X, Home, RefreshCw, ChevronLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Create context for employee auth
export const EmployeeAuthContext = createContext(null);

export const useEmployeeAuth = () => {
  const context = useContext(EmployeeAuthContext);
  if (!context) {
    throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  }
  return context;
};

const MENU_ITEMS = [
  { key: 'orders', label: 'Orders', icon: Package, path: '/employee/orders' },
  { key: 'products', label: 'Products', icon: Package, path: '/employee/products' },
  { key: 'customers', label: 'Customers', icon: Users, path: '/employee/customers' },
  { key: 'retention', label: 'Retention', icon: RefreshCw, path: '/employee/retention' },
  { key: 'blogs', label: 'Blogs', icon: FileText, path: '/employee/blogs' },
  { key: 'ai_studio', label: 'AI Studio', icon: Sparkles, path: '/employee/ai-studio' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, path: '/employee/analytics' },
  { key: 'landing_pages', label: 'Landing Pages', icon: Globe, path: '/employee/landing-pages' },
  { key: 'consultations', label: 'Consultations', icon: Stethoscope, path: '/employee/consultations' },
];

function EmployeeLayout({ children, requiredPermission }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employeeToken, setEmployeeToken] = useState(null);

  useEffect(() => {
    const verifyEmployee = async () => {
      const token = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');
      const storedData = sessionStorage.getItem('employeeData') || localStorage.getItem('employeeData');
      
      if (!token) {
        navigate('/employee/login');
        return;
      }

      setEmployeeToken(token);

      try {
        const res = await axios.get(`${API}/api/employee/verify`, {
          headers: { 'X-Employee-Token': token }
        });
        
        if (res.data.valid) {
          const empData = {
            username: res.data.username,
            permissions: res.data.permissions,
            ...JSON.parse(storedData || '{}')
          };
          setEmployee(empData);
          
          // Check if employee has required permission
          if (requiredPermission && !empData.permissions[requiredPermission]) {
            navigate('/employee/dashboard');
          }
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
  }, [navigate, requiredPermission]);

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

  // Check permission
  if (requiredPermission && !employee.permissions[requiredPermission]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg font-semibold">Access Denied</p>
          <p className="text-gray-500 mt-2">You don't have permission to access this section.</p>
          <Link to="/employee/dashboard" className="mt-4 inline-block text-green-600 hover:underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <EmployeeAuthContext.Provider value={{ employee, employeeToken, isEmployee: true }}>
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
          {children}
        </main>
      </div>
    </EmployeeAuthContext.Provider>
  );
}

export default EmployeeLayout;
