import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import {
  transactions, chartOfAccounts, bankAccounts, employees,
  payrollRuns, payrollEntries, w2Forms, complianceItems,
  taxForms, taxYears, contacts, tasks,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, count, sql, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const reportRouter = router({
  getPnl: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }))
    .query(async ({ input, ctx }) => {
      // Revenue accounts: sum of credit amounts
      const revenueResult = await db
        .select({
          total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END`),
        })
        .from(transactions)
        .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
        .where(and(
          eq(transactions.orgId, ctx.orgId!),
          eq(chartOfAccounts.accountType, 'revenue'),
          gte(transactions.transactionDate, input.periodStart),
          lte(transactions.transactionDate, input.periodEnd),
        ));

      // Expense accounts: sum of debit amounts
      const expenseResult = await db
        .select({
          total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'debit' THEN ${transactions.amount} ELSE -${transactions.amount} END`),
        })
        .from(transactions)
        .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
        .where(and(
          eq(transactions.orgId, ctx.orgId!),
          eq(chartOfAccounts.accountType, 'expense'),
          gte(transactions.transactionDate, input.periodStart),
          lte(transactions.transactionDate, input.periodEnd),
        ));

      const revenue = Number(revenueResult[0]?.total ?? 0);
      const expenses = Number(expenseResult[0]?.total ?? 0);
      const netIncome = revenue - expenses;

      return {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        revenue: String(revenue),
        expenses: String(expenses),
        netIncome: String(netIncome),
        grossProfit: String(revenue), // Simplified; no COGS in this schema
        operatingIncome: String(netIncome),
      };
    }),

  getBalanceSheet: protectedProcedure
    .input(z.object({
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const dateCondition = input.asOfDate
        ? lte(transactions.transactionDate, input.asOfDate)
        : sql`TRUE`;

      const [assetResult, liabilityResult, equityResult] = await Promise.all([
        db.select({ total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'debit' THEN ${transactions.amount} ELSE -${transactions.amount} END`) })
          .from(transactions)
          .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
          .where(and(
            eq(transactions.orgId, ctx.orgId!),
            eq(chartOfAccounts.accountType, 'asset'),
            dateCondition,
          )),
        db.select({ total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END`) })
          .from(transactions)
          .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
          .where(and(
            eq(transactions.orgId, ctx.orgId!),
            eq(chartOfAccounts.accountType, 'liability'),
            dateCondition,
          )),
        db.select({ total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END`) })
          .from(transactions)
          .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
          .where(and(
            eq(transactions.orgId, ctx.orgId!),
            eq(chartOfAccounts.accountType, 'equity'),
            dateCondition,
          )),
      ]);

      const assets = Number(assetResult[0]?.total ?? 0);
      const liabilities = Number(liabilityResult[0]?.total ?? 0);
      const equity = Number(equityResult[0]?.total ?? 0);

      return {
        asOfDate: input.asOfDate || new Date().toISOString().slice(0, 10),
        assets: String(assets),
        liabilities: String(liabilities),
        equity: String(equity),
        totalLiabilitiesAndEquity: String(liabilities + equity),
        balanced: Math.abs(assets - (liabilities + equity)) < 0.01,
      };
    }),

  getCashFlow: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }))
    .query(async ({ input, ctx }) => {
      // Find all bank account transactions
      const cashTransactions = await db
        .select({
          id: transactions.id,
          description: transactions.description,
          amount: transactions.amount,
          debitCredit: transactions.debitCredit,
          transactionDate: transactions.transactionDate,
          referenceNumber: transactions.referenceNumber,
          transactionType: transactions.transactionType,
          bankAccountName: bankAccounts.accountName,
        })
        .from(transactions)
        .leftJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
        .where(and(
          eq(transactions.orgId, ctx.orgId!),
          sql`${transactions.bankAccountId} IS NOT NULL`,
          gte(transactions.transactionDate, input.periodStart),
          lte(transactions.transactionDate, input.periodEnd),
        ))
        .orderBy(desc(transactions.transactionDate));

      let inflows = 0;
      let outflows = 0;
      for (const t of cashTransactions) {
        if (t.debitCredit === 'debit') {
          inflows += Number(t.amount);
        } else {
          outflows += Number(t.amount);
        }
      }
      const netCashFlow = inflows - outflows;

      return {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        inflows: String(inflows),
        outflows: String(outflows),
        netCashFlow: String(netCashFlow),
        transactionCount: cashTransactions.length,
        transactions: cashTransactions,
      };
    }),

  getTaxReport: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2000).max(2100),
    }))
    .query(async ({ input, ctx }) => {
      const taxYear = await db.query.taxYears.findFirst({
        where: and(eq(taxYears.orgId, ctx.orgId!), eq(taxYears.year, input.year)),
      });

      const [w2Summary, taxFormsSummary, totalW2s] = await Promise.all([
        db.select({
          totalWages: sum(w2Forms.box1Wages),
          totalFederalTax: sum(w2Forms.box2FederalTax),
          totalSocialTax: sum(w2Forms.box4SocialTax),
          totalMedicareTax: sum(w2Forms.box6MedicareTax),
          employeeCount: count(w2Forms.employeeId),
        })
          .from(w2Forms)
          .where(and(eq(w2Forms.orgId, ctx.orgId!), sql`EXISTS (SELECT 1 FROM ${taxYears} WHERE ${taxYears.id} = ${w2Forms.taxYearId} AND ${taxYears.year} = ${input.year})`)),
        db.select({
          count: count(),
          totalAmount: sum(taxForms.amount),
          filedCount: count(sql`CASE WHEN ${taxForms.status} = 'filed' THEN 1 END`),
        })
          .from(taxForms)
          .where(and(eq(taxForms.orgId, ctx.orgId!), sql`EXISTS (SELECT 1 FROM ${taxYears} WHERE ${taxYears.id} = ${taxForms.taxYearId} AND ${taxYears.year} = ${input.year})`)),
        db.select({ count: count() }).from(w2Forms).where(and(eq(w2Forms.orgId, ctx.orgId!), sql`EXISTS (SELECT 1 FROM ${taxYears} WHERE ${taxYears.id} = ${w2Forms.taxYearId} AND ${taxYears.year} = ${input.year})`)),
      ]);

      return {
        year: input.year,
        taxYearId: taxYear?.id || null,
        taxYearStatus: taxYear?.status || null,
        w2Summary: {
          totalWages: w2Summary[0]?.totalWages ?? '0',
          totalFederalTax: w2Summary[0]?.totalFederalTax ?? '0',
          totalSocialTax: w2Summary[0]?.totalSocialTax ?? '0',
          totalMedicareTax: w2Summary[0]?.totalMedicareTax ?? '0',
          employeeCount: w2Summary[0]?.employeeCount ?? 0,
        },
        taxForms: {
          total: taxFormsSummary[0]?.count ?? 0,
          filed: taxFormsSummary[0]?.filedCount ?? 0,
          totalAmount: taxFormsSummary[0]?.totalAmount ?? '0',
        },
        totalW2s: totalW2s[0]?.count ?? 0,
      };
    }),

  getComplianceReport: protectedProcedure
    .query(async ({ ctx }) => {
      const [
        totalItems,
        compliantItems,
        nonCompliantItems,
        atRiskItems,
        overdueItems,
        inProgressItems,
        notStartedItems,
      ] = await Promise.all([
        db.select({ count: count() }).from(complianceItems).where(eq(complianceItems.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'compliant'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'non_compliant'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'at_risk'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'overdue'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'in_progress'))),
        db.select({ count: count() }).from(complianceItems).where(and(eq(complianceItems.orgId, ctx.orgId!), eq(complianceItems.status, 'not_started'))),
      ]);

      return {
        total: totalItems[0]?.count ?? 0,
        byStatus: {
          compliant: compliantItems[0]?.count ?? 0,
          nonCompliant: nonCompliantItems[0]?.count ?? 0,
          atRisk: atRiskItems[0]?.count ?? 0,
          overdue: overdueItems[0]?.count ?? 0,
          inProgress: inProgressItems[0]?.count ?? 0,
          notStarted: notStartedItems[0]?.count ?? 0,
        },
        complianceRate: totalItems[0]?.count
          ? Math.round(((compliantItems[0]?.count ?? 0) / totalItems[0].count) * 100)
          : 0,
      };
    }),

  getPayrollReport: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(payrollRuns.orgId, ctx.orgId!), eq(payrollRuns.status, 'completed')];
      if (input.periodStart) conditions.push(gte(payrollRuns.periodStart, input.periodStart));
      if (input.periodEnd) conditions.push(lte(payrollRuns.periodEnd, input.periodEnd));
      const whereClause = and(...conditions);

      const [runs, totals] = await Promise.all([
        db.query.payrollRuns.findMany({
          where: whereClause,
          orderBy: [desc(payrollRuns.payDate)],
          limit: 50,
        }),
        db.select({
          totalGross: sum(payrollRuns.totalGross),
          totalNet: sum(payrollRuns.totalNet),
          totalFica: sum(payrollRuns.totalFica),
          totalFederalTax: sum(payrollRuns.totalFederalTax),
          totalStateTax: sum(payrollRuns.totalStateTax),
          totalDeductions: sum(payrollRuns.totalDeductions),
          runCount: count(),
        }).from(payrollRuns).where(whereClause),
      ]);

      return {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        runs,
        summary: {
          totalGross: totals[0]?.totalGross ?? '0',
          totalNet: totals[0]?.totalNet ?? '0',
          totalFica: totals[0]?.totalFica ?? '0',
          totalFederalTax: totals[0]?.totalFederalTax ?? '0',
          totalStateTax: totals[0]?.totalStateTax ?? '0',
          totalDeductions: totals[0]?.totalDeductions ?? '0',
          runCount: totals[0]?.runCount ?? 0,
        },
      };
    }),

  getDashboardSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [
        totalContacts,
        totalEmployees,
        activeEmployees,
        totalBankAccounts,
        totalTransactions,
        monthRevenue,
        monthExpenses,
        totalPayrollRuns,
        pendingCompliance,
        openTasks,
      ] = await Promise.all([
        db.select({ count: count() }).from(contacts).where(and(eq(contacts.orgId, ctx.orgId!), sql`${contacts.deletedAt} IS NULL`)),
        db.select({ count: count() }).from(employees).where(eq(employees.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.status, 'active'))),
        db.select({ count: count() }).from(bankAccounts).where(and(eq(bankAccounts.orgId, ctx.orgId!), eq(bankAccounts.isActive, true))),
        db.select({ count: count() }).from(transactions).where(eq(transactions.orgId, ctx.orgId!)),
        db.select({ total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END`) })
          .from(transactions)
          .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
          .where(and(eq(transactions.orgId, ctx.orgId!), eq(chartOfAccounts.accountType, 'revenue'), gte(transactions.transactionDate, monthStartStr))),
        db.select({ total: sum(sql`CASE WHEN ${transactions.debitCredit} = 'debit' THEN ${transactions.amount} ELSE -${transactions.amount} END`) })
          .from(transactions)
          .innerJoin(chartOfAccounts, eq(transactions.accountId, chartOfAccounts.id))
          .where(and(eq(transactions.orgId, ctx.orgId!), eq(chartOfAccounts.accountType, 'expense'), gte(transactions.transactionDate, monthStartStr))),
        db.select({ count: count() }).from(payrollRuns).where(and(eq(payrollRuns.orgId, ctx.orgId!), eq(payrollRuns.status, 'completed'))),
        db.select({ count: count() }).from(complianceItems).where(
          and(
            eq(complianceItems.orgId, ctx.orgId!),
            sql`${complianceItems.status} IN ('not_started', 'in_progress', 'at_risk', 'overdue')`
          )
        ),
        db.select({ count: count() }).from(tasks).where(and(eq(tasks.orgId, ctx.orgId!), sql`${tasks.status} IN ('todo', 'in_progress')`)),
      ]);

      const revenue = Number(monthRevenue[0]?.total ?? 0);
      const expenses = Number(monthExpenses[0]?.total ?? 0);

      return {
        asOfDate: now,
        crm: {
          totalContacts: totalContacts[0]?.count ?? 0,
        },
        employees: {
          total: totalEmployees[0]?.count ?? 0,
          active: activeEmployees[0]?.count ?? 0,
        },
        financial: {
          totalBankAccounts: totalBankAccounts[0]?.count ?? 0,
          totalTransactions: totalTransactions[0]?.count ?? 0,
          monthRevenue: String(revenue),
          monthExpenses: String(expenses),
          monthNetIncome: String(revenue - expenses),
        },
        payroll: {
          totalCompletedRuns: totalPayrollRuns[0]?.count ?? 0,
        },
        compliance: {
          pendingItems: pendingCompliance[0]?.count ?? 0,
        },
        tasks: {
          openTasks: openTasks[0]?.count ?? 0,
        },
      };
    }),
});
