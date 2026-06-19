import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import {
  Plus,
  Search,
  Users,
  Eye,
  Pencil,
  UserX,
  Filter,
  X,
} from 'lucide-react';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  hireDate: string;
  payRate: number;
  payFrequency: string;
  payType: string;
  employmentType: string;
}

export default function Employees(): React.ReactElement {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  const query = trpc.employee.list.useQuery({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    department: departmentFilter === 'all' ? undefined : departmentFilter,
    employmentType: typeFilter === 'all' ? undefined : typeFilter,
    page,
    pageSize,
  });

  const terminateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      addToast('success', 'Employee terminated successfully');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to terminate employee');
    },
  });

  const employees: Employee[] = query.data?.employees ?? [];
  const total = query.data?.total ?? 0;

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

  const handleTerminate = (id: string) => {
    if (!confirm('Are you sure you want to terminate this employee?')) return;
    terminateMutation.mutate({ id, status: 'terminated' });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDepartmentFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || departmentFilter !== 'all' || typeFilter !== 'all' || searchQuery !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Manage your team and their payroll information</p>
        </div>
        <Button onClick={() => navigate('/payroll/employees/new')}>
          <Plus size={16} className="mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="form-input pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'ring-2 ring-primary-500' : ''}
            >
              <Filter size={16} className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                  {(statusFilter !== 'all' ? 1 : 0) + (departmentFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="form-label mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div>
                <label className="form-label mb-1">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Departments</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Support">Support</option>
                </select>
              </div>
              <div>
                <label className="form-label mb-1">Employment Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="form-input"
                >
                  <option value="all">All Types</option>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contractor">Contractor</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {query.isLoading && !employees.length ? (
          <Loading message="Loading employees..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load employees</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description={hasActiveFilters ? 'Try adjusting your filters or search query.' : 'Get started by adding your first employee.'}
            actionLabel={hasActiveFilters ? undefined : 'Add Employee'}
            onAction={hasActiveFilters ? undefined : () => navigate('/payroll/employees/new')}
          />
        ) : (
          <Table<Employee>
            columns={[
              {
                key: 'employeeId',
                header: 'Employee ID',
                render: (row) => <span className="font-mono text-xs text-gray-600">{row.employeeId}</span>,
              },
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {row.firstName[0]}{row.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{row.firstName} {row.lastName}</div>
                      <div className="text-xs text-gray-500">{row.jobTitle || row.employmentType}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'department', header: 'Department' },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'hireDate',
                header: 'Hire Date',
                render: (row) => row.hireDate ? new Date(row.hireDate).toLocaleDateString() : '-',
              },
              {
                key: 'payRate',
                header: 'Pay Rate',
                render: (row) => (
                  <span className="font-medium">
                    ${row.payRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-gray-500 text-xs">/{row.payFrequency}</span>
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/payroll/employees/${row.id}`)}
                      title="View"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/payroll/employees/${row.id}/edit`)}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Button>
                    {row.status !== 'terminated' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTerminate(row.id)}
                        loading={terminateMutation.isPending && terminateMutation.variables?.id === row.id}
                        title="Terminate"
                      >
                        <UserX size={16} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={employees}
            pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            loading={query.isLoading}
            keyExtractor={(row) => row.id}
            emptyMessage="No employees found"
          />
        )}
      </Card>
    </div>
  );
}
