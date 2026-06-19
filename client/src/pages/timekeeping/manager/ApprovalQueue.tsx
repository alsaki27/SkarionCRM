import React, { useState, useMemo, useCallback } from 'react';
import { trpc } from '../../../api.ts';
import { Card } from '../../../components/ui/Card.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Loading } from '../../../components/ui/Loading.tsx';
import { EmptyState } from '../../../components/ui/EmptyState.tsx';
import { Table } from '../../../components/ui/Table.tsx';
import { addToast } from '../../../components/ui/Toast.tsx';
import {
  FileText,
  CalendarDays,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Filter,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────
interface Timesheet {
  id: string;
  employeeId: string;
  employeeName: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  dailyEntries: DailyEntry[];
}

interface DailyEntry {
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number;
  project: string | null;
  notes: string | null;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

// ─── Component ─────────────────────────────────────────
export default function ApprovalQueue(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'timesheets' | 'leave'>('timesheets');

  // Timesheet filters
  const [tsStatus, setTsStatus] = useState<string>('pending');
  const [tsEmployee, setTsEmployee] = useState('');
  const [tsStartDate, setTsStartDate] = useState('');
  const [tsEndDate, setTsEndDate] = useState('');
  const [tsExpandedId, setTsExpandedId] = useState<string | null>(null);
  const [tsSelectedIds, setTsSelectedIds] = useState<Set<string>>(new Set());
  const [tsActionModal, setTsActionModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [tsActionNotes, setTsActionNotes] = useState('');

  // Leave filters
  const [lrStatus, setLrStatus] = useState<string>('pending');
  const [lrEmployee, setLrEmployee] = useState('');
  const [lrStartDate, setLrStartDate] = useState('');
  const [lrEndDate, setLrEndDate] = useState('');
  const [lrSelectedIds, setLrSelectedIds] = useState<Set<string>>(new Set());
  const [lrActionModal, setLrActionModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [lrActionReason, setLrActionReason] = useState('');
  const [lrViewId, setLrViewId] = useState<string | null>(null);

  // tRPC queries
  const timesheetsQuery = trpc.timekeeping.listTimesheets.useQuery({
    status: tsStatus,
    employee: tsEmployee || undefined,
    startDate: tsStartDate || undefined,
    endDate: tsEndDate || undefined,
  });

  const leaveQuery = trpc.pto.listLeaveRequests.useQuery({
    status: lrStatus,
    employee: lrEmployee || undefined,
    startDate: lrStartDate || undefined,
    endDate: lrEndDate || undefined,
  });

  // Mutations (using generic mutation patterns)
  const utils = trpc.useUtils();
  const approveTimesheet = trpc.timekeeping.approveTimesheet.useMutation({
    onSuccess: () => {
      utils.timekeeping.listTimesheets.invalidate();
      addToast('success', 'Timesheet approved');
      setTsActionModal(null);
      setTsActionNotes('');
    },
    onError: (err) => addToast('error', err.message),
  });
  const rejectTimesheet = trpc.timekeeping.rejectTimesheet.useMutation({
    onSuccess: () => {
      utils.timekeeping.listTimesheets.invalidate();
      addToast('success', 'Timesheet rejected');
      setTsActionModal(null);
      setTsActionNotes('');
    },
    onError: (err) => addToast('error', err.message),
  });
  const approveLeave = trpc.pto.approveLeave.useMutation({
    onSuccess: () => {
      utils.pto.listLeaveRequests.invalidate();
      addToast('success', 'Leave request approved');
      setLrActionModal(null);
      setLrActionReason('');
    },
    onError: (err) => addToast('error', err.message),
  });
  const rejectLeave = trpc.pto.rejectLeave.useMutation({
    onSuccess: () => {
      utils.pto.listLeaveRequests.invalidate();
      addToast('success', 'Leave request rejected');
      setLrActionModal(null);
      setLrActionReason('');
    },
    onError: (err) => addToast('error', err.message),
  });

  // ─── Timesheet helpers ───────────────────────────
  const timesheets: Timesheet[] = useMemo(() => (timesheetsQuery.data as Timesheet[] | undefined) ?? [], [timesheetsQuery.data]);

  const toggleTsSelect = useCallback((id: string) => {
    setTsSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleTsSelectAll = useCallback(() => {
    setTsSelectedIds((prev) => {
      if (prev.size === timesheets.length) return new Set();
      return new Set(timesheets.map((t) => t.id));
    });
  }, [timesheets]);

  const handleBulkTsApprove = useCallback(() => {
    const ids = Array.from(tsSelectedIds);
    if (ids.length === 0) return;
    // In real app, call a bulk mutation. Here we loop for demo.
    ids.forEach((id) => approveTimesheet.mutate({ id, notes: 'Bulk approved' }));
    setTsSelectedIds(new Set());
  }, [tsSelectedIds, approveTimesheet]);

  const handleBulkTsReject = useCallback(() => {
    const ids = Array.from(tsSelectedIds);
    if (ids.length === 0) return;
    ids.forEach((id) => rejectTimesheet.mutate({ id, reason: 'Bulk rejected' }));
    setTsSelectedIds(new Set());
  }, [tsSelectedIds, rejectTimesheet]);

  // ─── Leave helpers ────────────────────────────────
  const leaveRequests: LeaveRequest[] = useMemo(() => (leaveQuery.data as LeaveRequest[] | undefined) ?? [], [leaveQuery.data]);

  const toggleLrSelect = useCallback((id: string) => {
    setLrSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLrSelectAll = useCallback(() => {
    setLrSelectedIds((prev) => {
      if (prev.size === leaveRequests.length) return new Set();
      return new Set(leaveRequests.map((r) => r.id));
    });
  }, [leaveRequests]);

  const handleBulkLrApprove = useCallback(() => {
    const ids = Array.from(lrSelectedIds);
    if (ids.length === 0) return;
    ids.forEach((id) => approveLeave.mutate({ id }));
    setLrSelectedIds(new Set());
  }, [lrSelectedIds, approveLeave]);

  const handleBulkLrReject = useCallback(() => {
    const ids = Array.from(lrSelectedIds);
    if (ids.length === 0) return;
    ids.forEach((id) => rejectLeave.mutate({ id, reason: 'Bulk rejected' }));
    setLrSelectedIds(new Set());
  }, [lrSelectedIds, rejectLeave]);

  const viewedLeave = useMemo(() => leaveRequests.find((r) => r.id === lrViewId), [leaveRequests, lrViewId]);

  // ─── Render ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="page-title dark:text-white">Approval Queue</h1>
          <p className="page-subtitle dark:text-gray-400">
            Review and approve timesheets and leave requests
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('timesheets')}
              className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'timesheets'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FileText size={16} />
              Timesheets
              {timesheets.filter((t) => t.status === 'pending').length > 0 && (
                <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                  {timesheets.filter((t) => t.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'leave'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <CalendarDays size={16} />
              Leave Requests
              {leaveRequests.filter((r) => r.status === 'pending').length > 0 && (
                <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                  {leaveRequests.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* ═══════════ TIMESHEETS TAB ═══════════ */}
        {activeTab === 'timesheets' && (
          <>
            {/* Filters */}
            <Card className="mb-4">
              <div className="card-body flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={tsEmployee}
                    onChange={(e) => setTsEmployee(e.target.value)}
                    className="form-input w-full pl-9 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={tsStatus}
                    onChange={(e) => setTsStatus(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                  <input
                    type="date"
                    value={tsStartDate}
                    onChange={(e) => setTsStartDate(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                  <input
                    type="date"
                    value={tsEndDate}
                    onChange={(e) => setTsEndDate(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
              </div>
            </Card>

            {/* Bulk Actions */}
            {tsSelectedIds.size > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-3 dark:bg-primary-900/30">
                <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  {tsSelectedIds.size} selected
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleBulkTsApprove}>
                    <CheckSquare size={14} className="mr-1.5" />
                    Approve All
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleBulkTsReject}>
                    <XCircle size={14} className="mr-1.5" />
                    Reject All
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            {timesheetsQuery.isLoading ? (
              <Loading message="Loading timesheets..." />
            ) : timesheets.length === 0 ? (
              <EmptyState icon={FileText} title="No timesheets found" description="Adjust your filters to see more results." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={tsSelectedIds.size === timesheets.length && timesheets.length > 0}
                          onChange={toggleTsSelectAll}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Week</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Regular</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Overtime</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Submitted</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {timesheets.map((ts) => (
                      <React.Fragment key={ts.id}>
                        <tr
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                          onClick={() => setTsExpandedId(tsExpandedId === ts.id ? null : ts.id)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={tsSelectedIds.has(ts.id)}
                              onChange={() => toggleTsSelect(ts.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User size={14} className="text-gray-400" />
                              <span className="font-medium text-gray-900 dark:text-white">{ts.employeeName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-200">
                            {ts.weekStart} – {ts.weekEnd}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{ts.totalHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-200">{ts.regularHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-200">{ts.overtimeHours.toFixed(1)}h</td>
                          <td className="px-4 py-3">
                            <Badge variant={ts.status === 'approved' ? 'green' : ts.status === 'rejected' ? 'red' : 'yellow'}>
                              {ts.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {new Date(ts.submittedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {ts.status === 'pending' && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setTsActionModal({ id: ts.id, action: 'approve' }); }}
                                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                    title="Approve"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setTsActionModal({ id: ts.id, action: 'reject' }); }}
                                    className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    title="Reject"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </>
                              )}
                              <button className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                {tsExpandedId === ts.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded detail */}
                        {tsExpandedId === ts.id && (
                          <tr className="bg-gray-50 dark:bg-gray-700/30">
                            <td colSpan={9} className="px-4 py-4">
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Daily Entries
                              </h4>
                              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">In</th>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Out</th>
                                      <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Hours</th>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Project</th>
                                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {ts.dailyEntries.map((entry, i) => (
                                      <tr key={i} className="dark:bg-gray-900">
                                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{entry.date}</td>
                                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{entry.clockIn}</td>
                                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{entry.clockOut ?? '—'}</td>
                                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-200">{entry.hours.toFixed(1)}</td>
                                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{entry.project ?? '—'}</td>
                                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{entry.notes ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══════════ LEAVE REQUESTS TAB ═══════════ */}
        {activeTab === 'leave' && (
          <>
            {/* Filters */}
            <Card className="mb-4">
              <div className="card-body flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={lrEmployee}
                    onChange={(e) => setLrEmployee(e.target.value)}
                    className="form-input w-full pl-9 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={lrStatus}
                    onChange={(e) => setLrStatus(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                  <input
                    type="date"
                    value={lrStartDate}
                    onChange={(e) => setLrStartDate(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                  <input
                    type="date"
                    value={lrEndDate}
                    onChange={(e) => setLrEndDate(e.target.value)}
                    className="form-input w-36 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
              </div>
            </Card>

            {/* Bulk Actions */}
            {lrSelectedIds.size > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-3 dark:bg-primary-900/30">
                <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  {lrSelectedIds.size} selected
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleBulkLrApprove}>
                    <CheckSquare size={14} className="mr-1.5" />
                    Approve All
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleBulkLrReject}>
                    <XCircle size={14} className="mr-1.5" />
                    Reject All
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            {leaveQuery.isLoading ? (
              <Loading message="Loading leave requests..." />
            ) : leaveRequests.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No leave requests found" description="Adjust your filters to see more results." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={lrSelectedIds.size === leaveRequests.length && leaveRequests.length > 0}
                          onChange={toggleLrSelectAll}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Leave Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Dates</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Days</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Requested</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {leaveRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={lrSelectedIds.has(req.id)}
                            onChange={() => toggleLrSelect(req.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-white">{req.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-200">{req.leaveType}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-200">
                          {req.startDate} – {req.endDate}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{req.days}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-600 dark:text-gray-300" title={req.reason ?? ''}>
                          {req.reason ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : 'yellow'}>
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setLrViewId(req.id)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => setLrActionModal({ id: req.id, action: 'approve' })}
                                  className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => setLrActionModal({ id: req.id, action: 'reject' })}
                                  className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Timesheet Action Modal */}
      <Modal
        isOpen={!!tsActionModal}
        onClose={() => { setTsActionModal(null); setTsActionNotes(''); }}
        title={tsActionModal?.action === 'approve' ? 'Approve Timesheet' : 'Reject Timesheet'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tsActionModal?.action === 'approve'
              ? 'Add optional approval notes:'
              : 'Please provide a reason for rejection:'}
          </p>
          <textarea
            rows={3}
            value={tsActionNotes}
            onChange={(e) => setTsActionNotes(e.target.value)}
            placeholder={tsActionModal?.action === 'approve' ? 'Optional notes...' : 'Reason for rejection...'}
            className="form-input w-full dark:bg-gray-800 dark:text-white dark:ring-gray-700"
          />
        </div>
        <div className="card-footer">
          <Button variant="secondary" onClick={() => { setTsActionModal(null); setTsActionNotes(''); }}>
            Cancel
          </Button>
          <Button
            variant={tsActionModal?.action === 'approve' ? 'primary' : 'danger'}
            loading={approveTimesheet.isLoading || rejectTimesheet.isLoading}
            onClick={() => {
              if (!tsActionModal) return;
              if (tsActionModal.action === 'approve') {
                approveTimesheet.mutate({ id: tsActionModal.id, notes: tsActionNotes });
              } else {
                rejectTimesheet.mutate({ id: tsActionModal.id, reason: tsActionNotes });
              }
            }}
          >
            {tsActionModal?.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </Modal>

      {/* Leave Action Modal */}
      <Modal
        isOpen={!!lrActionModal}
        onClose={() => { setLrActionModal(null); setLrActionReason(''); }}
        title={lrActionModal?.action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {lrActionModal?.action === 'approve'
              ? 'Are you sure you want to approve this leave request?'
              : 'Please provide a reason for rejection:'}
          </p>
          {lrActionModal?.action === 'reject' && (
            <textarea
              rows={3}
              value={lrActionReason}
              onChange={(e) => setLrActionReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="form-input w-full dark:bg-gray-800 dark:text-white dark:ring-gray-700"
            />
          )}
        </div>
        <div className="card-footer">
          <Button variant="secondary" onClick={() => { setLrActionModal(null); setLrActionReason(''); }}>
            Cancel
          </Button>
          <Button
            variant={lrActionModal?.action === 'approve' ? 'primary' : 'danger'}
            loading={approveLeave.isLoading || rejectLeave.isLoading}
            onClick={() => {
              if (!lrActionModal) return;
              if (lrActionModal.action === 'approve') {
                approveLeave.mutate({ id: lrActionModal.id });
              } else {
                rejectLeave.mutate({ id: lrActionModal.id, reason: lrActionReason });
              }
            }}
          >
            {lrActionModal?.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </Modal>

      {/* Leave View Modal */}
      <Modal
        isOpen={!!lrViewId}
        onClose={() => setLrViewId(null)}
        title="Leave Request Details"
        size="md"
      >
        {viewedLeave && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Employee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewedLeave.employeeName}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Leave Type</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewedLeave.leaveType}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Start Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewedLeave.startDate}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">End Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewedLeave.endDate}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Days</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewedLeave.days}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <div className="mt-1">
                  <Badge variant={viewedLeave.status === 'approved' ? 'green' : viewedLeave.status === 'rejected' ? 'red' : 'yellow'}>
                    {viewedLeave.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{viewedLeave.reason ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Requested At</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {new Date(viewedLeave.requestedAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}
        <div className="card-footer">
          <Button variant="secondary" onClick={() => setLrViewId(null)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
