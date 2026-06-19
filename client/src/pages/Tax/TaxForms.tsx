import React, { useState } from 'react';
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
  FileText,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Save,
  Pencil,
} from 'lucide-react';

export default function TaxForms(): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const query = trpc.tax.listTaxForms.useQuery({
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  const updateMutation = trpc.tax.updateTaxForm.useMutation({
    onSuccess: () => {
      addToast('success', 'Tax form updated');
      setEditModalOpen(false);
      setEditForm(null);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const handleEdit = (form: any) => {
    setEditForm(form);
    setEditModalOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    updateMutation.mutate({
      id: editForm.id,
      status: editForm.status,
      amount: parseFloat(editForm.amount) || 0,
      deadline: editForm.deadline,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'filed': return <Badge variant="green">Filed</Badge>;
      case 'draft': return <Badge variant="yellow">Draft</Badge>;
      case 'pending': return <Badge variant="blue">Pending</Badge>;
      case 'overdue': return <Badge variant="red">Overdue</Badge>;
      case 'extension': return <Badge variant="purple">Extension</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const columns = [
    { key: 'formType', header: 'Form Type', render: (row: any) => (
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-gray-400" />
        <span className="font-medium text-gray-900">{row.formType}</span>
      </div>
    )},
    { key: 'name', header: 'Name' },
    { key: 'deadline', header: 'Deadline', render: (row: any) => (
      <span className="text-sm text-gray-700">{row.deadline ? new Date(row.deadline).toLocaleDateString() : '—'}</span>
    )},
    { key: 'status', header: 'Status', render: (row: any) => getStatusBadge(row.status) },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: any) => (
      <span className="font-mono text-sm font-medium text-gray-900">
        ${(row.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    )},
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <button
        onClick={() => handleEdit(row)}
        className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
        title="Edit"
      >
        <Pencil size={16} />
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Tax Forms</h1>
          <p className="page-subtitle">Manage tax filings and forms</p>
        </div>
      </div>

      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search forms..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Types</option>
                <option value="1040">1040</option>
                <option value="1120">1120</option>
                <option value="1120s">1120-S</option>
                <option value="1065">1065</option>
                <option value="941">941</option>
                <option value="940">940</option>
                <option value="w2">W-2</option>
                <option value="1099">1099</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="filed">Filed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Failed to load tax forms"
              description="There was an error loading tax forms."
              actionLabel="Retry"
              onAction={() => query.refetch()}
            />
          ) : (
            <Table
              columns={columns}
              data={query.data?.items ?? []}
              keyExtractor={(row) => row.id}
              pagination
              total={query.data?.total ?? 0}
              page={page}
              pageSize={10}
              onPageChange={setPage}
              emptyMessage="No tax forms found"
            />
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditForm(null); }}
        title="Edit Tax Form"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditModalOpen(false); setEditForm(null); }}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleUpdate}>
              <Save size={16} className="mr-1" />
              Save
            </Button>
          </>
        }
      >
        {editForm && (
          <form className="space-y-4">
            <div>
              <label className="form-label">Form</label>
              <p className="text-sm font-medium text-gray-900">{editForm.formType} - {editForm.name}</p>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="form-input"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="filed">Filed</option>
                <option value="overdue">Overdue</option>
                <option value="extension">Extension</option>
              </select>
            </div>
            <div>
              <label className="form-label">Amount</label>
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Deadline</label>
              <input
                type="date"
                value={editForm.deadline ? new Date(editForm.deadline).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                className="form-input"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
