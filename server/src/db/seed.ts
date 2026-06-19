import 'dotenv/config';
import { db } from './index.js';
import {
  organizations, users, chartOfAccounts, bankAccounts, taxYears,
  complianceCategories, documentTemplates, pipelineStages, programs, leadSources,
  contacts, employees, invoices, invoiceLines, payments, recurringTransactions,
  expenseReports, expenseItems, form1099s, plans, subscriptions, workSchedules,
  timeEntries, attendanceRecords, timesheets, timesheetEntries, projects, projectTasks, projectTimeEntries,
  leaveTypes, leaveRequests, leaveBalances, holidayCalendars,
} from './schema.js';
import { authService } from '../services/auth.js';
import { eq, sql } from 'drizzle-orm';

async function seed() {
  console.log('Starting seed...');

  // Check if data already exists
  const existingOrg = await db.query.organizations.findFirst();
  if (existingOrg) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  // 1. Create default organization
  const [org] = await db.insert(organizations).values({
    name: 'Demo Company',
    slug: 'demo-company',
    taxId: '12-3456789',
    businessType: 'llc',
    industry: 'Technology',
    address: { street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
    phone: '+1-555-123-4567',
    email: 'admin@democompany.com',
    website: 'https://democompany.com',
    fiscalYearEnd: '12-31',
    timezone: 'America/New_York',
    currency: 'USD',
    plan: 'professional',
    status: 'active',
  }).returning();
  console.log('Created organization:', org.name);

  // 1.5 Create default plans
  const [freePlan] = await db.insert(plans).values({
    name: 'Free',
    slug: 'free',
    description: 'Perfect for freelancers and solo practitioners',
    priceMonthly: '0',
    priceYearly: '0',
    interval: 'monthly',
    maxUsers: 1,
    maxContacts: 50,
    maxEmployees: 3,
    maxInvoices: 20,
    maxTransactions: 200,
    maxStorageMb: 100,
    features: { invoicing: true, basicTax: true, basicReports: true, emailSupport: false, apiAccess: false, integrations: false, aiAssistant: false, advancedAnalytics: false },
    isActive: true,
    sortOrder: 1,
  }).returning();

  const [starterPlan] = await db.insert(plans).values({
    name: 'Starter',
    slug: 'starter',
    description: 'For small businesses getting serious about finances',
    priceMonthly: '29',
    priceYearly: '290',
    interval: 'monthly',
    maxUsers: 3,
    maxContacts: 500,
    maxEmployees: 10,
    maxInvoices: 200,
    maxTransactions: 2000,
    maxStorageMb: 1000,
    features: { invoicing: true, taxFiling: true, payroll: true, basicReports: true, emailSupport: true, apiAccess: false, integrations: true, aiAssistant: false, advancedAnalytics: false, webhookAccess: false },
    isActive: true,
    sortOrder: 2,
  }).returning();

  const [proPlan] = await db.insert(plans).values({
    name: 'Professional',
    slug: 'professional',
    description: 'Everything a growing business needs',
    priceMonthly: '79',
    priceYearly: '790',
    interval: 'monthly',
    maxUsers: 10,
    maxContacts: 5000,
    maxEmployees: 50,
    maxInvoices: 1000,
    maxTransactions: 10000,
    maxStorageMb: 5000,
    features: { invoicing: true, taxFiling: true, payroll: true, w2: true, form1099: true, advancedReports: true, emailSupport: true, prioritySupport: true, apiAccess: true, integrations: true, aiAssistant: true, advancedAnalytics: true, webhookAccess: true, customBranding: false, sso: false },
    isActive: true,
    sortOrder: 3,
  }).returning();

  const [enterprisePlan] = await db.insert(plans).values({
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations with complex needs',
    priceMonthly: '199',
    priceYearly: '1990',
    interval: 'monthly',
    maxUsers: 100,
    maxContacts: 50000,
    maxEmployees: 500,
    maxInvoices: 10000,
    maxTransactions: 100000,
    maxStorageMb: 50000,
    features: { invoicing: true, taxFiling: true, payroll: true, w2: true, form1099: true, advancedReports: true, emailSupport: true, prioritySupport: true, dedicatedSupport: true, apiAccess: true, integrations: true, aiAssistant: true, advancedAnalytics: true, webhookAccess: true, customBranding: true, sso: true, sla: true, whiteLabel: true },
    isActive: true,
    sortOrder: 4,
  }).returning();
  console.log('Created 4 pricing plans');

  // 1.6 Create subscription for demo org
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.insert(subscriptions).values({
    orgId: org.id,
    planId: proPlan.id,
    status: 'trialing',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialStart: now,
    trialEnd: trialEnd,
  });
  console.log('Created subscription for demo org (Professional plan, 14-day trial)');

  // 2. Create owner user
  const passwordHash = await authService.hashPassword('admin123');
  const [owner] = await db.insert(users).values({
    orgId: org.id,
    email: 'admin@democompany.com',
    fullName: 'Admin User',
    role: 'owner',
    phone: '+1-555-123-4567',
    passwordHash,
    isActive: true,
  }).returning();
  console.log('Created owner user:', owner.email);

  // 3. Create sample chart of accounts
  const coaData = [
    // Assets (1000-1999)
    { code: '1000', name: 'Cash', accountType: 'asset', accountSubtype: 'current_asset', level: 1, isActive: true },
    { code: '1010', name: 'Checking Account', accountType: 'asset', accountSubtype: 'current_asset', level: 2, parentId: null, isActive: true },
    { code: '1020', name: 'Savings Account', accountType: 'asset', accountSubtype: 'current_asset', level: 2, parentId: null, isActive: true },
    { code: '1100', name: 'Accounts Receivable', accountType: 'asset', accountSubtype: 'current_asset', level: 1, isActive: true },
    { code: '1200', name: 'Inventory', accountType: 'asset', accountSubtype: 'current_asset', level: 1, isActive: true },
    { code: '1500', name: 'Equipment', accountType: 'asset', accountSubtype: 'fixed_asset', level: 1, isActive: true },
    { code: '1600', name: 'Accumulated Depreciation', accountType: 'asset', accountSubtype: 'fixed_asset', level: 1, isActive: true },
    
    // Liabilities (2000-2999)
    { code: '2000', name: 'Accounts Payable', accountType: 'liability', accountSubtype: 'current_liability', level: 1, isActive: true },
    { code: '2100', name: 'Wages Payable', accountType: 'liability', accountSubtype: 'current_liability', level: 1, isActive: true },
    { code: '2200', name: 'Taxes Payable', accountType: 'liability', accountSubtype: 'current_liability', level: 1, isActive: true },
    { code: '2300', name: 'Notes Payable', accountType: 'liability', accountSubtype: 'long_term_liability', level: 1, isActive: true },
    
    // Equity (3000-3999)
    { code: '3000', name: 'Owner Equity', accountType: 'equity', accountSubtype: 'equity', level: 1, isActive: true },
    { code: '3100', name: 'Retained Earnings', accountType: 'equity', accountSubtype: 'equity', level: 1, isActive: true },
    { code: '3200', name: 'Common Stock', accountType: 'equity', accountSubtype: 'equity', level: 1, isActive: true },
    
    // Revenue (4000-4999)
    { code: '4000', name: 'Sales Revenue', accountType: 'revenue', accountSubtype: 'operating_revenue', level: 1, isActive: true },
    { code: '4100', name: 'Service Revenue', accountType: 'revenue', accountSubtype: 'operating_revenue', level: 1, isActive: true },
    { code: '4200', name: 'Interest Income', accountType: 'revenue', accountSubtype: 'non_operating_revenue', level: 1, isActive: true },
    
    // Expenses (5000-5999)
    { code: '5000', name: 'Cost of Goods Sold', accountType: 'expense', accountSubtype: 'cost_of_goods_sold', level: 1, isActive: true },
    { code: '5100', name: 'Rent Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5200', name: 'Wages Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5300', name: 'Utilities Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5400', name: 'Depreciation Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5500', name: 'Marketing Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5600', name: 'Insurance Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5700', name: 'Office Supplies', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5800', name: 'Professional Fees', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
    { code: '5900', name: 'Travel Expense', accountType: 'expense', accountSubtype: 'operating_expense', level: 1, isActive: true },
  ];

  const createdAccounts = [];
  for (const account of coaData) {
    const [created] = await db.insert(chartOfAccounts).values({
      orgId: org.id,
      ...account,
    }).returning();
    createdAccounts.push(created);
  }
  console.log('Created', createdAccounts.length, 'chart of accounts');

  // 4. Create sample bank accounts
  const [bank1] = await db.insert(bankAccounts).values({
    orgId: org.id,
    accountName: 'Primary Checking',
    bankName: 'Chase Bank',
    accountType: 'checking',
    currency: 'USD',
    openingBalance: '10000.00',
    currentBalance: '10000.00',
    isActive: true,
  }).returning();

  const [bank2] = await db.insert(bankAccounts).values({
    orgId: org.id,
    accountName: 'Savings',
    bankName: 'Chase Bank',
    accountType: 'savings',
    currency: 'USD',
    openingBalance: '25000.00',
    currentBalance: '25000.00',
    isActive: true,
  }).returning();
  console.log('Created', 2, 'bank accounts');

  // 5. Create tax year
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const [taxYear] = await db.insert(taxYears).values({
    orgId: org.id,
    year: currentYear,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
    status: 'open',
    formTypes: ['w2', '1099_nec', '940', '941'],
  }).returning();
  console.log('Created tax year:', taxYear.year);

  // 6. Create compliance categories
  const complianceCats = [
    { name: 'IRS Tax Filing', description: 'Federal tax filing requirements', regulatoryBody: 'IRS', frequency: 'annual', priority: 'critical' },
    { name: 'State Tax Filing', description: 'State tax filing requirements', regulatoryBody: 'State DOR', frequency: 'annual', priority: 'high' },
    { name: 'Payroll Tax Deposits', description: 'Federal and state payroll tax deposits', regulatoryBody: 'IRS/State', frequency: 'monthly', priority: 'critical' },
    { name: 'Form 941 Filing', description: 'Quarterly payroll tax returns', regulatoryBody: 'IRS', frequency: 'quarterly', priority: 'high' },
    { name: 'Workers Compensation', description: 'Workers comp insurance compliance', regulatoryBody: 'State', frequency: 'annual', priority: 'high' },
    { name: 'Annual Report', description: 'Corporate annual report filing', regulatoryBody: 'Secretary of State', frequency: 'annual', priority: 'medium' },
    { name: 'OSHA Reporting', description: 'Workplace safety reporting', regulatoryBody: 'OSHA', frequency: 'annual', priority: 'medium' },
  ];

  for (const cat of complianceCats) {
    await db.insert(complianceCategories).values({
      orgId: org.id,
      ...cat,
    });
  }
  console.log('Created', complianceCats.length, 'compliance categories');

  // 7. Create document templates
  const templates = [
    { name: 'W-2 Form Template', templateType: 'w2', description: 'Standard W-2 wage and tax statement template', isActive: true },
    { name: '1099-NEC Template', templateType: '1099', description: 'Non-employee compensation template', isActive: true },
    { name: 'Pay Stub Template', templateType: 'paystub', description: 'Employee pay stub template', isActive: true },
    { name: 'Invoice Template', templateType: 'invoice', description: 'Customer invoice template', isActive: true },
  ];

  for (const template of templates) {
    await db.insert(documentTemplates).values({
      orgId: org.id,
      ...template,
    });
  }
  console.log('Created', templates.length, 'document templates');

  // 8. Create contacts (client + vendor)
  const [customer] = await db.insert(contacts).values({
    orgId: org.id,
    fullName: 'Acme Corp',
    email: 'billing@acme.com',
    phone: '+1-555-0100',
    type: 'client',
    status: 'active',
    address: { street: '456 Commerce Ave', city: 'New York', state: 'NY', zip: '10002', country: 'US' },
  }).returning();

  const [vendor] = await db.insert(contacts).values({
    orgId: org.id,
    fullName: 'Freelance Design LLC',
    email: 'invoice@freelancedesign.com',
    phone: '+1-555-0200',
    type: 'vendor',
    status: 'active',
    taxId: '98-7654321',
    address: { street: '789 Creative St', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US' },
  }).returning();
  console.log('Created 2 contacts');

  // 9. Create employee
  const [employee] = await db.insert(employees).values({
    orgId: org.id,
    employeeId: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@democompany.com',
    phone: '+1-555-0300',
    hireDate: '2023-01-15',
    status: 'active',
    employmentType: 'full_time',
    jobTitle: 'Sales Manager',
    department: 'Sales',
    payType: 'salary',
    payRate: '75000',
    payFrequency: 'biweekly',
  }).returning();
  console.log('Created employee:', employee.fullName);

  // 10. Create sample invoice
  const [invoice] = await db.insert(invoices).values({
    orgId: org.id,
    invoiceNumber: 'INV-001',
    contactId: customer.id,
    issueDate: `${currentYear}-01-15`,
    dueDate: `${currentYear}-02-15`,
    status: 'sent',
    subtotal: '2500.00',
    taxAmount: '200.00',
    discountAmount: '0',
    totalAmount: '2700.00',
    amountPaid: '1000.00',
    amountDue: '1700.00',
    taxRate: '8.00',
    terms: 'Net 30',
    poNumber: 'PO-2024-001',
    notes: 'Website redesign project - Phase 1',
    footer: 'Thank you for your business!',
  }).returning();

  await db.insert(invoiceLines).values([
    { orgId: org.id, invoiceId: invoice.id, lineNumber: 1, description: 'Website design', quantity: '1', unitPrice: '1500.00', amount: '1500.00', taxRate: '8.00', taxAmount: '120.00' },
    { orgId: org.id, invoiceId: invoice.id, lineNumber: 2, description: 'Development hours', quantity: '20', unitPrice: '50.00', amount: '1000.00', taxRate: '8.00', taxAmount: '80.00' },
  ]);

  await db.insert(payments).values({
    orgId: org.id,
    invoiceId: invoice.id,
    contactId: customer.id,
    paymentDate: `${currentYear}-01-20`,
    amount: '1000.00',
    paymentMethod: 'ach',
    referenceNumber: 'ACH-001',
    memo: 'Partial payment',
    bankAccountId: bank1.id,
  });
  console.log('Created invoice INV-001 with 2 lines and 1 payment');

  // 11. Create recurring transaction (monthly rent)
  const [recurring] = await db.insert(recurringTransactions).values({
    orgId: org.id,
    name: 'Monthly Office Rent',
    description: 'Automatic monthly rent payment',
    accountId: createdAccounts.find(a => a.code === '5100')!.id,
    transactionType: 'withdrawal',
    amount: '3500.00',
    debitCredit: 'debit',
    frequency: 'monthly',
    startDate: `${currentYear}-01-01`,
    nextRunDate: `${currentYear}-02-01`,
    dayOfMonth: 1,
    isActive: true,
    autoPost: true,
    totalRuns: 1,
    maxRuns: 24,
  }).returning();
  console.log('Created recurring transaction:', recurring.name);

  // 12. Create expense report
  const [expenseReport] = await db.insert(expenseReports).values({
    orgId: org.id,
    employeeId: employee.id,
    reportName: 'January 2024 Travel',
    periodStart: `${currentYear}-01-01`,
    periodEnd: `${currentYear}-01-31`,
    status: 'approved',
    totalAmount: '850.00',
    reimbursedAmount: '850.00',
    submittedAt: new Date(`${currentYear}-01-25T10:00:00Z`),
    approvedAt: new Date(`${currentYear}-01-26T14:00:00Z`),
    notes: 'Client meeting in Chicago',
  }).returning();

  await db.insert(expenseItems).values([
    { orgId: org.id, expenseReportId: expenseReport.id, expenseDate: `${currentYear}-01-10`, description: 'Flight to Chicago', category: 'Travel', amount: '450.00', taxAmount: '36.00', vendor: 'United Airlines', receiptUploaded: true },
    { orgId: org.id, expenseReportId: expenseReport.id, expenseDate: `${currentYear}-01-10`, description: 'Hotel - 2 nights', category: 'Lodging', amount: '280.00', taxAmount: '22.40', vendor: 'Marriott', receiptUploaded: true },
    { orgId: org.id, expenseReportId: expenseReport.id, expenseDate: `${currentYear}-01-11`, description: 'Client dinner', category: 'Meals', amount: '120.00', taxAmount: '9.60', vendor: 'Steakhouse', receiptUploaded: true },
  ]);
  console.log('Created expense report with 3 items');

  // 13. Create Form 1099-NEC
  await db.insert(payments).values({
    orgId: org.id,
    contactId: vendor.id,
    paymentDate: `${currentYear}-06-15`,
    amount: '3500.00',
    paymentMethod: 'ach',
    referenceNumber: 'VENDOR-001',
    memo: 'Brand design project',
  });
  await db.insert(payments).values({
    orgId: org.id,
    contactId: vendor.id,
    paymentDate: `${currentYear}-09-20`,
    amount: '2800.00',
    paymentMethod: 'ach',
    referenceNumber: 'VENDOR-002',
    memo: 'Marketing collateral',
  });

  const [form1099] = await db.insert(form1099s).values({
    orgId: org.id,
    contactId: vendor.id,
    taxYearId: taxYear.id,
    formType: 'nec',
    formStatus: 'draft',
    box1: '6300.00',
    totalPayments: '6300.00',
    paymentCount: 2,
  }).returning();
  console.log('Created Form 1099-NEC for', vendor.fullName);

  // ===== 14. TIMEKEEPING MODULE SEED DATA =====

  // 14.1 Create more employees for team presence
  const employeeData = [
    { employeeId: 'EMP-002', firstName: 'John', lastName: 'Doe', email: 'john@democompany.com', jobTitle: 'Software Engineer', department: 'Engineering', hireDate: '2023-03-01', status: 'active', employmentType: 'full_time', payType: 'salary', payRate: '90000', payFrequency: 'biweekly' },
    { employeeId: 'EMP-003', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@democompany.com', jobTitle: 'HR Specialist', department: 'Human Resources', hireDate: '2023-06-15', status: 'active', employmentType: 'full_time', payType: 'salary', payRate: '65000', payFrequency: 'biweekly' },
    { employeeId: 'EMP-004', firstName: 'Mike', lastName: 'Brown', email: 'mike@democompany.com', jobTitle: 'Product Designer', department: 'Design', hireDate: '2023-09-01', status: 'active', employmentType: 'full_time', payType: 'salary', payRate: '80000', payFrequency: 'biweekly' },
  ];

  const createdEmployees = [employee];
  for (const emp of employeeData) {
    const [e] = await db.insert(employees).values({
      orgId: org.id,
      ...emp,
    }).returning();
    createdEmployees.push(e);
  }
  console.log('Created', createdEmployees.length, 'employees');

  // 14.2 Create work schedule
  const [schedule] = await db.insert(workSchedules).values({
    orgId: org.id,
    name: 'Standard Week',
    shiftStart: '09:00',
    shiftEnd: '17:00',
    breakDuration: 60,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    dailyOvertimeThreshold: 8,
    weeklyOvertimeThreshold: 40,
    gracePeriod: 15,
    roundingInterval: 15,
    isActive: true,
  }).returning();
  console.log('Created work schedule:', schedule.name);

  // 14.3 Create time entries (clock in/out for past 5 days)
  const timeEntryData = [];
  for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // Skip weekends
    const dateStr = day.toISOString().split('T')[0];
    for (const emp of createdEmployees) {
      // Clock in at 9:00
      const [entryIn] = await db.insert(timeEntries).values({
        orgId: org.id,
        employeeId: emp.id,
        entryDate: dateStr,
        entryType: 'clock_in',
        timeStamp: new Date(`${dateStr}T09:00:00Z`),
        location: 'Office',
        device: 'Web',
      }).returning();
      // Start break at 12:30
      await db.insert(timeEntries).values({
        orgId: org.id,
        employeeId: emp.id,
        entryDate: dateStr,
        entryType: 'break_start',
        timeStamp: new Date(`${dateStr}T12:30:00Z`),
      });
      // End break at 13:30
      await db.insert(timeEntries).values({
        orgId: org.id,
        employeeId: emp.id,
        entryDate: dateStr,
        entryType: 'break_end',
        timeStamp: new Date(`${dateStr}T13:30:00Z`),
      });
      // Clock out at 17:00 (or 18:00 for some overtime)
      const outTime = emp.id === createdEmployees[0].id ? '18:00' : '17:00';
      await db.insert(timeEntries).values({
        orgId: org.id,
        employeeId: emp.id,
        entryDate: dateStr,
        entryType: 'clock_out',
        timeStamp: new Date(`${dateStr}T${outTime}:00Z`),
      });
      // Project time entry for some employees
      if (emp.id === createdEmployees[0].id || emp.id === createdEmployees[3].id) {
        await db.insert(timeEntries).values({
          orgId: org.id,
          employeeId: emp.id,
          entryDate: dateStr,
          entryType: 'project_time',
          timeStamp: new Date(`${dateStr}T14:00:00Z`),
        });
      }
    }
  }
  console.log('Created time entries for past 5 weekdays');

  // 14.4 Create attendance records
  for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const dateStr = day.toISOString().split('T')[0];
    for (const emp of createdEmployees) {
      const isLate = emp.id === createdEmployees[1].id;
      const isOvertime = emp.id === createdEmployees[0].id;
      const inTime = isLate ? '09:20' : '09:00';
      const outTime = isOvertime ? '18:00' : '17:00';
      const regularHours = isOvertime ? '8' : '8';
      const overtimeHours = isOvertime ? '1' : '0';
      await db.insert(attendanceRecords).values({
        orgId: org.id,
        employeeId: emp.id,
        date: dateStr,
        status: 'present',
        clockIn: inTime,
        clockOut: outTime,
        breakDuration: 60,
        regularHours,
        overtimeHours,
        totalHours: isOvertime ? '9' : '8',
        isLate,
        isOvertime: isOvertime,
      });
    }
  }
  console.log('Created attendance records');

  // 14.5 Create timesheets (last 2 weeks)
  for (let w = 0; w < 2; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1 - (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    for (const emp of createdEmployees) {
      const [ts] = await db.insert(timesheets).values({
        orgId: org.id,
        employeeId: emp.id,
        weekStartDate: weekStartStr,
        weekEndDate: weekEndStr,
        totalHours: w === 0 ? '40' : '40',
        regularHours: '40',
        overtimeHours: '0',
        breakHours: '5',
        billableHours: emp.id === createdEmployees[0].id ? '20' : '0',
        status: w === 0 ? 'draft' : 'approved',
      }).returning();
      // Add daily entries for Mon-Fri
      for (let d = 0; d < 5; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        const dayStr = day.toISOString().split('T')[0];
        await db.insert(timesheetEntries).values({
          orgId: org.id,
          timesheetId: ts.id,
          employeeId: emp.id,
          date: dayStr,
          clockIn: '09:00',
          clockOut: '17:00',
          breakDuration: 60,
          regularHours: '8',
          overtimeHours: '0',
          totalHours: '8',
        });
      }
    }
  }
  console.log('Created timesheets for 2 weeks');

  // 14.6 Create leave types
  const leaveTypeData = [
    { name: 'Vacation', type: 'vacation', isPaid: true, requiresApproval: true, maxDaysPerYear: 15, accrualRate: '1.25', accrualPeriod: 'monthly', carryOverLimit: 5, useItOrLoseIt: false },
    { name: 'Sick Leave', type: 'sick', isPaid: true, requiresApproval: false, maxDaysPerYear: 10, accrualRate: '0.83', accrualPeriod: 'monthly', carryOverLimit: 0, useItOrLoseIt: true },
    { name: 'Personal Day', type: 'personal', isPaid: true, requiresApproval: true, maxDaysPerYear: 5, accrualRate: '0.42', accrualPeriod: 'monthly', carryOverLimit: 2, useItOrLoseIt: false },
    { name: 'Maternity Leave', type: 'maternity', isPaid: true, requiresApproval: true, maxDaysPerYear: 60, carryOverLimit: 0, useItOrLoseIt: false },
    { name: 'Bereavement', type: 'bereavement', isPaid: true, requiresApproval: true, maxDaysPerYear: 5, carryOverLimit: 0, useItOrLoseIt: false },
  ];

  const createdLeaveTypes = [];
  for (const lt of leaveTypeData) {
    const [created] = await db.insert(leaveTypes).values({
      orgId: org.id,
      ...lt,
    }).returning();
    createdLeaveTypes.push(created);
  }
  console.log('Created', createdLeaveTypes.length, 'leave types');

  // 14.7 Create leave balances for each employee
  for (const emp of createdEmployees) {
    for (const lt of createdLeaveTypes) {
      await db.insert(leaveBalances).values({
        orgId: org.id,
        employeeId: emp.id,
        leaveTypeId: lt.id,
        year: currentYear,
        totalEntitled: lt.maxDaysPerYear?.toString() || '0',
        accrued: (lt.maxDaysPerYear || 0).toString(),
        used: '0',
        pending: '0',
        carryOver: '0',
        remaining: (lt.maxDaysPerYear || 0).toString(),
      });
    }
  }
  console.log('Created leave balances');

  // 14.8 Create leave requests
  // Pending request
  const [pendingRequest] = await db.insert(leaveRequests).values({
    orgId: org.id,
    employeeId: createdEmployees[0].id,
    leaveTypeId: createdLeaveTypes[0].id,
    startDate: `${currentYear}-07-15`,
    endDate: `${currentYear}-07-18`,
    daysRequested: '4',
    isHalfDay: false,
    reason: 'Family vacation to Florida',
    status: 'pending',
  }).returning();
  // Update balance pending
  await db.update(leaveBalances).set({
    pending: '4',
    remaining: sql`CAST(${leaveBalances.remaining} AS NUMERIC) - 4`,
  }).where(eq(leaveBalances.employeeId, createdEmployees[0].id)).where(eq(leaveBalances.leaveTypeId, createdLeaveTypes[0].id));

  // Approved request
  const [approvedRequest] = await db.insert(leaveRequests).values({
    orgId: org.id,
    employeeId: createdEmployees[1].id,
    leaveTypeId: createdLeaveTypes[0].id,
    startDate: `${currentYear}-06-01`,
    endDate: `${currentYear}-06-05`,
    daysRequested: '5',
    isHalfDay: false,
    reason: 'Summer vacation',
    status: 'approved',
    approvedBy: owner.id,
    approvedAt: new Date(`${currentYear}-05-15T10:00:00Z`),
  }).returning();
  // Update balance used
  await db.update(leaveBalances).set({
    used: '5',
    remaining: sql`CAST(${leaveBalances.remaining} AS NUMERIC) - 5`,
  }).where(eq(leaveBalances.employeeId, createdEmployees[1].id)).where(eq(leaveBalances.leaveTypeId, createdLeaveTypes[0].id));

  // Rejected request
  await db.insert(leaveRequests).values({
    orgId: org.id,
    employeeId: createdEmployees[2].id,
    leaveTypeId: createdLeaveTypes[1].id,
    startDate: `${currentYear}-05-20`,
    endDate: `${currentYear}-05-21`,
    daysRequested: '2',
    isHalfDay: false,
    reason: 'Not feeling well',
    status: 'rejected',
    rejectionReason: 'Insufficient documentation provided',
  });
  console.log('Created 3 leave requests (pending, approved, rejected)');

  // 14.9 Create holidays
  const holidayData = [
    { date: `${currentYear}-01-01`, name: 'New Year\'s Day', type: 'public', country: 'US', state: 'ALL', isPaid: true, isRecurring: true },
    { date: `${currentYear}-07-04`, name: 'Independence Day', type: 'public', country: 'US', state: 'ALL', isPaid: true, isRecurring: true },
    { date: `${currentYear}-12-25`, name: 'Christmas Day', type: 'public', country: 'US', state: 'ALL', isPaid: true, isRecurring: true },
    { date: `${currentYear}-11-28`, name: 'Thanksgiving Day', type: 'public', country: 'US', state: 'ALL', isPaid: true, isRecurring: true },
    { date: `${currentYear}-09-01`, name: 'Labor Day', type: 'public', country: 'US', state: 'ALL', isPaid: true, isRecurring: true },
  ];
  for (const h of holidayData) {
    await db.insert(holidayCalendars).values({
      orgId: org.id,
      ...h,
    });
  }
  console.log('Created', holidayData.length, 'holidays');

  // 14.10 Create projects
  const [project1] = await db.insert(projects).values({
    orgId: org.id,
    name: 'Website Redesign',
    description: 'Complete redesign of company website with new CMS',
    clientId: customer.id,
    managerId: owner.id,
    status: 'active',
    budgetHours: '200',
    hourlyRate: '75',
    isBillable: true,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-06-30`,
    color: '#3B82F6',
  }).returning();

  const [project2] = await db.insert(projects).values({
    orgId: org.id,
    name: 'Internal CRM Upgrade',
    description: 'Internal tools and CRM system upgrade project',
    managerId: owner.id,
    status: 'active',
    budgetHours: '500',
    hourlyRate: '0',
    isBillable: false,
    startDate: `${currentYear}-01-15`,
    endDate: `${currentYear}-12-31`,
    color: '#10B981',
  }).returning();
  console.log('Created 2 projects');

  // 14.11 Create project tasks
  const taskData = [
    { projectId: project1.id, name: 'Design mockups', description: 'Create initial design mockups', estimatedHours: '40', dueDate: `${currentYear}-02-15`, status: 'in_progress', assignedTo: createdEmployees[3].id },
    { projectId: project1.id, name: 'Frontend development', description: 'Build React frontend', estimatedHours: '100', dueDate: `${currentYear}-04-30`, status: 'todo', assignedTo: createdEmployees[0].id },
    { projectId: project1.id, name: 'Content migration', description: 'Migrate existing content', estimatedHours: '60', dueDate: `${currentYear}-05-15`, status: 'todo', assignedTo: createdEmployees[1].id },
    { projectId: project2.id, name: 'Database migration', description: 'Migrate to new database schema', estimatedHours: '80', dueDate: `${currentYear}-03-30`, status: 'in_progress', assignedTo: createdEmployees[0].id },
    { projectId: project2.id, name: 'API integration', description: 'Build REST API endpoints', estimatedHours: '120', dueDate: `${currentYear}-06-30`, status: 'todo', assignedTo: createdEmployees[0].id },
  ];
  const createdTasks = [];
  for (const t of taskData) {
    const [task] = await db.insert(projectTasks).values({
      orgId: org.id,
      ...t,
    }).returning();
    createdTasks.push(task);
  }
  console.log('Created', createdTasks.length, 'project tasks');

  // 14.12 Create project time entries
  for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const dateStr = day.toISOString().split('T')[0];
    // Project 1 entries (designer + engineer)
    await db.insert(projectTimeEntries).values({
      orgId: org.id,
      employeeId: createdEmployees[3].id,
      projectId: project1.id,
      taskId: createdTasks[0].id,
      date: dateStr,
      hours: '3',
      isBillable: true,
      hourlyRate: '75',
      totalAmount: '225',
      description: 'Design mockup work',
    });
    await db.insert(projectTimeEntries).values({
      orgId: org.id,
      employeeId: createdEmployees[0].id,
      projectId: project1.id,
      taskId: createdTasks[1].id,
      date: dateStr,
      hours: '2',
      isBillable: true,
      hourlyRate: '75',
      totalAmount: '150',
      description: 'Frontend setup and component library',
    });
    // Project 2 entries (engineer)
    await db.insert(projectTimeEntries).values({
      orgId: org.id,
      employeeId: createdEmployees[0].id,
      projectId: project2.id,
      taskId: createdTasks[3].id,
      date: dateStr,
      hours: '2',
      isBillable: false,
      hourlyRate: '0',
      totalAmount: '0',
      description: 'Schema design and migration planning',
    });
  }
  console.log('Created project time entries');

  console.log('\nSeed complete!');
  console.log('Login with: admin@democompany.com / admin123');
  console.log('Organization: Demo Company');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
