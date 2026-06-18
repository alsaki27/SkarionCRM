import React, { useState } from 'react';
import { trpc } from '../api.ts';
import LeadTable from '../components/LeadTable.tsx';

export default function Leads() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    source: 'manual',
    campaignTag: '',
  });
  const leadsQuery = trpc.lead.list.useQuery({});
  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      leadsQuery.refetch();
      setForm({ fullName: '', email: '', phone: '', location: '', source: 'manual', campaignTag: '' });
    },
  });
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Leads</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.fullName || !form.source) return;
          createLead.mutate({
            fullName: form.fullName,
            email: form.email || undefined,
            phone: form.phone || undefined,
            location: form.location || undefined,
            source: form.source,
            campaignTag: form.campaignTag || undefined,
          });
        }}
        className="space-y-2 bg-white p-4 rounded shadow"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Full Name</label>
            <input
              type="text"
              className="mt-1 w-full border rounded p-2"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              className="mt-1 w-full border rounded p-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input
              type="text"
              className="mt-1 w-full border rounded p-2"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Location</label>
            <input
              type="text"
              className="mt-1 w-full border rounded p-2"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Source</label>
            <select
              className="mt-1 w-full border rounded p-2"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="manual">Manual</option>
              <option value="linkedin">LinkedIn</option>
              <option value="apollo">Apollo</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Campaign Tag</label>
            <input
              type="text"
              className="mt-1 w-full border rounded p-2"
              value={form.campaignTag}
              onChange={(e) => setForm({ ...form, campaignTag: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          disabled={createLead.isLoading}
        >
          {createLead.isLoading ? 'Adding…' : 'Add Lead'}
        </button>
      </form>
      <div>
        {leadsQuery.isLoading && <p>Loading leads…</p>}
        {leadsQuery.error && <p>Error loading leads.</p>}
        {leadsQuery.data && <LeadTable leads={leadsQuery.data.items} />}
      </div>
    </div>
  );
}