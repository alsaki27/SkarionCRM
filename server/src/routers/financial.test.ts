import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

describe('Financial Router', () => {
  let testOrg: any;
  let testUser: any;
  let caller: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    caller = appRouter.createCaller(createTestContext(testUser, testOrg.id));
  });

  describe('createAccount', () => {
    it('should create a chart of account', async () => {
      const result = await caller.financial.createAccount({
        code: `1000-${Date.now()}`,
        name: 'Cash Account',
        accountType: 'asset',
        description: 'Main cash account',
      });

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.name).toBe('Cash Account');
      expect(result.accountType).toBe('asset');
      expect(result.orgId).toBe(testOrg.id);
    });

    it('should reject duplicate account code', async () => {
      const code = `1001-${Date.now()}`;
      await caller.financial.createAccount({
        code,
        name: 'First Account',
        accountType: 'asset',
      });

      await expect(
        caller.financial.createAccount({
          code,
          name: 'Duplicate Account',
          accountType: 'liability',
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction', async () => {
      const account = await caller.financial.createAccount({
        code: `1100-${Date.now()}`,
        name: 'Bank Account',
        accountType: 'asset',
      });

      const result = await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'deposit',
        description: 'Test deposit',
        amount: '1000.00',
        debitCredit: 'debit',
        transactionDate: '2024-01-15',
      });

      expect(result).toBeDefined();
      expect(result.description).toBe('Test deposit');
      expect(result.amount).toBe('1000.00');
      expect(result.debitCredit).toBe('debit');
      expect(result.accountId).toBe(account.id);
    });
  });

  describe('listTransactions', () => {
    it('should list transactions with filters', async () => {
      const account = await caller.financial.createAccount({
        code: `1200-${Date.now()}`,
        name: 'Revenue Account',
        accountType: 'revenue',
      });

      await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'deposit',
        description: 'January revenue',
        amount: '5000.00',
        debitCredit: 'credit',
        transactionDate: '2024-01-01',
      });

      await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'deposit',
        description: 'February revenue',
        amount: '6000.00',
        debitCredit: 'credit',
        transactionDate: '2024-02-01',
      });

      const result = await caller.financial.listTransactions({
        accountId: account.id,
        limit: 10,
      });

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('balance calculations', () => {
    it('should calculate account balance correctly', async () => {
      const account = await caller.financial.createAccount({
        code: `1300-${Date.now()}`,
        name: 'Balance Test Account',
        accountType: 'asset',
      });

      // Create a debit transaction (increases asset balance)
      await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'deposit',
        description: 'Debit entry',
        amount: '1000.00',
        debitCredit: 'debit',
        transactionDate: '2024-01-01',
      });

      // Create a credit transaction (decreases asset balance)
      await caller.financial.createTransaction({
        accountId: account.id,
        transactionType: 'withdrawal',
        description: 'Credit entry',
        amount: '300.00',
        debitCredit: 'credit',
        transactionDate: '2024-01-02',
      });

      const balance = await caller.financial.getAccountBalance({ id: account.id });

      expect(balance.accountId).toBe(account.id);
      expect(balance.accountType).toBe('asset');
      expect(balance.normalBalance).toBe('debit');
      expect(balance.debitTotal).toBe(1000);
      expect(balance.creditTotal).toBe(300);
      expect(balance.balance).toBe(700);
    });
  });
});
