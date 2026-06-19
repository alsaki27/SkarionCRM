import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  FileText,
  DollarSign,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

type NotificationType = 'mention' | 'task' | 'payment' | 'alert' | 'info' | 'invoice' | 'document' | 'system';

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

const typeBgMap: Record<NotificationType, string> = {
  mention: 'bg-blue-50',
  task: 'bg-purple-50',
  payment: 'bg-green-50',
  alert: 'bg-red-50',
  info: 'bg-gray-50',
  invoice: 'bg-orange-50',
  document: 'bg-cyan-50',
  system: 'bg-gray-50',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationCenter(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadQuery = trpc.notification.getUnreadCount.useQuery();
  const notificationsQuery = trpc.notification.listNotifications.useQuery(
    { read: activeTab === 'unread' ? false : undefined },
    { refetchInterval: open ? 30000 : false }
  );

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      unreadQuery.refetch();
      notificationsQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to mark as read');
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      addToast('success', 'All notifications marked as read');
      unreadQuery.refetch();
      notificationsQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to mark all as read');
    },
  });

  const unreadCount = unreadQuery.data ?? 0;
  const notifications: NotificationItem[] = notificationsQuery.data?.notifications ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Poll every 30 seconds for new notifications when dropdown is closed
  useEffect(() => {
    if (open) return;
    const interval = setInterval(() => {
      unreadQuery.refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [open, unreadQuery]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate({ id });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.read) {
      markAsReadMutation.mutate({ id: notification.id });
    }
    if (notification.entityType && notification.entityId) {
      navigate(`/${notification.entityType}/${notification.entityId}`);
    } else {
      navigate('/notifications');
    }
    setOpen(false);
  };

  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-xl border border-gray-200 bg-white shadow-xl z-50 flex flex-col max-h-[32rem]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={clsx(
                'flex-1 px-4 py-2.5 text-sm font-medium text-center transition-colors',
                activeTab === 'all'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={clsx(
                'flex-1 px-4 py-2.5 text-sm font-medium text-center transition-colors',
                activeTab === 'unread'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-semibold text-red-600">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {notificationsQuery.isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-600" />
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  icon={Bell}
                  title="No notifications"
                  description={activeTab === 'unread' ? "You're all caught up!" : 'Notifications will appear here.'}
                  className="py-0"
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {displayedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={clsx(
                      'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50',
                      !notification.read && 'bg-primary-50/40'
                    )}
                  >
                    <div className={clsx('flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full', typeBgMap[notification.type])}>
                      {typeIconMap[notification.type] ?? typeIconMap.system}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm', !notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      {!notification.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          disabled={markAsReadMutation.isPending}
                          className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 transition-all"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all notifications
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
