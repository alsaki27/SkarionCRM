import { useState, type FormEvent } from 'react';
import { useCreateEntity, useUpdateEntity, useCompanies } from '../../hooks/use-api.js';
import type { Contact } from '../../api.js';
import Modal from '../ui/Modal.js';

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact | null;
}

export default function ContactForm({ open, onClose, contact }: ContactFormProps) {
  const create = useCreateEntity('contacts');
  const update = useUpdateEntity('contacts');
  const { data: companiesData } = useCompanies();
  const isEdit = !!contact;

  const companies = companiesData?.companies.filter((c) => !c.deletedAt) ?? [];

  const [form, setForm] = useState({
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    title: contact?.title ?? '',
    companyId: contact?.companyId ?? '',
  });

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data = { ...form, companyId: form.companyId || null };
    if (isEdit && contact) {
      update.mutate({ id: contact.id, data }, { onSuccess: onClose });
    } else {
      create.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Contact' : 'Add Contact'}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">First Name *</label>
            <input required value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Last Name *</label>
            <input required value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Email *</label>
          <input type="email" required value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
          <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
          <input value={form.title} onChange={(e) => handleChange('title', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" placeholder="e.g. VP Sales" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Company</label>
          <select value={form.companyId} onChange={(e) => handleChange('companyId', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
            <option value="">— None —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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
