import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { StatCard } from '../../components/ui/StatCard';
import { addToast } from '../../components/ui/Toast';
import {
  FileText,
  FileCheck,
  Clock,
  Send,
  Eye,
  Wand2,
  ChevronDown,
} from 'lucide-react';

export default function W2Dashboard(): React.ReactElement {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const w2Query = trpc.w2.listW2s.useQuery({ year: selectedYear });

  const generateMutation = trpc.w2.generateW2.useMutation({
    onSuccess: () => {
      addToast('success', 'W2 generation started');
      w2Query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to generate W2s');
    },
  });

  const w2s = w2Query.data ?? [];
  const total = w2s.length;
  const filed = w2s.filter((w: any) => w.status === 'filed').length;
  const pending = w2s.filter((w: any) => w.status === 'pending').length;
  const distributed = w2s.filter((w: any) => w.status === 'distributed').length;

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleGenerate = () => {
    if (!confirm(`Generate W2 forms for tax year ${selectedYear}?`)) return;
    generateMutation.mutate({ year: selectedYear });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">W2 Dashboard</h1>
          <p className="page-subtitle">Manage and distribute employee W2 forms</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="form-input pr-8"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <Button onClick={handleGenerate} loading={generateMutation.isLoading}>
            <Wand2 size={16} className="mr-2" />
            Generate W2s
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total W2s"
          value={total}
          icon={FileText}
          color="primary"
        />
        <StatCard
          title="Filed"
          value={filed}
          icon={FileCheck}
          color="green"
        />
        <StatCard
          title="Pending"
          value={pending}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Distributed"
          value={distributed}
          icon={Send}
          color="blue"
        />
      </div>

      {/* Status Breakdown */}
      <Card title="Status Breakdown">
        <div className="p-6">
          {w2Query.isLoading ? (
            <Loading message="Loading W2 data..." />
          ) : w2Query.isError ? (
            <div className="py-8 text-center">
              <p className="text-red-600 text-sm mb-2">Failed to load W2 data</p>
              <Button variant="secondary" size="sm" onClick={() => w2Query.refetch()}>Retry</Button>
            </div>
          ) : total === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No W2 forms for {selectedYear}. Generate W2s to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {['pending', 'filed', 'distributed', 'void'].map((status) => {
                const count = w2s.filter((w: any) => w.status === status).length;
                if (count === 0) return null;
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const colorMap: Record<string, string> = {
                  pending: 'bg-yellow-500',
                  filed: 'bg-green-500',
                  distributed: 'bg-blue-500',
                  void: 'bg-red-500',
                };
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium capitalize text-gray-700">{status}</span>
                      <span className="text-gray-500">{count} ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${colorMap[status] ?? 'bg-gray-400'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <button
            onClick={() => navigate('/w2/generate')}
            className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 p-6 text-center transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Wand2 size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Generate W2s</p>
              <p className="mt-1 text-sm text-gray-500">Create forms for selected employees</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/w2/list')}
            className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 p-6 text-center transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Eye size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Preview & Edit</p>
              <p className="mt-1 text-sm text-gray-500">Review and modify W2 forms</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/w2/list')}
            className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 p-6 text-center transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
              <Send size={24} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Distribute</p>
              <p className="mt-1 text-sm text-gray-500">Send W2s to employees</p>
            </div>
          </button>
        </div>
      </Card>
    </div>
  );
}
