import React from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../api.ts';
import { Card } from '../components/ui/Card.tsx';
import { StatCard } from '../components/ui/StatCard.tsx';
import { Loading } from '../components/ui/Loading.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { addToast } from '../components/ui/Toast.tsx';
import {
  Users,
  Briefcase,
  DollarSign,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Receipt,
  Calculator,
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart,
} from 'lucide-react';

export default function Dashboard(): React.ReactElement {
  const navigate = useNavigate();

  const summaryQuery = trpc.report.getDashboardSummary.useQuery();
  const contactStats = trpc.contact.getStats.useQuery();
  const taskDashboard = trpc.task.getDashboard.useQuery();
  const employeeStats = trpc.employee.getStats.useQuery();

  const isLoading = summaryQuery.isLoading || contactStats.isLoading || taskDashboard.isLoading || employeeStats.isLoading;
  const isError = summaryQuery.isError || contactStats.isError || taskDashboard.isError || employeeStats.isError;

  if (isLoading) {
    return <Loading message="Loading dashboard..." />;
  }

  if (isError) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load dashboard"
          description="There was an error loading your dashboard data."
          actionLabel="Retry"
          onAction={() => {
            summaryQuery.refetch();
            contactStats.refetch();
            taskDashboard.refetch();
            employeeStats.refetch();
          }}
        />
      </div>
    );
  }

  const summary = summaryQuery.data ?? {};
  const contacts = contactStats.data ?? {};
  const tasks = taskDashboard.data ?? {};
  const employees = employeeStats.data ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your business</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports/pnl')}>
            <BarChart3 size={16} className="mr-1" />
            Reports
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={contacts.total ?? 0}
          change={contacts.change ?? '+0%'}
          changeType={(contacts.changeDirection as 'positive' | 'negative' | 'neutral') ?? 'neutral'}
          icon={Users}
          color="blue"
          onClick={() => navigate('/contacts')}
        />
        <StatCard
          title="Employees"
          value={employees.total ?? 0}
          change={employees.change ?? '+0%'}
          changeType={(employees.changeDirection as 'positive' | 'negative' | 'neutral') ?? 'neutral'}
          icon={Briefcase}
          color="purple"
          onClick={() => navigate('/payroll/employees')}
        />
        <StatCard
          title="Transactions"
          value={summary.transactionCount ?? 0}
          change={summary.transactionChange ?? '+0%'}
          changeType={(summary.transactionDirection as 'positive' | 'negative' | 'neutral') ?? 'neutral'}
          icon={DollarSign}
          color="green"
          onClick={() => navigate('/financial/transactions')}
        />
        <StatCard
          title="Open Tasks"
          value={tasks.openCount ?? 0}
          change={tasks.change ?? '+0'}
          changeType="neutral"
          icon={CheckSquare}
          color="orange"
          onClick={() => navigate('/tasks')}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => navigate('/contacts/new')}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Users size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Add Contact</p>
            <p className="text-xs text-gray-500">New client or vendor</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/financial/transactions')}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <Plus size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Add Transaction</p>
            <p className="text-xs text-gray-500">Record income or expense</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <CheckSquare size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Create Task</p>
            <p className="text-xs text-gray-500">Set a reminder</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/payroll/runs/new')}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Calculator size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Run Payroll</p>
            <p className="text-xs text-gray-500">Process payments</p>
          </div>
        </button>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Recent Activity" subtitle="Latest actions across your account">
            {summary.recentActivity && summary.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {summary.recentActivity.map((activity: any, index: number) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                      <FileText size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">{activity.description}</p>
                    </div>
                    <span className="text-xs text-gray-400">{activity.timeAgo}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No recent activity"
                description="Your recent actions will appear here."
              />
            )}
          </Card>

          {/* Charts placeholder */}
          <Card title="Financial Overview" subtitle="Revenue and expense trends">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="h-48 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 size={32} className="mx-auto text-blue-400 mb-2" />
                  <p className="text-sm font-medium text-blue-700">Revenue Trend</p>
                  <p className="text-xs text-blue-500">Chart integration ready</p>
                </div>
              </div>
              <div className="h-48 rounded-lg bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                <div className="text-center">
                  <PieChart size={32} className="mx-auto text-green-400 mb-2" />
                  <p className="text-sm font-medium text-green-700">Expense Breakdown</p>
                  <p className="text-xs text-green-500">Chart integration ready</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <Card title="Upcoming Deadlines" subtitle="Tax and compliance due dates">
            {summary.upcomingDeadlines && summary.upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {summary.upcomingDeadlines.map((deadline: any, index: number) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{deadline.title}</p>
                        <p className="text-xs text-gray-500">{deadline.date}</p>
                      </div>
                    </div>
                    <Badge variant={deadline.urgent ? 'red' : 'yellow'}>
                      {deadline.daysLeft} days
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No upcoming deadlines"
                description="You're all caught up!"
              />
            )}
          </Card>

          {/* Tasks snapshot */}
          <Card title="Tasks" subtitle={`${tasks.openCount ?? 0} open`}>
            {tasks.recent && tasks.recent.length > 0 ? (
              <div className="space-y-3">
                {tasks.recent.map((task: any, index: number) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">Due {task.dueDate}</p>
                    </div>
                    <Badge variant={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'blue'}>
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckSquare}
                title="No tasks"
                description="Create a task to get started."
                actionLabel="Create Task"
                onAction={() => navigate('/tasks')}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
