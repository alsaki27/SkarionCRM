import React, { useState } from 'react';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import { Bot, Plus, Trash2, PlayCircle, Pencil } from 'lucide-react';

interface AiKeyRow {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
  keyFingerprint: string;
  priority: number;
  isEnabled: boolean;
  status: 'unknown' | 'working' | 'failing' | 'disabled';
  lastTestedAt: string | null;
  lastError: string | null;
  usageCount: number;
  failureCount: number;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'kimi', label: 'Kimi / Moonshot' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const emptyForm = { provider: 'openai', label: '', apiKey: '', baseUrl: '', priority: 100, isEnabled: true };

export default function AiProviders(): React.ReactElement {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ label: '', priority: 100, isEnabled: true, replaceKey: false, apiKey: '' });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const query = trpc.aiKeys.list.useQuery();
  const keys: AiKeyRow[] = (query.data as AiKeyRow[]) ?? [];

  const createMutation = trpc.aiKeys.create.useMutation({
    onSuccess: () => {
      addToast('success', 'AI provider key added');
      setShowAddModal(false);
      setForm(emptyForm);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message || 'Failed to add key'),
  });

  const updateMutation = trpc.aiKeys.update.useMutation({
    onSuccess: () => {
      addToast('success', 'AI provider key updated');
      setEditingId(null);
      query.refetch();
    },
    onError: (err) => addToast('error', err.message || 'Failed to update key'),
  });

  const disableMutation = trpc.aiKeys.disable.useMutation({
    onSuccess: () => {
      addToast('success', 'AI provider key disabled');
      query.refetch();
    },
    onError: (err) => addToast('error', err.message || 'Failed to disable key'),
  });

  const testMutation = trpc.aiKeys.test.useMutation({
    onSuccess: (data, variables) => {
      if (data.success) addToast('success', `Test passed in ${data.latencyMs}ms`);
      else addToast('error', `Test failed: ${data.error ?? 'Unknown error'}`);
      query.refetch();
      void variables;
    },
    onError: (err) => addToast('error', err.message || 'Test failed'),
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.label.trim()) newErrors.label = 'Label is required';
    if (!form.apiKey.trim()) newErrors.apiKey = 'API key is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      provider: form.provider as 'openai' | 'kimi' | 'ollama' | 'openrouter' | 'deepseek',
      label: form.label.trim(),
      apiKey: form.apiKey.trim(),
      baseUrl: form.baseUrl.trim() || undefined,
      priority: form.priority,
      isEnabled: form.isEnabled,
    });
  };

  const startEdit = (key: AiKeyRow) => {
    setEditingId(key.id);
    setEditForm({ label: key.label, priority: key.priority, isEnabled: key.isEnabled, replaceKey: false, apiKey: '' });
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({
      id,
      label: editForm.label,
      priority: editForm.priority,
      isEnabled: editForm.isEnabled,
      ...(editForm.replaceKey && editForm.apiKey ? { apiKey: editForm.apiKey } : {}),
    });
  };

  const handleDisable = (id: string) => {
    if (!confirm('Disable this AI provider key? It will stop being used immediately and can be re-enabled later.')) return;
    disableMutation.mutate({ id });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
      working: { variant: 'green', label: 'Working' },
      failing: { variant: 'red', label: 'Failing' },
      unknown: { variant: 'gray', label: 'Unknown' },
      disabled: { variant: 'gray', label: 'Disabled' },
    };
    const config = map[status] || map.unknown;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">AI Providers</h1>
          <p className="page-subtitle">
            Manage API keys used by the AI assistant and document analysis features. Env-configured keys
            (OPENAI_API_KEY, KIMI_API_KEY, OLLAMA_URL) are tried first; these DB-managed keys are the fallback.
            Keys are encrypted and never shown again after saving.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="mr-2" />
          Add Key
        </Button>
      </div>

      <Card>
        {query.isLoading && !keys.length ? (
          <Loading message="Loading AI provider keys..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load AI provider keys</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No DB-managed AI keys yet"
            description="Add a key to enable AI features as a fallback when no environment-configured provider is set."
            actionLabel="Add Key"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <Table<AiKeyRow>
            columns={[
              {
                key: 'provider',
                header: 'Provider',
                render: (row) => <Badge variant="blue">{row.provider}</Badge>,
              },
              {
                key: 'label',
                header: 'Label',
                render: (row) =>
                  editingId === row.id ? (
                    <input
                      value={editForm.label}
                      onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                      className="form-input"
                      style={{ width: 140 }}
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{row.label}</span>
                  ),
              },
              {
                key: 'fingerprint',
                header: 'Fingerprint',
                render: (row) => (
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                    {row.keyFingerprint}
                  </code>
                ),
              },
              {
                key: 'priority',
                header: 'Priority',
                render: (row) =>
                  editingId === row.id ? (
                    <input
                      type="number"
                      value={editForm.priority}
                      onChange={(e) => setEditForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 100 }))}
                      className="form-input"
                      style={{ width: 70 }}
                    />
                  ) : (
                    <span className="text-sm text-gray-600">{row.priority}</span>
                  ),
              },
              {
                key: 'enabled',
                header: 'Enabled',
                render: (row) =>
                  editingId === row.id ? (
                    <input
                      type="checkbox"
                      checked={editForm.isEnabled}
                      onChange={(e) => setEditForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                    />
                  ) : (
                    <span className="text-sm text-gray-600">{row.isEnabled ? 'Yes' : 'No'}</span>
                  ),
              },
              { key: 'status', header: 'Status', render: (row) => statusBadge(row.status) },
              {
                key: 'lastTested',
                header: 'Last Tested',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastTestedAt ? new Date(row.lastTestedAt).toLocaleString() : 'Never'}
                  </span>
                ),
              },
              {
                key: 'usage',
                header: 'Usage / Failures',
                render: (row) => (
                  <span className="text-sm text-gray-500">{row.usageCount} / {row.failureCount}</span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) =>
                  editingId === row.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={editForm.replaceKey}
                          onChange={(e) => setEditForm((p) => ({ ...p, replaceKey: e.target.checked }))}
                        />
                        Replace key
                      </label>
                      {editForm.replaceKey && (
                        <input
                          type="password"
                          placeholder="New API key"
                          value={editForm.apiKey}
                          onChange={(e) => setEditForm((p) => ({ ...p, apiKey: e.target.value }))}
                          className="form-input"
                          style={{ width: 160 }}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(row.id)} loading={updateMutation.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testMutation.mutate({ id: row.id })}
                          loading={testMutation.isPending && testMutation.variables?.id === row.id}
                          title="Test"
                        >
                          <PlayCircle size={16} className="text-primary-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(row)} title="Edit">
                          <Pencil size={16} className="text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisable(row.id)}
                          loading={disableMutation.isPending && disableMutation.variables?.id === row.id}
                          title="Disable"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                      {row.lastError && (
                        <p className="text-xs text-red-600 max-w-xs text-right">{row.lastError}</p>
                      )}
                    </div>
                  ),
              },
            ]}
            data={keys}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add AI Provider Key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              <Bot size={16} className="mr-2" />
              Save Key
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
              className="form-input"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Label *</label>
            <input
              value={form.label}
              onChange={(e) => {
                setForm((p) => ({ ...p, label: e.target.value }));
                if (errors.label) setErrors((p) => ({ ...p, label: undefined }));
              }}
              className={`form-input ${errors.label ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="e.g. Kimi backup key"
            />
            {errors.label && <p className="mt-1 text-xs text-red-600">{errors.label}</p>}
          </div>
          <div>
            <label className="form-label">API Key *</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => {
                setForm((p) => ({ ...p, apiKey: e.target.value }));
                if (errors.apiKey) setErrors((p) => ({ ...p, apiKey: undefined }));
              }}
              className={`form-input ${errors.apiKey ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="sk-..."
            />
            {errors.apiKey && <p className="mt-1 text-xs text-red-600">{errors.apiKey}</p>}
          </div>
          <div>
            <label className="form-label">Custom Base URL (optional)</label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
              className="form-input"
              placeholder="Leave blank to use the provider's default"
            />
          </div>
          <div>
            <label className="form-label">Priority</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 100 }))}
              className="form-input"
            />
            <p className="mt-1 text-xs text-gray-500">Lower number = tried first among DB-managed keys.</p>
          </div>
          <p className="text-xs text-gray-500">
            The full key is only visible while typing. After saving, it is encrypted and cannot be viewed again.
          </p>
        </form>
      </Modal>
    </div>
  );
}
