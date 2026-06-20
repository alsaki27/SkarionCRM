import { useState, type FormEvent } from 'react';
import { useCreateEntity, useUpdateEntity, useCompanies, useContacts, useOpportunities } from '../../hooks/use-api.js';
import type { Task } from '../../api.js';
import Modal from '../ui/Modal.js';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
}

export default function TaskForm({ open, onClose, task }: TaskFormProps) {
  const create = useCreateEntity('tasks');
  const update = useUpdateEntity('tasks');
  const { data: companiesData } = useCompanies();
  const { data: contactsData } = useContacts();
  const { data: oppsData } = useOpportunities();
  const isEdit = !!task;

  const companies = companiesData?.companies.filter((c) => !c.deletedAt) ?? [];
  const contacts = contactsData?.contacts.filter((c) => !c.deletedAt) ?? [];
  const opps = oppsData?.opportunities.filter((o) => !o.deletedAt) ?? [];

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    priority: task?.priority ?? 'medium',
    companyId: task?.companyId ?? '',
    contactId: task?.contactId ?? '',
    opportunityId: task?.opportunityId ?? '',
  });

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      companyId: form.companyId || null,
      contactId: form.contactId || null,
      opportunityId: form.opportunityId || null,
      dueDate: form.dueDate || null,
    };
    if (isEdit && task) {
      update.mutate({ id: task.id, data }, { onSuccess: onClose });
    } else {
      create.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Title *</label>
          <input required value={form.title} onChange={(e) => handleChange('title', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => handleChange('dueDate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => handleChange('priority', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Company</label>
            <select value={form.companyId} onChange={(e) => handleChange('companyId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              <option value="">— None —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Contact</label>
            <select value={form.contactId} onChange={(e) => handleChange('contactId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              <option value="">— None —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Opportunity</label>
            <select value={form.opportunityId} onChange={(e) => handleChange('opportunityId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              <option value="">— None —</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-md text-sm border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isPending} className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
