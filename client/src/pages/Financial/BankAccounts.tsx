import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowRightLeft,
  RefreshCw,
} from 'lucide-react';

export default function BankAccounts(): React.ReactElement {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'checking',
    currency: 'USD',
    openingBalance: '',
  });

  const query = trpc.financial.listBankAccounts.useQuery();
  const createMutation = trpc.financial.createBankAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Bank account created');
      setModalOpen(false);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });
  const updateMutation = trpc.financial.updateBankAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Bank account updated');
      setModalOpen(false);
      setEditAccount(null);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });
  const deleteMutation = trpc.financial.deleteBankAccount.useMutation({
    onSuccess: () => {
      addToast('success', 'Bank account deleted');
      setDeleteModalOpen(false);
      setAccountToDelete(null);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const resetForm = () => {
    setForm({ name: '', bankName: '', accountNumber: '', routingNumber: '', accountType: 'checking', currency: 'USD', openingBalance: '' });
  };

  const openCreate = () => {
    setEditAccount(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (acc: any) => {
    setEditAccount(acc);
    setForm({
      name: acc.name || '',
      bankName: acc.bankName || '',
      accountNumber: acc.accountNumber || '',
      routingNumber: acc.routingNumber || '',
      accountType: acc.accountType || 'checking',
      currency: acc.currency || 'USD',
      openingBalance: acc.openingBalance?.toString() || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bankName.trim()) {
      addToast('error', 'Name and bank name are required');
      return;
    }
    const payload = {
      ...form,
      openingBalance: parseFloat(form.openingBalance) || 0,
    };
    if (editAccount) {
      updateMutation.mutate({ id: editAccount.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (acc: any) => {
    setAccountToDelete(acc);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete?.id) {
      deleteMutation.mutate({ id: accountToDelete.id });
    }
  };

  const columns = [
    { key: 'name', header: 'Account Name' },
    { key: 'bankName', header: 'Bank' },
    { key: 'accountNumber', header: 'Account #', render: (row: any) => (
      <span className="font-mono text-sm">{row.accountNumber ? '****' + row.accountNumber.slice(-4) : '—'}</span>
    )},
    { key: 'balance', header: 'Balance', align: 'right' as const, render: (row: any) => (
      <span className="font-mono text-sm font-medium text-gray-900">
        ${(row.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    )},
    { key: 'lastReconciled', header: 'Last Reconciled', render: (row: any) => (
      <span className="text-sm text-gray-700">
        {row.lastReconciled ? new Date(row.lastReconciled).toLocaleDateString() : 'Never'}
      </span>
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
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">Manage connected bank accounts and balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/financial/reconciliation')}>
            <ArrowRightLeft size={16} className="mr-1" />
            Reconcile
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load bank accounts"
          description="There was an error loading bank accounts."
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      ) : (
        <Table
          columns={columns}
          data={query.data ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage="No bank accounts found"
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(null); }}
        title={editAccount ? 'Edit Bank Account' : 'Add Bank Account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditAccount(null); }}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editAccount ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Account Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="form-input"
                placeholder="Primary Checking"
              />
            </div>
            <div>
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="form-input"
                placeholder="Chase Bank"
              />
            </div>
            <div>
              <label className="form-label">Account Type</label>
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                className="form-input"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
                <option value="loan">Loan</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="form-input"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            <div>
              <label className="form-label">Account Number</label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                className="form-input"
                placeholder="Last 4 digits shown"
              />
            </div>
            <div>
              <label className="form-label">Routing Number</label>
              <input
                type="text"
                value={form.routingNumber}
                onChange={(e) => setForm({ ...form, routingNumber: e.target.value })}
                className="form-input"
                placeholder="9 digits"
              />
            </div>
            <div>
              <label className="form-label">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                className="form-input"
                placeholder="0.00"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setAccountToDelete(null); }}
        title="Delete Bank Account"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteModalOpen(false); setAccountToDelete(null); }}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Delete <strong>{accountToDelete?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
