import React, { useState, useMemo } from 'react';
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
  CalendarDays,
  Upload,
  Filter,
  Globe,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'Public' | 'Company' | 'Floating';
  country: string;
  state: string | null;
  isPaid: boolean;
  isRecurring: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const HOLIDAY_TYPES = ['Public', 'Company', 'Floating'];

const emptyForm = {
  date: '',
  name: '',
  type: 'Public' as 'Public' | 'Company' | 'Floating',
  country: 'USA',
  state: '',
  isPaid: true,
  isRecurring: false,
  description: '',
};

export default function HolidayCalendar(): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterCountry, setFilterCountry] = useState('');
  const [bulkText, setBulkText] = useState('');
  const pageSize = 10;

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    year: filterYear ? Number(filterYear) : undefined,
    country: filterCountry || undefined,
  }), [page, pageSize, filterYear, filterCountry]);

  const query = trpc.pto.listHolidays.useQuery(queryParams);
  const createMutation = trpc.pto.createHoliday.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Holiday added successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to add holiday' }),
  });
  const updateMutation = trpc.pto.updateHoliday.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Holiday updated successfully' });
      query.refetch();
      handleCloseModal();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to update holiday' }),
  });
  const deleteMutation = trpc.pto.deleteHoliday.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Holiday deleted' });
      query.refetch();
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to delete holiday' }),
  });
  const bulkCreateMutation = trpc.pto.bulkCreateHolidays.useMutation({
    onSuccess: (result) => {
      addToast({ type: 'success', message: `${result.count} holidays imported successfully` });
      query.refetch();
      setIsBulkModalOpen(false);
      setBulkText('');
    },
    onError: (err) => addToast({ type: 'error', message: err.message || 'Failed to import holidays' }),
  });

  const data = (query.data?.items ?? []) as Holiday[];
  const total = query.data?.total ?? 0;

  const countries = useMemo(() => {
    const set = new Set<string>();
    data.forEach((h) => set.add(h.country));
    return Array.from(set).sort();
  }, [data]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (holiday: Holiday) => {
    setEditingId(holiday.id);
    setForm({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      country: holiday.country,
      state: holiday.state ?? '',
      isPaid: holiday.isPaid,
      isRecurring: holiday.isRecurring,
      description: holiday.description ?? '',
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
    if (!form.name.trim() || !form.date) {
      addToast({ type: 'error', message: 'Name and date are required' });
      return;
    }
    const payload = {
      ...form,
      state: form.state || undefined,
      description: form.description || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this holiday?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBulkImport = () => {
    if (!bulkText.trim()) {
      addToast({ type: 'error', message: 'Please enter holiday data' });
      return;
    }
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const holidays = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        date: parts[0] || '',
        name: parts[1] || '',
        type: (parts[2] as 'Public' | 'Company' | 'Floating') || 'Public',
        country: parts[3] || 'USA',
        state: parts[4] || undefined,
        isPaid: parts[5] ? parts[5].toLowerCase() === 'true' : true,
        isRecurring: parts[6] ? parts[6].toLowerCase() === 'true' : false,
        description: parts[7] || undefined,
      };
    }).filter((h) => h.date && h.name);

    if (holidays.length === 0) {
      addToast({ type: 'error', message: 'No valid holiday entries found' });
      return;
    }
    bulkCreateMutation.mutate({ holidays });
  };

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (row: Holiday) => (
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row: Holiday) => <span className="text-gray-900 dark:text-gray-100">{row.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: Holiday) => {
        const variant = row.type === 'Public' ? 'blue' : row.type === 'Company' ? 'purple' : 'yellow';
        return <Badge variant={variant as any}>{row.type}</Badge>;
      },
    },
    {
      key: 'country',
      header: 'Country',
      render: (row: Holiday) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Globe size={14} />
          {row.country}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row: Holiday) => row.state || <span className="text-gray-400">—</span>,
    },
    {
      key: 'isPaid',
      header: 'Paid',
      render: (row: Holiday) => (
        <span className={`text-xs font-medium ${row.isPaid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.isPaid ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'isRecurring',
      header: 'Recurring',
      render: (row: Holiday) => (
        <span className={`text-xs font-medium ${row.isRecurring ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.isRecurring ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row: Holiday) => (
        <span className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: Holiday) => (
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
          <h1 className="page-title dark:text-gray-100">Holiday Calendar</h1>
          <p className="page-subtitle dark:text-gray-400">Manage public holidays, company holidays, and floating days</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsBulkModalOpen(true)}>
            <Upload size={16} className="mr-2" />
            Bulk Import
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus size={16} className="mr-2" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="form-input w-auto py-1.5 text-sm dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="form-input w-auto py-1.5 text-sm dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(filterYear || filterCountry) && (
            <button
              onClick={() => { setFilterYear(''); setFilterCountry(''); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <Card>
        {query.isLoading ? (
          <Loading message="Loading holidays..." />
        ) : data.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No holidays found"
            description="Add holidays for your organization or import them in bulk."
            actionLabel="Add Holiday"
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

      {/* Add/Edit Holiday Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Edit Holiday' : 'Add Holiday'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isLoading || updateMutation.isLoading}
            >
              {editingId ? 'Update Holiday' : 'Add Holiday'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Date</label>
              <input
                type="date"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Type</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'Public' | 'Company' | 'Floating' })}
              >
                {HOLIDAY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Holiday Name</label>
            <input
              type="text"
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., New Year's Day"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Country</label>
              <input
                type="text"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g., USA"
                required
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">State / Region (optional)</label>
              <input
                type="text"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="e.g., CA"
              />
            </div>
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Description (optional)</label>
            <textarea
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="isPaidHoliday"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.isPaid}
                onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
              />
              <label htmlFor="isPaidHoliday" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Paid Holiday
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="isRecurring"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={form.isRecurring}
                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              />
              <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Recurring Annually
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Import Holidays"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              loading={bulkCreateMutation.isLoading}
            >
              <Upload size={16} className="mr-2" />
              Import Holidays
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium">CSV Format</p>
                <p className="mt-1">Enter one holiday per line with comma-separated values:</p>
                <p className="mt-1 font-mono text-xs">date, name, type, country, state, paid, recurring, description</p>
                <p className="mt-1 text-xs">Example: 2024-12-25, Christmas Day, Public, USA, , true, true, Federal holiday</p>
              </div>
            </div>
          </div>

          <textarea
            className="form-input min-h-[200px] font-mono text-sm dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`2024-01-01, New Year's Day, Public, USA, , true, true
2024-07-04, Independence Day, Public, USA, , true, true
2024-12-25, Christmas Day, Public, USA, , true, true`}
            rows={10}
          />

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {bulkText.trim().split('\n').filter(Boolean).length} lines entered
          </p>
        </div>
      </Modal>
    </div>
  );
}
