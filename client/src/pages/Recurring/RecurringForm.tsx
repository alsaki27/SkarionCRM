import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import { ArrowLeft, Save, X } from 'lucide-react';

type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'adjustment' | 'journal_entry';
type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannually' | 'annually';
type DebitCredit = 'debit' | 'credit';

interface FormState {
  name: string;
  description: string;
  accountId: string;
  contactId: string;
  transactionType: TransactionType;
  amount: string;
  debitCredit: DebitCredit;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  dayOfMonth: string;
  autoPost: boolean;
  maxRuns: string;
}

export default function RecurringForm(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    accountId: '',
    contactId: '',
    transactionType: 'deposit',
    amount: '',
    debitCredit: 'debit',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    dayOfMonth: '',
    autoPost: false,
    maxRuns: '',
  });
  const [formError, setFormError] = useState('');

  const accountsQuery = trpc.financial.listAccounts.useQuery();
  const contactsQuery = trpc.contact.listContacts.useQuery();

  const recurringQuery = trpc.recurring.getRecurringById.useQuery(
    { id: id! },
    { enabled: isEdit }
  );

  useEffect(() => {
    if (recurringQuery.data) {
      const r = recurringQuery.data;
      setForm({
        name: r.name || '',
        description: r.description || '',
        accountId: r.accountId || '',
        contactId: r.contactId || '',
        transactionType: r.transactionType || 'deposit',
        amount: r.amount != null ? String(r.amount) : '',
        debitCredit: r.debitCredit || 'debit',
        frequency: r.frequency || 'monthly',
        startDate: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : '',
        endDate: r.endDate ? new Date(r.endDate).toISOString().split('T')[0] : '',
        dayOfMonth: r.dayOfMonth != null ? String(r.dayOfMonth) : '',
        autoPost: !!r.autoPost,
        maxRuns: r.maxRuns != null ? String(r.maxRuns) : '',
      });
    }
  }, [recurringQuery.data]);

  const createMutation = trpc.recurring.createRecurring.useMutation({
    onSuccess: () => {
      addToast('success', 'Recurring transaction created successfully');
      navigate('/recurring');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create recurring transaction');
    },
  });

  const updateMutation = trpc.recurring.updateRecurring.useMutation({
    onSuccess: () => {
      addToast('success', 'Recurring transaction updated successfully');
      navigate('/recurring');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to update recurring transaction');
    },
  });

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim() || !form.accountId || !form.amount || !form.startDate) {
      setFormError('Name, Account, Amount, and Start Date are required');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      accountId: form.accountId,
      contactId: form.contactId || undefined,
      transactionType: form.transactionType,
      amount: parseFloat(form.amount),
      debitCredit: form.debitCredit,
      frequency: form.frequency,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth, 10) : undefined,
      autoPost: form.autoPost,
      maxRuns: form.maxRuns ? parseInt(form.maxRuns, 10) : undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: id!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading =
    (isEdit && recurringQuery.isLoading) ||
    createMutation.isLoading ||
    updateMutation.isLoading;

  if (isEdit && recurringQuery.isLoading) {
    return <Loading message="Loading recurring transaction..." />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/recurring')}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Recurring Transaction' : 'New Recurring Transaction'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'Update recurring transaction details' : 'Set up a new automated recurring transaction'}
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="card-body space-y-6">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="form-label">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., Monthly Rent Payment"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="form-input min-h-[80px]"
                placeholder="Optional description..."
              />
            </div>

            <div>
              <label htmlFor="accountId" className="form-label">
                Account <span className="text-red-500">*</span>
              </label>
              <select
                id="accountId"
                value={form.accountId}
                onChange={(e) => handleChange('accountId', e.target.value)}
                className="form-input"
                required
              >
                <option value="">Select account</option>
                {(accountsQuery.data ?? []).map((acc: any) => (
                  <option key={acc.id} value={acc.id}>{acc.code ? `${acc.code} - ` : ''}{acc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contactId" className="form-label">Contact (optional)</label>
              <select
                id="contactId"
                value={form.contactId}
                onChange={(e) => handleChange('contactId', e.target.value)}
                className="form-input"
              >
                <option value="">No contact</option>
                {(contactsQuery.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.fullName || c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="transactionType" className="form-label">Transaction Type</label>
              <select
                id="transactionType"
                value={form.transactionType}
                onChange={(e) => handleChange('transactionType', e.target.value as TransactionType)}
                className="form-input"
              >
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="transfer">Transfer</option>
                <option value="adjustment">Adjustment</option>
                <option value="journal_entry">Journal Entry</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="form-label">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="form-input"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label htmlFor="debitCredit" className="form-label">Debit / Credit</label>
              <select
                id="debitCredit"
                value={form.debitCredit}
                onChange={(e) => handleChange('debitCredit', e.target.value as DebitCredit)}
                className="form-input"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            <div>
              <label htmlFor="frequency" className="form-label">Frequency</label>
              <select
                id="frequency"
                value={form.frequency}
                onChange={(e) => handleChange('frequency', e.target.value as Frequency)}
                className="form-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semiannually">Semiannually</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            <div>
              <label htmlFor="startDate" className="form-label">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div>
              <label htmlFor="endDate" className="form-label">End Date (optional)</label>
              <input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label htmlFor="dayOfMonth" className="form-label">Day of Month (optional)</label>
              <input
                id="dayOfMonth"
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(e) => handleChange('dayOfMonth', e.target.value)}
                className="form-input"
                placeholder="e.g., 15"
              />
            </div>

            <div>
              <label htmlFor="maxRuns" className="form-label">Max Runs (optional)</label>
              <input
                id="maxRuns"
                type="number"
                min={1}
                value={form.maxRuns}
                onChange={(e) => handleChange('maxRuns', e.target.value)}
                className="form-input"
                placeholder="Unlimited"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoPost}
                  onChange={(e) => handleChange('autoPost', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Auto-post transactions when generated</span>
              </label>
            </div>
          </div>
        </form>

        <div className="card-footer flex justify-between">
          <Button variant="secondary" onClick={() => navigate('/recurring')}>
            <X size={16} className="mr-1" />
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} loading={isLoading}>
            <Save size={16} className="mr-1" />
            {isEdit ? 'Update Recurring' : 'Save Recurring'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
