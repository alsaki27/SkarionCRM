import { z } from 'zod';
import { eq, and, or, ilike, desc, count, gte, lte, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { expenseReports, expenseItems, employees, users } from '../db/schema.js';
import { auditService } from '../services/audit.js';

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────

function ensureAmountString(v: string | number): string {
  return v.toString();
}

function addAmounts(a: string | number, b: string | number): string {
  const sum = Number(a) + Number(b);
  return sum.toString();
}

// ───────────────────────────────────────────
// Input schemas
// ───────────────────────────────────────────

const expenseItemInputSchema = z.object({
  expenseDate: z.string().datetime(),
  description: z.string().min(1),
  category: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  taxAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  vendor: z.string().optional(),
  receiptPath: z.string().optional(),
  receiptUploaded: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  mileage: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
});

const listExpenseReportsInput = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed']).optional(),
  employeeId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const getByIdInput = z.object({
  id: z.string().uuid(),
});

const createExpenseReportInput = z.object({
  employeeId: z.string().uuid(),
  reportName: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(expenseItemInputSchema).min(1),
});

const updateExpenseReportInput = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  reportName: z.string().min(1).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(expenseItemInputSchema).optional(),
});

const submitInput = z.object({
  id: z.string().uuid(),
});

const reviewInput = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
  notes: z.string().optional(),
});

const approveInput = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

const rejectInput = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1),
});

const reimburseInput = z.object({
  id: z.string().uuid(),
  amount: z.union([z.string(), z.number()]),
});

const deleteInput = z.object({
  id: z.string().uuid(),
});

const addItemInput = z.object({
  expenseReportId: z.string().uuid(),
  expenseDate: z.string().datetime(),
  description: z.string().min(1),
  category: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  taxAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  vendor: z.string().optional(),
  receiptPath: z.string().optional(),
  receiptUploaded: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  mileage: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
});

const approveItemInput = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
});

// ───────────────────────────────────────────
// Router
// ───────────────────────────────────────────

export const expenseRouter = router({

  // ── 1. listExpenseReports ─────────────────
  listExpenseReports: protectedProcedure
    .input(listExpenseReportsInput)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(expenseReports.orgId, ctx.orgId!)];

      if (input.status) {
        conditions.push(eq(expenseReports.status, input.status));
      }
      if (input.employeeId) {
        conditions.push(eq(expenseReports.employeeId, input.employeeId));
      }
      if (input.dateFrom) {
        conditions.push(gte(expenseReports.periodStart, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(expenseReports.periodEnd, input.dateTo));
      }
      if (input.search) {
        const searchPattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(expenseReports.reportName, searchPattern),
            sql`${expenseReports.employeeId} IN (
              SELECT ${employees.id} FROM ${employees}
              WHERE ${employees.orgId} = ${ctx.orgId!}
              AND (
                ${ilike(employees.firstName, searchPattern)}
                OR ${ilike(employees.lastName, searchPattern)}
                OR ${ilike(employees.fullName, searchPattern)}
              )
            )`
          )!
        );
      }

      const whereClause = and(...conditions);

      const totalResult = await db
        .select({ count: count() })
        .from(expenseReports)
        .where(whereClause);

      const total = totalResult[0]?.count ?? 0;

      const reports = await db.query.expenseReports.findMany({
        where: whereClause,
        with: {
          employee: {
            columns: { id: true, firstName: true, lastName: true, fullName: true },
          },
          reviewer: {
            columns: { id: true, fullName: true },
          },
          approver: {
            columns: { id: true, fullName: true },
          },
        },
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(expenseReports.createdAt)],
      });

      return { total, reports };
    }),

  // ── 2. getExpenseReportById ─────────────────
  getExpenseReportById: protectedProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
        with: {
          employee: true,
          reviewer: true,
          approver: true,
          items: {
            with: {
              approver: true,
            },
          },
        },
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      return report;
    }),

  // ── 3. createExpenseReport ──────────────────
  createExpenseReport: protectedProcedure
    .input(createExpenseReportInput)
    .mutation(async ({ ctx, input }) => {
      // Validate employee belongs to org
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(employees.id, input.employeeId),
          eq(employees.orgId, ctx.orgId!)
        ),
      });

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employee not found in this organization',
        });
      }

      // Calculate total amount from items
      const totalAmount = input.items
        .reduce((acc, item) => acc + Number(item.amount), 0)
        .toString();

      // Insert expense report
      const [report] = await db
        .insert(expenseReports)
        .values({
          orgId: ctx.orgId!,
          employeeId: input.employeeId,
          reportName: input.reportName,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: 'draft',
          totalAmount,
          reimbursedAmount: '0',
          notes: input.notes ?? null,
          submittedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          approvedBy: null,
          approvedAt: null,
          metadata: null,
        })
        .returning();

      // Insert items
      const itemValues = input.items.map((item) => ({
        orgId: ctx.orgId!,
        expenseReportId: report.id,
        expenseDate: item.expenseDate,
        description: item.description,
        category: item.category,
        amount: ensureAmountString(item.amount),
        taxAmount: item.taxAmount ? ensureAmountString(item.taxAmount) : null,
        currency: item.currency ?? null,
        vendor: item.vendor ?? null,
        receiptPath: item.receiptPath ?? null,
        receiptUploaded: item.receiptUploaded ?? false,
        isBillable: item.isBillable ?? false,
        invoiceId: null,
        mileage: item.mileage ? ensureAmountString(item.mileage) : null,
        approved: false,
        approvedBy: null,
        notes: item.notes ?? null,
        metadata: null,
      }));

      await db.insert(expenseItems).values(itemValues);

      await auditService.logCreate({
        ctx,
        entityType: 'expenseReport',
        entityId: report.id,
        data: { reportName: report.reportName, totalAmount, status: 'draft' },
      });

      return report;
    }),

  // ── 4. updateExpenseReport ────────────────
  updateExpenseReport: protectedProcedure
    .input(updateExpenseReportInput)
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...updates } = input;

      // Fetch existing report
      const existing = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (existing.status !== 'draft' && existing.status !== 'rejected') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only draft or rejected reports can be updated',
        });
      }

      let totalAmount = existing.totalAmount;

      // If employeeId provided, validate
      if (updates.employeeId) {
        const employee = await db.query.employees.findFirst({
          where: and(
            eq(employees.id, updates.employeeId),
            eq(employees.orgId, ctx.orgId!)
          ),
        });
        if (!employee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employee not found in this organization',
          });
        }
      }

      // If items provided, replace them
      if (items) {
        // Delete existing items
        await db
          .delete(expenseItems)
          .where(
            and(
              eq(expenseItems.expenseReportId, id),
              eq(expenseItems.orgId, ctx.orgId!)
            )
          );

        // Re-insert new items
        const itemValues = items.map((item) => ({
          orgId: ctx.orgId!,
          expenseReportId: id,
          expenseDate: item.expenseDate,
          description: item.description,
          category: item.category,
          amount: ensureAmountString(item.amount),
          taxAmount: item.taxAmount ? ensureAmountString(item.taxAmount) : null,
          currency: item.currency ?? null,
          vendor: item.vendor ?? null,
          receiptPath: item.receiptPath ?? null,
          receiptUploaded: item.receiptUploaded ?? false,
          isBillable: item.isBillable ?? false,
          invoiceId: null,
          mileage: item.mileage ? ensureAmountString(item.mileage) : null,
          approved: false,
          approvedBy: null,
          notes: item.notes ?? null,
          metadata: null,
        }));

        await db.insert(expenseItems).values(itemValues);

        // Recalculate totalAmount
        totalAmount = items
          .reduce((acc, item) => acc + Number(item.amount), 0)
          .toString();
      }

      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (updates.employeeId !== undefined) updateValues.employeeId = updates.employeeId;
      if (updates.reportName !== undefined) updateValues.reportName = updates.reportName;
      if (updates.periodStart !== undefined) updateValues.periodStart = updates.periodStart;
      if (updates.periodEnd !== undefined) updateValues.periodEnd = updates.periodEnd;
      if (updates.notes !== undefined) updateValues.notes = updates.notes;
      if (items) updateValues.totalAmount = totalAmount;

      const [updated] = await db
        .update(expenseReports)
        .set(updateValues)
        .where(
          and(
            eq(expenseReports.id, id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: id,
        data: updateValues,
      });

      return updated;
    }),

  // ── 5. submitExpenseReport ──────────────────
  submitExpenseReport: protectedProcedure
    .input(submitInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'draft' && report.status !== 'rejected') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only draft or rejected reports can be submitted',
        });
      }

      const [updated] = await db
        .update(expenseReports)
        .set({
          status: 'submitted',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { status: 'submitted', submittedAt: updated.submittedAt },
      });

      return updated;
    }),

  // ── 6. reviewExpenseReport ──────────────────
  reviewExpenseReport: protectedProcedure
    .input(reviewInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'submitted') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only submitted reports can be reviewed',
        });
      }

      const newStatus = input.approve ? 'under_review' : 'rejected';
      const now = new Date().toISOString();

      const notes = input.notes
        ? `${report.notes ?? ''}\n[Review]: ${input.notes}`.trim()
        : report.notes;

      const [updated] = await db
        .update(expenseReports)
        .set({
          status: newStatus,
          reviewedBy: ctx.user.id,
          reviewedAt: now,
          notes: notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { status: newStatus, reviewedBy: ctx.user.id, notes: input.notes },
      });

      return updated;
    }),

  // ── 7. approveExpenseReport ─────────────────
  approveExpenseReport: protectedProcedure
    .input(approveInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'under_review') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only under-review reports can be approved',
        });
      }

      const now = new Date().toISOString();

      const notes = input.notes
        ? `${report.notes ?? ''}\n[Approval]: ${input.notes}`.trim()
        : report.notes;

      const [updated] = await db
        .update(expenseReports)
        .set({
          status: 'approved',
          approvedBy: ctx.user.id,
          approvedAt: now,
          notes: notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { status: 'approved', approvedBy: ctx.user.id, notes: input.notes },
      });

      return updated;
    }),

  // ── 8. rejectExpenseReport ──────────────────
  rejectExpenseReport: protectedProcedure
    .input(rejectInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'under_review' && report.status !== 'submitted') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only under-review or submitted reports can be rejected',
        });
      }

      const now = new Date().toISOString();
      const notes = `${report.notes ?? ''}\n[Rejection]: ${input.reason}`.trim();

      const [updated] = await db
        .update(expenseReports)
        .set({
          status: 'rejected',
          approvedBy: ctx.user.id,
          approvedAt: now,
          notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { status: 'rejected', approvedBy: ctx.user.id, reason: input.reason },
      });

      return updated;
    }),

  // ── 9. reimburseExpenseReport ───────────────
  reimburseExpenseReport: protectedProcedure
    .input(reimburseInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'approved') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only approved reports can be reimbursed',
        });
      }

      const reimbursedAmount = ensureAmountString(input.amount);
      const totalNum = Number(report.totalAmount);
      const reimbursedNum = Number(reimbursedAmount);
      const isPartial = reimbursedNum < totalNum;

      let notes = report.notes ?? '';
      if (isPartial) {
        notes = `${notes}\n[Reimbursement]: Partial reimbursement ${reimbursedAmount} / ${report.totalAmount}`.trim();
      }

      const [updated] = await db
        .update(expenseReports)
        .set({
          status: 'reimbursed',
          reimbursedAmount,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { status: 'reimbursed', reimbursedAmount, isPartial },
      });

      return updated;
    }),

  // ── 10. deleteExpenseReport ─────────────────
  deleteExpenseReport: protectedProcedure
    .input(deleteInput)
    .mutation(async ({ ctx, input }) => {
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.id),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'draft') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only draft reports can be deleted',
        });
      }

      // Delete associated items first
      await db
        .delete(expenseItems)
        .where(
          and(
            eq(expenseItems.expenseReportId, input.id),
            eq(expenseItems.orgId, ctx.orgId!)
          )
        );

      // Delete report
      await db
        .delete(expenseReports)
        .where(
          and(
            eq(expenseReports.id, input.id),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        );

      await auditService.logDelete({
        ctx,
        entityType: 'expenseReport',
        entityId: input.id,
        data: { reportName: report.reportName, totalAmount: report.totalAmount },
      });

      return { success: true, id: input.id };
    }),

  // ── 11. addExpenseItem ──────────────────────
  addExpenseItem: protectedProcedure
    .input(addItemInput)
    .mutation(async ({ ctx, input }) => {
      // Validate report exists and belongs to org
      const report = await db.query.expenseReports.findFirst({
        where: and(
          eq(expenseReports.id, input.expenseReportId),
          eq(expenseReports.orgId, ctx.orgId!)
        ),
      });

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense report not found',
        });
      }

      if (report.status !== 'draft' && report.status !== 'rejected') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Items can only be added to draft or rejected reports',
        });
      }

      const amountStr = ensureAmountString(input.amount);

      const [item] = await db
        .insert(expenseItems)
        .values({
          orgId: ctx.orgId!,
          expenseReportId: input.expenseReportId,
          expenseDate: input.expenseDate,
          description: input.description,
          category: input.category,
          amount: amountStr,
          taxAmount: input.taxAmount ? ensureAmountString(input.taxAmount) : null,
          currency: input.currency ?? null,
          vendor: input.vendor ?? null,
          receiptPath: input.receiptPath ?? null,
          receiptUploaded: input.receiptUploaded ?? false,
          isBillable: input.isBillable ?? false,
          invoiceId: null,
          mileage: input.mileage ? ensureAmountString(input.mileage) : null,
          approved: false,
          approvedBy: null,
          notes: input.notes ?? null,
          metadata: null,
        })
        .returning();

      // Update report totalAmount
      const newTotal = addAmounts(report.totalAmount, amountStr);
      await db
        .update(expenseReports)
        .set({
          totalAmount: newTotal,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseReports.id, input.expenseReportId),
            eq(expenseReports.orgId, ctx.orgId!)
          )
        );

      await auditService.logCreate({
        ctx,
        entityType: 'expenseItem',
        entityId: item.id,
        data: { expenseReportId: input.expenseReportId, amount: amountStr, category: input.category },
      });

      return item;
    }),

  // ── 12. approveExpenseItem ──────────────────
  approveExpenseItem: protectedProcedure
    .input(approveItemInput)
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.expenseItems.findFirst({
        where: and(
          eq(expenseItems.id, input.id),
          eq(expenseItems.orgId, ctx.orgId!)
        ),
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense item not found',
        });
      }

      const [updated] = await db
        .update(expenseItems)
        .set({
          approved: input.approve,
          approvedBy: input.approve ? ctx.user.id : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseItems.id, input.id),
            eq(expenseItems.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate({
        ctx,
        entityType: 'expenseItem',
        entityId: input.id,
        data: { approved: input.approve, approvedBy: input.approve ? ctx.user.id : null },
      });

      return updated;
    }),

  // ── 13. getExpenseCategories ────────────────
  getExpenseCategories: protectedProcedure.query(() => {
    return [
      'Meals',
      'Travel',
      'Lodging',
      'Office Supplies',
      'Software',
      'Equipment',
      'Mileage',
      'Phone',
      'Entertainment',
      'Training',
      'Insurance',
      'Marketing',
      'Professional Services',
      'Other',
    ];
  }),
});
