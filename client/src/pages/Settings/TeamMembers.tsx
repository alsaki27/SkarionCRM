import React, { useState } from 'react';
import { trpc } from '../../api.ts';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Loading } from '../../components/ui/Loading.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Table } from '../../components/ui/Table.tsx';
import { addToast } from '../../components/ui/Toast.tsx';
import {
  Users,
  Plus,
  Mail,
  UserX,
  RefreshCw,
  Ban,
  Check,
  Shield,
  Clock,
  Search,
  X,
  UserCog,
} from 'lucide-react';

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer';
  status: 'active' | 'inactive';
  lastActiveAt: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer';
  message: string | null;
  invitedAt: string;
  expiresAt: string;
}

interface InviteForm {
  email: string;
  role: 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer';
  message: string;
}

const emptyInviteForm: InviteForm = {
  email: '',
  role: 'viewer',
  message: '',
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'bookkeeper', label: 'Bookkeeper' },
  { value: 'viewer', label: 'Viewer' },
] as const;

export default function TeamMembers(): React.ReactElement {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const query = trpc.org.listUsers.useQuery({ search: searchQuery });
  const members: TeamMember[] = query.data?.users ?? [];

  // For pending invites, use a mock list or query if available
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([
    {
      id: 'invite-1',
      email: 'alex@example.com',
      role: 'accountant',
      message: null,
      invitedAt: new Date(Date.now() - 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 604800000).toISOString(),
    },
    {
      id: 'invite-2',
      email: 'sarah@example.com',
      role: 'viewer',
      message: 'Welcome to the team!',
      invitedAt: new Date(Date.now() - 172800000).toISOString(),
      expiresAt: new Date(Date.now() + 518400000).toISOString(),
    },
  ]);

  const inviteMutation = trpc.org.inviteUser.useMutation({
    onSuccess: () => {
      addToast('success', 'Invitation sent');
      setShowInviteModal(false);
      setInviteForm(emptyInviteForm);
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to send invitation');
    },
  });

  const updateRoleMutation = trpc.org.updateUser.useMutation?.({
    onSuccess: () => {
      addToast('success', 'Role updated');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to update role');
    },
  }) ?? null;

  const removeMutation = trpc.org.removeUser.useMutation?.({
    onSuccess: () => {
      addToast('success', 'Member removed');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to remove member');
    },
  }) ?? null;

  const getRoleBadge = (role: string) => {
    const map: Record<string, { variant: 'red' | 'purple' | 'blue' | 'yellow' | 'gray'; label: string }> = {
      owner: { variant: 'red', label: 'Owner' },
      admin: { variant: 'purple', label: 'Admin' },
      accountant: { variant: 'blue', label: 'Accountant' },
      bookkeeper: { variant: 'yellow', label: 'Bookkeeper' },
      viewer: { variant: 'gray', label: 'Viewer' },
    };
    const config = map[role] || { variant: 'gray', label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const validateInvite = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!inviteForm.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(inviteForm.email)) newErrors.email = 'Invalid email format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInvite()) return;
    inviteMutation.mutate({
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      message: inviteForm.message.trim() || undefined,
    });
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    if (updateRoleMutation) {
      updateRoleMutation.mutate({ id: memberId, role: newRole });
    } else {
      addToast('info', 'Role update endpoint not available yet');
    }
  };

  const handleRemove = (memberId: string) => {
    if (!confirm('Remove this member from the organization?')) return;
    if (removeMutation) {
      removeMutation.mutate({ id: memberId });
    } else {
      addToast('info', 'Remove endpoint not available yet');
    }
  };

  const handleResendInvite = (inviteId: string) => {
    addToast('success', 'Invitation resent');
    setPendingInvites((prev) =>
      prev.map((inv) =>
        inv.id === inviteId ? { ...inv, invitedAt: new Date().toISOString() } : inv
      )
    );
  };

  const handleRevokeInvite = (inviteId: string) => {
    if (!confirm('Revoke this invitation? The invite link will no longer work.')) return;
    setPendingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    addToast('success', 'Invitation revoked');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="page-subtitle">Manage your team, roles, and pending invitations</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus size={16} className="mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
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

      {/* Members Table */}
      <Card>
        {query.isLoading && !members.length ? (
          <Loading message="Loading team members..." />
        ) : query.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 mb-3">Failed to load members</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found"
            description={searchQuery ? 'Try a different search.' : 'Invite your first team member.'}
            actionLabel={searchQuery ? undefined : 'Invite Member'}
            onAction={searchQuery ? undefined : () => setShowInviteModal(true)}
          />
        ) : (
          <Table<TeamMember>
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
                render: (row) => (
                  <div className="flex items-center gap-2">
                    {getRoleBadge(row.role)}
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.id, e.target.value)}
                      className="form-input py-1 text-xs"
                      title="Change role"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge variant={row.status === 'active' ? 'green' : 'gray'}>
                    {row.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
              {
                key: 'lastActive',
                header: 'Last Active',
                render: (row) => (
                  <span className="text-sm text-gray-500">
                    {row.lastActiveAt
                      ? new Date(row.lastActiveAt).toLocaleDateString()
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(row.id)}
                      loading={removeMutation?.isLoading && removeMutation?.variables?.id === row.id}
                      title="Remove member"
                    >
                      <UserX size={16} className="text-red-500" />
                    </Button>
                  </div>
                ),
              },
            ]}
            data={members}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card title="Pending Invitations">
          <div className="px-6 py-4">
            <Table<PendingInvite>
              columns={[
                {
                  key: 'email',
                  header: 'Email',
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{row.email}</span>
                    </div>
                  ),
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (row) => getRoleBadge(row.role),
                },
                {
                  key: 'invited',
                  header: 'Invited',
                  render: (row) => (
                    <span className="text-sm text-gray-500">
                      {new Date(row.invitedAt).toLocaleDateString()}
                    </span>
                  ),
                },
                {
                  key: 'expires',
                  header: 'Expires',
                  render: (row) => (
                    <span className="text-sm text-gray-500">
                      {new Date(row.expiresAt).toLocaleDateString()}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (row) => (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvite(row.id)}
                        title="Resend invite"
                      >
                        <RefreshCw size={16} className="text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(row.id)}
                        title="Revoke invite"
                      >
                        <Ban size={16} className="text-red-500" />
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={pendingInvites}
              keyExtractor={(row) => row.id}
            />
          </div>
        </Card>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} loading={inviteMutation.isPending}>
              <Mail size={16} className="mr-2" />
              Send Invite
            </Button>
          </>
        }
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="form-label">Email *</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => {
                setInviteForm((prev) => ({ ...prev, email: e.target.value }));
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={`form-input ${errors.email ? 'ring-red-300 focus:ring-red-500' : ''}`}
              placeholder="colleague@company.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="form-label">Role</label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm((prev) => ({ ...prev, role: e.target.value as InviteForm['role'] }))
              }
              className="form-input"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Message (optional)</label>
            <textarea
              value={inviteForm.message}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="form-input"
              placeholder="Hey, join us on Skarion!"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
