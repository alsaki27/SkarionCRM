import React, { useState, useMemo } from 'react';
import { trpc } from '../../../api.ts';
import { Card } from '../../../components/ui/Card.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Table } from '../../../components/ui/Table.tsx';
import { Modal } from '../../../components/ui/Modal.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Loading } from '../../../components/ui/Loading.tsx';
import { EmptyState } from '../../../components/ui/EmptyState.tsx';
import { addToast } from '../../../components/ui/Toast.tsx';
import {
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  ChevronRight,
  ChevronDown,
  User,
  Building2,
  Palette,
  Check,
  ListTodo,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  managerId: string | null;
  budgetHours: number | null;
  hourlyRate: number | null;
  status: string;
  isBillable: boolean;
  startDate: string | null;
  endDate: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  estimatedHours: number | null;
  assignedToId: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

const PROJECT_STATUS = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];
const TASK_STATUS = ['To Do', 'In Progress', 'Review', 'Done', 'Blocked'];

const emptyProjectForm = {
  name: '',
  description: '',
  clientId: '',
  managerId: '',
  budgetHours: 0,
  hourlyRate: 0,
  isBillable: true,
  startDate: '',
  endDate: '',
  color: '#3b82f6',
  status: 'Planning',
};

const emptyTaskForm = {
  name: '',
  description: '',
  estimatedHours: 0,
  assignedToId: '',
  dueDate: '',
  status: 'To Do',
};

export default function ProjectSetup(): React.ReactElement {
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const projectsQuery = trpc.projects.listProjects.useQuery({ page, pageSize });
  const contactsQuery = trpc.contact.list.useQuery({ limit: 1000 });
  const usersQuery = trpc.user.list.useQuery();

  const tasksQuery = trpc.projects.listTasks.useQuery(
    { projectId: activeProjectId ?? '' },
    { enabled: !!activeProjectId }
  );

  const createProject = trpc.projects.createProject.useMutation({
    onSuccess: () => {
      addToast('success', 'Project created successfully');
      projectsQuery.refetch();
      closeProjectModal();
    },
    onError: (err) => addToast('error', err.message || 'Failed to create project'),
  });
  const updateProject = trpc.projects.updateProject.useMutation({
    onSuccess: () => {
      addToast('success', 'Project updated successfully');
      projectsQuery.refetch();
      closeProjectModal();
    },
    onError: (err) => addToast('error', err.message || 'Failed to update project'),
  });
  const deleteProject = trpc.projects.deleteProject.useMutation({
    onSuccess: () => {
      addToast('success', 'Project deleted');
      projectsQuery.refetch();
      if (activeProjectId) setActiveProjectId(null);
    },
    onError: (err) => addToast('error', err.message || 'Failed to delete project'),
  });

  const createTask = trpc.projects.createTask.useMutation({
    onSuccess: () => {
      addToast('success', 'Task created successfully');
      tasksQuery.refetch();
      closeTaskModal();
    },
    onError: (err) => addToast('error', err.message || 'Failed to create task'),
  });
  const updateTask = trpc.projects.updateTask.useMutation({
    onSuccess: () => {
      addToast('success', 'Task updated successfully');
      tasksQuery.refetch();
      closeTaskModal();
    },
    onError: (err) => addToast('error', err.message || 'Failed to update task'),
  });
  const deleteTask = trpc.projects.deleteTask.useMutation({
    onSuccess: () => {
      addToast('success', 'Task deleted');
      tasksQuery.refetch();
    },
    onError: (err) => addToast('error', err.message || 'Failed to delete task'),
  });

  const projects = (projectsQuery.data?.items ?? []) as Project[];
  const contacts = (contactsQuery.data?.items ?? []) as Contact[];
  const users = (usersQuery.data ?? []) as User[];
  const tasks = (tasksQuery.data?.items ?? []) as Task[];
  const total = projectsQuery.data?.total ?? 0;

  const openCreateProject = () => {
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
    setProjectModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      description: project.description ?? '',
      clientId: project.clientId ?? '',
      managerId: project.managerId ?? '',
      budgetHours: project.budgetHours ?? 0,
      hourlyRate: project.hourlyRate ?? 0,
      isBillable: project.isBillable,
      startDate: project.startDate ?? '',
      endDate: project.endDate ?? '',
      color: project.color ?? '#3b82f6',
      status: project.status,
    });
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectModalOpen(false);
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
  };

  const openCreateTask = (projectId: string) => {
    setEditingTaskId(null);
    setActiveProjectId(projectId);
    setTaskForm(emptyTaskForm);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setActiveProjectId(task.projectId);
    setTaskForm({
      name: task.name,
      description: task.description ?? '',
      estimatedHours: task.estimatedHours ?? 0,
      assignedToId: task.assignedToId ?? '',
      dueDate: task.dueDate ?? '',
      status: task.status,
    });
    setTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm);
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name.trim()) {
      addToast('error', 'Project name is required');
      return;
    }
    const payload = {
      ...projectForm,
      description: projectForm.description || undefined,
      clientId: projectForm.clientId || undefined,
      managerId: projectForm.managerId || undefined,
      budgetHours: projectForm.budgetHours || undefined,
      hourlyRate: projectForm.hourlyRate || undefined,
      startDate: projectForm.startDate || undefined,
      endDate: projectForm.endDate || undefined,
    };
    if (editingProjectId) {
      updateProject.mutate({ id: editingProjectId, ...payload });
    } else {
      createProject.mutate(payload);
    }
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.name.trim() || !activeProjectId) {
      addToast('error', 'Task name is required');
      return;
    }
    const payload = {
      ...taskForm,
      projectId: activeProjectId,
      description: taskForm.description || undefined,
      estimatedHours: taskForm.estimatedHours || undefined,
      assignedToId: taskForm.assignedToId || undefined,
      dueDate: taskForm.dueDate || undefined,
    };
    if (editingTaskId) {
      updateTask.mutate({ id: editingTaskId, ...payload });
    } else {
      createTask.mutate(payload);
    }
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject.mutate({ id });
    }
  };

  const handleDeleteTask = (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask.mutate({ id });
    }
  };

  const toggleExpandProject = (projectId: string) => {
    setActiveProjectId((prev) => (prev === projectId ? null : projectId));
  };

  const getContactName = (id: string | null) => {
    if (!id) return '—';
    const c = contacts.find((x) => x.id === id);
    return c?.name ?? id;
  };

  const getUserName = (id: string | null) => {
    if (!id) return '—';
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? id;
  };

  const projectColumns = [
    {
      key: 'expand',
      header: '',
      width: '40px',
      render: (row: Project) => (
        <button
          onClick={() => toggleExpandProject(row.id)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          {activeProjectId === row.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row: Project) => (
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: row.color ?? '#3b82f6' }}
          />
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (row: Project) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Building2 size={14} />
          {getContactName(row.clientId)}
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      render: (row: Project) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <User size={14} />
          {getUserName(row.managerId)}
        </div>
      ),
    },
    {
      key: 'budgetHours',
      header: 'Budget Hrs',
      render: (row: Project) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {row.budgetHours ?? '—'}
        </span>
      ),
    },
    {
      key: 'hourlyRate',
      header: 'Rate',
      render: (row: Project) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {row.hourlyRate ? `$${row.hourlyRate.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Project) => {
        const variant = row.status === 'Active' ? 'green' : row.status === 'Completed' ? 'blue' : row.status === 'On Hold' ? 'yellow' : 'gray';
        return <Badge variant={variant as any}>{row.status}</Badge>;
      },
    },
    {
      key: 'isBillable',
      header: 'Billable',
      render: (row: Project) => (
        <span className={`text-xs font-medium ${row.isBillable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {row.isBillable ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (row: Project) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'} – {row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: Project) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEditProject(row)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDeleteProject(row.id)}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const taskColumns = [
    { key: 'name', header: 'Task Name', render: (row: Task) => <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</span> },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (row: Task) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <User size={14} />
          {getUserName(row.assignedToId)}
        </div>
      ),
    },
    {
      key: 'estimatedHours',
      header: 'Est. Hours',
      render: (row: Task) => <span className="text-sm text-gray-900 dark:text-gray-100">{row.estimatedHours ?? '—'}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row: Task) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Task) => {
        const variant = row.status === 'Done' ? 'green' : row.status === 'In Progress' ? 'blue' : row.status === 'Blocked' ? 'red' : 'yellow';
        return <Badge variant={variant as any}>{row.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: Task) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEditTask(row)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => handleDeleteTask(row.id)}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title dark:text-gray-100">Project Setup</h1>
          <p className="page-subtitle dark:text-gray-400">Manage projects, budgets, and task assignments</p>
        </div>
        <Button onClick={openCreateProject}>
          <Plus size={16} className="mr-2" />
          Create Project
        </Button>
      </div>

      <Card>
        {projectsQuery.isLoading ? (
          <Loading message="Loading projects..." />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No projects"
            description="Create your first project to track time and budgets."
            actionLabel="Create Project"
            onAction={openCreateProject}
          />
        ) : (
          <div className="space-y-0">
            <Table
              columns={projectColumns}
              data={projects}
              keyExtractor={(row) => row.id}
              pagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
            />

            {/* Expanded Task Panel */}
            {activeProjectId && (
              <div className="border-t border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo size={18} className="text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Tasks for {projects.find((p) => p.id === activeProjectId)?.name}
                    </h3>
                  </div>
                  <Button size="sm" onClick={() => openCreateTask(activeProjectId)}>
                    <Plus size={14} className="mr-1.5" />
                    Add Task
                  </Button>
                </div>

                {tasksQuery.isLoading ? (
                  <Loading size="sm" message="Loading tasks..." />
                ) : tasks.length === 0 ? (
                  <EmptyState
                    icon={ListTodo}
                    title="No tasks yet"
                    description="Add tasks to this project to track progress."
                    actionLabel="Add Task"
                    onAction={() => openCreateTask(activeProjectId)}
                  />
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <Table
                      columns={taskColumns}
                      data={tasks}
                      keyExtractor={(row) => row.id}
                      emptyMessage="No tasks"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Project Modal */}
      <Modal
        isOpen={projectModalOpen}
        onClose={closeProjectModal}
        title={editingProjectId ? 'Edit Project' : 'Create Project'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeProjectModal}>
              Cancel
            </Button>
            <Button
              onClick={handleProjectSubmit}
              loading={createProject.isLoading || updateProject.isLoading}
            >
              {editingProjectId ? 'Update Project' : 'Create Project'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <div>
            <label className="form-label dark:text-gray-300">Project Name</label>
            <input
              type="text"
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              placeholder="e.g., Website Redesign"
              required
            />
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Description</label>
            <textarea
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              placeholder="Brief project description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Client</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.clientId}
                onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })}
              >
                <option value="">Select client...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Manager</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.managerId}
                onChange={(e) => setProjectForm({ ...projectForm, managerId: e.target.value })}
              >
                <option value="">Select manager...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label dark:text-gray-300">Budget Hours</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.budgetHours}
                onChange={(e) => setProjectForm({ ...projectForm, budgetHours: Number(e.target.value) })}
                min={0}
                step={0.5}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Hourly Rate ($)</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.hourlyRate}
                onChange={(e) => setProjectForm({ ...projectForm, hourlyRate: Number(e.target.value) })}
                min={0}
                step={0.01}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Status</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.status}
                onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
              >
                {PROJECT_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Start Date</label>
              <input
                type="date"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">End Date</label>
              <input
                type="date"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={projectForm.endDate}
                onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input
                id="isBillable"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800"
                checked={projectForm.isBillable}
                onChange={(e) => setProjectForm({ ...projectForm, isBillable: e.target.checked })}
              />
              <label htmlFor="isBillable" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Billable Project
              </label>
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800"
                  value={projectForm.color}
                  onChange={(e) => setProjectForm({ ...projectForm, color: e.target.value })}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">{projectForm.color}</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={closeTaskModal}
        title={editingTaskId ? 'Edit Task' : 'Add Task'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeTaskModal}>
              Cancel
            </Button>
            <Button
              onClick={handleTaskSubmit}
              loading={createTask.isLoading || updateTask.isLoading}
            >
              {editingTaskId ? 'Update Task' : 'Add Task'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleTaskSubmit} className="space-y-4">
          <div>
            <label className="form-label dark:text-gray-300">Task Name</label>
            <input
              type="text"
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              placeholder="e.g., Design homepage mockups"
              required
            />
          </div>

          <div>
            <label className="form-label dark:text-gray-300">Description</label>
            <textarea
              className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Task details..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Estimated Hours</label>
              <input
                type="number"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={taskForm.estimatedHours}
                onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: Number(e.target.value) })}
                min={0}
                step={0.5}
              />
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Due Date</label>
              <input
                type="date"
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label dark:text-gray-300">Assigned To</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={taskForm.assignedToId}
                onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label dark:text-gray-300">Status</label>
              <select
                className="form-input dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
              >
                {TASK_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
