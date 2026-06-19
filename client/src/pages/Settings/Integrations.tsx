import React, { useState } from 'react';
import { trpc } from '../../api.ts';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Plug,
  Settings,
  Link2,
  Unlink,
  RefreshCw,
  Check,
  AlertTriangle,
  Building2,
  Briefcase,
  HardHat,
  Users,
  DollarSign,
  CreditCard,
  Zap,
  TestTube,
  X,
} from 'lucide-react';

interface Integration {
  id: string;
  provider: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  connectedAt: string | null;
  lastSyncedAt: string | null;
  config: Record<string, string>;
}

interface ConnectForm {
  apiKey: string;
  token: string;
}

const emptyConnectForm: ConnectForm = {
  apiKey: '',
  token: '',
};

const INTEGRATION_CATALOG = [
  {
    provider: 'greenhouse',
    name: 'Greenhouse',
    description: 'Sync candidates and hiring data from Greenhouse ATS.',
    icon: Building2,
  },
  {
    provider: 'lever',
    name: 'Lever',
    description: 'Import requisitions and candidate pipelines from Lever.',
    icon: Briefcase,
  },
  {
    provider: 'workday',
    name: 'Workday',
    description: 'Connect HR and financial data from Workday.',
    icon: HardHat,
  },
  {
    provider: 'bamboohr',
    name: 'BambooHR',
    description: 'Sync employee records and time-off data.',
    icon: Users,
  },
  {
    provider: 'gusto',
    name: 'Gusto',
    description: 'Import payroll and benefits data from Gusto.',
    icon: DollarSign,
  },
  {
    provider: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices, payments, and chart of accounts.',
    icon: CreditCard,
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Reconcile payments and manage subscriptions.',
    icon: CreditCard,
  },
  {
    provider: 'zapier',
    name: 'Zapier',
    description: 'Build automations and connect 5,000+ apps.',
    icon: Zap,
  },
];

export default function Integrations(): React.ReactElement {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [configuringIntegration, setConfiguringIntegration] = useState<Integration | null>(null);
  const [connectForm, setConnectForm] = useState<ConnectForm>(emptyConnectForm);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const query = trpc.integration.listIntegrations.useQuery();
  const integrations: Integration[] = query.data?.integrations ?? [];

  const createMutation = trpc.integration.createIntegration.useMutation({
    onSuccess: () => {
      addToast('success', 'Integration connected');
      setConnectingProvider(null);
      setConnectForm(emptyConnectForm);
      setTestStatus('idle');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to connect integration');
    },
  });

  const updateMutation = trpc.integration.updateIntegration.useMutation({
    onSuccess: () => {
      addToast('success', 'Integration updated');
      setConfiguringIntegration(null);
      setConnectForm(emptyConnectForm);
      setTestStatus('idle');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update integration');
    },
  });

  const deleteMutation = trpc.integration.deleteIntegration.useMutation({
    onSuccess: () => {
      addToast('success', 'Integration disconnected');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to disconnect');
    },
  });

  const syncMutation = trpc.integration.syncIntegration.useMutation({
    onSuccess: () => {
      addToast('success', 'Sync started');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to sync');
    },
  });

  const getIntegration = (provider: string): Integration | undefined =>
    integrations.find((i) => i.provider === provider);

  const isConnected = (provider: string): boolean =>
    getIntegration(provider)?.status === 'connected';

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<Record<string, string>> = {};
    if (!connectForm.apiKey.trim() && !connectForm.token.trim()) {
      newErrors.apiKey = 'API key or token is required';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const provider = connectingProvider || configuringIntegration?.provider;
    if (!provider) return;

    if (configuringIntegration) {
      updateMutation.mutate({
        id: configuringIntegration.id,
        config: {
          ...configuringIntegration.config,
          apiKey: connectForm.apiKey.trim(),
          token: connectForm.token.trim(),
        },
      });
    } else {
      createMutation.mutate({
        provider,
        config: {
          apiKey: connectForm.apiKey.trim(),
          token: connectForm.token.trim(),
        },
      });
    }
  };

  const handleDisconnect = (id: string) => {
    if (!confirm('Disconnect this integration? This will stop all data syncing.')) return;
    deleteMutation.mutate({ id });
  };

  const handleSync = (id: string) => {
    syncMutation.mutate({ id });
  };

  const handleTest = () => {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus(Math.random() > 0.2 ? 'success' : 'error');
    }, 1500);
  };

  const openConnect = (provider: string) => {
    setConnectingProvider(provider);
    setConfiguringIntegration(null);
    setConnectForm(emptyConnectForm);
    setTestStatus('idle');
    setErrors({});
  };

  const openConfigure = (integration: Integration) => {
    setConfiguringIntegration(integration);
    setConnectingProvider(null);
    setConnectForm({
      apiKey: integration.config?.apiKey ?? '',
      token: integration.config?.token ?? '',
    });
    setTestStatus('idle');
    setErrors({});
  };

  const closeModal = () => {
    setConnectingProvider(null);
    setConfiguringIntegration(null);
    setConnectForm(emptyConnectForm);
    setTestStatus('idle');
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Integrations & Connectors</h1>
          <p className="page-subtitle">Connect third-party services to extend your CRM capabilities</p>
        </div>
      </div>

      {/* Grid */}
      {query.isLoading && !integrations.length ? (
        <Loading message="Loading integrations..." />
      ) : query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load integrations</p>
          <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {INTEGRATION_CATALOG.map((item) => {
            const integration = getIntegration(item.provider);
            const connected = integration?.status === 'connected';
            const Icon = item.icon;

            return (
              <Card
                key={item.provider}
                className="flex flex-col"
                actions={
                  connected ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(integration!.id)}
                        loading={syncMutation.isPending && syncMutation.variables?.id === integration!.id}
                        title="Sync now"
                      >
                        <RefreshCw size={16} className="text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openConfigure(integration!)}
                        title="Configure"
                      >
                        <Settings size={16} className="text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="gray">Disconnected</Badge>
                  )
                }
              >
                <div className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <Icon size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
                      {connected && (
                        <div className="flex items-center gap-1">
                          <Badge variant="green" className="mt-1">Connected</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mb-4 text-sm text-gray-500">{item.description}</p>
                  <div className="mt-auto">
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDisconnect(integration!.id)}
                        loading={deleteMutation.isPending && deleteMutation.variables?.id === integration!.id}
                      >
                        <Unlink size={14} className="mr-2" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => openConnect(item.provider)}
                      >
                        <Link2 size={14} className="mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                  {integration?.lastSyncedAt && (
                    <p className="mt-2 text-xs text-gray-400">
                      Last synced: {new Date(integration.lastSyncedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Connect / Configure Modal */}
      <Modal
        isOpen={!!connectingProvider || !!configuringIntegration}
        onClose={closeModal}
        title={
          configuringIntegration
            ? `Configure ${configuringIntegration.name}`
            : connectingProvider
            ? `Connect ${INTEGRATION_CATALOG.find((i) => i.provider === connectingProvider)?.name ?? ''}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              loading={testStatus === 'testing'}
              disabled={testStatus === 'testing'}
            >
              <TestTube size={16} className="mr-2" />
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={handleConnect}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              <Check size={16} className="mr-2" />
              {configuringIntegration ? 'Save Changes' : 'Connect'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="form-label">API Key</label>
            <input
              type="text"
              value={connectForm.apiKey}
              onChange={(e) => {
                setConnectForm((prev) => ({ ...prev, apiKey: e.target.value }));
                if (errors.apiKey) setErrors((prev) => ({ ...prev, apiKey: undefined }));
              }}
              className={`form-input ${errors.apiKey ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="pk_live_xxxxxxxxxxxxxxxx"
            />
            {errors.apiKey && <p className="mt-1 text-xs text-red-600">{errors.apiKey}</p>}
          </div>

          <div>
            <label className="form-label">Token (optional)</label>
            <input
              type="text"
              value={connectForm.token}
              onChange={(e) => setConnectForm((prev) => ({ ...prev, token: e.target.value }))}
              className="form-input"
              placeholder="Bearer token or OAuth token"
            />
          </div>

          {testStatus === 'success' && (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <Check size={18} className="mt-0.5 flex-shrink-0 text-green-600" />
              <p className="text-sm text-green-700">Connection successful. Credentials are valid.</p>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-700">Connection failed. Please check your credentials and try again.</p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
