import React from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { StatCard } from '../../components/ui/StatCard.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Calendar,
  ArrowRight,
  Gauge,
} from 'lucide-react';

export default function ComplianceDashboard(): React.ReactElement {
  const navigate = useNavigate();
  const dashboardQuery = trpc.compliance.getComplianceDashboard.useQuery();

  if (dashboardQuery.isLoading) {
    return <Loading message="Loading compliance dashboard..." />;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load compliance data"
          description="There was an error loading the compliance dashboard."
          actionLabel="Retry"
          onAction={() => dashboardQuery.refetch()}
        />
      </div>
    );
  }

  const data = dashboardQuery.data ?? {};
  const riskLevel = data.riskLevel ?? 'low';
  const riskColor = riskLevel === 'high' ? 'text-red-600' : riskLevel === 'medium' ? 'text-yellow-600' : 'text-green-600';
  const riskBg = riskLevel === 'high' ? 'bg-red-50' : riskLevel === 'medium' ? 'bg-yellow-50' : 'bg-green-50';
  const riskPercentage = riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 50 : 25;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Compliance Dashboard</h1>
          <p className="page-subtitle">Monitor your compliance posture</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/compliance/calendar')}>
            <Calendar size={16} className="mr-1" />
            Calendar
          </Button>
          <Button onClick={() => navigate('/compliance/items/new')}>
            <Plus size={16} className="mr-1" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Risk Meter */}
      <Card className="overflow-hidden">
        <div className="card-body">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full ${riskBg}`}>
              <Gauge size={40} className={riskColor} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-semibold text-gray-900">Compliance Risk Score</h3>
              <p className="mt-1 text-sm text-gray-500">
                Based on overdue items, upcoming deadlines, and priority levels
              </p>
              <div className="mt-3 h-3 w-full rounded-full bg-gray-100 max-w-md">
                <div
                  className={`h-3 rounded-full transition-all ${riskLevel === 'high' ? 'bg-red-500' : riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${riskPercentage}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <span className={`text-2xl font-bold capitalize ${riskColor}`}>{riskLevel}</span>
              <p className="text-xs text-gray-500">Risk Level</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Compliant"
          value={data.compliantCount ?? 0}
          icon={CheckCircle2}
          color="green"
          onClick={() => navigate('/compliance/items')}
        />
        <StatCard
          title="In Progress"
          value={data.inProgressCount ?? 0}
          icon={Clock}
          color="blue"
          onClick={() => navigate('/compliance/items')}
        />
        <StatCard
          title="Overdue"
          value={data.overdueCount ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate('/compliance/items')}
        />
        <StatCard
          title="At Risk"
          value={data.atRiskCount ?? 0}
          icon={AlertCircle}
          color="orange"
          onClick={() => navigate('/compliance/items')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overdue Items */}
        <Card title="Overdue Items" subtitle="Action required immediately">
          {data.overdueItems && data.overdueItems.length > 0 ? (
            <div className="space-y-3">
              {data.overdueItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <AlertTriangle size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.category} · Due {new Date(item.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant="red">{item.daysOverdue} days overdue</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No overdue items"
              description="Great job! All compliance items are on track."
            />
          )}
        </Card>

        {/* Priority Items */}
        <Card title="Priority Items" subtitle="High priority upcoming items">
          {data.priorityItems && data.priorityItems.length > 0 ? (
            <div className="space-y-3">
              {data.priorityItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <AlertCircle size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.category} · Due {new Date(item.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={item.priority === 'high' ? 'red' : 'yellow'}>{item.priority}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Shield}
              title="No priority items"
              description="No high-priority compliance items at the moment."
            />
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          onClick={() => navigate('/compliance/items')}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Plus size={24} />
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">Add Compliance Item</p>
            <p className="text-sm text-gray-500">Log a new requirement or task</p>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </button>
        <button
          onClick={() => navigate('/compliance/calendar')}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">Review Calendar</p>
            <p className="text-sm text-gray-500">See all upcoming deadlines</p>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </button>
        <button
          onClick={() => navigate('/compliance/reports')}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">Compliance Report</p>
            <p className="text-sm text-gray-500">Generate a status report</p>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </button>
      </div>
    </div>
  );
}
