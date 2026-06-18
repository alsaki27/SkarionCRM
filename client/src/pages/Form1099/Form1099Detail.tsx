import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card, Button, Badge, Modal, Loading, addToast } from '../../components/ui/index.tsx';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  RotateCcw,
  Trash2,
  Edit3,
  Save,
  X,
  FileText,
  Calendar,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

type Form1099Status = 'draft' | 'generated' | 'distributed' | 'filed' | 'corrected';

interface BoxValues {
  box1: number | string;
  box2: number | string;
  box3: number | string;
  box4: number | string;
  box5: number | string;
  box6: number | string;
  box7: number | string;
  box8: number | string;
  box9: number | string;
  box10: number | string;
  box11: number | string;
  box12: number | string;
  box13: number | string;
  box14: number | string;
  box7DirectSales: boolean;
  stateTaxWithheld1: number | string;
  state1: string;
  stateTaxWithheld2: number | string;
  state2: string;
}

const statusColors: Record<Form1099Status, string> = {
  draft: 'bg-gray-100 text-gray-700',
  generated: 'bg-blue-100 text-blue-700',
  distributed: 'bg-purple-100 text-purple-700',
  filed: 'bg-green-100 text-green-700',
  corrected: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<Form1099Status, string> = {
  draft: 'Draft',
  generated: 'Generated',
  distributed: 'Distributed',
  filed: 'Filed',
  corrected: 'Corrected',
};

const boxFields = [
  { key: 'box1', label: 'Box 1 — Rents' },
  { key: 'box2', label: 'Box 2 — Royalties' },
  { key: 'box3', label: 'Box 3 — Other Income' },
  { key: 'box4', label: 'Box 4 — Federal Income Tax Withheld' },
  { key: 'box5', label: 'Box 5 — Fishing Boat Proceeds' },
  { key: 'box6', label: 'Box 6 — Medical & Health Care Payments' },
  { key: 'box7', label: 'Box 7 — Payer Direct Sales' },
  { key: 'box8', label: 'Box 8 — Substitute Payments' },
  { key: 'box9', label: 'Box 9 — Crop Insurance' },
  { key: 'box10', label: 'Box 10 — Gross Proceeds' },
  { key: 'box11', label: 'Box 11 — Fish Purchased' },
  { key: 'box12', label: 'Box 12 — Section 409A Deferrals' },
  { key: 'box13', label: 'Box 13 — Excess Golden Parachute' },
  { key: 'box14', label: 'Box 14 — Nonqualified Deferred Compensation' },
];

function toNum(v: number | string): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isNaN(n) ? undefined : n;
}

function fromNum(v: number | null | undefined): number | string {
  return v == null ? '' : v;
}

function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

export default function Form1099Detail(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const openCorrect = searchParams.get('correct') === '1';

  const [isEditing, setIsEditing] = useState(false);
  const [correctModalOpen, setCorrectModalOpen] = useState(openCorrect);
  const [correctedBoxes, setCorrectedBoxes] = useState<Record<string, number | string>>({});

  // Queries
  const { data, isLoading } = trpc.form1099.get1099ById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  // Local editable state
  const [editValues, setEditValues] = useState<BoxValues>({
    box1: '', box2: '', box3: '', box4: '', box5: '', box6: '', box7: '', box8: '',
    box9: '', box10: '', box11: '', box12: '', box13: '', box14: '',
    box7DirectSales: false,
    stateTaxWithheld1: '', state1: '', stateTaxWithheld2: '', state2: '',
  });

  useEffect(() => {
    if (data) {
      setEditValues({
        box1: fromNum(data.box1),
        box2: fromNum(data.box2),
        box3: fromNum(data.box3),
        box4: fromNum(data.box4),
        box5: fromNum(data.box5),
        box6: fromNum(data.box6),
        box7: fromNum(data.box7),
        box8: fromNum(data.box8),
        box9: fromNum(data.box9),
        box10: fromNum(data.box10),
        box11: fromNum(data.box11),
        box12: fromNum(data.box12),
        box13: fromNum(data.box13),
        box14: fromNum(data.box14),
        box7DirectSales: !!data.box7DirectSales,
        stateTaxWithheld1: fromNum(data.stateTaxWithheld1),
        state1: data.state1 ?? '',
        stateTaxWithheld2: fromNum(data.stateTaxWithheld2),
        state2: data.state2 ?? '',
      });
    }
  }, [data]);

  // Mutations
  const utils = trpc.useUtils();

  const updateMutation = trpc.form1099.update1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 updated.');
      setIsEditing(false);
      utils.form1099.get1099ById.invalidate({ id: id! });
      utils.form1099.list1099s.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update form.');
    },
  });

  const distributeMutation = trpc.form1099.distribute1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 distributed.');
      utils.form1099.get1099ById.invalidate({ id: id! });
      utils.form1099.list1099s.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to distribute form.');
    },
  });

  const fileMutation = trpc.form1099.file1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 filed with IRS.');
      utils.form1099.get1099ById.invalidate({ id: id! });
      utils.form1099.list1099s.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to file form.');
    },
  });

  const correctMutation = trpc.form1099.correct1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Corrected Form 1099 created.');
      setCorrectModalOpen(false);
      setCorrectedBoxes({});
      utils.form1099.get1099ById.invalidate({ id: id! });
      utils.form1099.list1099s.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to correct form.');
    },
  });

  const deleteMutation = trpc.form1099.delete1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 deleted.');
      navigate('/form1099');
      utils.form1099.list1099s.invalidate();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete form.');
    },
  });

  const status = (data?.status as Form1099Status) ?? 'draft';
  const isMutating =
    updateMutation.isPending ||
    distributeMutation.isPending ||
    fileMutation.isPending ||
    correctMutation.isPending ||
    deleteMutation.isPending;

  // Handlers
  const handleSave = () => {
    updateMutation.mutate({
      id: id!,
      box1: toNum(editValues.box1),
      box2: toNum(editValues.box2),
      box3: toNum(editValues.box3),
      box4: toNum(editValues.box4),
      box5: toNum(editValues.box5),
      box6: toNum(editValues.box6),
      box7: toNum(editValues.box7),
      box8: toNum(editValues.box8),
      box9: toNum(editValues.box9),
      box10: toNum(editValues.box10),
      box11: toNum(editValues.box11),
      box12: toNum(editValues.box12),
      box13: toNum(editValues.box13),
      box14: toNum(editValues.box14),
      box7DirectSales: editValues.box7DirectSales,
      stateTaxWithheld1: toNum(editValues.stateTaxWithheld1),
      state1: editValues.state1 || undefined,
      stateTaxWithheld2: toNum(editValues.stateTaxWithheld2),
      state2: editValues.state2 || undefined,
    });
  };

  const handleDistribute = () => {
    if (window.confirm('Distribute this Form 1099 to the recipient?')) {
      distributeMutation.mutate({ id: id! });
    }
  };

  const handleFile = () => {
    if (window.confirm('File this Form 1099 with the IRS?')) {
      fileMutation.mutate({ id: id! });
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this Form 1099? This action cannot be undone.')) {
      deleteMutation.mutate({ id: id! });
    }
  };

  const handleCorrectBoxChange = (key: string, value: number | string) => {
    setCorrectedBoxes((prev) => ({ ...prev, [key]: value }));
  };

  const handleCorrectSubmit = () => {
    const payload: Record<string, number> = {};
    Object.entries(correctedBoxes).forEach(([k, v]) => {
      const n = toNum(v);
      if (n !== undefined) payload[k] = n;
    });
    if (Object.keys(payload).length === 0) {
      addToast('error', 'Select at least one box to correct.');
      return;
    }
    correctMutation.mutate({ id: id!, correctedBoxes: payload });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-10 text-center">
        <FileText size={48} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Form 1099 not found</h2>
        <p className="mt-1 text-sm text-gray-500">The requested form does not exist or has been deleted.</p>
        <Button variant="secondary" className="mt-4" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/form1099')}>
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={18} />}
            onClick={() => navigate('/form1099')}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {data.contact?.name || 'Unknown Vendor'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <Calendar size={14} className="text-gray-400" />
              <span>Tax Year {data.taxYear?.year ?? data.taxYear}</span>
              <span className="text-gray-300">|</span>
              <FileText size={14} className="text-gray-400" />
              <span>1099-{data.formType}</span>
              <span className="text-gray-300">|</span>
              <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save size={16} />}
                onClick={handleSave}
                disabled={isMutating}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<X size={16} />}
                onClick={() => setIsEditing(false)}
                disabled={isMutating}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {(status === 'draft' || status === 'generated') && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit3 size={16} />}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              )}

              {(status === 'draft' || status === 'generated') && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send size={16} />}
                  onClick={handleDistribute}
                  disabled={isMutating}
                >
                  Distribute
                </Button>
              )}

              {status === 'distributed' && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle size={16} />}
                  onClick={handleFile}
                  disabled={isMutating}
                >
                  File IRS
                </Button>
              )}

              {(status === 'distributed' || status === 'filed') && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={() => setCorrectModalOpen(true)}
                  disabled={isMutating}
                >
                  Correct
                </Button>
              )}

              {status === 'draft' && (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 size={16} />}
                  onClick={handleDelete}
                  disabled={isMutating}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Corrected From Info */}
      {data.corrected1099 && (
        <Card className="border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 text-orange-600" />
            <div>
              <div className="font-medium text-orange-900">Corrected Form</div>
              <p className="mt-1 text-sm text-orange-800">
                This form corrects a previously filed/distributed 1099. Original form:
                <span className="font-medium"> {data.corrected1099.vendorName || data.corrected1099.contact?.name || 'Unknown'}</span>
                {' '}— Tax Year {data.corrected1099.taxYear?.year ?? data.corrected1099.taxYear}.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Box Values Grid */}
      <Card className="p-4">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <DollarSign size={18} className="text-blue-600" />
          Box Values
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boxFields.map((field) => {
            const rawValue = (data as any)[field.key];
            const editValue = (editValues as any)[field.key];
            return (
              <div key={field.key} className="rounded-md border border-gray-200 p-3">
                <label className="block text-xs font-medium text-gray-500">{field.label}</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValue}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium text-gray-900">
                    {formatCurrency(rawValue)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Box 7 Direct Sales checkbox */}
          <div className="rounded-md border border-gray-200 p-3">
            <label className="block text-xs font-medium text-gray-500">
              Box 7 — Checkbox (Direct Sales)
            </label>
            {isEditing ? (
              <label className="mt-1 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={editValues.box7DirectSales}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, box7DirectSales: e.target.checked }))
                  }
                />
                <span className="text-sm text-gray-700">Payer made direct sales of $5,000+</span>
              </label>
            ) : (
              <div className="mt-1 text-sm font-medium text-gray-900">
                {data.box7DirectSales ? 'Yes' : 'No'}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* State Taxes */}
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">State Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="text-sm font-medium text-gray-700">State 1</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    maxLength={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm uppercase text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValues.state1}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, state1: e.target.value.toUpperCase() }))
                    }
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium text-gray-900">{data.state1 || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">State Tax Withheld</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValues.stateTaxWithheld1}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, stateTaxWithheld1: e.target.value }))
                    }
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium text-gray-900">
                    {formatCurrency(data.stateTaxWithheld1)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="text-sm font-medium text-gray-700">State 2</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    maxLength={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm uppercase text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValues.state2}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, state2: e.target.value.toUpperCase() }))
                    }
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium text-gray-900">{data.state2 || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">State Tax Withheld</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValues.stateTaxWithheld2}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, stateTaxWithheld2: e.target.value }))
                    }
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium text-gray-900">
                    {formatCurrency(data.stateTaxWithheld2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Metadata */}
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Timeline</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 p-2">
              <Clock size={16} className="text-gray-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Generated</div>
              <div className="text-sm font-medium text-gray-900">{formatDate(data.createdAt)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Send size={16} className="text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Distributed</div>
              <div className="text-sm font-medium text-gray-900">
                {formatDate(data.distributedAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Filed with IRS</div>
              <div className="text-sm font-medium text-gray-900">{formatDate(data.filedAt)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <User size={16} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Updated</div>
              <div className="text-sm font-medium text-gray-900">{formatDate(data.updatedAt)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Correct Modal */}
      <Modal
        open={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Correct Form 1099"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter corrected values for the boxes that need to be changed. Only boxes with new values will be included in the correction.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {boxFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs text-gray-500">{field.label}</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={String((data as any)[field.key] ?? '')}
                  value={correctedBoxes[field.key] ?? ''}
                  onChange={(e) => handleCorrectBoxChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setCorrectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RotateCcw size={16} />}
              onClick={handleCorrectSubmit}
              disabled={correctMutation.isPending}
            >
              {correctMutation.isPending ? 'Correcting…' : 'Create Correction'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
