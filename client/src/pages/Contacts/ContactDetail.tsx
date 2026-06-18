import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../api.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Tag,
  FileText,
  MessageSquare,
  CheckSquare,
  Send,
  Pencil,
  Calendar,
  User,
} from 'lucide-react';

type Tab = 'profile' | 'communications' | 'tasks' | 'documents';

export default function ContactDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [commMessage, setCommMessage] = useState('');
  const [commType, setCommType] = useState('email');

  const contactQuery = trpc.contact.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const addCommMutation = trpc.contact.addCommunication.useMutation({
    onSuccess: () => {
      addToast('success', 'Communication logged');
      setCommMessage('');
      contactQuery.refetch();
    },
    onError: (err) => addToast('error', err.message),
  });

  const handleAddCommunication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commMessage.trim()) return;
    addCommMutation.mutate({
      contactId: id!,
      type: commType,
      content: commMessage,
    });
  };

  const contact = contactQuery.data;

  if (contactQuery.isLoading) {
    return <Loading message="Loading contact..." />;
  }

  if (contactQuery.isError || !contact) {
    return (
      <div className="py-12">
        <EmptyState
          icon={FileText}
          title="Contact not found"
          description="The contact you're looking for doesn't exist or was removed."
          actionLabel="Back to Contacts"
          onAction={() => navigate('/contacts')}
        />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="green">Active</Badge>;
      case 'inactive': return <Badge variant="gray">Inactive</Badge>;
      case 'prospect': return <Badge variant="blue">Prospect</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'communications', label: 'Communications', icon: <MessageSquare size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/contacts')}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{contact.fullName}</h1>
            <div className="mt-1 flex items-center gap-2">
              {getStatusBadge(contact.status)}
              <Badge variant="blue">{contact.type}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(`/contacts/${id}/edit`)}>
            <Pencil size={16} className="mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ' +
                (activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700')
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Contact Information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{contact.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{contact.phone || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Company</p>
                    <p className="text-sm font-medium text-gray-900">{contact.companyName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm font-medium text-gray-900">{contact.address || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tag size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Tax ID</p>
                    <p className="text-sm font-medium text-gray-900">{contact.taxId || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Assigned To</p>
                    <p className="text-sm font-medium text-gray-900">{contact.assignedTo?.fullName || '—'}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Notes">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {contact.notes || 'No notes added yet.'}
              </p>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Tags">
              <div className="flex flex-wrap gap-2">
                {contact.tags && contact.tags.length > 0 ? (
                  contact.tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="gray">{tag}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No tags</p>
                )}
              </div>
            </Card>

            <Card title="Quick Info">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium text-gray-900">
                    {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span className="font-medium text-gray-900">
                    {contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Communications Tab */}
      {activeTab === 'communications' && (
        <div className="space-y-6">
          <Card title="Log Communication">
            <form onSubmit={handleAddCommunication} className="space-y-4">
              <div>
                <label className="form-label">Type</label>
                <select
                  value={commType}
                  onChange={(e) => setCommType(e.target.value)}
                  className="form-input"
                >
                  <option value="email">Email</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div>
                <label className="form-label">Message</label>
                <textarea
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                  className="form-input min-h-[100px]"
                  placeholder="Enter communication details..."
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={addCommMutation.isLoading}>
                  <Send size={16} className="mr-1" />
                  Log Communication
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Communication History">
            {contact.communications && contact.communications.length > 0 ? (
              <div className="space-y-4">
                {contact.communications.map((comm: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 rounded-lg border border-gray-100 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <MessageSquare size={14} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 capitalize">{comm.type}</p>
                        <span className="text-xs text-gray-400">
                          {comm.createdAt ? new Date(comm.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{comm.content}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        by {comm.createdBy?.fullName || 'System'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No communications yet"
                description="Log your first communication above."
              />
            )}
          </Card>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <Card title="Related Tasks">
          {contact.tasks && contact.tasks.length > 0 ? (
            <div className="space-y-3">
              {contact.tasks.map((task: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <CheckSquare size={18} className={task.completed ? 'text-green-500' : 'text-gray-400'} />
                    <div>
                      <p className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-500">Due {task.dueDate || '—'}</p>
                    </div>
                  </div>
                  <Badge variant={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'blue'}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckSquare}
              title="No tasks"
              description="No tasks are linked to this contact."
              actionLabel="Create Task"
              onAction={() => navigate('/tasks')}
            />
          )}
        </Card>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <Card title="Documents">
          {contact.documents && contact.documents.length > 0 ? (
            <div className="space-y-3">
              {contact.documents.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.type} · {doc.size}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents"
              description="No documents attached to this contact."
            />
          )}
        </Card>
      )}
    </div>
  );
}
