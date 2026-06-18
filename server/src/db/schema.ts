import {
  pgTable, pgEnum, uuid, varchar, integer, boolean, timestamp, text, date,
  jsonb, numeric, index, uniqueIndex, inet, decimal, serial, primaryKey,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMERATIONS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', [
  'owner', 'admin', 'accountant', 'bookkeeper', 'viewer', 'employee'
]);

export const organizationStatusEnum = pgEnum('organization_status', [
  'active', 'suspended', 'cancelled'
]);

export const contactTypeEnum = pgEnum('contact_type', [
  'client', 'vendor', 'employee', 'contractor', 'prospect', 'partner'
]);

export const contactStatusEnum = pgEnum('contact_status', [
  'active', 'inactive', 'archived'
]);

export const accountTypeEnum = pgEnum('account_type', [
  'asset', 'liability', 'equity', 'revenue', 'expense'
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'deposit', 'withdrawal', 'transfer', 'adjustment', 'journal_entry'
]);

export const debitCreditEnum = pgEnum('debit_credit', ['debit', 'credit']);

export const journalEntryStatusEnum = pgEnum('journal_entry_status', [
  'draft', 'posted', 'reversed'
]);

export const taxFormTypeEnum = pgEnum('tax_form_type', [
  'w2', 'w2c', '1099_nec', '1099_misc', '940', '941', '944', '1040', '1120', '1065', '990', 'other'
]);

export const taxFormStatusEnum = pgEnum('tax_form_status', [
  'draft', 'ready', 'filed', 'amended', 'rejected'
]);

export const taxYearStatusEnum = pgEnum('tax_year_status', [
  'open', 'closed', 'filing', 'extended'
]);

export const compliancePriorityEnum = pgEnum('compliance_priority', [
  'low', 'medium', 'high', 'critical'
]);

export const complianceItemStatusEnum = pgEnum('compliance_item_status', [
  'not_started', 'in_progress', 'compliant', 'non_compliant', 'at_risk', 'overdue'
]);

export const employeeStatusEnum = pgEnum('employee_status', [
  'active', 'terminated', 'on_leave', 'suspended'
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time', 'part_time', 'contractor', 'intern'
]);

export const payFrequencyEnum = pgEnum('pay_frequency', [
  'hourly', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annually'
]);

export const payTypeEnum = pgEnum('pay_type', [
  'salary', 'hourly', 'commission', 'piece_rate'
]);

export const payrollRunStatusEnum = pgEnum('payroll_run_status', [
  'draft', 'processing', 'completed', 'cancelled'
]);

export const w2FormStatusEnum = pgEnum('w2_form_status', [
  'draft', 'generated', 'distributed', 'filed', 'corrected'
]);

export const taskStatusEnum = pgEnum('task_status', [
  'todo', 'in_progress', 'done', 'cancelled', 'overdue'
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low', 'medium', 'high', 'urgent'
]);

export const taskTypeEnum = pgEnum('task_type', [
  'follow_up', 'review', 'filing_deadline', 'compliance_review', 'tax_preparation',
  'payment', 'reconciliation', 'general'
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete', 'login', 'logout', 'export', 'view', 'post', 'void'
]);

export const documentTemplateTypeEnum = pgEnum('document_template_type', [
  'w2', '1099', 'contract', 'invoice', 'letter', 'compliance', 'paystub', 'other'
]);

// ============================================================================
// CORE TABLES
// ============================================================================

// Organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  taxId: varchar('tax_id', { length: 50 }),
  businessType: varchar('business_type', { length: 50 }),
  industry: varchar('industry', { length: 100 }),
  address: jsonb('address').default('{}'),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 255 }),
  fiscalYearEnd: varchar('fiscal_year_end', { length: 5 }),
  timezone: varchar('timezone', { length: 50 }).default('America/New_York'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  plan: varchar('plan', { length: 50 }).default('free'),
  status: organizationStatusEnum('status').default('active'),
  settings: jsonb('settings').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  auditLogs: many(auditLog),
}));

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: text('avatar_url'),
  passwordHash: varchar('password_hash', { length: 255 }),
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  settings: jsonb('settings').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_org_email').on(table.orgId, table.email),
  index('idx_users_org').on(table.orgId),
  index('idx_users_role').on(table.role),
  index('idx_users_active').on(table.isActive).where(table.isActive.eq(true)),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
  auditLogs: many(auditLog),
  assignedTasks: many(tasks),
  createdContacts: many(contacts),
}));

// Audit Log (compliance-grade)
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: auditActionEnum('action').notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_audit_org').on(table.orgId),
  index('idx_audit_user').on(table.userId),
  index('idx_audit_entity').on(table.entityType, table.entityId),
  index('idx_audit_created').on(table.createdAt),
]);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organization: one(organizations, { fields: [auditLog.orgId], references: [organizations.id] }),
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

// ============================================================================
// CRM / CONTACTS MODULE
// ============================================================================

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  type: contactTypeEnum('type').notNull(),
  status: contactStatusEnum('status').default('active'),
  companyName: varchar('company_name', { length: 255 }),
  taxId: varchar('tax_id', { length: 50 }),
  address: jsonb('address').default('{}'),
  tags: text('tags').array().default('{}'),
  notes: text('notes'),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_contacts_org').on(table.orgId),
  index('idx_contacts_type').on(table.type),
  index('idx_contacts_status').on(table.status),
  index('idx_contacts_name').on(table.fullName),
  index('idx_contacts_email').on(table.email),
  index('idx_contacts_assigned').on(table.assignedTo),
  index('idx_contacts_deleted').on(table.deletedAt).where(table.deletedAt.isNull()),
]);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, { fields: [contacts.orgId], references: [organizations.id] }),
  assignee: one(users, { fields: [contacts.assignedTo], references: [users.id] }),
  communications: many(contactCommunications),
  documents: many(documents),
  transactions: many(transactions),
  tasks: many(tasks),
  employee: many(employees),
  w2Forms: many(w2Forms),
  taxForms: many(taxForms),
}));

export const contactCommunications = pgTable('contact_communications', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 50 }).notNull(), // email, phone, sms, meeting, note
  direction: varchar('direction', { length: 10 }).notNull(), // inbound, outbound
  content: text('content').notNull(),
  metadata: jsonb('metadata').default('{}'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_comm_contact').on(table.contactId),
  index('idx_comm_created').on(table.createdAt),
]);

export const contactCommunicationsRelations = relations(contactCommunications, ({ one }) => ({
  contact: one(contacts, { fields: [contactCommunications.contactId], references: [contacts.id] }),
  creator: one(users, { fields: [contactCommunications.createdBy], references: [users.id] }),
}));

// ============================================================================
// FINANCIAL RECORDKEEPING MODULE
// ============================================================================

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  accountSubtype: varchar('account_subtype', { length: 100 }),
  parentId: uuid('parent_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  level: integer('level').default(1),
  isBankAccount: boolean('is_bank_account').default(false),
  bankAccountId: uuid('bank_account_id'),
  isActive: boolean('is_active').default(true),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_coa_org_code').on(table.orgId, table.code),
  index('idx_coa_org').on(table.orgId),
  index('idx_coa_type').on(table.accountType),
  index('idx_coa_parent').on(table.parentId),
  index('idx_coa_active').on(table.isActive).where(table.isActive.eq(true)),
]);

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  organization: one(organizations, { fields: [chartOfAccounts.orgId], references: [organizations.id] }),
  parent: one(chartOfAccounts, { fields: [chartOfAccounts.parentId], references: [chartOfAccounts.id] }),
  children: many(chartOfAccounts),
  transactions: many(transactions),
  journalEntryLines: many(journalEntryLines),
}));

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }),
  accountNumberHash: varchar('account_number_hash', { length: 255 }),
  accountType: varchar('account_type', { length: 50 }), // checking, savings, credit_card, loan
  routingNumber: varchar('routing_number', { length: 20 }),
  currency: varchar('currency', { length: 3 }).default('USD'),
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0'),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0'),
  lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
  lastReconciledBalance: decimal('last_reconciled_balance', { precision: 15, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_bank_org').on(table.orgId),
  index('idx_bank_active').on(table.isActive).where(table.isActive.eq(true)),
]);

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  organization: one(organizations, { fields: [bankAccounts.orgId], references: [organizations.id] }),
}));

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  debitCredit: debitCreditEnum('debit_credit').notNull(),
  referenceNumber: varchar('reference_number', { length: 255 }),
  transactionDate: date('transaction_date').notNull(),
  memo: text('memo'),
  attachments: jsonb('attachments').default('[]'),
  isReconciled: boolean('is_reconciled').default(false),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  reconciledBy: uuid('reconciled_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_txn_org').on(table.orgId),
  index('idx_txn_account').on(table.accountId),
  index('idx_txn_date').on(table.transactionDate),
  index('idx_txn_contact').on(table.contactId),
  index('idx_txn_bank').on(table.bankAccountId),
  index('idx_txn_reconciled').on(table.isReconciled).where(table.isReconciled.eq(false)),
  index('idx_txn_created').on(table.createdAt),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  organization: one(organizations, { fields: [transactions.orgId], references: [organizations.id] }),
  account: one(chartOfAccounts, { fields: [transactions.accountId], references: [chartOfAccounts.id] }),
  bankAccount: one(bankAccounts, { fields: [transactions.bankAccountId], references: [bankAccounts.id] }),
  contact: one(contacts, { fields: [transactions.contactId], references: [contacts.id] }),
  creator: one(users, { fields: [transactions.createdBy], references: [users.id] }),
}));

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entryNumber: varchar('entry_number', { length: 50 }).notNull(),
  entryDate: date('entry_date').notNull(),
  reference: varchar('reference', { length: 255 }),
  description: text('description'),
  status: journalEntryStatusEnum('status').default('draft'),
  isReversingEntry: boolean('is_reversing_entry').default(false),
  reversedEntryId: uuid('reversed_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  totalDebit: decimal('total_debit', { precision: 15, scale: 2 }).notNull(),
  totalCredit: decimal('total_credit', { precision: 15, scale: 2 }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  postedBy: uuid('posted_by').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_je_org_number').on(table.orgId, table.entryNumber),
  index('idx_je_org').on(table.orgId),
  index('idx_je_date').on(table.entryDate),
  index('idx_je_status').on(table.status),
  index('idx_je_created').on(table.createdAt),
]);

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  organization: one(organizations, { fields: [journalEntries.orgId], references: [organizations.id] }),
  lines: many(journalEntryLines),
  reversedEntry: one(journalEntries, { fields: [journalEntries.reversedEntryId], references: [journalEntries.id] }),
  creator: one(users, { fields: [journalEntries.createdBy], references: [users.id] }),
  poster: one(users, { fields: [journalEntries.postedBy], references: [users.id] }),
}));

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  lineNumber: integer('line_number').notNull(),
  description: text('description'),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  debitCredit: debitCreditEnum('debit_credit').notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
}, (table) => [
  index('idx_jel_entry').on(table.journalEntryId),
  index('idx_jel_account').on(table.accountId),
  index('idx_jel_contact').on(table.contactId),
]);

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, { fields: [journalEntryLines.journalEntryId], references: [journalEntries.id] }),
  account: one(chartOfAccounts, { fields: [journalEntryLines.accountId], references: [chartOfAccounts.id] }),
  contact: one(contacts, { fields: [journalEntryLines.contactId], references: [contacts.id] }),
}));

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  periodType: varchar('period_type', { length: 20 }).default('annual'),
  status: varchar('status', { length: 20 }).default('draft'),
  accountId: uuid('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_budget_org').on(table.orgId),
  index('idx_budget_year').on(table.fiscalYear),
  index('idx_budget_account').on(table.accountId),
]);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  organization: one(organizations, { fields: [budgets.orgId], references: [organizations.id] }),
  account: one(chartOfAccounts, { fields: [budgets.accountId], references: [chartOfAccounts.id] }),
}));

// ============================================================================
// TAXATION MODULE
// ============================================================================

export const taxYears = pgTable('tax_years', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: taxYearStatusEnum('status').default('open'),
  formTypes: text('form_types').array().default('{}'),
  extensionFiled: boolean('extension_filed').default(false),
  extensionDeadline: date('extension_deadline'),
  filedDate: date('filed_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_tax_year_org_year').on(table.orgId, table.year),
  index('idx_tax_year_org').on(table.orgId),
  index('idx_tax_year_status').on(table.status),
]);

export const taxYearsRelations = relations(taxYears, ({ one, many }) => ({
  organization: one(organizations, { fields: [taxYears.orgId], references: [organizations.id] }),
  taxForms: many(taxForms),
  taxCalculations: many(taxCalculations),
  w2Forms: many(w2Forms),
}));

export const taxForms = pgTable('tax_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id, { onDelete: 'cascade' }),
  formType: taxFormTypeEnum('form_type').notNull(),
  formName: varchar('form_name', { length: 255 }).notNull(),
  status: taxFormStatusEnum('status').default('draft'),
  filingDeadline: date('filing_deadline').notNull(),
  filedDate: date('filed_date'),
  irsAcknowledgment: varchar('irs_acknowledgment', { length: 255 }),
  efileTransmissionId: varchar('efile_transmission_id', { length: 255 }),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  preparedBy: uuid('prepared_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_tax_form_org').on(table.orgId),
  index('idx_tax_form_year').on(table.taxYearId),
  index('idx_tax_form_type').on(table.formType),
  index('idx_tax_form_status').on(table.status),
  index('idx_tax_form_deadline').on(table.filingDeadline),
  index('idx_tax_form_contact').on(table.contactId),
]);

export const taxFormsRelations = relations(taxForms, ({ one }) => ({
  organization: one(organizations, { fields: [taxForms.orgId], references: [organizations.id] }),
  taxYear: one(taxYears, { fields: [taxForms.taxYearId], references: [taxYears.id] }),
  contact: one(contacts, { fields: [taxForms.contactId], references: [contacts.id] }),
  preparer: one(users, { fields: [taxForms.preparedBy], references: [users.id] }),
  reviewer: one(users, { fields: [taxForms.reviewedBy], references: [users.id] }),
}));

export const taxCalculations = pgTable('tax_calculations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id, { onDelete: 'cascade' }),
  formType: taxFormTypeEnum('form_type').notNull(),
  calculationType: varchar('calculation_type', { length: 50 }).notNull(),
  baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
  rate: decimal('rate', { precision: 10, scale: 6 }).default('0'),
  calculatedAmount: decimal('calculated_amount', { precision: 15, scale: 2 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 100 }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_tax_calc_org').on(table.orgId),
  index('idx_tax_calc_year').on(table.taxYearId),
  index('idx_tax_calc_type').on(table.calculationType),
]);

export const taxCalculationsRelations = relations(taxCalculations, ({ one }) => ({
  organization: one(organizations, { fields: [taxCalculations.orgId], references: [organizations.id] }),
  taxYear: one(taxYears, { fields: [taxCalculations.taxYearId], references: [taxYears.id] }),
}));

// ============================================================================
// COMPLIANCE MODULE
// ============================================================================

export const complianceCategories = pgTable('compliance_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  regulatoryBody: varchar('regulatory_body', { length: 255 }),
  frequency: varchar('frequency', { length: 50 }),
  priority: compliancePriorityEnum('priority').default('medium'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_comp_cat_org').on(table.orgId),
  index('idx_comp_cat_active').on(table.isActive).where(table.isActive.eq(true)),
]);

export const complianceCategoriesRelations = relations(complianceCategories, ({ one, many }) => ({
  organization: one(organizations, { fields: [complianceCategories.orgId], references: [organizations.id] }),
  items: many(complianceItems),
}));

export const complianceItems = pgTable('compliance_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => complianceCategories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: complianceItemStatusEnum('status').default('not_started'),
  dueDate: date('due_date'),
  completedDate: date('completed_date'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  reviewer: uuid('reviewer').references(() => users.id, { onDelete: 'set null' }),
  evidenceRequired: boolean('evidence_required').default(false),
  evidenceFiles: jsonb('evidence_files').default('[]'),
  nextReviewDate: date('next_review_date'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_comp_item_org').on(table.orgId),
  index('idx_comp_item_category').on(table.categoryId),
  index('idx_comp_item_status').on(table.status),
  index('idx_comp_item_due').on(table.dueDate),
  index('idx_comp_item_assigned').on(table.assignedTo),
  index('idx_comp_item_next_review').on(table.nextReviewDate),
]);

export const complianceItemsRelations = relations(complianceItems, ({ one, many }) => ({
  organization: one(organizations, { fields: [complianceItems.orgId], references: [organizations.id] }),
  category: one(complianceCategories, { fields: [complianceItems.categoryId], references: [complianceCategories.id] }),
  assignee: one(users, { fields: [complianceItems.assignedTo], references: [users.id] }),
  reviewerUser: one(users, { fields: [complianceItems.reviewer], references: [users.id] }),
  documents: many(complianceDocuments),
  tasks: many(tasks),
}));

export const complianceDocuments = pgTable('compliance_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  complianceItemId: uuid('compliance_item_id').references(() => complianceItems.id, { onDelete: 'cascade' }),
  documentName: varchar('document_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_comp_doc_item').on(table.complianceItemId),
  index('idx_comp_doc_org').on(table.orgId),
]);

export const complianceDocumentsRelations = relations(complianceDocuments, ({ one }) => ({
  complianceItem: one(complianceItems, { fields: [complianceDocuments.complianceItemId], references: [complianceItems.id] }),
  uploader: one(users, { fields: [complianceDocuments.uploadedBy], references: [users.id] }),
}));

// ============================================================================
// W2 & PAYROLL MODULE
// ============================================================================

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  employeeId: varchar('employee_id', { length: 50 }).notNull(),
  ssnHash: varchar('ssn_hash', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  hireDate: date('hire_date').notNull(),
  terminationDate: date('termination_date'),
  status: employeeStatusEnum('status').default('active'),
  employmentType: employmentTypeEnum('employment_type').default('full_time'),
  jobTitle: varchar('job_title', { length: 255 }),
  department: varchar('department', { length: 100 }),
  payRate: decimal('pay_rate', { precision: 10, scale: 2 }),
  payFrequency: payFrequencyEnum('pay_frequency'),
  payType: payTypeEnum('pay_type').default('salary'),
  address: jsonb('address').default('{}'),
  bankAccount: jsonb('bank_account').default('{}'),
  withholdingFederal: decimal('withholding_federal', { precision: 10, scale: 2 }).default('0'),
  withholdingState: varchar('withholding_state', { length: 10 }),
  withholdingStateAmount: decimal('withholding_state_amount', { precision: 10, scale: 2 }).default('0'),
  withholdingLocal: decimal('withholding_local', { precision: 10, scale: 2 }).default('0'),
  retirement401kRate: decimal('retirement_401k_rate', { precision: 5, scale: 2 }).default('0'),
  healthInsurancePremium: decimal('health_insurance_premium', { precision: 10, scale: 2 }).default('0'),
  otherDeductions: jsonb('other_deductions').default('[]'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_employee_org_id').on(table.orgId, table.employeeId),
  index('idx_employee_org').on(table.orgId),
  index('idx_employee_status').on(table.status),
  index('idx_employee_contact').on(table.contactId),
  index('idx_employee_name').on(table.lastName, table.firstName),
]);

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organization: one(organizations, { fields: [employees.orgId], references: [organizations.id] }),
  contact: one(contacts, { fields: [employees.contactId], references: [contacts.id] }),
  payrollEntries: many(payrollEntries),
  w2Forms: many(w2Forms),
}));

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  runName: varchar('run_name', { length: 255 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  payDate: date('pay_date').notNull(),
  status: payrollRunStatusEnum('status').default('draft'),
  totalGross: decimal('total_gross', { precision: 15, scale: 2 }).default('0'),
  totalFica: decimal('total_fica', { precision: 15, scale: 2 }).default('0'),
  totalFederalTax: decimal('total_federal_tax', { precision: 15, scale: 2 }).default('0'),
  totalStateTax: decimal('total_state_tax', { precision: 15, scale: 2 }).default('0'),
  totalDeductions: decimal('total_deductions', { precision: 15, scale: 2 }).default('0'),
  totalNet: decimal('total_net', { precision: 15, scale: 2 }).default('0'),
  processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_payroll_org').on(table.orgId),
  index('idx_payroll_period').on(table.periodStart, table.periodEnd),
  index('idx_payroll_status').on(table.status),
  index('idx_payroll_paydate').on(table.payDate),
]);

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  organization: one(organizations, { fields: [payrollRuns.orgId], references: [organizations.id] }),
  entries: many(payrollEntries),
  processor: one(users, { fields: [payrollRuns.processedBy], references: [users.id] }),
}));

export const payrollEntries = pgTable('payroll_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  regularHours: decimal('regular_hours', { precision: 8, scale: 2 }).default('0'),
  overtimeHours: decimal('overtime_hours', { precision: 8, scale: 2 }).default('0'),
  grossPay: decimal('gross_pay', { precision: 15, scale: 2 }).notNull(),
  federalTax: decimal('federal_tax', { precision: 15, scale: 2 }).default('0'),
  socialSecurityTax: decimal('social_security_tax', { precision: 15, scale: 2 }).default('0'),
  medicareTax: decimal('medicare_tax', { precision: 15, scale: 2 }).default('0'),
  stateTax: decimal('state_tax', { precision: 15, scale: 2 }).default('0'),
  localTax: decimal('local_tax', { precision: 15, scale: 2 }).default('0'),
  retirement401k: decimal('retirement_401k', { precision: 15, scale: 2 }).default('0'),
  healthInsurance: decimal('health_insurance', { precision: 15, scale: 2 }).default('0'),
  otherDeductions: decimal('other_deductions', { precision: 15, scale: 2 }).default('0'),
  netPay: decimal('net_pay', { precision: 15, scale: 2 }).notNull(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_payroll_entry_run').on(table.payrollRunId),
  index('idx_payroll_entry_employee').on(table.employeeId),
  index('idx_payroll_entry_org').on(table.orgId),
]);

export const payrollEntriesRelations = relations(payrollEntries, ({ one }) => ({
  payrollRun: one(payrollRuns, { fields: [payrollEntries.payrollRunId], references: [payrollRuns.id] }),
  employee: one(employees, { fields: [payrollEntries.employeeId], references: [employees.id] }),
}));

export const w2Forms = pgTable('w2_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id, { onDelete: 'cascade' }),
  formStatus: w2FormStatusEnum('form_status').default('draft'),
  // W2 Boxes
  box1Wages: decimal('box_1_wages', { precision: 15, scale: 2 }).default('0'),
  box2FederalTax: decimal('box_2_federal_tax', { precision: 15, scale: 2 }).default('0'),
  box3SocialWages: decimal('box_3_social_wages', { precision: 15, scale: 2 }).default('0'),
  box4SocialTax: decimal('box_4_social_tax', { precision: 15, scale: 2 }).default('0'),
  box5MedicareWages: decimal('box_5_medicare_wages', { precision: 15, scale: 2 }).default('0'),
  box6MedicareTax: decimal('box_6_medicare_tax', { precision: 15, scale: 2 }).default('0'),
  box7SocialTips: decimal('box_7_social_tips', { precision: 15, scale: 2 }).default('0'),
  box8AllocatedTips: decimal('box_8_allocated_tips', { precision: 15, scale: 2 }).default('0'),
  box10DependentCare: decimal('box_10_dependent_care', { precision: 15, scale: 2 }).default('0'),
  box11NonqualifiedPlans: decimal('box_11_nonqualified_plans', { precision: 15, scale: 2 }).default('0'),
  box12Codes: jsonb('box_12_codes').default('[]'),
  box13Checkboxes: jsonb('box_13_checkboxes').default('{}'),
  box14Other: jsonb('box_14_other').default('[]'),
  stateWages: jsonb('state_wages').default('[]'),
  localWages: jsonb('local_wages').default('[]'),
  employeeCopyDistributedAt: timestamp('employee_copy_distributed_at', { withTimezone: true }),
  irsFiledAt: timestamp('irs_filed_at', { withTimezone: true }),
  ssaFiledAt: timestamp('ssa_filed_at', { withTimezone: true }),
  generatedPdfPath: text('generated_pdf_path'),
  correctedW2Id: uuid('corrected_w2_id').references(() => w2Forms.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_w2_employee_year').on(table.employeeId, table.taxYearId),
  index('idx_w2_org').on(table.orgId),
  index('idx_w2_employee').on(table.employeeId),
  index('idx_w2_year').on(table.taxYearId),
  index('idx_w2_status').on(table.formStatus),
  index('idx_w2_corrected').on(table.correctedW2Id),
]);

export const w2FormsRelations = relations(w2Forms, ({ one }) => ({
  organization: one(organizations, { fields: [w2Forms.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [w2Forms.employeeId], references: [employees.id] }),
  taxYear: one(taxYears, { fields: [w2Forms.taxYearId], references: [taxYears.id] }),
  correctedW2: one(w2Forms, { fields: [w2Forms.correctedW2Id], references: [w2Forms.id] }),
}));

// ============================================================================
// DOCUMENT MANAGEMENT MODULE
// ============================================================================

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }), // contact, transaction, employee, compliance_item, tax_form, etc.
  entityId: uuid('entity_id'),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'),
  storageProvider: varchar('storage_provider', { length: 20 }).default('supabase'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_doc_org').on(table.orgId),
  index('idx_doc_entity').on(table.entityType, table.entityId),
  index('idx_doc_uploaded').on(table.uploadedBy),
  index('idx_doc_created').on(table.createdAt),
]);

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, { fields: [documents.orgId], references: [organizations.id] }),
  uploader: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
}));

export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  templateType: documentTemplateTypeEnum('template_type').notNull(),
  filePath: text('file_path'),
  variables: jsonb('variables').default('[]'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_doc_template_org').on(table.orgId),
  index('idx_doc_template_type').on(table.templateType),
  index('idx_doc_template_active').on(table.isActive).where(table.isActive.eq(true)),
]);

export const documentTemplatesRelations = relations(documentTemplates, ({ one }) => ({
  organization: one(organizations, { fields: [documentTemplates.orgId], references: [organizations.id] }),
}));

// ============================================================================
// TASKS & REMINDERS MODULE
// ============================================================================

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  type: taskTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  status: taskStatusEnum('status').default('todo'),
  priority: taskPriorityEnum('priority').default('medium'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  reminderCount: integer('reminder_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_task_org').on(table.orgId),
  index('idx_task_status').on(table.status),
  index('idx_task_priority').on(table.priority),
  index('idx_task_due').on(table.dueAt),
  index('idx_task_assigned').on(table.assignedTo),
  index('idx_task_entity').on(table.entityType, table.entityId),
  index('idx_task_overdue').on(table.dueAt).where(table.status.notInArray(['done', 'cancelled'])),
]);

export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, { fields: [tasks.orgId], references: [organizations.id] }),
  assignee: one(users, { fields: [tasks.assignedTo], references: [users.id] }),
  completer: one(users, { fields: [tasks.completedBy], references: [users.id] }),
}));

// ============================================================================
// REPORTING SNAPSHOTS
// ============================================================================

export const reportSnapshots = pgTable('report_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  reportType: varchar('report_type', { length: 50 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  data: jsonb('data').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_report_org').on(table.orgId),
  index('idx_report_type').on(table.reportType),
  index('idx_report_period').on(table.periodStart, table.periodEnd),
  index('idx_report_generated').on(table.generatedAt),
]);

export const reportSnapshotsRelations = relations(reportSnapshots, ({ one }) => ({
  organization: one(organizations, { fields: [reportSnapshots.orgId], references: [organizations.id] }),
}));

// ============================================================================
// NEW ENUMS FOR V2.5 MODULES
// ============================================================================

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash', 'check', 'ach', 'wire', 'credit_card', 'debit_card', 'stripe', 'paypal', 'other',
]);

export const recurringFrequencyEnum = pgEnum('recurring_frequency', [
  'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'annually',
]);

export const expenseStatusEnum = pgEnum('expense_status', [
  'draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed',
]);

export const form1099TypeEnum = pgEnum('form_1099_type', [
  'nec', 'misc', 'int', 'div', 'r', 's', 'k',
]);

export const form1099StatusEnum = pgEnum('form_1099_status', [
  'draft', 'generated', 'distributed', 'filed', 'corrected',
]);

// ============================================================================
// INVOICE & AR MODULE
// ============================================================================

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'restrict' }),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }).default('0'),
  amountDue: decimal('amount_due', { precision: 15, scale: 2 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  terms: varchar('terms', { length: 255 }), // e.g., "Net 30", "Due on Receipt"
  poNumber: varchar('po_number', { length: 100 }),
  notes: text('notes'),
  footer: text('footer'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  template: varchar('template', { length: 50 }).default('default'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_invoice_org_number').on(table.orgId, table.invoiceNumber),
  index('idx_invoice_org').on(table.orgId),
  index('idx_invoice_contact').on(table.contactId),
  index('idx_invoice_status').on(table.status),
  index('idx_invoice_due').on(table.dueDate),
  index('idx_invoice_issue').on(table.issueDate),
  index('idx_invoice_overdue').on(table.dueDate).where(table.status.notInArray(['paid', 'cancelled', 'refunded'])),
]);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, { fields: [invoices.orgId], references: [organizations.id] }),
  contact: one(contacts, { fields: [invoices.contactId], references: [contacts.id] }),
  lines: many(invoiceLines),
  payments: many(payments),
}));

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1'),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).default('0'),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  accountId: uuid('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default('{}'),
}, (table) => [
  index('idx_inv_line_invoice').on(table.invoiceId),
  index('idx_inv_line_org').on(table.orgId),
  index('idx_inv_line_account').on(table.accountId),
]);

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  account: one(chartOfAccounts, { fields: [invoiceLines.accountId], references: [chartOfAccounts.id] }),
}));

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  paymentMethod: paymentMethodEnum('payment_method').default('check'),
  referenceNumber: varchar('reference_number', { length: 255 }),
  memo: text('memo'),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  depositedAt: timestamp('deposited_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_payment_org').on(table.orgId),
  index('idx_payment_invoice').on(table.invoiceId),
  index('idx_payment_contact').on(table.contactId),
  index('idx_payment_date').on(table.paymentDate),
  index('idx_payment_bank').on(table.bankAccountId),
]);

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, { fields: [payments.orgId], references: [organizations.id] }),
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  contact: one(contacts, { fields: [payments.contactId], references: [contacts.id] }),
  bankAccount: one(bankAccounts, { fields: [payments.bankAccountId], references: [bankAccounts.id] }),
}));

// ============================================================================
// RECURRING TRANSACTIONS MODULE
// ============================================================================

export const recurringTransactions = pgTable('recurring_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  debitCredit: debitCreditEnum('debit_credit').notNull(),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  nextRunDate: date('next_run_date').notNull(),
  lastRunDate: date('last_run_date'),
  dayOfMonth: integer('day_of_month'), // 1-31 for monthly
  isActive: boolean('is_active').default(true),
  autoPost: boolean('auto_post').default(false), // if true, creates posted transaction; if false, creates draft
  totalRuns: integer('total_runs').default(0),
  maxRuns: integer('max_runs'), // null = unlimited
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_recurring_org').on(table.orgId),
  index('idx_recurring_account').on(table.accountId),
  index('idx_recurring_contact').on(table.contactId),
  index('idx_recurring_active').on(table.isActive).where(table.isActive.eq(true)),
  index('idx_recurring_next').on(table.nextRunDate),
  index('idx_recurring_freq').on(table.frequency),
]);

export const recurringTransactionsRelations = relations(recurringTransactions, ({ one }) => ({
  organization: one(organizations, { fields: [recurringTransactions.orgId], references: [organizations.id] }),
  account: one(chartOfAccounts, { fields: [recurringTransactions.accountId], references: [chartOfAccounts.id] }),
  contact: one(contacts, { fields: [recurringTransactions.contactId], references: [contacts.id] }),
}));

// ============================================================================
// EXPENSE MANAGEMENT MODULE
// ============================================================================

export const expenseReports = pgTable('expense_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  reportName: varchar('report_name', { length: 255 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: expenseStatusEnum('status').default('draft'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  reimbursedAmount: decimal('reimbursed_amount', { precision: 15, scale: 2 }).default('0'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_expense_report_org').on(table.orgId),
  index('idx_expense_report_employee').on(table.employeeId),
  index('idx_expense_report_status').on(table.status),
  index('idx_expense_report_period').on(table.periodStart, table.periodEnd),
]);

export const expenseReportsRelations = relations(expenseReports, ({ one, many }) => ({
  organization: one(organizations, { fields: [expenseReports.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [expenseReports.employeeId], references: [employees.id] }),
  reviewer: one(users, { fields: [expenseReports.reviewedBy], references: [users.id] }),
  approver: one(users, { fields: [expenseReports.approvedBy], references: [users.id] }),
  items: many(expenseItems),
}));

export const expenseItems = pgTable('expense_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  expenseReportId: uuid('expense_report_id').notNull().references(() => expenseReports.id, { onDelete: 'cascade' }),
  expenseDate: date('expense_date').notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(), // meals, travel, office, etc.
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  vendor: varchar('vendor', { length: 255 }),
  receiptPath: text('receipt_path'), // Supabase Storage path
  receiptUploaded: boolean('receipt_uploaded').default(false),
  isBillable: boolean('is_billable').default(false),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }), // if billable, linked to invoice
  mileage: decimal('mileage', { precision: 8, scale: 2 }), // if mileage expense
  approved: boolean('approved').default(false),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_expense_item_report').on(table.expenseReportId),
  index('idx_expense_item_org').on(table.orgId),
  index('idx_expense_item_date').on(table.expenseDate),
  index('idx_expense_item_category').on(table.category),
  index('idx_expense_item_invoice').on(table.invoiceId),
]);

export const expenseItemsRelations = relations(expenseItems, ({ one }) => ({
  expenseReport: one(expenseReports, { fields: [expenseItems.expenseReportId], references: [expenseReports.id] }),
  invoice: one(invoices, { fields: [expenseItems.invoiceId], references: [invoices.id] }),
  approver: one(users, { fields: [expenseItems.approvedBy], references: [users.id] }),
}));

// ============================================================================
// 1099 FORMS MODULE
// ============================================================================

export const form1099s = pgTable('form_1099s', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'restrict' }),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id, { onDelete: 'cascade' }),
  formType: form1099TypeEnum('form_type').notNull().default('nec'),
  formStatus: form1099StatusEnum('form_status').default('draft'),
  // Box 1 — Nonemployee compensation (NEC) or Other income (MISC)
  box1: decimal('box_1', { precision: 15, scale: 2 }).default('0'),
  // Box 2 — Reserved / Royalties
  box2: decimal('box_2', { precision: 15, scale: 2 }).default('0'),
  // Box 3 — Other income
  box3: decimal('box_3', { precision: 15, scale: 2 }).default('0'),
  // Box 4 — Federal income tax withheld
  box4: decimal('box_4', { precision: 15, scale: 2 }).default('0'),
  // Box 5 — Fishing boat proceeds
  box5: decimal('box_5', { precision: 15, scale: 2 }).default('0'),
  // Box 6 — Medical and health care payments
  box6: decimal('box_6', { precision: 15, scale: 2 }).default('0'),
  // Box 7 — Payer made direct sales of $5000 or more of consumer products
  box7DirectSales: boolean('box_7_direct_sales').default(false),
  // Box 8 — Substitute payments in lieu of dividends or interest
  box8: decimal('box_8', { precision: 15, scale: 2 }).default('0'),
  // Box 9 — Crop insurance proceeds
  box9: decimal('box_9', { precision: 15, scale: 2 }).default('0'),
  // Box 10 — Gross proceeds paid to an attorney
  box10: decimal('box_10', { precision: 15, scale: 2 }).default('0'),
  // Box 11 — Fish purchased for resale
  box11: decimal('box_11', { precision: 15, scale: 2 }).default('0'),
  // Box 13 — Excess golden parachute payments
  box13: decimal('box_13', { precision: 15, scale: 2 }).default('0'),
  // Box 14 — Nonqualified deferred compensation
  box14: decimal('box_14', { precision: 15, scale: 2 }).default('0'),
  // Box 15 — State tax withheld
  stateTaxes: jsonb('state_taxes').default('[]'),
  // Box 16 — State/Payer's state number
  stateInfo: jsonb('state_info').default('[]'),
  // Corrected form
  corrected1099Id: uuid('corrected_1099_id').references(() => form1099s.id, { onDelete: 'set null' }),
  // Distribution & filing
  copyDistributedAt: timestamp('copy_distributed_at', { withTimezone: true }),
  irsFiledAt: timestamp('irs_filed_at', { withTimezone: true }),
  generatedPdfPath: text('generated_pdf_path'),
  // Source data
  totalPayments: decimal('total_payments', { precision: 15, scale: 2 }).default('0'),
  paymentCount: integer('payment_count').default(0),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_1099_contact_year').on(table.contactId, table.taxYearId, table.formType),
  index('idx_1099_org').on(table.orgId),
  index('idx_1099_contact').on(table.contactId),
  index('idx_1099_year').on(table.taxYearId),
  index('idx_1099_status').on(table.formStatus),
  index('idx_1099_corrected').on(table.corrected1099Id),
]);

export const form1099sRelations = relations(form1099s, ({ one }) => ({
  organization: one(organizations, { fields: [form1099s.orgId], references: [organizations.id] }),
  contact: one(contacts, { fields: [form1099s.contactId], references: [contacts.id] }),
  taxYear: one(taxYears, { fields: [form1099s.taxYearId], references: [taxYears.id] }),
  corrected1099: one(form1099s, { fields: [form1099s.corrected1099Id], references: [form1099s.id] }),
}));
