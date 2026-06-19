import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
  Pencil,
  FileText,
  Receipt,
  Check,
  X,
} from 'lucide-react';

export default function ExpenseDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [reimburseModal, setReimburseModal] = useState(false);
  const [reimburseAmount, setReimburseAmount] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const reportQuery = trpc.expense.getExpenseReportById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const employeesQuery = trpc.employee.listEmployees.useQuery();
  const categoriesQuery = trpc.expense.getExpenseCategories.useQuery();

  const submitMutation = trpc.expense.submitExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report submitted');
      reportQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const approveMutation = trpc.expense.approveExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report approved');
      reportQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const rejectMutation = trpc.expense.rejectExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report rejected');
      setRejectModal(false);
      setRejectReason('');
      reportQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const reviewMutation = trpc.expense.reviewExpenseReport.useMutation({
    onSuccess: (_, vars) => {
      addToast('success', vars.approve ? 'Expense report approved' : 'Expense report rejected');
      reportQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const reimburseMutation = trpc.expense.reimburseExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report reimbursed');
      setReimburseModal(false);
      setReimburseAmount('');
      reportQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const employeeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (employeesQuery.data ?? []).forEach((emp: any) => map.set(emp.id, emp.fullName || emp.name));
    return map;
  }, [employeesQuery.data]);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (categoriesQuery.data ?? []).forEach((cat: any) => map.set(cat.id, cat.name));
    return map;
  }, [categoriesQuery.data]);

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

  const report = reportQuery.data;

  if (reportQuery.isLoading) {
    return <Loading message="Loading expense report..." />;
  }

  if (reportQuery.isError || !report) {
    return (
      <div className="py-12">
        <EmptyState
          icon={FileText}
          title="Expense report not found"
          description="The report you're looking for doesn't exist or was removed."
          actionLabel="Back to Expenses"
          onAction={() => navigate('/expenses')}
        />
      </div>
    );
  }

  const status = report.status;
  const items = report.items ?? [];

  const itemColumns = [
    {
      key: 'date',
      header: 'Date',
      render: (row: any) => (
        <span className="text-sm text-gray-700">
          {row.date ? new Date(row.date).toLocaleDateString() : '—'}
        </span>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'categoryId',
      header: 'Category',
      render: (row: any) => (
        <span className="text-sm text-gray-700">{categoryMap.get(row.categoryId) || row.categoryId || '—'}</span>
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
    {
      key: 'taxAmount',
      header: 'Tax',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-mono text-sm text-gray-700">
          ${(row.taxAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { key: 'vendor', header: 'Vendor', render: (row: any) => <span className="text-sm text-gray-700">{row.vendor || '—'}</span> },
    {
      key: 'receiptPath',
      header: 'Receipt',
      align: 'center' as const,
      render: (row: any) => (
        row.receiptPath ? (
          <Receipt size={16} className="mx-auto text-gray-600" />
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )
      ),
    },
    {
      key: 'isBillable',
      header: 'Billable',
      align: 'center' as const,
      render: (row: any) => (
        row.isBillable ? <Check size={16} className="mx-auto text-green-600" /> : <X size={16} className="mx-auto text-gray-400" />
      ),
    },
    {
      key: 'isApproved',
      header: 'Approved',
      align: 'center' as const,
      render: (row: any) => (
        row.isApproved ? <Check size={16} className="mx-auto text-green-600" /> : <X size={16} className="mx-auto text-gray-400" />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/expenses')}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{report.name || 'Expense Report'}</h1>
            <div className="mt-1 flex items-center gap-2">
              {getStatusBadge(status)}
              <span className="text-sm text-gray-500">
                by {employeeMap.get(report.employeeId) || report.employeeId || '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <Button onClick={() => submitMutation.mutate({ id: report.id })} loading={submitMutation.isPending}>
              <Send size={16} className="mr-1" />
              Submit
            </Button>
          )}
          {status === 'submitted' && (
            <>
              <Button
                variant="secondary"
                onClick={() => reviewMutation.mutate({ id: report.id, approve: true })}
                loading={reviewMutation.isPending}
              >
                <CheckCircle size={16} className="mr-1" />
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => setRejectModal(true)}
              >
                <XCircle size={16} className="mr-1" />
                Reject
              </Button>
            </>
          )}
          {status === 'under_review' && (
            <>
              <Button
                onClick={() => approveMutation.mutate({ id: report.id })}
                loading={approveMutation.isPending}
              >
                <CheckCircle size={16} className="mr-1" />
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => setRejectModal(true)}
              >
                <XCircle size={16} className="mr-1" />
                Reject
              </Button>
            </>
          )}
          {status === 'approved' && (
            <Button
              onClick={() => {
                setReimburseAmount(String(report.totalAmount ?? 0));
                setReimburseModal(true);
              }}
            >
              <DollarSign size={16} className="mr-1" />
              Reimburse
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/expenses/${id}/edit`)}>
            <Pencil size={16} className="mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="card-body">
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="mt-1 font-mono text-xl font-semibold text-gray-900">
              ${(report.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
        <Card>
          <div className="card-body">
            <p className="text-xs text-gray-500">Reimbursed</p>
            <p className="mt-1 font-mono text-xl font-semibold text-gray-900">
              ${(report.reimbursedAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
        <Card>
          <div className="card-body">
            <p className="text-xs text-gray-500">Period</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {report.periodStart ? new Date(report.periodStart).toLocaleDateString() : '—'} — {report.periodEnd ? new Date(report.periodEnd).toLocaleDateString() : '—'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="card-body">
            <p className="text-xs text-gray-500">Items</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{items.length}</p>
          </div>
        </Card>
      </div>

      {/* Reviewer Info */}
      {(report.reviewedBy || report.approvedBy || report.rejectedBy) && (
        <Card title="Review History">
          <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-3">
            {report.reviewedBy && (
              <div>
                <p className="text-xs text-gray-500">Reviewed By</p>
                <p className="text-sm font-medium text-gray-900">{report.reviewedBy}</p>
                {report.reviewedAt && (
                  <p className="text-xs text-gray-400">{new Date(report.reviewedAt).toLocaleDateString()}</p>
                )}
              </div>
            )}
            {report.approvedBy && (
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm font-medium text-gray-900">{report.approvedBy}</p>
                {report.approvedAt && (
                  <p className="text-xs text-gray-400">{new Date(report.approvedAt).toLocaleDateString()}</p>
                )}
              </div>
            )}
            {report.rejectedBy && (
              <div>
                <p className="text-xs text-gray-500">Rejected By</p>
                <p className="text-sm font-medium text-gray-900">{report.rejectedBy}</p>
                {report.rejectedAt && (
                  <p className="text-xs text-gray-400">{new Date(report.rejectedAt).toLocaleDateString()}</p>
                )}
                {report.rejectionReason && (
                  <p className="mt-1 text-xs text-red-600">Reason: {report.rejectionReason}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Notes */}
      {report.notes && (
        <Card title="Notes">
          <p className="card-body text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
        </Card>
      )}

      {/* Items Table */}
      <Card title="Expense Items" subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}>
        <div className="card-body p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No items"
              description="This expense report has no items yet."
            />
          ) : (
            <Table
              columns={itemColumns}
              data={items}
              keyExtractor={(row, index) => `${row.id || index}`}
              emptyMessage="No items"
            />
          )}
        </div>
      </Card>

      {/* Reimburse Modal */}
      <Modal
        isOpen={reimburseModal}
        onClose={() => { setReimburseModal(false); setReimburseAmount(''); }}
        title="Reimburse Expense Report"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setReimburseModal(false); setReimburseAmount(''); }}>
              Cancel
            </Button>
            <Button
              loading={reimburseMutation.isPending}
              onClick={() => {
                if (!reimburseAmount || parseFloat(reimburseAmount) <= 0) {
                  addToast('error', 'Please enter a valid amount');
                  return;
                }
                reimburseMutation.mutate({ id: report.id, amount: parseFloat(reimburseAmount) });
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
              value={reimburseAmount}
              onChange={(e) => setReimburseAmount(e.target.value)}
              className="form-input"
              placeholder="0.00"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal}
        onClose={() => { setRejectModal(false); setRejectReason(''); }}
        title="Reject Expense Report"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejectModal(false); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              onClick={() => {
                if (!rejectReason.trim()) {
                  addToast('error', 'Please provide a rejection reason');
                  return;
                }
                rejectMutation.mutate({ id: report.id, reason: rejectReason });
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
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="form-input min-h-[100px]"
              placeholder="Enter reason for rejection..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
