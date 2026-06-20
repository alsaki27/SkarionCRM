// server/src/routers/aiKeys.ts
// Admin-only CRUD for AI provider API keys (OpenAI/Kimi/Ollama/etc.), so admins
// can rotate keys from the UI without redeploying env vars. Full keys are never
// returned to the client after creation — only metadata + a display fingerprint.

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure } from '../trpc.js';
import { isEncryptionAvailable } from '../security/secretCrypto.js';
import {
  listAiProviderKeys,
  createAiProviderKey,
  updateAiProviderKey,
  disableAiProviderKey,
} from '../services/aiProviderKeys.js';
import { testAiProviderKey } from '../services/aiClient.js';
import { auditService } from '../services/audit.js';

const PROVIDERS = ['openai', 'kimi', 'ollama', 'openrouter', 'deepseek'] as const;

export const aiKeysRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return listAiProviderKeys(ctx.orgId!);
  }),

  create: adminProcedure
    .input(
      z.object({
        provider: z.enum(PROVIDERS),
        label: z.string().min(1).max(255),
        apiKey: z.string().min(1),
        baseUrl: z.string().url().optional(),
        priority: z.number().int().min(1).max(1000).default(100),
        isEnabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isEncryptionAvailable()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI key encryption is not configured. Set AI_KEYS_ENCRYPTION_SECRET to add API keys.',
        });
      }
      const key = await createAiProviderKey({
        orgId: ctx.orgId!,
        provider: input.provider,
        label: input.label,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl ?? null,
        priority: input.priority,
        isEnabled: input.isEnabled,
        createdBy: ctx.user.id,
      });
      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'aiProviderKey', key.id, {
        provider: key.provider,
        label: key.label,
        fingerprint: key.keyFingerprint,
      });
      return key;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(255).optional(),
        baseUrl: z.string().url().nullable().optional(),
        priority: z.number().int().min(1).max(1000).optional(),
        isEnabled: z.boolean().optional(),
        apiKey: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.apiKey !== undefined && !isEncryptionAvailable()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI key encryption is not configured. Set AI_KEYS_ENCRYPTION_SECRET to replace API keys.',
        });
      }
      const { id, ...updates } = input;
      const key = await updateAiProviderKey(ctx.orgId!, id, updates);
      if (!key) throw new TRPCError({ code: 'NOT_FOUND', message: 'AI provider key not found' });

      await auditService.logUpdate(ctx.orgId!, ctx.user.id, 'aiProviderKey', id, {}, {
        label: key.label,
        priority: key.priority,
        isEnabled: key.isEnabled,
      });
      return key;
    }),

  disable: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const key = await disableAiProviderKey(ctx.orgId!, input.id);
      if (!key) throw new TRPCError({ code: 'NOT_FOUND', message: 'AI provider key not found' });

      await auditService.logDelete(ctx.orgId!, ctx.user.id, 'aiProviderKey', input.id, {
        provider: key.provider,
        label: key.label,
      });
      return key;
    }),

  test: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return testAiProviderKey(ctx.orgId!, input.id);
    }),
});
