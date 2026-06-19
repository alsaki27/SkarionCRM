import React, { useState, useMemo } from 'react';
import { trpc } from '../../../api.ts';
import { Card } from '../../../components/ui/Card.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Loading } from '../../../components/ui/Loading.tsx';
import { EmptyState } from '../../../components/ui/EmptyState.tsx';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  Monitor,
  CalendarCheck,
  CalendarX2,
  Info,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────
interface CalendarDayData {
  date: string;
  presentCount: number;
  onLeaveCount: number;
  remoteCount: number;
  holidayName?: string | null;
  isWeekend: boolean;
  employees: CalendarEmployee[];
  leaveDetails: CalendarLeave[];
}

interface CalendarEmployee {
  id: string;
  name: string;
  status: 'present' | 'remote';
}

interface CalendarLeave {
  employeeId: string;
  employeeName: string;
  leaveType: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
}

// ─── Helpers ─────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Component ─────────────────────────────────────────
export default function TeamCalendar(): React.ReactElement {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calendarQuery = trpc.pto.getTeamCalendar.useQuery({ year, month: month + 1 });
  const holidaysQuery = trpc.pto.listHolidays.useQuery({ year });

  const calendarData: Record<string, CalendarDayData> = useMemo(() => {
    const data = (calendarQuery.data as Record<string, CalendarDayData> | undefined) ?? {};
    return data;
  }, [calendarQuery.data]);

  const holidays: Holiday[] = useMemo(() => (holidaysQuery.data as Holiday[] | undefined) ?? [], [holidaysQuery.data]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const selectedDayData = selectedDate ? calendarData[selectedDate] : undefined;
  const selectedHoliday = selectedDate ? holidaysByDate.get(selectedDate) : undefined;

  const isLoading = calendarQuery.isLoading || holidaysQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title dark:text-white">Team Calendar</h1>
            <p className="page-subtitle dark:text-gray-400">
              Monthly overview of team attendance, leave, and holidays
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-[140px] text-center text-lg font-semibold text-gray-900 dark:text-white">
              {monthName} {year}
            </span>
            <Button variant="secondary" size="sm" onClick={nextMonth}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">On Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Remote</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Weekend</span>
          </div>
        </div>

        {isLoading ? (
          <Loading message="Loading calendar..." />
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                {dayNames.map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7">
                {/* Empty cells before start of month */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateKey = formatDateKey(year, month, day);
                  const dayData = calendarData[dateKey];
                  const holiday = holidaysByDate.get(dateKey);
                  const isWeekend = new Date(year, month, day).getDay() % 7 === 0 || new Date(year, month, day).getDay() % 7 === 6;
                  const isToday = dateKey === formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedDate(dateKey)}
                      className={`min-h-[100px] cursor-pointer border-b border-r border-gray-100 p-2 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/30 ${
                        isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'
                      } ${isToday ? 'ring-1 ring-inset ring-primary-400' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isToday ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {day}
                        </span>
                        {holiday && (
                          <Badge variant="orange" className="text-[10px]">
                            <CalendarCheck size={10} className="mr-0.5" />
                            {holiday.name}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        {dayData && dayData.presentCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <Users size={10} className="text-gray-400" />
                            <span>{dayData.presentCount} present</span>
                          </div>
                        )}
                        {dayData && dayData.onLeaveCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <div className="h-2 w-2 rounded-full bg-purple-500" />
                            <CalendarX2 size={10} className="text-gray-400" />
                            <span>{dayData.onLeaveCount} on leave</span>
                          </div>
                        )}
                        {dayData && dayData.remoteCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <Monitor size={10} className="text-gray-400" />
                            <span>{dayData.remoteCount} remote</span>
                          </div>
                        )}
                        {!dayData && !holiday && (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Holidays Summary */}
            {holidays.length > 0 && (
              <Card className="mt-6" title="Upcoming Holidays" subtitle={`${year}`}>
                <div className="card-body grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {holidays
                    .filter((h) => new Date(h.date) >= new Date(year, month, 1))
                    .slice(0, 6)
                    .map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <CalendarCheck size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{h.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{h.date}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Day Detail Modal */}
      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? `Details for ${selectedDate}` : 'Day Details'}
        size="lg"
      >
        {selectedDate && (
          <div className="space-y-6">
            {/* Holiday Info */}
            {selectedHoliday && (
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                <CalendarCheck size={20} className="text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Holiday: {selectedHoliday.name}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">All day</p>
                </div>
              </div>
            )}

            {selectedDayData ? (
              <>
                {/* Present */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Present ({selectedDayData.employees.filter((e) => e.status === 'present').length})
                    </h4>
                  </div>
                  {selectedDayData.employees.filter((e) => e.status === 'present').length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No employees present.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedDayData.employees
                        .filter((e) => e.status === 'present')
                        .map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          >
                            <Users size={10} />
                            {e.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Remote */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Remote ({selectedDayData.employees.filter((e) => e.status === 'remote').length})
                    </h4>
                  </div>
                  {selectedDayData.employees.filter((e) => e.status === 'remote').length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No remote employees.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedDayData.employees
                        .filter((e) => e.status === 'remote')
                        .map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            <Monitor size={10} />
                            {e.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* On Leave */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      On Leave ({selectedDayData.leaveDetails.length})
                    </h4>
                  </div>
                  {selectedDayData.leaveDetails.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No employees on leave.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayData.leaveDetails.map((leave) => (
                        <div
                          key={`${leave.employeeId}-${leave.leaveType}`}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800"
                        >
                          <div className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-purple-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{leave.employeeName}</span>
                          </div>
                          <Badge variant="purple">{leave.leaveType}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Info}
                title="No data for this day"
                description="There is no attendance or leave data recorded for this date."
              />
            )}
          </div>
        )}
        <div className="card-footer">
          <Button variant="secondary" onClick={() => setSelectedDate(null)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
