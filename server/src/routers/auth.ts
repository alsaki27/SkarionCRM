import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { authService } from '../services/auth.js';
import { auditService } from '../services/audit.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const authRouter = router({
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().min(1).max(255),
      orgName: z.string().min(1).max(255),
      businessType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.register(
        input.email,
        input.password,
        input.fullName,
        input.orgName,
        input.businessType
      );
      return { token: result.token, user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName, role: result.user.role } };
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await authService.login(input.email, input.password);
      await auditService.logLogin(
        result.user.orgId,
        result.user.id,
        undefined, // ip address would come from context
        undefined  // user agent
      );
      return {
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          orgId: result.user.orgId,
        },
      };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        orgId: user.orgId,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
      };
    }),

  changePassword: protectedProcedure
    .input(z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      await authService.changePassword(ctx.user.id, input.oldPassword, input.newPassword);
      return { success: true };
    }),
});
