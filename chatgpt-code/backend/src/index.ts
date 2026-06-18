import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createContext } from './trpc.js';
import { appRouter } from './routers/app.js';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

async function main() {
  const app = express();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;

  app.use(cors());
  app.use(express.json());

  app.use('/trpc', createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  // Basic health check
  app.get('/', (_, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});