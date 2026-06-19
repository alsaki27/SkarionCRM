import React, { useState } from 'react';
import { trpc } from '../../../api.ts';
import { Card } from '../../../components/ui/Card.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Table } from '../../../components/ui/Table.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Loading } from '../../../components/ui/Loading.tsx';
import { EmptyState } from '../../../components/ui/EmptyState.tsx';
import { addToast } from '../../../components/ui/Toast.tsx';
import {
  Plus,
  Pencil,
  Trash2,
  Umbrella,
  Check,
  X,
} from 'lucide-react';

interface LeaveType {
  id: string;
  name: string;
  type: string;
  isPaid: boolean;
  approvalRequired: boolean;
  maxDaysPerYear: number;
  accrualRate: number;
  accrualPeriod: string;
  carryOver: boolean;
  useItOrLoseIt: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const LEAVE_TYPES = ['Vacation', 'Sick', 'Personal', 'Bereavement', 'Jury Duty', 'Military', 'Unpaid', 'Other'];
const ACCRUAL_PERIODS = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Yearly', 'None'];

const emptyForm = {
  name: '',
  type: 'Vacation',
  isPaid: true,
  approvalRequired: true,
  maxDaysPerYear: 20,
  accrualRate: 0,
  accrualPeriod: 'Monthly',
  carryOver: true,
  useItOrLoseIt: false,
  isActive: true,
};

export default function LeavePolicies(): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const query = trpc.pto.listLeaveTypes.useQuery({ page, pageSize });
  const createMutation = trpc.pto.createLeaveType.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Leave type created successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to create leave type' }),
  });
  const updateMutation = trpc.pto.updateLeaveType.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Leave type updated successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to update leave type' }),
  });
  const deleteMutation = trpc.pto.deleteLeaveType.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Leave type deleted' });
      query.refetch();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to delete leave type' }),
  });

  const data = (query.data?.items ?? []) as LeaveType[];
  const total = query.data?.total ?? 0;

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (leaveType: LeaveType) => {
    setEditingId(leaveType.id);
    setForm({
      name: leaveType.name,
      type: leaveType.type,
      isPaid: leaveType.isPaid,
      approvalRequired: leaveType.approvalRequired,
      maxDaysPerYear: leaveType.maxDaysPerYear,
      accrualRate: leaveType.accrualRate,
      accrualPeriod: leaveType.accrualPeriod,
      carryOver: leaveType.carryOver,
      useItOrLoseIt: leaveType.useItOrLoseIt,
      isActive: leaveType.isActive,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ type: 'error', message: 'Leave type name is required' });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this leave type?')) {
      deleteMutation.mutate({ id });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: LeaveType) => (
        <div className="flex items-center gap-2">
          <Umbrella size={16} className="text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row: LeaveType) => <Badge variant="blue">{row.type}</Badge> },
    {
      key: 'isPaid',
      header: 'Paid',
      render: (row: LeaveType) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${row.isPaid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.isPaid ? <Check size={14} /> : <X size={14} />}
          {row.isPaid ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'approvalRequired',
      header: 'Approval',
      render: (row: LeaveType) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${row.approvalRequired ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.approvalRequired ? <Check size={14} /> : <X size={14} />}
          {row.approvalRequired ? 'Required' : 'None'}
        </span>
      ),
    },
    { key: 'maxDaysPerYear', header: 'Max Days/Year', render: (row: LeaveType) => `${row.maxDaysPerYear} days` },
    {
      key: 'accrual',
      header: 'Accrual',
      render: (row: LeaveType) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.accrualRate > 0 ? `${row.accrualRate} / ${row.accrualPeriod}` : 'No accrual'}
        </span>
      ),
    },
    {
      key: 'carryOver',
      header: 'Carry Over',
      render: (row: LeaveType) => (
        <span className={`text-xs ${row.carryOver ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {row.carryOver ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'useItOrLoseIt',
      header: 'Use/Lose',
      render: (row: LeaveType) => (
        <span className={`text-xs ${row.useItOrLoseIt ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.useItOrLoseIt ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: LeaveType) => (
        <Badge variant={row.isActive ? 'green' : 'gray'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: LeaveType) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title dark:text-gray-100">Leave Policies</h1>
          <p className="page-subtitle dark:text-gray-400">Configure paid time off, sick leave, and other leave types</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus size={16} className="mr-2" />
          Create Leave Type
        </Button>
      </div>

      <Card>
        {query.isLoading ? (
          <Loading message="Loading leave types..." />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Umbrella}
            title="No leave types"
            description="Create your first leave type to track employee time off."
            actionLabel="Create Leave Type"
            onAction={handleOpenCreate}
          />
        ) : (
          <Table
            columns={columns}
            data={data}
            keyExtractor={(row) => row.id}
            pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Edit Leave Type' : 'Create Leave Type'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isLoading || updateMutation.isLoading}
            >
              {editingId ? 'Update Leave Type' : 'Create Leave Type'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Name</label>
              <input
                type="text"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Annual Vacation"
                required
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Leave Category</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label dark:text-gray-300">Max Days / Year</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.maxDaysPerYear}
                onChange={(e) => setForm({ ...form, maxDaysPerYear: Number(e.target.value) })}
                min={0}
                step={1}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Accrual Rate</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.accrualRate}
                onChange={(e) => setForm({ ...form, accrualRate: Number(e.target.value) })}
                min={0}
                step={0.01}
                placeholder="e.g., 1.67"
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Accrual Period</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.accrualPeriod}
                onChange={(e) => setForm({ ...form, accrualPeriod: e.target.value })}
              >
                {ACCRUAL_PERIODS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="isPaid"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.isPaid}
                onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
              />
              <label htmlFor="isPaid" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Paid Leave
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="approvalRequired"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.approvalRequired}
                onChange={(e) => setForm({ ...form, approvalRequired: e.target.checked })}
              />
              <label htmlFor="approvalRequired" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Approval Required
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="carryOver"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.carryOver}
                onChange={(e) => setForm({ ...form, carryOver: e.target.checked })}
              />
              <label htmlFor="carryOver" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Carry Over to Next Year
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="useItOrLoseIt"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.useItOrLoseIt}
                onChange={(e) => setForm({ ...form, useItOrLoseIt: e.target.checked })}
              />
              <label htmlFor="useItOrLoseIt" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Use-it-or-lose-it
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input
              id="isActiveLeave"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <label htmlFor="isActiveLeave" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
