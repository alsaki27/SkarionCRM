import { initTRPC, TRPCError } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export async function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, orgId: null, db };
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const jwtSecret = process.env.JWT_SECRET || 'skarion-dev-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });
    
    if (!user || !user.isActive) {
      return { user: null, orgId: null, db };
    }
    
    return { user, orgId: user.orgId, db };
  } catch {
    return { user: null, orgId: null, db };
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
    return next({ ctx });
  })
);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user.role !== 'owner' && ctx.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return next({ ctx });
  })
);

export const ownerProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user.role !== 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner access required' });
    }
    return next({ ctx });
  })
);
