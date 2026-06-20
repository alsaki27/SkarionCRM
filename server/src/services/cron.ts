import { db } from '../db/index.js';
import {
  complianceItems,
  recurringTransactions,
  tasks,
  taxForms,
  transactions,
} from '../db/schema.js';
import { eq, and, lte, gte, notInArray } from 'drizzle-orm';

export async function checkOverdueTasks() {
  console.log('[CRON] Checking overdue tasks...');
  const now = new Date();

  const overdueTasks = await db.query.tasks.findMany({
    where: and(
      lte(tasks.dueAt, now),
      notInArray(tasks.status, ['done', 'cancelled'])
    ),
  });

  for (const task of overdueTasks) {
    await db.update(tasks)
      .set({ status: 'overdue', reminderCount: (task.reminderCount ?? 0) + 1 })
      .where(eq(tasks.id, task.id));
  }

  console.log(`[CRON] Marked ${overdueTasks.length} tasks as overdue`);
}

export async function checkTaxDeadlines() {
  console.log('[CRON] Checking tax deadlines...');
  const now = new Date();
  const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
  const today = now.toISOString().split('T')[0];
  const sevenDaysOut = sevenDays.toISOString().split('T')[0];

  const upcomingForms = await db.query.taxForms.findMany({
    where: and(
      eq(taxForms.status, 'draft'),
      lte(taxForms.filingDeadline, sevenDaysOut),
      gte(taxForms.filingDeadline, today)
    ),
  });

  console.log(`[CRON] Found ${upcomingForms.length} tax forms with upcoming deadlines`);
}

export async function checkComplianceDeadlines() {
  console.log('[CRON] Checking compliance deadlines...');
  const now = new Date();
  const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
  const today = now.toISOString().split('T')[0];
  const sevenDaysOut = sevenDays.toISOString().split('T')[0];

  const upcomingItems = await db.query.complianceItems.findMany({
    where: and(
      notInArray(complianceItems.status, ['compliant', 'overdue']),
      lte(complianceItems.dueDate, sevenDaysOut),
      gte(complianceItems.dueDate, today)
    ),
  });

  console.log(`[CRON] Found ${upcomingItems.length} compliance items with upcoming deadlines`);
}

export async function processRecurringTransactions() {
  console.log('[CRON] Processing recurring transactions...');
  const today = new Date().toISOString().split('T')[0];

  const due = await db.query.recurringTransactions.findMany({
    where: and(
      eq(recurringTransactions.isActive, true),
      lte(recurringTransactions.nextRunDate, today)
    ),
  });

  for (const rec of due) {
    await db.insert(transactions).values({
      orgId: rec.orgId,
      accountId: rec.accountId,
      contactId: rec.contactId,
      transactionType: rec.transactionType,
      description: rec.name,
      amount: rec.amount,
      debitCredit: rec.debitCredit,
      transactionDate: rec.nextRunDate,
      referenceNumber: `Auto: ${rec.frequency}`,
      memo: rec.description,
      createdBy: 'system',
    });

    const nextDate = new Date(rec.nextRunDate);
    switch (rec.frequency) {
      case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'semiannually': nextDate.setMonth(nextDate.getMonth() + 6); break;
      case 'annually': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
    }
    const nextRunDate = nextDate.toISOString().split('T')[0];
    const totalRuns = (rec.totalRuns ?? 0) + 1;
    const isActive =
      (!rec.endDate || nextRunDate <= rec.endDate) &&
      (!rec.maxRuns || totalRuns < rec.maxRuns);

    await db.update(recurringTransactions)
      .set({
        nextRunDate,
        lastRunDate: rec.nextRunDate,
        totalRuns,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(recurringTransactions.id, rec.id));
  }

  console.log(`[CRON] Processed ${due.length} recurring transactions`);
}

// Backward compatibility for local dev (no-op since cron is handled by Workers scheduled events)
export function initializeCronJobs() {
  console.log('[CRON] Cron jobs are handled by Cloudflare Workers scheduled events.');
  console.log('[CRON] Configure triggers in wrangler.jsonc: "triggers": { "crons": ["0 8 * * *", "0 9 * * *", "30 9 * * *", "0 3 * * *"] }');
}
