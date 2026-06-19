import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { taxYears, taxForms, taxCalculations, contacts } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const taxRouter = router({
  // ─── Tax Years ───
  listTaxYears: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          status: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(taxYears.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(taxYears.status, input.status as any));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(sql`cast(${taxYears.year} as text)`, pattern),
            ilike(taxYears.notes, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.taxYears.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(taxYears.year)],
          with: {
            taxForms: true,
          },
        }),
        db.select({ count: count() }).from(taxYears).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createTaxYear: adminProcedure
    .input(
      z.object({
        year: z.number().int().min(1900).max(2100),
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(['open', 'closed', 'filing', 'extended']).optional(),
        formTypes: z.array(z.string()).optional(),
        extensionFiled: z.boolean().optional(),
        extensionDeadline: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.orgId, ctx.orgId!), eq(taxYears.year, input.year)),
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: `Tax year ${input.year} already exists` });
      }

      const [year] = await db
        .insert(taxYears)
        .values({
          orgId: ctx.orgId!,
          year: input.year,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status || 'open',
          formTypes: input.formTypes || [],
          extensionFiled: input.extensionFiled || false,
          extensionDeadline: input.extensionDeadline,
          notes: input.notes,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'tax_year', year.id, {
        year: year.year,
        status: year.status,
      });

      return year;
    }),

  closeTaxYear: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.id), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });

      if (existing.status === 'closed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tax year is already closed' });
      }

      const [updated] = await db
        .update(taxYears)
        .set({ status: 'closed', filedDate: new Date().toISOString().split('T')[0], updatedAt: new Date() })
        .where(and(eq(taxYears.id, input.id), eq(taxYears.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'tax_year',
        input.id,
        { status: existing.status } as Record<string, unknown>,
        { status: 'closed' } as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Tax Forms ───
  listTaxForms: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          taxYearId: z.string().uuid().optional(),
          formType: z.string().optional(),
          status: z.string().optional(),
          contactId: z.string().uuid().optional(),
          deadlineFrom: z.string().optional(),
          deadlineTo: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(taxForms.orgId, ctx.orgId!)];

      if (input.taxYearId) conditions.push(eq(taxForms.taxYearId, input.taxYearId));
      if (input.formType) conditions.push(eq(taxForms.formType, input.formType as any));
      if (input.status) conditions.push(eq(taxForms.status, input.status as any));
      if (input.contactId) conditions.push(eq(taxForms.contactId, input.contactId));
      if (input.deadlineFrom) conditions.push(gte(taxForms.filingDeadline, input.deadlineFrom));
      if (input.deadlineTo) conditions.push(lte(taxForms.filingDeadline, input.deadlineTo));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(taxForms.formName, pattern),
            ilike(taxForms.irsAcknowledgment, pattern),
            ilike(taxForms.efileTransmissionId, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.taxForms.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(taxForms.filingDeadline)],
          with: {
            taxYear: { columns: { id: true, year: true } },
            contact: { columns: { id: true, fullName: true } },
            preparer: { columns: { id: true, fullName: true } },
            reviewer: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(taxForms).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createTaxForm: adminProcedure
    .input(
      z.object({
        taxYearId: z.string().uuid(),
        formType: z.enum([
          'w2', 'w2c', '1099_nec', '1099_misc', '940', '941', '944', '1040', '1120', '1065', '990', 'other',
        ]),
        formName: z.string().min(1).max(255),
        filingDeadline: z.string(),
        contactId: z.string().uuid().optional(),
        amount: z.string().or(z.number()).optional(),
        notes: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate tax year belongs to org
      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.taxYearId), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!taxYear) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });

      if (input.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, input.contactId), eq(contacts.orgId, ctx.orgId!)),
        });
        if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      }

      const amountStr = input.amount !== undefined
        ? typeof input.amount === 'number' ? input.amount.toString() : input.amount
        : null;

      const [form] = await db
        .insert(taxForms)
        .values({
          orgId: ctx.orgId!,
          taxYearId: input.taxYearId,
          formType: input.formType,
          formName: input.formName,
          filingDeadline: input.filingDeadline,
          contactId: input.contactId,
          amount: amountStr,
          notes: input.notes,
          metadata: input.metadata || {},
          preparedBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'tax_form', form.id, {
        formName: form.formName,
        formType: form.formType,
        taxYearId: form.taxYearId,
      });

      return form;
    }),

  updateTaxForm: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        formName: z.string().min(1).max(255).optional(),
        status: z.enum(['draft', 'ready', 'filed', 'amended', 'rejected']).optional(),
        filingDeadline: z.string().optional(),
        filedDate: z.string().optional().nullable(),
        irsAcknowledgment: z.string().max(255).optional(),
        efileTransmissionId: z.string().max(255).optional(),
        amount: z.string().or(z.number()).optional(),
        contactId: z.string().uuid().optional().nullable(),
        preparedBy: z.string().uuid().optional(),
        reviewedBy: z.string().uuid().optional(),
        notes: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.taxForms.findFirst({
        where: and(eq(taxForms.id, id), eq(taxForms.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax form not found' });

      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };
      if (updates.amount !== undefined) {
        setData.amount = typeof updates.amount === 'number' ? updates.amount.toString() : updates.amount;
      }

      const [updated] = await db
        .update(taxForms)
        .set(setData)
        .where(and(eq(taxForms.id, id), eq(taxForms.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'tax_form',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Tax Summary & Calculations ───
  getTaxSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const [totalForms, draftForms, readyForms, filedForms, amendedForms, rejectedForms] = await Promise.all([
        db.select({ count: count() }).from(taxForms).where(eq(taxForms.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(taxForms).where(and(eq(taxForms.orgId, ctx.orgId!), eq(taxForms.status, 'draft'))),
        db.select({ count: count() }).from(taxForms).where(and(eq(taxForms.orgId, ctx.orgId!), eq(taxForms.status, 'ready'))),
        db.select({ count: count() }).from(taxForms).where(and(eq(taxForms.orgId, ctx.orgId!), eq(taxForms.status, 'filed'))),
        db.select({ count: count() }).from(taxForms).where(and(eq(taxForms.orgId, ctx.orgId!), eq(taxForms.status, 'amended'))),
        db.select({ count: count() }).from(taxForms).where(and(eq(taxForms.orgId, ctx.orgId!), eq(taxForms.status, 'rejected'))),
      ]);

      const [totalYears, openYears, closedYears, filingYears] = await Promise.all([
        db.select({ count: count() }).from(taxYears).where(eq(taxYears.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(taxYears).where(and(eq(taxYears.orgId, ctx.orgId!), eq(taxYears.status, 'open'))),
        db.select({ count: count() }).from(taxYears).where(and(eq(taxYears.orgId, ctx.orgId!), eq(taxYears.status, 'closed'))),
        db.select({ count: count() }).from(taxYears).where(and(eq(taxYears.orgId, ctx.orgId!), eq(taxYears.status, 'filing'))),
      ]);

      const upcomingDeadlines = await db.query.taxForms.findMany({
        where: and(
          eq(taxForms.orgId, ctx.orgId!),
          or(eq(taxForms.status, 'draft'), eq(taxForms.status, 'ready'))!
        ),
        orderBy: [taxForms.filingDeadline],
        limit: 10,
        with: {
          taxYear: { columns: { id: true, year: true } },
        },
      });

      return {
        forms: {
          total: totalForms[0]?.count ?? 0,
          draft: draftForms[0]?.count ?? 0,
          ready: readyForms[0]?.count ?? 0,
          filed: filedForms[0]?.count ?? 0,
          amended: amendedForms[0]?.count ?? 0,
          rejected: rejectedForms[0]?.count ?? 0,
        },
        years: {
          total: totalYears[0]?.count ?? 0,
          open: openYears[0]?.count ?? 0,
          closed: closedYears[0]?.count ?? 0,
          filing: filingYears[0]?.count ?? 0,
        },
        upcomingDeadlines,
      };
    }),

  calculateTax: protectedProcedure
    .input(
      z.object({
        taxYearId: z.string().uuid(),
        formType: z.enum([
          'w2', 'w2c', '1099_nec', '1099_misc', '940', '941', '944', '1040', '1120', '1065', '990', 'other',
        ]),
        calculationType: z.string().min(1).max(50),
        baseAmount: z.string().or(z.number()),
        rate: z.string().or(z.number()).optional(),
        jurisdiction: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.taxYearId), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!taxYear) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });

      const baseAmount = typeof input.baseAmount === 'number' ? input.baseAmount : parseFloat(input.baseAmount);
      const rate = input.rate !== undefined
        ? (typeof input.rate === 'number' ? input.rate : parseFloat(input.rate))
        : 0;

      // Placeholder calculation logic
      let calculatedAmount = 0;
      if (rate > 0) {
        calculatedAmount = baseAmount * rate;
      } else {
        // Default placeholder rates based on form type
        const defaultRates: Record<string, number> = {
          '940': 0.006,
          '941': 0.0765,
          '944': 0.0765,
          '1040': 0.22,
          '1120': 0.21,
          '1065': 0.0,
          '990': 0.0,
        };
        calculatedAmount = baseAmount * (defaultRates[input.formType] ?? 0.15);
      }

      const [calculation] = await db
        .insert(taxCalculations)
        .values({
          orgId: ctx.orgId!,
          taxYearId: input.taxYearId,
          formType: input.formType,
          calculationType: input.calculationType,
          baseAmount: baseAmount.toFixed(2),
          rate: rate.toFixed(6),
          calculatedAmount: calculatedAmount.toFixed(2),
          jurisdiction: input.jurisdiction,
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'tax_calculation', calculation.id, {
        taxYearId: calculation.taxYearId,
        formType: calculation.formType,
        baseAmount: calculation.baseAmount,
        calculatedAmount: calculation.calculatedAmount,
      });

      return calculation;
    }),
});
