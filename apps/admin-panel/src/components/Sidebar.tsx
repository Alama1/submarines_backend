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

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-screen">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-200 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <Anchor className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-slate-900">FF14 Submarines</h1>
          <p className="text-xs text-slate-500">Admin Control Center</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-200 text-xs text-slate-400 flex-shrink-0">
        <p className="font-medium text-slate-500">Louisoix FC Workshop</p>
        <p>Real-time Submersible Suite</p>
      </div>
    </aside>
  );
};
