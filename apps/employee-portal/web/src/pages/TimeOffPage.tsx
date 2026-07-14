import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTimeOff, createTimeOff, reviewTimeOff, deleteTimeOff } from '../api.js';
import { useToastStore } from '../stores/toast.js';
import { Plus, Check, X, Trash2, Loader2 } from 'lucide-react';

export default function TimeOffPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: 'vacation', startDate: '', endDate: '', reason: '' });
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading } = useQuery({
    queryKey: ['timeOff', statusFilter],
    queryFn: () => listTimeOff(statusFilter || undefined),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createTimeOff({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeOff'] });
      setShowCreate(false);
      setForm({ type: 'vacation', startDate: '', endDate: '', reason: '' });
      addToast('Time off request submitted', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      reviewTimeOff(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeOff'] });
      addToast('Request reviewed', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTimeOff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeOff'] });
      addToast('Request deleted', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const requests = data?.timeOffRequests ?? [];

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-600',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || ''}`}
      >
        {s}
      </span>
    );
  };

  const typeLabel = (t: string) => t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Time Off</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
        >
          <Plus size={16} /> Request Time Off
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">Request Time Off</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="bereavement">Bereavement</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.startDate || !form.endDate || createMut.isPending}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Submit'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="border border-slate-200 px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500">Dates</th>
                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500">Reason</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{typeLabel(r.type)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.startDate} → {r.endDate}
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => reviewMut.mutate({ id: r.id, status: 'approved' })}
                            className="text-green-600 hover:text-green-800 p-1"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => reviewMut.mutate({ id: r.id, status: 'rejected' })}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this request?')) deleteMut.mutate(r.id);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No time off requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
