import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Plus,
  Search,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
  Pencil,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export default function ExpenseList(): React.ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [reimburseModal, setReimburseModal] = useState<{ open: boolean; id: string; amount: string }>({
    open: false,
    id: '',
    amount: '',
  });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; reason: string }>({
    open: false,
    id: '',
    reason: '',
  });

  const listQuery = trpc.expense.listExpenseReports.useQuery({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  const employeesQuery = trpc.employee.listEmployees.useQuery();

  const submitMutation = trpc.expense.submitExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report submitted');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const approveMutation = trpc.expense.approveExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report approved');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const rejectMutation = trpc.expense.rejectExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report rejected');
      setRejectModal({ open: false, id: '', reason: '' });
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const reviewMutation = trpc.expense.reviewExpenseReport.useMutation({
    onSuccess: (_, vars) => {
      addToast('success', vars.approve ? 'Expense report approved' : 'Expense report rejected');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const reimburseMutation = trpc.expense.reimburseExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report reimbursed');
      setReimburseModal({ open: false, id: '', amount: '' });
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const deleteMutation = trpc.expense.deleteExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report deleted');
      listQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (employeesQuery.data ?? []).forEach((emp: any) => map.set(emp.id, emp.fullName || emp.name));
    return map;
  }, [employeesQuery.data]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="gray">Draft</Badge>;
      case 'submitted': return <Badge variant="blue">Submitted</Badge>;
      case 'under_review': return <Badge variant="purple">Under Review</Badge>;
      case 'approved': return <Badge variant="green">Approved</Badge>;
      case 'rejected': return <Badge variant="red">Rejected</Badge>;
      case 'reimbursed': return <Badge variant="green">Reimbursed</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const statusOptions = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed'];

  const columns = [
    { key: 'name', header: 'Report Name' },
    {
      key: 'employeeId',
      header: 'Employee',
      render: (row: any) => (
        <span className="text-sm text-gray-700">{employeeMap.get(row.employeeId) || row.employeeId || '—'}</span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row: any) => (
        <span className="text-sm text-gray-700">
          {row.periodStart ? new Date(row.periodStart).toLocaleDateString() : '—'}
          {' — '}
          {row.periodEnd ? new Date(row.periodEnd).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => getStatusBadge(row.status),
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-mono text-sm font-medium text-gray-900">
          ${(row.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'reimbursedAmount',
      header: 'Reimbursed',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-mono text-sm font-medium text-gray-700">
          ${(row.reimbursedAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: any) => {
        const status = row.status;
        return (
          <div className="flex items-center gap-1">
            {status === 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  submitMutation.mutate({ id: row.id });
                }}
                className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                title="Submit"
              >
                <Send size={16} />
              </button>
            )}
            {status === 'submitted' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reviewMutation.mutate({ id: row.id, approve: true });
                  }}
                  className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                  title="Approve"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectModal({ open: true, id: row.id, reason: '' });
                  }}
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  title="Reject"
                >
                  <XCircle size={16} />
                </button>
              </>
            )}
            {status === 'under_review' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    approveMutation.mutate({ id: row.id });
                  }}
                  className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                  title="Approve"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectModal({ open: true, id: row.id, reason: '' });
                  }}
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  title="Reject"
                >
                  <XCircle size={16} />
                </button>
              </>
            )}
            {status === 'approved' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReimburseModal({ open: true, id: row.id, amount: String(row.totalAmount ?? 0) });
                }}
                className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                title="Reimburse"
              >
                <DollarSign size={16} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/expenses/${row.id}/edit`);
              }}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this expense report?')) {
                  deleteMutation.mutate({ id: row.id });
                }
              }}
              className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  const total = listQuery.data?.total ?? 0;
  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Expense Reports</h1>
          <p className="page-subtitle">Manage employee expense reports and reimbursements</p>
        </div>
        <Button onClick={() => navigate('/expenses/new')}>
          <Plus size={16} className="mr-1" />
          New Report
        </Button>
      </div>

      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by report name or employee..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
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
              title="Failed to load expense reports"
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
              emptyMessage="No expense reports found"
            />
          )}
        </div>
      </Card>

      {/* Reimburse Modal */}
      <Modal
        isOpen={reimburseModal.open}
        onClose={() => setReimburseModal({ open: false, id: '', amount: '' })}
        title="Reimburse Expense Report"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReimburseModal({ open: false, id: '', amount: '' })}
            >
              Cancel
            </Button>
            <Button
              loading={reimburseMutation.isPending}
              onClick={() => {
                if (!reimburseModal.amount || parseFloat(reimburseModal.amount) <= 0) {
                  addToast('error', 'Please enter a valid amount');
                  return;
                }
                reimburseMutation.mutate({
                  id: reimburseModal.id,
                  amount: parseFloat(reimburseModal.amount),
                });
              }}
            >
              <DollarSign size={16} className="mr-1" />
              Reimburse
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Reimbursement Amount</label>
            <input
              type="number"
              step="0.01"
              value={reimburseModal.amount}
              onChange={(e) => setReimburseModal((prev) => ({ ...prev, amount: e.target.value }))}
              className="form-input"
              placeholder="0.00"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: '', reason: '' })}
        title="Reject Expense Report"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRejectModal({ open: false, id: '', reason: '' })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              onClick={() => {
                if (!rejectModal.reason.trim()) {
                  addToast('error', 'Please provide a rejection reason');
                  return;
                }
                rejectMutation.mutate({
                  id: rejectModal.id,
                  reason: rejectModal.reason,
                });
              }}
            >
              <XCircle size={16} className="mr-1" />
              Reject
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Rejection Reason</label>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              className="form-input min-h-[100px]"
              placeholder="Enter reason for rejection..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
