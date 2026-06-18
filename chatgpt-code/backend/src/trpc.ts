import { initTRPC, TRPCError } from '@trpc/server';
import { inferAsyncReturnType } from '@trpc/server';
import { db } from './db/client.js';

// -----------------------------------------------------------------------------
// Context
//
// The tRPC context is created on every request.  In a real application this
// would parse a JWT or session cookie to identify the user and optionally
// enforce authorization.  For now it returns a dummy admin user so that
// API routes requiring a user can operate without authentication.

export async function createContext() {
  // TODO: integrate Clerk or your auth provider here
  const user = {
    id: '00000000-0000-0000-0000-000000000000',
    fullName: 'Developer',
    email: 'developer@example.com',
    role: 'admin',
  } as const;
  return {
    db,
    user,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

// -----------------------------------------------------------------------------
// tRPC initialization
//
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure checks that the user exists in the context.  In a real
// system you would also verify roles or permissions here.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
  }
  return next({ ctx });
});