import { useState } from 'react';
import { useTasks, useDeleteEntity } from '../hooks/use-api.js';
import { CheckSquare, Plus, Search, Trash2, CheckCircle2, Circle, Pencil } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { crmFetch } from '../api.js';
import TaskForm from '../components/forms/TaskForm.js';
import type { Task } from '../api.js';

export default function TasksPage() {
  const { data, isLoading, refetch } = useTasks();
  const deleteMutation = useDeleteEntity();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const openCreate = () => { setEditTask(null); setModalOpen(true); };
  const openEdit = (task: Task) => { setEditTask(task); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTask(null); };

  const tasks = data?.tasks.filter((t) => !t.deletedAt) ?? [];
  const filtered = tasks.filter((t) => {
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'open' ? !t.completedAt : !!t.completedAt);
    return matchesSearch && matchesFilter;
  });

  const toggleComplete = async (task: Task) => {
    if (task.completedAt) {
      await crmFetch(`/api/tasks/${task.id}/reopen`, { method: 'PUT' });
    } else {
      await crmFetch(`/api/tasks/${task.id}/complete`, { method: 'PUT' });
    }
    refetch();
  };

  if (isLoading) return <div className="text-slate-500">Loading tasks...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={20} className="text-slate-600" />
          <h1 className="text-xl font-semibold">Tasks</h1>
          <span className="text-sm text-slate-500">({filtered.length})</span>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          <Plus size={16} /> Add Task
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-md text-sm border capitalize', filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50')}
          >
            {f} ({f === 'all' ? tasks.length : tasks.filter(t => f === 'open' ? !t.completedAt : !!t.completedAt).length})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
        <Search size={16} className="text-slate-400" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm outline-none"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={cn('bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3 hover:shadow-sm transition-shadow',
              task.completedAt && 'opacity-60'
            )}
          >
            <button onClick={() => toggleComplete(task)} className="shrink-0">
              {task.completedAt ? (
                <CheckCircle2 size={20} className="text-green-500" />
              ) : (
                <Circle size={20} className="text-slate-300 hover:text-slate-500" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className={cn('text-sm font-medium', task.completedAt && 'line-through text-slate-400')}>{task.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {task.description ?? 'No description'}
                {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                task.priority === 'high' ? 'bg-red-100 text-red-700' :
                task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {task.priority}
              </span>
              <button onClick={() => openEdit(task)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => deleteMutation.mutate({ type: 'tasks', id: task.id })}
                className="p-1.5 rounded hover:bg-red-100 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">No tasks found</div>
        )}
      </div>

      <TaskForm open={modalOpen} onClose={closeModal} task={editTask} />
    </div>
  );
}
