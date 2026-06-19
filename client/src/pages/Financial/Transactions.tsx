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
  DollarSign,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Filter,
} from 'lucide-react';

export default function Transactions(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    accountId: '',
    amount: '',
    type: 'income',
    contactId: '',
    reference: '',
  });

  const query = trpc.financial.listTransactions.useQuery({
    search: search || undefined,
    accountId: accountFilter || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 10,
  });

  const accountsQuery = trpc.financial.listAccounts.useQuery();
  const createMutation = trpc.financial.createTransaction.useMutation({
    onSuccess: () => {
      addToast('success', 'Transaction recorded');
      setModalOpen(false);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      accountId: '',
      amount: '',
      type: 'income',
      contactId: '',
      reference: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.accountId || !form.amount) {
      addToast('error', 'Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
    });
  };

  const columns = [
    { key: 'date', header: 'Date', render: (row: any) => (
      <span className="text-sm text-gray-900">
        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
      </span>
    )},
    { key: 'description', header: 'Description' },
    { key: 'account', header: 'Account', render: (row: any) => (
      <span className="text-sm text-gray-700">{row.account?.name || row.accountId}</span>
    )},
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: any) => (
      <span className={`font-mono text-sm font-medium ${row.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
        {row.type === 'income' ? '+' : '-'}${(row.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    )},
    { key: 'type', header: 'Type', render: (row: any) => (
      <Badge variant={row.type === 'income' ? 'green' : 'red'}>
        {row.type}
      </Badge>
    )},
    { key: 'status', header: 'Status', render: (row: any) => (
      <Badge variant={row.status === 'posted' ? 'green' : 'yellow'}>
        {row.status || 'draft'}
      </Badge>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Record and manage financial transactions</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-1" />
          Add Transaction
        </Button>
      </div>

      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={accountFilter}
                onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
                className="form-input w-48"
              >
                <option value="">All Accounts</option>
                {(accountsQuery.data ?? []).map((acc: any) => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="form-input w-32"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="form-input w-40"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="form-input w-40"
                placeholder="To"
              />
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Failed to load transactions"
              description="There was an error loading transactions."
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
              emptyMessage="No transactions found"
            />
          )}
        </div>
      </Card>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Transaction"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleSubmit}>Save</Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="form-input"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="form-input"
              placeholder="e.g., Office supplies"
            />
          </div>
          <div>
            <label className="form-label">Account</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="form-input"
            >
              <option value="">Select account</option>
              {(accountsQuery.data ?? []).map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="form-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="form-label">Reference #</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="form-input"
                placeholder="Invoice #123"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Contact (optional)</label>
            <input
              type="text"
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              className="form-input"
              placeholder="Contact ID"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
