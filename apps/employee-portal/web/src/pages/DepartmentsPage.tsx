import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDepartments, createDepartment, deleteDepartment } from '../api.js';
import { useToastStore } from '../stores/toast.js';
import { Plus, Search, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DepartmentsPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['departments', search],
    queryFn: () => listDepartments(search || undefined),
  });

  const createMut = useMutation({
    mutationFn: () => createDepartment({ name: newName, description: newDesc || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      addToast('Department created', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      addToast('Department deleted', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const departments = data?.departments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
        >
          <Plus size={16} /> Add Department
        </button>
      </div>

      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 w-full max-w-sm">
        <Search size={16} className="text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full"
        />
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">New Department</h3>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!newName || createMut.isPending}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
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
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500">Description</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/departments/${d.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500">{d.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this department?')) deleteMut.mutate(d.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No departments found
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
