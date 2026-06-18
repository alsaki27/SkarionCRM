import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { documents, documentTemplates } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const documentRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
      search: z.string().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(documents.orgId, ctx.orgId!)];

      if (input.entityType) conditions.push(eq(documents.entityType, input.entityType));
      if (input.entityId) conditions.push(eq(documents.entityId, input.entityId));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(documents.fileName, pattern),
            ilike(documents.fileType, pattern),
            ilike(documents.storageProvider, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.documents.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(documents.createdAt)],
          with: {
            uploader: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(documents).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  create: protectedProcedure
    .input(z.object({
      fileName: z.string().min(1).max(255),
      filePath: z.string().min(1),
      fileType: z.string().max(50).optional(),
      fileSize: z.number().int().optional(),
      entityType: z.string().max(50).optional(),
      entityId: z.string().uuid().optional(),
      storageProvider: z.string().max(20).default('supabase'),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [doc] = await db.insert(documents).values({
        orgId: ctx.orgId!,
        fileName: input.fileName,
        filePath: input.filePath,
        fileType: input.fileType || null,
        fileSize: input.fileSize || null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        storageProvider: input.storageProvider,
        uploadedBy: ctx.user.id,
        metadata: input.metadata || {},
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'document',
        doc.id,
        { fileName: doc.fileName, entityType: doc.entityType, entityId: doc.entityId },
      );

      return doc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.documents.findFirst({
        where: and(eq(documents.id, input.id), eq(documents.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      await db.delete(documents).where(eq(documents.id, input.id));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'document',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  getByEntity: protectedProcedure
    .input(z.object({
      entityType: z.string().min(1),
      entityId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(documents.orgId, ctx.orgId!),
        eq(documents.entityType, input.entityType),
        eq(documents.entityId, input.entityId),
      ];
      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.documents.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(documents.createdAt)],
          with: {
            uploader: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(documents).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  listTemplates: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      templateType: z.string().optional(),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(documentTemplates.orgId, ctx.orgId!)];

      if (input.templateType) conditions.push(eq(documentTemplates.templateType, input.templateType as any));
      if (input.isActive !== undefined) conditions.push(eq(documentTemplates.isActive, input.isActive));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(or(ilike(documentTemplates.name, pattern), ilike(documentTemplates.description, pattern))!);
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.documentTemplates.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(documentTemplates.createdAt)],
        }),
        db.select({ count: count() }).from(documentTemplates).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      templateType: z.enum(['w2', '1099', 'contract', 'invoice', 'letter', 'compliance', 'paystub', 'other']),
      filePath: z.string().optional(),
      variables: z.array(z.string()).optional(),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const [template] = await db.insert(documentTemplates).values({
        orgId: ctx.orgId!,
        name: input.name,
        templateType: input.templateType,
        filePath: input.filePath || null,
        variables: input.variables || [],
        description: input.description || null,
        isActive: input.isActive,
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'document_template',
        template.id,
        { name: template.name, templateType: template.templateType },
      );

      return template;
    }),
});
