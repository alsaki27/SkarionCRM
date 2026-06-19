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
  Briefcase,
  Plus,
  Clock,
  Calendar,
  CheckCircle,
  X,
  DollarSign,
  FileText,
  Timer,
  User,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: 'active' | 'completed' | 'on_hold' | 'archived';
  hoursContributed: number;
  lastActive: string;
  tasks: ProjectTask[];
}

interface ProjectTask {
  id: string;
  name: string;
}

interface ProjectTimeEntry {
  id: string;
  projectName: string;
  taskName: string;
  date: string;
  hours: number;
  billable: boolean;
  description: string;
  notes?: string;
}

const projectStatusMap: Record<string, { variant: 'green' | 'blue' | 'yellow' | 'gray'; label: string }> = {
  active: { variant: 'green', label: 'Active' },
  completed: { variant: 'blue', label: 'Completed' },
  on_hold: { variant: 'yellow', label: 'On Hold' },
  archived: { variant: 'gray', label: 'Archived' },
};

export default function MyProjects(): React.ReactElement {
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logHours, setLogHours] = useState('');
  const [logBillable, setLogBillable] = useState(true);
  const [logDescription, setLogDescription] = useState('');
  const [logNotes, setLogNotes] = useState('');

  // tRPC queries
  const { data: projectsData, isLoading: projectsLoading } = trpc.projects.getEmployeeProjects.useQuery();
  const { data: timeEntriesData, isLoading: entriesLoading } = trpc.projects.listProjectTimeEntries.useQuery({
    limit: 20,
    offset: 0,
  });
  const utils = trpc.useUtils();

  const createEntryMutation = trpc.projects.createProjectTimeEntry.useMutation({
    onSuccess: () => {
      addToast('success', 'Time entry logged successfully');
      setLogModalOpen(false);
      resetLogForm();
      utils.projects.listProjectTimeEntries.invalidate();
      utils.projects.getEmployeeProjects.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to log time entry');
    },
  });

  const projects: Project[] = projectsData?.projects ?? [];
  const timeEntries: ProjectTimeEntry[] = timeEntriesData?.items ?? [];

  const selectedProject = projects.find((p: Project) => p.id === selectedProjectId);
  const availableTasks = selectedProject?.tasks ?? [];

  const resetLogForm = () => {
    setSelectedProjectId('');
    setSelectedTaskId('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogHours('');
    setLogBillable(true);
    setLogDescription('');
    setLogNotes('');
  };

  const openLogModal = (projectId?: string) => {
    if (projectId) {
      setSelectedProjectId(projectId);
      const project = projects.find((p: Project) => p.id === projectId);
      if (project?.tasks?.[0]) {
        setSelectedTaskId(project.tasks[0].id);
      }
    }
    setLogModalOpen(true);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedTaskId || !logHours) {
      addToast('warning', 'Please fill in all required fields');
      return;
    }
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      addToast('warning', 'Please enter valid hours (0.1–24)');
      return;
    }
    createEntryMutation.mutate({
      projectId: selectedProjectId,
      taskId: selectedTaskId,
      date: logDate,
      hours,
      billable: logBillable,
      description: logDescription,
      notes: logNotes || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRelative = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
  };

  const entryColumns = [
    {
      key: 'projectName',
      header: 'Project',
      render: (row: ProjectTimeEntry) => (
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.projectName}</span>
        </div>
      ),
    },
    {
      key: 'taskName',
      header: 'Task',
      render: (row: ProjectTimeEntry) => <span className="text-gray-600 dark:text-gray-300">{row.taskName}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row: ProjectTimeEntry) => <span className="text-gray-600 dark:text-gray-300">{formatDate(row.date)}</span>,
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right' as const,
      render: (row: ProjectTimeEntry) => <span className="font-medium text-gray-900 dark:text-gray-100">{row.hours.toFixed(1)}</span>,
    },
    {
      key: 'billable',
      header: 'Billable',
      align: 'center' as const,
      render: (row: ProjectTimeEntry) =>
        row.billable ? (
          <CheckCircle size={16} className="mx-auto text-emerald-500" />
        ) : (
          <X size={16} className="mx-auto text-gray-300" />
        ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row: ProjectTimeEntry) => (
        <p className="max-w-xs truncate text-gray-600 dark:text-gray-300">{row.description}</p>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Projects</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View your assigned projects and log time.</p>
        </div>
        <Button variant="primary" onClick={() => openLogModal()} className="gap-2">
          <Plus size={18} />
          Log Time
        </Button>
      </div>

      {/* Assigned Projects */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Assigned Projects</h2>
        {projectsLoading ? (
          <Loading message="Loading projects..." />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No assigned projects"
            description="You are not currently assigned to any projects."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project) => (
              <Card key={project.id} className="transition-all hover:shadow-md">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Building2 size={14} />
                        {project.clientName}
                      </p>
                    </div>
                    <Badge variant={projectStatusMap[project.status]?.variant || 'gray'}>
                      {projectStatusMap[project.status]?.label || project.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock size={12} />
                        Hours
                      </div>
                      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{project.hoursContributed.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar size={12} />
                        Last Active
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{formatDateRelative(project.lastActive)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Tasks</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tasks && project.tasks.length > 0 ? (
                        project.tasks.slice(0, 3).map((task: ProjectTask) => (
                          <span
                            key={task.id}
                            className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {task.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No tasks</span>
                      )}
                      {project.tasks && project.tasks.length > 3 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">+{project.tasks.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => openLogModal(project.id)}
                    >
                      <Timer size={14} />
                      Log Time
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Time Log History */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Time Log History</h2>
        {entriesLoading ? (
          <Loading message="Loading time entries..." />
        ) : timeEntries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No time entries"
            description="Log your first time entry to a project."
            actionLabel="Log Time"
            onAction={() => openLogModal()}
          />
        ) : (
          <Table
            columns={entryColumns}
            data={timeEntries}
            keyExtractor={(row: ProjectTimeEntry) => row.id}
            pagination={false}
            emptyMessage="No time entries found"
          />
        )}
      </div>

      {/* Log Time Modal */}
      <Modal
        isOpen={logModalOpen}
        onClose={() => { setLogModalOpen(false); resetLogForm(); }}
        title="Log Time"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setLogModalOpen(false); resetLogForm(); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleLogSubmit}
              loading={createEntryMutation.isPending}
              className="gap-1"
            >
              <Plus size={16} />
              Log Time
            </Button>
          </>
        }
      >
        <form onSubmit={handleLogSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                const project = projects.find((p: Project) => p.id === e.target.value);
                setSelectedTaskId(project?.tasks?.[0]?.id ?? '');
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              required
            >
              <option value="">Select a project</option>
              {projects.map((project: Project) => (
                <option key={project.id} value={project.id}>
                  {project.name} — {project.clientName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Task</label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              required
              disabled={!selectedProjectId || availableTasks.length === 0}
            >
              <option value="">Select a task</option>
              {availableTasks.map((task: ProjectTask) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Hours</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="24"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                placeholder="8.0"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="billable"
              checked={logBillable}
              onChange={(e) => setLogBillable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
            />
            <label htmlFor="billable" className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <DollarSign size={14} />
              Billable time
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input
              type="text"
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes (optional)"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
