import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import { ArrowLeft, Save, X } from 'lucide-react';

type ContactType = 'client' | 'vendor' | 'employee' | 'lead' | 'other';
type ContactStatus = 'active' | 'inactive' | 'prospect';

export default function ContactForm(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<ContactType>('client');
  const [status, setStatus] = useState<ContactStatus>('active');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [formError, setFormError] = useState('');

  const contactQuery = trpc.contact.getById.useQuery(
    { id: id! },
    { enabled: isEdit }
  );

  useEffect(() => {
    if (contactQuery.data) {
      const c = contactQuery.data;
      setFullName(c.fullName || '');
      setEmail(c.email || '');
      setPhone(c.phone || '');
      setType(c.type || 'client');
      setStatus(c.status || 'active');
      setCompanyName(c.companyName || '');
      setTaxId(c.taxId || '');
      setAddress(c.address || '');
      setTags(c.tags ? c.tags.join(', ') : '');
      setNotes(c.notes || '');
      setAssignedTo(c.assignedToId || '');
    }
  }, [contactQuery.data]);

  const createMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      addToast('success', 'Contact created successfully');
      navigate('/contacts');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create contact');
    },
  });

  const updateMutation = trpc.contact.update.useMutation({
    onSuccess: () => {
      addToast('success', 'Contact updated successfully');
      navigate('/contacts');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to update contact');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim() || !email.trim()) {
      setFormError('Full name and email are required');
      return;
    }
    const payload = {
      fullName,
      email,
      phone,
      type,
      status,
      companyName,
      taxId,
      address,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes,
      assignedTo: assignedTo || undefined,
    };
    if (isEdit) {
      updateMutation.mutate({ id: id!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = contactQuery.isLoading || createMutation.isLoading || updateMutation.isLoading;

  if (isEdit && contactQuery.isLoading) {
    return <Loading message="Loading contact..." />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/contacts')}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Contact' : 'New Contact'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'Update contact details' : 'Add a new contact to your CRM'}
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="card-body space-y-6">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="form-label">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="john@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="form-label">Phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                placeholder="(555) 000-0000"
              />
            </div>

            <div>
              <label htmlFor="companyName" className="form-label">Company Name</label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="form-input"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label htmlFor="type" className="form-label">Contact Type</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as ContactType)}
                className="form-input"
              >
                <option value="client">Client</option>
                <option value="vendor">Vendor</option>
                <option value="employee">Employee</option>
                <option value="lead">Lead</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="form-label">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
                className="form-input"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>

            <div>
              <label htmlFor="taxId" className="form-label">Tax ID</label>
              <input
                id="taxId"
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="form-input"
                placeholder="XX-XXXXXXX"
              />
            </div>

            <div>
              <label htmlFor="assignedTo" className="form-label">Assigned To</label>
              <input
                id="assignedTo"
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="form-input"
                placeholder="User ID"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="address" className="form-label">Address</label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="form-input"
                placeholder="123 Main St, City, State ZIP"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tags" className="form-label">Tags</label>
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="form-input"
                placeholder="tag1, tag2, tag3"
              />
              <p className="mt-1 text-xs text-gray-500">Comma-separated tags</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="form-label">Notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input min-h-[100px]"
                placeholder="Additional notes about this contact..."
              />
            </div>
          </div>
        </form>

        <div className="card-footer flex justify-between">
          <Button variant="secondary" onClick={() => navigate('/contacts')}>
            <X size={16} className="mr-1" />
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} loading={isLoading}>
            <Save size={16} className="mr-1" />
            {isEdit ? 'Update Contact' : 'Create Contact'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
