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
  Shield,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export default function ComplianceItems(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'tax',
    status: 'pending',
    dueDate: '',
    priority: 'medium',
    assignedTo: '',
    description: '',
  });

  const query = trpc.compliance.listItems.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  const createMutation = trpc.compliance.createItem.useMutation({
    onSuccess: () => {
      addToast('success', 'Compliance item created');
      setModalOpen(false);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const updateMutation = trpc.compliance.updateItem.useMutation({
    onSuccess: () => {
      addToast('success', 'Compliance item updated');
      setModalOpen(false);
      setEditItem(null);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const deleteMutation = trpc.compliance.deleteItem.useMutation({
    onSuccess: () => {
      addToast('success', 'Compliance item deleted');
      setDeleteModalOpen(false);
      setItemToDelete(null);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const resetForm = () => {
    setForm({ title: '', category: 'tax', status: 'pending', dueDate: '', priority: 'medium', assignedTo: '', description: '' });
  };

  const openCreate = () => {
    setEditItem(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      title: item.title || '',
      category: item.category || 'tax',
      status: item.status || 'pending',
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
      priority: item.priority || 'medium',
      assignedTo: item.assignedToId || '',
      description: item.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) {
      addToast('error', 'Title and due date are required');
      return;
    }
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (item: any) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete?.id) {
      deleteMutation.mutate({ id: itemToDelete.id });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant': return <Badge variant="green">Compliant</Badge>;
      case 'pending': return <Badge variant="yellow">Pending</Badge>;
      case 'in_progress': return <Badge variant="blue">In Progress</Badge>;
      case 'overdue': return <Badge variant="red">Overdue</Badge>;
      case 'not_applicable': return <Badge variant="gray">N/A</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="red">High</Badge>;
      case 'medium': return <Badge variant="yellow">Medium</Badge>;
      case 'low': return <Badge variant="blue">Low</Badge>;
      default: return <Badge variant="gray">{priority}</Badge>;
    }
  };

  const columns = [
    { key: 'title', header: 'Title', render: (row: any) => (
      <div>
        <p className="font-medium text-gray-900">{row.title}</p>
        <p className="text-xs text-gray-500">{row.description}</p>
      </div>
    )},
    { key: 'category', header: 'Category', render: (row: any) => (
      <Badge variant="gray" className="capitalize">{row.category}</Badge>
    )},
    { key: 'status', header: 'Status', render: (row: any) => getStatusBadge(row.status) },
    { key: 'dueDate', header: 'Due Date', render: (row: any) => (
      <span className="text-sm text-gray-700">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</span>
    )},
    { key: 'priority', header: 'Priority', render: (row: any) => getPriorityBadge(row.priority) },
    { key: 'assignedTo', header: 'Assigned To', render: (row: any) => (
      <span className="text-sm text-gray-700">{row.assignedTo?.fullName || row.assignedTo?.email || '—'}</span>
    )},
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => openEdit(row)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
          title="Edit"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => handleDelete(row)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Compliance Items</h1>
          <p className="page-subtitle">Track and manage compliance requirements</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" />
          Add Item
        </Button>
      </div>

      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search compliance items..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="form-input w-36"
              >
                <option value="all">All Categories</option>
                <option value="tax">Tax</option>
                <option value="labor">Labor</option>
                <option value="privacy">Privacy</option>
                <option value="security">Security</option>
                <option value="environmental">Environmental</option>
                <option value="other">Other</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input w-36"
              >
                <option value="all">All Statuses</option>
                <option value="compliant">Compliant</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                className="form-input w-36"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
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
              title="Failed to load compliance items"
              description="There was an error loading compliance items."
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
              emptyMessage="No compliance items found"
            />
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        title={editItem ? 'Edit Compliance Item' : 'Add Compliance Item'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditItem(null); }}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editItem ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="form-input"
              placeholder="e.g., File Q3 Sales Tax"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="form-input"
              >
                <option value="tax">Tax</option>
                <option value="labor">Labor</option>
                <option value="privacy">Privacy</option>
                <option value="security">Security</option>
                <option value="environmental">Environmental</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="form-input"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="compliant">Compliant</option>
                <option value="overdue">Overdue</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="form-input"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Assigned To</label>
            <input
              type="text"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="form-input"
              placeholder="User ID"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="form-input min-h-[80px]"
              placeholder="Additional details..."
            />
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setItemToDelete(null); }}
        title="Delete Compliance Item"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteModalOpen(false); setItemToDelete(null); }}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Delete <strong>{itemToDelete?.title}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
