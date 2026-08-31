import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User as UserIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import { QuickConfirmModal } from './QuickConfirmModal';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing }) => {
  const { user, logout } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs tracking-wide transition shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Order Code</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-400" />
                )}
                <span>{user.email || user.displayName}</span>
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
