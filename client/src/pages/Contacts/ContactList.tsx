import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
} from 'lucide-react';

type ContactType = 'all' | 'client' | 'vendor' | 'employee' | 'lead' | 'other';
type ContactStatus = 'all' | 'active' | 'inactive' | 'prospect';

export default function ContactList(): React.ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType>('all');
  const [statusFilter, setStatusFilter] = useState<ContactStatus>('all');
  const [page, setPage] = useState(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);

  const query = trpc.contact.list.useQuery({
    search: search || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    pageSize: 10,
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      addToast('success', 'Contact deleted successfully');
      setDeleteModalOpen(false);
      setContactToDelete(null);
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete contact');
    },
  });

  const handleDelete = (contact: any) => {
    setContactToDelete(contact);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (contactToDelete?.id) {
      deleteMutation.mutate({ id: contactToDelete.id });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="green">Active</Badge>;
      case 'inactive': return <Badge variant="gray">Inactive</Badge>;
      case 'prospect': return <Badge variant="blue">Prospect</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'client': return <Badge variant="blue">Client</Badge>;
      case 'vendor': return <Badge variant="purple">Vendor</Badge>;
      case 'employee': return <Badge variant="orange">Employee</Badge>;
      case 'lead': return <Badge variant="yellow">Lead</Badge>;
      default: return <Badge variant="gray">{type}</Badge>;
    }
  };

  const columns = [
    { key: 'fullName', header: 'Name', render: (row: any) => (
      <div>
        <p className="font-medium text-gray-900">{row.fullName}</p>
        <p className="text-xs text-gray-500">{row.email}</p>
      </div>
    )},
    { key: 'type', header: 'Type', render: (row: any) => getTypeBadge(row.type) },
    { key: 'companyName', header: 'Company' },
    { key: 'status', header: 'Status', render: (row: any) => getStatusBadge(row.status) },
    { key: 'phone', header: 'Phone' },
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => navigate(`/contacts/${row.id}`)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="View"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => navigate(`/contacts/${row.id}/edit`)}
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
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage clients, vendors, and employees</p>
        </div>
        <Button onClick={() => navigate('/contacts/new')}>
          <Plus size={16} className="mr-1" />
          Add Contact
        </Button>
      </div>

      <Card>
        {/* Filters */}
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as ContactType); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Types</option>
                <option value="client">Client</option>
                <option value="vendor">Vendor</option>
                <option value="employee">Employee</option>
                <option value="lead">Lead</option>
                <option value="other">Other</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ContactStatus); setPage(1); }}
                className="form-input w-40"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card-body p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.isError ? (
            <div className="py-12">
              <EmptyState
                icon={AlertCircle}
                title="Failed to load contacts"
                description="There was an error loading your contacts."
                actionLabel="Retry"
                onAction={() => query.refetch()}
              />
            </div>
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
              emptyMessage="No contacts found"
            />
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setContactToDelete(null); }}
        title="Delete Contact"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setDeleteModalOpen(false); setContactToDelete(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to delete <strong>{contactToDelete?.fullName}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
