import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { recurringTransactions, chartOfAccounts, contacts, transactions } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { auditService } from '../services/audit.js';
import { addDays, addMonths, addYears, format, endOfMonth, getDate, setDate } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateInitialNextRunDate(
  startDate: Date,
  frequency: string,
  dayOfMonth?: number | null
): Date {
  if (frequency === 'monthly' && dayOfMonth) {
    const lastDayOfStartMonth = getDate(endOfMonth(startDate));
    const targetDay = Math.min(dayOfMonth, lastDayOfStartMonth);
    if (getDate(startDate) <= targetDay) {
      return setDate(startDate, targetDay);
    } else {
      const nextMonth = addMonths(startDate, 1);
      const lastDayOfNextMonth = getDate(endOfMonth(nextMonth));
      return setDate(nextMonth, Math.min(dayOfMonth, lastDayOfNextMonth));
    }
  }
  return startDate;
}

function calculateNextRunDate(
  lastRunDate: Date,
  frequency: string,
  dayOfMonth?: number | null
): Date {
  switch (frequency) {
    case 'daily':
      return addDays(lastRunDate, 1);
    case 'weekly':
      return addDays(lastRunDate, 7);
    case 'biweekly':
      return addDays(lastRunDate, 14);
    case 'monthly': {
      const nextMonth = addMonths(lastRunDate, 1);
      if (dayOfMonth) {
        const lastDayOfMonth = getDate(endOfMonth(nextMonth));
        return setDate(nextMonth, Math.min(dayOfMonth, lastDayOfMonth));
      }
      return nextMonth;
    }
    case 'quarterly':
      return addMonths(lastRunDate, 3);
    case 'semiannually':
      return addMonths(lastRunDate, 6);
    case 'annually':
      return addYears(lastRunDate, 1);
    default:
      return addDays(lastRunDate, 1);
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const recurringRouter = router({
  // ── 1. listRecurring ──────────────────────────────────────────────────────
  listRecurring: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        isActive: z.boolean().optional(),
        frequency: z
          .enum([
            'daily',
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
            'semiannually',
            'annually',
          ])
          .optional(),
        accountId: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(recurringTransactions.orgId, ctx.orgId!)];

      if (input.isActive !== undefined) {
        conditions.push(eq(recurringTransactions.isActive, input.isActive));
      }
      if (input.frequency) {
        conditions.push(eq(recurringTransactions.frequency, input.frequency));
      }
      if (input.accountId) {
        conditions.push(eq(recurringTransactions.accountId, input.accountId));
      }
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            ilike(recurringTransactions.name, term),
            ilike(recurringTransactions.description, term)
          )
        );
      }

      const whereClause = and(...conditions);

      const [data, totalResult] = await Promise.all([
        db.query.recurringTransactions.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(recurringTransactions.createdAt)],
          with: {
            account: {
              columns: {
                id: true,
                name: true,
                code: true,
              },
            },
            contact: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        }),
        db
          .select({ count: count() })
          .from(recurringTransactions)
          .where(whereClause),
      ]);

      return {
        data,
        total: totalResult[0]?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  // ── 2. getRecurringById ───────────────────────────────────────────────────
  getRecurringById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.orgId, ctx.orgId!)
        ),
        with: {
          account: true,
          contact: true,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring transaction not found',
        });
      }

      return result;
    }),

  // ── 3. createRecurring ────────────────────────────────────────────────────
  createRecurring: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        accountId: z.string(),
        contactId: z.string().optional().nullable(),
        transactionType: z.enum([
          'deposit',
          'withdrawal',
          'transfer',
          'adjustment',
          'journal_entry',
        ]),
        amount: z.union([z.string(), z.number()]),
        debitCredit: z.enum(['debit', 'credit']),
        frequency: z.enum([
          'daily',
          'weekly',
          'biweekly',
          'monthly',
          'quarterly',
          'semiannually',
          'annually',
        ]),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional().nullable(),
        dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
        autoPost: z.boolean().optional(),
        maxRuns: z.number().int().min(1).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate account belongs to org
      const account = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.id, input.accountId),
          eq(chartOfAccounts.orgId, ctx.orgId!)
        ),
      });
      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      // Validate contact if provided
      if (input.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, input.contactId),
            eq(contacts.orgId, ctx.orgId!)
          ),
        });
        if (!contact) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Contact not found',
          });
        }
      }

      const nextRunDate = calculateInitialNextRunDate(
        input.startDate,
        input.frequency,
        input.dayOfMonth
      );

      const insertData = {
        orgId: ctx.orgId!,
        name: input.name,
        description: input.description,
        accountId: input.accountId,
        contactId: input.contactId,
        transactionType: input.transactionType,
        amount: input.amount.toString(),
        debitCredit: input.debitCredit,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate,
        nextRunDate,
        lastRunDate: null,
        dayOfMonth: input.dayOfMonth,
        isActive: true,
        autoPost: input.autoPost ?? false,
        totalRuns: 0,
        maxRuns: input.maxRuns,
      };

      const [created] = await db
        .insert(recurringTransactions)
        .values(insertData)
        .returning();

      await auditService.logCreate(
        ctx,
        'recurringTransaction',
        created.id,
        insertData
      );

      return created;
    }),

  // ── 4. updateRecurring ────────────────────────────────────────────────────
  updateRecurring: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        accountId: z.string().optional(),
        contactId: z.string().optional().nullable(),
        transactionType: z.enum([
          'deposit',
          'withdrawal',
          'transfer',
          'adjustment',
          'journal_entry',
        ]).optional(),
        amount: z.union([z.string(), z.number()]).optional(),
        debitCredit: z.enum(['debit', 'credit']).optional(),
        frequency: z.enum([
          'daily',
          'weekly',
          'biweekly',
          'monthly',
          'quarterly',
          'semiannually',
          'annually',
        ]).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional().nullable(),
        nextRunDate: z.coerce.date().optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
        isActive: z.boolean().optional(),
        autoPost: z.boolean().optional(),
        maxRuns: z.number().int().min(1).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring transaction not found',
        });
      }

      // Validate nextRunDate >= today if changing
      if (input.nextRunDate !== undefined) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextRun = new Date(input.nextRunDate);
        nextRun.setHours(0, 0, 0, 0);
        if (nextRun < today) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Next run date must be today or later',
          });
        }
      }

      // Validate account if changing
      if (input.accountId) {
        const account = await db.query.chartOfAccounts.findFirst({
          where: and(
            eq(chartOfAccounts.id, input.accountId),
            eq(chartOfAccounts.orgId, ctx.orgId!)
          ),
        });
        if (!account) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Account not found',
          });
        }
      }

      // Validate contact if changing
      if (input.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, input.contactId),
            eq(contacts.orgId, ctx.orgId!)
          ),
        });
        if (!contact) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Contact not found',
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.accountId !== undefined) updateData.accountId = input.accountId;
      if (input.contactId !== undefined) updateData.contactId = input.contactId;
      if (input.transactionType !== undefined)
        updateData.transactionType = input.transactionType;
      if (input.amount !== undefined) updateData.amount = input.amount.toString();
      if (input.debitCredit !== undefined) updateData.debitCredit = input.debitCredit;
      if (input.frequency !== undefined) updateData.frequency = input.frequency;
      if (input.startDate !== undefined) updateData.startDate = input.startDate;
      if (input.endDate !== undefined) updateData.endDate = input.endDate;
      if (input.nextRunDate !== undefined) updateData.nextRunDate = input.nextRunDate;
      if (input.dayOfMonth !== undefined) updateData.dayOfMonth = input.dayOfMonth;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.autoPost !== undefined) updateData.autoPost = input.autoPost;
      if (input.maxRuns !== undefined) updateData.maxRuns = input.maxRuns;
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(recurringTransactions)
        .set(updateData)
        .where(
          and(
            eq(recurringTransactions.id, input.id),
            eq(recurringTransactions.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(
        ctx,
        'recurringTransaction',
        input.id,
        updateData
      );

      return updated;
    }),

  // ── 5. deleteRecurring ────────────────────────────────────────────────────
  deleteRecurring: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring transaction not found',
        });
      }

      await db
        .delete(recurringTransactions)
        .where(
          and(
            eq(recurringTransactions.id, input.id),
            eq(recurringTransactions.orgId, ctx.orgId!)
          )
        );

      await auditService.logDelete(
        ctx,
        'recurringTransaction',
        input.id,
        existing
      );

      return { success: true, id: input.id };
    }),

  // ── 6. generateRun ────────────────────────────────────────────────────────
  generateRun: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const recurring = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.orgId, ctx.orgId!)
        ),
      });

      if (!recurring) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring transaction not found',
        });
      }

      if (!recurring.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Recurring transaction is not active',
        });
      }

      if (!recurring.nextRunDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No next run date scheduled',
        });
      }

      const transactionDate = recurring.nextRunDate;
      const newTotalRuns = recurring.totalRuns + 1;
      const newLastRunDate = transactionDate;
      let newNextRunDate = calculateNextRunDate(
        transactionDate,
        recurring.frequency,
        recurring.dayOfMonth
      );

      // Check endDate boundary
      let newIsActive = true;
      if (recurring.endDate) {
        const endDate = new Date(recurring.endDate);
        endDate.setHours(0, 0, 0, 0);
        const nextRun = new Date(newNextRunDate);
        nextRun.setHours(0, 0, 0, 0);
        if (nextRun > endDate) {
          newIsActive = false;
        }
      }

      // Check maxRuns boundary
      if (recurring.maxRuns !== null && newTotalRuns >= recurring.maxRuns) {
        newIsActive = false;
      }

      const transactionInsert = {
        orgId: ctx.orgId!,
        accountId: recurring.accountId,
        bankAccountId: null,
        contactId: recurring.contactId,
        transactionType: recurring.transactionType,
        description: recurring.name,
        amount: recurring.amount?.toString(),
        debitCredit: recurring.debitCredit,
        referenceNumber: `Auto: ${recurring.frequency}`,
        transactionDate,
        memo: recurring.description,
        isReconciled: false,
        createdBy: ctx.user.id,
      };

      const result = await db.transaction(async (tx) => {
        const [createdTransaction] = await tx
          .insert(transactions)
          .values(transactionInsert)
          .returning();

        await tx
          .update(recurringTransactions)
          .set({
            totalRuns: newTotalRuns,
            lastRunDate: newLastRunDate,
            nextRunDate: newNextRunDate,
            isActive: newIsActive,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(recurringTransactions.id, input.id),
              eq(recurringTransactions.orgId, ctx.orgId!)
            )
          );

        return createdTransaction;
      });

      await auditService.logCreate(
        ctx,
        'transaction',
        result.id,
        transactionInsert
      );

      return result;
    }),

  // ── 7. getUpcomingRuns ────────────────────────────────────────────────────
  getUpcomingRuns: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = addDays(new Date(), input.days);

      const data = await db.query.recurringTransactions.findMany({
        where: and(
          eq(recurringTransactions.orgId, ctx.orgId!),
          eq(recurringTransactions.isActive, true),
          lte(recurringTransactions.nextRunDate, cutoffDate)
        ),
        orderBy: [recurringTransactions.nextRunDate],
        with: {
          account: {
            columns: {
              id: true,
              name: true,
              code: true,
            },
          },
          contact: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      return data;
    }),

  // ── 8. toggleActive ───────────────────────────────────────────────────────
  toggleActive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring transaction not found',
        });
      }

      const [updated] = await db
        .update(recurringTransactions)
        .set({
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recurringTransactions.id, input.id),
            eq(recurringTransactions.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(ctx, 'recurringTransaction', input.id, {
        isActive: input.isActive,
      });

      return updated;
    }),
});
