import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEmployees, createEmployee, deleteEmployee } from '../api.js';
import { useToastStore } from '../stores/toast.js';
import { Plus, Search, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    employeeNumber: '',
    position: '',
    departmentId: '',
    hireDate: '',
    salary: '',
  });
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: () => listEmployees(search || undefined),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createEmployee({
        userId: form.userId,
        employeeNumber: form.employeeNumber || null,
        position: form.position || null,
        departmentId: form.departmentId || null,
        hireDate: form.hireDate || null,
        salary: form.salary ? Number(form.salary) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowCreate(false);
      setForm({
        userId: '',
        employeeNumber: '',
        position: '',
        departmentId: '',
        hireDate: '',
        salary: '',
      });
      addToast('Employee created', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      addToast('Employee deleted', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const employees = data?.employees ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 w-full max-w-sm">
        <Search size={16} className="text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Search by number or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full"
        />
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">New Employee</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="User ID (identity UUID)"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="text"
              placeholder="Employee Number"
              value={form.employeeNumber}
              onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="text"
              placeholder="Position"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="text"
              placeholder="Department ID"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="date"
              placeholder="Hire Date"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              type="number"
              placeholder="Salary"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.userId || createMut.isPending}
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
                <th className="px-4 py-3 font-medium text-slate-500">Employee #</th>
                <th className="px-4 py-3 font-medium text-slate-500">Position</th>
                <th className="px-4 py-3 font-medium text-slate-500">Hire Date</th>
                <th className="px-4 py-3 font-medium text-slate-500">Salary</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/employees/${e.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{e.employeeNumber ?? '—'}</td>
                  <td className="px-4 py-3">{e.position ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.hireDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.salary ? `${e.salaryCurrency} ${e.salary.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (confirm('Delete this employee?')) deleteMut.mutate(e.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No employees found
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
