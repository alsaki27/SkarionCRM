import { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
import { useAuthStore } from './stores/auth.js';
import { bootstrapAuth } from './api.js';
import DashboardPage from './pages/DashboardPage.js';
import AccountsPage from './pages/AccountsPage.js';
import AccountDetailPage from './pages/AccountDetailPage.js';
import TransactionsPage from './pages/TransactionsPage.js';
import TransactionDetailPage from './pages/TransactionDetailPage.js';
import InvoicesPage from './pages/InvoicesPage.js';
import InvoiceDetailPage from './pages/InvoiceDetailPage.js';
import ReportsPage from './pages/ReportsPage.js';
import SettingsPage from './pages/SettingsPage.js';

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  if (isLoading) return <Loading />;
  if (!user) {
    const loginUrl = import.meta.env.VITE_IDENTITY_LOGIN_URL || 'https://skarion-identity-login.pages.dev';
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${loginUrl}/?return_to=${returnTo}`;
    return <Loading />;
  }
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token) {
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
    bootstrapAuth()
      .then((authUser) => {
        if (authUser) {
          useAuthStore.getState().setUser(authUser);
        } else {
          useAuthStore.getState().setLoading(false);
        }
      })
      .catch(() => {
        useAuthStore.getState().setLoading(false);
      });
  }, []);

  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/accounts" element={<RequireAuth><AccountsPage /></RequireAuth>} />
          <Route path="/accounts/:id" element={<RequireAuth><AccountDetailPage /></RequireAuth>} />
          <Route path="/transactions" element={<RequireAuth><TransactionsPage /></RequireAuth>} />
          <Route path="/transactions/:id" element={<RequireAuth><TransactionDetailPage /></RequireAuth>} />
          <Route path="/invoices" element={<RequireAuth><InvoicesPage /></RequireAuth>} />
          <Route path="/invoices/:id" element={<RequireAuth><InvoiceDetailPage /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
