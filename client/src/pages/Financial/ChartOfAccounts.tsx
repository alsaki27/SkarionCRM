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
  Landmark,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  TreePine,
  List,
} from 'lucide-react';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type ViewMode = 'tree' | 'list';

interface AccountFormData {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  description?: string;
  openingBalance?: number;
}

export default function ChartOfAccounts(): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({
    asset: true, liability: true, equity: true, revenue: true, expense: true,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);

  const [formData, setFormData] = useState<AccountFormData>({
    code: '', name: '', type: 'asset', parentId: '', description: '', openingBalance: 0,
  });

  const accountsQuery = trpc.financial.listAccounts.useQuery();
  const createMutation = trpc.financial.createAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Account created');
      setModalOpen(false);
      resetForm();
      accountsQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });
  const updateMutation = trpc.financial.updateAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Account updated');
      setModalOpen(false);
      setEditAccount(null);
      resetForm();
      accountsQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });
  const deleteMutation = trpc.financial.deleteAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Account deleted');
      setDeleteModalOpen(false);
      setAccountToDelete(null);
      accountsQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const resetForm = () => {
    setFormData({ code: '', name: '', type: 'asset', parentId: '', description: '', openingBalance: 0 });
  };

  const openCreate = () => {
    setEditAccount(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (account: any) => {
    setEditAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || '',
      description: account.description || '',
      openingBalance: account.openingBalance || 0,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      addToast('error', 'Code and name are required');
      return;
    }
    if (editAccount) {
      updateMutation.mutate({ id: editAccount.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (account: any) => {
    setAccountToDelete(account);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete?.id) {
      deleteMutation.mutate({ id: accountToDelete.id });
    }
  };

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'asset': return <Badge variant="blue">Asset</Badge>;
      case 'liability': return <Badge variant="red">Liability</Badge>;
      case 'equity': return <Badge variant="purple">Equity</Badge>;
      case 'revenue': return <Badge variant="green">Revenue</Badge>;
      case 'expense': return <Badge variant="orange">Expense</Badge>;
      default: return <Badge variant="gray">{type}</Badge>;
    }
  };

  const allAccounts = accountsQuery.data ?? [];
  const grouped: Record<string, any[]> = {
    asset: [], liability: [], equity: [], revenue: [], expense: [],
  };
  allAccounts.forEach((acc: any) => {
    if (grouped[acc.type]) grouped[acc.type].push(acc);
  });

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (row: any) => getTypeBadge(row.type) },
    { key: 'balance', header: 'Balance', align: 'right' as const, render: (row: any) => (
      <span className="font-mono text-sm">
        ${(row.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    )},
    { key: 'status', header: 'Status', render: (row: any) => (
      <Badge variant={row.active !== false ? 'green' : 'gray'}>
        {row.active !== false ? 'Active' : 'Inactive'}
      </Badge>
    )},
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => openEdit(row)} className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600">
          <Pencil size={16} />
        </button>
        <button onClick={() => handleDelete(row)} className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Manage your accounting structure</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-200 bg-white">
            <button
              onClick={() => setViewMode('list')}
              className={'flex items-center gap-1 px-3 py-1.5 text-sm ' + (viewMode === 'list' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600')}
            >
              <List size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={'flex items-center gap-1 px-3 py-1.5 text-sm ' + (viewMode === 'tree' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600')}
            >
              <TreePine size={16} />
              Tree
            </button>
          </div>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      {accountsQuery.isLoading ? (
        <Loading />
      ) : accountsQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load accounts"
          description="There was an error loading accounts."
          actionLabel="Retry"
          onAction={() => accountsQuery.refetch()}
        />
      ) : viewMode === 'list' ? (
        <Table
          columns={columns}
          data={allAccounts}
          keyExtractor={(row) => row.id}
          sortable
          emptyMessage="No accounts found"
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, accounts]) => (
            <Card key={type}>
              <div className="card-header">
                <button
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 text-base font-semibold text-gray-900 capitalize"
                >
                  {expandedTypes[type] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  {type}s
                  <Badge variant="gray">{accounts.length}</Badge>
                </button>
              </div>
              {expandedTypes[type] && (
                <div className="card-body p-0">
                  <Table
                    columns={columns.filter((c) => c.key !== 'type')}
                    data={accounts}
                    keyExtractor={(row) => row.id}
                    emptyMessage={`No ${type} accounts`}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(null); }}
        title={editAccount ? 'Edit Account' : 'Create Account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditAccount(null); }}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {editAccount ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Account Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="form-input"
                placeholder="1000"
                required
              />
            </div>
            <div>
              <label className="form-label">Account Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                className="form-input"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Account Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="Cash"
              required
            />
          </div>
          <div>
            <label className="form-label">Parent Account (optional)</label>
            <input
              type="text"
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="form-input"
              placeholder="Parent account ID"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-input"
              placeholder="Brief description..."
            />
          </div>
          <div>
            <label className="form-label">Opening Balance</label>
            <input
              type="number"
              step="0.01"
              value={formData.openingBalance}
              onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
              className="form-input"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setAccountToDelete(null); }}
        title="Delete Account"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteModalOpen(false); setAccountToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Delete <strong>{accountToDelete?.name}</strong> ({accountToDelete?.code})? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
