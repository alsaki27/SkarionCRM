import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  ArrowLeft,
  Send,
  Edit3,
  Trash2,
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface InvoiceLine {
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

interface Payment {
  id: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string;
  memo: string;
  bankAccountId?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  contactId: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded';
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  taxRate: string;
  terms: string;
  poNumber: string;
  notes: string;
  footer: string;
  contact?: { id: string; fullName: string };
  lines?: InvoiceLine[];
  payments?: Payment[];
}

const statusColors: Record<Invoice['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<Invoice['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  partially_paid: 'Partially Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    memo: '',
    bankAccountId: '',
  });
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const { data: invoice, isLoading } = trpc.invoice.getInvoiceById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const { data: accounts } = trpc.financial.listAccounts.useQuery();
  const utils = trpc.useContext();

  const updateMutation = trpc.invoice.updateInvoice.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Invoice updated successfully' });
      utils.invoice.getInvoiceById.invalidate({ id: id! });
      utils.invoice.listInvoices.invalidate();
    },
    onError: (err) => {
      addToast({ type: 'error', message: err.message || 'Failed to update invoice' });
    },
  });

  const recordPaymentMutation = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Payment recorded successfully' });
      setShowPaymentModal(false);
      setPaymentForm({
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        referenceNumber: '',
        memo: '',
        bankAccountId: '',
      });
      utils.invoice.getInvoiceById.invalidate({ id: id! });
      utils.invoice.listInvoices.invalidate();
    },
    onError: (err) => {
      addToast({ type: 'error', message: err.message || 'Failed to record payment' });
    },
  });

  const deletePaymentMutation = trpc.invoice.deletePayment.useMutation({
    onSuccess: () => {
      addToast({ type: 'success', message: 'Payment deleted successfully' });
      utils.invoice.getInvoiceById.invalidate({ id: id! });
      utils.invoice.listInvoices.invalidate();
      setDeletePaymentId(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err.message || 'Failed to delete payment' });
    },
  });

  const handleSend = () => {
    if (!invoice) return;
    updateMutation.mutate({
      id: invoice.id,
      status: 'sent',
    });
  };

  const handleRecordPayment = () => {
    if (!id || !paymentForm.amount) return;
    recordPaymentMutation.mutate({
      invoiceId: id,
      amount: paymentForm.amount,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      referenceNumber: paymentForm.referenceNumber || undefined,
      memo: paymentForm.memo || undefined,
      bankAccountId: paymentForm.bankAccountId || undefined,
    });
  };

  const inv = invoice as Invoice | undefined;

  const lineColumns = [
    { key: 'description', header: 'Description' },
    { key: 'quantity', header: 'Qty' },
    { key: 'unitPrice', header: 'Unit Price' },
    { key: 'amount', header: 'Amount' },
    { key: 'taxRate', header: 'Tax %' },
    { key: 'taxAmount', header: 'Tax' },
    { key: 'discount', header: 'Discount' },
  ];

  const paymentColumns = [
    { key: 'paymentDate', header: 'Date' },
    { key: 'amount', header: 'Amount' },
    { key: 'paymentMethod', header: 'Method' },
    { key: 'referenceNumber', header: 'Reference' },
    {
      key: 'actions',
      header: 'Actions',
      render: (p: Payment) => (
        <Button variant="ghost" size="sm" onClick={() => setDeletePaymentId(p.id)}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <Loading />;
  if (!inv) return <EmptyState icon={<AlertCircle className="w-12 h-12 text-gray-400" />} title="Invoice not found" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Invoice {inv.invoiceNumber}</h1>
          <Badge className={statusColors[inv.status]}>{statusLabels[inv.status]}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {inv.status === 'draft' && (
            <Button variant="outline" onClick={handleSend} loading={updateMutation.isLoading}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button onClick={() => setShowPaymentModal(true)}>
            <DollarSign className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Contact</div>
            <div className="font-medium text-gray-900">{inv.contact?.fullName || '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Issue Date</div>
            <div className="font-medium text-gray-900">{inv.issueDate}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Due Date</div>
            <div className="font-medium text-gray-900">{inv.dueDate}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">PO Number</div>
            <div className="font-medium text-gray-900">{inv.poNumber || '-'}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invoice Lines</h2>
        </div>
        {inv.lines && inv.lines.length > 0 ? (
          <Table columns={lineColumns} data={inv.lines} />
        ) : (
          <div className="px-6 py-8">
            <EmptyState icon={<FileText className="w-10 h-10 text-gray-400" />} title="No lines" description="This invoice has no line items." />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          </div>
          {inv.payments && inv.payments.length > 0 ? (
            <Table columns={paymentColumns} data={inv.payments} />
          ) : (
            <div className="px-6 py-8">
              <EmptyState icon={<CreditCard className="w-10 h-10 text-gray-400" />} title="No payments" description="No payments have been recorded." />
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{inv.subtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span className="font-medium text-gray-900">{inv.taxAmount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount</span>
              <span className="font-medium text-gray-900">{inv.discountAmount}</span>
            </div>
            <div className="border-t pt-3 flex justify-between text-base">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">{inv.totalAmount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-medium text-green-600">{inv.amountPaid}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Due</span>
              <span className="font-medium text-red-600">{inv.amountDue}</span>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentForm.referenceNumber}
              onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
              placeholder="e.g. REF-12345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Memo</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentForm.memo}
              onChange={(e) => setPaymentForm({ ...paymentForm, memo: e.target.value })}
              placeholder="Optional note"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
            <select
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={paymentForm.bankAccountId}
              onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}
            >
              <option value="">Select account</option>
              {accounts?.map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} loading={recordPaymentMutation.isLoading}>
              <Calendar className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deletePaymentId} onClose={() => setDeletePaymentId(null)} title="Delete Payment">
        <div className="space-y-4">
          <p className="text-gray-700">Are you sure you want to delete this payment? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletePaymentId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deletePaymentId && deletePaymentMutation.mutate({ id: deletePaymentId })} loading={deletePaymentMutation.isLoading}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceDetail;
