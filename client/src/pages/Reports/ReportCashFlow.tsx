import React, { useState } from 'react';
import { trpc } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  Download,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';

interface LineItem {
  id: string;
  accountName: string;
  accountCode: string;
  amount: number;
  category: string;
}

export default function ReportCashFlow(): React.ReactElement {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [periodStart, setPeriodStart] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(lastDayOfMonth.toISOString().split('T')[0]);

  const query = trpc.report.getCashFlow.useQuery(
    { periodStart, periodEnd },
    { enabled: !!periodStart && !!periodEnd }
  );

  const data = query.data;
  const operating: LineItem[] = data?.operating ?? [];
  const investing: LineItem[] = data?.investing ?? [];
  const financing: LineItem[] = data?.financing ?? [];

  const totalOperating = operating.reduce((sum, item) => sum + item.amount, 0);
  const totalInvesting = investing.reduce((sum, item) => sum + item.amount, 0);
  const totalFinancing = financing.reduce((sum, item) => sum + item.amount, 0);
  const netChange = totalOperating + totalInvesting + totalFinancing;

  const handleExport = () => {
    addToast('info', 'Export feature coming soon');
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: LineItem[],
    total: number,
    colorClass: string
  ) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorClass}`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 font-medium text-gray-500">Account</th>
            <th className="text-right py-2 font-medium text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-4 text-center text-gray-500">No items</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">
                  <span className="font-medium text-gray-900">{item.accountName}</span>
                  <span className="ml-2 text-xs text-gray-400">{item.accountCode}</span>
                </td>
                <td className={`py-2 text-right font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-gray-200">
            <td className="py-3 font-bold text-gray-900">Net {title}</td>
            <td className={`py-3 text-right font-bold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Cash Flow Statement</h1>
          <p className="page-subtitle">Operating, investing, and financing activities</p>
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

      {/* Report */}
      <Card>
        {query.isLoading ? (
          <Loading message="Loading cash flow report..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load report</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {renderSection(
              'Operating Activities',
              <ArrowDownLeft size={18} className="text-green-600" />,
              operating,
              totalOperating,
              'bg-green-100'
            )}

            {renderSection(
              'Investing Activities',
              <ArrowUpRight size={18} className="text-orange-600" />,
              investing,
              totalInvesting,
              'bg-orange-100'
            )}

            {renderSection(
              'Financing Activities',
              <Wallet size={18} className="text-blue-600" />,
              financing,
              totalFinancing,
              'bg-blue-100'
            )}

            {/* Net Change */}
            <div className="border-t-2 border-gray-900 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Net Change in Cash</span>
                <span className={`text-xl font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
