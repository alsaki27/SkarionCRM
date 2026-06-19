import React, { useState, useEffect } from 'react';
import { trpc } from '../../api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  Save,
  Building2,
  Check,
} from 'lucide-react';

interface OrgFormData {
  name: string;
  taxId: string;
  businessType: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  fiscalYearEnd: string;
  timezone: string;
  currency: string;
}

const emptyForm: OrgFormData = {
  name: '',
  taxId: '',
  businessType: '',
  industry: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  fiscalYearEnd: '12-31',
  timezone: 'America/New_York',
  currency: 'USD',
};

export default function Organization(): React.ReactElement {
  const [form, setForm] = useState<OrgFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof OrgFormData, string>>>({});
  const [saved, setSaved] = useState(false);

  const query = trpc.org.getCurrent.useQuery();
  const updateMutation = trpc.org.update.useMutation({
    onSuccess: () => {
      addToast('success', 'Organization settings saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to save settings');
    },
  });

  useEffect(() => {
    if (query.data) {
      const d = query.data;
      setForm({
        name: d.name ?? '',
        taxId: d.taxId ?? '',
        businessType: d.businessType ?? '',
        industry: d.industry ?? '',
        address: d.address ?? '',
        phone: d.phone ?? '',
        email: d.email ?? '',
        website: d.website ?? '',
        fiscalYearEnd: d.fiscalYearEnd ?? '12-31',
        timezone: d.timezone ?? 'America/New_York',
        currency: d.currency ?? 'USD',
      });
    }
  }, [query.data]);

  const handleChange = (field: keyof OrgFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrgFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Organization name is required';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    updateMutation.mutate(form);
  };

  if (query.isLoading) return <Loading message="Loading organization settings..." />;
  if (query.isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600 mb-3">Failed to load settings</p>
        <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Organization Settings</h1>
        <p className="page-subtitle">Manage your organization profile and preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Organization Profile">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">Organization Name *</label>
              <input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`form-input ${errors.name ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label className="form-label">Tax ID / EIN</label>
              <input
                value={form.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                className="form-input"
                placeholder="XX-XXXXXXX"
              />
            </div>
            <div>
              <label className="form-label">Business Type</label>
              <select
                value={form.businessType}
                onChange={(e) => handleChange('businessType', e.target.value)}
                className="form-input"
              >
                <option value="">Select type</option>
                <option value="sole_proprietorship">Sole Proprietorship</option>
                <option value="partnership">Partnership</option>
                <option value="llc">LLC</option>
                <option value="s_corporation">S Corporation</option>
                <option value="c_corporation">C Corporation</option>
                <option value="nonprofit">Nonprofit</option>
              </select>
            </div>
            <div>
              <label className="form-label">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                className="form-input"
                placeholder="e.g., Technology, Healthcare"
              />
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
              <label className="form-label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`form-input ${errors.email ? 'ring-red-300 focus:ring-red-500' : ''}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className="form-input"
                placeholder="https://..."
              />
            </div>
          </div>
        </Card>

        <Card title="Preferences">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="form-label">Fiscal Year End</label>
              <select
                value={form.fiscalYearEnd}
                onChange={(e) => handleChange('fiscalYearEnd', e.target.value)}
                className="form-input"
              >
                <option value="12-31">December 31</option>
                <option value="01-31">January 31</option>
                <option value="03-31">March 31</option>
                <option value="06-30">June 30</option>
                <option value="09-30">September 30</option>
              </select>
            </div>
            <div>
              <label className="form-label">Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="form-input"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
              </select>
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="form-input"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check size={16} />
              Saved successfully
            </div>
          )}
          <Button type="submit" loading={updateMutation.isPending}>
            <Save size={16} className="mr-2" />
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
