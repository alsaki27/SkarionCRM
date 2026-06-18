import { CronJob } from 'cron';
import { db } from '../db/index.js';
import { recurringTransactions, transactions } from '../db/schema.js';
import { eq, and, lte, gte, notInArray } from 'drizzle-orm';

export function initializeCronJobs() {
  // Daily at 8 AM: Check for overdue tasks and send reminders
  new CronJob('0 8 * * *', async () => {
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
        .set({ status: 'overdue', reminderCount: task.reminderCount + 1 })
        .where(eq(tasks.id, task.id));
    }
    
    console.log(`[CRON] Marked ${overdueTasks.length} tasks as overdue`);
  }).start();

  // Daily at 9 AM: Check for tax filing deadlines (7, 3, 1 days out)
  new CronJob('0 9 * * *', async () => {
    console.log('[CRON] Checking tax deadlines...');
    const now = new Date();
    const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
    const threeDays = new Date(now); threeDays.setDate(now.getDate() + 3);
    const oneDay = new Date(now); oneDay.setDate(now.getDate() + 1);
    
    const upcomingForms = await db.query.taxForms.findMany({
      where: and(
        eq(taxForms.status, 'draft'),
        lte(taxForms.filingDeadline, sevenDays),
        gte(taxForms.filingDeadline, now)
      ),
    });
    
    console.log(`[CRON] Found ${upcomingForms.length} tax forms with upcoming deadlines`);
  }).start();

  // Daily at 9:30 AM: Check compliance deadlines
  new CronJob('30 9 * * *', async () => {
    console.log('[CRON] Checking compliance deadlines...');
    const now = new Date();
    const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
    
    const upcomingItems = await db.query.complianceItems.findMany({
      where: and(
        notInArray(complianceItems.status, ['compliant', 'overdue']),
        lte(complianceItems.dueDate, sevenDays),
        gte(complianceItems.dueDate, now)
      ),
    });
    
    console.log(`[CRON] Found ${upcomingItems.length} compliance items with upcoming deadlines`);
  }).start();

  // Daily at 3 AM: Auto-run recurring transactions (generate drafts)
  new CronJob('0 3 * * *', async () => {
    console.log('[CRON] Processing recurring transactions...');
    const today = new Date().toISOString().split('T')[0];

    const due = await db.query.recurringTransactions.findMany({
      where: and(
        eq(recurringTransactions.isActive, true),
        lte(recurringTransactions.nextRunDate, today)
      ),
    });

    for (const rec of due) {
      // Create a transaction row
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

      // Update recurring transaction
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
  }).start();

  console.log('[CRON] All scheduled jobs initialized');
}
