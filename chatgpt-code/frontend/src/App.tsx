import React, { useState } from 'react';
import Leads from './pages/Leads.tsx';
import Home from './pages/Home.tsx';

// Simple application shell.  In a full implementation you would use
// React Router for client‑side routing and build out additional pages.
export default function App() {
  const [page, setPage] = useState<'home' | 'leads'>('leads');
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold">Skarion CRM</h1>
        <nav className="space-x-4">
          <button
            className={`px-4 py-2 rounded ${page === 'home' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setPage('home')}
          >
            Home
          </button>
          <button
            className={`px-4 py-2 rounded ${page === 'leads' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setPage('leads')}
          >
            Leads
          </button>
        </nav>
      </header>
      <main className="p-6">
        {page === 'home' && <Home />}
        {page === 'leads' && <Leads />}
      </main>
    </div>
  );
}