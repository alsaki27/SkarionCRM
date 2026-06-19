import {
  pgTable, pgEnum, uuid, varchar, integer, boolean, timestamp, text, date, time,
  jsonb, numeric, index, uniqueIndex, inet, decimal, serial, primaryKey,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  billingEmail: varchar('billing_email', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  billingStatus: varchar('billing_status', { length: 50 }).default('active'),
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
  index('idx_users_active').on(table.isActive).where(sql`${table.isActive} = true`),
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
  index('idx_contacts_deleted').on(table.deletedAt).where(sql`${table.deletedAt} IS NULL`),
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
  index('idx_coa_active').on(table.isActive).where(sql`${table.isActive} = true`),
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
  index('idx_bank_active').on(table.isActive).where(sql`${table.isActive} = true`),
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
  index('idx_txn_reconciled').on(table.isReconciled).where(sql`${table.isReconciled} = false`),
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
  index('idx_comp_cat_active').on(table.isActive).where(sql`${table.isActive} = true`),
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
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
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
  user: one(users, { fields: [employees.userId], references: [users.id] }),
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
  index('idx_doc_template_active').on(table.isActive).where(sql`${table.isActive} = true`),
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
  index('idx_task_overdue').on(table.dueAt).where(sql`${table.status} NOT IN ('done', 'cancelled')`),
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
  index('idx_invoice_overdue').on(table.dueDate).where(sql`${table.status} NOT IN ('paid', 'cancelled', 'refunded')`),
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
  index('idx_recurring_active').on(table.isActive).where(sql`${table.isActive} = true`),
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

// ============================================================================
// SAAS FOUNDATION TABLES
// ============================================================================

export const planIntervalEnum = pgEnum('plan_interval', [
  'monthly', 'yearly', 'lifetime'
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'
]);

export const webhookStatusEnum = pgEnum('webhook_status', [
  'active', 'paused', 'disabled'
]);

export const apiKeyStatusEnum = pgEnum('api_key_status', [
  'active', 'revoked', 'expired'
]);

export const inviteStatusEnum = pgEnum('invite_status', [
  'pending', 'accepted', 'expired', 'revoked'
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'info', 'success', 'warning', 'error', 'mention', 'task', 'payment', 'compliance'
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app', 'email', 'sms', 'push', 'slack'
]);

export const activityTypeEnum = pgEnum('activity_type', [
  'login', 'logout', 'create', 'update', 'delete', 'invite', 'export', 'import',
  'payment', 'file_upload', 'file_download', 'settings_change', 'subscription_change',
  'invoice_sent', 'invoice_paid', 'invoice_overdue', 'payroll_run', 'tax_filed',
  'compliance_completed', 'w2_generated', '1099_generated', 'ai_action'
]);

export const integrationTypeEnum = pgEnum('integration_type', [
  'greenhouse', 'lever', 'workday', 'bamboohr', 'gusto', 'quickbooks', 'stripe', 'zapier', 'custom'
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'connected', 'disconnected', 'error', 'pending_auth'
]);

// Plans
export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }).default('0'),
  priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }).default('0'),
  interval: planIntervalEnum('interval').default('monthly'),
  maxUsers: integer('max_users').default(1),
  maxContacts: integer('max_contacts').default(100),
  maxEmployees: integer('max_employees').default(5),
  maxInvoices: integer('max_invoices').default(50),
  maxTransactions: integer('max_transactions').default(500),
  maxStorageMb: integer('max_storage_mb').default(100),
  features: jsonb('features').default('{}'), // feature flags config
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'restrict' }),
  status: subscriptionStatusEnum('status').default('trialing'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  trialStart: timestamp('trial_start', { withTimezone: true }),
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_sub_org').on(table.orgId),
  index('idx_sub_plan').on(table.planId),
  index('idx_sub_status').on(table.status),
]);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, { fields: [subscriptions.orgId], references: [organizations.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

// Webhook Endpoints
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  secret: text('secret'), // HMAC signature secret
  events: text('events').array().default('{}'), // ['invoice.created', 'payment.received', etc.]
  status: webhookStatusEnum('status').default('active'),
  lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  failureCount: integer('failure_count').default(0),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_webhook_org').on(table.orgId),
  index('idx_webhook_status').on(table.status),
]);

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  organization: one(organizations, { fields: [webhookEndpoints.orgId], references: [organizations.id] }),
}));

// Webhook Events (delivery log)
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  attemptCount: integer('attempt_count').default(1),
  maxAttempts: integer('max_attempts').default(5),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  signature: text('signature'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_webhook_event_org').on(table.orgId),
  index('idx_webhook_event_endpoint').on(table.endpointId),
  index('idx_webhook_event_type').on(table.eventType),
  index('idx_webhook_event_created').on(table.createdAt),
]);

export const webhookEventsRelations = relations(webhookEvents, ({ one }) => ({
  organization: one(organizations, { fields: [webhookEvents.orgId], references: [organizations.id] }),
  endpoint: one(webhookEndpoints, { fields: [webhookEvents.endpointId], references: [webhookEndpoints.id] }),
}));

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // e.g., "sk_"
  keyHash: text('key_hash').notNull(), // bcrypt hash of the key
  permissions: text('permissions').array().default('{}'), // ['read', 'write', 'admin']
  rateLimit: integer('rate_limit').default(1000), // requests per hour
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  status: apiKeyStatusEnum('status').default('active'),
  metadata: jsonb('metadata').default('{}'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_apikey_org').on(table.orgId),
  index('idx_apikey_status').on(table.status),
  index('idx_apikey_prefix').on(table.keyPrefix),
]);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, { fields: [apiKeys.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [apiKeys.createdBy], references: [users.id] }),
}));

// Feature Flags
export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(false),
  value: jsonb('value').default('{}'), // can store any config
  rolloutPercentage: integer('rollout_percentage').default(100), // 0-100
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_feature_org_key').on(table.orgId, table.key),
  index('idx_feature_org').on(table.orgId),
]);

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  organization: one(organizations, { fields: [featureFlags.orgId], references: [organizations.id] }),
}));

// Org Invites
export const orgInvites = pgTable('org_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('viewer'),
  token: text('token').notNull().unique(), // secure random token
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  status: inviteStatusEnum('status').default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_invite_token').on(table.token),
  index('idx_invite_org').on(table.orgId),
  index('idx_invite_email').on(table.email),
  index('idx_invite_status').on(table.status),
]);

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  organization: one(organizations, { fields: [orgInvites.orgId], references: [organizations.id] }),
  inviter: one(users, { fields: [orgInvites.invitedBy], references: [users.id] }),
  accepter: one(users, { fields: [orgInvites.acceptedBy], references: [users.id] }),
}));

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').default('info'),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  link: text('link'),
  entityType: varchar('entity_type', { length: 50 }), // 'invoice', 'task', etc.
  entityId: uuid('entity_id'),
  channels: notificationChannelEnum('channels').array().default('{}'),
  readAt: timestamp('read_at', { withTimezone: true }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_notif_user').on(table.userId),
  index('idx_notif_org').on(table.orgId),
  index('idx_notif_type').on(table.type),
  index('idx_notif_read').on(table.readAt),
  index('idx_notif_created').on(table.createdAt),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, { fields: [notifications.orgId], references: [organizations.id] }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// Activity Logs
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: varchar('actor_name', { length: 255 }), // denormalized for display
  actorType: varchar('actor_type', { length: 50 }).default('user'), // 'user', 'system', 'api', 'webhook'
  type: activityTypeEnum('type').notNull(),
  description: text('description').notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  entityName: varchar('entity_name', { length: 255 }), // denormalized
  metadata: jsonb('metadata').default('{}'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_activity_org').on(table.orgId),
  index('idx_activity_user').on(table.userId),
  index('idx_activity_type').on(table.type),
  index('idx_activity_entity').on(table.entityType, table.entityId),
  index('idx_activity_created').on(table.createdAt),
]);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  organization: one(organizations, { fields: [activityLogs.orgId], references: [organizations.id] }),
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

// Integrations (ATS, accounting, etc.)
export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: integrationTypeEnum('type').notNull(),
  status: integrationStatusEnum('status').default('pending_auth'),
  credentials: jsonb('credentials').default('{}'), // encrypted token storage
  config: jsonb('config').default('{}'), // user preferences
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncStatus: varchar('last_sync_status', { length: 50 }),
  lastSyncError: text('last_sync_error'),
  syncFrequency: varchar('sync_frequency', { length: 50 }).default('daily'), // manual, hourly, daily, realtime
  metadata: jsonb('metadata').default('{}'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_integration_org').on(table.orgId),
  index('idx_integration_type').on(table.type),
  index('idx_integration_status').on(table.status),
  uniqueIndex('idx_integration_org_type').on(table.orgId, table.type),
]);

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, { fields: [integrations.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [integrations.createdBy], references: [users.id] }),
}));

// Import Jobs (for CSV/ATS bulk imports)
export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'csv', 'greenhouse', 'lever', 'api'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'contacts', 'employees', 'transactions'
  filePath: text('file_path'), // for CSV uploads
  rawData: jsonb('raw_data').default('{}'), // preview of parsed data
  mappedFields: jsonb('mapped_fields').default('{}'), // column mappings
  status: varchar('status', { length: 50 }).default('pending'), // pending, processing, completed, failed, cancelled
  totalRows: integer('total_rows').default(0),
  processedRows: integer('processed_rows').default(0),
  successRows: integer('success_rows').default(0),
  errorRows: integer('error_rows').default(0),
  errors: jsonb('errors').default('[]'), // array of error details
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_import_org').on(table.orgId),
  index('idx_import_status').on(table.status),
  index('idx_import_type').on(table.entityType),
]);

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  organization: one(organizations, { fields: [importJobs.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [importJobs.createdBy], references: [users.id] }),
}));

// AI Prompts / Conversations
export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  model: varchar('model', { length: 100 }).default('gpt-4o'),
  messages: jsonb('messages').default('[]'), // array of {role, content, timestamp}
  summary: text('summary'), // AI-generated summary
  tokensUsed: integer('tokens_used').default(0),
  costEstimate: decimal('cost_estimate', { precision: 10, scale: 4 }).default('0'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_ai_conv_org').on(table.orgId),
  index('idx_ai_conv_user').on(table.userId),
  index('idx_ai_conv_created').on(table.createdAt),
]);

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  organization: one(organizations, { fields: [aiConversations.orgId], references: [organizations.id] }),
  user: one(users, { fields: [aiConversations.userId], references: [users.id] }),
}));

// ============================================================================
// TIMEKEEPING MODULE — Employee Timekeeping & Workforce Monitoring
// ============================================================================

export const timeEntryTypeEnum = pgEnum('time_entry_type', [
  'clock_in', 'clock_out', 'lunch_start', 'lunch_end', 'break_start', 'break_end', 'project_switch',
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present', 'absent', 'late', 'half_day', 'on_leave', 'remote', 'holiday', 'weekend',
]);

export const timesheetStatusEnum = pgEnum('timesheet_status', [
  'draft', 'submitted', 'approved', 'rejected',
]);

export const leaveTypeEnum = pgEnum('leave_type', [
  'vacation', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'jury_duty', 'unpaid', 'other',
]);

export const leaveStatusEnum = pgEnum('leave_status', [
  'pending', 'approved', 'rejected', 'cancelled',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'active', 'completed', 'on_hold', 'cancelled',
]);

export const shiftSwapStatusEnum = pgEnum('shift_swap_status', [
  'pending', 'approved', 'rejected', 'cancelled',
]);

// Work Schedules
export const workSchedules = pgTable('work_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  shiftStart: time('shift_start').notNull(), // e.g., "09:00"
  shiftEnd: time('shift_end').notNull(), // e.g., "17:00"
  breakDurationMinutes: integer('break_duration_minutes').default(60),
  workingDays: text('working_days').array().default('{}'), // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  overtimeThresholdDaily: decimal('overtime_threshold_daily', { precision: 5, scale: 2 }).default('8.00'), // hours
  overtimeThresholdWeekly: decimal('overtime_threshold_weekly', { precision: 5, scale: 2 }).default('40.00'), // hours
  gracePeriodMinutes: integer('grace_period_minutes').default(5),
  roundingIntervalMinutes: integer('rounding_interval_minutes').default(15),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_work_schedule_org').on(table.orgId),
  index('idx_work_schedule_active').on(table.isActive).where(sql`${table.isActive} = true`),
]);

export const workSchedulesRelations = relations(workSchedules, ({ one }) => ({
  organization: one(organizations, { fields: [workSchedules.orgId], references: [organizations.id] }),
}));

// Time Entries (clock in/out, lunch, breaks)
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  entryType: timeEntryTypeEnum('entry_type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  source: varchar('source', { length: 50 }).default('web'), // web, agent, manual, kiosk
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  activityScore: integer('activity_score').default(0), // 0-100
  screenshotId: uuid('screenshot_id'), // future desktop agent
  notes: text('notes'),
  ipAddress: inet('ip_address'),
  geoLocation: jsonb('geo_location').default('{}'), // { lat, lng, accuracy }
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_time_entry_org').on(table.orgId),
  index('idx_time_entry_employee').on(table.employeeId),
  index('idx_time_entry_date').on(table.timestamp),
  index('idx_time_entry_type').on(table.entryType),
  index('idx_time_entry_project').on(table.projectId),
]);

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  organization: one(organizations, { fields: [timeEntries.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [timeEntries.employeeId], references: [employees.id] }),
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
  task: one(projectTasks, { fields: [timeEntries.taskId], references: [projectTasks.id] }),
}));

// Attendance Records (daily roll call)
export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  status: attendanceStatusEnum('status').default('present'),
  clockIn: timestamp('clock_in', { withTimezone: true }),
  clockOut: timestamp('clock_out', { withTimezone: true }),
  totalHours: decimal('total_hours', { precision: 5, scale: 2 }).default('0'),
  breakHours: decimal('break_hours', { precision: 5, scale: 2 }).default('0'),
  overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
  lateMinutes: integer('late_minutes').default(0),
  earlyDepartureMinutes: integer('early_departure_minutes').default(0),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_attendance_emp_date').on(table.employeeId, table.date),
  index('idx_attendance_org').on(table.orgId),
  index('idx_attendance_date').on(table.date),
  index('idx_attendance_status').on(table.status),
]);

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  organization: one(organizations, { fields: [attendanceRecords.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [attendanceRecords.employeeId], references: [employees.id] }),
}));

// Timesheets (weekly summaries)
export const timesheets = pgTable('timesheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  status: timesheetStatusEnum('status').default('draft'),
  totalHours: decimal('total_hours', { precision: 5, scale: 2 }).default('0'),
  regularHours: decimal('regular_hours', { precision: 5, scale: 2 }).default('0'),
  overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
  breakHours: decimal('break_hours', { precision: 5, scale: 2 }).default('0'),
  billableHours: decimal('billable_hours', { precision: 5, scale: 2 }).default('0'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_timesheet_emp_week').on(table.employeeId, table.weekStart),
  index('idx_timesheet_org').on(table.orgId),
  index('idx_timesheet_status').on(table.status),
  index('idx_timesheet_employee').on(table.employeeId),
]);

export const timesheetsRelations = relations(timesheets, ({ one }) => ({
  organization: one(organizations, { fields: [timesheets.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [timesheets.employeeId], references: [employees.id] }),
  approver: one(users, { fields: [timesheets.approvedBy], references: [users.id] }),
}));

// Timesheet Entries (daily line items)
export const timesheetEntries = pgTable('timesheet_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  timesheetId: uuid('timesheet_id').notNull().references(() => timesheets.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  description: text('description'),
  hours: decimal('hours', { precision: 5, scale: 2 }).default('0'),
  isBillable: boolean('is_billable').default(true),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0'),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_ts_entry_timesheet').on(table.timesheetId),
  index('idx_ts_entry_org').on(table.orgId),
  index('idx_ts_entry_employee').on(table.employeeId),
  index('idx_ts_entry_date').on(table.date),
  index('idx_ts_entry_project').on(table.projectId),
]);

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one }) => ({
  timesheet: one(timesheets, { fields: [timesheetEntries.timesheetId], references: [timesheets.id] }),
  organization: one(organizations, { fields: [timesheetEntries.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [timesheetEntries.employeeId], references: [employees.id] }),
  project: one(projects, { fields: [timesheetEntries.projectId], references: [projects.id] }),
  task: one(projectTasks, { fields: [timesheetEntries.taskId], references: [projectTasks.id] }),
}));

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  clientId: uuid('client_id').references(() => contacts.id, { onDelete: 'set null' }), // link to contacts as client
  managerId: uuid('manager_id').references(() => users.id, { onDelete: 'set null' }), // project manager
  budgetHours: decimal('budget_hours', { precision: 10, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  status: projectStatusEnum('status').default('active'),
  isBillable: boolean('is_billable').default(true),
  startDate: date('start_date'),
  endDate: date('end_date'),
  color: varchar('color', { length: 7 }).default('#3b82f6'), // hex color for UI
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_project_org').on(table.orgId),
  index('idx_project_client').on(table.clientId),
  index('idx_project_status').on(table.status),
  index('idx_project_manager').on(table.managerId),
]);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  client: one(contacts, { fields: [projects.clientId], references: [contacts.id] }),
  manager: one(users, { fields: [projects.managerId], references: [users.id] }),
  tasks: many(projectTasks),
  timeEntries: many(projectTimeEntries),
}));

// Project Tasks
export const projectTasks = pgTable('project_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentTaskId: uuid('parent_task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  estimatedHours: decimal('estimated_hours', { precision: 10, scale: 2 }),
  status: varchar('status', { length: 50 }).default('active'), // active, completed, on_hold
  assignedTo: uuid('assigned_to').references(() => employees.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_proj_task_project').on(table.projectId),
  index('idx_proj_task_org').on(table.orgId),
  index('idx_proj_task_parent').on(table.parentTaskId),
  index('idx_proj_task_assigned').on(table.assignedTo),
]);

export const projectTasksRelations = relations(projectTasks, ({ one, many }) => ({
  project: one(projects, { fields: [projectTasks.projectId], references: [projects.id] }),
  organization: one(organizations, { fields: [projectTasks.orgId], references: [organizations.id] }),
  parent: one(projectTasks, { fields: [projectTasks.parentTaskId], references: [projectTasks.id] }),
  assignee: one(employees, { fields: [projectTasks.assignedTo], references: [employees.id] }),
  subtasks: many(projectTasks),
}));

// Project Time Entries (allocated time to projects)
export const projectTimeEntries = pgTable('project_time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull().default('0'),
  isBillable: boolean('is_billable').default(true),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0'),
  description: text('description'),
  notes: text('notes'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_proj_time_org').on(table.orgId),
  index('idx_proj_time_employee').on(table.employeeId),
  index('idx_proj_time_project').on(table.projectId),
  index('idx_proj_time_date').on(table.date),
  index('idx_proj_time_task').on(table.taskId),
]);

export const projectTimeEntriesRelations = relations(projectTimeEntries, ({ one }) => ({
  organization: one(organizations, { fields: [projectTimeEntries.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [projectTimeEntries.employeeId], references: [employees.id] }),
  project: one(projects, { fields: [projectTimeEntries.projectId], references: [projects.id] }),
  task: one(projectTasks, { fields: [projectTimeEntries.taskId], references: [projectTasks.id] }),
}));

// Leave Types
export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: leaveTypeEnum('type').notNull(),
  description: text('description'),
  isPaid: boolean('is_paid').default(true),
  requiresApproval: boolean('requires_approval').default(true),
  maxDaysPerYear: decimal('max_days_per_year', { precision: 5, scale: 2 }).default('10'),
  accrualRate: decimal('accrual_rate', { precision: 5, scale: 2 }).default('0'), // per pay period
  accrualPeriod: varchar('accrual_period', { length: 50 }).default('monthly'), // monthly, biweekly, annual, anniversary
  carryOverLimit: decimal('carry_over_limit', { precision: 5, scale: 2 }).default('5'),
  useItOrLoseIt: boolean('use_it_or_lose_it').default(false),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_leave_type_org').on(table.orgId),
  index('idx_leave_type_active').on(table.isActive).where(sql`${table.isActive} = true`),
]);

export const leaveTypesRelations = relations(leaveTypes, ({ one }) => ({
  organization: one(organizations, { fields: [leaveTypes.orgId], references: [organizations.id] }),
}));

// Leave Requests
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'restrict' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  daysRequested: decimal('days_requested', { precision: 5, scale: 2 }).notNull().default('1'),
  isHalfDay: boolean('is_half_day').default(false),
  halfDayType: varchar('half_day_type', { length: 20 }), // morning, afternoon
  status: leaveStatusEnum('status').default('pending'),
  reason: text('reason'),
  managerId: uuid('manager_id').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  sickNotePath: text('sick_note_path'), // document upload path
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_leave_req_org').on(table.orgId),
  index('idx_leave_req_employee').on(table.employeeId),
  index('idx_leave_req_status').on(table.status),
  index('idx_leave_req_dates').on(table.startDate, table.endDate),
  index('idx_leave_req_type').on(table.leaveTypeId),
  index('idx_leave_req_manager').on(table.managerId),
]);

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  organization: one(organizations, { fields: [leaveRequests.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
  leaveType: one(leaveTypes, { fields: [leaveRequests.leaveTypeId], references: [leaveTypes.id] }),
  manager: one(users, { fields: [leaveRequests.managerId], references: [users.id] }),
  approver: one(users, { fields: [leaveRequests.approvedBy], references: [users.id] }),
}));

// Leave Balances
export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id, { onDelete: 'cascade' }),
  totalEntitled: decimal('total_entitled', { precision: 5, scale: 2 }).default('0'),
  accrued: decimal('accrued', { precision: 5, scale: 2 }).default('0'),
  used: decimal('used', { precision: 5, scale: 2 }).default('0'),
  pending: decimal('pending', { precision: 5, scale: 2 }).default('0'),
  remaining: decimal('remaining', { precision: 5, scale: 2 }).default('0'),
  carryOver: decimal('carry_over', { precision: 5, scale: 2 }).default('0'),
  year: integer('year').notNull().default(2026),
  lastAccruedAt: timestamp('last_accrued_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_balance_emp_type_year').on(table.employeeId, table.leaveTypeId, table.year),
  index('idx_balance_org').on(table.orgId),
  index('idx_balance_employee').on(table.employeeId),
]);

export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  organization: one(organizations, { fields: [leaveBalances.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [leaveBalances.employeeId], references: [employees.id] }),
  leaveType: one(leaveTypes, { fields: [leaveBalances.leaveTypeId], references: [leaveTypes.id] }),
}));

// Holiday Calendars
export const holidayCalendars = pgTable('holiday_calendars', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  date: date('date').notNull(),
  type: varchar('type', { length: 50 }).default('public'), // public, company, floating, religious
  country: varchar('country', { length: 100 }),
  state: varchar('state', { length: 100 }),
  isPaid: boolean('is_paid').default(true),
  isRecurring: boolean('is_recurring').default(true), // repeats annually
  description: text('description'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_holiday_org').on(table.orgId),
  index('idx_holiday_date').on(table.date),
  index('idx_holiday_country').on(table.country),
]);

export const holidayCalendarsRelations = relations(holidayCalendars, ({ one }) => ({
  organization: one(organizations, { fields: [holidayCalendars.orgId], references: [organizations.id] }),
}));

// Shift Assignments
export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  scheduleId: uuid('schedule_id').notNull().references(() => workSchedules.id, { onDelete: 'cascade' }),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_shift_assign_org').on(table.orgId),
  index('idx_shift_assign_employee').on(table.employeeId),
  index('idx_shift_assign_schedule').on(table.scheduleId),
]);

export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one }) => ({
  organization: one(organizations, { fields: [shiftAssignments.orgId], references: [organizations.id] }),
  employee: one(employees, { fields: [shiftAssignments.employeeId], references: [employees.id] }),
  schedule: one(workSchedules, { fields: [shiftAssignments.scheduleId], references: [workSchedules.id] }),
}));

// Shift Swaps
export const shiftSwaps = pgTable('shift_swaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  requesterScheduleId: uuid('requester_schedule_id').notNull().references(() => workSchedules.id, { onDelete: 'cascade' }),
  recipientScheduleId: uuid('recipient_schedule_id').notNull().references(() => workSchedules.id, { onDelete: 'cascade' }),
  swapDate: date('swap_date').notNull(),
  status: shiftSwapStatusEnum('status').default('pending'),
  reason: text('reason'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_swap_org').on(table.orgId),
  index('idx_swap_requester').on(table.requesterId),
  index('idx_swap_recipient').on(table.recipientId),
  index('idx_swap_status').on(table.status),
  index('idx_swap_date').on(table.swapDate),
]);

export const shiftSwapsRelations = relations(shiftSwaps, ({ one }) => ({
  organization: one(organizations, { fields: [shiftSwaps.orgId], references: [organizations.id] }),
  requester: one(employees, { fields: [shiftSwaps.requesterId], references: [employees.id] }),
  recipient: one(employees, { fields: [shiftSwaps.recipientId], references: [employees.id] }),
  requesterSchedule: one(workSchedules, { fields: [shiftSwaps.requesterScheduleId], references: [workSchedules.id] }),
  recipientSchedule: one(workSchedules, { fields: [shiftSwaps.recipientScheduleId], references: [workSchedules.id] }),
  approver: one(users, { fields: [shiftSwaps.approvedBy], references: [users.id] }),
}));

