import React from 'react';

interface Lead {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string;
  createdAt: string;
}

interface Props {
  leads: Lead[];
}

// Simple table component for displaying a list of leads.  In a complete
// application you would add pagination, sorting, filtering and actions.
export default function LeadTable({ leads }: Props) {
  return (
    <table className="min-w-full border border-gray-200">
      <thead>
        <tr className="bg-gray-100 text-left">
          <th className="p-2 border-b">Name</th>
          <th className="p-2 border-b">Email</th>
          <th className="p-2 border-b">Phone</th>
          <th className="p-2 border-b">Source</th>
          <th className="p-2 border-b">Created At</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead.id} className="odd:bg-white even:bg-gray-50">
            <td className="p-2 border-b">{lead.fullName}</td>
            <td className="p-2 border-b">{lead.email ?? '—'}</td>
            <td className="p-2 border-b">{lead.phone ?? '—'}</td>
            <td className="p-2 border-b">{lead.source}</td>
            <td className="p-2 border-b">{new Date(lead.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}