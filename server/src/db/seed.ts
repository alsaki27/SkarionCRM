import 'dotenv/config';
import { db } from './db/index.js';
import {
  organizations, users, chartOfAccounts, bankAccounts, taxYears,
  complianceCategories, documentTemplates, pipelineStages, programs, leadSources,
  contacts, employees, invoices, invoiceLines, payments, recurringTransactions,
  expenseReports, expenseItems, form1099s,
} from './db/schema.js';
import { authService } from '../services/auth.js';
import { eq } from 'drizzle-orm';

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

  // 8. Create contacts (customer + vendor)
  const [customer] = await db.insert(contacts).values({
    orgId: org.id,
    fullName: 'Acme Corp',
    email: 'billing@acme.com',
    phone: '+1-555-0100',
    contactType: 'customer',
    address: { street: '456 Commerce Ave', city: 'New York', state: 'NY', zip: '10002', country: 'US' },
    isActive: true,
  }).returning();

  const [vendor] = await db.insert(contacts).values({
    orgId: org.id,
    fullName: 'Freelance Design LLC',
    email: 'invoice@freelancedesign.com',
    phone: '+1-555-0200',
    contactType: 'vendor',
    is1099Recipient: true,
    taxId: '98-7654321',
    taxClassification: 'llc',
    address: { street: '789 Creative St', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US' },
    isActive: true,
  }).returning();
  console.log('Created 2 contacts');

  // 9. Create employee
  const [employee] = await db.insert(employees).values({
    orgId: org.id,
    firstName: 'Jane',
    lastName: 'Smith',
    fullName: 'Jane Smith',
    email: 'jane@democompany.com',
    phone: '+1-555-0300',
    hireDate: '2023-01-15',
    status: 'active',
    jobTitle: 'Sales Manager',
    department: 'Sales',
    payType: 'salary',
    payRate: '75000',
    payFrequency: 'biweekly',
    isActive: true,
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

  console.log('\nSeed complete!');
  console.log('Login with: admin@democompany.com / admin123');
  console.log('Organization: Demo Company');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
