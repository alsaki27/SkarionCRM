import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { integrations } from '../db/schema.js';
import { auditService } from '../services/audit.js';

export const integrationRouter = router({
  listIntegrations: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          type: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(integrations.orgId, ctx.orgId!)];

      if (input.type) {
        conditions.push(eq(integrations.type, input.type as any));
      }
      if (input.status) {
        conditions.push(eq(integrations.status, input.status as any));
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(integrations.name, pattern),
            ilike(integrations.type, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.integrations.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(integrations.createdAt)],
          with: {
            creator: {
              columns: { id: true, fullName: true, email: true },
            },
          },
        }),
        db.select({ count: count() }).from(integrations).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  getIntegrationById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, input.id),
          eq(integrations.orgId, ctx.orgId!)
        ),
        with: {
          creator: {
            columns: { id: true, fullName: true, email: true },
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Integration not found',
        });
      }

      return integration;
    }),

  createIntegration: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum([
          'greenhouse',
          'lever',
          'workday',
          'bamboohr',
          'gusto',
          'quickbooks',
          'stripe',
          'zapier',
          'custom',
        ]),
        credentials: z.record(z.any()).default({}),
        config: z.record(z.any()).default({}),
        syncFrequency: z
          .enum(['manual', 'hourly', 'daily', 'realtime'])
          .default('daily'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [integration] = await db
        .insert(integrations)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          type: input.type,
          credentials: input.credentials,
          config: input.config,
          syncFrequency: input.syncFrequency,
          createdBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'integration',
        integration.id,
        {
          name: integration.name,
          type: integration.type,
          syncFrequency: integration.syncFrequency,
        }
      );

      return integration;
    }),

  updateIntegration: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        credentials: z.record(z.any()).optional(),
        config: z.record(z.any()).optional(),
        syncFrequency: z
          .enum(['manual', 'hourly', 'daily', 'realtime'])
          .optional(),
        status: z
          .enum(['connected', 'disconnected', 'error', 'pending_auth'])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, id),
          eq(integrations.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Integration not found',
        });
      }

      const [updated] = await db
        .update(integrations)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(integrations.id, id), eq(integrations.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'integration',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  deleteIntegration: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, input.id),
          eq(integrations.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Integration not found',
        });
      }

      await db
        .delete(integrations)
        .where(and(eq(integrations.id, input.id), eq(integrations.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'integration',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true };
    }),

  syncIntegration: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['success', 'error', 'in_progress']).default('success'),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, input.id),
          eq(integrations.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Integration not found',
        });
      }

      const [updated] = await db
        .update(integrations)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: input.status,
          lastSyncError: input.error || null,
          updatedAt: new Date(),
        })
        .where(and(eq(integrations.id, input.id), eq(integrations.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'integration',
        input.id,
        {
          lastSyncAt: existing.lastSyncAt,
          lastSyncStatus: existing.lastSyncStatus,
          lastSyncError: existing.lastSyncError,
        },
        {
          lastSyncAt: updated.lastSyncAt,
          lastSyncStatus: updated.lastSyncStatus,
          lastSyncError: updated.lastSyncError,
        }
      );

      return updated;
    }),

  getIntegrationTypes: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.orgId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Organization required',
      });
    }

    return [
      {
        value: 'greenhouse',
        label: 'Greenhouse',
        category: 'ats',
        description: 'Applicant tracking system',
      },
      {
        value: 'lever',
        label: 'Lever',
        category: 'ats',
        description: 'Talent acquisition platform',
      },
      {
        value: 'workday',
        label: 'Workday',
        category: 'hr',
        description: 'Enterprise HR & finance',
      },
      {
        value: 'bamboohr',
        label: 'BambooHR',
        category: 'hr',
        description: 'HR software for small businesses',
      },
      {
        value: 'gusto',
        label: 'Gusto',
        category: 'payroll',
        description: 'Payroll, benefits, and HR',
      },
      {
        value: 'quickbooks',
        label: 'QuickBooks',
        category: 'accounting',
        description: 'Accounting software',
      },
      {
        value: 'stripe',
        label: 'Stripe',
        category: 'payments',
        description: 'Payment processing',
      },
      {
        value: 'zapier',
        label: 'Zapier',
        category: 'automation',
        description: 'Workflow automation',
      },
      {
        value: 'custom',
        label: 'Custom API',
        category: 'custom',
        description: 'Custom integration',
      },
    ];
  }),
});
