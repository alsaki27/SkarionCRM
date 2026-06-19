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
  Search,
  FileText,
  Eye,
  Pencil,
  Send,
  FileCheck,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react';

interface W2Form {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  year: number;
  box1Wages: number;
  box2FederalTax: number;
  status: 'pending' | 'filed' | 'distributed' | 'void';
}

export default function W2List(): React.ReactElement {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  const query = trpc.w2.listW2s.useQuery({
    search: searchQuery,
    year: yearFilter === 'all' ? undefined : yearFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    pageSize,
  });

  const distributeMutation = trpc.w2.distribute.useMutation({
    onSuccess: () => {
      addToast('success', 'W2 distributed successfully');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to distribute W2');
    },
  });

  const fileMutation = trpc.w2.file.useMutation({
    onSuccess: () => {
      addToast('success', 'W2 filed successfully');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to file W2');
    },
  });

  const w2s: W2Form[] = query.data?.w2s ?? [];
  const total = query.data?.total ?? 0;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
      pending: { variant: 'yellow', label: 'Pending' },
      filed: { variant: 'green', label: 'Filed' },
      distributed: { variant: 'blue', label: 'Distributed' },
      void: { variant: 'red', label: 'Void' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDistribute = (id: string) => {
    if (!confirm('Distribute this W2 to the employee?')) return;
    distributeMutation.mutate({ id });
  };

  const handleFile = (id: string) => {
    if (!confirm('File this W2 with the IRS?')) return;
    fileMutation.mutate({ id });
  };

  const clearFilters = () => {
    setYearFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = yearFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '';
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">W2 Forms</h1>
          <p className="page-subtitle">Review, edit, and manage employee W2 forms</p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name..."
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
                  {(yearFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label mb-1">Tax Year</label>
                <select
                  value={yearFilter}
                  onChange={(e) => { setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="filed">Filed</option>
                  <option value="distributed">Distributed</option>
                  <option value="void">Void</option>
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
        {query.isLoading && !w2s.length ? (
          <Loading message="Loading W2 forms..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load W2 forms</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : w2s.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No W2 forms found"
            description={hasActiveFilters ? 'Try adjusting your filters.' : 'Generate W2 forms to get started.'}
          />
        ) : (
          <Table<W2Form>
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (row) => `${row.firstName} ${row.lastName}`,
              },
              { key: 'year', header: 'Year' },
              {
                key: 'box1Wages',
                header: 'Box 1 Wages',
                align: 'right',
                render: (row) => `$${row.box1Wages.toLocaleString()}`,
              },
              {
                key: 'box2FederalTax',
                header: 'Box 2 Federal Tax',
                align: 'right',
                render: (row) => `$${row.box2FederalTax.toLocaleString()}`,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" title="Preview">
                      <Eye size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" title="Edit">
                      <Pencil size={16} />
                    </Button>
                    {row.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDistribute(row.id)}
                        loading={distributeMutation.isPending && distributeMutation.variables?.id === row.id}
                        title="Distribute"
                      >
                        <Send size={16} className="text-blue-500" />
                      </Button>
                    )}
                    {row.status !== 'filed' && row.status !== 'void' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFile(row.id)}
                        loading={fileMutation.isPending && fileMutation.variables?.id === row.id}
                        title="File"
                      >
                        <FileCheck size={16} className="text-green-600" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={w2s}
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
