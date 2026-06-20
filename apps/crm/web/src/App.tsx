import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState<null | { id: string; email: string }>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('skarion_token', token);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('skarion_token');
    if (!token) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `https://auth.skarion.com/?return_to=${returnTo}`;
      return;
    }

    fetch(import.meta.env.VITE_API_URL + '/api/companies', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem('skarion_token');
          window.location.reload();
          return;
        }
        return r.json();
      })
      .then(() => setUser({ id: 'unknown', email: 'user@skarion.com' }))
      .catch(() => setUser(null));
  }, []);

  if (!user) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading CRM...</div>;
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Skarion CRM</h1>
      <p>Welcome! Dashboard coming soon.</p>
    </div>
  );
}

export default App;
