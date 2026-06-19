import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Edit3,
  AlertCircle,
  Clock,
} from 'lucide-react';

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

const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Invoice['status'] | ''>('');
  const [page, setPage] = useState(0);
  const limit = 20;
  const [showAging, setShowAging] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = trpc.invoice.listInvoices.useQuery({
    limit,
    offset: page * limit,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const { data: agingData, isLoading: agingLoading } = trpc.invoice.getAgingReport.useQuery(undefined, {
    enabled: showAging,
  });

  const utils = trpc.useUtils();
  const deleteMutation = trpc.invoice.deleteInvoice.useMutation({
    onSuccess: () => {
      addToast('success', 'Invoice deleted successfully');
      utils.invoice.listInvoices.invalidate();
      setDeleteId(null);
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete invoice');
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) deleteMutation.mutate({ id: deleteId });
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'contact', header: 'Contact', render: (inv: Invoice) => inv.contact?.fullName || '-' },
    { key: 'issueDate', header: 'Issue Date' },
    { key: 'dueDate', header: 'Due Date' },
    {
      key: 'status',
      header: 'Status',
      render: (inv: Invoice) => (
        <Badge className={statusColors[inv.status]}>{statusLabels[inv.status]}</Badge>
      ),
    },
    { key: 'totalAmount', header: 'Total' },
    { key: 'amountPaid', header: 'Amount Paid' },
    { key: 'amountDue', header: 'Amount Due' },
    {
      key: 'actions',
      header: 'Actions',
      render: (inv: Invoice) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowAging(true)}>
            <Clock className="w-4 h-4 mr-2" />
            Aging Report
          </Button>
          <Link to="/invoices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or contact..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              className="pl-10 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as Invoice['status'] | ''); setPage(0); }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.items.length ? (
          <EmptyState icon={<FileText className="w-12 h-12 text-gray-400" />} title="No invoices found" description="Create your first invoice to get started." />
        ) : (
          <>
            <Table
              columns={columns}
              data={data.items}
              onRowClick={(inv: Invoice) => navigate(`/invoices/${inv.id}`)}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-gray-600">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, data.total)} of {data.total}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={showAging} onClose={() => setShowAging(false)} title="Aging Report">
        <div className="space-y-4">
          {agingLoading ? (
            <Loading />
          ) : !agingData ? (
            <EmptyState icon={<AlertCircle className="w-12 h-12 text-gray-400" />} title="No aging data available" />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '0-30 Days', key: 'current' },
                { label: '31-60 Days', key: 'days31_60' },
                { label: '61-90 Days', key: 'days61_90' },
                { label: '90+ Days', key: 'days90Plus' },
              ].map((bucket) => (
                <div key={bucket.key} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">{bucket.label}</div>
                  <div className="text-xl font-bold text-gray-900">
                    {(agingData as any)[bucket.key] || '0.00'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Invoice">
        <div className="space-y-4">
          <p className="text-gray-700">Are you sure you want to delete this invoice? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceList;
