import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { tasks } from '../db/schema.js';
import { eq, and, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      priority: z.string().optional(),
      type: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
      search: z.string().optional(),
      overdue: z.boolean().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(tasks.orgId, ctx.orgId!)];
      
      if (input.status) conditions.push(eq(tasks.status, input.status as any));
      if (input.priority) conditions.push(eq(tasks.priority, input.priority as any));
      if (input.type) conditions.push(eq(tasks.type, input.type as any));
      if (input.assignedTo) conditions.push(eq(tasks.assignedTo, input.assignedTo));
      if (input.entityType) conditions.push(eq(tasks.entityType, input.entityType as any));
      if (input.entityId) conditions.push(eq(tasks.entityId, input.entityId));
      if (input.overdue) {
        conditions.push(lte(tasks.dueAt, new Date()));
        conditions.push(sql`${tasks.status} NOT IN ('done', 'cancelled')`);
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(sql`${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern}`);
      }
      
      const whereClause = and(...conditions);
      
      const [items, totalResult] = await Promise.all([
        db.query.tasks.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(tasks.createdAt)],
          with: {
            assignee: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(tasks).where(whereClause),
      ]);
      
      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      type: z.enum(['follow_up', 'review', 'filing_deadline', 'compliance_review', 'tax_preparation', 'payment', 'reconciliation', 'general']).default('general'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      dueAt: z.string().datetime().optional(),
      assignedTo: z.string().uuid().optional(),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [task] = await db.insert(tasks).values({
        orgId: ctx.orgId!,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        assignedTo: input.assignedTo || ctx.user.id,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
      }).returning();
      
      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'task',
        task.id,
        { title: task.title, type: task.type, priority: task.priority },
      );
      
      return task;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled', 'overdue']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      dueAt: z.string().datetime().optional(),
      assignedTo: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      
      const existing = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, id), eq(tasks.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      
      if (ctx.user.role !== 'admin') {
        if (existing.assignedTo !== ctx.user.id && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only update tasks assigned to you or created by you',
          });
        }
      }
      
      const updateData: any = { ...updates };
      if (updates.dueAt) updateData.dueAt = new Date(updates.dueAt);
      if (updates.status === 'done') {
        updateData.completedAt = new Date();
        updateData.completedBy = ctx.user.id;
      }
      updateData.updatedAt = new Date();
      
      const [updated] = await db.update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, id), eq(tasks.orgId, ctx.orgId!)))
        .returning();
      
      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'task',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );
      
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      
      if (ctx.user.role !== 'admin') {
        if (existing.assignedTo !== ctx.user.id && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete tasks assigned to you or created by you',
          });
        }
      }
      
      await db.delete(tasks).where(and(eq(tasks.id, input.id), eq(tasks.orgId, ctx.orgId!)));
      
      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'task',
        input.id,
        existing as Record<string, unknown>,
      );
      
      return { success: true };
    }),

  getDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);
      
      const [
        total,
        overdue,
        dueThisWeek,
        highPriority,
        byStatus,
      ] = await Promise.all([
        db.select({ count: count() }).from(tasks).where(eq(tasks.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(tasks).where(
          and(
            eq(tasks.orgId, ctx.orgId!),
            lte(tasks.dueAt, now),
            sql`${tasks.status} NOT IN ('done', 'cancelled')`
          )
        ),
        db.select({ count: count() }).from(tasks).where(
          and(
            eq(tasks.orgId, ctx.orgId!),
            gte(tasks.dueAt, now),
            lte(tasks.dueAt, weekLater),
            sql`${tasks.status} NOT IN ('done', 'cancelled')`
          )
        ),
        db.select({ count: count() }).from(tasks).where(
          and(
            eq(tasks.orgId, ctx.orgId!),
            eq(tasks.priority, 'high'),
            sql`${tasks.status} NOT IN ('done', 'cancelled')`
          )
        ),
        db.select({ status: tasks.status, count: count() })
          .from(tasks)
          .where(eq(tasks.orgId, ctx.orgId!))
          .groupBy(tasks.status),
      ]);
      
      return {
        total: total[0]?.count ?? 0,
        overdue: overdue[0]?.count ?? 0,
        dueThisWeek: dueThisWeek[0]?.count ?? 0,
        highPriority: highPriority[0]?.count ?? 0,
        byStatus: byStatus.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {} as Record<string, number>),
      };
    }),
});
