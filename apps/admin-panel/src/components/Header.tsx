import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User as UserIcon, CheckCircle2, RefreshCw, Menu } from 'lucide-react';
import { QuickConfirmModal } from './QuickConfirmModal';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing, onMenuClick }) => {
  const { user, logout } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <>
      <header className="h-[calc(3.5rem+env(safe-area-inset-top))] sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between flex-shrink-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs tracking-wide transition shadow-sm flex-shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Confirm Order Code</span>
            <span className="xs:hidden sm:hidden">Confirm</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex-shrink-0"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 max-w-[150px] sm:max-w-none">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                <span className="truncate">{user.email || user.displayName}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Not signed in</span>
          )}
        </div>
      </header>

      {showConfirmModal && (
        <QuickConfirmModal onClose={() => setShowConfirmModal(false)} />
      )}
    </>
  );
};
