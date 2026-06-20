import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createContext } from './trpc.js';
import { appRouter } from './routers/_app.js';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { initializeCronJobs } from './services/cron.js';
import { requestLogger } from './observability/requestLogger.js';
import { createRateLimiter, rateLimitOptionsFromEnv } from './security/rateLimit.js';
import { parseAllowedOrigins, securityHeaders } from './security/securityHeaders.js';

async function main() {
  const app = express();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestLogger());
  app.use(securityHeaders());
  app.use(cors({ origin: parseAllowedOrigins(appUrl), credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // tRPC API
  app.use('/trpc', createRateLimiter(rateLimitOptionsFromEnv()), createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  app.listen(port, () => {
    console.log(`Skarion CRM API running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize scheduled jobs
    initializeCronJobs();
    console.log('Cron jobs initialized');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
