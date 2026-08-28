import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, auth, loginWithGoogle, logoutUser, onAuthStateChanged } from '../lib/firebase';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  backendAuthorized: boolean;
  authError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  backendAuthorized: false,
  authError: null,
  login: async () => {},
  logout: async () => {},
});

function messageForAuthFailure(err: unknown): string {
  const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
  const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

  if (status === 403) {
    return 'Your Google account is signed in, but it is not on the admin allowlist (ALLOWED_EMAILS).';
  }
  if (status === 401) {
    return serverMessage || 'The API could not verify your login. Check Firebase admin credentials on the gateway.';
  }
  return 'Could not reach the API to verify admin access.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendAuthorized, setBackendAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setBackendAuthorized(false);
      setAuthError(null);
      return;
    }

    let cancelled = false;
    setBackendAuthorized(false);
    setAuthError(null);

    api
      .get('/auth/me')
      .then(() => {
        if (!cancelled) {
          setBackendAuthorized(true);
          setAuthError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBackendAuthorized(false);
          setAuthError(messageForAuthFailure(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const login = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setAuthError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setBackendAuthorized(false);
    setAuthError(null);
    await logoutUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, backendAuthorized, authError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
