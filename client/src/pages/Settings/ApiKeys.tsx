import React, { useState } from 'react';
import { trpc } from '../../api.ts';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Ban,
  Check,
  Eye,
  AlertTriangle,
  X,
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string | null;
  createdAt: string;
}

interface CreateApiKeyForm {
  name: string;
  permissions: string[];
  rateLimit: number;
  expiresAt: string | null;
}

const emptyForm: CreateApiKeyForm = {
  name: '',
  permissions: ['read'],
  rateLimit: 100,
  expiresAt: null,
};

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'admin', label: 'Admin' },
];

export default function ApiKeys(): React.ReactElement {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [form, setForm] = useState<CreateApiKeyForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const query = trpc.apiKey.listApiKeys.useQuery();
  const keys: ApiKeyItem[] = query.data?.keys ?? [];

  const createMutation = trpc.apiKey.createApiKey.useMutation({
    onSuccess: (data) => {
      addToast('success', 'API key created');
      setGeneratedKey(data.key ?? 'sk_live_xxxxxxxxxxxxxxxx');
      setShowCreateModal(false);
      setShowKeyModal(true);
      setForm(emptyForm);
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create API key');
    },
  });

  const revokeMutation = trpc.apiKey.revokeApiKey.useMutation({
    onSuccess: () => {
      addToast('success', 'API key revoked');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to revoke API key');
    },
  });

  const deleteMutation = trpc.apiKey.deleteApiKey.useMutation({
    onSuccess: () => {
      addToast('success', 'API key deleted');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete API key');
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (form.permissions.length === 0) newErrors.permissions = 'At least one permission is required';
    if (form.rateLimit < 1) newErrors.rateLimit = 'Rate limit must be at least 1';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      name: form.name.trim(),
      permissions: form.permissions,
      rateLimit: form.rateLimit,
      expiresAt: form.expiresAt,
    });
  };

  const handleRevoke = (id: string) => {
    if (!confirm('Revoke this API key? It will immediately stop working.')) return;
    revokeMutation.mutate({ id });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this API key permanently? This cannot be undone.')) return;
    deleteMutation.mutate({ id });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    addToast('success', 'API key copied to clipboard');
  };

  const togglePermission = (value: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(value)
        ? prev.permissions.filter((p) => p !== value)
        : [...prev.permissions, value],
    }));
    if (errors.permissions) setErrors((prev) => ({ ...prev, permissions: undefined }));
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
      active: { variant: 'green', label: 'Active' },
      revoked: { variant: 'red', label: 'Revoked' },
      expired: { variant: 'gray', label: 'Expired' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage API keys for programmatic access to your data</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} className="mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Table */}
      <Card>
        {query.isLoading && !keys.length ? (
          <Loading message="Loading API keys..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load API keys</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No API keys"
            description="Create your first API key to start integrating with the Skarion API."
            actionLabel="Create API Key"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <Table<ApiKeyItem>
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div className="font-medium text-gray-900">{row.name}</div>
                ),
              },
              {
                key: 'prefix',
                header: 'Prefix',
                render: (row) => (
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                    {row.prefix}
                  </code>
                ),
              },
              {
                key: 'permissions',
                header: 'Permissions',
                render: (row) => (
                  <div className="flex gap-1">
                    {row.permissions.map((perm) => (
                      <Badge key={perm} variant="blue">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: 'rateLimit',
                header: 'Rate Limit',
                render: (row) => (
                  <span className="text-sm text-gray-600">{row.rateLimit}/min</span>
                ),
              },
              {
                key: 'lastUsed',
                header: 'Last Used',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : 'Never'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'expires',
                header: 'Expires',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {row.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(row.id)}
                        loading={revokeMutation.isLoading && revokeMutation.variables?.id === row.id}
                        title="Revoke"
                      >
                        <Ban size={16} className="text-amber-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      loading={deleteMutation.isLoading && deleteMutation.variables?.id === row.id}
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </Button>
                  </div>
                ),
              },
            ]}
            data={keys}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createMutation.isLoading}>
              <Key size={16} className="mr-2" />
              Create Key
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`form-input ${errors.name ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="Production API Key"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="form-label">Permissions *</label>
            <div className="mt-2 space-y-2">
              {PERMISSION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(option.value)}
                    onChange={() => togglePermission(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.permissions && <p className="mt-1 text-xs text-red-600">{errors.permissions}</p>}
          </div>

          <div>
            <label className="form-label">Rate Limit (requests/min)</label>
            <input
              type="number"
              min={1}
              value={form.rateLimit}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, rateLimit: parseInt(e.target.value, 10) || 0 }));
                if (errors.rateLimit) setErrors((prev) => ({ ...prev, rateLimit: undefined }));
              }}
              className={`form-input ${errors.rateLimit ? 'ring-red-300 focus:ring-red-500' : ''}`}
            />
            {errors.rateLimit && <p className="mt-1 text-xs text-red-600">{errors.rateLimit}</p>}
          </div>

          <div>
            <label className="form-label">Expiration</label>
            <input
              type="date"
              value={form.expiresAt ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, expiresAt: e.target.value || null }))
              }
              className="form-input"
            />
            <p className="mt-1 text-xs text-gray-500">Leave blank for no expiration.</p>
          </div>
        </form>
      </Modal>

      {/* Generated Key Modal */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="Your New API Key"
        size="lg"
        hideCloseButton={false}
        footer={
          <Button onClick={() => setShowKeyModal(false)}>
            <Check size={16} className="mr-2" />
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">You can only see this once!</p>
              <p className="text-sm text-amber-700">
                Copy your API key now. For security reasons, we cannot show it again.
              </p>
            </div>
          </div>

          <div>
            <label className="form-label">API Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <code className="text-sm font-mono text-gray-800">{generatedKey}</code>
              </div>
              <Button variant="secondary" onClick={handleCopyKey} title="Copy">
                <Copy size={16} className="mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
