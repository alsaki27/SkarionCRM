import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authService } from '../services/auth.js';
import { auditService } from '../services/audit.js';
import { TRPCError } from '@trpc/server';

export const orgRouter = router({
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.orgId!),
      });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      return org;
    }),

  update: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      taxId: z.string().max(50).optional(),
      businessType: z.string().max(50).optional(),
      industry: z.string().max(100).optional(),
      address: z.record(z.any()).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().email().optional(),
      website: z.string().max(255).optional(),
      fiscalYearEnd: z.string().max(5).optional(),
      timezone: z.string().max(50).optional(),
      currency: z.string().max(3).optional(),
      settings: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db.update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.orgId!))
        .returning();
      
      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'organization',
        ctx.orgId!,
        {},
        input as Record<string, unknown>,
      );
      
      return updated;
    }),

  listUsers: protectedProcedure
    .query(async ({ ctx }) => {
      return await db.query.users.findMany({
        where: eq(users.orgId, ctx.orgId!),
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      });
    }),

  inviteUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().min(1).max(255),
      role: z.enum(['admin', 'accountant', 'bookkeeper', 'viewer', 'employee']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await authService.inviteUser(
        ctx.orgId!,
        ctx.user.id,
        input.email,
        input.fullName,
        input.role
      );
      
      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'user',
        user.id,
        { email: user.email, fullName: user.fullName, role: user.role },
      );
      
      return user;
    }),

  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['admin', 'accountant', 'bookkeeper', 'viewer', 'employee']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.orgId!)),
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const oldRole = user.role;
      const [updated] = await db.update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning();
      
      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'user',
        input.userId,
        { role: oldRole },
        { role: input.role },
      );
      
      return updated;
    }),

  deactivateUser: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(users.id, input.userId), eq(users.orgId, ctx.orgId!)))
        .returning();
      
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'user',
        input.userId,
        { isActive: true },
        { isActive: false },
      );
      
      return updated;
    }),
});
