import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { StatCard } from '../../components/ui/StatCard';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import {
  ArrowLeft,
  Play,
  Ban,
  Printer,
  FileText,
  DollarSign,
  Users,
  Receipt,
} from 'lucide-react';

interface PayrollEntry {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  retirement401k: number;
  healthInsurance: number;
  otherDeductions: number;
  netPay: number;
}

export default function PayrollRunDetail(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const runQuery = trpc.payroll.getRunDetails.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const processMutation = trpc.payroll.processRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Payroll run processed successfully');
      runQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to process run');
    },
  });

  const voidMutation = trpc.payroll.voidRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Payroll run voided');
      runQuery.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to void run');
    },
  });

  const run = runQuery.data;
  const entries: PayrollEntry[] = run?.entries ?? [];

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'; label: string }> = {
      draft: { variant: 'gray', label: 'Draft' },
      processing: { variant: 'purple', label: 'Processing' },
      completed: { variant: 'green', label: 'Completed' },
      cancelled: { variant: 'red', label: 'Cancelled' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleProcess = () => {
    if (!confirm('Process this payroll run? This will finalize payments.')) return;
    processMutation.mutate({ id: id! });
  };

  const handleVoid = () => {
    if (!confirm('Void this payroll run? This action cannot be undone.')) return;
    voidMutation.mutate({ id: id! });
  };

  if (runQuery.isLoading) return <Loading message="Loading payroll run..." />;
  if (runQuery.isError || !run) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600 mb-3">Failed to load payroll run</p>
        <Button variant="secondary" onClick={() => runQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  const totalGross = entries.reduce((sum, e) => sum + e.grossPay, 0);
  const totalDeductions = entries.reduce((sum, e) => sum + e.federalTax + e.stateTax + e.socialSecurity + e.medicare + e.retirement401k + e.healthInsurance + e.otherDeductions, 0);
  const totalNet = entries.reduce((sum, e) => sum + e.netPay, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/runs')}>
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Button>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <Button
              onClick={handleProcess}
              loading={processMutation.isLoading}
            >
              <Play size={16} className="mr-2" />
              Process
            </Button>
          )}
          {run.status === 'completed' && (
            <Button variant="danger" onClick={handleVoid} loading={voidMutation.isLoading}>
              <Ban size={16} className="mr-2" />
              Void
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} className="mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Run Info */}
      <div>
        <h1 className="page-title">{run.runName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>Period: {new Date(run.periodStart).toLocaleDateString()} - {new Date(run.periodEnd).toLocaleDateString()}</span>
          <span className="text-gray-300">|</span>
          <span>Pay Date: {new Date(run.payDate).toLocaleDateString()}</span>
          <span className="text-gray-300">|</span>
          {getStatusBadge(run.status)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Gross"
          value={`$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Total Deductions"
          value={`$${totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Receipt}
          color="orange"
        />
        <StatCard
          title="Total Net"
          value={`$${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Employees"
          value={entries.length}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Entries Table */}
      <Card title="Payroll Entries">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No entries in this run</div>
        ) : (
          <Table<PayrollEntry>
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (row) => `${row.firstName} ${row.lastName}`,
              },
              {
                key: 'hours',
                header: 'Hours',
                align: 'right',
                render: (row) => `${row.regularHours + row.overtimeHours}`,
              },
              {
                key: 'grossPay',
                header: 'Gross Pay',
                align: 'right',
                render: (row) => `$${row.grossPay.toLocaleString()}`,
              },
              {
                key: 'taxes',
                header: 'Taxes',
                align: 'right',
                render: (row) => `$${(row.federalTax + row.stateTax + row.socialSecurity + row.medicare).toLocaleString()}`,
              },
              {
                key: 'deductions',
                header: 'Deductions',
                align: 'right',
                render: (row) => `$${(row.retirement401k + row.healthInsurance + row.otherDeductions).toLocaleString()}`,
              },
              {
                key: 'netPay',
                header: 'Net Pay',
                align: 'right',
                render: (row) => <span className="font-semibold">${row.netPay.toLocaleString()}</span>,
              },
            ]}
            data={entries}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>
    </div>
  );
}
