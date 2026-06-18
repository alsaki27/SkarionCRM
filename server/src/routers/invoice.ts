import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { invoices, invoiceLines, payments, contacts, chartOfAccounts, bankAccounts } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

function toStringAmount(val: string | number): string {
  return typeof val === 'number' ? val.toString() : val;
}

export const invoiceRouter = router({
  // ─── 1. listInvoices ───
  listInvoices: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: z.string().optional(),
          contactId: z.string().uuid().optional(),
          search: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(invoices.orgId, ctx.orgId!),
        eq(contacts.orgId, ctx.orgId!),
      ];

      if (input.status) conditions.push(eq(invoices.status, input.status as any));
      if (input.contactId) conditions.push(eq(invoices.contactId, input.contactId));
      if (input.dateFrom) conditions.push(gte(invoices.issueDate, input.dateFrom));
      if (input.dateTo) conditions.push(lte(invoices.issueDate, input.dateTo));

      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(invoices.invoiceNumber, pattern),
            ilike(invoices.poNumber, pattern),
            ilike(contacts.fullName, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const rows = await db
        .select()
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(whereClause)
        .orderBy(desc(invoices.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const totalResult = await db
        .select({ count: count() })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(whereClause);

      const items = rows.map((row) => ({
        ...row.invoices,
        contact: row.contacts ? { id: row.contacts.id, fullName: row.contacts.fullName } : null,
      }));

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // ─── 2. getInvoiceById ───
  getInvoiceById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, input.id), eq(invoices.orgId, ctx.orgId!)),
        with: {
          contact: true,
          lines: {
            with: {
              account: true,
            },
          },
          payments: true,
        },
      });

      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      return invoice;
    }),

  // ─── 3. createInvoice ───
  createInvoice: protectedProcedure
    .input(
      z.object({
        invoiceNumber: z.string().min(1).max(50),
        contactId: z.string().uuid(),
        issueDate: z.string(),
        dueDate: z.string(),
        subtotal: z.string().or(z.number()),
        taxAmount: z.string().or(z.number()).optional(),
        discountAmount: z.string().or(z.number()).optional(),
        totalAmount: z.string().or(z.number()),
        taxRate: z.string().or(z.number()).optional(),
        terms: z.string().max(255).optional(),
        poNumber: z.string().max(100).optional(),
        notes: z.string().optional(),
        footer: z.string().optional(),
        template: z.string().max(50).optional(),
        lines: z
          .array(
            z.object({
              lineNumber: z.number().int().min(1),
              description: z.string().min(1),
              quantity: z.string().or(z.number()).optional(),
              unitPrice: z.string().or(z.number()).optional(),
              amount: z.string().or(z.number()),
              taxRate: z.string().or(z.number()).optional(),
              taxAmount: z.string().or(z.number()).optional(),
              discountAmount: z.string().or(z.number()).optional(),
              accountId: z.string().uuid().optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate contact exists and belongs to org
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, input.contactId), eq(contacts.orgId, ctx.orgId!)),
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });

      const totalAmountStr = toStringAmount(input.totalAmount);
      const subtotalStr = toStringAmount(input.subtotal);
      const taxAmountStr = input.taxAmount !== undefined ? toStringAmount(input.taxAmount) : '0';
      const discountAmountStr = input.discountAmount !== undefined ? toStringAmount(input.discountAmount) : '0';
      const taxRateStr = input.taxRate !== undefined ? toStringAmount(input.taxRate) : '0';

      const [invoice] = await db
        .insert(invoices)
        .values({
          orgId: ctx.orgId!,
          invoiceNumber: input.invoiceNumber,
          contactId: input.contactId,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          status: 'draft',
          subtotal: subtotalStr,
          taxAmount: taxAmountStr,
          discountAmount: discountAmountStr,
          totalAmount: totalAmountStr,
          amountPaid: '0',
          amountDue: totalAmountStr,
          taxRate: taxRateStr,
          terms: input.terms,
          poNumber: input.poNumber,
          notes: input.notes,
          footer: input.footer,
          template: input.template ?? 'default',
          metadata: {},
        })
        .returning();

      await db.insert(invoiceLines).values(
        input.lines.map((line) => ({
          orgId: ctx.orgId!,
          invoiceId: invoice.id,
          lineNumber: line.lineNumber,
          description: line.description,
          quantity: line.quantity !== undefined ? toStringAmount(line.quantity) : '1',
          unitPrice: line.unitPrice !== undefined ? toStringAmount(line.unitPrice) : '0',
          amount: toStringAmount(line.amount),
          taxRate: line.taxRate !== undefined ? toStringAmount(line.taxRate) : '0',
          taxAmount: line.taxAmount !== undefined ? toStringAmount(line.taxAmount) : '0',
          discountAmount: line.discountAmount !== undefined ? toStringAmount(line.discountAmount) : '0',
          accountId: line.accountId,
          metadata: {},
        }))
      );

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'invoice',
        invoice.id,
        { invoiceNumber: invoice.invoiceNumber, contactId: invoice.contactId, totalAmount: invoice.totalAmount }
      );

      return invoice;
    }),

  // ─── 4. updateInvoice ───
  updateInvoice: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        invoiceNumber: z.string().min(1).max(50).optional(),
        contactId: z.string().uuid().optional(),
        issueDate: z.string().optional(),
        dueDate: z.string().optional(),
        subtotal: z.string().or(z.number()).optional(),
        taxAmount: z.string().or(z.number()).optional(),
        discountAmount: z.string().or(z.number()).optional(),
        totalAmount: z.string().or(z.number()).optional(),
        taxRate: z.string().or(z.number()).optional(),
        terms: z.string().max(255).optional(),
        poNumber: z.string().max(100).optional(),
        notes: z.string().optional(),
        footer: z.string().optional(),
        template: z.string().max(50).optional(),
        status: z.string().optional(),
        lines: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              lineNumber: z.number().int().min(1),
              description: z.string().min(1),
              quantity: z.string().or(z.number()).optional(),
              unitPrice: z.string().or(z.number()).optional(),
              amount: z.string().or(z.number()),
              taxRate: z.string().or(z.number()).optional(),
              taxAmount: z.string().or(z.number()).optional(),
              discountAmount: z.string().or(z.number()).optional(),
              accountId: z.string().uuid().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, lines, ...updates } = input;

      const existing = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      if (updates.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, updates.contactId), eq(contacts.orgId, ctx.orgId!)),
        });
        if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      }

      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };

      // Convert provided amounts
      if (updates.subtotal !== undefined) setData.subtotal = toStringAmount(updates.subtotal);
      if (updates.taxAmount !== undefined) setData.taxAmount = toStringAmount(updates.taxAmount);
      if (updates.discountAmount !== undefined) setData.discountAmount = toStringAmount(updates.discountAmount);
      if (updates.totalAmount !== undefined) setData.totalAmount = toStringAmount(updates.totalAmount);
      if (updates.taxRate !== undefined) setData.taxRate = toStringAmount(updates.taxRate);

      let finalTotalAmount = parseFloat(existing.totalAmount);

      // If lines are provided, delete existing and re-insert
      if (lines && lines.length > 0) {
        await db
          .delete(invoiceLines)
          .where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.orgId, ctx.orgId!)));

        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;

        const lineValues = lines.map((line) => {
          const amount = parseFloat(toStringAmount(line.amount));
          const lineTaxAmount = line.taxAmount !== undefined ? parseFloat(toStringAmount(line.taxAmount)) : 0;
          const lineDiscountAmount = line.discountAmount !== undefined ? parseFloat(toStringAmount(line.discountAmount)) : 0;

          subtotal += amount;
          taxAmount += lineTaxAmount;
          discountAmount += lineDiscountAmount;

          return {
            orgId: ctx.orgId!,
            invoiceId: id,
            lineNumber: line.lineNumber,
            description: line.description,
            quantity: line.quantity !== undefined ? toStringAmount(line.quantity) : '1',
            unitPrice: line.unitPrice !== undefined ? toStringAmount(line.unitPrice) : '0',
            amount: toStringAmount(line.amount),
            taxRate: line.taxRate !== undefined ? toStringAmount(line.taxRate) : '0',
            taxAmount: line.taxAmount !== undefined ? toStringAmount(line.taxAmount) : '0',
            discountAmount: line.discountAmount !== undefined ? toStringAmount(line.discountAmount) : '0',
            accountId: line.accountId,
            metadata: {},
          };
        });

        await db.insert(invoiceLines).values(lineValues);

        finalTotalAmount = subtotal + taxAmount - discountAmount;
        setData.subtotal = subtotal.toFixed(2);
        setData.taxAmount = taxAmount.toFixed(2);
        setData.discountAmount = discountAmount.toFixed(2);
        setData.totalAmount = finalTotalAmount.toFixed(2);

        const currentPaid = parseFloat(existing.amountPaid);
        setData.amountDue = (finalTotalAmount - currentPaid).toFixed(2);
      }

      // Handle status transitions
      if (updates.status) {
        if (updates.status === 'sent') {
          setData.sentAt = new Date();
        } else if (updates.status === 'paid') {
          setData.paidAt = new Date();
          setData.amountPaid = finalTotalAmount.toFixed(2);
          setData.amountDue = '0';
        }
      }

      const [updated] = await db
        .update(invoices)
        .set(setData)
        .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'invoice',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  // ─── 5. deleteInvoice ───
  deleteInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, input.id), eq(invoices.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      await db
        .update(invoices)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(invoices.id, input.id), eq(invoices.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'invoice',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true };
    }),

  // ─── 6. recordPayment ───
  recordPayment: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.string().or(z.number()),
        paymentDate: z.string(),
        paymentMethod: z.enum([
          'cash',
          'check',
          'ach',
          'wire',
          'credit_card',
          'debit_card',
          'stripe',
          'paypal',
          'other',
        ]),
        referenceNumber: z.string().max(255).optional(),
        memo: z.string().optional(),
        bankAccountId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, input.invoiceId), eq(invoices.orgId, ctx.orgId!)),
      });
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot record payment for a paid or cancelled invoice',
        });
      }

      const amountStr = toStringAmount(input.amount);

      const [payment] = await db
        .insert(payments)
        .values({
          orgId: ctx.orgId!,
          invoiceId: input.invoiceId,
          contactId: invoice.contactId,
          paymentDate: input.paymentDate,
          amount: amountStr,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber,
          memo: input.memo,
          bankAccountId: input.bankAccountId,
          metadata: {},
        })
        .returning();

      // Update invoice
      const currentPaid = parseFloat(invoice.amountPaid);
      const paymentAmount = parseFloat(amountStr);
      const totalAmount = parseFloat(invoice.totalAmount);
      const newPaid = currentPaid + paymentAmount;
      const newDue = totalAmount - newPaid;

      let newStatus: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded' =
        invoice.status;
      let paidAt: Date | null = null;

      if (newDue <= 0.001) {
        newStatus = 'paid';
        paidAt = new Date();
      } else if (newPaid > 0) {
        newStatus = 'partially_paid';
      }

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          amountPaid: newPaid.toFixed(2),
          amountDue: newDue.toFixed(2),
          status: newStatus,
          paidAt: paidAt ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.orgId, ctx.orgId!)))
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'payment',
        payment.id,
        { invoiceId: payment.invoiceId, amount: payment.amount, paymentMethod: payment.paymentMethod }
      );

      return { payment, invoice: updatedInvoice };
    }),

  // ─── 7. deletePayment ───
  deletePayment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const payment = await db.query.payments.findFirst({
        where: and(eq(payments.id, input.id), eq(payments.orgId, ctx.orgId!)),
      });
      if (!payment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });

      const invoiceId = payment.invoiceId;
      if (!invoiceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment is not linked to an invoice' });
      }

      await db.delete(payments).where(and(eq(payments.id, input.id), eq(payments.orgId, ctx.orgId!)));

      // Recalculate invoice
      const remainingPayments = await db
        .select()
        .from(payments)
        .where(and(eq(payments.invoiceId, invoiceId), eq(payments.orgId, ctx.orgId!)));

      const totalPaid = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, invoiceId), eq(invoices.orgId, ctx.orgId!)),
      });
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      const totalAmount = parseFloat(invoice.totalAmount);
      const newDue = totalAmount - totalPaid;

      let newStatus: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded';
      let paidAt: Date | null = null;

      if (newDue <= 0.001) {
        newStatus = 'paid';
        paidAt = new Date();
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'sent';
      }

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          amountPaid: totalPaid.toFixed(2),
          amountDue: newDue.toFixed(2),
          status: newStatus,
          paidAt: paidAt ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, ctx.orgId!)))
        .returning();

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'payment',
        input.id,
        payment as Record<string, unknown>
      );

      return updatedInvoice;
    }),

  // ─── 8. getAgingReport ───
  getAgingReport: protectedProcedure
    .input(
      z
        .object({
          asOfDate: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();
      const asOfStr = asOfDate.toISOString().split('T')[0];

      const ageExpr = sql<number>`${asOfStr}::date - ${invoices.dueDate}`;

      const rows = await db
        .select({
          contactId: contacts.id,
          contactName: contacts.fullName,
          current: sql<string>`SUM(CASE WHEN ${ageExpr} <= 0 THEN ${invoices.amountDue} ELSE 0 END)`,
          days30: sql<string>`SUM(CASE WHEN ${ageExpr} > 0 AND ${ageExpr} <= 30 THEN ${invoices.amountDue} ELSE 0 END)`,
          days60: sql<string>`SUM(CASE WHEN ${ageExpr} > 30 AND ${ageExpr} <= 60 THEN ${invoices.amountDue} ELSE 0 END)`,
          days90: sql<string>`SUM(CASE WHEN ${ageExpr} > 60 AND ${ageExpr} <= 90 THEN ${invoices.amountDue} ELSE 0 END)`,
          over90: sql<string>`SUM(CASE WHEN ${ageExpr} > 90 THEN ${invoices.amountDue} ELSE 0 END)`,
          totalDue: sql<string>`SUM(${invoices.amountDue})`,
        })
        .from(invoices)
        .innerJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(
          and(
            eq(invoices.orgId, ctx.orgId!),
            eq(contacts.orgId, ctx.orgId!),
            or(
              eq(invoices.status, 'sent' as any),
              eq(invoices.status, 'partially_paid' as any),
              eq(invoices.status, 'overdue' as any)
            ),
            sql`${invoices.amountDue} > 0`
          )
        )
        .groupBy(contacts.id, contacts.fullName)
        .orderBy(desc(sql<string>`SUM(${invoices.amountDue})`));

      return rows.map((row) => ({
        contactId: row.contactId,
        contactName: row.contactName,
        current: parseFloat(row.current ?? '0'),
        days30: parseFloat(row.days30 ?? '0'),
        days60: parseFloat(row.days60 ?? '0'),
        days90: parseFloat(row.days90 ?? '0'),
        over90: parseFloat(row.over90 ?? '0'),
        totalDue: parseFloat(row.totalDue ?? '0'),
      }));
    }),
});
