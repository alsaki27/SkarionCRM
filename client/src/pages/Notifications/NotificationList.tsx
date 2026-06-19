import React, { useState, useEffect } from 'react';
import { trpc } from '../../api.ts';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Bell,
  Search,
  Check,
  CheckCheck,
  X,
  Trash2,
  MessageSquare,
  FileText,
  DollarSign,
  AlertTriangle,
  Info,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

type NotificationType = 'mention' | 'task' | 'payment' | 'alert' | 'info' | 'invoice' | 'document' | 'system';
type FilterTab = 'all' | 'unread' | 'mentions' | 'tasks' | 'payments';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

const typeIconMap: Record<NotificationType, React.ReactNode> = {
  mention: <MessageSquare size={16} className="text-blue-500" />,
  task: <Clock size={16} className="text-purple-500" />,
  payment: <DollarSign size={16} className="text-green-500" />,
  alert: <AlertTriangle size={16} className="text-red-500" />,
  info: <Info size={16} className="text-gray-500" />,
  invoice: <FileText size={16} className="text-orange-500" />,
  document: <FileText size={16} className="text-cyan-500" />,
  system: <Bell size={16} className="text-gray-500" />,
};

const typeLabelMap: Record<NotificationType, string> = {
  mention: 'Mention',
  task: 'Task',
  payment: 'Payment',
  alert: 'Alert',
  info: 'Info',
  invoice: 'Invoice',
  document: 'Document',
  system: 'System',
};

const filterTabs: { key: FilterTab; label: string; count?: (n: NotificationItem[]) => number }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread', count: (n) => n.filter((x) => !x.read).length },
  { key: 'mentions', label: 'Mentions', count: (n) => n.filter((x) => x.type === 'mention').length },
  { key: 'tasks', label: 'Tasks', count: (n) => n.filter((x) => x.type === 'task').length },
  { key: 'payments', label: 'Payments', count: (n) => n.filter((x) => x.type === 'payment').length },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return `${date.toLocaleDateString()}, ${timeStr}`;
}

export default function NotificationList(): React.ReactElement {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const query = trpc.notification.listNotifications.useQuery({
    page,
    pageSize,
    read: activeFilter === 'unread' ? false : undefined,
    type: activeFilter === 'mentions' ? 'mention' : activeFilter === 'tasks' ? 'task' : activeFilter === 'payments' ? 'payment' : undefined,
    search: searchQuery || undefined,
  });

  const unreadQuery = trpc.notification.getUnreadCount.useQuery();

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      addToast('success', 'Marked as read');
      query.refetch();
      unreadQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to mark as read');
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      addToast('success', 'All notifications marked as read');
      query.refetch();
      unreadQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to mark all as read');
    },
  });

  const dismissMutation = trpc.notification.dismiss.useMutation({
    onSuccess: () => {
      addToast('success', 'Notification dismissed');
      query.refetch();
      unreadQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to dismiss');
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      addToast('success', 'Notification deleted');
      query.refetch();
      unreadQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete');
    },
  });

  const notifications: NotificationItem[] = query.data?.notifications ?? [];
  const total = query.data?.total ?? 0;
  const unreadCount = unreadQuery.data ?? 0;

  // Reset page and selection when filter or search changes
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeFilter, searchQuery]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length && notifications.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleBulkMarkRead = () => {
    const ids = Array.from(selectedIds);
    Promise.all(ids.map((id) => markAsReadMutation.mutateAsync({ id })))
      .then(() => {
        addToast('success', `${ids.length} notification(s) marked as read`);
        setSelectedIds(new Set());
      })
      .catch(() => {
        addToast('error', 'Failed to mark some notifications as read');
      });
  };

  const handleBulkDismiss = () => {
    const ids = Array.from(selectedIds);
    Promise.all(ids.map((id) => dismissMutation.mutateAsync({ id })))
      .then(() => {
        addToast('success', `${ids.length} notification(s) dismissed`);
        setSelectedIds(new Set());
      })
      .catch(() => {
        addToast('error', 'Failed to dismiss some notifications');
      });
  };

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} notification(s)? This action cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    Promise.all(ids.map((id) => deleteMutation.mutateAsync({ id })))
      .then(() => {
        addToast('success', `${ids.length} notification(s) deleted`);
        setSelectedIds(new Set());
      })
      .catch(() => {
        addToast('error', 'Failed to delete some notifications');
      });
  };

  const isAllSelected = notifications.length > 0 && selectedIds.size === notifications.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < notifications.length;

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isIndeterminate;
          }}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
        />
      ),
      width: '40px',
      align: 'center' as const,
      render: (row: NotificationItem) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
        />
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '48px',
      align: 'center' as const,
      render: (row: NotificationItem) => (
        <div className="flex items-center justify-center">
          {typeIconMap[row.type] ?? typeIconMap.system}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row: NotificationItem) => (
        <div className="max-w-xs">
          <p className={clsx('text-sm', !row.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
            {row.title}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{row.body}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      width: '180px',
      render: (row: NotificationItem) => (
        <span className="text-sm text-gray-500">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '80px',
      align: 'center' as const,
      render: (row: NotificationItem) => (
        row.read ? (
          <Badge variant="gray" className="text-xs">Read</Badge>
        ) : (
          <Badge variant="blue" className="text-xs">Unread</Badge>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      align: 'right' as const,
      render: (row: NotificationItem) => (
        <div className="flex items-center justify-end gap-1">
          {!row.read && (
            <button
              onClick={() => markAsReadMutation.mutate({ id: row.id })}
              disabled={markAsReadMutation.isPending}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Mark as read"
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={() => dismissMutation.mutate({ id: row.id })}
            disabled={dismissMutation.isPending}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
          <button
            onClick={() => deleteMutation.mutate({ id: row.id })}
            disabled={deleteMutation.isPending}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="blue" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              loading={markAllAsReadMutation.isPending}
            >
              <CheckCheck size={16} className="mr-1.5" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          </div>

          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => {
              const count = tab.count?.(notifications) ?? undefined;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    activeFilter === tab.key
                      ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  )}
                >
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span className={clsx(
                      'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                      activeFilter === tab.key ? 'bg-primary-200 text-primary-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkMarkRead}
                  loading={markAsReadMutation.isPending}
                >
                  <Check size={14} className="mr-1" />
                  Mark as read
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkDismiss}
                  loading={dismissMutation.isPending}
                >
                  <X size={14} className="mr-1" />
                  Dismiss
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      {query.isLoading && notifications.length === 0 ? (
        <Loading message="Loading notifications..." />
      ) : query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load notifications</p>
          <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications found"
          description={searchQuery ? 'Try adjusting your search.' : 'Notifications will appear here.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={clsx(
                          'table-header whitespace-nowrap px-4 py-3 font-medium text-gray-700',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                        style={{ width: col.width }}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {notifications.map((row) => (
                    <tr
                      key={row.id}
                      className={clsx(
                        'hover:bg-gray-50 transition-colors',
                        !row.read && 'bg-primary-50/20'
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={clsx(
                            'table-cell whitespace-nowrap px-4 py-3 text-gray-900',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right'
                          )}
                        >
                          {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
                <span className="font-medium">{total}</span> results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Prev
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
