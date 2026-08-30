import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Anchor, ShieldCheck } from 'lucide-react';
import { isFirebaseConfigured } from '../lib/firebase';

export const LoginPage: React.FC = () => {
  const { user, login, loading, authError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onLogin = async () => {
    setLocalError(null);
    try {
      await login();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const error = localError || authError;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-5">
          <Anchor className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">FF14 Submarines Admin</h1>
        <p className="text-sm text-slate-500 mb-8">
          Restricted management console. Sign in with your authorized admin account.
        </p>

        {!isFirebaseConfigured && (
          <p className="mb-6 text-xs text-amber-600 text-left leading-relaxed">
            Firebase web config is missing. In Portainer, set FIREBASE_API_KEY,
            FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, and FIREBASE_APP_ID on the
            admin-panel service, then recreate the container.
          </p>
        )}

        {error && <p className="mb-6 text-xs text-rose-600 text-left leading-relaxed">{error}</p>}

        <button
          onClick={onLogin}
          disabled={loading || !isFirebaseConfigured}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27a7.22 7.22 0 0 1 0-4.54V6.58H1.25a12.004 12.004 0 0 0 0 10.84l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Protected by Firebase & Backend Email Allowlist</span>
        </div>
      </div>
    </div>
  );
};
