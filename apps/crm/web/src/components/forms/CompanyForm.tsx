import { useState, type FormEvent } from 'react';
import { useCreateEntity, useUpdateEntity } from '../../hooks/use-api.js';
import type { Company } from '../../api.js';
import Modal from '../ui/Modal.js';

interface CompanyFormProps {
  open: boolean;
  onClose: () => void;
  company?: Company | null;
}

export default function CompanyForm({ open, onClose, company }: CompanyFormProps) {
  const create = useCreateEntity('companies');
  const update = useUpdateEntity('companies');
  const isEdit = !!company;

  const [form, setForm] = useState({
    name: company?.name ?? '',
    domain: company?.domain ?? '',
    industry: company?.industry ?? '',
    size: company?.size ?? '',
  });

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isEdit && company) {
      update.mutate({ id: company.id, data: form }, { onSuccess: onClose });
    } else {
      create.mutate(form, { onSuccess: onClose });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Company' : 'Add Company'}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
          <input required value={form.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Domain</label>
          <input value={form.domain} onChange={(e) => handleChange('domain', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" placeholder="example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Industry</label>
          <input value={form.industry} onChange={(e) => handleChange('industry', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Size</label>
          <select value={form.size} onChange={(e) => handleChange('size', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
            <option value="">— Select —</option>
            <option value="1-10">1-10</option>
            <option value="11-50">11-50</option>
            <option value="51-200">51-200</option>
            <option value="201-500">201-500</option>
            <option value="501-1000">501-1000</option>
            <option value="1001+">1001+</option>
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
