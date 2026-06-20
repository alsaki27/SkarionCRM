import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './routers/_app.js';
import { createContext } from './trpc.js';
import { setDB } from './db/index.js';
import {
  checkOverdueTasks,
  checkTaxDeadlines,
  checkComplianceDeadlines,
  processRecurringTransactions,
} from './services/cron.js';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize database connection for this request isolate
    setDB(env.DATABASE_URL);

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'production',
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // tRPC API handler
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: request,
      router: appRouter,
      createContext: (opts) => createContext({ req: opts.req, env }),
      responseMeta() {
        return {
          headers: {
            'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
          },
        };
      },
      onError: (opts) => {
        console.error('tRPC error:', opts.error);
      },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Initialize database connection for cron jobs
    setDB(env.DATABASE_URL);

    switch (event.cron) {
      case '0 8 * * *':
        await checkOverdueTasks();
        break;
      case '0 9 * * *':
        await checkTaxDeadlines();
        break;
      case '30 9 * * *':
        await checkComplianceDeadlines();
        break;
      case '0 3 * * *':
        await processRecurringTransactions();
        break;
      default:
        console.log('[CRON] Unknown schedule:', event.cron);
    }
  },
};
