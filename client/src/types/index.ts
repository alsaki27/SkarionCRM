import type { ReactNode } from 'react';

export interface AppProps {
  children?: ReactNode;
}

export type EntityType = 
  | 'contact' 
  | 'transaction' 
  | 'employee' 
  | 'compliance_item' 
  | 'tax_form' 
  | 'payroll_run' 
  | 'w2_form' 
  | 'document';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'adjustment' | 'journal_entry';

export type ContactType = 'client' | 'vendor' | 'employee' | 'contractor' | 'prospect' | 'partner';

export type ContactStatus = 'active' | 'inactive' | 'archived';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'overdue';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaxFormStatus = 'draft' | 'ready' | 'filed' | 'amended' | 'rejected';

export type TaxYearStatus = 'open' | 'closed' | 'filing' | 'extended';

export type ComplianceStatus = 'not_started' | 'in_progress' | 'compliant' | 'non_compliant' | 'at_risk' | 'overdue';

export type EmployeeStatus = 'active' | 'terminated' | 'on_leave' | 'suspended';

export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern';

export type PayrollRunStatus = 'draft' | 'processing' | 'completed' | 'cancelled';

export type W2FormStatus = 'draft' | 'generated' | 'distributed' | 'filed' | 'corrected';

export type UserRole = 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer' | 'employee';

export type DocumentTemplateType = 'w2' | '1099' | 'contract' | 'invoice' | 'letter' | 'compliance' | 'paystub' | 'other';
