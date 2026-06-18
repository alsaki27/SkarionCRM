import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Loading } from '../components/ui/Loading.tsx';
import { addToast } from '../components/ui/Toast.tsx';
import {
  Building2,
  BookOpen,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Landmark,
  UserPlus,
} from 'lucide-react';

type Step = 'organization' | 'accounts' | 'contact';

export default function Setup(): React.ReactElement {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('organization');
  const [orgData, setOrgData] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    taxId: '',
    fiscalYearEnd: '12-31',
  });
  const [accountsData, setAccountsData] = useState({
    createDefault: true,
    customize: false,
  });
  const [contactData, setContactData] = useState({
    fullName: '',
    email: '',
    phone: '',
    type: 'client',
  });

  const updateOrg = trpc.organization.update.useMutation({
    onSuccess: () => addToast('success', 'Organization details saved'),
    onError: (err) => addToast('error', err.message),
  });

  const createAccounts = trpc.financial.createDefaultAccounts.useMutation({
    onSuccess: () => addToast('success', 'Chart of accounts created'),
    onError: (err) => addToast('error', err.message),
  });

  const createContact = trpc.contact.create.useMutation({
    onSuccess: () => addToast('success', 'First contact added'),
    onError: (err) => addToast('error', err.message),
  });

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'organization', label: 'Organization', icon: <Building2 size={18} /> },
    { id: 'accounts', label: 'Chart of Accounts', icon: <BookOpen size={18} /> },
    { id: 'contact', label: 'First Contact', icon: <UserPlus size={18} /> },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);

  const handleNext = async () => {
    if (step === 'organization') {
      await updateOrg.mutateAsync(orgData);
      setStep('accounts');
    } else if (step === 'accounts') {
      if (accountsData.createDefault) {
        await createAccounts.mutateAsync();
      }
      setStep('contact');
    } else if (step === 'contact') {
      if (contactData.fullName.trim() && contactData.email.trim()) {
        await createContact.mutateAsync(contactData);
      }
      addToast('success', 'Setup complete! Welcome to Skarion.');
      navigate('/');
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1].id);
    }
  };

  const isLoading = updateOrg.isLoading || createAccounts.isLoading || createContact.isLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Landmark size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Let's set up your business</h1>
          <p className="mt-2 text-sm text-gray-500">A few quick steps to get you started</p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ' +
                      (index <= currentIndex
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300 bg-white text-gray-400')
                    }
                  >
                    {index < currentIndex ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      s.icon
                    )}
                  </div>
                  <span
                    className={
                      'mt-2 text-xs font-medium ' +
                      (index <= currentIndex ? 'text-primary-700' : 'text-gray-400')
                    }
                  >
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={
                      'mx-2 h-0.5 flex-1 ' +
                      (index < currentIndex ? 'bg-primary-600' : 'bg-gray-200')
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card>
          {isLoading && (
            <div className="card-body">
              <Loading message="Saving..." />
            </div>
          )}

          {!isLoading && step === 'organization' && (
            <div className="card-body space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Organization details</h2>
              <p className="text-sm text-gray-500">Tell us about your business</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    value={orgData.address}
                    onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                    className="form-input"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={orgData.city}
                    onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                    className="form-input"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    value={orgData.state}
                    onChange={(e) => setOrgData({ ...orgData, state: e.target.value })}
                    className="form-input"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="form-label">ZIP</label>
                  <input
                    type="text"
                    value={orgData.zip}
                    onChange={(e) => setOrgData({ ...orgData, zip: e.target.value })}
                    className="form-input"
                    placeholder="00000"
                  />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    value={orgData.phone}
                    onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                    className="form-input"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div>
                  <label className="form-label">Tax ID (EIN)</label>
                  <input
                    type="text"
                    value={orgData.taxId}
                    onChange={(e) => setOrgData({ ...orgData, taxId: e.target.value })}
                    className="form-input"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Fiscal year end</label>
                  <input
                    type="text"
                    value={orgData.fiscalYearEnd}
                    onChange={(e) => setOrgData({ ...orgData, fiscalYearEnd: e.target.value })}
                    className="form-input"
                    placeholder="MM-DD"
                  />
                </div>
              </div>
            </div>
          )}

          {!isLoading && step === 'accounts' && (
            <div className="card-body space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Chart of Accounts</h2>
              <p className="text-sm text-gray-500">Set up your accounting structure</p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={accountsData.createDefault}
                    onChange={() => setAccountsData({ createDefault: true, customize: false })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Create default accounts</p>
                    <p className="text-sm text-gray-500">We'll create a standard chart of accounts for your business type</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={!accountsData.createDefault}
                    onChange={() => setAccountsData({ createDefault: false, customize: true })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Customize later</p>
                    <p className="text-sm text-gray-500">Skip this step and set up accounts manually from the Financial section</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {!isLoading && step === 'contact' && (
            <div className="card-body space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Add your first contact</h2>
              <p className="text-sm text-gray-500">This could be a client, vendor, or employee</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    value={contactData.fullName}
                    onChange={(e) => setContactData({ ...contactData, fullName: e.target.value })}
                    className="form-input"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    className="form-input"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    value={contactData.phone}
                    onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                    className="form-input"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Contact type</label>
                  <select
                    value={contactData.type}
                    onChange={(e) => setContactData({ ...contactData, type: e.target.value })}
                    className="form-input"
                  >
                    <option value="client">Client</option>
                    <option value="vendor">Vendor</option>
                    <option value="employee">Employee</option>
                    <option value="lead">Lead</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="card-footer flex justify-between">
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={currentIndex === 0 || isLoading}
            >
              <ChevronLeft size={16} className="mr-1" />
              Back
            </Button>
            <Button variant="primary" onClick={handleNext} loading={isLoading}>
              {step === 'contact' ? 'Finish' : 'Next'}
              {step !== 'contact' && <ChevronRight size={16} className="ml-1" />}
            </Button>
          </div>
        </Card>

        <p className="mt-6 text-center text-sm text-gray-500">
          You can complete or change these settings anytime from the Settings page.
        </p>
      </div>
    </div>
  );
}
