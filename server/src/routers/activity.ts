import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { eq, and, or, desc, count, gte, lte, ilike } from 'drizzle-orm';
import { activityLogs } from '../db/schema.js';
import { auditService } from '../services/audit.js';
import { db } from '../db/index.js';

export const activityRouter = router({
  listActivities: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        type: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const conditions = [eq(activityLogs.orgId, ctx.orgId!)];

      if (input.type) {
        conditions.push(eq(activityLogs.type, input.type));
      }

      if (input.entityType) {
        conditions.push(eq(activityLogs.entityType, input.entityType));
      }

      if (input.entityId) {
        conditions.push(eq(activityLogs.entityId, input.entityId));
      }

      if (input.dateFrom) {
        conditions.push(gte(activityLogs.createdAt, new Date(input.dateFrom)));
      }

      if (input.dateTo) {
        conditions.push(lte(activityLogs.createdAt, new Date(input.dateTo)));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(activityLogs.description, `%${input.search}%`),
            ilike(activityLogs.actorName, `%${input.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(activityLogs)
          .where(whereClause)
          .orderBy(desc(activityLogs.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ value: count() })
          .from(activityLogs)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.value ?? 0;

      return {
        items,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  getActivitySummary: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.orgId, ctx.orgId!),
          gte(activityLogs.createdAt, last30Days)
        )
      );

    const last7DaysCounts: Record<string, number> = {};
    const last30DaysCounts: Record<string, number> = {};

    for (const row of rows) {
      const type = row.type;
      last30DaysCounts[type] = (last30DaysCounts[type] ?? 0) + 1;

      if (row.createdAt >= last7Days) {
        last7DaysCounts[type] = (last7DaysCounts[type] ?? 0) + 1;
      }
    }

    return {
      last7Days: last7DaysCounts,
      last30Days: last30DaysCounts,
    };
  }),

  logActivity: protectedProcedure
    .input(
      z.object({
        type: z.string().min(1).max(50),
        entityType: z.string().min(1).max(50).optional(),
        entityId: z.string().uuid().optional(),
        description: z.string().min(1).max(2000),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      const req = ctx.req as
        | { headers?: Record<string, string | string[]>; ip?: string }
        | undefined;
      const ip =
        req?.headers?.['x-forwarded-for']?.toString() ||
        req?.headers?.['x-real-ip']?.toString() ||
        req?.ip ||
        '';
      const userAgent = req?.headers?.['user-agent']?.toString() || '';

      const [created] = await db
        .insert(activityLogs)
        .values({
          orgId: ctx.orgId!,
          actorId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorEmail: ctx.user.email,
          type: input.type,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          description: input.description,
          metadata: input.metadata ?? {},
          ipAddress: ip,
          userAgent: userAgent,
          createdAt: now,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'activityLog',
        created.id,
        {
          type: input.type,
          description: input.description,
          entityType: input.entityType,
          entityId: input.entityId,
        }
      );

      return created;
    }),

  getRecentActivity: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(activityLogs.orgId, ctx.orgId!)];

      if (input.type) {
        conditions.push(eq(activityLogs.type, input.type));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const items = await db
        .select()
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(20);

      return { items };
    }),
});
