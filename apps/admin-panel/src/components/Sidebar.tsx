import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Hammer,
  Coins,
  Percent,
  KeyRound,
  Anchor,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/inventory', label: 'Inventory & Stock', icon: Boxes },
  { to: '/recipes', label: 'Parts & Recipes', icon: Hammer },
  { to: '/prices', label: 'Price Management', icon: Coins },
  { to: '/discounts', label: 'Bulk Discounts', icon: Percent },
  { to: '/settings', label: 'API Keys & Settings', icon: KeyRound },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
  const content = (isMobile: boolean) => (
    <>
      {/* Brand */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-200 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <Anchor className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm tracking-wide text-slate-900">FF14 Submarines</h1>
          <p className="text-xs text-slate-500">Admin Control Center</p>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="ml-auto p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-200 text-xs text-slate-400 flex-shrink-0">
        <p className="font-medium text-slate-500">Louisoix FC Workshop</p>
        <p>Real-time Submersible Suite</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col flex-shrink-0 h-screen">
        {content(false)}
      </aside>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', !mobileOpen && 'pointer-events-none')}>
        <div
          className={cn(
            'absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col shadow-xl transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {content(true)}
        </aside>
      </div>
    </>
  );
};
