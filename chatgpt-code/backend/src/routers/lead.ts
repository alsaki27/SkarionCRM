import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/client.js';
import { leads, leadProfiles, users } from '../db/schema.js';
import { eq, and, ilike, desc, gte, lte, sql, count } from 'drizzle-orm';

// Lead router implements a subset of the functionality described in the
// planning document.  It demonstrates how to list and create leads with
// type‑safe queries using Drizzle and tRPC.  Filtering and pagination are
// supported.

export const leadRouter = router({
  // List leads with optional filters.  Outreach agents automatically see
  // only their own leads, while admins and other roles see all leads.
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      temperature: z.string().optional(),
      source: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const conditions: any[] = [];
      // Only show leads assigned to the user if they are an outreach agent
      if (ctx.user.role === 'outreach_agent') {
        conditions.push(eq(leads.ownerId, ctx.user.id));
      }
      if (input.status) conditions.push(eq(leads.status, input.status as any));
      if (input.temperature) conditions.push(eq(leads.temperature, input.temperature as any));
      if (input.source) conditions.push(eq(leads.source, input.source));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          sql`${leads.fullName} ILIKE ${pattern} OR ${leads.email} ILIKE ${pattern}`
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [items, totalResult] = await Promise.all([
        db.query.leads.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(leads.score), desc(leads.createdAt)],
        }),
        db.select({ count: count() }).from(leads).where(whereClause),
      ]);
      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  // Create a new lead.  A very simple implementation that sets the owner
  // based on the current user and assigns a default score of zero.  In a
  // complete system you would include deduplication, automatic assignment,
  // and scoring here.
  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      source: z.string(),
      campaignTag: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [newLead] = await db
        .insert(leads)
        .values({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          location: input.location,
          source: input.source,
          campaignTag: input.campaignTag,
          ownerId: ctx.user.id,
        })
        .returning();
      return { leadId: newLead.id };
    }),
});