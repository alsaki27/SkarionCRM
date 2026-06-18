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
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  lastDeliveredAt: string | null;
  lastFailedAt: string | null;
  createdAt: string;
}

interface WebhookEvent {
  id: string;
  endpointId: string;
  eventType: string;
  payload: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus: number | null;
  responseBody: string | null;
  attempts: number;
  createdAt: string;
  deliveredAt: string | null;
}

interface CreateEndpointForm {
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'inactive';
}

const emptyForm: CreateEndpointForm = {
  name: '',
  url: '',
  secret: '',
  events: [],
  status: 'active',
};

const EVENT_OPTIONS = [
  { value: 'invoice.created', label: 'Invoice Created' },
  { value: 'payment.received', label: 'Payment Received' },
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'contact.updated', label: 'Contact Updated' },
  { value: 'invoice.sent', label: 'Invoice Sent' },
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'payment.failed', label: 'Payment Failed' },
  { value: 'recurring.activated', label: 'Recurring Activated' },
];

export default function Webhooks(): React.ReactElement {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEndpointForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const endpointsQuery = trpc.webhook.listEndpoints.useQuery();
  const endpoints: WebhookEndpoint[] = endpointsQuery.data?.endpoints ?? [];

  const eventsQuery = trpc.webhook.listEvents.useQuery(
    selectedEndpointId ? { endpointId: selectedEndpointId } : undefined,
    { enabled: !!selectedEndpointId }
  );
  const events: WebhookEvent[] = eventsQuery.data?.events ?? [];

  const createMutation = trpc.webhook.createEndpoint.useMutation({
    onSuccess: () => {
      addToast('success', 'Webhook endpoint created');
      setShowCreateModal(false);
      setForm(emptyForm);
      endpointsQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create endpoint');
    },
  });

  const deleteMutation = trpc.webhook.deleteEndpoint.useMutation({
    onSuccess: () => {
      addToast('success', 'Endpoint deleted');
      endpointsQuery.refetch();
      if (selectedEndpointId) setSelectedEndpointId(null);
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete endpoint');
    },
  });

  const retryMutation = trpc.webhook.retryEvent.useMutation({
    onSuccess: () => {
      addToast('success', 'Event retry initiated');
      eventsQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to retry event');
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.url.trim()) newErrors.url = 'URL is required';
    else if (!/^https?:\/\/.+/.test(form.url)) newErrors.url = 'Must be a valid URL starting with http:// or https://';
    if (form.events.length === 0) newErrors.events = 'Select at least one event';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      name: form.name.trim(),
      url: form.url.trim(),
      secret: form.secret.trim() || undefined,
      events: form.events,
      status: form.status,
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    deleteMutation.mutate({ id });
  };

  const handleRetry = (eventId: string) => {
    retryMutation.mutate({ eventId });
  };

  const toggleEvent = (value: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(value)
        ? prev.events.filter((e) => e !== value)
        : [...prev.events, value],
    }));
    if (errors.events) setErrors((prev) => ({ ...prev, events: undefined }));
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'gray'; label: string }> = {
      active: { variant: 'green', label: 'Active' },
      inactive: { variant: 'gray', label: 'Inactive' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const selectedEndpoint = endpoints.find((e) => e.id === selectedEndpointId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Webhook Endpoints</h1>
          <p className="page-subtitle">Manage webhook endpoints and monitor event deliveries</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} className="mr-2" />
          Add Endpoint
        </Button>
      </div>

      {/* Endpoints Table */}
      <Card>
        {endpointsQuery.isLoading && !endpoints.length ? (
          <Loading message="Loading endpoints..." />
        ) : endpointsQuery.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load endpoints</p>
            <Button variant="secondary" onClick={() => endpointsQuery.refetch()}>Retry</Button>
          </div>
        ) : endpoints.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhook endpoints"
            description="Add a webhook endpoint to receive real-time event notifications."
            actionLabel="Add Endpoint"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <Table<WebhookEndpoint>
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div>
                    <div className="font-medium text-gray-900">{row.name}</div>
                  </div>
                ),
              },
              {
                key: 'url',
                header: 'URL',
                render: (row) => (
                  <span className="text-sm text-gray-600">{row.url}</span>
                ),
              },
              {
                key: 'events',
                header: 'Events',
                render: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {row.events.slice(0, 3).map((ev) => (
                      <Badge key={ev} variant="blue">{ev}</Badge>
                    ))}
                    {row.events.length > 3 && (
                      <Badge variant="gray">+{row.events.length - 3}</Badge>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'lastDelivered',
                header: 'Last Delivered',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastDeliveredAt ? new Date(row.lastDeliveredAt).toLocaleDateString() : 'Never'}
                  </span>
                ),
              },
              {
                key: 'lastFailed',
                header: 'Last Failed',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastFailedAt ? new Date(row.lastFailedAt).toLocaleDateString() : 'Never'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEndpointId(row.id)}
                      title="View events"
                    >
                      <Webhook size={16} className="text-blue-500" />
                    </Button>
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
            data={endpoints}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Events Tab */}
      {selectedEndpointId && selectedEndpoint && (
        <Card title={`Events: ${selectedEndpoint.name}`}>
          <div className="px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing delivery log for <span className="font-medium text-gray-700">{selectedEndpoint.url}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEndpointId(null)}>
                <X size={16} className="mr-1" />
                Close
              </Button>
            </div>
            {eventsQuery.isLoading ? (
              <Loading message="Loading events..." />
            ) : events.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No events yet"
                description="Events will appear here once they are triggered."
              />
            ) : (
              <Table<WebhookEvent>
                columns={[
                  {
                    key: 'eventType',
                    header: 'Event',
                    render: (row) => (
                      <div className="font-medium text-gray-900">{row.eventType}</div>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => {
                      if (row.status === 'success') {
                        return (
                          <div className="flex items-center gap-1">
                            <CheckCircle size={14} className="text-green-500" />
                            <span className="text-sm text-green-600">Success</span>
                          </div>
                        );
                      }
                      if (row.status === 'failed') {
                        return (
                          <div className="flex items-center gap-1">
                            <XCircle size={14} className="text-red-500" />
                            <span className="text-sm text-red-600">Failed</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1">
                          <Clock size={14} className="text-amber-500" />
                          <span className="text-sm text-amber-600">Pending</span>
                        </div>
                      );
                    },
                  },
                  {
                    key: 'responseStatus',
                    header: 'HTTP Status',
                    render: (row) => (
                      <span className="text-sm text-gray-600">
                        {row.responseStatus ?? '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'attempts',
                    header: 'Attempts',
                    render: (row) => (
                      <span className="text-sm text-gray-600">{row.attempts}</span>
                    ),
                  },
                  {
                    key: 'createdAt',
                    header: 'Triggered',
                    render: (row) => (
                      <span className="text-sm text-gray-500">
                        {new Date(row.createdAt).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row) => (
                      <div className="flex items-center justify-end gap-2">
                        {row.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(row.id)}
                            loading={retryMutation.isLoading && retryMutation.variables?.eventId === row.id}
                            title="Retry"
                          >
                            <RefreshCw size={16} className="text-blue-500" />
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={events}
                keyExtractor={(row) => row.id}
              />
            )}
          </div>
        </Card>
      )}

      {/* Create Endpoint Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Webhook Endpoint"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createMutation.isLoading}>
              <Check size={16} className="mr-2" />
              Add Endpoint
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
              placeholder="Production Webhook"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="form-label">URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, url: e.target.value }));
                if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
              }}
              className={`form-input ${errors.url ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="https://api.example.com/webhooks/skarion"
            />
            {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}
          </div>

          <div>
            <label className="form-label">Secret (optional)</label>
            <input
              type="text"
              value={form.secret}
              onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
              className="form-input"
              placeholder="whsec_xxxxxxxxxxxxxxxx"
            />
            <p className="mt-1 text-xs text-gray-500">Used to verify webhook signatures.</p>
          </div>

          <div>
            <label className="form-label">Events *</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EVENT_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.events.includes(option.value)}
                    onChange={() => toggleEvent(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.events && <p className="mt-1 text-xs text-red-600">{errors.events}</p>}
          </div>

          <div>
            <label className="form-label">Status</label>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, status: 'active' }))}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  form.status === 'active'
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CheckCircle size={16} />
                Active
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, status: 'inactive' }))}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  form.status === 'inactive'
                    ? 'border-gray-300 bg-gray-100 text-gray-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <XCircle size={16} />
                Inactive
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
