import { router } from '../trpc.js';
import { leadRouter } from './lead.js';

// Combine all domain routers into a single app router.  Additional
// routers (conversation, pipeline, task, enrollment, analytics, teams,
// ai) should be added here as they are implemented.

export const appRouter = router({
  lead: leadRouter,
});

export type AppRouter = typeof appRouter;