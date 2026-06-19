// Stress test script - run with: npx tsx src/test/stress-test.ts
import { db } from '../db/index.js';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from './setup.js';
import { createTestOrg, createTestUser } from './factory.js';

async function stressTest() {
  console.log('Starting stress test...');
  const startTime = Date.now();

  // Create test org and user
  const org = await createTestOrg();
  const user = await createTestUser(org.id);
  const ctx = { user, orgId: org.id, db };
  const caller = appRouter.createCaller(ctx);

  const results = {
    contacts: { passed: 0, failed: 0, timeMs: 0 },
    transactions: { passed: 0, failed: 0, timeMs: 0 },
    invoices: { passed: 0, failed: 0, timeMs: 0 },
    employees: { passed: 0, failed: 0, timeMs: 0 },
    parallel: { passed: 0, failed: 0, timeMs: 0 },
    ai: { passed: 0, failed: 0, timeMs: 0 },
  };

  // Create base resources
  console.log('Creating base resources...');
  const account = await caller.financial.createAccount({
    code: `1000-STRESS-${Date.now()}`,
    name: 'Stress Test Cash Account',
    accountType: 'asset',
  });

  const contact = await caller.contact.create({
    fullName: 'Stress Test Client',
    email: `stress-client-${Date.now()}@example.com`,
    type: 'client',
  });

  // Test 1: Create 100 contacts rapidly
  console.log('Testing contact creation (100 contacts)...');
  const contactStart = Date.now();
  for (let i = 0; i < 100; i++) {
    try {
      await caller.contact.create({
        fullName: `Stress Contact ${i}`,
        email: `stress-${Date.now()}-${i}@example.com`,
        type: 'client',
      });
      results.contacts.passed++;
    } catch (e) {
      results.contacts.failed++;
      if (results.contacts.failed <= 3) {
        console.error(`Contact ${i} failed:`, e);
      }
    }
  }
  results.contacts.timeMs = Date.now() - contactStart;

  // Test 2: Create 100 transactions
  console.log('Testing transaction creation (100 transactions)...');
  const txnStart = Date.now();
  for (let i = 0; i < 100; i++) {
    try {
      await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'deposit',
        description: `Stress transaction ${i}`,
        amount: '100.00',
        debitCredit: 'debit',
        transactionDate: '2024-01-15',
      });
      results.transactions.passed++;
    } catch (e) {
      results.transactions.failed++;
      if (results.transactions.failed <= 3) {
        console.error(`Transaction ${i} failed:`, e);
      }
    }
  }
  results.transactions.timeMs = Date.now() - txnStart;

  // Test 3: Create 50 invoices with lines
  console.log('Testing invoice creation (50 invoices with lines)...');
  const invoiceStart = Date.now();
  for (let i = 0; i < 50; i++) {
    try {
      const subtotal = 1000;
      const tax = 80;
      const discount = 50;
      const total = subtotal + tax - discount;
      await caller.invoice.createInvoice({
        invoiceNumber: `INV-STRESS-${Date.now()}-${i}`,
        contactId: contact.id,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        subtotal: subtotal.toString(),
        taxAmount: tax.toString(),
        discountAmount: discount.toString(),
        totalAmount: total.toString(),
        lines: [
          {
            lineNumber: 1,
            description: 'Stress test line item',
            quantity: '1',
            unitPrice: '1000',
            amount: '1000',
          },
        ],
      });
      results.invoices.passed++;
    } catch (e) {
      results.invoices.failed++;
      if (results.invoices.failed <= 3) {
        console.error(`Invoice ${i} failed:`, e);
      }
    }
  }
  results.invoices.timeMs = Date.now() - invoiceStart;

  // Test 4: Create 50 employees
  console.log('Testing employee creation (50 employees)...');
  const empStart = Date.now();
  for (let i = 0; i < 50; i++) {
    try {
      await caller.employee.create({
        employeeId: `EMP-STRESS-${Date.now()}-${i}`,
        firstName: 'Stress',
        lastName: `Employee ${i}`,
        email: `stress-emp-${Date.now()}-${i}@example.com`,
        hireDate: '2024-01-01',
      });
      results.employees.passed++;
    } catch (e) {
      results.employees.failed++;
      if (results.employees.failed <= 3) {
        console.error(`Employee ${i} failed:`, e);
      }
    }
  }
  results.employees.timeMs = Date.now() - empStart;

  // Test 5: Parallel requests simulation
  console.log('Testing parallel requests (50 concurrent list calls)...');
  const parallelStart = Date.now();
  try {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(caller.contact.list({ limit: 10 }));
    }
    await Promise.all(promises);
    results.parallel.passed = 50;
  } catch (e) {
    results.parallel.failed = 50;
    console.error('Parallel requests failed:', e);
  }
  results.parallel.timeMs = Date.now() - parallelStart;

  // Test 6: AI endpoints
  console.log('Testing AI endpoints...');
  const aiStart = Date.now();
  try {
    const aiResult = await caller.ai.parseDocument({
      fileContent: 'Invoice for $1000 from Acme Corp',
      fileType: 'txt',
    });
    if (aiResult) {
      results.ai.passed++;
      console.log('AI parseDocument: OK');
    } else {
      results.ai.failed++;
      console.log('AI parseDocument: FAILED');
    }
  } catch (e) {
    results.ai.failed++;
    console.log('AI parseDocument: FAILED');
  }

  try {
    const suggestResult = await caller.ai.suggestAccount({
      description: 'Office supplies purchase',
      amount: 150,
    });
    if (suggestResult) {
      results.ai.passed++;
      console.log('AI suggestAccount: OK');
    } else {
      results.ai.failed++;
      console.log('AI suggestAccount: FAILED');
    }
  } catch (e) {
    results.ai.failed++;
    console.log('AI suggestAccount: FAILED');
  }
  results.ai.timeMs = Date.now() - aiStart;

  const totalTime = Date.now() - startTime;

  console.log('\n=== Stress Test Results ===');
  console.log(`Contacts:     ${results.contacts.passed} passed, ${results.contacts.failed} failed (${results.contacts.timeMs}ms)`);
  console.log(`Transactions: ${results.transactions.passed} passed, ${results.transactions.failed} failed (${results.transactions.timeMs}ms)`);
  console.log(`Invoices:     ${results.invoices.passed} passed, ${results.invoices.failed} failed (${results.invoices.timeMs}ms)`);
  console.log(`Employees:    ${results.employees.passed} passed, ${results.employees.failed} failed (${results.employees.timeMs}ms)`);
  console.log(`Parallel:     ${results.parallel.passed} passed, ${results.parallel.failed} failed (${results.parallel.timeMs}ms)`);
  console.log(`AI:           ${results.ai.passed} passed, ${results.ai.failed} failed (${results.ai.timeMs}ms)`);
  console.log(`\nTotal time: ${totalTime}ms`);
  console.log('\nStress test complete!');
  process.exit(0);
}

stressTest().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
