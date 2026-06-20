// apps/workers/cron/src/index.ts
// Triggers periodic workflow evaluations via Cloudflare Cron Triggers.
// Bound in wrangler.toml: crons = ["0 * * * *"] (every hour).

export interface Env {
  WORKFLOW_RUNNER_URL: string;
  WORKFLOW_RUNNER_SECRET: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'skarion-cron' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const triggers = ['opportunity_stale', 'task_due_soon'] as const;
    for (const trigger of triggers) {
      try {
        const res = await fetch(`${env.WORKFLOW_RUNNER_URL}/evaluate/${trigger}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.WORKFLOW_RUNNER_SECRET}`,
          },
        });
        if (!res.ok) {
          console.error(`Workflow evaluation failed for ${trigger}: ${res.status}`);
        } else {
          const body = await res.json();
          console.log(`Evaluated ${trigger}:`, JSON.stringify(body));
        }
      } catch (err) {
        console.error(`Error evaluating ${trigger}:`, err);
      }
    }
  },
};
