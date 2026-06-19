import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '../../../api.ts';
import { Card } from '../../../components/ui/Card.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Loading } from '../../../components/ui/Loading.tsx';
import { EmptyState } from '../../../components/ui/EmptyState.tsx';
import { StatCard } from '../../../components/ui/StatCard.tsx';
import { addToast } from '../../../components/ui/Toast.tsx';
import {
  Users,
  Wifi,
  Coffee,
  CalendarX,
  AlertTriangle,
  Monitor,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Briefcase,
  ChevronRight,
  User,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────
type EmployeeStatus = 'online' | 'on_break' | 'idle' | 'offline' | 'on_leave' | 'late' | 'remote';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  avatarUrl?: string | null;
}

interface PresenceRecord {
  employeeId: string;
  status: EmployeeStatus;
  currentProject?: string | null;
  lastActivityAt?: string | null;
  clockInAt?: string | null;
  hoursWorkedToday: number;
  isOnLeave: boolean;
}

interface TeamPresenceData {
  employees: Employee[];
  presence: Record<string, PresenceRecord>;
  stats: {
    total: number;
    online: number;
    onBreak: number;
    onLeave: number;
    late: number;
    remote: number;
  };
}

interface TimesheetEntry {
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number;
  project: string | null;
}

interface PtoRecord {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────
const statusConfig: Record<
  EmployeeStatus,
  { label: string; variant: Parameters<typeof Badge>[0]['variant']; icon: React.ReactNode }
> = {
  online:   { label: 'Online',   variant: 'green',   icon: <Wifi size={14} /> },
  on_break: { label: 'On Break', variant: 'yellow',  icon: <Coffee size={14} /> },
  idle:     { label: 'Idle',     variant: 'orange',  icon: <Clock size={14} /> },
  offline:  { label: 'Offline',  variant: 'gray',    icon: <User size={14} /> },
  on_leave: { label: 'On Leave', variant: 'purple',  icon: <CalendarX size={14} /> },
  late:     { label: 'Late',     variant: 'red',     icon: <AlertTriangle size={14} /> },
  remote:   { label: 'Remote',   variant: 'blue',    icon: <Monitor size={14} /> },
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

// ─── Component ─────────────────────────────────────────
export default function TeamPresence(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const { data, isLoading, refetch } = trpc.timekeeping.getTeamPresence.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const employeesQuery = trpc.employee.listEmployees.useQuery();

  const mergedData: TeamPresenceData | undefined = useMemo(() => {
    if (!data) return undefined;
    const employees = employeesQuery.data ?? data.employees ?? [];
    return { ...data, employees };
  }, [data, employeesQuery.data]);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    mergedData?.employees.forEach((e) => set.add(e.department));
    return Array.from(set).sort();
  }, [mergedData]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!mergedData) return [];
    return mergedData.employees.filter((emp) => {
      const rec = mergedData.presence[emp.id];
      const status = rec?.status ?? 'offline';
      const matchesSearch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase())
        || emp.jobTitle.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [mergedData, search, statusFilter, deptFilter]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
    setLastRefreshed(new Date());
    addToast('success', 'Team presence refreshed');
  }, [refetch]);

  // Auto-refresh indicator
  useEffect(() => {
    const interval = setInterval(() => setLastRefreshed(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Selected employee detail
  const selectedEmployee = useMemo(
    () => mergedData?.employees.find((e) => e.id === selectedEmployeeId),
    [mergedData, selectedEmployeeId]
  );
  const selectedPresence = selectedEmployeeId ? mergedData?.presence[selectedEmployeeId] : undefined;

  // Dummy timesheet/pto for detail modal (real data would come from additional queries)
  const dummyTimesheet: TimesheetEntry[] = [
    { date: '2026-06-17', clockIn: '09:00', clockOut: '12:30', hours: 3.5, project: 'Project Alpha' },
    { date: '2026-06-17', clockIn: '13:00', clockOut: '17:00', hours: 4, project: 'Project Alpha' },
    { date: '2026-06-16', clockIn: '08:45', clockOut: '12:00', hours: 3.25, project: 'Project Beta' },
    { date: '2026-06-16', clockIn: '13:00', clockOut: '17:30', hours: 4.5, project: 'Project Beta' },
  ];
  const dummyPto: PtoRecord[] = [
    { id: '1', leaveType: 'Vacation', startDate: '2026-07-01', endDate: '2026-07-05', days: 5, status: 'Approved' },
  ];

  const stats = mergedData?.stats ?? { total: 0, online: 0, onBreak: 0, onLeave: 0, late: 0, remote: 0 };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title dark:text-white">Team Presence</h1>
            <p className="page-subtitle dark:text-gray-400">
              Real-time overview of your team&apos;s attendance and status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </span>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              <RefreshCw size={14} className="mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard title="Total" value={stats.total} icon={Users} color="primary" />
          <StatCard title="Online" value={stats.online} icon={Wifi} color="green" />
          <StatCard title="On Break" value={stats.onBreak} icon={Coffee} color="orange" />
          <StatCard title="On Leave" value={stats.onLeave} icon={CalendarX} color="purple" />
          <StatCard title="Late" value={stats.late} icon={AlertTriangle} color="red" />
          <StatCard title="Remote" value={stats.remote} icon={Monitor} color="blue" />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="card-body flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or job title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input w-full pl-9 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | 'all')}
                className="form-input w-40 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="on_break">On Break</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
                <option value="on_leave">On Leave</option>
                <option value="late">Late</option>
                <option value="remote">Remote</option>
              </select>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="form-input w-40 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Loading */}
        {isLoading && <Loading message="Loading team presence..." />}

        {/* Empty */}
        {!isLoading && filteredEmployees.length === 0 && (
          <EmptyState
            icon={Users}
            title="No employees found"
            description="Try adjusting your filters or search query."
          />
        )}

        {/* Employee Grid */}
        {!isLoading && filteredEmployees.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEmployees.map((emp) => {
              const rec = mergedData?.presence[emp.id];
              const status = rec?.status ?? 'offline';
              const cfg = statusConfig[status];
              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className="card cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 dark:bg-gray-800 dark:ring-gray-700"
                >
                  <div className="card-body">
                    <div className="flex items-start gap-3">
                      {emp.avatarUrl ? (
                        <img
                          src={emp.avatarUrl}
                          alt={`${emp.firstName} ${emp.lastName}`}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-sm dark:bg-primary-900 dark:text-primary-300">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{emp.jobTitle}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Badge variant={cfg.variant}>
                            <span className="mr-1">{cfg.icon}</span>
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {rec?.currentProject && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Briefcase size={12} className="text-gray-400" />
                          <span className="truncate">{rec.currentProject}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <Clock size={12} className="text-gray-400" />
                        <span>Clock-in: {formatTime(rec?.clockInAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <RefreshCw size={12} className="text-gray-400" />
                        <span>Last activity: {formatTime(rec?.lastActivityAt)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Hours today</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatHours(rec?.hoursWorkedToday ?? 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer justify-between py-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{emp.department}</span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      <Modal
        isOpen={!!selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
        title={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Employee Detail'}
        size="lg"
      >
        {selectedEmployee && selectedPresence && (
          <div className="space-y-6">
            {/* Profile */}
            <div className="flex items-center gap-4">
              {selectedEmployee.avatarUrl ? (
                <img src={selectedEmployee.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold text-lg dark:bg-primary-900 dark:text-primary-300">
                  {getInitials(selectedEmployee.firstName, selectedEmployee.lastName)}
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedEmployee.jobTitle}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEmployee.department}</p>
                <div className="mt-1">
                  <Badge variant={statusConfig[selectedPresence.status].variant}>
                    {statusConfig[selectedPresence.status].label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-700/50">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatHours(selectedPresence.hoursWorkedToday)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hours Today</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-700/50">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(selectedPresence.clockInAt)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Clock-in</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-700/50">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(selectedPresence.lastActivityAt)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last Activity</p>
              </div>
            </div>

            {/* Timesheet */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Recent Timesheet</h4>
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">In</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Out</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Hours</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Project</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dummyTimesheet.map((t, i) => (
                      <tr key={i} className="dark:bg-gray-900">
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{t.date}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{t.clockIn}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{t.clockOut ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-200">{t.hours}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{t.project ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PTO */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Upcoming Leave</h4>
              {dummyPto.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming leave requests.</p>
              ) : (
                <div className="space-y-2">
                  {dummyPto.map((pto) => (
                    <div key={pto.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{pto.leaveType}</span>
                        <Badge variant={pto.status === 'Approved' ? 'green' : 'yellow'}>{pto.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {pto.startDate} to {pto.endDate} ({pto.days} days)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="card-footer">
          <Button variant="secondary" onClick={() => setSelectedEmployeeId(null)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
