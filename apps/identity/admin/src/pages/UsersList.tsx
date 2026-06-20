import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listUsers, type AdminUserRow } from '../api.js';

export function UsersList() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listUsers()
      .then((r) => setUsers(r.users))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: '#dc2626' }}>{error}</p>;

  return (
    <div>
      <h2>Users ({users.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e4e4e7' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Apps</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Last login</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
              <td style={{ padding: 8 }}>
                <Link to={`/users/${u.id}`}>{u.displayName}</Link>
              </td>
              <td style={{ padding: 8 }}>{u.email}</td>
              <td style={{ padding: 8 }}>
                {u.appMemberships.map((m) => `${m.app}:${m.role}`).join(', ') || '-'}
              </td>
              <td style={{ padding: 8 }}>{u.disabledAt ? 'Disabled' : 'Active'}</td>
              <td style={{ padding: 8 }}>
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
