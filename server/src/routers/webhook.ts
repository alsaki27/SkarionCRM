import { z } from 'zod';
import { eq, and, or, ilike, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { webhookEndpoints, webhookEvents } from '../db/schema.js';
import { auditService } from '../services/audit.js';

// ───────────────────────────────────────────
// Input schemas
// ───────────────────────────────────────────

const listEndpointsInput = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});

const getByIdInput = z.object({
  id: z.string().uuid(),
});

const createEndpointInput = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url().min(1),
  secret: z.string().optional(),
  events: z.array(z.string().min(1)).min(1),
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
});

const updateEndpointInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().min(1).optional(),
  secret: z.string().optional(),
  events: z.array(z.string().min(1)).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});

const deleteEndpointInput = z.object({
  id: z.string().uuid(),
});

const listEventsInput = z.object({
  endpointId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['delivered', 'failed', 'pending', 'retrying']).optional(),
});

const retryEventInput = z.object({
  id: z.string().uuid(),
});

// ───────────────────────────────────────────
// Router
// ───────────────────────────────────────────

export const webhookRouter = router({

  // ── 1. listEndpoints ──────────────────────
  listEndpoints: protectedProcedure
    .input(listEndpointsInput)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(webhookEndpoints.orgId, ctx.orgId!)];

      if (input.status) {
        conditions.push(eq(webhookEndpoints.status, input.status));
      }
      if (input.search) {
        const searchPattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(webhookEndpoints.name, searchPattern),
            ilike(webhookEndpoints.url, searchPattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const totalResult = await db
        .select({ count: count() })
        .from(webhookEndpoints)
        .where(whereClause);

      const total = totalResult[0]?.count ?? 0;

      const endpoints = await db.query.webhookEndpoints.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(webhookEndpoints.createdAt)],
      });

      return { total, endpoints };
    }),

  // ── 2. getEndpointById ────────────────────
  getEndpointById: protectedProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const endpoint = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(webhookEndpoints.id, input.id),
          eq(webhookEndpoints.orgId, ctx.orgId!)
        ),
      });

      if (!endpoint) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        });
      }

      const eventsCountResult = await db
        .select({ count: count() })
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.endpointId, input.id),
            eq(webhookEvents.orgId, ctx.orgId!)
          )
        );

      const eventsCount = eventsCountResult[0]?.count ?? 0;

      return { ...endpoint, eventsCount };
    }),

  // ── 3. createEndpoint ─────────────────────
  createEndpoint: adminProcedure
    .input(createEndpointInput)
    .mutation(async ({ ctx, input }) => {
      const [endpoint] = await db
        .insert(webhookEndpoints)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          url: input.url,
          secret: input.secret ?? null,
          events: input.events,
          status: input.status,
          lastDeliveredAt: null,
          lastFailureAt: null,
          failureCount: 0,
          metadata: {},
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'webhookEndpoint',
        endpoint.id,
        { name: endpoint.name, url: endpoint.url, events: endpoint.events, status: endpoint.status }
      );

      return endpoint;
    }),

  // ── 4. updateEndpoint ─────────────────────
  updateEndpoint: adminProcedure
    .input(updateEndpointInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existing = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.orgId, ctx.orgId!)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        });
      }

      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (updates.name !== undefined) updateValues.name = updates.name;
      if (updates.url !== undefined) updateValues.url = updates.url;
      if (updates.secret !== undefined) updateValues.secret = updates.secret;
      if (updates.events !== undefined) updateValues.events = updates.events;
      if (updates.status !== undefined) updateValues.status = updates.status;

      const [updated] = await db
        .update(webhookEndpoints)
        .set(updateValues)
        .where(
          and(
            eq(webhookEndpoints.id, id),
            eq(webhookEndpoints.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'webhookEndpoint',
        id,
        existing as Record<string, unknown>,
        updateValues
      );

      return updated;
    }),

  // ── 5. deleteEndpoint ─────────────────────
  deleteEndpoint: adminProcedure
    .input(deleteEndpointInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(webhookEndpoints.id, input.id),
          eq(webhookEndpoints.orgId, ctx.orgId!)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        });
      }

      await db
        .delete(webhookEvents)
        .where(
          and(
            eq(webhookEvents.endpointId, input.id),
            eq(webhookEvents.orgId, ctx.orgId!)
          )
        );

      await db
        .delete(webhookEndpoints)
        .where(
          and(
            eq(webhookEndpoints.id, input.id),
            eq(webhookEndpoints.orgId, ctx.orgId!)
          )
        );

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'webhookEndpoint',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true, id: input.id };
    }),

  // ── 6. listEvents ─────────────────────────
  listEvents: protectedProcedure
    .input(listEventsInput)
    .query(async ({ ctx, input }) => {
      const endpoint = await db.query.webhookEndpoints.findFirst({
        where: and(
          eq(webhookEndpoints.id, input.endpointId),
          eq(webhookEndpoints.orgId, ctx.orgId!)
        ),
      });

      if (!endpoint) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        });
      }

      const conditions = [
        eq(webhookEvents.endpointId, input.endpointId),
        eq(webhookEvents.orgId, ctx.orgId!),
      ];

      if (input.status) {
        if (input.status === 'delivered') {
          conditions.push(sql`${webhookEvents.deliveredAt} IS NOT NULL`);
        } else if (input.status === 'failed') {
          conditions.push(sql`${webhookEvents.failedAt} IS NOT NULL`);
        } else if (input.status === 'pending') {
          conditions.push(
            and(
              sql`${webhookEvents.deliveredAt} IS NULL`,
              sql`${webhookEvents.failedAt} IS NULL`,
              sql`${webhookEvents.nextAttemptAt} IS NOT NULL`,
              gte(webhookEvents.nextAttemptAt, new Date().toISOString())
            )!
          );
        } else if (input.status === 'retrying') {
          conditions.push(
            and(
              sql`${webhookEvents.deliveredAt} IS NULL`,
              sql`${webhookEvents.failedAt} IS NULL`,
              or(
                sql`${webhookEvents.nextAttemptAt} IS NULL`,
                lte(webhookEvents.nextAttemptAt, new Date().toISOString())
              )!
            )!
          );
        }
      }

      const whereClause = and(...conditions);

      const totalResult = await db
        .select({ count: count() })
        .from(webhookEvents)
        .where(whereClause);

      const total = totalResult[0]?.count ?? 0;

      const events = await db.query.webhookEvents.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(webhookEvents.createdAt)],
      });

      const eventsWithStatus = events.map((event) => {
        let deliveryStatus: 'delivered' | 'failed' | 'pending' | 'retrying';
        if (event.deliveredAt) {
          deliveryStatus = 'delivered';
        } else if (event.failedAt) {
          deliveryStatus = 'failed';
        } else if (event.nextAttemptAt && new Date(event.nextAttemptAt) > new Date()) {
          deliveryStatus = 'pending';
        } else {
          deliveryStatus = 'retrying';
        }
        return { ...event, deliveryStatus };
      });

      return { total, events: eventsWithStatus };
    }),

  // ── 7. retryEvent ─────────────────────────
  retryEvent: protectedProcedure
    .input(retryEventInput)
    .mutation(async ({ ctx, input }) => {
      const event = await db.query.webhookEvents.findFirst({
        where: and(
          eq(webhookEvents.id, input.id),
          eq(webhookEvents.orgId, ctx.orgId!)
        ),
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook event not found',
        });
      }

      if (!event.failedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only failed events can be retried',
        });
      }

      const updateValues = {
        failedAt: null,
        errorMessage: null,
        attemptCount: 1,
        nextAttemptAt: new Date().toISOString(),
      };

      const [updated] = await db
        .update(webhookEvents)
        .set(updateValues)
        .where(
          and(
            eq(webhookEvents.id, input.id),
            eq(webhookEvents.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'webhookEvent',
        input.id,
        event as Record<string, unknown>,
        updateValues
      );

      return updated;
    }),
});
