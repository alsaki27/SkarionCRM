import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { employees, payrollEntries, payrollRuns, w2Forms, taxYears } from '../db/schema.js';
import { eq, and, gte, lte, desc, count, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const w2Router = router({
  listW2s: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      year: z.number().int().min(2000).max(2100).optional(),
      status: z.string().optional(),
      employeeId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(w2Forms.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(w2Forms.formStatus, input.status as any));
      if (input.employeeId) conditions.push(eq(w2Forms.employeeId, input.employeeId));
      if (input.year) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${taxYears} 
            WHERE ${taxYears.id} = ${w2Forms.taxYearId} 
            AND ${taxYears.year} = ${input.year}
          )`
        );
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${employees}
            WHERE ${employees.id} = ${w2Forms.employeeId}
            AND (
              ${employees.firstName} ILIKE ${pattern} OR
              ${employees.lastName} ILIKE ${pattern} OR
              ${employees.employeeId} ILIKE ${pattern}
            )
          )`
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.w2Forms.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(w2Forms.createdAt)],
          with: {
            employee: { columns: { id: true, firstName: true, lastName: true, employeeId: true, ssnHash: true } },
            taxYear: { columns: { id: true, year: true } },
          },
        }),
        db.select({ count: count() }).from(w2Forms).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  generateW2: adminProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      taxYearId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify employee and tax year exist
      const employee = await db.query.employees.findFirst({
        where: and(eq(employees.id, input.employeeId), eq(employees.orgId, ctx.orgId!)),
      });
      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.taxYearId), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!taxYear) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });

      // Check if W2 already exists
      const existing = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.employeeId, input.employeeId), eq(w2Forms.taxYearId, input.taxYearId), eq(w2Forms.orgId, ctx.orgId!)),
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'W2 already exists for this employee and tax year' });

      // Get all payroll entries for this employee within the tax year
      const entries = await db.query.payrollEntries.findMany({
        where: and(
          eq(payrollEntries.employeeId, input.employeeId),
          eq(payrollEntries.orgId, ctx.orgId!),
          sql`EXISTS (
            SELECT 1 FROM ${payrollRuns} 
            WHERE ${payrollRuns.id} = ${payrollEntries.payrollRunId} 
            AND ${payrollRuns.status} = 'completed'
            AND ${payrollRuns.payDate} >= ${taxYear.startDate}
            AND ${payrollRuns.payDate} <= ${taxYear.endDate}
          )`
        ),
      });

      // Calculate W2 box values
      let box1Wages = 0;
      let box2FederalTax = 0;
      let box3SocialWages = 0;
      let box4SocialTax = 0;
      let box5MedicareWages = 0;
      let box6MedicareTax = 0;
      let box7SocialTips = 0;
      let box10DependentCare = 0;
      let box11NonqualifiedPlans = 0;
      let retirement401k = 0;
      let healthInsurance = 0;

      const socialSecurityWageBase = 168600; // 2024
      let ytdSocialWages = 0;

      for (const entry of entries) {
        const gross = Number(entry.grossPay);
        box1Wages += gross;
        box2FederalTax += Number(entry.federalTax);
        box5MedicareWages += gross;
        box6MedicareTax += Number(entry.medicareTax);
        box7SocialTips += 0; // Not tracked in current schema
        box10DependentCare += 0; // Not tracked
        box11NonqualifiedPlans += 0; // Not tracked
        retirement401k += Number(entry.retirement401k);
        healthInsurance += Number(entry.healthInsurance);

        // Social Security wages are capped
        const remaining = Math.max(0, socialSecurityWageBase - ytdSocialWages);
        const ssWages = Math.min(gross, remaining);
        box3SocialWages += ssWages;
        box4SocialTax += Number(entry.socialSecurityTax);
        ytdSocialWages += ssWages;
      }

      // Build box 12 codes
      const box12Codes: Array<{ code: string; amount: string }> = [];
      if (retirement401k > 0) box12Codes.push({ code: 'D', amount: String(Math.round(retirement401k * 100) / 100) });
      // Box 13 checkboxes
      const box13Checkboxes = {
        statutoryEmployee: false,
        retirementPlan: retirement401k > 0,
        thirdPartySickPay: false,
      };

      // Box 14 other
      const box14Other: Array<{ label: string; amount: string }> = [];
      if (healthInsurance > 0) box14Other.push({ label: 'Health Insurance', amount: String(Math.round(healthInsurance * 100) / 100) });

      const [w2] = await db.insert(w2Forms).values({
        orgId: ctx.orgId!,
        employeeId: input.employeeId,
        taxYearId: input.taxYearId,
        formStatus: 'generated',
        box1Wages: String(Math.round(box1Wages * 100) / 100),
        box2FederalTax: String(Math.round(box2FederalTax * 100) / 100),
        box3SocialWages: String(Math.round(box3SocialWages * 100) / 100),
        box4SocialTax: String(Math.round(box4SocialTax * 100) / 100),
        box5MedicareWages: String(Math.round(box5MedicareWages * 100) / 100),
        box6MedicareTax: String(Math.round(box6MedicareTax * 100) / 100),
        box7SocialTips: String(Math.round(box7SocialTips * 100) / 100),
        box8AllocatedTips: '0',
        box10DependentCare: String(Math.round(box10DependentCare * 100) / 100),
        box11NonqualifiedPlans: String(Math.round(box11NonqualifiedPlans * 100) / 100),
        box12Codes,
        box13Checkboxes,
        box14Other,
        stateWages: [],
        localWages: [],
        metadata: { generatedFrom: entries.length + ' payroll entries' },
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'w2_form',
        w2.id,
        { employeeId: w2.employeeId, taxYearId: w2.taxYearId, formStatus: w2.formStatus },
      );

      return w2;
    }),

  updateW2: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      box1Wages: z.string().or(z.number()).optional(),
      box2FederalTax: z.string().or(z.number()).optional(),
      box3SocialWages: z.string().or(z.number()).optional(),
      box4SocialTax: z.string().or(z.number()).optional(),
      box5MedicareWages: z.string().or(z.number()).optional(),
      box6MedicareTax: z.string().or(z.number()).optional(),
      box7SocialTips: z.string().or(z.number()).optional(),
      box8AllocatedTips: z.string().or(z.number()).optional(),
      box10DependentCare: z.string().or(z.number()).optional(),
      box11NonqualifiedPlans: z.string().or(z.number()).optional(),
      box12Codes: z.array(z.object({ code: z.string(), amount: z.string().or(z.number()) })).optional(),
      box13Checkboxes: z.record(z.boolean()).optional(),
      box14Other: z.array(z.object({ label: z.string(), amount: z.string().or(z.number()) })).optional(),
      stateWages: z.array(z.record(z.any())).optional(),
      localWages: z.array(z.record(z.any())).optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rawUpdates } = input;

      const existing = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, id), eq(w2Forms.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'W2 form not found' });

      const updates: Record<string, any> = { ...rawUpdates, updatedAt: new Date() };
      const numericFields = ['box1Wages', 'box2FederalTax', 'box3SocialWages', 'box4SocialTax', 'box5MedicareWages', 'box6MedicareTax', 'box7SocialTips', 'box8AllocatedTips', 'box10DependentCare', 'box11NonqualifiedPlans'];
      for (const field of numericFields) {
        if (field in updates && updates[field] !== undefined && updates[field] !== null) {
          updates[field] = String(updates[field]);
        }
      }

      // Convert nested array amounts to strings
      if (updates.box12Codes) {
        updates.box12Codes = updates.box12Codes.map((c: any) => ({
          ...c,
          amount: String(c.amount),
        }));
      }
      if (updates.box14Other) {
        updates.box14Other = updates.box14Other.map((o: any) => ({
          ...o,
          amount: String(o.amount),
        }));
      }

      const [updated] = await db.update(w2Forms)
        .set(updates)
        .where(and(eq(w2Forms.id, id), eq(w2Forms.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'w2_form',
        id,
        existing as Record<string, unknown>,
        rawUpdates as Record<string, unknown>,
      );

      return updated;
    }),

  previewW2: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const w2 = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)),
        with: {
          employee: {
            columns: {
              id: true, firstName: true, lastName: true, employeeId: true,
              address: true, ssnHash: true, email: true, phone: true,
            },
          },
          taxYear: { columns: { id: true, year: true, startDate: true, endDate: true } },
        },
      });

      if (!w2) throw new TRPCError({ code: 'NOT_FOUND', message: 'W2 form not found' });

      const result = {
        ...w2,
        preview: true,
        boxes: {
          a: w2.employee?.ssnHash || 'XXX-XX-XXXX',
          b: 'XX-XXXXXXX', // Employer EIN - would come from org settings
          c: { employerName: 'Organization', employerAddress: {} }, // Placeholder
          d: w2.employee?.employeeId || '',
          e: `${w2.employee?.firstName || ''} ${w2.employee?.lastName || ''}`,
          f: w2.employee?.address || {},
          1: w2.box1Wages,
          2: w2.box2FederalTax,
          3: w2.box3SocialWages,
          4: w2.box4SocialTax,
          5: w2.box5MedicareWages,
          6: w2.box6MedicareTax,
          7: w2.box7SocialTips,
          8: w2.box8AllocatedTips,
          10: w2.box10DependentCare,
          11: w2.box11NonqualifiedPlans,
          12: w2.box12Codes,
          13: w2.box13Checkboxes,
          14: w2.box14Other,
          state: w2.stateWages,
          local: w2.localWages,
        },
      };

      if (ctx.user.role !== 'admin' && result.employee) {
        const { ssnHash, ...employeeWithoutSsn } = result.employee;
        result.employee = employeeWithoutSsn as typeof result.employee;
        result.boxes.a = 'XXX-XX-XXXX';
      }

      return result;
    }),

  distributeW2: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'W2 form not found' });
      if (existing.formStatus === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'W2 must be generated before distribution' });

      const [updated] = await db.update(w2Forms)
        .set({ formStatus: 'distributed', employeeCopyDistributedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'w2_form',
        input.id,
        { formStatus: existing.formStatus },
        { formStatus: 'distributed', employeeCopyDistributedAt: new Date() },
      );

      return updated;
    }),

  fileW2: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      filingType: z.enum(['irs', 'ssa']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'W2 form not found' });

      const updates: Record<string, any> = { formStatus: 'filed', updatedAt: new Date() };
      if (input.filingType === 'irs' || !input.filingType) updates.irsFiledAt = new Date();
      if (input.filingType === 'ssa' || !input.filingType) updates.ssaFiledAt = new Date();

      const [updated] = await db.update(w2Forms)
        .set(updates)
        .where(and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'w2_form',
        input.id,
        { formStatus: existing.formStatus },
        { formStatus: 'filed', irsFiledAt: updates.irsFiledAt, ssaFiledAt: updates.ssaFiledAt },
      );

      return updated;
    }),

  generateW2c: adminProcedure
    .input(z.object({
      originalW2Id: z.string().uuid(),
      corrections: z.record(z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      const original = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, input.originalW2Id), eq(w2Forms.orgId, ctx.orgId!)),
        with: { employee: true, taxYear: true },
      });
      if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: 'Original W2 form not found' });

      const [corrected] = await db.insert(w2Forms).values({
        orgId: ctx.orgId!,
        employeeId: original.employeeId,
        taxYearId: original.taxYearId,
        formStatus: 'corrected',
        correctedW2Id: original.id,
        box1Wages: input.corrections.box1Wages !== undefined ? String(input.corrections.box1Wages) : original.box1Wages,
        box2FederalTax: input.corrections.box2FederalTax !== undefined ? String(input.corrections.box2FederalTax) : original.box2FederalTax,
        box3SocialWages: input.corrections.box3SocialWages !== undefined ? String(input.corrections.box3SocialWages) : original.box3SocialWages,
        box4SocialTax: input.corrections.box4SocialTax !== undefined ? String(input.corrections.box4SocialTax) : original.box4SocialTax,
        box5MedicareWages: input.corrections.box5MedicareWages !== undefined ? String(input.corrections.box5MedicareWages) : original.box5MedicareWages,
        box6MedicareTax: input.corrections.box6MedicareTax !== undefined ? String(input.corrections.box6MedicareTax) : original.box6MedicareTax,
        box7SocialTips: input.corrections.box7SocialTips !== undefined ? String(input.corrections.box7SocialTips) : original.box7SocialTips,
        box8AllocatedTips: input.corrections.box8AllocatedTips !== undefined ? String(input.corrections.box8AllocatedTips) : original.box8AllocatedTips,
        box10DependentCare: input.corrections.box10DependentCare !== undefined ? String(input.corrections.box10DependentCare) : original.box10DependentCare,
        box11NonqualifiedPlans: input.corrections.box11NonqualifiedPlans !== undefined ? String(input.corrections.box11NonqualifiedPlans) : original.box11NonqualifiedPlans,
        box12Codes: input.corrections.box12Codes || original.box12Codes,
        box13Checkboxes: input.corrections.box13Checkboxes || original.box13Checkboxes,
        box14Other: input.corrections.box14Other || original.box14Other,
        stateWages: input.corrections.stateWages || original.stateWages,
        localWages: input.corrections.localWages || original.localWages,
        metadata: { ...(original.metadata || {}), correctedFrom: original.id, corrections: input.corrections },
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'w2c_form',
        corrected.id,
        { originalW2Id: original.id, employeeId: corrected.employeeId, corrections: input.corrections },
      );

      return corrected;
    }),

  exportW2PDF: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const w2 = await db.query.w2Forms.findFirst({
        where: and(eq(w2Forms.id, input.id), eq(w2Forms.orgId, ctx.orgId!)),
        with: {
          employee: { columns: { id: true, firstName: true, lastName: true, employeeId: true, ssnHash: true, address: true } },
          taxYear: { columns: { id: true, year: true } },
        },
      });

      if (!w2) throw new TRPCError({ code: 'NOT_FOUND', message: 'W2 form not found' });

      return {
        w2,
        pdfUrl: null, // Placeholder for PDF generation
        message: 'PDF generation is not yet implemented. Use the preview endpoint for now.',
      };
    }),
});

