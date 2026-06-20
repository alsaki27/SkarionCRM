// apps/workers/workflow-runner/src/index.ts
// Evaluates CRM workflow rules and executes actions. Triggered by:
// - Cron worker (time-based rules: opportunity_stale, task_due_soon)
// - CRM API webhooks (event-based rules: lead_created)

import { Hono } from 'hono';
import { getDb } from '@skarion/db-kit';
import * as schema from '@skarion/crm/db/schema';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import type { CrmDb } from '@skarion/crm/db/types';

interface Env {
  DATABASE_URL: string;
  CRM_API_URL: string; // e.g. https://skarion-crm.pages.dev or workers.dev
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok', service: 'skarion-workflow-runner' }));

// ── Evaluate time-based rules (called by cron worker) ──
app.post('/evaluate/:trigger', async (c) => {
  const trigger = c.req.param('trigger') as 'opportunity_stale' | 'task_due_soon';
  const db = getDb(c.env, schema) as CrmDb;

  const rules = await db.select().from(schema.workflowRules)
    .where(and(eq(schema.workflowRules.trigger, trigger), eq(schema.workflowRules.enabled, true)));

  const results: { ruleId: string; ruleName: string; executed: number }[] = [];

  for (const rule of rules) {
    let executed = 0;
    if (trigger === 'opportunity_stale') {
      executed = await evaluateOpportunityStale(db, rule);
    } else if (trigger === 'task_due_soon') {
      executed = await evaluateTaskDueSoon(db, rule);
    }
    results.push({ ruleId: rule.id, ruleName: rule.name, executed });
  }

  return c.json({ evaluated: rules.length, results });
});

// ── Evaluate event-based rules (called by CRM API after mutations) ──
app.post('/evaluate-event', async (c) => {
  const body = await c.req.json<{ trigger: string; payload: Record<string, unknown> }>();
  const db = getDb(c.env, schema) as CrmDb;

  const rules = await db.select().from(schema.workflowRules)
    .where(and(
      eq(schema.workflowRules.trigger, body.trigger as 'lead_created'),
      eq(schema.workflowRules.enabled, true)
    ));

  const results: { ruleId: string; ruleName: string; matched: boolean }[] = [];

  for (const rule of rules) {
    let matched = false;
    if (body.trigger === 'lead_created') {
      matched = await evaluateLeadCreated(db, rule, body.payload);
    }
    results.push({ ruleId: rule.id, ruleName: rule.name, matched });
  }

  return c.json({ evaluated: rules.length, results });
});

// ── Rule evaluators ──

async function evaluateOpportunityStale(
  db: CrmDb,
  rule: typeof schema.workflowRules.$inferSelect
): Promise<number> {
  const conditions = rule.conditions as { stage?: string; daysInStage?: number };
  const actions = rule.actions as { createTask?: { title: string; description?: string } };
  const days = conditions.daysInStage ?? 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const staleOpportunities = await db.select().from(schema.opportunities)
    .where(and(
      isNull(schema.opportunities.deletedAt),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(schema.opportunities.stage, conditions.stage as any),
      lte(schema.opportunities.updatedAt, cutoff)
    ));

  let created = 0;
  if (actions.createTask) {
    for (const opp of staleOpportunities) {
      await db.insert(schema.tasks).values({
        title: actions.createTask.title.replace(/\{\{name\}\}/g, opp.name),
        description: (actions.createTask.description ?? `Follow up on ${opp.name}`).replace(/\{\{name\}\}/g, opp.name),
        assigneeId: opp.ownerId,
        opportunityId: opp.id,
        companyId: opp.companyId,
        contactId: opp.contactId,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      created++;
    }
  }
  return created;
}

async function evaluateTaskDueSoon(
  db: CrmDb,
  rule: typeof schema.workflowRules.$inferSelect
): Promise<number> {
  const conditions = rule.conditions as { hoursBeforeDue?: number };
  const _actions = rule.actions as { sendEmail?: boolean };
  const hours = conditions.hoursBeforeDue ?? 24;
  const now = new Date();
  const windowEnd = new Date(Date.now() + hours * 60 * 60 * 1000);

  const dueTasks = await db.select().from(schema.tasks)
    .where(and(
      isNull(schema.tasks.deletedAt),
      isNull(schema.tasks.completedAt),
      gte(schema.tasks.dueDate, now),
      lte(schema.tasks.dueDate, windowEnd)
    ));

  // Email sending is a stub — _actions.sendEmail would trigger email in future
  return dueTasks.length;
}

async function evaluateLeadCreated(
  db: CrmDb,
  rule: typeof schema.workflowRules.$inferSelect,
  payload: Record<string, unknown>
): Promise<boolean> {
  const conditions = rule.conditions as { source?: string };
  const actions = rule.actions as { assignTo?: string };

  const leadSource = payload.source as string | undefined;
  if (conditions.source && leadSource !== conditions.source) return false;

  const leadId = payload.id as string | undefined;
  if (!leadId || !actions.assignTo) return false;

  await db.update(schema.leads).set({ ownerId: actions.assignTo }).where(eq(schema.leads.id, leadId));
  return true;
}

export default app;
