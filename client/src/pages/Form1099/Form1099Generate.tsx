import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card, Button, Table, Loading, EmptyState, addToast } from '../../components/ui/index.tsx';
import {
  ArrowLeft,
  Search,
  Plus,
  FileText,
  User,
  Calendar,
  FormInput,
} from 'lucide-react';

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

interface EligibleVendor {
  contactId: string;
  vendorName: string;
  taxId: string | null;
  totalPayments: number;
  paymentCount: number;
}

interface TaxYear {
  id: string;
  year: number;
}

interface ContactOption {
  id: string;
  name: string;
}

const formTypeOptions = [
  { value: 'NEC', label: '1099-NEC (Nonemployee Compensation)' },
  { value: 'MISC', label: '1099-MISC (Miscellaneous)' },
  { value: 'INT', label: '1099-INT (Interest)' },
  { value: 'DIV', label: '1099-DIV (Dividends)' },
  { value: 'K', label: '1099-K (Payment Card)' },
  { value: 'R', label: '1099-R (Retirement Distributions)' },
];

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

export default function Form1099Generate(): React.ReactElement {
  const navigate = useNavigate();

  // Shared tax year selection
  const [taxYearId, setTaxYearId] = useState('');

  // Eligible vendors scan
  const [hasScanned, setHasScanned] = useState(false);

  // Manual form state
  const [manualContactId, setManualContactId] = useState('');
  const [manualTaxYearId, setManualTaxYearId] = useState('');
  const [manualFormType, setManualFormType] = useState('NEC');

  // Queries
  const { data: taxYears, isLoading: taxYearsLoading } = trpc.tax.listTaxYears.useQuery();
  const { data: contacts, isLoading: contactsLoading } = trpc.contact.listContacts.useQuery({ type: 'vendor' });

  const {
    data: eligibleVendors,
    isLoading: eligibleLoading,
    refetch: refetchEligible,
  } = trpc.form1099.getEligibleVendors.useQuery(
    { taxYearId },
    { enabled: false }
  );

  // Mutations
  const utils = trpc.useUtils();
  const generateMutation = trpc.form1099.generate1099.useMutation({
    onSuccess: () => {
      addToast('success', 'Form 1099 generated successfully.');
      utils.form1099.list1099s.invalidate();
      navigate('/form1099');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to generate Form 1099.');
    },
  });

  // Handlers
  const handleScan = async () => {
    if (!taxYearId) {
      addToast('error', 'Please select a tax year first.');
      return;
    }
    setHasScanned(true);
    await refetchEligible();
  };

  const handleGenerateFromEligible = (contactId: string) => {
    if (!taxYearId) {
      addToast('error', 'Please select a tax year first.');
      return;
    }
    generateMutation.mutate({ contactId, taxYearId, formType: 'NEC' });
  };

  const handleManualGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualContactId || !manualTaxYearId || !manualFormType) {
      addToast('error', 'Please fill in all fields.');
      return;
    }
    generateMutation.mutate({
      contactId: manualContactId,
      taxYearId: manualTaxYearId,
      formType: manualFormType,
    });
  };

  const isGenerating = generateMutation.isPending;

  const eligibleRows: EligibleVendor[] = eligibleVendors ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <h1 className="text-2xl font-semibold text-gray-900">Generate Form 1099</h1>
          <p className="mt-1 text-sm text-gray-500">
            Scan for eligible vendors or manually generate a 1099 form.
          </p>
        </div>
      </div>

      {/* Tax Year Selector */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-gray-400" />
          <label className="text-sm font-medium text-gray-700">Tax Year</label>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={taxYearId}
            onChange={(e) => {
              setTaxYearId(e.target.value);
              setHasScanned(false);
            }}
          >
            <option value="">Select tax year…</option>
            {taxYearsLoading ? (
              <option disabled>Loading…</option>
            ) : (
              taxYears?.map((ty: TaxYear) => (
                <option key={ty.id} value={ty.id}>
                  {ty.year}
                </option>
              ))
            )}
          </select>
        </div>
      </Card>

      {/* Scan for Eligible Vendors */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Scan for Eligible Vendors</h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Search size={16} />}
            onClick={handleScan}
            disabled={!taxYearId || eligibleLoading || isGenerating}
          >
            {eligibleLoading ? 'Scanning…' : 'Scan'}
          </Button>
        </div>

        {hasScanned && eligibleLoading && (
          <div className="flex items-center justify-center py-10">
            <Loading />
          </div>
        )}

        {hasScanned && !eligibleLoading && eligibleRows.length === 0 && (
          <EmptyState
            icon={<FileText size={40} className="text-gray-300" />}
            title="No eligible vendors found"
            description="No vendors with $600+ payments were found for the selected tax year."
          />
        )}

        {hasScanned && !eligibleLoading && eligibleRows.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Vendor Name</Table.Head>
                <Table.Head>Tax ID</Table.Head>
                <Table.Head>Total Payments</Table.Head>
                <Table.Head>Payment Count</Table.Head>
                <Table.Head className="w-32">Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {eligibleRows.map((v) => (
                <Table.Row key={v.contactId}>
                  <Table.Cell className="font-medium text-gray-900">{v.vendorName}</Table.Cell>
                  <Table.Cell>{v.taxId || '—'}</Table.Cell>
                  <Table.Cell>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      v.totalPayments
                    )}
                  </Table.Cell>
                  <Table.Cell>{v.paymentCount}</Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus size={14} />}
                      onClick={() => handleGenerateFromEligible(v.contactId)}
                      disabled={isGenerating}
                    >
                      Generate
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>

      {/* Manual Generation */}
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <FormInput size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Manual Generation</h2>
        </div>

        <form onSubmit={handleManualGenerate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Contact */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              <User size={14} className="mr-1 inline text-gray-400" />
              Contact (Vendor)
            </label>
            <select
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={manualContactId}
              onChange={(e) => setManualContactId(e.target.value)}
            >
              <option value="">Select vendor…</option>
              {contactsLoading ? (
                <option disabled>Loading…</option>
              ) : (
                contacts?.map((c: ContactOption) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Tax Year */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              <Calendar size={14} className="mr-1 inline text-gray-400" />
              Tax Year
            </label>
            <select
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={manualTaxYearId}
              onChange={(e) => setManualTaxYearId(e.target.value)}
            >
              <option value="">Select tax year…</option>
              {taxYearsLoading ? (
                <option disabled>Loading…</option>
              ) : (
                taxYears?.map((ty: TaxYear) => (
                  <option key={ty.id} value={ty.id}>
                    {ty.year}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Form Type */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              <FileText size={14} className="mr-1 inline text-gray-400" />
              Form Type
            </label>
            <select
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={manualFormType}
              onChange={(e) => setManualFormType(e.target.value)}
            >
              {formTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              leftIcon={<Plus size={18} />}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
