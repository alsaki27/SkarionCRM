import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Plus,
  Search,
  Play,
  PauseCircle,
  PlayCircle,
  Pencil,
  Trash2,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

export default function RecurringList(): React.ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const listQuery = trpc.recurring.listRecurring.useQuery({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    frequency: frequencyFilter === 'all' ? undefined : frequencyFilter,
    search: search || undefined,
  });

  const upcomingQuery = trpc.recurring.getUpcomingRuns.useQuery({ days: 30 });
  const accountsQuery = trpc.financial.listAccounts.useQuery();
  const contactsQuery = trpc.contact.listContacts.useQuery();

  const toggleMutation = trpc.recurring.toggleActive.useMutation({
    onSuccess: (_, vars) => {
      addToast('success', vars.isActive ? 'Recurring transaction activated' : 'Recurring transaction deactivated');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const generateRunMutation = trpc.recurring.generateRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Run generated successfully');
      listQuery.refetch();
      upcomingQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const deleteMutation = trpc.recurring.deleteRecurring.useMutation({
    onSuccess: () => {
      addToast('success', 'Recurring transaction deleted');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const accountMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (accountsQuery.data ?? []).forEach((acc: any) => map.set(acc.id, acc.name));
    return map;
  }, [accountsQuery.data]);

  const contactMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (contactsQuery.data ?? []).forEach((c: any) => map.set(c.id, c.fullName || c.name));
    return map;
  }, [contactsQuery.data]);

  const frequencies = [
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'semiannually',
    'annually',
  ];

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'accountId',
      header: 'Account',
      render: (row: any) => (
        <span className="text-sm text-gray-700">{accountMap.get(row.accountId) || row.accountId || '—'}</span>
      ),
    },
    {
      key: 'contactId',
      header: 'Contact',
      render: (row: any) => (
        <span className="text-sm text-gray-700">{contactMap.get(row.contactId) || row.contactId || '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-mono text-sm font-medium text-gray-900">
          ${(row.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { key: 'frequency', header: 'Frequency' },
    {
      key: 'nextRunDate',
      header: 'Next Run',
      render: (row: any) => (
        <span className="text-sm text-gray-700">
          {row.nextRunDate ? new Date(row.nextRunDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: any) => (
        <Badge variant={row.isActive ? 'green' : 'gray'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'totalRuns',
      header: 'Total Runs',
      align: 'center' as const,
      render: (row: any) => <span className="text-sm text-gray-700">{row.totalRuns ?? 0}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: any) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMutation.mutate({ id: row.id, isActive: !row.isActive });
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateRunMutation.mutate({ id: row.id });
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Run Now"
          >
            <Play size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/recurring/${row.id}/edit`);
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this recurring transaction?')) {
                deleteMutation.mutate({ id: row.id });
              }
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const total = listQuery.data?.total ?? 0;
  const items = listQuery.data?.items ?? [];

  const upcomingRuns = (upcomingQuery.data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Recurring Transactions</h1>
          <p className="page-subtitle">Manage automated recurring transactions</p>
        </div>
        <Button onClick={() => navigate('/recurring/new')}>
          <Plus size={16} className="mr-1" />
          New Recurring
        </Button>
      </div>

      {/* Upcoming Runs */}
      <Card title="Upcoming Runs" subtitle={`Next ${upcomingRuns.length} scheduled runs`}>
        {upcomingQuery.isLoading ? (
          <Loading size="sm" />
        ) : upcomingRuns.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming runs"
            description="No recurring transactions are scheduled in the next 30 days."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {upcomingRuns.map((run: any, index: number) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-gray-500">
                  <CalendarDays size={14} />
                  <span className="text-xs font-medium">
                    {run.date ? new Date(run.date).toLocaleDateString() : '—'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900 truncate">{run.name || 'Unnamed'}</p>
                <p className="mt-1 font-mono text-sm font-medium text-gray-700">
                  ${(run.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Filters + Table */}
      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search recurring transactions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                className="form-input w-36"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={frequencyFilter}
                onChange={(e) => { setFrequencyFilter(e.target.value); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Frequencies</option>
                {frequencies.map((f) => (
                  <option key={f} value={f}>{f.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {listQuery.isLoading ? (
            <Loading />
          ) : listQuery.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Failed to load recurring transactions"
              description="There was an error loading the data."
              actionLabel="Retry"
              onAction={() => listQuery.refetch()}
            />
          ) : (
            <Table
              columns={columns}
              data={items}
              keyExtractor={(row) => row.id}
              pagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              emptyMessage="No recurring transactions found"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
