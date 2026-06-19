import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trpc } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import { ArrowLeft, Save } from 'lucide-react';

interface EmployeeFormData {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  status: string;
  employmentType: string;
  jobTitle: string;
  department: string;
  payRate: string;
  payFrequency: string;
  payType: string;
  address: string;
  withholdingFederal: string;
  withholdingState: string;
  withholdingStateAmount: string;
  retirement401kRate: string;
  healthInsurancePremium: string;
}

const emptyForm: EmployeeFormData = {
  employeeId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  hireDate: '',
  status: 'active',
  employmentType: 'full_time',
  jobTitle: '',
  department: '',
  payRate: '',
  payFrequency: 'biweekly',
  payType: 'hourly',
  address: '',
  withholdingFederal: '0',
  withholdingState: '',
  withholdingStateAmount: '0',
  retirement401kRate: '0',
  healthInsurancePremium: '0',
};

export default function EmployeeForm(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});

  const employeeQuery = trpc.employee.getById.useQuery(
    { id: id! },
    { enabled: isEdit }
  );

  useEffect(() => {
    if (employeeQuery.data && isEdit) {
      const d = employeeQuery.data;
      setForm({
        employeeId: d.employeeId ?? '',
        firstName: d.firstName ?? '',
        lastName: d.lastName ?? '',
        email: d.email ?? '',
        phone: d.phone ?? '',
        hireDate: d.hireDate ? new Date(d.hireDate).toISOString().split('T')[0] : '',
        status: d.status ?? 'active',
        employmentType: d.employmentType ?? 'full_time',
        jobTitle: d.jobTitle ?? '',
        department: d.department ?? '',
        payRate: d.payRate?.toString() ?? '',
        payFrequency: d.payFrequency ?? 'biweekly',
        payType: d.payType ?? 'hourly',
        address: d.address ?? '',
        withholdingFederal: d.withholdingFederal?.toString() ?? '0',
        withholdingState: d.withholdingState ?? '',
        withholdingStateAmount: d.withholdingStateAmount?.toString() ?? '0',
        retirement401kRate: d.retirement401kRate?.toString() ?? '0',
        healthInsurancePremium: d.healthInsurancePremium?.toString() ?? '0',
      });
    }
  }, [employeeQuery.data, isEdit]);

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => {
      addToast('success', 'Employee created successfully');
      navigate('/payroll/employees');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create employee');
    },
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      addToast('success', 'Employee updated successfully');
      navigate('/payroll/employees');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update employee');
    },
  });

  const handleChange = (field: keyof EmployeeFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EmployeeFormData, string>> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!form.employeeId.trim()) newErrors.employeeId = 'Employee ID is required';
    if (!form.payRate || Number(form.payRate) <= 0) newErrors.payRate = 'Pay rate must be greater than 0';
    if (!form.hireDate) newErrors.hireDate = 'Hire date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      payRate: Number(form.payRate),
      withholdingFederal: Number(form.withholdingFederal),
      withholdingStateAmount: Number(form.withholdingStateAmount),
      retirement401kRate: Number(form.retirement401kRate),
      healthInsurancePremium: Number(form.healthInsurancePremium),
    };

    if (isEdit) {
      updateMutation.mutate({ id: id!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && employeeQuery.isLoading) {
    return <Loading message="Loading employee..." />;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/employees')}>
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="page-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h1>
        <p className="page-subtitle">
          {isEdit ? 'Update employee information and payroll settings.' : 'Create a new employee record.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card title="Personal Information">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="form-label">Employee ID *</label>
              <input
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                className={`form-input ${errors.employeeId ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.employeeId && <p className="mt-1 text-xs text-red-600">{errors.employeeId}</p>}
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="form-input"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label className="form-label">First Name *</label>
              <input
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={`form-input ${errors.firstName ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className={`form-input ${errors.lastName ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`form-input ${errors.email ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Hire Date *</label>
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => handleChange('hireDate', e.target.value)}
                className={`form-input ${errors.hireDate ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.hireDate && <p className="mt-1 text-xs text-red-600">{errors.hireDate}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                rows={2}
                className="form-input"
              />
            </div>
          </div>
        </Card>

        {/* Job Info */}
        <Card title="Job Information">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="form-label">Job Title</label>
              <input
                value={form.jobTitle}
                onChange={(e) => handleChange('jobTitle', e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Department</label>
              <select
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="form-input"
              >
                <option value="">Select department</option>
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
              <label className="form-label">Employment Type</label>
              <select
                value={form.employmentType}
                onChange={(e) => handleChange('employmentType', e.target.value)}
                className="form-input"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contractor">Contractor</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="form-label">Pay Type</label>
              <select
                value={form.payType}
                onChange={(e) => handleChange('payType', e.target.value)}
                className="form-input"
              >
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
                <option value="commission">Commission</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Payroll Settings */}
        <Card title="Payroll Settings">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="form-label">Pay Rate *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.payRate}
                  onChange={(e) => handleChange('payRate', e.target.value)}
                  className={`form-input pl-7 ${errors.payRate ? 'ring-red-300 focus:ring-red-500' : ''}`}
                />
              </div>
              {errors.payRate && <p className="mt-1 text-xs text-red-600">{errors.payRate}</p>}
            </div>
            <div>
              <label className="form-label">Pay Frequency</label>
              <select
                value={form.payFrequency}
                onChange={(e) => handleChange('payFrequency', e.target.value)}
                className="form-input"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="semimonthly">Semi-monthly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="form-label">Federal Withholding Allowances</label>
              <input
                type="number"
                value={form.withholdingFederal}
                onChange={(e) => handleChange('withholdingFederal', e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">State Withholding</label>
              <input
                value={form.withholdingState}
                onChange={(e) => handleChange('withholdingState', e.target.value)}
                className="form-input"
                placeholder="State abbreviation"
              />
            </div>
            <div>
              <label className="form-label">State Withholding Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.withholdingStateAmount}
                  onChange={(e) => handleChange('withholdingStateAmount', e.target.value)}
                  className="form-input pl-7"
                />
              </div>
            </div>
            <div>
              <label className="form-label">401(k) Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.retirement401kRate}
                onChange={(e) => handleChange('retirement401kRate', e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Health Insurance Premium</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.healthInsurancePremium}
                  onChange={(e) => handleChange('healthInsurancePremium', e.target.value)}
                  className="form-input pl-7"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate('/payroll/employees')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save size={16} className="mr-2" />
            {isEdit ? 'Update Employee' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
