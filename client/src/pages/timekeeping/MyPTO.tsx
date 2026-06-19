import React, { useState, useEffect } from 'react';
import { trpc } from '../../api.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Calendar,
  Plus,
  X,
  Sun,
  Umbrella,
  Heart,
  Baby,
  GraduationCap,
  Stethoscope,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
  UserCheck,
  CalendarDays,
} from 'lucide-react';

interface LeaveBalance {
  type: string;
  remaining: number;
  used: number;
  accrued: number;
  pending: number;
  total: number;
}

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  halfDay: boolean;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const statusBadgeMap: Record<string, { variant: 'yellow' | 'green' | 'red' | 'gray'; label: string }> = {
  pending: { variant: 'yellow', label: 'Pending' },
  approved: { variant: 'green', label: 'Approved' },
  rejected: { variant: 'red', label: 'Rejected' },
  cancelled: { variant: 'gray', label: 'Cancelled' },
};

const leaveTypeIcons: Record<string, React.ReactNode> = {
  Vacation: <Sun size={20} />,
  Sick: <Stethoscope size={20} />,
  Personal: <UserCheck size={20} />,
  'Parental': <Baby size={20} />,
  'Bereavement': <Heart size={20} />,
  'Education': <GraduationCap size={20} />,
};

const leaveTypeColors: Record<string, string> = {
  Vacation: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Sick: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Personal: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Parental: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  Bereavement: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Education: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export default function MyPTO(): React.ReactElement {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('Vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [daysRequested, setDaysRequested] = useState(0);

  // tRPC queries
  const { data: balancesData, isLoading: balancesLoading } = trpc.pto.getLeaveBalances.useQuery();
  const { data: requestsData, isLoading: requestsLoading } = trpc.pto.listLeaveRequests.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.pto.createLeaveRequest.useMutation({
    onSuccess: () => {
      addToast('success', 'Leave request submitted successfully');
      setRequestModalOpen(false);
      resetForm();
      utils.pto.listLeaveRequests.invalidate();
      utils.pto.getLeaveBalances.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to submit leave request');
    },
  });

  const cancelMutation = trpc.pto.cancelLeaveRequest.useMutation({
    onSuccess: () => {
      addToast('success', 'Leave request cancelled');
      utils.pto.listLeaveRequests.invalidate();
      utils.pto.getLeaveBalances.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to cancel request');
    },
  });

  const balances: LeaveBalance[] = balancesData?.balances ?? [
    { type: 'Vacation', remaining: 12, used: 8, accrued: 20, pending: 5, total: 20 },
    { type: 'Sick', remaining: 5, used: 3, accrued: 8, pending: 0, total: 8 },
    { type: 'Personal', remaining: 3, used: 2, accrued: 5, pending: 0, total: 5 },
  ];

  const requests: LeaveRequest[] = requestsData?.items ?? [];

  // Auto-calculate days requested
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setDaysRequested(halfDay ? diffDays - 0.5 : diffDays);
      } else {
        setDaysRequested(0);
      }
    } else {
      setDaysRequested(0);
    }
  }, [startDate, endDate, halfDay]);

  const resetForm = () => {
    setLeaveType('Vacation');
    setStartDate('');
    setEndDate('');
    setHalfDay(false);
    setReason('');
    setDaysRequested(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      addToast('warning', 'Please select start and end dates');
      return;
    }
    if (daysRequested <= 0) {
      addToast('warning', 'End date must be on or after start date');
      return;
    }
    createMutation.mutate({
      type: leaveType,
      startDate,
      endDate,
      halfDay,
      days: daysRequested,
      reason: reason || undefined,
    });
  };

  const handleCancel = (id: string) => {
    if (window.confirm('Cancel this leave request?')) {
      cancelMutation.mutate({ id });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const requestColumns = [
    {
      key: 'status',
      header: 'Status',
      render: (row: LeaveRequest) => {
        const config = statusBadgeMap[row.status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: LeaveRequest) => (
        <div className="flex items-center gap-2">
          <span className={leaveTypeColors[row.type] || leaveTypeColors['Personal']}>
            {leaveTypeIcons[row.type] || <Calendar size={18} />}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.type}</span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (row: LeaveRequest) => (
        <div>
          <p className="text-gray-900 dark:text-gray-100">
            {formatDate(row.startDate)} — {formatDate(row.endDate)}
          </p>
          {row.halfDay && <p className="text-xs text-gray-500 dark:text-gray-400">Half day</p>}
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right' as const,
      render: (row: LeaveRequest) => <span className="font-medium">{row.days}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row: LeaveRequest) => (
        <p className="max-w-xs truncate text-gray-600 dark:text-gray-300">{row.reason || '—'}</p>
      ),
    },
    {
      key: 'approvedBy',
      header: 'Approved By',
      render: (row: LeaveRequest) => (
        <div>
          <p className="text-gray-700 dark:text-gray-300">{row.approvedBy || '—'}</p>
          {row.approvedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(row.approvedAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: LeaveRequest) =>
        row.status === 'pending' ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleCancel(row.id)}
            loading={cancelMutation.isPending}
            className="gap-1"
          >
            <X size={14} />
            Cancel
          </Button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My PTO</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your leave balances and requests.</p>
        </div>
        <Button variant="primary" onClick={() => setRequestModalOpen(true)} className="gap-2">
          <Plus size={18} />
          Request Leave
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Leave Balances</h2>
        {balancesLoading ? (
          <Loading size="sm" />
        ) : balances.length === 0 ? (
          <EmptyState icon={Calendar} title="No leave balances" description="Contact HR to set up your leave entitlements." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((balance: LeaveBalance) => (
              <Card key={balance.type} className="overflow-hidden">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          leaveTypeColors[balance.type] || leaveTypeColors['Personal']
                        }`}
                      >
                        {leaveTypeIcons[balance.type] || <Calendar size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{balance.type}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{balance.total} days / year</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{balance.remaining}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">days left</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Used</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{balance.used}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Accrued</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{balance.accrued}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{balance.pending}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Request History */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Request History</h2>
        {requestsLoading ? (
          <Loading message="Loading requests..." />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description="Submit your first leave request using the button above."
            actionLabel="Request Leave"
            onAction={() => setRequestModalOpen(true)}
          />
        ) : (
          <Table
            columns={requestColumns}
            data={requests}
            keyExtractor={(row: LeaveRequest) => row.id}
            pagination={false}
            emptyMessage="No leave requests found"
          />
        )}
      </div>

      {/* Request Leave Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => { setRequestModalOpen(false); resetForm(); }}
        title="Request Leave"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRequestModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={createMutation.isPending}
              className="gap-1"
            >
              <Plus size={16} />
              Submit Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="Vacation">Vacation</option>
              <option value="Sick">Sick</option>
              <option value="Personal">Personal</option>
              <option value="Parental">Parental</option>
              <option value="Bereavement">Bereavement</option>
              <option value="Education">Education</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Days Requested</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Auto-calculated from dates</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{daysRequested}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">days</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="halfDay"
              checked={halfDay}
              onChange={(e) => setHalfDay(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
            />
            <label htmlFor="halfDay" className="text-sm text-gray-700 dark:text-gray-300">
              Half day on last day
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Optional: Briefly describe the reason for your leave..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
