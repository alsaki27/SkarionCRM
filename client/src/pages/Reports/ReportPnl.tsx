import React, { useState } from 'react';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';

interface LineItem {
  id: string;
  accountName: string;
  accountCode: string;
  amount: number;
  category: string;
}

export default function ReportPnl(): React.ReactElement {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [periodStart, setPeriodStart] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(lastDayOfMonth.toISOString().split('T')[0]);

  const query = trpc.report.getPnl.useQuery(
    { periodStart, periodEnd },
    { enabled: !!periodStart && !!periodEnd }
  );

  const data = query.data;
  const revenueItems: LineItem[] = data?.revenue ?? [];
  const expenseItems: LineItem[] = data?.expenses ?? [];
  const totalRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  const handleExport = () => {
    addToast('info', 'Export feature coming soon');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <p className="page-subtitle">Revenue, expenses, and net income</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download size={16} className="mr-2" />
          Export
        </Button>
      </div>

      {/* Date Range */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="form-input"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-sm text-gray-500">Total Revenue</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              <span className="text-sm text-gray-500">Total Expenses</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-blue-500" />
              <span className="text-sm text-gray-500">Net Income</span>
            </div>
            <p className={`mt-2 text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
      </div>

      {/* Report Table */}
      <Card>
        {query.isLoading ? (
          <Loading message="Loading P&L report..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load report</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Revenue Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-500">Account</th>
                    <th className="text-right py-2 font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenueItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-gray-500">No revenue items</td>
                    </tr>
                  ) : (
                    revenueItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <span className="font-medium text-gray-900">{item.accountName}</span>
                          <span className="ml-2 text-xs text-gray-400">{item.accountCode}</span>
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-3 font-semibold text-gray-900">Total Revenue</td>
                    <td className="py-3 text-right font-bold text-gray-900">
                      ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expense Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-500">Account</th>
                    <th className="text-right py-2 font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenseItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-gray-500">No expense items</td>
                    </tr>
                  ) : (
                    expenseItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <span className="font-medium text-gray-900">{item.accountName}</span>
                          <span className="ml-2 text-xs text-gray-400">{item.accountCode}</span>
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-3 font-semibold text-gray-900">Total Expenses</td>
                    <td className="py-3 text-right font-bold text-gray-900">
                      ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Income */}
            <div className="border-t-2 border-gray-900 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Net Income</span>
                <span className={`text-xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
