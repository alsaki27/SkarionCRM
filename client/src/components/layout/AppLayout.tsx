import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '../../store';
import ChatWidget from '../ChatWidget';

export function AppLayout(): React.ReactElement {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop always visible, mobile collapsible */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ' +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => useUIStore.setState({ sidebarOpen: false })}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
