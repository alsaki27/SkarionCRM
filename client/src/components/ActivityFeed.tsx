import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import {
  Activity,
  FileText,
  DollarSign,
  UserPlus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';

type ActivityType =
  | 'create'
  | 'update'
  | 'delete'
  | 'payment'
  | 'invoice'
  | 'task'
  | 'mention'
  | 'alert'
  | 'compliance'
  | 'document'
  | 'payroll'
  | 'login';

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  userName?: string;
  createdAt: string;
}

const activityIconMap: Record<ActivityType, React.ReactNode> = {
  create: <UserPlus size={14} className="text-green-500" />,
  update: <Edit3 size={14} className="text-blue-500" />,
  delete: <Trash2 size={14} className="text-red-500" />,
  payment: <DollarSign size={14} className="text-green-500" />,
  invoice: <FileText size={14} className="text-orange-500" />,
  task: <CheckCircle2 size={14} className="text-purple-500" />,
  mention: <MessageSquare size={14} className="text-blue-500" />,
  alert: <AlertTriangle size={14} className="text-red-500" />,
  compliance: <Clock size={14} className="text-yellow-500" />,
  document: <FileText size={14} className="text-cyan-500" />,
  payroll: <DollarSign size={14} className="text-indigo-500" />,
  login: <UserPlus size={14} className="text-gray-500" />,
};

const activityBgMap: Record<ActivityType, string> = {
  create: 'bg-green-50',
  update: 'bg-blue-50',
  delete: 'bg-red-50',
  payment: 'bg-green-50',
  invoice: 'bg-orange-50',
  task: 'bg-purple-50',
  mention: 'bg-blue-50',
  alert: 'bg-red-50',
  compliance: 'bg-yellow-50',
  document: 'bg-cyan-50',
  payroll: 'bg-indigo-50',
  login: 'bg-gray-50',
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
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return new Date(dateStr).toDateString() === yesterday.toDateString();
}

function groupByDate(activities: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: Record<string, ActivityItem[]> = {};

  for (const activity of activities) {
    let key: string;
    if (isToday(activity.createdAt)) {
      key = 'Today';
    } else if (isYesterday(activity.createdAt)) {
      key = 'Yesterday';
    } else {
      key = 'Earlier';
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(activity);
  }

  const result: { label: string; items: ActivityItem[] }[] = [];
  if (groups['Today']) result.push({ label: 'Today', items: groups['Today'] });
  if (groups['Yesterday']) result.push({ label: 'Yesterday', items: groups['Yesterday'] });
  if (groups['Earlier']) result.push({ label: 'Earlier', items: groups['Earlier'] });
  return result;
}

export default function ActivityFeed(): React.ReactElement {
  const navigate = useNavigate();
  const query = trpc.activity.getRecentActivity.useQuery({ limit: 10 });

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      query.refetch();
    }, 60000);
    return () => clearInterval(interval);
  }, [query]);

  const activities: ActivityItem[] = query.data?.activities ?? [];
  const grouped = groupByDate(activities);

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.entityType && activity.entityId) {
      navigate(`/${activity.entityType}/${activity.entityId}`);
    }
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Activity size={16} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[28rem]">
        {query.isLoading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-600" />
          </div>
        ) : activities.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Activity will appear here as you use Skarion."
              className="py-0"
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 bg-gray-50/80 backdrop-blur-sm px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map((activity) => (
                    <div
                      key={activity.id}
                      onClick={() => handleActivityClick(activity)}
                      className={clsx(
                        'group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50',
                        activity.entityType && activity.entityId && 'cursor-pointer'
                      )}
                    >
                      <div className={clsx('flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full', activityBgMap[activity.type] ?? 'bg-gray-50')}>
                        {activityIconMap[activity.type] ?? activityIconMap.update}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-900 leading-relaxed">
                          {activity.userName && (
                            <span className="font-semibold">{activity.userName} </span>
                          )}
                          <span>{activity.description}</span>
                          {activity.entityName && (
                            <span className="font-medium text-primary-600"> {activity.entityName}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={() => navigate('/activity')}
          className="flex w-full items-center justify-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          View all activity
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
