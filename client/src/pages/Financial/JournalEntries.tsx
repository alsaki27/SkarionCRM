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
  BookOpen,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface JournalLine {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

export default function JournalEntries(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryReference, setEntryReference] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ]);

  const query = trpc.financial.listJournalEntries.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  const postMutation = trpc.financial.postJournalEntry.useMutation({
    onSuccess: () => {
      addToast('success', 'Journal entry posted');
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const createMutation = trpc.financial.createJournalEntry.useMutation({
    onSuccess: () => {
      addToast('success', 'Journal entry created');
      setModalOpen(false);
      resetForm();
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const deleteMutation = trpc.financial.deleteJournalEntry.useMutation({
    onSuccess: () => {
      addToast('success', 'Journal entry deleted');
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const accountsQuery = trpc.financial.listAccounts.useQuery();

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryDescription('');
    setEntryReference('');
    setLines([{ accountId: '', debit: '', credit: '', description: '' }, { accountId: '', debit: '', credit: '', description: '' }]);
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  const addLine = () => {
    setLines([...lines, { accountId: '', debit: '', credit: '', description: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      addToast('error', 'A journal entry must have at least two lines');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryDescription.trim()) {
      addToast('error', 'Description is required');
      return;
    }
    if (!isBalanced) {
      addToast('error', 'Debits and credits must balance');
      return;
    }
    const validLines = lines
      .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      }));
    if (validLines.length < 2) {
      addToast('error', 'At least two valid lines are required');
      return;
    }
    createMutation.mutate({
      date: entryDate,
      description: entryDescription,
      reference: entryReference,
      lines: validLines,
    });
  };

  const columns = [
    { key: 'entryNumber', header: 'Entry #' },
    { key: 'date', header: 'Date', render: (row: any) => (
      <span className="text-sm text-gray-900">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</span>
    )},
    { key: 'description', header: 'Description' },
    { key: 'totalDebit', header: 'Total Debit', align: 'right' as const, render: (row: any) => (
      <span className="font-mono text-sm">${(row.totalDebit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    )},
    { key: 'totalCredit', header: 'Total Credit', align: 'right' as const, render: (row: any) => (
      <span className="font-mono text-sm">${(row.totalCredit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
    )},
    { key: 'status', header: 'Status', render: (row: any) => (
      <Badge variant={row.status === 'posted' ? 'green' : row.status === 'draft' ? 'yellow' : 'gray'}>
        {row.status}
      </Badge>
    )},
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        {row.status === 'draft' && (
          <button
            onClick={() => postMutation.mutate({ id: row.id })}
            className="rounded-md p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600"
            title="Post"
          >
            <CheckCircle2 size={16} />
          </button>
        )}
        <button
          onClick={() => deleteMutation.mutate({ id: row.id })}
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
          <h1 className="page-title">Journal Entries</h1>
          <p className="page-subtitle">Manage double-entry bookkeeping</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-1" />
          Add Journal Entry
        </Button>
      </div>

      <Card>
        <div className="card-body border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search entries..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="form-input w-40"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
            </select>
          </div>
        </div>

        <div className="card-body p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Failed to load journal entries"
              description="There was an error loading entries."
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
              emptyMessage="No journal entries found"
            />
          )}
        </div>
      </Card>

      {/* Add JE Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Journal Entry"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={handleSubmit} disabled={!isBalanced}>
              Save Entry
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Reference</label>
              <input
                type="text"
                value={entryReference}
                onChange={(e) => setEntryReference(e.target.value)}
                className="form-input"
                placeholder="e.g., JE-001"
              />
            </div>
            <div className="flex items-end">
              <div className={`text-sm font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                Debits: ${totalDebits.toFixed(2)} · Credits: ${totalCredits.toFixed(2)}
              </div>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <input
              type="text"
              value={entryDescription}
              onChange={(e) => setEntryDescription(e.target.value)}
              className="form-input"
              placeholder="Journal entry description"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label">Lines</label>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                <Plus size={14} className="mr-1" />
                Add Line
              </Button>
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Debit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Credit</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select
                          value={line.accountId}
                          onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                          className="form-input text-sm py-1"
                        >
                          <option value="">Select</option>
                          {(accountsQuery.data ?? []).map((acc: any) => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          className="form-input text-sm py-1"
                          placeholder="Line description"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => updateLine(index, 'debit', e.target.value)}
                          className="form-input text-sm py-1 text-right"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => updateLine(index, 'credit', e.target.value)}
                          className="form-input text-sm py-1 text-right"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
