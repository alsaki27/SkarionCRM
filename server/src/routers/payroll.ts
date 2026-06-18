import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { employees, payrollRuns, payrollEntries } from '../db/schema.js';
import { eq, and, or, gte, lte, desc, count, sql, sum, ilike, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const payrollRouter = router({
  listRuns: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      search: z.string().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(payrollRuns.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(payrollRuns.status, input.status as any));
      if (input.periodStart) conditions.push(gte(payrollRuns.periodStart, input.periodStart));
      if (input.periodEnd) conditions.push(lte(payrollRuns.periodEnd, input.periodEnd));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(or(ilike(payrollRuns.runName, pattern), ilike(payrollRuns.status, pattern))!);
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.payrollRuns.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(payrollRuns.createdAt)],
          with: {
            processor: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(payrollRuns).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createRun: protectedProcedure
    .input(z.object({
      runName: z.string().min(1).max(255),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }))
    .mutation(async ({ input, ctx }) => {
      const [run] = await db.insert(payrollRuns).values({
        orgId: ctx.orgId!,
        runName: input.runName,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        payDate: input.payDate,
        status: 'draft',
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'payroll_run',
        run.id,
        { runName: run.runName, periodStart: run.periodStart, periodEnd: run.periodEnd, payDate: run.payDate },
      );

      return run;
    }),

  addEntry: protectedProcedure
    .input(z.object({
      payrollRunId: z.string().uuid(),
      employeeId: z.string().uuid(),
      regularHours: z.string().or(z.number()).default('0'),
      overtimeHours: z.string().or(z.number()).default('0'),
      grossPay: z.string().or(z.number()),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify the payroll run exists and belongs to this org
      const run = await db.query.payrollRuns.findFirst({
        where: and(eq(payrollRuns.id, input.payrollRunId), eq(payrollRuns.orgId, ctx.orgId!)),
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll run not found' });
      if (run.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot add entries to a non-draft payroll run' });

      // Verify the employee exists and belongs to this org
      const employee = await db.query.employees.findFirst({
        where: and(eq(employees.id, input.employeeId), eq(employees.orgId, ctx.orgId!)),
      });
      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const grossPay = Number(input.grossPay);
      if (grossPay < 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gross pay cannot be negative' });

      // Calculate taxes
      const socialSecurityWageBase = 168600; // 2024 wage base
      const ssWages = Math.min(grossPay, socialSecurityWageBase);
      const socialSecurityTax = Math.round(ssWages * 0.062 * 100) / 100;
      const medicareTax = Math.round(grossPay * 0.0145 * 100) / 100;

      // Federal withholding: use employee setting if available, else estimate flat 15%
      const federalWithholding = employee.withholdingFederal
        ? Number(employee.withholdingFederal)
        : Math.round(grossPay * 0.15 * 100) / 100;

      // State withholding
      const stateTax = employee.withholdingStateAmount
        ? Number(employee.withholdingStateAmount)
        : 0;

      // Local withholding
      const localTax = employee.withholdingLocal
        ? Number(employee.withholdingLocal)
        : 0;

      // 401k
      const retirement401k = employee.retirement401kRate
        ? Math.round(grossPay * Number(employee.retirement401kRate) / 100 * 100) / 100
        : 0;

      // Health insurance
      const healthInsurance = employee.healthInsurancePremium
        ? Number(employee.healthInsurancePremium)
        : 0;

      // Other deductions (from metadata)
      const otherDeductions = 0;

      const totalDeductions = federalWithholding + socialSecurityTax + medicareTax + stateTax + localTax + retirement401k + healthInsurance + otherDeductions;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      const [entry] = await db.insert(payrollEntries).values({
        orgId: ctx.orgId!,
        payrollRunId: input.payrollRunId,
        employeeId: input.employeeId,
        regularHours: String(input.regularHours),
        overtimeHours: String(input.overtimeHours),
        grossPay: String(grossPay),
        federalTax: String(federalWithholding),
        socialSecurityTax: String(socialSecurityTax),
        medicareTax: String(medicareTax),
        stateTax: String(stateTax),
        localTax: String(localTax),
        retirement401k: String(retirement401k),
        healthInsurance: String(healthInsurance),
        otherDeductions: String(otherDeductions),
        netPay: String(netPay),
        metadata: input.metadata || {},
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'payroll_entry',
        entry.id,
        { payrollRunId: entry.payrollRunId, employeeId: entry.employeeId, grossPay: entry.grossPay },
      );

      return entry;
    }),

  updateEntry: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      regularHours: z.string().or(z.number()).optional(),
      overtimeHours: z.string().or(z.number()).optional(),
      grossPay: z.string().or(z.number()).optional(),
      federalTax: z.string().or(z.number()).optional(),
      socialSecurityTax: z.string().or(z.number()).optional(),
      medicareTax: z.string().or(z.number()).optional(),
      stateTax: z.string().or(z.number()).optional(),
      localTax: z.string().or(z.number()).optional(),
      retirement401k: z.string().or(z.number()).optional(),
      healthInsurance: z.string().or(z.number()).optional(),
      otherDeductions: z.string().or(z.number()).optional(),
      netPay: z.string().or(z.number()).optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rawUpdates } = input;

      const existing = await db.query.payrollEntries.findFirst({
        where: and(eq(payrollEntries.id, id), eq(payrollEntries.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll entry not found' });

      // Verify the run is still draft
      const run = await db.query.payrollRuns.findFirst({
        where: and(eq(payrollRuns.id, existing.payrollRunId), eq(payrollRuns.orgId, ctx.orgId!)),
      });
      if (run && run.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot update entries in a non-draft payroll run' });
      }

      const updates: Record<string, any> = { ...rawUpdates, updatedAt: new Date() };
      const numericFields = ['regularHours', 'overtimeHours', 'grossPay', 'federalTax', 'socialSecurityTax', 'medicareTax', 'stateTax', 'localTax', 'retirement401k', 'healthInsurance', 'otherDeductions', 'netPay'];
      for (const field of numericFields) {
        if (field in updates && updates[field] !== undefined && updates[field] !== null) {
          updates[field] = String(updates[field]);
        }
      }

      const [updated] = await db.update(payrollEntries)
        .set(updates)
        .where(eq(payrollEntries.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'payroll_entry',
        id,
        existing as Record<string, unknown>,
        rawUpdates as Record<string, unknown>,
      );

      return updated;
    }),

  processRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.query.payrollRuns.findFirst({
        where: and(eq(payrollRuns.id, input.id), eq(payrollRuns.orgId, ctx.orgId!)),
        with: { entries: true },
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll run not found' });
      if (run.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft runs can be processed' });
      if (run.entries.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot process a run with no entries' });

      // Calculate totals
      let totalGross = 0;
      let totalFica = 0;
      let totalFederalTax = 0;
      let totalStateTax = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const entry of run.entries) {
        totalGross += Number(entry.grossPay);
        totalFica += Number(entry.socialSecurityTax) + Number(entry.medicareTax);
        totalFederalTax += Number(entry.federalTax);
        totalStateTax += Number(entry.stateTax) + Number(entry.localTax);
        totalDeductions += Number(entry.federalTax) + Number(entry.socialSecurityTax) + Number(entry.medicareTax) + Number(entry.stateTax) + Number(entry.localTax) + Number(entry.retirement401k) + Number(entry.healthInsurance) + Number(entry.otherDeductions);
        totalNet += Number(entry.netPay);
      }

      const [updated] = await db.update(payrollRuns)
        .set({
          status: 'completed',
          totalGross: String(Math.round(totalGross * 100) / 100),
          totalFica: String(Math.round(totalFica * 100) / 100),
          totalFederalTax: String(Math.round(totalFederalTax * 100) / 100),
          totalStateTax: String(Math.round(totalStateTax * 100) / 100),
          totalDeductions: String(Math.round(totalDeductions * 100) / 100),
          totalNet: String(Math.round(totalNet * 100) / 100),
          processedBy: ctx.user.id,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrollRuns.id, input.id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'payroll_run',
        input.id,
        { status: run.status },
        { status: 'completed', totalGross: updated.totalGross, totalNet: updated.totalNet },
      );

      return updated;
    }),

  getRunDetails: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const run = await db.query.payrollRuns.findFirst({
        where: and(eq(payrollRuns.id, input.id), eq(payrollRuns.orgId, ctx.orgId!)),
        with: {
          entries: {
            with: {
              employee: {
                columns: { id: true, firstName: true, lastName: true, employeeId: true, jobTitle: true, department: true },
              },
            },
          },
          processor: { columns: { id: true, fullName: true } },
        },
      });

      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll run not found' });
      return run;
    }),

  voidRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.query.payrollRuns.findFirst({
        where: and(eq(payrollRuns.id, input.id), eq(payrollRuns.orgId, ctx.orgId!)),
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll run not found' });
      if (run.status !== 'completed') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only completed runs can be voided' });

      const [updated] = await db.update(payrollRuns)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(payrollRuns.id, input.id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'payroll_run',
        input.id,
        { status: run.status },
        { status: 'cancelled' },
      );

      return updated;
    }),

  getPayrollStats: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(payrollRuns.orgId, ctx.orgId!), eq(payrollRuns.status, 'completed')];
      if (input.periodStart) conditions.push(gte(payrollRuns.periodStart, input.periodStart));
      if (input.periodEnd) conditions.push(lte(payrollRuns.periodEnd, input.periodEnd));
      const whereClause = and(...conditions);

      const [totalRunsResult, grossResult, netResult, runIds] = await Promise.all([
        db.select({ count: count() }).from(payrollRuns).where(whereClause),
        db.select({ total: sum(payrollRuns.totalGross) }).from(payrollRuns).where(whereClause),
        db.select({ total: sum(payrollRuns.totalNet) }).from(payrollRuns).where(whereClause),
        db.select({ id: payrollRuns.id }).from(payrollRuns).where(whereClause),
      ]);

      const entriesResult = runIds.length > 0
        ? await db.select({ count: count() }).from(payrollEntries).where(
            and(
              eq(payrollEntries.orgId, ctx.orgId!),
              inArray(payrollEntries.payrollRunId, runIds.map(r => r.id))
            )
          )
        : [{ count: 0 }];

      return {
        totalRuns: totalRunsResult[0]?.count ?? 0,
        totalGross: grossResult[0]?.total ?? '0',
        totalNet: netResult[0]?.total ?? '0',
        totalEntries: entriesResult[0]?.count ?? 0,
      };
    }),
});
