import { CronJob } from 'cron';
import { db } from '../db/index.js';
import { tasks, taxForms, complianceItems } from '../db/schema.js';
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

  // Daily at 2 AM: Generate report snapshots
  new CronJob('0 2 * * *', async () => {
    console.log('[CRON] Generating report snapshots...');
    // This would call the report service to generate snapshots
    console.log('[CRON] Report snapshots scheduled');
  }).start();

  console.log('[CRON] All scheduled jobs initialized');
}
