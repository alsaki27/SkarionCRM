import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store.ts';
import { trpc } from './api.ts';
import { AppLayout } from './components/layout/AppLayout.tsx';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import Setup from './pages/Setup.tsx';
import Dashboard from './pages/Dashboard.tsx';
import ContactList from './pages/Contacts/ContactList.tsx';
import ContactDetail from './pages/Contacts/ContactDetail.tsx';
import ContactForm from './pages/Contacts/ContactForm.tsx';
import ChartOfAccounts from './pages/Financial/ChartOfAccounts.tsx';
import Transactions from './pages/Financial/Transactions.tsx';
import JournalEntries from './pages/Financial/JournalEntries.tsx';
import BankAccounts from './pages/Financial/BankAccounts.tsx';
import TaxYears from './pages/Tax/TaxYears.tsx';
import TaxForms from './pages/Tax/TaxForms.tsx';
import TaxDashboard from './pages/Tax/TaxDashboard.tsx';
import ComplianceDashboard from './pages/Compliance/ComplianceDashboard.tsx';
import ComplianceItems from './pages/Compliance/ComplianceItems.tsx';
import Employees from './pages/Payroll/Employees.tsx';
import EmployeeForm from './pages/Payroll/EmployeeForm.tsx';
import EmployeeDetail from './pages/Payroll/EmployeeDetail.tsx';
import PayrollRuns from './pages/Payroll/PayrollRuns.tsx';
import PayrollRunForm from './pages/Payroll/PayrollRunForm.tsx';
import PayrollRunDetail from './pages/Payroll/PayrollRunDetail.tsx';
import W2Dashboard from './pages/W2/W2Dashboard.tsx';
import W2List from './pages/W2/W2List.tsx';
import W2Generate from './pages/W2/W2Generate.tsx';
import DocumentLibrary from './pages/Documents/DocumentLibrary.tsx';
import TaskList from './pages/Tasks/TaskList.tsx';
import ReportPnl from './pages/Reports/ReportPnl.tsx';
import ReportBalanceSheet from './pages/Reports/ReportBalanceSheet.tsx';
import ReportCashFlow from './pages/Reports/ReportCashFlow.tsx';
import Organization from './pages/Settings/Organization.tsx';
import Users from './pages/Settings/Users.tsx';
import InvoiceList from './pages/Invoices/InvoiceList.tsx';
import InvoiceDetail from './pages/Invoices/InvoiceDetail.tsx';
import InvoiceForm from './pages/Invoices/InvoiceForm.tsx';
import RecurringList from './pages/Recurring/RecurringList.tsx';
import RecurringForm from './pages/Recurring/RecurringForm.tsx';
import ExpenseList from './pages/Expenses/ExpenseList.tsx';
import ExpenseDetail from './pages/Expenses/ExpenseDetail.tsx';
import ExpenseForm from './pages/Expenses/ExpenseForm.tsx';
import Form1099List from './pages/Form1099/Form1099List.tsx';
import Form1099Generate from './pages/Form1099/Form1099Generate.tsx';
import Form1099Detail from './pages/Form1099/Form1099Detail.tsx';

function App() {
  const { user, isAuthenticated, setAuth, logout } = useAuthStore();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: isAuthenticated && !user,
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data && !user) {
      const token = localStorage.getItem('skarion_token') || '';
      setAuth(meQuery.data, token);
    }
    if (meQuery.error) {
      logout();
    }
  }, [meQuery.data, meQuery.error, user, setAuth, logout]);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        
        {/* Contacts */}
        <Route path="/contacts" element={<ContactList />} />
        <Route path="/contacts/new" element={<ContactForm />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/contacts/:id/edit" element={<ContactForm />} />
        
        {/* Financial */}
        <Route path="/financial/accounts" element={<ChartOfAccounts />} />
        <Route path="/financial/transactions" element={<Transactions />} />
        <Route path="/financial/journal-entries" element={<JournalEntries />} />
        <Route path="/financial/bank-accounts" element={<BankAccounts />} />
        
        {/* Tax */}
        <Route path="/tax/years" element={<TaxYears />} />
        <Route path="/tax/forms" element={<TaxForms />} />
        <Route path="/tax/dashboard" element={<TaxDashboard />} />
        
        {/* Compliance */}
        <Route path="/compliance" element={<ComplianceDashboard />} />
        <Route path="/compliance/items" element={<ComplianceItems />} />
        
        {/* Payroll */}
        <Route path="/payroll/employees" element={<Employees />} />
        <Route path="/payroll/employees/new" element={<EmployeeForm />} />
        <Route path="/payroll/employees/:id" element={<EmployeeDetail />} />
        <Route path="/payroll/employees/:id/edit" element={<EmployeeForm />} />
        <Route path="/payroll/runs" element={<PayrollRuns />} />
        <Route path="/payroll/runs/new" element={<PayrollRunForm />} />
        <Route path="/payroll/runs/:id" element={<PayrollRunDetail />} />
        
        {/* W2 */}
        <Route path="/w2/dashboard" element={<W2Dashboard />} />
        <Route path="/w2/list" element={<W2List />} />
        <Route path="/w2/generate" element={<W2Generate />} />
        
        {/* Documents */}
        <Route path="/documents" element={<DocumentLibrary />} />
        
        {/* Tasks */}
        <Route path="/tasks" element={<TaskList />} />
        
        {/* Reports */}
        <Route path="/reports/pnl" element={<ReportPnl />} />
        <Route path="/reports/balance-sheet" element={<ReportBalanceSheet />} />
        <Route path="/reports/cash-flow" element={<ReportCashFlow />} />
        
        {/* Invoices */}
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/invoices/:id/edit" element={<InvoiceForm />} />

        {/* Recurring Transactions */}
        <Route path="/recurring" element={<RecurringList />} />
        <Route path="/recurring/new" element={<RecurringForm />} />
        <Route path="/recurring/:id/edit" element={<RecurringForm />} />

        {/* Expenses */}
        <Route path="/expenses" element={<ExpenseList />} />
        <Route path="/expenses/new" element={<ExpenseForm />} />
        <Route path="/expenses/:id" element={<ExpenseDetail />} />
        <Route path="/expenses/:id/edit" element={<ExpenseForm />} />

        {/* Form 1099 */}
        <Route path="/form1099" element={<Form1099List />} />
        <Route path="/form1099/generate" element={<Form1099Generate />} />
        <Route path="/form1099/:id" element={<Form1099Detail />} />

        {/* Settings */}
        <Route path="/settings/organization" element={<Organization />} />
        <Route path="/settings/users" element={<Users />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
