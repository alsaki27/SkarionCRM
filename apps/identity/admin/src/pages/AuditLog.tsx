import { useEffect, useState } from 'react';
import { listAuditLog, type AuditLogEntry } from '../api.js';

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    listAuditLog(pageSize, offset).then((r) => setEntries(r.entries));
  }, [offset]);

  return (
    <div>
      <h2>Audit Log</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e4e4e7' }}>
            <th style={{ padding: 8 }}>When</th>
            <th style={{ padding: 8 }}>Action</th>
            <th style={{ padding: 8 }}>Resource</th>
            <th style={{ padding: 8 }}>App</th>
            <th style={{ padding: 8 }}>Actor</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
              <td style={{ padding: 8 }}>{new Date(e.createdAt).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{e.action}</td>
              <td style={{ padding: 8 }}>
                {e.resourceType}:{e.resourceId.slice(0, 8)}
              </td>
              <td style={{ padding: 8 }}>{e.app ?? '-'}</td>
              <td style={{ padding: 8 }}>{e.actorUserId?.slice(0, 8) ?? 'system'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - pageSize))}>
          Previous
        </button>
        <button disabled={entries.length < pageSize} onClick={() => setOffset((o) => o + pageSize)}>
          Next
        </button>
      </div>
    </div>
  );
}
