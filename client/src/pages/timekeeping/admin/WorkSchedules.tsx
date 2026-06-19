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
  Clock,
  CalendarDays,
  Check,
} from 'lucide-react';

interface WorkSchedule {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  breakDuration: number;
  workingDays: string[];
  dailyOvertimeThreshold: number;
  weeklyOvertimeThreshold: number;
  gracePeriod: number;
  roundingInterval: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyForm = {
  name: '',
  shiftStart: '09:00',
  shiftEnd: '17:00',
  breakDuration: 60,
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  dailyOvertimeThreshold: 8,
  weeklyOvertimeThreshold: 40,
  gracePeriod: 5,
  roundingInterval: 15,
  isActive: true,
};

export default function WorkSchedules(): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const query = trpc.timekeeping.listWorkSchedules.useQuery({ page, pageSize });
  const createMutation = trpc.timekeeping.createWorkSchedule.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Schedule created successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to create schedule' }),
  });
  const updateMutation = trpc.timekeeping.updateWorkSchedule.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Schedule updated successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to update schedule' }),
  });
  const deleteMutation = trpc.timekeeping.deleteWorkSchedule.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Schedule deleted' });
      query.refetch();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to delete schedule' }),
  });

  const data = (query.data?.items ?? []) as WorkSchedule[];
  const total = query.data?.total ?? 0;

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: WorkSchedule) => {
    setEditingId(schedule.id);
    setForm({
      name: schedule.name,
      shiftStart: schedule.shiftStart,
      shiftEnd: schedule.shiftEnd,
      breakDuration: schedule.breakDuration,
      workingDays: schedule.workingDays,
      dailyOvertimeThreshold: schedule.dailyOvertimeThreshold,
      weeklyOvertimeThreshold: schedule.weeklyOvertimeThreshold,
      gracePeriod: schedule.gracePeriod,
      roundingInterval: schedule.roundingInterval,
      isActive: schedule.isActive,
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
      addToast({ type: 'error', message: 'Schedule name is required' });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteMutation.mutate({ id });
    }
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: WorkSchedule) => (
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
        </div>
      ),
    },
    { key: 'shiftStart', header: 'Shift Start', render: (row: WorkSchedule) => row.shiftStart },
    { key: 'shiftEnd', header: 'Shift End', render: (row: WorkSchedule) => row.shiftEnd },
    { key: 'breakDuration', header: 'Break', render: (row: WorkSchedule) => `${row.breakDuration} min` },
    {
      key: 'workingDays',
      header: 'Working Days',
      render: (row: WorkSchedule) => (
        <div className="flex gap-1">
          {DAYS_OF_WEEK.map((day) => (
            <span
              key={day}
              className={`inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-medium ${
                row.workingDays.includes(day)
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              }`}
            >
              {day.charAt(0)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'overtime',
      header: 'OT Thresholds',
      render: (row: WorkSchedule) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.dailyOvertimeThreshold}h / {row.weeklyOvertimeThreshold}h
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: WorkSchedule) => (
        <Badge variant={row.isActive ? 'green' : 'gray'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: WorkSchedule) => (
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
          <h1 className="page-title dark:text-gray-100">Work Schedules</h1>
          <p className="page-subtitle dark:text-gray-400">Manage employee shift schedules and overtime rules</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus size={16} className="mr-2" />
          Create Schedule
        </Button>
      </div>

      <Card>
        {query.isLoading ? (
          <Loading message="Loading schedules..." />
        ) : data.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No work schedules"
            description="Create your first work schedule to define shifts and overtime rules."
            actionLabel="Create Schedule"
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
        title={editingId ? 'Edit Work Schedule' : 'Create Work Schedule'}
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
              {editingId ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label dark:text-gray-300">Schedule Name</label>
            <input
              type="text"
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Standard Day Shift"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Shift Start</label>
              <input
                type="time"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.shiftStart}
                onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Shift End</label>
              <input
                type="time"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.shiftEnd}
                onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label dark:text-gray-300">Break Duration (min)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.breakDuration}
                onChange={(e) => setForm({ ...form, breakDuration: Number(e.target.value) })}
                min={0}
                step={5}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Grace Period (min)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.gracePeriod}
                onChange={(e) => setForm({ ...form, gracePeriod: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Rounding (min)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.roundingInterval}
                onChange={(e) => setForm({ ...form, roundingInterval: Number(e.target.value) })}
                min={1}
                step={1}
              />
            </div>
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Working Days</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = form.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {isSelected && <Check size={14} />}
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Daily OT Threshold (hours)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.dailyOvertimeThreshold}
                onChange={(e) => setForm({ ...form, dailyOvertimeThreshold: Number(e.target.value) })}
                min={0}
                step={0.5}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Weekly OT Threshold (hours)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.weeklyOvertimeThreshold}
                onChange={(e) => setForm({ ...form, weeklyOvertimeThreshold: Number(e.target.value) })}
                min={0}
                step={0.5}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input
              id="isActive"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
