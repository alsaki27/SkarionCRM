import { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
import { useAuthStore } from './stores/auth.js';
import { bootstrapAuth } from './api.js';
import DashboardPage from './pages/DashboardPage.js';
import DepartmentsPage from './pages/DepartmentsPage.js';
import DepartmentDetailPage from './pages/DepartmentDetailPage.js';
import EmployeesPage from './pages/EmployeesPage.js';
import EmployeeDetailPage from './pages/EmployeeDetailPage.js';
import TimeOffPage from './pages/TimeOffPage.js';
import SettingsPage from './pages/SettingsPage.js';

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  if (isLoading) return <Loading />;
  if (!user) {
    const loginUrl =
      import.meta.env.VITE_IDENTITY_LOGIN_URL || 'https://skarion-identity-login.pages.dev';
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
          useAuthStore
            .getState()
            .setUser(
              authUser as {
                id: string;
                email: string;
                name?: string;
                role: 'manager' | 'member' | '';
                isSuperadmin?: boolean;
              }
            );
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
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/departments"
            element={
              <RequireAuth>
                <DepartmentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/departments/:id"
            element={
              <RequireAuth>
                <DepartmentDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/employees"
            element={
              <RequireAuth>
                <EmployeesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <RequireAuth>
                <EmployeeDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/time-off"
            element={
              <RequireAuth>
                <TimeOffPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
