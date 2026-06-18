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
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
  Calculator,
  Plus,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function TaxDashboard(): React.ReactElement {
  const navigate = useNavigate();
  const summaryQuery = trpc.tax.getTaxSummary.useQuery();

  if (summaryQuery.isLoading) {
    return <Loading message="Loading tax dashboard..." />;
  }

  if (summaryQuery.isError) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load tax summary"
          description="There was an error loading tax data."
          actionLabel="Retry"
          onAction={() => summaryQuery.refetch()}
        />
      </div>
    );
  }

  const summary = summaryQuery.data ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Tax Dashboard</h1>
          <p className="page-subtitle">Overview of your tax obligations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/tax/calculator')}>
            <Calculator size={16} className="mr-1" />
            Calculate
          </Button>
          <Button onClick={() => navigate('/tax/forms/new')}>
            <Plus size={16} className="mr-1" />
            Create Form
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Forms"
          value={summary.openForms ?? 0}
          icon={FileText}
          color="blue"
          onClick={() => navigate('/tax/forms')}
        />
        <StatCard
          title="Filed"
          value={summary.filedForms ?? 0}
          icon={CheckCircle2}
          color="green"
          onClick={() => navigate('/tax/forms')}
        />
        <StatCard
          title="Overdue"
          value={summary.overdueForms ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate('/tax/forms')}
        />
        <StatCard
          title="Pending"
          value={summary.pendingForms ?? 0}
          icon={Clock}
          color="orange"
          onClick={() => navigate('/tax/forms')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card title="Upcoming Deadlines" subtitle="Tax filings due soon">
          {summary.upcomingDeadlines && summary.upcomingDeadlines.length > 0 ? (
            <div className="space-y-3">
              {summary.upcomingDeadlines.map((deadline: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deadline.formType} - {deadline.name}</p>
                      <p className="text-xs text-gray-500">Due {new Date(deadline.deadline).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={deadline.daysLeft <= 7 ? 'red' : deadline.daysLeft <= 30 ? 'yellow' : 'blue'}>
                    {deadline.daysLeft} days
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="No upcoming deadlines"
              description="You're all caught up on tax deadlines."
            />
          )}
        </Card>

        {/* Forms by Status */}
        <Card title="Forms by Status" subtitle="Breakdown of your tax forms">
          <div className="space-y-4">
            {summary.statusBreakdown && Object.entries(summary.statusBreakdown).map(([status, count]: [string, any]) => (
              <div key={status} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium capitalize text-gray-700">{status}</div>
                <div className="flex-1">
                  <div className="h-2.5 rounded-full bg-gray-100">
                    <div
                      className={
                        'h-2.5 rounded-full ' +
                        (status === 'filed' ? 'bg-green-500' :
                         status === 'overdue' ? 'bg-red-500' :
                         status === 'pending' ? 'bg-blue-500' :
                         status === 'draft' ? 'bg-yellow-500' : 'bg-gray-400')
                      }
                      style={{ width: `${Math.min(100, (count / (summary.totalForms || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-8 text-right text-sm font-medium text-gray-900">{count}</div>
              </div>
            ))}

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Forms</span>
                <span className="text-lg font-bold text-gray-900">{summary.totalForms ?? 0}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
