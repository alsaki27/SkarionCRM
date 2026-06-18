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
  Calendar,
  Plus,
  Lock,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function TaxYears(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [deadline, setDeadline] = useState('');

  const query = trpc.tax.listTaxYears.useQuery();
  const createMutation = trpc.tax.createTaxYear.useMutation({
    onSuccess: () => {
      addToast('success', 'Tax year created');
      setModalOpen(false);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });
  const closeMutation = trpc.tax.closeTaxYear.useMutation({
    onSuccess: () => {
      addToast('success', 'Tax year closed');
      query.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!year.trim() || !deadline.trim()) {
      addToast('error', 'Year and deadline are required');
      return;
    }
    createMutation.mutate({ year: parseInt(year), deadline });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="green">Open</Badge>;
      case 'closed': return <Badge variant="gray">Closed</Badge>;
      case 'in_progress': return <Badge variant="blue">In Progress</Badge>;
      case 'extended': return <Badge variant="yellow">Extended</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const columns = [
    { key: 'year', header: 'Year' },
    { key: 'status', header: 'Status', render: (row: any) => getStatusBadge(row.status) },
    { key: 'deadline', header: 'Deadline', render: (row: any) => (
      <span className="text-sm text-gray-700">{row.deadline ? new Date(row.deadline).toLocaleDateString() : '—'}</span>
    )},
    { key: 'extension', header: 'Extension', render: (row: any) => (
      <Badge variant={row.extensionFiled ? 'purple' : 'gray'}>
        {row.extensionFiled ? 'Filed' : 'None'}
      </Badge>
    )},
    { key: 'actions', header: 'Actions', align: 'right' as const, render: (row: any) => (
      <div className="flex items-center justify-end gap-2">
        {row.status === 'open' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => closeMutation.mutate({ id: row.id })}
            loading={closeMutation.isLoading}
          >
            <Lock size={14} className="mr-1" />
            Close Year
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Tax Years</h1>
          <p className="page-subtitle">Manage fiscal and tax year periods</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-1" />
          Add Year
        </Button>
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Failed to load tax years"
          description="There was an error loading tax years."
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      ) : (
        <Table
          columns={columns}
          data={query.data ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage="No tax years found"
        />
      )}

      {/* Add Year Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Tax Year"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={createMutation.isLoading} onClick={handleCreate}>Create</Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="form-label">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="form-input"
              placeholder="2024"
            />
          </div>
          <div>
            <label className="form-label">Filing Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="form-input"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
