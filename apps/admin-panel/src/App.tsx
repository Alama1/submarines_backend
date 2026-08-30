import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { RecipesPage } from './pages/RecipesPage';
import { PricesPage } from './pages/PricesPage';
import { DiscountsPage } from './pages/DiscountsPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30s
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, backendAuthorized, authError, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Authenticating Workshop Admin...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-rose-600 max-w-md">{authError}</p>
        <button
          onClick={() => logout()}
          className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!backendAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Checking admin allowlist...
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="recipes" element={<RecipesPage />} />
              <Route path="prices" element={<PricesPage />} />
              <Route path="discounts" element={<DiscountsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
