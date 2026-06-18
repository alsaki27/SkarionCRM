import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Trash2,
  Calculator,
} from 'lucide-react';

interface EntryForm {
  employeeId: string;
  regularHours: string;
  overtimeHours: string;
  grossPay: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  payRate: number;
  payType: string;
}

export default function PayrollRunForm(): React.ReactElement {
  const navigate = useNavigate();
  const [step, setStep] = useState<'create' | 'entries'>('create');
  const [runId, setRunId] = useState<string>('');
  const [runName, setRunName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [payDate, setPayDate] = useState('');
  const [entries, setEntries] = useState<EntryForm[]>([]);
  const [runErrors, setRunErrors] = useState<Partial<Record<string, string>>>({});

  const employeesQuery = trpc.employee.list.useQuery({
    status: 'active',
    pageSize: 1000,
  });

  const createRunMutation = trpc.payroll.createRun.useMutation({
    onSuccess: (data) => {
      addToast('success', 'Payroll run created');
      setRunId(data.id);
      setStep('entries');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create run');
    },
  });

  const addEntryMutation = trpc.payroll.addEntry.useMutation({
    onSuccess: () => {
      addToast('success', 'Entry added');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to add entry');
    },
  });

  const processMutation = trpc.payroll.processRun.useMutation({
    onSuccess: () => {
      addToast('success', 'Payroll run processed successfully');
      navigate('/payroll/runs');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to process run');
    },
  });

  const activeEmployees: EmployeeOption[] = employeesQuery.data?.employees ?? [];

  const validateRun = (): boolean => {
    const errors: Partial<Record<string, string>> = {};
    if (!runName.trim()) errors.runName = 'Run name is required';
    if (!periodStart) errors.periodStart = 'Start date is required';
    if (!periodEnd) errors.periodEnd = 'End date is required';
    if (!payDate) errors.payDate = 'Pay date is required';
    if (periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)) {
      errors.periodEnd = 'End date must be after start date';
    }
    setRunErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRun()) return;
    createRunMutation.mutate({
      runName,
      periodStart,
      periodEnd,
      payDate,
    });
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { employeeId: '', regularHours: '40', overtimeHours: '0', grossPay: '' }]);
  };

  const updateEntry = (index: number, field: keyof EntryForm, value: string) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const autoCalculateGross = (index: number) => {
    const entry = entries[index];
    const emp = activeEmployees.find((e) => e.id === entry.employeeId);
    if (!emp) return;
    const regular = Number(entry.regularHours) || 0;
    const overtime = Number(entry.overtimeHours) || 0;
    let gross = 0;
    if (emp.payType === 'hourly') {
      gross = regular * emp.payRate + overtime * emp.payRate * 1.5;
    } else {
      gross = emp.payRate;
    }
    updateEntry(index, 'grossPay', gross.toFixed(2));
  };

  const saveAllEntries = async () => {
    for (const entry of entries) {
      if (!entry.employeeId || !entry.grossPay) continue;
      await addEntryMutation.mutateAsync({
        runId,
        employeeId: entry.employeeId,
        regularHours: Number(entry.regularHours),
        overtimeHours: Number(entry.overtimeHours),
        grossPay: Number(entry.grossPay),
      });
    }
    addToast('success', 'All entries saved');
  };

  const handleProcess = () => {
    if (!confirm('Process this payroll run? This will finalize payments.')) return;
    processMutation.mutate({ id: runId });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll/runs')}>
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="page-title">New Payroll Run</h1>
        <p className="page-subtitle">
          {step === 'create' ? 'Set up the payroll period details.' : 'Add employee entries and process the run.'}
        </p>
      </div>

      {step === 'create' && (
        <form onSubmit={handleCreateRun} className="space-y-6">
          <Card title="Payroll Period Details">
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="form-label">Run Name *</label>
                <input
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="e.g., Bi-weekly Payroll - June 2024"
                  className={`form-input ${runErrors.runName ? 'ring-red-300 focus:ring-red-500' : ''}`}
                />
                {runErrors.runName && <p className="mt-1 text-xs text-red-600">{runErrors.runName}</p>}
              </div>
              <div>
                <label className="form-label">Period Start *</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className={`form-input ${runErrors.periodStart ? 'ring-red-300 focus:ring-red-500' : ''}`}
                />
                {runErrors.periodStart && <p className="mt-1 text-xs text-red-600">{runErrors.periodStart}</p>}
              </div>
              <div>
                <label className="form-label">Period End *</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={`form-input ${runErrors.periodEnd ? 'ring-red-300 focus:ring-red-500' : ''}`}
                />
                {runErrors.periodEnd && <p className="mt-1 text-xs text-red-600">{runErrors.periodEnd}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Pay Date *</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className={`form-input ${runErrors.payDate ? 'ring-red-300 focus:ring-red-500' : ''}`}
                />
                {runErrors.payDate && <p className="mt-1 text-xs text-red-600">{runErrors.payDate}</p>}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => navigate('/payroll/runs')}>
              Cancel
            </Button>
            <Button type="submit" loading={createRunMutation.isLoading}>
              <Save size={16} className="mr-2" />
              Create Run & Add Entries
            </Button>
          </div>
        </form>
      )}

      {step === 'entries' && (
        <div className="space-y-6">
          <Card title="Payroll Summary">
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <p className="text-sm text-gray-500">Run Name</p>
                <p className="font-medium text-gray-900">{runName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="font-medium text-gray-900">{new Date(periodStart).toLocaleDateString()} - {new Date(periodEnd).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pay Date</p>
                <p className="font-medium text-gray-900">{new Date(payDate).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Employee Entries</h2>
            <Button size="sm" onClick={addEntry}>
              <Plus size={16} className="mr-2" />
              Add Entry
            </Button>
          </div>

          {employeesQuery.isLoading && <Loading message="Loading employees..." />}

          <div className="space-y-4">
            {entries.map((entry, index) => (
              <Card key={index}>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Entry #{index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeEntry(index)}>
                      <Trash2 size={16} className="text-red-500" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-5">
                    <div className="sm:col-span-2">
                      <label className="form-label">Employee</label>
                      <select
                        value={entry.employeeId}
                        onChange={(e) => updateEntry(index, 'employeeId', e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select employee</option>
                        {activeEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName} ({emp.employeeId}) - ${emp.payRate}/{emp.payType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Regular Hours</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.regularHours}
                        onChange={(e) => updateEntry(index, 'regularHours', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Overtime Hours</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.overtimeHours}
                        onChange={(e) => updateEntry(index, 'overtimeHours', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Gross Pay</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={entry.grossPay}
                            onChange={(e) => updateEntry(index, 'grossPay', e.target.value)}
                            className="form-input pl-7"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => autoCalculateGross(index)}
                          title="Auto-calculate"
                        >
                          <Calculator size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {entries.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                No entries yet. Click "Add Entry" to add employees to this payroll run.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/payroll/runs')}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={saveAllEntries}
              loading={addEntryMutation.isLoading}
              disabled={entries.length === 0}
            >
              <Save size={16} className="mr-2" />
              Save Entries
            </Button>
            <Button
              onClick={handleProcess}
              loading={processMutation.isLoading}
              disabled={entries.length === 0}
            >
              <Play size={16} className="mr-2" />
              Process Run
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
