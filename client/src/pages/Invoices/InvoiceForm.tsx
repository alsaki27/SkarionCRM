import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Calculator,
} from 'lucide-react';

interface InvoiceLineForm {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  discount: string;
  accountId: string;
}

interface InvoiceFormData {
  invoiceNumber: string;
  contactId: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  poNumber: string;
  notes: string;
  footer: string;
  taxRate: string;
  lines: InvoiceLineForm[];
}

const emptyLine = (): InvoiceLineForm => ({
  description: '',
  quantity: 1,
  unitPrice: '',
  amount: '0.00',
  taxRate: '0',
  taxAmount: '0.00',
  discount: '0.00',
  accountId: '',
});

const emptyForm = (): InvoiceFormData => ({
  invoiceNumber: '',
  contactId: '',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  terms: '',
  poNumber: '',
  notes: '',
  footer: '',
  taxRate: '0',
  lines: [emptyLine()],
});

const calcLineAmount = (qty: number, unitPrice: string): string => {
  const up = parseFloat(unitPrice || '0');
  return (qty * up).toFixed(2);
};

const calcLineTax = (amount: string, taxRate: string): string => {
  const amt = parseFloat(amount || '0');
  const tr = parseFloat(taxRate || '0');
  return ((amt * tr) / 100).toFixed(2);
};

const InvoiceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<InvoiceFormData>(emptyForm());

  const { data: contacts } = trpc.contact.listContacts.useQuery();
  const { data: accounts } = trpc.financial.listAccounts.useQuery();
  const { data: existingInvoice, isLoading: loadingInvoice } = trpc.invoice.getInvoiceById.useQuery(
    { id: id! },
    { enabled: isEdit }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.invoice.createInvoice.useMutation({
    onSuccess: () => {
      addToast('success', 'Invoice created successfully');
      utils.invoice.listInvoices.invalidate();
      navigate('/invoices');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create invoice');
    },
  });

  const updateMutation = trpc.invoice.updateInvoice.useMutation({
    onSuccess: () => {
      addToast('success', 'Invoice updated successfully');
      utils.invoice.listInvoices.invalidate();
      utils.invoice.getInvoiceById.invalidate({ id: id! });
      navigate('/invoices');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update invoice');
    },
  });

  useEffect(() => {
    if (isEdit && existingInvoice) {
      const inv = existingInvoice as any;
      setForm({
        invoiceNumber: inv.invoiceNumber || '',
        contactId: inv.contactId || '',
        issueDate: inv.issueDate || '',
        dueDate: inv.dueDate || '',
        terms: inv.terms || '',
        poNumber: inv.poNumber || '',
        notes: inv.notes || '',
        footer: inv.footer || '',
        taxRate: inv.taxRate || '0',
        lines: (inv.lines || []).map((l: any) => ({
          id: l.id,
          description: l.description || '',
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || '',
          amount: l.amount || calcLineAmount(l.quantity || 1, l.unitPrice || '0'),
          taxRate: l.taxRate || '0',
          taxAmount: l.taxAmount || calcLineTax(l.amount || '0', l.taxRate || '0'),
          discount: l.discount || '0.00',
          accountId: l.accountId || '',
        })),
      });
    }
  }, [isEdit, existingInvoice]);

  const updateLine = (index: number, updates: Partial<InvoiceLineForm>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const line = { ...lines[index], ...updates };
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        line.amount = calcLineAmount(line.quantity, line.unitPrice);
      }
      if (updates.amount !== undefined || updates.taxRate !== undefined) {
        line.taxAmount = calcLineTax(line.amount, line.taxRate);
      }
      lines[index] = line;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      const lines = prev.lines.filter((_, i) => i !== index);
      return { ...prev, lines };
    });
  };

  const subtotal = form.lines.reduce((sum, line) => sum + parseFloat(line.amount || '0'), 0);
  const totalTax = form.lines.reduce((sum, line) => sum + parseFloat(line.taxAmount || '0'), 0);
  const totalDiscount = form.lines.reduce((sum, line) => sum + parseFloat(line.discount || '0'), 0);
  const total = subtotal + totalTax - totalDiscount;

  const handleSubmit = () => {
    const payload = {
      ...form,
      subtotal: subtotal.toFixed(2),
      taxAmount: totalTax.toFixed(2),
      discountAmount: totalDiscount.toFixed(2),
      totalAmount: total.toFixed(2),
    };
    if (isEdit) {
      updateMutation.mutate({ id: id!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && loadingInvoice) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Invoice' : 'New Invoice'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Invoice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="INV-0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <select
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            >
              <option value="">Select contact</option>
              {contacts?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.fullName || c.name || c.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="e.g. Net 30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.poNumber}
              onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
              placeholder="Purchase order number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
              placeholder="Footer text to appear on invoice"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invoice Lines</h2>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="w-4 h-4 mr-2" />
            Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">Unit Price</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Tax %</th>
                <th className="py-2 pr-4">Tax Amt</th>
                <th className="py-2 pr-4">Discount</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Item description"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="1"
                      className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: parseInt(e.target.value || '1', 10) })}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      className="w-28 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      readOnly
                      className="w-28 px-2 py-1 border rounded bg-gray-50 text-gray-700"
                      value={line.amount}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.taxRate}
                      onChange={(e) => updateLine(index, { taxRate: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      readOnly
                      className="w-24 px-2 py-1 border rounded bg-gray-50 text-gray-700"
                      value={line.taxAmount}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.discount}
                      onChange={(e) => updateLine(index, { discount: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      className="w-40 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={line.accountId}
                      onChange={(e) => updateLine(index, { accountId: e.target.value })}
                    >
                      <option value="">Select account</option>
                      {accounts?.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)} disabled={form.lines.length <= 1}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Totals</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Subtotal</div>
            <div className="text-lg font-bold text-gray-900">{subtotal.toFixed(2)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Tax</div>
            <div className="text-lg font-bold text-gray-900">{totalTax.toFixed(2)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Discount</div>
            <div className="text-lg font-bold text-gray-900">{totalDiscount.toFixed(2)}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600">Total</div>
            <div className="text-lg font-bold text-blue-900">{total.toFixed(2)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InvoiceForm;
