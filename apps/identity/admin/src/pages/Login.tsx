import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, mfaCode || undefined);
      await refresh();
      navigate('/users');
    } catch (err) {
      if (err instanceof ApiError && err.message.includes('MFA code required')) {
        setNeedsMfa(true);
        setError('Enter your authenticator code.');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <h1 style={{ fontSize: 18 }}>Skarion Identity Admin</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {needsMfa && (
          <input
            type="text"
            placeholder="6-digit MFA code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
          />
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
