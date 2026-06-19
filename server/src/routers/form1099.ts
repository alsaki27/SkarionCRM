import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { form1099s, contacts, taxYears, payments } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────

function toStringAmount(val: string | number): string {
  return typeof val === 'number' ? val.toString() : val;
}

// ───────────────────────────────────────────
// Router
// ───────────────────────────────────────────

export const form1099Router = router({
  // ── 1. list1099s ──────────────────────────
  list1099s: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: z.string().optional(),
          formType: z.string().optional(),
          taxYearId: z.string().uuid().optional(),
          contactId: z.string().uuid().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(form1099s.orgId, ctx.orgId!)];

      if (input.status) {
        conditions.push(eq(form1099s.formStatus, input.status as any));
      }
      if (input.formType) {
        conditions.push(eq(form1099s.formType, input.formType as any));
      }
      if (input.taxYearId) {
        conditions.push(eq(form1099s.taxYearId, input.taxYearId));
      }
      if (input.contactId) {
        conditions.push(eq(form1099s.contactId, input.contactId));
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${contacts}
            WHERE ${contacts.id} = ${form1099s.contactId}
            AND ${contacts.orgId} = ${ctx.orgId!}
            AND ${contacts.fullName} ILIKE ${pattern}
          )`
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.form1099s.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(form1099s.createdAt)],
          with: {
            contact: {
              columns: { id: true, fullName: true, taxId: true, type: true },
            },
            taxYear: {
              columns: { id: true, year: true, startDate: true, endDate: true },
            },
          },
        }),
        db.select({ count: count() }).from(form1099s).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // ── 2. get1099ById ────────────────────────
  get1099ById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const form1099 = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)),
        with: {
          contact: true,
          taxYear: true,
          corrected1099: true,
        },
      });

      if (!form1099) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Form 1099 not found' });
      }

      return form1099;
    }),

  // ── 3. generate1099 ─────────────────────
  generate1099: adminProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
        taxYearId: z.string().uuid(),
        formType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate contact
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, input.contactId), eq(contacts.orgId, ctx.orgId!)),
      });
      if (!contact) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      }
      if (contact.type !== 'vendor') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Contact must be a vendor to generate a 1099' });
      }
      // Note: is1099Recipient field does not exist in current schema; using vendor type + taxId as proxy
      if (!contact.taxId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Contact must have a tax ID (EIN/SSN) to generate a 1099' });
      }

      // Validate tax year belongs to org
      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.taxYearId), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!taxYear) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });
      }

      // Check uniqueness
      const existing = await db.query.form1099s.findFirst({
        where: and(
          eq(form1099s.contactId, input.contactId),
          eq(form1099s.taxYearId, input.taxYearId),
          eq(form1099s.formType, input.formType as any),
          eq(form1099s.orgId, ctx.orgId!)
        ),
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '1099 already exists for this contact, tax year, and form type',
        });
      }

      // Get payments in tax year range
      const paymentRows = await db.query.payments.findMany({
        where: and(
          eq(payments.contactId, input.contactId),
          eq(payments.orgId, ctx.orgId!),
          gte(payments.paymentDate, taxYear.startDate),
          lte(payments.paymentDate, taxYear.endDate)
        ),
      });

      const totalPayments = paymentRows.reduce((acc, p) => acc + Number(p.amount), 0);
      const paymentCount = paymentRows.length;

      const insertValues: Record<string, any> = {
        orgId: ctx.orgId!,
        contactId: input.contactId,
        taxYearId: input.taxYearId,
        formType: input.formType as any,
        formStatus: 'draft',
        totalPayments: totalPayments.toString(),
        paymentCount,
        metadata: { generatedFrom: `${paymentCount} payments` },
      };

      if (input.formType === 'nec') {
        insertValues.box1 = totalPayments.toString();
      } else if (input.formType === 'misc') {
        insertValues.box3 = totalPayments.toString();
        // Detect medical payments via memo (best-effort; schema lacks payment category)
        let medicalTotal = 0;
        for (const payment of paymentRows) {
          const memo = (payment.memo || '').toLowerCase();
          if (memo.includes('medical') || memo.includes('health')) {
            medicalTotal += Number(payment.amount);
          }
        }
        if (medicalTotal > 0) {
          insertValues.box6 = medicalTotal.toString();
        }
      } else {
        // Other types: draft with empty boxes
        insertValues.box1 = '0';
        insertValues.box2 = '0';
        insertValues.box3 = '0';
        insertValues.box4 = '0';
        insertValues.box5 = '0';
        insertValues.box6 = '0';
        insertValues.box8 = '0';
        insertValues.box9 = '0';
        insertValues.box10 = '0';
        insertValues.box11 = '0';
        insertValues.box13 = '0';
        insertValues.box14 = '0';
      }

      const [created] = await db.insert(form1099s).values(insertValues).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        created.id,
        {
          contactId: created.contactId,
          taxYearId: created.taxYearId,
          formType: created.formType,
          formStatus: created.formStatus,
        }
      );

      return created;
    }),

  // ── 4. update1099 ─────────────────────────
  update1099: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        box1: z.string().or(z.number()).optional(),
        box2: z.string().or(z.number()).optional(),
        box3: z.string().or(z.number()).optional(),
        box4: z.string().or(z.number()).optional(),
        box5: z.string().or(z.number()).optional(),
        box6: z.string().or(z.number()).optional(),
        box7DirectSales: z.boolean().optional(),
        box8: z.string().or(z.number()).optional(),
        box9: z.string().or(z.number()).optional(),
        box10: z.string().or(z.number()).optional(),
        box11: z.string().or(z.number()).optional(),
        box13: z.string().or(z.number()).optional(),
        box14: z.string().or(z.number()).optional(),
        stateTaxes: z.array(z.record(z.any())).optional(),
        stateInfo: z.array(z.record(z.any())).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rawUpdates } = input;

      const existing = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, id), eq(form1099s.orgId, ctx.orgId!)),
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Form 1099 not found' });
      }
      if (existing.formStatus !== 'draft') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only draft forms can be updated' });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };

      const amountFields = [
        'box1',
        'box2',
        'box3',
        'box4',
        'box5',
        'box6',
        'box8',
        'box9',
        'box10',
        'box11',
        'box13',
        'box14',
      ];
      for (const field of amountFields) {
        if (field in rawUpdates && (rawUpdates as any)[field] !== undefined && (rawUpdates as any)[field] !== null) {
          updates[field] = toStringAmount((rawUpdates as any)[field]);
        }
      }

      if (rawUpdates.box7DirectSales !== undefined) {
        updates.box7DirectSales = rawUpdates.box7DirectSales;
      }
      if (rawUpdates.stateTaxes !== undefined) {
        updates.stateTaxes = rawUpdates.stateTaxes;
      }
      if (rawUpdates.stateInfo !== undefined) {
        updates.stateInfo = rawUpdates.stateInfo;
      }

      const [updated] = await db
        .update(form1099s)
        .set(updates)
        .where(and(eq(form1099s.id, id), eq(form1099s.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        id,
        existing as Record<string, unknown>,
        rawUpdates as Record<string, unknown>
      );

      return updated;
    }),

  // ── 5. distribute1099 ─────────────────────
  distribute1099: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)),
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Form 1099 not found' });
      }

      const [updated] = await db
        .update(form1099s)
        .set({
          formStatus: 'distributed',
          copyDistributedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        input.id,
        { formStatus: existing.formStatus },
        { formStatus: 'distributed', copyDistributedAt: updated.copyDistributedAt }
      );

      return updated;
    }),

  // ── 6. file1099 ───────────────────────────
  file1099: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)),
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Form 1099 not found' });
      }
      if (existing.formStatus !== 'distributed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Form must be distributed before filing',
        });
      }

      const [updated] = await db
        .update(form1099s)
        .set({
          formStatus: 'filed',
          irsFiledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        input.id,
        { formStatus: existing.formStatus },
        { formStatus: 'filed', irsFiledAt: updated.irsFiledAt }
      );

      return updated;
    }),

  // ── 7. correct1099 ──────────────────────
  correct1099: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        correctedBoxes: z.record(z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const original = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)),
      });
      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Original 1099 form not found' });
      }
      if (original.formStatus !== 'filed' && original.formStatus !== 'distributed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only filed or distributed forms can be corrected',
        });
      }

      const newValues: Record<string, any> = {
        orgId: ctx.orgId!,
        contactId: original.contactId,
        taxYearId: original.taxYearId,
        formType: original.formType,
        formStatus: 'draft',
        corrected1099Id: original.id,
        box1:
          input.correctedBoxes.box1 !== undefined
            ? toStringAmount(input.correctedBoxes.box1)
            : original.box1,
        box2:
          input.correctedBoxes.box2 !== undefined
            ? toStringAmount(input.correctedBoxes.box2)
            : original.box2,
        box3:
          input.correctedBoxes.box3 !== undefined
            ? toStringAmount(input.correctedBoxes.box3)
            : original.box3,
        box4:
          input.correctedBoxes.box4 !== undefined
            ? toStringAmount(input.correctedBoxes.box4)
            : original.box4,
        box5:
          input.correctedBoxes.box5 !== undefined
            ? toStringAmount(input.correctedBoxes.box5)
            : original.box5,
        box6:
          input.correctedBoxes.box6 !== undefined
            ? toStringAmount(input.correctedBoxes.box6)
            : original.box6,
        box7DirectSales:
          input.correctedBoxes.box7DirectSales !== undefined
            ? input.correctedBoxes.box7DirectSales
            : original.box7DirectSales,
        box8:
          input.correctedBoxes.box8 !== undefined
            ? toStringAmount(input.correctedBoxes.box8)
            : original.box8,
        box9:
          input.correctedBoxes.box9 !== undefined
            ? toStringAmount(input.correctedBoxes.box9)
            : original.box9,
        box10:
          input.correctedBoxes.box10 !== undefined
            ? toStringAmount(input.correctedBoxes.box10)
            : original.box10,
        box11:
          input.correctedBoxes.box11 !== undefined
            ? toStringAmount(input.correctedBoxes.box11)
            : original.box11,
        box13:
          input.correctedBoxes.box13 !== undefined
            ? toStringAmount(input.correctedBoxes.box13)
            : original.box13,
        box14:
          input.correctedBoxes.box14 !== undefined
            ? toStringAmount(input.correctedBoxes.box14)
            : original.box14,
        stateTaxes:
          input.correctedBoxes.stateTaxes !== undefined
            ? input.correctedBoxes.stateTaxes
            : original.stateTaxes,
        stateInfo:
          input.correctedBoxes.stateInfo !== undefined
            ? input.correctedBoxes.stateInfo
            : original.stateInfo,
        totalPayments: original.totalPayments,
        paymentCount: original.paymentCount,
        metadata: {
          ...(original.metadata || {}),
          correctedFrom: original.id,
          corrections: input.correctedBoxes,
        },
      };

      const [corrected] = await db.insert(form1099s).values(newValues).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        corrected.id,
        {
          corrected1099Id: original.id,
          formType: corrected.formType,
          corrections: input.correctedBoxes,
        }
      );

      return corrected;
    }),

  // ── 8. delete1099 ─────────────────────────
  delete1099: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.form1099s.findFirst({
        where: and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)),
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Form 1099 not found' });
      }
      if (existing.formStatus !== 'draft') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only draft forms can be deleted' });
      }

      await db
        .delete(form1099s)
        .where(and(eq(form1099s.id, input.id), eq(form1099s.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'form_1099',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true, id: input.id };
    }),

  // ── 9. getEligibleVendors ───────────────
  getEligibleVendors: protectedProcedure
    .input(z.object({ taxYearId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.id, input.taxYearId), eq(taxYears.orgId, ctx.orgId!)),
      });
      if (!taxYear) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax year not found' });
      }

      // Note: is1099Recipient field does not exist in current schema; using vendor type + taxId as proxy
      const vendorContacts = await db.query.contacts.findMany({
        where: and(eq(contacts.type, 'vendor'), eq(contacts.orgId, ctx.orgId!)),
      });

      const eligible = [];
      for (const contact of vendorContacts) {
        const paymentResult = await db
          .select({
            total: sum(payments.amount),
            count: count(),
          })
          .from(payments)
          .where(
            and(
              eq(payments.contactId, contact.id),
              eq(payments.orgId, ctx.orgId!),
              gte(payments.paymentDate, taxYear.startDate),
              lte(payments.paymentDate, taxYear.endDate)
            )
          );

        const totalPayments = Number(paymentResult[0]?.total ?? 0);
        const paymentCount = paymentResult[0]?.count ?? 0;

        if (totalPayments >= 600) {
          eligible.push({
            ...contact,
            totalPayments: totalPayments.toString(),
            paymentCount,
          });
        }
      }

      return eligible;
    }),

  // ── 10. get1099Summary ────────────────────
  get1099Summary: protectedProcedure
    .input(z.object({ taxYearId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const baseWhere = and(eq(form1099s.orgId, ctx.orgId!), eq(form1099s.taxYearId, input.taxYearId));

      const totalFormsResult = await db
        .select({ count: count() })
        .from(form1099s)
        .where(baseWhere);

      const byType = await db
        .select({
          formType: form1099s.formType,
          count: count(),
        })
        .from(form1099s)
        .where(baseWhere)
        .groupBy(form1099s.formType);

      const byStatus = await db
        .select({
          formStatus: form1099s.formStatus,
          count: count(),
        })
        .from(form1099s)
        .where(baseWhere)
        .groupBy(form1099s.formStatus);

      const totals = await db
        .select({
          totalBox1: sum(form1099s.box1),
          totalBox3: sum(form1099s.box3),
          totalPayments: sum(form1099s.totalPayments),
        })
        .from(form1099s)
        .where(baseWhere);

      return {
        totalForms: totalFormsResult[0]?.count ?? 0,
        byType: byType.map((row) => ({ formType: row.formType, count: row.count })),
        byStatus: byStatus.map((row) => ({ formStatus: row.formStatus, count: row.count })),
        totalBox1: totals[0]?.totalBox1 ?? '0',
        totalBox3: totals[0]?.totalBox3 ?? '0',
        totalPayments: totals[0]?.totalPayments ?? '0',
      };
    }),
});
