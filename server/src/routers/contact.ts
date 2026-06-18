import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { contacts, contactCommunications } from '../db/schema.js';
import { eq, and, like, ilike, or, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const contactRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      type: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      tag: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(contacts.orgId, ctx.orgId!)];
      conditions.push(sql`${contacts.deletedAt} IS NULL`);
      
      if (input.type) conditions.push(eq(contacts.type, input.type as any));
      if (input.status) conditions.push(eq(contacts.status, input.status as any));
      if (input.assignedTo) conditions.push(eq(contacts.assignedTo, input.assignedTo));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(contacts.fullName, pattern),
            ilike(contacts.email, pattern),
            ilike(contacts.phone, pattern),
            ilike(contacts.companyName, pattern)
          )!
        );
      }
      
      const whereClause = and(...conditions);
      
      const [items, totalResult] = await Promise.all([
        db.query.contacts.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(contacts.createdAt)],
          with: {
            assignee: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(contacts).where(whereClause),
      ]);
      
      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, input.id), eq(contacts.orgId, ctx.orgId!)),
        with: {
          assignee: { columns: { id: true, fullName: true, email: true } },
          communications: {
            orderBy: [desc(contactCommunications.createdAt)],
            limit: 50,
          },
          documents: true,
          tasks: true,
        },
      });
      
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return contact;
    }),

  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      type: z.enum(['client', 'vendor', 'employee', 'contractor', 'prospect', 'partner']),
      companyName: z.string().max(255).optional(),
      taxId: z.string().max(50).optional(),
      address: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [contact] = await db.insert(contacts).values({
        orgId: ctx.orgId!,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        type: input.type,
        companyName: input.companyName,
        taxId: input.taxId,
        address: input.address || {},
        tags: input.tags || [],
        notes: input.notes,
        assignedTo: input.assignedTo || ctx.user.id,
      }).returning();
      
      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'contact',
        contact.id,
        { fullName: contact.fullName, type: contact.type, email: contact.email },
      );
      
      return contact;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      fullName: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      type: z.enum(['client', 'vendor', 'employee', 'contractor', 'prospect', 'partner']).optional(),
      status: z.enum(['active', 'inactive', 'archived']).optional(),
      companyName: z.string().max(255).optional(),
      taxId: z.string().max(50).optional(),
      address: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      
      const existing = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, id), eq(contacts.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      
      const [updated] = await db.update(contacts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      
      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'contact',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );
      
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, input.id), eq(contacts.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      
      await db.update(contacts)
        .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(eq(contacts.id, input.id));
      
      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'contact',
        input.id,
        existing as Record<string, unknown>,
      );
      
      return { success: true };
    }),

  addCommunication: protectedProcedure
    .input(z.object({
      contactId: z.string().uuid(),
      channel: z.enum(['email', 'phone', 'sms', 'meeting', 'note']),
      direction: z.enum(['inbound', 'outbound']).default('outbound'),
      content: z.string().min(1),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [comm] = await db.insert(contactCommunications).values({
        orgId: ctx.orgId!,
        contactId: input.contactId,
        channel: input.channel,
        direction: input.direction,
        content: input.content,
        metadata: input.metadata || {},
        createdBy: ctx.user.id,
      }).returning();
      
      await db.update(contacts)
        .set({ lastContactedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, input.contactId));
      
      return comm;
    }),

  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [
        total,
        clients,
        vendors,
        employees,
        contractors,
        active,
        inactive,
      ] = await Promise.all([
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.type, 'client'), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.type, 'vendor'), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.type, 'employee'), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.type, 'contractor'), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.status, 'active'), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), eq(contacts.status, 'inactive'), sql`${contacts.deletedAt} IS NULL`)),
      ]);
      
      return {
        total: total[0]?.count ?? 0,
        clients: clients[0]?.count ?? 0,
        vendors: vendors[0]?.count ?? 0,
        employees: employees[0]?.count ?? 0,
        contractors: contractors[0]?.count ?? 0,
        active: active[0]?.count ?? 0,
        inactive: inactive[0]?.count ?? 0,
      };
    }),
});
