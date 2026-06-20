import { useState, type FormEvent } from 'react';
import { useCreateEntity, useUpdateEntity, useCompanies, useContacts } from '../../hooks/use-api.js';
import type { Opportunity, OpportunityStage, Currency } from '../../api.js';
import Modal from '../ui/Modal.js';

interface OpportunityFormProps {
  open: boolean;
  onClose: () => void;
  opportunity?: Opportunity | null;
}

const stages: OpportunityStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'AED', 'SAR'];

export default function OpportunityForm({ open, onClose, opportunity }: OpportunityFormProps) {
  const create = useCreateEntity('opportunities');
  const update = useUpdateEntity('opportunities');
  const { data: companiesData } = useCompanies();
  const { data: contactsData } = useContacts();
  const isEdit = !!opportunity;

  const companies = companiesData?.companies.filter((c) => !c.deletedAt) ?? [];
  const contacts = contactsData?.contacts.filter((c) => !c.deletedAt) ?? [];

  const [form, setForm] = useState({
    name: opportunity?.name ?? '',
    companyId: opportunity?.companyId ?? '',
    contactId: opportunity?.contactId ?? '',
    stage: opportunity?.stage ?? 'prospecting',
    amount: opportunity?.amount ?? '',
    currency: opportunity?.currency ?? 'USD',
    expectedCloseDate: opportunity?.expectedCloseDate ?? '',
    probability: opportunity?.probability?.toString() ?? '',
    notes: opportunity?.notes ?? '',
  });

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      companyId: form.companyId || null,
      contactId: form.contactId || null,
      amount: form.amount || null,
      expectedCloseDate: form.expectedCloseDate || null,
      probability: form.probability ? parseInt(form.probability, 10) : null,
      notes: form.notes || null,
    };
    if (isEdit && opportunity) {
      update.mutate({ id: opportunity.id, data }, { onSuccess: onClose });
    } else {
      create.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Opportunity' : 'Add Opportunity'}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
          <input required value={form.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Stage</label>
            <select value={form.stage} onChange={(e) => handleChange('stage', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              {stages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Amount</label>
            <input type="number" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Currency</label>
            <select value={form.currency} onChange={(e) => handleChange('currency', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Expected Close</label>
            <input type="date" value={form.expectedCloseDate} onChange={(e) => handleChange('expectedCloseDate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Probability (%)</label>
            <input type="number" min={0} max={100} value={form.probability} onChange={(e) => handleChange('probability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" placeholder="0-100" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
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
