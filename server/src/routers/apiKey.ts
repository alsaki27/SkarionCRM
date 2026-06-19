import { z } from 'zod';
import { eq, and, or, desc, count, gte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { auditService } from '../services/audit.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// ───────────────────────────────────────────
// Input schemas
// ───────────────────────────────────────────

const listApiKeysInput = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['active', 'revoked', 'expired']).optional(),
});

const getByIdInput = z.object({
  id: z.string().uuid(),
});

const createApiKeyInput = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string().min(1)).default(['read']),
  rateLimit: z.number().min(1).max(100000).default(1000),
  expiresAt: z.string().datetime().optional(),
});

const revokeApiKeyInput = z.object({
  id: z.string().uuid(),
});

const deleteApiKeyInput = z.object({
  id: z.string().uuid(),
});

const validateApiKeyInput = z.object({
  key: z.string().min(1),
});

// ───────────────────────────────────────────
// Router
// ───────────────────────────────────────────

export const apiKeyRouter = router({

  // ── 1. listApiKeys ────────────────────────
  listApiKeys: protectedProcedure
    .input(listApiKeysInput)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(apiKeys.orgId, ctx.orgId!)];

      if (input.status) {
        conditions.push(eq(apiKeys.status, input.status));
      }

      const whereClause = and(...conditions);

      const totalResult = await db
        .select({ count: count() })
        .from(apiKeys)
        .where(whereClause);

      const total = totalResult[0]?.count ?? 0;

      const keys = await db.query.apiKeys.findMany({
        where: whereClause,
        with: {
          creator: {
            columns: { id: true, fullName: true, email: true },
          },
        },
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(apiKeys.createdAt)],
      });

      return { total, keys: keys.map(({ keyHash: _kh, ...k }) => k) };
    }),

  // ── 2. getApiKeyById ──────────────────────
  getApiKeyById: protectedProcedure
    .input(getByIdInput)
    .query(async ({ ctx, input }) => {
      const key = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.orgId, ctx.orgId!)
        ),
        with: {
          creator: {
            columns: { id: true, fullName: true, email: true },
          },
        },
      });

      if (!key) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      const { keyHash: _kh, ...keyWithoutHash } = key;
      return keyWithoutHash;
    }),

  // ── 3. createApiKey ───────────────────────
  createApiKey: adminProcedure
    .input(createApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const keyPrefix = 'skarion_';
      const randomPart = randomBytes(32).toString('hex');
      const fullKey = `${keyPrefix}${randomPart}`;

      const keyHash = await bcrypt.hash(fullKey, 12);

      const [apiKey] = await db
        .insert(apiKeys)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          keyPrefix,
          keyHash,
          permissions: input.permissions,
          rateLimit: input.rateLimit,
          expiresAt: input.expiresAt ?? null,
          lastUsedAt: null,
          status: 'active',
          metadata: {},
          createdBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'apiKey',
        apiKey.id,
        { name: apiKey.name, permissions: input.permissions, rateLimit: input.rateLimit }
      );

      return { apiKey, fullKey };
    }),

  // ── 4. revokeApiKey ───────────────────────
  revokeApiKey: adminProcedure
    .input(revokeApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.orgId, ctx.orgId!)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      if (existing.status !== 'active') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only active API keys can be revoked',
        });
      }

      const [updated] = await db
        .update(apiKeys)
        .set({
          status: 'revoked',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.orgId, ctx.orgId!)
          )
        )
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'apiKey',
        input.id,
        existing as Record<string, unknown>,
        { status: 'revoked' }
      );

      return updated;
    }),

  // ── 5. deleteApiKey ───────────────────────
  deleteApiKey: adminProcedure
    .input(deleteApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.orgId, ctx.orgId!)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      await db
        .delete(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.orgId, ctx.orgId!)
          )
        );

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'apiKey',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true, id: input.id };
    }),

  // ── 6. validateApiKey ─────────────────────
  validateApiKey: publicProcedure
    .input(validateApiKeyInput)
    .query(async ({ input }) => {
      const keyPrefix = 'skarion_';
      if (!input.key.startsWith(keyPrefix)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid API key format',
        });
      }

      const now = new Date().toISOString();

      const candidates = await db.query.apiKeys.findMany({
        where: and(
          eq(apiKeys.status, 'active'),
          or(
            gte(apiKeys.expiresAt, now),
            sql`${apiKeys.expiresAt} IS NULL`
          )
        ),
      });

      for (const candidate of candidates) {
        const isValid = await bcrypt.compare(input.key, candidate.keyHash);
        if (isValid) {
          await db
            .update(apiKeys)
            .set({
              lastUsedAt: now,
              updatedAt: new Date(),
            })
            .where(eq(apiKeys.id, candidate.id));

          return {
            orgId: candidate.orgId,
            permissions: candidate.permissions,
            rateLimit: candidate.rateLimit,
          };
        }
      }

      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired API key',
      });
    }),
});
