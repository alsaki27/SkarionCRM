import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import {
  ArrowLeft,
  Pencil,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Building,
  Briefcase,
  FileText,
  Receipt,
} from 'lucide-react';

type Tab = 'profile' | 'payroll' | 'w2' | 'documents';

export default function EmployeeDetail(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const employeeQuery = trpc.employee.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const payrollHistoryQuery = trpc.payroll.getEmployeeHistory.useQuery(
    { employeeId: id! },
    { enabled: !!id && activeTab === 'payroll' }
  );

  const w2ListQuery = trpc.w2.listW2s.useQuery(
    { employeeId: id },
    { enabled: !!id && activeTab === 'w2' }
  );

  const employee = employeeQuery.data;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
      active: { variant: 'green', label: 'Active' },
      inactive: { variant: 'gray', label: 'Inactive' },
      terminated: { variant: 'red', label: 'Terminated' },
      on_leave: { variant: 'yellow', label: 'On Leave' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (employeeQuery.isLoading) return <Loading message="Loading employee..." />;
  if (employeeQuery.isError || !employee) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600 mb-3">Failed to load employee</p>
        <Button variant="secondary" onClick={() => employeeQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User size={16} /> },
    { key: 'payroll', label: 'Payroll History', icon: <Receipt size={16} /> },
    { key: 'w2', label: 'W2 Forms', icon: <FileText size={16} /> },
    { key: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/employees')}>
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/payroll/employees/${id}/edit`)}>
            <Pencil size={16} className="mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Employee Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
          {employee.firstName?.[0]}{employee.lastName?.[0]}
        </div>
        <div>
          <h1 className="page-title">{employee.firstName} {employee.lastName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{employee.jobTitle}</span>
            <span className="text-gray-300">|</span>
            <span>{employee.department}</span>
            <span className="text-gray-300">|</span>
            {getStatusBadge(employee.status)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Contact Information">
              <div className="space-y-3 p-6">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{employee.email || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{employee.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Building size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{employee.address || '-'}</span>
                </div>
              </div>
            </Card>
            <Card title="Employment Details">
              <div className="space-y-3 p-6">
                <div className="flex items-center gap-3">
                  <Briefcase size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{employee.employmentType?.replace('_', ' ') || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">
                    Hired {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">
                    ${employee.payRate?.toLocaleString()} / {employee.payFrequency}
                  </span>
                </div>
              </div>
            </Card>
            <Card title="Tax & Deductions">
              <div className="space-y-3 p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Federal Withholding</span>
                  <span className="text-gray-900">{employee.withholdingFederal ?? 0} allowances</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">State Withholding</span>
                  <span className="text-gray-900">{employee.withholdingState || '-'} {employee.withholdingStateAmount ? `($${employee.withholdingStateAmount})` : ''}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">401(k) Rate</span>
                  <span className="text-gray-900">{employee.retirement401kRate ?? 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Health Insurance</span>
                  <span className="text-gray-900">${employee.healthInsurancePremium ?? 0}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'payroll' && (
          <Card>
            {payrollHistoryQuery.isLoading ? (
              <Loading message="Loading payroll history..." />
            ) : payrollHistoryQuery.isError ? (
              <div className="py-8 text-center">
                <p className="text-red-600 text-sm mb-2">Failed to load payroll history</p>
                <Button variant="secondary" size="sm" onClick={() => payrollHistoryQuery.refetch()}>Retry</Button>
              </div>
            ) : !payrollHistoryQuery.data?.length ? (
              <div className="py-8 text-center text-sm text-gray-500">No payroll history found</div>
            ) : (
              <Table
                columns={[
                  { key: 'runName', header: 'Payroll Run' },
                  { key: 'period', header: 'Period', render: (row: any) => `${new Date(row.periodStart).toLocaleDateString()} - ${new Date(row.periodEnd).toLocaleDateString()}` },
                  { key: 'payDate', header: 'Pay Date', render: (row: any) => new Date(row.payDate).toLocaleDateString() },
                  { key: 'regularHours', header: 'Hours' },
                  { key: 'grossPay', header: 'Gross Pay', align: 'right', render: (row: any) => `$${row.grossPay.toLocaleString()}` },
                  { key: 'netPay', header: 'Net Pay', align: 'right', render: (row: any) => `$${row.netPay.toLocaleString()}` },
                ]}
                data={payrollHistoryQuery.data}
                keyExtractor={(row: any) => row.id}
              />
            )}
          </Card>
        )}

        {activeTab === 'w2' && (
          <Card>
            {w2ListQuery.isLoading ? (
              <Loading message="Loading W2 forms..." />
            ) : w2ListQuery.isError ? (
              <div className="py-8 text-center">
                <p className="text-red-600 text-sm mb-2">Failed to load W2 forms</p>
                <Button variant="secondary" size="sm" onClick={() => w2ListQuery.refetch()}>Retry</Button>
              </div>
            ) : !w2ListQuery.data?.length ? (
              <div className="py-8 text-center text-sm text-gray-500">No W2 forms found</div>
            ) : (
              <Table
                columns={[
                  { key: 'year', header: 'Year' },
                  { key: 'box1', header: 'Box 1 Wages', align: 'right', render: (row: any) => `$${row.box1Wages?.toLocaleString() ?? '-'}` },
                  { key: 'box2', header: 'Box 2 Federal Tax', align: 'right', render: (row: any) => `$${row.box2FederalTax?.toLocaleString() ?? '-'}` },
                  { key: 'status', header: 'Status', render: (row: any) => <Badge variant={row.status === 'filed' ? 'green' : row.status === 'pending' ? 'yellow' : 'gray'}>{row.status}</Badge> },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row: any) => (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/w2/list?preview=${row.id}`)}>
                        View
                      </Button>
                    ),
                  },
                ]}
                data={w2ListQuery.data}
                keyExtractor={(row: any) => row.id}
              />
            )}
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <div className="py-8 text-center text-sm text-gray-500">Document management coming soon</div>
          </Card>
        )}
      </div>
    </div>
  );
}
