// server/src/services/aiDataTools.ts
// Read-only, parameterized data tools the chat assistant can call via OpenAI
// function-calling. There is no free-form SQL execution here on purpose —
// every tool is a fixed, reviewed query, always filtered by orgId (and by
// employeeId for self-scoped tools), so the model can never see another
// org's or another employee's data no matter what it's asked.
//
// MANAGER_TOOLS are only offered to owner/admin/accountant/bookkeeper.
// SELF_SCOPED_TOOLS are offered to everyone and always resolve to the
// calling user's own employee record.

import { and, eq, lte, gte, count, sum, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  invoices,
  transactions,
  complianceItems,
  employees,
  payrollRuns,
  timesheets,
  leaveBalances,
  leaveTypes,
} from '../db/schema.js';

export async function getInvoiceSummary(orgId: string) {
  const rows = await db
    .select({
      status: invoices.status,
      count: count(),
      total: sum(invoices.totalAmount),
      due: sum(invoices.amountDue),
    })
    .from(invoices)
    .where(eq(invoices.orgId, orgId))
    .groupBy(invoices.status);
  return { byStatus: rows };
}

export async function getOverdueInvoices(orgId: string, limit = 20) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.query.invoices.findMany({
    where: and(
      eq(invoices.orgId, orgId),
      lte(invoices.dueDate, today),
      sql`${invoices.status} not in ('paid', 'cancelled', 'refunded')`
    ),
    with: { contact: { columns: { fullName: true } } },
    limit,
    orderBy: [invoices.dueDate],
  });
  return rows.map((r) => ({
    invoiceNumber: r.invoiceNumber,
    contact: r.contact?.fullName ?? null,
    dueDate: r.dueDate,
    amountDue: r.amountDue,
    status: r.status,
  }));
}

export async function getTransactionSummary(orgId: string, startDate?: string, endDate?: string) {
  const conditions = [eq(transactions.orgId, orgId)];
  if (startDate) conditions.push(gte(transactions.transactionDate, startDate));
  if (endDate) conditions.push(lte(transactions.transactionDate, endDate));

  const rows = await db
    .select({
      type: transactions.transactionType,
      debitCredit: transactions.debitCredit,
      count: count(),
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.transactionType, transactions.debitCredit);
  return { byType: rows, startDate: startDate ?? null, endDate: endDate ?? null };
}

export async function getComplianceStatus(orgId: string) {
  const rows = await db
    .select({ status: complianceItems.status, count: count() })
    .from(complianceItems)
    .where(eq(complianceItems.orgId, orgId))
    .groupBy(complianceItems.status);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = await db.query.complianceItems.findMany({
    where: and(
      eq(complianceItems.orgId, orgId),
      gte(complianceItems.dueDate, today),
      sql`${complianceItems.status} != 'completed'`
    ),
    columns: { title: true, dueDate: true, status: true },
    orderBy: [complianceItems.dueDate],
    limit: 10,
  });
  return { byStatus: rows, upcoming };
}

export async function getEmployeeHeadcount(orgId: string) {
  const rows = await db
    .select({ status: employees.status, employmentType: employees.employmentType, count: count() })
    .from(employees)
    .where(eq(employees.orgId, orgId))
    .groupBy(employees.status, employees.employmentType);
  return { breakdown: rows };
}

export async function getLatestPayrollSummary(orgId: string) {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.orgId, orgId),
    orderBy: [sql`${payrollRuns.payDate} desc`],
  });
  if (!run) return { run: null };
  return {
    run: {
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      payDate: run.payDate,
      status: run.status,
      totalGross: run.totalGross,
      totalNet: run.totalNet,
      totalFica: run.totalFica,
      totalFederalTax: run.totalFederalTax,
      totalStateTax: run.totalStateTax,
    },
  };
}

// ─────────────────────────────────────────────────────────
// Self-scoped tools — always resolve via the caller's own employee record.
// ─────────────────────────────────────────────────────────

async function findOwnEmployeeRecord(orgId: string, userId: string) {
  return db.query.employees.findFirst({
    where: and(eq(employees.orgId, orgId), eq(employees.userId, userId)),
  });
}

export async function getMyPtoBalances(orgId: string, userId: string) {
  const employee = await findOwnEmployeeRecord(orgId, userId);
  if (!employee) return { balances: [], note: 'No employee record linked to this account.' };

  const rows = await db
    .select({
      leaveType: leaveTypes.name,
      remaining: leaveBalances.remaining,
      used: leaveBalances.used,
      accrued: leaveBalances.accrued,
      year: leaveBalances.year,
    })
    .from(leaveBalances)
    .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
    .where(eq(leaveBalances.employeeId, employee.id));
  return { balances: rows };
}

export async function getMyTimesheetSummary(orgId: string, userId: string, weeks = 4) {
  const employee = await findOwnEmployeeRecord(orgId, userId);
  if (!employee) return { timesheets: [], note: 'No employee record linked to this account.' };

  const rows = await db.query.timesheets.findMany({
    where: eq(timesheets.employeeId, employee.id),
    orderBy: [sql`${timesheets.weekStart} desc`],
    limit: weeks,
    columns: {
      weekStart: true,
      weekEnd: true,
      status: true,
      totalHours: true,
      regularHours: true,
      overtimeHours: true,
    },
  });
  return { timesheets: rows };
}

// ─────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────

export const MANAGER_ROLES = ['owner', 'admin', 'accountant', 'bookkeeper'] as const;

export function isManagerRole(role: string): boolean {
  return (MANAGER_ROLES as readonly string[]).includes(role);
}
