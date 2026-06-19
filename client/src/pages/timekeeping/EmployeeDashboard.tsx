import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import { StatCard } from '../../components/ui/StatCard.tsx';
import {
  Clock,
  Coffee,
  Calendar,
  FileText,
  Briefcase,
  ArrowRight,
  LogIn,
  LogOut,
  Pause,
  Play,
  Timer,
  TrendingUp,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

interface TimeEntry {
  id: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  projectName?: string;
  taskName?: string;
}

interface TeamPresence {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out' | 'on_break';
  currentProject?: string;
  currentTask?: string;
  clockedInAt?: string;
  activityScore?: number;
}

interface TimesheetSummary {
  weekHours: number;
  overtimeHours: number;
  remainingPtoDays: number;
  currentProjectName?: string;
  currentTaskName?: string;
}

interface PtoRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  days: number;
}

export default function EmployeeDashboard(): React.ReactElement {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refresh current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // tRPC queries
  const { data: presenceData, isLoading: presenceLoading } = trpc.timekeeping.getTeamPresence.useQuery();
  const { data: timeEntriesData, isLoading: entriesLoading } = trpc.timekeeping.listTimeEntries.useQuery({
    limit: 5,
    offset: 0,
  });

  // Find own presence from team data (filter to current user in real app)
  const ownPresence: TeamPresence | undefined = presenceData?.find((p: TeamPresence) => p.id === 'me') ?? {
    id: 'me',
    name: 'Me',
    status: 'clocked_out',
  };

  const timeEntries: TimeEntry[] = timeEntriesData?.items ?? [];

  // Derived state
  const isClockedIn = ownPresence?.status === 'clocked_in';
  const isOnBreak = ownPresence?.status === 'on_break';

  const todayDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const mockSummary: TimesheetSummary = {
    weekHours: 32.5,
    overtimeHours: 2.5,
    remainingPtoDays: 12,
    currentProjectName: ownPresence?.currentProject,
    currentTaskName: ownPresence?.currentTask,
  };

  const mockUpcomingPto: PtoRequest | null = {
    id: '1',
    type: 'Vacation',
    startDate: '2025-08-15',
    endDate: '2025-08-20',
    status: 'approved',
    days: 5,
  };

  // Status badge helper
  const getStatusBadge = () => {
    if (isOnBreak) return <Badge variant="yellow">On Break</Badge>;
    if (isClockedIn) return <Badge variant="green">Clocked In</Badge>;
    return <Badge variant="gray">Clocked Out</Badge>;
  };

  // Format relative time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'clock_in':
        return <LogIn size={16} className="text-emerald-500" />;
      case 'clock_out':
        return <LogOut size={16} className="text-red-500" />;
      case 'break_start':
        return <Pause size={16} className="text-amber-500" />;
      case 'break_end':
        return <Play size={16} className="text-blue-500" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getEntryLabel = (type: string) => {
    switch (type) {
      case 'clock_in':
        return 'Clocked In';
      case 'clock_out':
        return 'Clocked Out';
      case 'break_start':
        return 'Break Started';
      case 'break_end':
        return 'Break Ended';
      default:
        return type;
    }
  };

  if (presenceLoading && entriesLoading) {
    return <Loading message="Loading dashboard..." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Timekeeping</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your time, attendance, and leave.</p>
      </div>

      {/* Today Card */}
      <Card className="mb-6">
        <div className="card-body">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Calendar size={16} />
                <span>{todayDate}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {isClockedIn ? 'Currently Working' : isOnBreak ? 'On Break' : 'Not Clocked In'}
                </h2>
                {getStatusBadge()}
              </div>
              {ownPresence?.currentProject && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  <Briefcase size={14} className="mr-1 inline" />
                  {ownPresence.currentProject}
                  {ownPresence.currentTask && ` — ${ownPresence.currentTask}`}
                </p>
              )}
              {ownPresence?.activityScore !== undefined && (
                <div className="mt-3 flex items-center gap-2">
                  <Activity size={16} className="text-primary-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Activity Score: <strong>{ownPresence.activityScore}%</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isClockedIn ? (
                <>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => addToast('info', 'Starting break...')}
                    className="gap-2"
                  >
                    <Coffee size={20} />
                    Start Break
                  </Button>
                  <Button
                    size="lg"
                    variant="danger"
                    onClick={() => addToast('info', 'Clocking out...')}
                    className="gap-2"
                  >
                    <LogOut size={20} />
                    Clock Out
                  </Button>
                </>
              ) : isOnBreak ? (
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => addToast('info', 'Ending break...')}
                  className="gap-2"
                >
                  <Play size={20} />
                  End Break
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => addToast('info', 'Clocking in...')}
                  className="gap-2"
                >
                  <LogIn size={20} />
                  Clock In
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="This Week"
          value={`${mockSummary.weekHours}h`}
          change="+2.5h"
          changeType="positive"
          icon={Clock}
          color="primary"
        />
        <StatCard
          title="Overtime"
          value={`${mockSummary.overtimeHours}h`}
          change="+0.5h"
          changeType="negative"
          icon={TrendingUp}
          color="orange"
        />
        <StatCard
          title="PTO Remaining"
          value={`${mockSummary.remainingPtoDays} days`}
          change="12 total"
          changeType="neutral"
          icon={Sun}
          color="green"
        />
        <StatCard
          title="Current Project"
          value={mockSummary.currentProjectName ?? 'None'}
          change={mockSummary.currentTaskName}
          changeType="neutral"
          icon={Briefcase}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card title="Recent Activity" subtitle="Last 5 time entries">
          {entriesLoading ? (
            <Loading size="sm" />
          ) : timeEntries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No recent activity"
              description="Your clock in/out and break history will appear here."
            />
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry: TimeEntry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-700">
                      {getEntryIcon(entry.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getEntryLabel(entry.type)}
                      </p>
                      {entry.projectName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.projectName}
                          {entry.taskName && ` — ${entry.taskName}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatTime(entry.timestamp)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateShort(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Column: Upcoming PTO + Actions */}
        <div className="space-y-6">
          {/* Upcoming PTO */}
          <Card title="Upcoming Leave">
            {mockUpcomingPto ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800">
                      <Sun size={20} className="text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {mockUpcomingPto.type} Leave
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateShort(mockUpcomingPto.startDate)} — {formatDateShort(mockUpcomingPto.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="green">Approved</Badge>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{mockUpcomingPto.days} days</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No upcoming leave"
                description="Your approved leave requests will appear here."
              />
            )}
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => addToast('info', isClockedIn ? 'Clocking out...' : 'Clocking in...')}
              >
                {isClockedIn ? <LogOut size={18} /> : <LogIn size={18} />}
                {isClockedIn ? 'Clock Out' : 'Clock In'}
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => addToast('info', isOnBreak ? 'Ending break...' : 'Starting break...')}
              >
                {isOnBreak ? <Play size={18} /> : <Coffee size={18} />}
                {isOnBreak ? 'End Break' : 'Start Break'}
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => navigate('/timekeeping/pto')}
              >
                <Calendar size={18} />
                Request PTO
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => navigate('/timekeeping/timesheets')}
              >
                <FileText size={18} />
                View Timesheets
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => navigate('/timekeeping/projects')}
              >
                <Briefcase size={18} />
                View Projects
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => addToast('info', 'Opening timer...')}
              >
                <Timer size={18} />
                Project Timer
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
