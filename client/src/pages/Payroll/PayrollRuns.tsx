import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Play,
  Ban,
  Filter,
  X,
  RotateCcw,
} from 'lucide-react';

interface PayrollRun {
  id: string;
  runName: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'draft' | 'processing' | 'completed' | 'cancelled';
  totalGross: number;
  totalNet: number;
  employeeCount: number;
}

export default function PayrollRuns(): React.ReactElement {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  const query = trpc.payroll.listRuns.useQuery({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    pageSize,
  });

  const processMutation = trpc.payroll.processRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Payroll run processed successfully');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to process run');
    },
  });

  const voidMutation = trpc.payroll.voidRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Payroll run voided');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to void run');
    },
  });

  const runs: PayrollRun[] = query.data?.runs ?? [];
  const total = query.data?.total ?? 0;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'; label: string }> = {
      draft: { variant: 'gray', label: 'Draft' },
      processing: { variant: 'purple', label: 'Processing' },
      completed: { variant: 'green', label: 'Completed' },
      cancelled: { variant: 'red', label: 'Cancelled' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleProcess = (id: string) => {
    if (!confirm('Process this payroll run? This will finalize payments.')) return;
    processMutation.mutate({ id });
  };

  const handleVoid = (id: string) => {
    if (!confirm('Void this payroll run? This action cannot be undone.')) return;
    voidMutation.mutate({ id });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || searchQuery !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Payroll Runs</h1>
          <p className="page-subtitle">Manage and process payroll periods</p>
        </div>
        <Button onClick={() => navigate('/payroll/runs/new')}>
          <Plus size={16} className="mr-2" />
          New Payroll Run
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by run name..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="form-input pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'ring-2 ring-primary-500' : ''}
            >
              <Filter size={16} className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                  {(statusFilter !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {query.isLoading && !runs.length ? (
          <Loading message="Loading payroll runs..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load payroll runs</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No payroll runs found"
            description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first payroll run to get started.'}
            actionLabel={hasActiveFilters ? undefined : 'New Payroll Run'}
            onAction={hasActiveFilters ? undefined : () => navigate('/payroll/runs/new')}
          />
        ) : (
          <Table<PayrollRun>
            columns={[
              { key: 'runName', header: 'Run Name' },
              {
                key: 'period',
                header: 'Period',
                render: (row) => `${new Date(row.periodStart).toLocaleDateString()} - ${new Date(row.periodEnd).toLocaleDateString()}`,
              },
              {
                key: 'payDate',
                header: 'Pay Date',
                render: (row) => new Date(row.payDate).toLocaleDateString(),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'totalGross',
                header: 'Total Gross',
                align: 'right',
                render: (row) => `$${row.totalGross.toLocaleString()}`,
              },
              {
                key: 'totalNet',
                header: 'Total Net',
                align: 'right',
                render: (row) => `$${row.totalNet.toLocaleString()}`,
              },
              {
                key: 'employeeCount',
                header: 'Employees',
                align: 'center',
                render: (row) => row.employeeCount,
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/payroll/runs/${row.id}`)}
                      title="View"
                    >
                      <Eye size={16} />
                    </Button>
                    {row.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcess(row.id)}
                        loading={processMutation.isPending && processMutation.variables?.id === row.id}
                        title="Process"
                      >
                        <Play size={16} className="text-green-600" />
                      </Button>
                    )}
                    {row.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVoid(row.id)}
                        loading={voidMutation.isPending && voidMutation.variables?.id === row.id}
                        title="Void"
                      >
                        <Ban size={16} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={runs}
            pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            loading={query.isLoading}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>
    </div>
  );
}
