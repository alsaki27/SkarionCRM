import React, { useState } from 'react';
import { trpc } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  Download,
  Calendar,
  Landmark,
  CreditCard,
  Scale,
} from 'lucide-react';

interface LineItem {
  id: string;
  accountName: string;
  accountCode: string;
  amount: number;
  category: string;
}

export default function ReportBalanceSheet(): React.ReactElement {
  const today = new Date();
  const [asOfDate, setAsOfDate] = useState(today.toISOString().split('T')[0]);

  const query = trpc.report.getBalanceSheet.useQuery(
    { asOfDate },
    { enabled: !!asOfDate }
  );

  const data = query.data;
  const assets: LineItem[] = data?.assets ?? [];
  const liabilities: LineItem[] = data?.liabilities ?? [];
  const equity: LineItem[] = data?.equity ?? [];

  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
  const totalEquity = equity.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

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
                <td className="py-2 text-right font-medium text-gray-900">
                  ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-gray-200">
            <td className="py-3 font-bold text-gray-900">Total {title}</td>
            <td className="py-3 text-right font-bold text-gray-900">
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
          <h1 className="page-title">Balance Sheet</h1>
          <p className="page-subtitle">Assets, liabilities, and equity</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download size={16} className="mr-2" />
          Export
        </Button>
      </div>

      {/* As-of Date */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">As of:</span>
          </div>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="form-input"
          />
        </div>
      </Card>

      {/* Report */}
      <Card>
        {query.isLoading ? (
          <Loading message="Loading balance sheet..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load report</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {renderSection(
              'Assets',
              <Landmark size={18} className="text-green-600" />,
              assets,
              totalAssets,
              'bg-green-100'
            )}

            {renderSection(
              'Liabilities',
              <CreditCard size={18} className="text-red-600" />,
              liabilities,
              totalLiabilities,
              'bg-red-100'
            )}

            {renderSection(
              'Equity',
              <Scale size={18} className="text-blue-600" />,
              equity,
              totalEquity,
              'bg-blue-100'
            )}

            {/* Balancing Check */}
            <div className="border-t-2 border-gray-900 pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold text-gray-900">Total Liabilities + Equity</span>
                <span className="text-xl font-bold text-gray-900">
                  ${totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Assets</span>
                <span className={`text-sm font-bold ${totalAssets === totalLiabilitiesAndEquity ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {totalAssets !== totalLiabilitiesAndEquity && (
                <p className="mt-2 text-sm text-red-600">
                  Warning: Assets do not equal Liabilities + Equity (difference: ${(totalAssets - totalLiabilitiesAndEquity).toLocaleString()})
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
