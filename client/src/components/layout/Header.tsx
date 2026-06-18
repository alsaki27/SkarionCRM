import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../../store';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';

export function Header(): React.ReactElement {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const notificationCount = 3; // Placeholder; replace with real data

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ??
    user?.email?.[0].toUpperCase() ??
    'U';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left: Sidebar toggle + Page title area */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h2 className="text-lg font-semibold text-gray-900 page-title">Skarion CRM</h2>
          <p className="text-xs text-gray-500 page-subtitle">Manage your business with ease</p>
        </div>
      </div>

      {/* Right: Search, Notifications, User */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search contacts, transactions, employees..."
            className="form-input h-9 w-64 rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Notifications"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <div className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <p className="text-sm font-medium text-gray-900">New transaction recorded</p>
                  <p className="text-xs text-gray-500 mt-0.5">2 minutes ago</p>
                </div>
                <div className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <p className="text-sm font-medium text-gray-900">Payroll run completed</p>
                  <p className="text-xs text-gray-500 mt-0.5">1 hour ago</p>
                </div>
                <div className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <p className="text-sm font-medium text-gray-900">Tax form due soon</p>
                  <p className="text-xs text-gray-500 mt-0.5">3 hours ago</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-gray-100"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="User menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {userInitials}
            </div>
            <ChevronDown
              size={16}
              className={clsx('text-gray-500 transition-transform', userMenuOpen && 'rotate-180')}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.name ?? 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
              </div>
              <div className="py-1">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    // Navigate to profile
                  }}
                >
                  <User size={16} />
                  Profile
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    // Navigate to settings
                  }}
                >
                  <Settings size={16} />
                  Settings
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
