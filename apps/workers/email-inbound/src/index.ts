// apps/workers/email-inbound/src/index.ts
// Stub for inbound email processing (Resend email webhook handler).
// Will be wired to parse email replies into CRM activities later.

import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok', service: 'skarion-email-inbound' }));

app.post('/webhook', async (c) => {
  const body = await c.req.json();
  console.log('Inbound email received:', JSON.stringify(body));
  // Stub: log and acknowledge. Full parsing + CRM activity creation in a future ticket.
  return c.json({ received: true });
});

export default app;
