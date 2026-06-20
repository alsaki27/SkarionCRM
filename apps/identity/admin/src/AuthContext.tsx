import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { me, tryRefresh, type MeResponse } from './api.js';

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  isSuperadmin: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Access policy per ticket 1.6: crm:superadmin OR books:superadmin. */
function checkIsSuperadmin(user: MeResponse | null): boolean {
  if (!user) return false;
  return user.apps.crm === 'superadmin' || user.apps.books === 'superadmin';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // On a fresh page load there's no access token yet (it's memory-only);
      // try a silent refresh from the cookie before giving up.
      const ok = await tryRefresh();
      if (ok) {
        setUser(await me());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isSuperadmin: checkIsSuperadmin(user), refresh: load }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
