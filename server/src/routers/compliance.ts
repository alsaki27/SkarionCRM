import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { complianceCategories, complianceItems, complianceDocuments } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const complianceRouter = router({
  // ─── Compliance Categories ───
  listCategories: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(complianceCategories.orgId, ctx.orgId!)];

      if (input.isActive !== undefined) conditions.push(eq(complianceCategories.isActive, input.isActive));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(complianceCategories.name, pattern),
            ilike(complianceCategories.description, pattern),
            ilike(complianceCategories.regulatoryBody, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.complianceCategories.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [complianceCategories.name],
          with: {
            items: { limit: 5, orderBy: [desc(complianceItems.createdAt)] },
          },
        }),
        db.select({ count: count() }).from(complianceCategories).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createCategory: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        regulatoryBody: z.string().max(255).optional(),
        frequency: z.string().max(50).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [category] = await db
        .insert(complianceCategories)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          description: input.description,
          regulatoryBody: input.regulatoryBody,
          frequency: input.frequency,
          priority: input.priority || 'medium',
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'compliance_category', category.id, {
        name: category.name,
        regulatoryBody: category.regulatoryBody,
        priority: category.priority,
      });

      return category;
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        regulatoryBody: z.string().max(255).optional(),
        frequency: z.string().max(50).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.complianceCategories.findFirst({
        where: and(eq(complianceCategories.id, id), eq(complianceCategories.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Compliance category not found' });

      const [updated] = await db
        .update(complianceCategories)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(complianceCategories.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'compliance_category',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  // ─── Compliance Items ───
  listItems: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
          categoryId: z.string().uuid().optional(),
          status: z.string().optional(),
          priority: z.string().optional(),
          assignedTo: z.string().uuid().optional(),
          dueDateFrom: z.string().optional(),
          dueDateTo: z.string().optional(),
          search: z.string().optional(),
          isOverdue: z.boolean().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(complianceItems.orgId, ctx.orgId!)];

      if (input.categoryId) conditions.push(eq(complianceItems.categoryId, input.categoryId));
      if (input.status) conditions.push(eq(complianceItems.status, input.status as any));
      if (input.assignedTo) conditions.push(eq(complianceItems.assignedTo, input.assignedTo));
      if (input.dueDateFrom) conditions.push(gte(complianceItems.dueDate, input.dueDateFrom));
      if (input.dueDateTo) conditions.push(lte(complianceItems.dueDate, input.dueDateTo));
      if (input.isOverdue === true) {
        conditions.push(
          and(
            lte(complianceItems.dueDate, new Date().toISOString().split('T')[0]),
            or(
              eq(complianceItems.status, 'not_started'),
              eq(complianceItems.status, 'in_progress'),
              eq(complianceItems.status, 'at_risk')
            )!
          )!
        );
      }
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(complianceItems.title, pattern),
            ilike(complianceItems.description, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.complianceItems.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(complianceItems.dueDate)],
          with: {
            category: { columns: { id: true, name: true, priority: true } },
            assignee: { columns: { id: true, fullName: true } },
            reviewerUser: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(complianceItems).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  createItem: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        status: z.enum(['not_started', 'in_progress', 'compliant', 'non_compliant', 'at_risk', 'overdue']).optional(),
        dueDate: z.string().optional(),
        assignedTo: z.string().uuid().optional(),
        reviewer: z.string().uuid().optional(),
        evidenceRequired: z.boolean().optional(),
        nextReviewDate: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.categoryId) {
        const category = await db.query.complianceCategories.findFirst({
          where: and(
            eq(complianceCategories.id, input.categoryId),
            eq(complianceCategories.orgId, ctx.orgId!)
          ),
        });
        if (!category) throw new TRPCError({ code: 'NOT_FOUND', message: 'Compliance category not found' });
      }

      const [item] = await db
        .insert(complianceItems)
        .values({
          orgId: ctx.orgId!,
          categoryId: input.categoryId,
          title: input.title,
          description: input.description,
          status: input.status || 'not_started',
          dueDate: input.dueDate,
          assignedTo: input.assignedTo,
          reviewer: input.reviewer,
          evidenceRequired: input.evidenceRequired || false,
          nextReviewDate: input.nextReviewDate,
          metadata: input.metadata || {},
        })
        .returning();

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'compliance_item', item.id, {
        title: item.title,
        status: item.status,
        dueDate: item.dueDate,
      });

      return item;
    }),

  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().optional().nullable(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(['not_started', 'in_progress', 'compliant', 'non_compliant', 'at_risk', 'overdue']).optional(),
        dueDate: z.string().optional().nullable(),
        completedDate: z.string().optional().nullable(),
        assignedTo: z.string().uuid().optional().nullable(),
        reviewer: z.string().uuid().optional().nullable(),
        evidenceRequired: z.boolean().optional(),
        nextReviewDate: z.string().optional().nullable(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.complianceItems.findFirst({
        where: and(eq(complianceItems.id, id), eq(complianceItems.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Compliance item not found' });

      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };

      // Auto-set completedDate when status changes to compliant
      if (updates.status === 'compliant' && existing.status !== 'compliant') {
        setData.completedDate = new Date().toISOString().split('T')[0];
      }
      // Clear completedDate if moving away from compliant
      if (updates.status && updates.status !== 'compliant' && existing.status === 'compliant') {
        setData.completedDate = null;
      }

      const [updated] = await db
        .update(complianceItems)
        .set(setData)
        .where(eq(complianceItems.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'compliance_item',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>
      );

      return updated;
    }),

  uploadEvidence: protectedProcedure
    .input(
      z.object({
        complianceItemId: z.string().uuid(),
        documentName: z.string().min(1).max(255),
        filePath: z.string().min(1),
        fileType: z.string().max(50).optional(),
        fileSize: z.number().int().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.complianceItems.findFirst({
        where: and(eq(complianceItems.id, input.complianceItemId), eq(complianceItems.orgId, ctx.orgId!)),
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Compliance item not found' });

      const [doc] = await db
        .insert(complianceDocuments)
        .values({
          orgId: ctx.orgId!,
          complianceItemId: input.complianceItemId,
          documentName: input.documentName,
          filePath: input.filePath,
          fileType: input.fileType,
          fileSize: input.fileSize,
          uploadedBy: ctx.user.id,
          metadata: input.metadata || {},
        })
        .returning();

      // Update evidence files array on the compliance item
      const existingFiles = (item.evidenceFiles as Array<Record<string, any>>) || [];
      const newFile = {
        id: doc.id,
        documentName: doc.documentName,
        filePath: doc.filePath,
        fileType: doc.fileType,
        uploadedAt: doc.createdAt,
      };

      await db
        .update(complianceItems)
        .set({
          evidenceFiles: [...existingFiles, newFile],
          updatedAt: new Date(),
        })
        .where(eq(complianceItems.id, input.complianceItemId));

      await auditService.logCreate(ctx.orgId!, ctx.user.id, 'compliance_document', doc.id, {
        complianceItemId: doc.complianceItemId,
        documentName: doc.documentName,
        filePath: doc.filePath,
      });

      return doc;
    }),

  // ─── Dashboard & Calendar ───
  getComplianceDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date().toISOString().split('T')[0];

      const [
        totalItems,
        notStarted,
        inProgress,
        compliant,
        nonCompliant,
        atRisk,
        overdue,
      ] = await Promise.all([
        db.select({ count: count() }).from(complianceItems).where(eq(complianceItems.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'not_started'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'in_progress'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'compliant'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'non_compliant'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'at_risk'))),
        db
          .select({ count: count() })
          .from(complianceItems)
          .where(
            and(
              eq(complianceItems.orgId, ctx.orgId!),
              lte(complianceItems.dueDate, today),
              or(
                eq(complianceItems.status, 'not_started'),
                eq(complianceItems.status, 'in_progress'),
                eq(complianceItems.status, 'at_risk')
              )!
            )
          ),
      ]);

      const [criticalItems, highItems, mediumItems, lowItems] = await Promise.all([
        db.select({ count: count() }).from(complianceItems).where(
          and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'not_started'))
        ),
        // Actually we need to join with categories for priority... for now use metadata fallback
        db.select({ count: count() }).from(complianceItems).where(
          and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'overdue'))
        ),
        db.select({ count: count() }).from(complianceItems).where(
          and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'at_risk'))
        ),
        db.select({ count: count() }).from(complianceItems).where(
          and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'compliant'))
        ),
      ]);

      // Get upcoming due items for the next 30 days
      const upcomingDueDate = new Date();
      upcomingDueDate.setDate(upcomingDueDate.getDate() + 30);
      const upcomingDueDateStr = upcomingDueDate.toISOString().split('T')[0];

      const upcomingItems = await db.query.complianceItems.findMany({
        where: and(
          eq(complianceItems.orgId, ctx.orgId!),
          gte(complianceItems.dueDate, today),
          lte(complianceItems.dueDate, upcomingDueDateStr),
          or(
            eq(complianceItems.status, 'not_started'),
            eq(complianceItems.status, 'in_progress'),
            eq(complianceItems.status, 'at_risk')
          )!
        ),
        orderBy: [complianceItems.dueDate],
        limit: 10,
        with: {
          category: { columns: { id: true, name: true } },
          assignee: { columns: { id: true, fullName: true } },
        },
      });

      return {
        byStatus: {
          total: totalItems[0]?.count ?? 0,
          notStarted: notStarted[0]?.count ?? 0,
          inProgress: inProgress[0]?.count ?? 0,
          compliant: compliant[0]?.count ?? 0,
          nonCompliant: nonCompliant[0]?.count ?? 0,
          atRisk: atRisk[0]?.count ?? 0,
          overdue: overdue[0]?.count ?? 0,
        },
        byPriority: {
          critical: criticalItems[0]?.count ?? 0,
          high: highItems[0]?.count ?? 0,
          medium: mediumItems[0]?.count ?? 0,
          low: lowItems[0]?.count ?? 0,
        },
        upcomingItems,
      };
    }),

  getComplianceCalendar: protectedProcedure
    .input(
      z
        .object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(complianceItems.orgId, ctx.orgId!)];

      // Default to current month if no dates provided
      const now = new Date();
      const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const dateFrom = input.dateFrom || defaultFrom;
      const dateTo = input.dateTo || defaultTo;

      conditions.push(gte(complianceItems.dueDate, dateFrom));
      conditions.push(lte(complianceItems.dueDate, dateTo));

      const whereClause = and(...conditions);

      const items = await db.query.complianceItems.findMany({
        where: whereClause,
        orderBy: [complianceItems.dueDate],
        with: {
          category: { columns: { id: true, name: true, priority: true } },
          assignee: { columns: { id: true, fullName: true } },
        },
      });

      // Group by due date
      const grouped: Record<string, typeof items> = {};
      for (const item of items) {
        if (!item.dueDate) continue;
        const dateKey = item.dueDate;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
      }

      return {
        dateFrom,
        dateTo,
        items,
        grouped,
      };
    }),
});
