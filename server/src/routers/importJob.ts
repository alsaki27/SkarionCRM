import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { importJobs } from '../db/schema.js';
import { auditService } from '../services/audit.js';

export const importJobRouter = router({
  listImportJobs: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: z.string().optional(),
          entityType: z.string().optional(),
          sourceType: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(importJobs.orgId, ctx.orgId!)];

      if (input.status) {
        conditions.push(eq(importJobs.status, input.status));
      }
      if (input.entityType) {
        conditions.push(eq(importJobs.entityType, input.entityType));
      }
      if (input.sourceType) {
        conditions.push(eq(importJobs.sourceType, input.sourceType));
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(importJobs.name, pattern),
            ilike(importJobs.entityType, pattern),
            ilike(importJobs.sourceType, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.importJobs.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(importJobs.createdAt)],
          with: {
            creator: {
              columns: { id: true, fullName: true, email: true },
            },
          },
        }),
        db.select({ count: count() }).from(importJobs).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  getImportJobById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const job = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, input.id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
        with: {
          creator: {
            columns: { id: true, fullName: true, email: true },
          },
        },
      });

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      return job;
    }),

  createImportJob: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        sourceType: z.enum(['csv', 'greenhouse', 'lever', 'api', 'xlsx', 'json']),
        entityType: z.enum([
          'contacts',
          'employees',
          'transactions',
          'invoices',
          'chart_of_accounts',
        ]),
        filePath: z.string().optional(),
        rawData: z.array(z.record(z.any())).default([]),
        mappedFields: z.record(z.string()).default({}),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [job] = await db
        .insert(importJobs)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          sourceType: input.sourceType,
          entityType: input.entityType,
          filePath: input.filePath,
          rawData: input.rawData,
          mappedFields: input.mappedFields,
          totalRows: input.rawData.length,
          createdBy: ctx.user.id,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        job.id,
        {
          name: job.name,
          sourceType: job.sourceType,
          entityType: job.entityType,
          totalRows: job.totalRows,
        }
      );

      return job;
    }),

  updateImportJob: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        mappedFields: z.record(z.string()).optional(),
        status: z
          .enum(['pending', 'processing', 'completed', 'failed', 'cancelled'])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      const [updated] = await db
        .update(importJobs)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(importJobs.id, id), eq(importJobs.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  processImportJob: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, input.id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      if (
        existing.status === 'completed' ||
        existing.status === 'cancelled'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot process job with status: ${existing.status}`,
        });
      }

      // Step 1: Mark as processing
      await db
        .update(importJobs)
        .set({
          status: 'processing',
          startedAt: existing.startedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, input.id));

      // Step 2: Simulate processing
      const totalRows = existing.totalRows || 0;
      const processedRows = totalRows;
      const successRows = Math.floor(totalRows * 0.9);
      const errorRows = totalRows - successRows;

      const errors: Array<{ row: number; message: string }> = [];
      if (errorRows > 0) {
        for (let i = 0; i < errorRows; i++) {
          errors.push({
            row: successRows + i + 1,
            message: 'Simulated validation error',
          });
        }
      }

      // Step 3: Mark as completed with simulated results
      const [updated] = await db
        .update(importJobs)
        .set({
          status: 'completed',
          processedRows,
          successRows,
          errorRows,
          errors,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, input.id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        input.id,
        {
          status: existing.status,
          processedRows: existing.processedRows,
          successRows: existing.successRows,
          errorRows: existing.errorRows,
        },
        {
          status: updated.status,
          processedRows: updated.processedRows,
          successRows: updated.successRows,
          errorRows: updated.errorRows,
        }
      );

      return updated;
    }),

  cancelImportJob: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, input.id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      if (existing.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel a completed job',
        });
      }

      const [updated] = await db
        .update(importJobs)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, input.id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        input.id,
        { status: existing.status, cancelledAt: existing.cancelledAt },
        { status: updated.status, cancelledAt: updated.cancelledAt }
      );

      return updated;
    }),

  deleteImportJob: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, input.id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      await db
        .delete(importJobs)
        .where(and(eq(importJobs.id, input.id), eq(importJobs.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'importJob',
        input.id,
        existing as Record<string, unknown>
      );

      return { success: true };
    }),

  getImportJobPreview: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const job = await db.query.importJobs.findFirst({
        where: and(
          eq(importJobs.id, input.id),
          eq(importJobs.orgId, ctx.orgId!)
        ),
      });

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import job not found',
        });
      }

      const rawData = Array.isArray(job.rawData) ? job.rawData : [];
      const preview = rawData.slice(0, 10);

      return {
        jobId: job.id,
        name: job.name,
        totalRows: rawData.length,
        previewRows: preview,
        mappedFields: job.mappedFields,
      };
    }),
});
