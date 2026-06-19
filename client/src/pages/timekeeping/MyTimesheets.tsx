import React, { useState } from 'react';
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
  FileText,
  Eye,
  Send,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Clock,
  Briefcase,
  CheckCircle,
} from 'lucide-react';

interface Timesheet {
  id: string;
  week: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
  billableHours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  entries: TimesheetEntry[];
}

interface TimesheetEntry {
  id: string;
  date: string;
  projectName: string;
  taskName: string;
  hours: number;
  billable: boolean;
  notes?: string;
}

const statusBadgeMap: Record<string, { variant: 'gray' | 'blue' | 'green' | 'red'; label: string }> = {
  draft: { variant: 'gray', label: 'Draft' },
  submitted: { variant: 'blue', label: 'Submitted' },
  approved: { variant: 'green', label: 'Approved' },
  rejected: { variant: 'red', label: 'Rejected' },
};

export default function MyTimesheets(): React.ReactElement {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const pageSize = 10;

  const { data, isLoading } = trpc.timekeeping.listTimesheets.useQuery({
    page,
    pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const utils = trpc.useUtils();
  const submitMutation = trpc.timekeeping.submitTimesheet.useMutation({
    onSuccess: () => {
      addToast('success', 'Timesheet submitted successfully');
      utils.timekeeping.listTimesheets.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to submit timesheet');
    },
  });

  const timesheets: Timesheet[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleSubmit = (id: string) => {
    if (window.confirm('Submit this timesheet for approval?')) {
      submitMutation.mutate({ id });
    }
  };

  const handleView = (ts: Timesheet) => {
    setSelectedTimesheet(ts);
    setViewModalOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const columns = [
    {
      key: 'week',
      header: 'Week',
      render: (row: Timesheet) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{row.week}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(row.weekStart)} — {formatDate(row.weekEnd)}
          </p>
        </div>
      ),
    },
    {
      key: 'totalHours',
      header: 'Total',
      align: 'right' as const,
      render: (row: Timesheet) => <span className="font-medium">{row.totalHours.toFixed(1)}h</span>,
    },
    {
      key: 'regularHours',
      header: 'Regular',
      align: 'right' as const,
      render: (row: Timesheet) => <span className="text-gray-600 dark:text-gray-400">{row.regularHours.toFixed(1)}h</span>,
    },
    {
      key: 'overtimeHours',
      header: 'OT',
      align: 'right' as const,
      render: (row: Timesheet) => <span className="text-gray-600 dark:text-gray-400">{row.overtimeHours.toFixed(1)}h</span>,
    },
    {
      key: 'breakHours',
      header: 'Break',
      align: 'right' as const,
      render: (row: Timesheet) => <span className="text-gray-600 dark:text-gray-400">{row.breakHours.toFixed(1)}h</span>,
    },
    {
      key: 'billableHours',
      header: 'Billable',
      align: 'right' as const,
      render: (row: Timesheet) => <span className="font-medium text-emerald-600 dark:text-emerald-400">{row.billableHours.toFixed(1)}h</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Timesheet) => {
        const config = statusBadgeMap[row.status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: Timesheet) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleView(row)} className="gap-1">
            <Eye size={14} />
            View
          </Button>
          {row.status === 'draft' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit(row.id)}
              loading={submitMutation.isPending}
              className="gap-1"
            >
              <Send size={14} />
              Submit
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Timesheets</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and submit your weekly timesheets.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <Loading message="Loading timesheets..." />
      ) : timesheets.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No timesheets found"
          description={statusFilter !== 'all' ? 'Try changing the status filter.' : 'Your timesheets will appear here once created.'}
        />
      ) : (
        <div className="space-y-4">
          {timesheets.map((ts: Timesheet) => (
            <div key={ts.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              {/* Main row */}
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => toggleExpand(ts.id)}
              >
                <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4 lg:grid-cols-8 lg:items-center">
                  <div className="col-span-2 lg:col-span-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{ts.week}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(ts.weekStart)} — {formatDate(ts.weekEnd)}
                    </p>
                  </div>
                  <div className="text-right lg:text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{ts.totalHours.toFixed(1)}h</p>
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Regular</p>
                    <p className="text-gray-700 dark:text-gray-300">{ts.regularHours.toFixed(1)}h</p>
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-xs text-gray-500 dark:text-gray-400">OT</p>
                    <p className="text-gray-700 dark:text-gray-300">{ts.overtimeHours.toFixed(1)}h</p>
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Break</p>
                    <p className="text-gray-700 dark:text-gray-300">{ts.breakHours.toFixed(1)}h</p>
                  </div>
                  <div className="text-right lg:text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Billable</p>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">{ts.billableHours.toFixed(1)}h</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Badge variant={statusBadgeMap[ts.status].variant}>
                      {statusBadgeMap[ts.status].label}
                    </Badge>
                    <button className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {expandedRow === ts.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded row with daily entries */}
              {expandedRow === ts.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily Entries</h4>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleView(ts); }} className="gap-1">
                        <Eye size={14} />
                        View Full
                      </Button>
                      {ts.status === 'draft' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleSubmit(ts.id); }}
                          loading={submitMutation.isPending}
                          className="gap-1"
                        >
                          <Send size={14} />
                          Submit
                        </Button>
                      )}
                    </div>
                  </div>
                  {ts.entries && ts.entries.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Project</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Task</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Hours</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Billable</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {ts.entries.map((entry: TimesheetEntry) => (
                            <tr key={entry.id} className="hover:bg-gray-100 dark:hover:bg-gray-700/50">
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{entry.projectName}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{entry.taskName}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{entry.hours.toFixed(1)}</td>
                              <td className="px-3 py-2 text-center">
                                {entry.billable ? (
                                  <CheckCircle size={14} className="mx-auto text-emerald-500" />
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{entry.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No entries for this timesheet.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
                <span className="font-medium">{total}</span> results
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Timesheet — ${selectedTimesheet?.week ?? ''}`}
        size="lg"
      >
        {selectedTimesheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Hours</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedTimesheet.totalHours.toFixed(1)}h</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Regular</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedTimesheet.regularHours.toFixed(1)}h</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Overtime</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedTimesheet.overtimeHours.toFixed(1)}h</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Billable</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{selectedTimesheet.billableHours.toFixed(1)}h</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Daily Entries</h4>
              {selectedTimesheet.entries && selectedTimesheet.entries.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Project</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Task</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Hours</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Billable</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedTimesheet.entries.map((entry: TimesheetEntry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{entry.projectName}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{entry.taskName}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{entry.hours.toFixed(1)}</td>
                          <td className="px-4 py-2 text-center">
                            {entry.billable ? <CheckCircle size={14} className="mx-auto text-emerald-500" /> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{entry.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No entries for this timesheet.</p>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setViewModalOpen(false)}>
            Close
          </Button>
          {selectedTimesheet?.status === 'draft' && (
            <Button
              variant="primary"
              onClick={() => {
                handleSubmit(selectedTimesheet.id);
                setViewModalOpen(false);
              }}
              loading={submitMutation.isPending}
              className="gap-1"
            >
              <Send size={14} />
              Submit for Approval
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
