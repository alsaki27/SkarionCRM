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
  Check,
  ChevronRight,
  Users,
  Wand2,
  Loader2,
} from 'lucide-react';

type Step = 'year' | 'select' | 'review';

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
}

export default function W2Generate(): React.ReactElement {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState<Step>('year');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

  const employeesQuery = trpc.employee.list.useQuery({
    status: 'active',
    pageSize: 1000,
  });

  const generateMutation = trpc.w2.generateW2.useMutation();

  const employees: EmployeeOption[] = employeesQuery.data?.employees ?? [];
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map((e) => e.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const ids = Array.from(selectedEmployees);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const employeeId of ids) {
      try {
        await generateMutation.mutateAsync({ employeeId, year: selectedYear });
        success++;
      } catch (err: any) {
        failed++;
        const emp = employees.find((e) => e.id === employeeId);
        errors.push(`${emp?.firstName} ${emp?.lastName}: ${err.message || 'Failed'}`);
      }
    }

    setResults({ success, failed, errors });
    setGenerating(false);
    setStep('review');
  };

  const stepConfig: Record<Step, { number: number; title: string; description: string }> = {
    year: { number: 1, title: 'Select Tax Year', description: 'Choose the tax year for W2 generation' },
    select: { number: 2, title: 'Select Employees', description: 'Choose which employees to generate W2s for' },
    review: { number: 3, title: 'Review & Generate', description: 'Review and confirm W2 generation' },
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/w2/dashboard')}>
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="page-title">Generate W2 Forms</h1>
        <p className="page-subtitle">Create W2 forms for your employees</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {(['year', 'select', 'review'] as Step[]).map((s, index) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step === s
                    ? 'bg-primary-600 text-white'
                    : index < (['year', 'select', 'review'] as Step[]).indexOf(step)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {index < (['year', 'select', 'review'] as Step[]).indexOf(step) ? (
                  <Check size={16} />
                ) : (
                  stepConfig[s].number
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  step === s ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {stepConfig[s].title}
              </span>
            </div>
            {index < 2 && <ChevronRight size={16} className="text-gray-300" />}
          </React.Fragment>
        ))}
      </div>

      {step === 'year' && (
        <Card title={stepConfig.year.title}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">{stepConfig.year.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`flex items-center justify-center rounded-lg border-2 p-4 text-center transition-colors ${
                    selectedYear === year
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg font-semibold">{year}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep('select')}>
                Continue
                <ChevronRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'select' && (
        <Card title={stepConfig.select.title}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">{stepConfig.select.description}</p>

            {employeesQuery.isLoading ? (
              <Loading message="Loading employees..." />
            ) : employees.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No active employees found</div>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select all ({employees.length} employees)
                  </span>
                  <span className="ml-auto text-sm text-gray-500">
                    {selectedEmployees.size} selected
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.has(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-gray-500">{emp.employeeId}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep('year')}>
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={selectedEmployees.size === 0}
              >
                Continue
                <ChevronRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'review' && (
        <Card title={stepConfig.review.title}>
          <div className="p-6 space-y-4">
            {!generating && results.success === 0 && results.failed === 0 ? (
              <>
                <p className="text-sm text-gray-500">{stepConfig.review.description}</p>
                <div className="rounded-lg bg-gray-50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax Year</span>
                    <span className="font-medium text-gray-900">{selectedYear}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Employees Selected</span>
                    <span className="font-medium text-gray-900">{selectedEmployees.size}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="secondary" onClick={() => setStep('select')}>
                    Back
                  </Button>
                  <Button onClick={handleGenerate} loading={generating}>
                    <Wand2 size={16} className="mr-2" />
                    Generate W2s
                  </Button>
                </div>
              </>
            ) : generating ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="mx-auto mb-4 animate-spin text-primary-600" />
                <p className="text-sm font-medium text-gray-700">Generating W2 forms...</p>
                <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Generation Complete</p>
                    <p className="text-sm text-gray-500">
                      {results.success} succeeded, {results.failed} failed
                    </p>
                  </div>
                </div>

                {results.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                    <ul className="space-y-1">
                      {results.errors.map((err, i) => (
                        <li key={i} className="text-sm text-red-700">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => navigate('/w2/list')}>
                    View W2 List
                  </Button>
                  <Button onClick={() => navigate('/w2/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
