import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Sparkles, User, ShoppingCart } from 'lucide-react';
import { prefetchHandlers } from '../utils/routePrefetch';

/**
 * Mobile bottom navigation bar — Home / Categories / Routine / Account / Cart.
 * Visible on small screens only (lg:hidden).
 */
export default function MobileBottomNav({ cartCount = 0 }) {
  const location = useLocation();

  const items = [
    { id: 'home', label: 'Home', icon: Home, route: '/' },
    { id: 'cats', label: 'Categories', icon: LayoutGrid, route: '/categories' },
    { id: 'routine', label: 'Routine', icon: Sparkles, route: '/routine' },
    { id: 'account', label: 'Account', icon: User, route: '/account' },
    { id: 'cart', label: 'Cart', icon: ShoppingCart, route: '/cart' },
  ];

  const isActive = (route, id) => {
    if (id === 'home') return ['/', '/skincare', '/cosmetics'].includes(location.pathname);
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
    >
      <div className="grid grid-cols-5">
        {items.map(({ id, label, icon: Icon, route }) => {
          const active = isActive(route, id);
          return (
            <Link
              key={id}
              to={route}
              {...prefetchHandlers(route)}
              className="relative flex flex-col items-center justify-center py-2 gap-0.5"
              data-testid={`bottom-nav-${id}`}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? 'text-green-700' : 'text-gray-500'}
                />
                {id === 'cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-md">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-green-700' : 'text-gray-500'}`}>{label}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-b-full bg-green-700" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
