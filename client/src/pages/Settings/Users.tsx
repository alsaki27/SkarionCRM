import React, { useState } from 'react';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { addToast } from '../../components/ui/Toast';
import {
  Plus,
  Users,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Clock,
  Search,
  X,
} from 'lucide-react';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  lastLoginAt: string | null;
}

export default function Users(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const query = trpc.org.listUsers.useQuery({ search: searchQuery });
  const users: User[] = query.data?.users ?? [];

  const inviteMutation = trpc.org.inviteUser.useMutation({
    onSuccess: () => {
      addToast('success', 'Invitation sent');
      setShowInviteModal(false);
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to invite user');
    },
  });

  const deactivateMutation = trpc.org.deactivateUser.useMutation({
    onSuccess: () => {
      addToast('success', 'User deactivated');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to deactivate user');
    },
  });

  const getRoleBadge = (role: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'; label: string }> = {
      admin: { variant: 'red', label: 'Admin' },
      manager: { variant: 'purple', label: 'Manager' },
      user: { variant: 'blue', label: 'User' },
      viewer: { variant: 'gray', label: 'Viewer' },
    };
    const config = map[role] || { variant: 'gray', label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
      active: { variant: 'green', label: 'Active' },
      inactive: { variant: 'gray', label: 'Inactive' },
      pending: { variant: 'yellow', label: 'Pending' },
    };
    const config = map[status] || { variant: 'gray', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDeactivate = (id: string) => {
    if (!confirm('Deactivate this user? They will lose access to the system.')) return;
    deactivateMutation.mutate({ id });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage team members and access</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus size={16} className="mr-2" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        </div>
      </Card>

      {/* Table */}
      <Card>
        {query.isLoading && !users.length ? (
          <Loading message="Loading users..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load users</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description={searchQuery ? 'Try a different search.' : 'Invite your first team member.'}
            actionLabel={searchQuery ? undefined : 'Invite User'}
            onAction={searchQuery ? undefined : () => setShowInviteModal(true)}
          />
        ) : (
          <Table<User>
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {row.fullName?.[0] || row.email[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{row.fullName || 'Unnamed'}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'email',
                header: 'Email',
                render: (row) => <span className="text-sm text-gray-600">{row.email}</span>,
              },
              {
                key: 'role',
                header: 'Role',
                render: (row) => getRoleBadge(row.role),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                key: 'lastLogin',
                header: 'Last Login',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastLoginAt
                      ? new Date(row.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {row.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(row.id)}
                        loading={deactivateMutation.isLoading && deactivateMutation.variables?.id === row.id}
                        title="Deactivate"
                      >
                        <UserX size={16} className="text-red-500" />
                      </Button>
                    )}
                    {row.status === 'inactive' && (
                      <Badge variant="gray">Inactive</Badge>
                    )}
                  </div>
                ),
              },
            ]}
            data={users}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={(data) => inviteMutation.mutate(data)}
        loading={inviteMutation.isLoading}
      />
    </div>
  );
}

function InviteModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}): React.ReactElement {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<Record<string, string>> = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email';
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit({ email: email.trim(), fullName: fullName.trim(), role });
    setEmail('');
    setFullName('');
    setRole('user');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite User"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            <Mail size={16} className="mr-2" />
            Send Invite
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`form-input ${errors.email ? 'ring-red-300 focus:ring-red-500' : ''}`}
            placeholder="user@company.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="form-label">Full Name *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`form-input ${errors.fullName ? 'ring-red-300 focus:ring-red-500' : ''}`}
            placeholder="John Doe"
          />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
        </div>
        <div>
          <label className="form-label">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
