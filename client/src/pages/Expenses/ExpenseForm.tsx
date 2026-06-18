import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

interface ExpenseItem {
  id?: string;
  date: string;
  description: string;
  categoryId: string;
  amount: string;
  taxAmount: string;
  vendor: string;
  receiptPath: string;
  isBillable: boolean;
  mileage: string;
  notes: string;
}

interface FormState {
  employeeId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
  items: ExpenseItem[];
}

const emptyItem = (): ExpenseItem => ({
  date: new Date().toISOString().split('T')[0],
  description: '',
  categoryId: '',
  amount: '',
  taxAmount: '',
  vendor: '',
  receiptPath: '',
  isBillable: false,
  mileage: '',
  notes: '',
});

export default function ExpenseForm(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>({
    employeeId: '',
    name: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
    items: [emptyItem()],
  });
  const [formError, setFormError] = useState('');

  const employeesQuery = trpc.employee.listEmployees.useQuery();
  const categoriesQuery = trpc.expense.getExpenseCategories.useQuery();

  const reportQuery = trpc.expense.getExpenseReportById.useQuery(
    { id: id! },
    { enabled: isEdit }
  );

  useEffect(() => {
    if (reportQuery.data) {
      const r = reportQuery.data;
      setForm({
        employeeId: r.employeeId || '',
        name: r.name || '',
        periodStart: r.periodStart ? new Date(r.periodStart).toISOString().split('T')[0] : '',
        periodEnd: r.periodEnd ? new Date(r.periodEnd).toISOString().split('T')[0] : '',
        notes: r.notes || '',
        items: (r.items ?? []).map((item: any) => ({
          id: item.id,
          date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
          description: item.description || '',
          categoryId: item.categoryId || '',
          amount: item.amount != null ? String(item.amount) : '',
          taxAmount: item.taxAmount != null ? String(item.taxAmount) : '',
          vendor: item.vendor || '',
          receiptPath: item.receiptPath || '',
          isBillable: !!item.isBillable,
          mileage: item.mileage != null ? String(item.mileage) : '',
          notes: item.notes || '',
        })),
      });
    }
  }, [reportQuery.data]);

  const createMutation = trpc.expense.createExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report created successfully');
      navigate('/expenses');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create expense report');
    },
  });

  const updateMutation = trpc.expense.updateExpenseReport.useMutation({
    onSuccess: () => {
      addToast('success', 'Expense report updated successfully');
      navigate('/expenses');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to update expense report');
    },
  });

  const totalAmount = React.useMemo(() => {
    return form.items.reduce((sum, item) => {
      const amt = parseFloat(item.amount || '0');
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [form.items]);

  const totalTax = React.useMemo(() => {
    return form.items.reduce((sum, item) => {
      const tax = parseFloat(item.taxAmount || '0');
      return sum + (isNaN(tax) ? 0 : tax);
    }, 0);
  }, [form.items]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof ExpenseItem, value: string | boolean) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      if (items.length === 0) return { ...prev, items: [emptyItem()] };
      return { ...prev, items };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.employeeId || !form.name.trim() || !form.periodStart || !form.periodEnd) {
      setFormError('Employee, Report Name, Period Start, and Period End are required');
      return;
    }

    const validItems = form.items.filter((item) => item.description.trim() && item.amount && parseFloat(item.amount) > 0);
    if (validItems.length === 0) {
      setFormError('At least one expense item with description and amount is required');
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      name: form.name.trim(),
      periodStart: new Date(form.periodStart).toISOString(),
      periodEnd: new Date(form.periodEnd).toISOString(),
      notes: form.notes.trim() || undefined,
      items: validItems.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        description: item.description.trim(),
        categoryId: item.categoryId || undefined,
        amount: parseFloat(item.amount),
        taxAmount: item.taxAmount ? parseFloat(item.taxAmount) : undefined,
        vendor: item.vendor.trim() || undefined,
        receiptPath: item.receiptPath.trim() || undefined,
        isBillable: item.isBillable,
        mileage: item.mileage ? parseFloat(item.mileage) : undefined,
        notes: item.notes.trim() || undefined,
      })),
    };

    if (isEdit) {
      updateMutation.mutate({ id: id!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading =
    (isEdit && reportQuery.isLoading) ||
    createMutation.isLoading ||
    updateMutation.isLoading;

  if (isEdit && reportQuery.isLoading) {
    return <Loading message="Loading expense report..." />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/expenses')}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Expense Report' : 'New Expense Report'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'Update expense report details' : 'Create a new expense report'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header Info */}
        <Card>
          <form onSubmit={handleSubmit} className="card-body space-y-6">
            {formError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="employeeId" className="form-label">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  id="employeeId"
                  value={form.employeeId}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select employee</option>
                  {(employeesQuery.data ?? []).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName || emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="name" className="form-label">
                  Report Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="form-input"
                  placeholder="e.g., June Travel Expenses"
                  required
                />
              </div>

              <div>
                <label htmlFor="periodStart" className="form-label">
                  Period Start <span className="text-red-500">*</span>
                </label>
                <input
                  id="periodStart"
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => handleChange('periodStart', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label htmlFor="periodEnd" className="form-label">
                  Period End <span className="text-red-500">*</span>
                </label>
                <input
                  id="periodEnd"
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => handleChange('periodEnd', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="notes" className="form-label">Notes</label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="form-input min-h-[80px]"
                  placeholder="Optional notes about this report..."
                />
              </div>
            </div>
          </form>
        </Card>

        {/* Expense Items */}
        <Card
          title="Expense Items"
          actions={
            <Button variant="secondary" size="sm" onClick={addItem}>
              <Plus size={16} className="mr-1" />
              Add Item
            </Button>
          }
        >
          <div className="card-body space-y-4">
            {/* Totals */}
            <div className="flex items-center justify-end gap-6 rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Tax</p>
                <p className="font-mono text-sm font-medium text-gray-700">
                  ${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="font-mono text-lg font-semibold text-gray-900">
                  ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Item Rows */}
            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                    <button
                      onClick={() => removeItem(index)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="form-label text-xs">Date</label>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleItemChange(index, 'date', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="form-label text-xs">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="form-input"
                        placeholder="What was this expense for?"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Category</label>
                      <select
                        value={item.categoryId}
                        onChange={(e) => handleItemChange(index, 'categoryId', e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select category</option>
                        {(categoriesQuery.data ?? []).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                        className="form-input"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Tax Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.taxAmount}
                        onChange={(e) => handleItemChange(index, 'taxAmount', e.target.value)}
                        className="form-input"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Vendor</label>
                      <input
                        type="text"
                        value={item.vendor}
                        onChange={(e) => handleItemChange(index, 'vendor', e.target.value)}
                        className="form-input"
                        placeholder="Vendor name"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Receipt Path</label>
                      <input
                        type="text"
                        value={item.receiptPath}
                        onChange={(e) => handleItemChange(index, 'receiptPath', e.target.value)}
                        className="form-input"
                        placeholder="Path to receipt file"
                      />
                    </div>
                    <div className="flex items-end gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.isBillable}
                          onChange={(e) => handleItemChange(index, 'isBillable', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">Billable</span>
                      </label>
                    </div>
                    <div>
                      <label className="form-label text-xs">Mileage (optional)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.mileage}
                        onChange={(e) => handleItemChange(index, 'mileage', e.target.value)}
                        className="form-input"
                        placeholder="Miles"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="form-label text-xs">Item Notes</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                        className="form-input"
                        placeholder="Additional notes for this item..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => navigate('/expenses')}>
            <X size={16} className="mr-1" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isLoading}>
            <Save size={16} className="mr-1" />
            {isEdit ? 'Update Report' : 'Save Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
