import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import {
  chartOfAccounts,
  bankAccounts,
  transactions,
  journalEntries,
  journalEntryLines,
} from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const financialRouter = router({
  // ─── Chart of Accounts ───
  listAccounts: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          type: z.string().optional(),
          search: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(chartOfAccounts.orgId, ctx.orgId!)];

      if (input.type) conditions.push(eq(chartOfAccounts.accountType, input.type as any));
      if (input.isActive !== undefined) conditions.push(eq(chartOfAccounts.isActive, input.isActive));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(chartOfAccounts.name, pattern),
            ilike(chartOfAccounts.code, pattern),
            ilike(chartOfAccounts.accountSubtype, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.chartOfAccounts.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [chartOfAccounts.code],
          with: {
            parent: { columns: { id: true, name: true, code: true } },
          },
        }),
        db.select({ count: count() }).from(chartOfAccounts).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createAccount: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(255),
        accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
        accountSubtype: z.string().max(100).optional(),
        parentId: z.string().uuid().optional(),
        level: z.number().int().min(1).max(10).default(1),
        isBankAccount: z.boolean().default(false),
        bankAccountId: z.string().uuid().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(eq(chartOfAccounts.orgId, ctx.orgId!), eq(chartOfAccounts.code, input.code)),
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });
      }

      const [account] = await db
        .insert(chartOfAccounts)
        .values({
          orgId: ctx.orgId!,
          ...input,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'chart_of_accounts', account.id, {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
      });

      return account;
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(255).optional(),
        accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional(),
        accountSubtype: z.string().max(100).optional(),
        parentId: z.string().uuid().optional(),
        level: z.number().int().min(1).max(10).optional(),
        isBankAccount: z.boolean().optional(),
        bankAccountId: z.string().uuid().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      if (updates.code && updates.code !== existing.code) {
        const duplicate = await db.query.chartOfAccounts.findFirst({
          where: and(eq(chartOfAccounts.orgId, ctx.orgId!), eq(chartOfAccounts.code, updates.code)),
        });
        if (duplicate) throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });
      }

      const [updated] = await db
        .update(chartOfAccounts)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'chart_of_accounts',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      const [updated] = await db
        .update(chartOfAccounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.orgId!)))
        .returning();

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'chart_of_accounts',
        input.id,
        existing as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Transactions ───
  listTransactions: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          accountId: z.string().uuid().optional(),
          bankAccountId: z.string().uuid().optional(),
          contactId: z.string().uuid().optional(),
          type: z.string().optional(),
          search: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          isReconciled: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(transactions.orgId, ctx.orgId!)];

      if (input.accountId) conditions.push(eq(transactions.accountId, input.accountId));
      if (input.bankAccountId) conditions.push(eq(transactions.bankAccountId, input.bankAccountId));
      if (input.contactId) conditions.push(eq(transactions.contactId, input.contactId));
      if (input.type) conditions.push(eq(transactions.transactionType, input.type as any));
      if (input.isReconciled !== undefined) conditions.push(eq(transactions.isReconciled, input.isReconciled));
      if (input.dateFrom) conditions.push(gte(transactions.transactionDate, input.dateFrom));
      if (input.dateTo) conditions.push(lte(transactions.transactionDate, input.dateTo));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(transactions.description, pattern),
            ilike(transactions.referenceNumber, pattern),
            ilike(transactions.memo, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.transactions.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(transactions.transactionDate)],
          with: {
            account: { columns: { id: true, name: true, code: true } },
            bankAccount: { columns: { id: true, accountName: true } },
            contact: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(transactions).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createTransaction: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        bankAccountId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        transactionType: z.enum(['deposit', 'withdrawal', 'transfer', 'adjustment', 'journal_entry']),
        description: z.string().min(1),
        amount: z.string().or(z.number()),
        debitCredit: z.enum(['debit', 'credit']),
        referenceNumber: z.string().max(255).optional(),
        transactionDate: z.string(),
        memo: z.string().optional(),
        attachments: z.array(z.record(z.any())).optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate account exists and belongs to org
      const account = await db.query.chartOfAccounts.findFirst({
        where: and(eq(chartOfAccounts.id, input.accountId), eq(chartOfAccounts.orgId, ctx.orgId!)),
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      const amountStr = typeof input.amount === 'number' ? input.amount.toString() : input.amount;

      const [txn] = await db
        .insert(transactions)
        .values({
          orgId: ctx.orgId!,
          accountId: input.accountId,
          bankAccountId: input.bankAccountId,
          contactId: input.contactId,
          transactionType: input.transactionType,
          description: input.description,
          amount: amountStr,
          debitCredit: input.debitCredit,
          referenceNumber: input.referenceNumber,
          transactionDate: input.transactionDate,
          memo: input.memo,
          attachments: input.attachments || [],
          metadata: input.metadata || {},
          createdBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'transaction', txn.id, {
        description: txn.description,
        amount: txn.amount,
        transactionType: txn.transactionType,
      });

      return txn;
    }),

  updateTransaction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        accountId: z.string().uuid().optional(),
        bankAccountId: z.string().uuid().optional().nullable(),
        contactId: z.string().uuid().optional().nullable(),
        transactionType: z.enum(['deposit', 'withdrawal', 'transfer', 'adjustment', 'journal_entry']).optional(),
        description: z.string().min(1).optional(),
        amount: z.string().or(z.number()).optional(),
        debitCredit: z.enum(['debit', 'credit']).optional(),
        referenceNumber: z.string().max(255).optional(),
        transactionDate: z.string().optional(),
        memo: z.string().optional(),
        attachments: z.array(z.record(z.any())).optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.transactions.findFirst({
        where: and(eq(transactions.id, id), eq(transactions.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });

      if (existing.isReconciled) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot update a reconciled transaction' });
      }

      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };
      if (updates.amount !== undefined) {
        setData.amount = typeof updates.amount === 'number' ? updates.amount.toString() : updates.amount;
      }

      const [updated] = await db
        .update(transactions)
        .set(setData)
        .where(and(eq(transactions.id, id), eq(transactions.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'transaction',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  deleteTransaction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.transactions.findFirst({
        where: and(eq(transactions.id, input.id), eq(transactions.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });

      if (existing.isReconciled) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete a reconciled transaction' });
      }

      await db.delete(transactions).where(and(eq(transactions.id, input.id), eq(transactions.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'transaction',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true };
    }),

  // ─── Journal Entries ───
  listJournalEntries: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          status: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(journalEntries.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(journalEntries.status, input.status as any));
      if (input.dateFrom) conditions.push(gte(journalEntries.entryDate, input.dateFrom));
      if (input.dateTo) conditions.push(lte(journalEntries.entryDate, input.dateTo));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(journalEntries.entryNumber, pattern),
            ilike(journalEntries.description, pattern),
            ilike(journalEntries.reference, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.journalEntries.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(journalEntries.entryDate)],
          with: {
            lines: {
              with: {
                account: { columns: { id: true, name: true, code: true } },
              },
            },
            creator: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(journalEntries).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createJournalEntry: protectedProcedure
    .input(
      z.object({
        entryNumber: z.string().min(1).max(50),
        entryDate: z.string(),
        reference: z.string().max(255).optional(),
        description: z.string().optional(),
        lines: z
          .array(
            z.object({
              accountId: z.string().uuid(),
              lineNumber: z.number().int().min(1),
              description: z.string().optional(),
              amount: z.string().or(z.number()),
              debitCredit: z.enum(['debit', 'credit']),
              contactId: z.string().uuid().optional(),
            })
          )
          .min(2),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.journalEntries.findFirst({
        where: and(eq(journalEntries.orgId, ctx.orgId!), eq(journalEntries.entryNumber, input.entryNumber)),
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Journal entry number already exists' });
      }

      // Validate total debit equals total credit
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of input.lines) {
        const amt = typeof line.amount === 'number' ? line.amount : parseFloat(line.amount);
        if (line.debitCredit === 'debit') totalDebit += amt;
        else totalCredit += amt;
      }
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)})`,
        });
      }

      // Validate all accounts exist
      for (const line of input.lines) {
        const account = await db.query.chartOfAccounts.findFirst({
          where: and(eq(chartOfAccounts.id, line.accountId), eq(chartOfAccounts.orgId, ctx.orgId!)),
        });
        if (!account) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Account ${line.accountId} not found` });
        }
      }

      const [je] = await db
        .insert(journalEntries)
        .values({
          orgId: ctx.orgId!,
          entryNumber: input.entryNumber,
          entryDate: input.entryDate,
          reference: input.reference,
          description: input.description,
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          createdBy: ctx.user.id,
        })
        .returning();

      await db.insert(journalEntryLines).values(
        input.lines.map((line) => ({
          orgId: ctx.orgId!,
          journalEntryId: je.id,
          accountId: line.accountId,
          lineNumber: line.lineNumber,
          description: line.description,
          amount: typeof line.amount === 'number' ? line.amount.toString() : line.amount,
          debitCredit: line.debitCredit,
          contactId: line.contactId,
        }))
      );

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'journal_entry', je.id, {
        entryNumber: je.entryNumber,
        totalDebit: je.totalDebit,
        totalCredit: je.totalCredit,
      });

      return je;
    }),

  postJournalEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.journalEntries.findFirst({
        where: and(eq(journalEntries.id, input.id), eq(journalEntries.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });

      if (existing.status !== 'draft') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only draft entries can be posted. Current status: ${existing.status}`,
        });
      }

      const [updated] = await db
        .update(journalEntries)
        .set({
          status: 'posted',
          postedAt: new Date(),
          postedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, input.id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'journal_entry',
        input.id,
        { status: existing.status } as Record<string, unknown>,
        { status: 'posted' } as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Bank Accounts ───
  listBankAccounts: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(bankAccounts.orgId, ctx.orgId!)];

      if (input.isActive !== undefined) conditions.push(eq(bankAccounts.isActive, input.isActive));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(or(ilike(bankAccounts.accountName, pattern), ilike(bankAccounts.bankName, pattern))!);
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.bankAccounts.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [bankAccounts.accountName],
        }),
        db.select({ count: count() }).from(bankAccounts).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createBankAccount: protectedProcedure
    .input(
      z.object({
        accountName: z.string().min(1).max(255),
        bankName: z.string().max(255).optional(),
        accountNumberHash: z.string().max(255).optional(),
        accountType: z.string().max(50).optional(),
        routingNumber: z.string().max(20).optional(),
        currency: z.string().max(3).default('USD'),
        openingBalance: z.string().or(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const openingBalance =
        input.openingBalance !== undefined
          ? typeof input.openingBalance === 'number'
            ? input.openingBalance.toString()
            : input.openingBalance
          : '0';

      const [account] = await db
        .insert(bankAccounts)
        .values({
          orgId: ctx.orgId!,
          accountName: input.accountName,
          bankName: input.bankName,
          accountNumberHash: input.accountNumberHash,
          accountType: input.accountType,
          routingNumber: input.routingNumber,
          currency: input.currency,
          openingBalance,
          currentBalance: openingBalance,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'bank_account', account.id, {
        accountName: account.accountName,
        bankName: account.bankName,
      });

      return account;
    }),

  updateBankAccount: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        accountName: z.string().min(1).max(255).optional(),
        bankName: z.string().max(255).optional(),
        accountNumberHash: z.string().max(255).optional(),
        accountType: z.string().max(50).optional(),
        routingNumber: z.string().max(20).optional(),
        currency: z.string().max(3).optional(),
        openingBalance: z.string().or(z.number()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };
      if (updates.openingBalance !== undefined) {
        setData.openingBalance =
          typeof updates.openingBalance === 'number'
            ? updates.openingBalance.toString()
            : updates.openingBalance;
      }

      const [updated] = await db
        .update(bankAccounts)
        .set(setData)
        .where(and(eq(bankAccounts.id, id), eq(bankAccounts.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'bank_account',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  reconcileTransaction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.transactions.findFirst({
        where: and(eq(transactions.id, input.id), eq(transactions.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });

      if (existing.isReconciled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transaction already reconciled' });
      }

      const [updated] = await db
        .update(transactions)
        .set({
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, input.id), eq(transactions.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'transaction',
        input.id,
        { isReconciled: false } as Record<string, unknown>,
        { isReconciled: true } as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Balances & Reports ───
  getAccountBalance: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const account = await db.query.chartOfAccounts.findFirst({
        where: and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.orgId!)),
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      const debits = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, input.id),
            eq(transactions.orgId, ctx.orgId!),
            eq(transactions.debitCredit, 'debit')
          )
        );

      const credits = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, input.id),
            eq(transactions.orgId, ctx.orgId!),
            eq(transactions.debitCredit, 'credit')
          )
        );

      const debitTotal = parseFloat(debits[0]?.total ?? '0');
      const creditTotal = parseFloat(credits[0]?.total ?? '0');

      // Asset / Expense => debit increases balance
      // Liability / Equity / Revenue => credit increases balance
      const normalBalance = account.accountType === 'asset' || account.accountType === 'expense' ? 'debit' : 'credit';
      const balance = normalBalance === 'debit' ? debitTotal - creditTotal : creditTotal - debitTotal;

      return {
        accountId: input.id,
        accountName: account.name,
        accountType: account.accountType,
        normalBalance,
        debitTotal,
        creditTotal,
        balance: parseFloat(balance.toFixed(2)),
      };
    }),

  getTrialBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const accounts = await db.query.chartOfAccounts.findMany({
        where: and(eq(chartOfAccounts.orgId, ctx.orgId!), eq(chartOfAccounts.isActive, true)),
      });

      const result = await Promise.all(
        accounts.map(async (account) => {
          const debits = await db
            .select({ total: sum(transactions.amount) })
            .from(transactions)
            .where(
              and(
                eq(transactions.accountId, account.id),
                eq(transactions.orgId, ctx.orgId!),
                eq(transactions.debitCredit, 'debit')
              )
            );

          const credits = await db
            .select({ total: sum(transactions.amount) })
            .from(transactions)
            .where(
              and(
                eq(transactions.accountId, account.id),
                eq(transactions.orgId, ctx.orgId!),
                eq(transactions.debitCredit, 'credit')
              )
            );

          const debitTotal = parseFloat(debits[0]?.total ?? '0');
          const creditTotal = parseFloat(credits[0]?.total ?? '0');

          const normalBalance =
            account.accountType === 'asset' || account.accountType === 'expense' ? 'debit' : 'credit';
          const balance = normalBalance === 'debit' ? debitTotal - creditTotal : creditTotal - debitTotal;

          return {
            accountId: account.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
            debitTotal: parseFloat(debitTotal.toFixed(2)),
            creditTotal: parseFloat(creditTotal.toFixed(2)),
            balance: parseFloat(balance.toFixed(2)),
          };
        })
      );

      const totalDebits = result.reduce((sum, r) => sum + r.debitTotal, 0);
      const totalCredits = result.reduce((sum, r) => sum + r.creditTotal, 0);

      return { accounts: result, totalDebits: parseFloat(totalDebits.toFixed(2)), totalCredits: parseFloat(totalCredits.toFixed(2)) };
    }),

  getFinancialStats: protectedProcedure
    .query(async ({ ctx }) => {
      const accountSums = await db
        .select({
          accountId: transactions.accountId,
          accountType: chartOfAccounts.accountType,
          debitSum: sum(sql`CASE WHEN ${transactions.debitCredit} = 'debit' THEN ${transactions.amount} ELSE 0 END`),
          creditSum: sum(sql`CASE WHEN ${transactions.debitCredit} = 'credit' THEN ${transactions.amount} ELSE 0 END`),
        })
        .from(transactions)
        .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
        .where(eq(transactions.orgId, ctx.orgId!))
        .groupBy(transactions.accountId, chartOfAccounts.accountType);

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const row of accountSums) {
        const debit = parseFloat(row.debitSum ?? '0');
        const credit = parseFloat(row.creditSum ?? '0');
        const balance = row.accountType === 'asset' || row.accountType === 'expense' ? debit - credit : credit - debit;

        switch (row.accountType) {
          case 'asset':
            totalAssets += balance;
            break;
          case 'liability':
            totalLiabilities += balance;
            break;
          case 'equity':
            totalEquity += balance;
            break;
          case 'revenue':
            totalRevenue += balance;
            break;
          case 'expense':
            totalExpenses += balance;
            break;
        }
      }

      return {
        totalAssets: parseFloat(totalAssets.toFixed(2)),
        totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
        totalEquity: parseFloat(totalEquity.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        netIncome: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
      };
    }),
});
