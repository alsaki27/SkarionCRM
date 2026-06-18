import React from 'react';

// Home page provides a simple welcome message.  Extend this page to
// include dashboard widgets such as summary stats and task lists.
export default function Home() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Welcome to Skarion CRM</h2>
      <p className="text-gray-700">
        This prototype demonstrates a minimal implementation of the CRM
        described in the Skarion planning document.  Use the navigation
        above to explore the Leads page, where you can view and add new
        leads.  Future development will add full pipeline management,
        enrollment tracking and AI‑powered outreach.
      </p>
    </div>
  );
}