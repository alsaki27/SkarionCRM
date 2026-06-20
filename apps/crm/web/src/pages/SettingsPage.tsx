import { useAuthStore, type AuthStore } from '../stores/auth.js';
import { Settings, Users, Layers, Tag, Puzzle, User } from 'lucide-react';

export default function SettingsPage() {
  const role = useAuthStore((s: AuthStore) => s.user?.role ?? '');
  const user = useAuthStore((s: AuthStore) => s.user);

  const isManager = role === 'manager';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-slate-600" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-slate-600" />
            <h2 className="font-semibold">My Profile</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-slate-500">Email</label>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div>
              <label className="text-slate-500">Role</label>
              <div className="font-medium capitalize">{role}</div>
            </div>
          </div>
        </div>

        {isManager && (
          <>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-slate-600" />
                <h2 className="font-semibold">Team</h2>
              </div>
              <p className="text-sm text-slate-500">Manage team members and roles</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={18} className="text-slate-600" />
                <h2 className="font-semibold">Pipelines</h2>
              </div>
              <p className="text-sm text-slate-500">Configure sales stages and probabilities</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={18} className="text-slate-600" />
                <h2 className="font-semibold">Tags</h2>
              </div>
              <p className="text-sm text-slate-500">Manage tags and labels</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Puzzle size={18} className="text-slate-600" />
                <h2 className="font-semibold">Integrations</h2>
              </div>
              <p className="text-sm text-slate-500">Connect Gmail, Outlook, Slack, etc.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
