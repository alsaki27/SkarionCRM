import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card, Button, Badge, Table, Loading, EmptyState, addToast } from '../../components/ui/index.tsx';
import {
  Plus,
  Search,
  FileText,
  Send,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  TrendingUp,
} from 'lucide-react';

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

type Form1099Status = 'draft' | 'generated' | 'distributed' | 'filed' | 'corrected';

interface Form1099Row {
  id: string;
  vendorName: string;
  taxYear: number;
  formType: string;
  status: Form1099Status;
  box1: number | null;
  box3: number | null;
  totalPayments: number;
}

interface SummaryData {
  totalForms: number;
  draft: number;
  generated: number;
  distributed: number;
  filed: number;
  corrected: number;
  totalPayments: number;
}

interface TaxYear {
  id: string;
  year: number;
}

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

const statusColors: Record<Form1099Status, string> = {
  draft: 'bg-gray-100 text-gray-700',
  generated: 'bg-blue-100 text-blue-700',
  distributed: 'bg-purple-100 text-purple-700',
  filed: 'bg-green-100 text-green-700',
  corrected: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<Form1099Status, string> = {
  draft: 'Draft',
  generated: 'Generated',
  distributed: 'Distributed',
  filed: 'Filed',
  corrected: 'Corrected',
};

const formTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'NEC', label: 'NEC' },
  { value: 'MISC', label: 'MISC' },
  { value: 'INT', label: 'INT' },
  { value: 'DIV', label: 'DIV' },
  { value: 'K', label: 'K' },
  { value: 'R', label: 'R' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'distributed', label: 'Distributed' },
  { value: 'filed', label: 'Filed' },
  { value: 'corrected', label: 'Corrected' },
];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

export default function Form1099List(): React.ReactElement {
  const navigate = useNavigate();

  // Filters / pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('');
  const [taxYearId, setTaxYearId] = useState('');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Data queries
  const { data: taxYears, isLoading: taxYearsLoading } = trpc.tax.listTaxYears.useQuery();

  const { data: listData, isLoading: listLoading } = trpc.form1099.list1099s.useQuery(
    {
      limit,
      offset,
      ...(statusFilter ? { status: statusFilter as Form1099Status } : {}),
      ...(formTypeFilter ? { formType: formTypeFilter } : {}),
      ...(taxYearId ? { taxYearId } : {}),
      ...(search ? { search } : {}),
    },
    { enabled: true }
  );

  const { data: summaryData, isLoading: summaryLoading } = trpc.form1099.get1099Summary.useQuery(
    { taxYearId },
    { enabled: !!taxYearId }
  );

  // Mutations
  const utils = trpc.useUtils();

  const distributeMutation = trpc.form1099.distribute1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 distributed successfully.');
      utils.form1099.list1099s.invalidate();
      utils.form1099.get1099Summary.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to distribute form.');
    },
  });

  const fileMutation = trpc.form1099.file1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 filed with IRS successfully.');
      utils.form1099.list1099s.invalidate();
      utils.form1099.get1099Summary.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to file form.');
    },
  });

  const deleteMutation = trpc.form1099.delete1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 deleted.');
      utils.form1099.list1099s.invalidate();
      utils.form1099.get1099Summary.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete form.');
    },
  });

  // Computed
  const rows: Form1099Row[] = useMemo(() => {
    if (!listData || !Array.isArray(listData.items)) return [];
    return listData.items.map((item: any) => ({
      id: item.id,
      vendorName: item.vendorName || item.contact?.name || 'Unknown',
      taxYear: item.taxYear?.year || item.taxYear,
      formType: item.formType,
      status: item.status as Form1099Status,
      box1: item.box1,
      box3: item.box3,
      totalPayments: item.totalPayments ?? 0,
    }));
  }, [listData]);

  const totalCount = listData?.total ?? 0;
  const hasNext = offset + limit < totalCount;
  const hasPrev = offset > 0;

  const summary: SummaryData | null = summaryData ?? null;

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setFormTypeFilter('');
    setTaxYearId('');
    setOffset(0);
  };

  const handleDistribute = (id: string) => {
    if (window.confirm('Distribute this Form 1099 to the recipient?')) {
      distributeMutation.mutate({ id });
    }
  };

  const handleFile = (id: string) => {
    if (window.confirm('File this Form 1099 with the IRS?')) {
      fileMutation.mutate({ id });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this draft Form 1099? This action cannot be undone.')) {
      deleteMutation.mutate({ id });
    }
  };

  const isMutating = distributeMutation.isPending || fileMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Form 1099 Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage, generate, and file vendor 1099 forms.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/form1099/generate')}
          leftIcon={<Plus size={18} />}
        >
          Generate 1099
        </Button>
      </div>

      {/* Summary Cards */}
      {taxYearId && summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Forms</div>
            <div className="mt-1 text-xl font-bold text-gray-900">{summary.totalForms}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Draft</div>
            <div className="mt-1 text-xl font-bold text-gray-700">{summary.draft}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Generated</div>
            <div className="mt-1 text-xl font-bold text-blue-700">{summary.generated}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Distributed</div>
            <div className="mt-1 text-xl font-bold text-purple-700">{summary.distributed}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Filed</div>
            <div className="mt-1 text-xl font-bold text-green-700">{summary.filed}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Corrected</div>
            <div className="mt-1 text-xl font-bold text-orange-700">{summary.corrected}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Payments</div>
            <div className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(summary.totalPayments)}</div>
          </Card>
        </div>
      )}
      {taxYearId && summaryLoading && (
        <div className="flex items-center justify-center py-8">
          <Loading size="sm" />
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Tax Year */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={taxYearId}
                onChange={(e) => {
                  setTaxYearId(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All Tax Years</option>
                {taxYearsLoading ? (
                  <option disabled>Loading…</option>
                ) : (
                  taxYears?.map((ty: TaxYear) => (
                    <option key={ty.id} value={ty.id}>
                      {ty.year}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Status */}
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Form Type */}
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={formTypeFilter}
              onChange={(e) => {
                setFormTypeFilter(e.target.value);
                setOffset(0);
              }}
            >
              {formTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Clear */}
            {(search || statusFilter || formTypeFilter || taxYearId) && (
              <button
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                onClick={handleClearFilters}
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex max-w-md gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by vendor name…"
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} className="text-gray-300" />}
            title="No Form 1099s found"
            description="Try adjusting filters or generate a new 1099."
          />
        ) : (
          <>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Vendor</Table.Head>
                  <Table.Head>Tax Year</Table.Head>
                  <Table.Head>Form Type</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Box 1</Table.Head>
                  <Table.Head>Box 3</Table.Head>
                  <Table.Head>Total Payments</Table.Head>
                  <Table.Head className="w-48">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell className="font-medium text-gray-900">{row.vendorName}</Table.Cell>
                    <Table.Cell>{row.taxYear}</Table.Cell>
                    <Table.Cell>{row.formType}</Table.Cell>
                    <Table.Cell>
                      <Badge className={statusColors[row.status]}>{statusLabels[row.status]}</Badge>
                    </Table.Cell>
                    <Table.Cell>{formatCurrency(row.box1)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.box3)}</Table.Cell>
                    <Table.Cell>{formatCurrency(row.totalPayments)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye size={14} />}
                          onClick={() => navigate(`/form1099/${row.id}`)}
                          title="View"
                        >
                          View
                        </Button>

                        {(row.status === 'draft' || row.status === 'generated') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Send size={14} />}
                            onClick={() => handleDistribute(row.id)}
                            disabled={isMutating}
                            title="Distribute"
                          >
                            Distribute
                          </Button>
                        )}

                        {row.status === 'distributed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<CheckCircle size={14} />}
                            onClick={() => handleFile(row.id)}
                            disabled={isMutating}
                            title="File IRS"
                          >
                            File
                          </Button>
                        )}

                        {(row.status === 'distributed' || row.status === 'filed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<RotateCcw size={14} />}
                            onClick={() => navigate(`/form1099/${row.id}?correct=1`)}
                            title="Correct"
                          >
                            Correct
                          </Button>
                        )}

                        {row.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 size={14} />}
                            onClick={() => handleDelete(row.id)}
                            disabled={isMutating}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + limit, totalCount)} of {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  disabled={!hasPrev}
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ChevronRight size={14} />}
                  disabled={!hasNext}
                  onClick={() => setOffset((o) => o + limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
