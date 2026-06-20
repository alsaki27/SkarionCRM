import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../../store';
import {
  LayoutDashboard,
  Users,
  Landmark,
  Receipt,
  Shield,
  Briefcase,
  FileText,
  FolderOpen,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  X,
  RefreshCw,
  FileSpreadsheet,
  Key,
  Globe,
  Plug,
  Users2,
  Bell,
  Activity,
  Import,
  Clock,
  Calendar,
  ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { label: string; path: string; roles?: string[] }[];
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/' },
  { label: 'Contacts', icon: <Users size={18} />, path: '/contacts' },
  {
    label: 'Financial',
    icon: <Landmark size={18} />,
    subItems: [
      { label: 'Chart of Accounts', path: '/financial/chart-of-accounts' },
      { label: 'Transactions', path: '/financial/transactions' },
      { label: 'Journal Entries', path: '/financial/journal-entries' },
      { label: 'Bank Accounts', path: '/financial/bank-accounts' },
    ],
  },
  {
    label: 'Tax',
    icon: <Receipt size={18} />,
    subItems: [
      { label: 'Tax Years', path: '/tax/years' },
      { label: 'Tax Forms', path: '/tax/forms' },
      { label: 'Dashboard', path: '/tax/dashboard' },
    ],
  },
  {
    label: 'Compliance',
    icon: <Shield size={18} />,
    subItems: [
      { label: 'Dashboard', path: '/compliance/dashboard' },
      { label: 'Items', path: '/compliance/items' },
    ],
  },
  {
    label: 'Payroll',
    icon: <Briefcase size={18} />,
    subItems: [
      { label: 'Employees', path: '/payroll/employees' },
      { label: 'Payroll Runs', path: '/payroll/runs' },
    ],
  },
  {
    label: 'W2',
    icon: <FileText size={18} />,
    subItems: [
      { label: 'Dashboard', path: '/w2/dashboard' },
      { label: 'W2 List', path: '/w2/list' },
      { label: 'Generate', path: '/w2/generate' },
    ],
  },
  {
    label: 'Invoices',
    icon: <FileText size={18} />,
    subItems: [
      { label: 'All Invoices', path: '/invoices' },
      { label: 'New Invoice', path: '/invoices/new' },
    ],
  },
  {
    label: 'Recurring',
    icon: <RefreshCw size={18} />,
    subItems: [
      { label: 'Recurring Transactions', path: '/recurring' },
      { label: 'New Recurring', path: '/recurring/new' },
    ],
  },
  {
    label: 'Expenses',
    icon: <Receipt size={18} />,
    subItems: [
      { label: 'Expense Reports', path: '/expenses' },
      { label: 'New Report', path: '/expenses/new' },
    ],
  },
  {
    label: 'Form 1099',
    icon: <FileSpreadsheet size={18} />,
    subItems: [
      { label: '1099 List', path: '/form1099' },
      { label: 'Generate 1099', path: '/form1099/generate' },
    ],
  },
  {
    label: 'Timekeeping',
    icon: <Clock size={18} />,
    subItems: [
      { label: 'My Dashboard', path: '/timekeeping' },
      { label: 'My Timesheets', path: '/timekeeping/timesheets' },
      { label: 'My PTO', path: '/timekeeping/pto' },
      { label: 'My Projects', path: '/timekeeping/projects' },
      { label: 'Team Presence', path: '/timekeeping/team' },
      { label: 'Approvals', path: '/timekeeping/approvals' },
      { label: 'Team Calendar', path: '/timekeeping/team-calendar' },
      { label: 'Admin: Schedules', path: '/timekeeping/admin/schedules' },
      { label: 'Admin: Leave Policies', path: '/timekeeping/admin/leave-policies' },
      { label: 'Admin: Holidays', path: '/timekeeping/admin/holidays' },
      { label: 'Admin: Projects', path: '/timekeeping/admin/projects' },
    ],
  },
  { label: 'Documents', icon: <FolderOpen size={18} />, path: '/documents' },
  { label: 'Tasks', icon: <CheckSquare size={18} />, path: '/tasks' },
  {
    label: 'Reports',
    icon: <BarChart3 size={18} />,
    subItems: [
      { label: 'P&L', path: '/reports/pl' },
      { label: 'Balance Sheet', path: '/reports/balance-sheet' },
      { label: 'Cash Flow', path: '/reports/cash-flow' },
    ],
  },
  {
    label: 'Integrations',
    icon: <Plug size={18} />,
    subItems: [
      { label: 'Connectors', path: '/settings/integrations' },
      { label: 'Import Data', path: '/settings/integrations' },
    ],
  },
  {
    label: 'Notifications',
    icon: <Bell size={18} />,
    path: '/notifications',
  },
  {
    label: 'Settings',
    icon: <Settings size={18} />,
    subItems: [
      { label: 'Organization', path: '/settings/organization' },
      { label: 'Users', path: '/settings/users' },
      { label: 'API Keys', path: '/settings/api-keys' },
      { label: 'AI Providers', path: '/settings/ai-providers', roles: ['owner', 'admin'] },
      { label: 'Webhooks', path: '/settings/webhooks' },
      { label: 'Integrations', path: '/settings/integrations' },
      { label: 'Team Members', path: '/settings/team' },
    ],
  },
];

export function Sidebar(): React.ReactElement {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { setSidebarOpen } = useUIStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const userRole = user?.role ?? 'user';

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  return (
    <div className="flex h-full flex-col bg-white border-r border-gray-200">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-primary-700">
          <LayoutDashboard size={24} />
          <span>Skarion</span>
        </Link>
        <button
          className="lg:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredNavItems.map((item) => {
          const hasSubItems = !!item.subItems && item.subItems.length > 0;
          const isExpanded = expanded[item.label] ?? false;
          const isItemActive = item.path ? isActive(item.path) : item.subItems?.some((sub) => isActive(sub.path));

          return (
            <div key={item.label}>
              {hasSubItems ? (
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isItemActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <Link
                  to={item.path ?? '#'}
                  className={clsx(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isItemActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}

              {/* Sub-items */}
              {hasSubItems && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
                  {item.subItems
                    ?.filter((sub) => !sub.roles || sub.roles.includes(userRole))
                    .map((sub) => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      className={clsx(
                        'flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
                        isActive(sub.path)
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile Mini-Card */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-3 rounded-md bg-gray-50 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {user?.fullName ?? user?.email ?? 'User'}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.role ?? 'User'}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-red-600 transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
