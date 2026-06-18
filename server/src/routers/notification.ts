import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { eq, and, desc, count } from "drizzle-orm";
import { notifications } from "../db/schema.js";
import { auditService } from "../services/auditService.js";

export const notificationRouter = router({
  listNotifications: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        read: z.boolean().optional(),
        type: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const conditions = [eq(notifications.orgId, ctx.orgId!)];

      if (input.read !== undefined) {
        conditions.push(
          input.read
            ? eq(notifications.readAt, new Date())
            : eq(notifications.readAt, null)
        );
      }

      if (input.type) {
        conditions.push(eq(notifications.type, input.type));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      const [items, totalResult] = await Promise.all([
        ctx.db
          .select()
          .from(notifications)
          .where(whereClause)
          .orderBy(desc(notifications.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(notifications)
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

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.orgId, ctx.orgId!),
          eq(notifications.readAt, null)
        )
      );

    return { count: result[0]?.value ?? 0 };
  }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      const [updated] = await ctx.db
        .update(notifications)
        .set({ readAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(ctx, "notification", input.id, {
        readAt: new Date().toISOString(),
      });

      return updated;
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();

    await ctx.db
      .update(notifications)
      .set({ readAt: now, updatedAt: now })
      .where(
        and(
          eq(notifications.orgId, ctx.orgId!),
          eq(notifications.readAt, null)
        )
      );

    await auditService.logUpdate(ctx, "notification", "all", {
      action: "markAllAsRead",
      readAt: now.toISOString(),
    });

    return { success: true };
  }),

  dismissNotification: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      const [updated] = await ctx.db
        .update(notifications)
        .set({ dismissedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(ctx, "notification", input.id, {
        dismissedAt: new Date().toISOString(),
      });

      return updated;
    }),

  createNotification: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        type: z.string().min(1).max(50),
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(2000),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      const [created] = await ctx.db
        .insert(notifications)
        .values({
          orgId: ctx.orgId!,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          metadata: input.metadata ?? {},
          readAt: null,
          dismissedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await auditService.logCreate(ctx, "notification", created.id, {
        userId: input.userId,
        type: input.type,
        title: input.title,
      });

      return created;
    }),

  deleteNotification: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      await ctx.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.orgId, ctx.orgId!)
          )
        );

      await auditService.logDelete(ctx, "notification", input.id, {
        title: existing[0]?.title,
      });

      return { success: true, id: input.id };
    }),
});
