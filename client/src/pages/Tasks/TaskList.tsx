import React, { useState } from 'react';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Modal } from '../../components/ui/Modal';
import { addToast } from '../../components/ui/Toast';
import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Calendar,
  Grid3X3,
  List,
  Filter,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  assignedTo: string | null;
  assignedName: string | null;
}

const statusColumns: { key: Task['status']; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { key: 'review', label: 'Review', color: 'bg-yellow-50' },
  { key: 'done', label: 'Done', color: 'bg-green-50' },
];

const priorityConfig: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange'; label: string }> = {
  low: { variant: 'green', label: 'Low' },
  medium: { variant: 'blue', label: 'Medium' },
  high: { variant: 'orange', label: 'High' },
  urgent: { variant: 'red', label: 'Urgent' },
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
}

function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).toDateString() === new Date().toDateString();
}

export default function TaskList(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = trpc.task.list.useQuery({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    assignedTo: assignedFilter === 'all' ? undefined : assignedFilter,
    page,
    pageSize,
  });

  const usersQuery = trpc.org.listUsers.useQuery();

  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      addToast('success', 'Task updated');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update task');
    },
  });

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      addToast('success', 'Task created');
      setShowAddModal(false);
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create task');
    },
  });

  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      addToast('success', 'Task deleted');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete task');
    },
  });

  const tasks: Task[] = query.data?.tasks ?? [];

  const handleComplete = (task: Task) => {
    updateMutation.mutate({
      id: task.id,
      status: task.status === 'done' ? 'todo' : 'done',
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this task?')) return;
    deleteMutation.mutate({ id });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssignedFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || assignedFilter !== 'all' || searchQuery !== '';

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage and track your work</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} className="mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
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
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input text-sm"
              >
                <option value="all">All Status</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                className="form-input text-sm"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                value={assignedFilter}
                onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }}
                className="form-input text-sm"
              >
                <option value="all">All Assignees</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
                ))}
              </select>
              <div className="flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 ${viewMode === 'kanban' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="Kanban"
                >
                  <Grid3X3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="List"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-2 ${viewMode === 'calendar' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
                  title="Calendar"
                >
                  <Calendar size={16} />
                </button>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Content */}
      {query.isLoading && !tasks.length ? (
        <Loading message="Loading tasks..." />
      ) : query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load tasks</p>
          <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks found"
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first task to get started.'}
          actionLabel={hasActiveFilters ? undefined : 'Add Task'}
          onAction={hasActiveFilters ? undefined : () => setShowAddModal(true)}
        />
      ) : viewMode === 'kanban' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statusColumns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${col.color}`}>
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className="text-xs text-gray-500">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
                        isOverdue(task.dueDate) ? 'border-l-4 border-l-red-400' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        <button
                          onClick={() => handleComplete(task)}
                          className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          {task.status === 'done' ? (
                            <CheckCircle2 size={18} className="text-green-600" />
                          ) : (
                            <Circle size={18} />
                          )}
                        </button>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={priorityConfig[task.priority]?.variant || 'gray'} className="text-xs">
                          {priorityConfig[task.priority]?.label || task.priority}
                        </Badge>
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 text-xs ${isOverdue(task.dueDate) ? 'text-red-600 font-medium' : isDueToday(task.dueDate) ? 'text-amber-600' : 'text-gray-500'}`}>
                            <Clock size={12} />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {task.assignedName && (
                        <p className="mt-1 text-xs text-gray-400">Assigned: {task.assignedName}</p>
                      )}
                      <div className="mt-2 flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
                          <Trash2 size={12} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'list' ? (
        <Card>
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  isOverdue(task.dueDate) ? 'bg-red-50/50' : ''
                }`}
              >
                <button
                  onClick={() => handleComplete(task)}
                  className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors"
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant={priorityConfig[task.priority]?.variant || 'gray'} className="text-xs">
                      {priorityConfig[task.priority]?.label || task.priority}
                    </Badge>
                    <Badge variant="gray" className="text-xs">{task.status.replace('_', ' ')}</Badge>
                    {task.dueDate && (
                      <span className={`text-xs ${isOverdue(task.dueDate) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.assignedName && (
                      <span className="text-xs text-gray-500">{task.assignedName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <CalendarView tasks={tasks} />
      )}

      {/* Add Task Modal */}
      <TaskAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isLoading}
        users={users}
      />
    </div>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }): React.ReactElement {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const prefix = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const getTasksForDay = (day: number) => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
              {d}
            </div>
          ))}
          {prefix.map((i) => (
            <div key={`prefix-${i}`} className="min-h-[80px]" />
          ))}
          {days.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isToday = day === today.getDate();
            return (
              <div
                key={day}
                className={`min-h-[80px] rounded-lg border border-gray-100 p-1 ${
                  isToday ? 'bg-primary-50 border-primary-200' : ''
                }`}
              >
                <div className={`text-xs font-medium text-right mb-1 ${isToday ? 'text-primary-700' : 'text-gray-500'}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${
                        task.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : isOverdue(task.dueDate)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function TaskAddModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  users: any[];
}): React.ReactElement {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || undefined,
      assignedTo: assignedTo || undefined,
    });
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setAssignedTo('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Create Task
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder="Task title"
          />
        </div>
        <div>
          <label className="form-label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="form-input"
            placeholder="Task description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="form-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="form-label">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
        <div>
          <label className="form-label">Assigned To</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="form-input">
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
