import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { employees, contacts, payrollEntries, payrollRuns, w2Forms } from '../db/schema.js';
import { eq, and, or, ilike, desc, count, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { auditService } from '../services/audit.js';

export const employeeRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
      employmentType: z.string().optional(),
      department: z.string().optional(),
      search: z.string().optional(),
    }).optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(employees.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(employees.status, input.status as any));
      if (input.employmentType) conditions.push(eq(employees.employmentType, input.employmentType as any));
      if (input.department) conditions.push(eq(employees.department, input.department));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(employees.firstName, pattern),
            ilike(employees.lastName, pattern),
            ilike(employees.email, pattern),
            ilike(employees.employeeId, pattern),
            ilike(employees.jobTitle, pattern),
            ilike(employees.department, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.employees.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(employees.createdAt)],
          with: {
            contact: { columns: { id: true, fullName: true, email: true, phone: true } },
          },
        }),
        db.select({ count: count() }).from(employees).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const employee = await db.query.employees.findFirst({
        where: and(eq(employees.id, input.id), eq(employees.orgId, ctx.orgId!)),
        with: {
          contact: true,
          payrollEntries: {
            limit: 50,
            orderBy: [desc(payrollEntries.createdAt)],
            with: {
              payrollRun: { columns: { id: true, runName: true, periodStart: true, periodEnd: true, payDate: true, status: true } },
            },
          },
          w2Forms: {
            limit: 20,
            orderBy: [desc(w2Forms.createdAt)],
            with: {
              taxYear: { columns: { id: true, year: true, status: true } },
            },
          },
        },
      });

      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });
      return employee;
    }),

  create: protectedProcedure
    .input(z.object({
      employeeId: z.string().min(1).max(50),
      contactId: z.string().uuid().optional(),
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      jobTitle: z.string().max(255).optional(),
      department: z.string().max(100).optional(),
      employmentType: z.enum(['full_time', 'part_time', 'contractor', 'intern']).default('full_time'),
      payType: z.enum(['salary', 'hourly', 'commission', 'piece_rate']).default('salary'),
      payRate: z.string().or(z.number()).optional(),
      payFrequency: z.enum(['hourly', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annually']).optional(),
      address: z.record(z.any()).optional(),
      bankAccount: z.record(z.any()).optional(),
      withholdingFederal: z.string().or(z.number()).optional(),
      withholdingState: z.string().max(10).optional(),
      withholdingStateAmount: z.string().or(z.number()).optional(),
      withholdingLocal: z.string().or(z.number()).optional(),
      retirement401kRate: z.string().or(z.number()).optional(),
      healthInsurancePremium: z.string().or(z.number()).optional(),
      otherDeductions: z.array(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate employee_id uniqueness per org
      const existing = await db.query.employees.findFirst({
        where: and(eq(employees.orgId, ctx.orgId!), eq(employees.employeeId, input.employeeId)),
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: `Employee ID "${input.employeeId}" already exists in this organization` });
      }

      const [employee] = await db.insert(employees).values({
        orgId: ctx.orgId!,
        contactId: input.contactId || null,
        employeeId: input.employeeId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone || null,
        hireDate: input.hireDate,
        jobTitle: input.jobTitle || null,
        department: input.department || null,
        employmentType: input.employmentType,
        payType: input.payType,
        payRate: input.payRate !== undefined ? String(input.payRate) : null,
        payFrequency: input.payFrequency || null,
        address: input.address || {},
        bankAccount: input.bankAccount || {},
        withholdingFederal: input.withholdingFederal !== undefined ? String(input.withholdingFederal) : '0',
        withholdingState: input.withholdingState || null,
        withholdingStateAmount: input.withholdingStateAmount !== undefined ? String(input.withholdingStateAmount) : '0',
        withholdingLocal: input.withholdingLocal !== undefined ? String(input.withholdingLocal) : '0',
        retirement401kRate: input.retirement401kRate !== undefined ? String(input.retirement401kRate) : '0',
        healthInsurancePremium: input.healthInsurancePremium !== undefined ? String(input.healthInsurancePremium) : '0',
        otherDeductions: input.otherDeductions || [],
        metadata: input.metadata || {},
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'employee',
        employee.id,
        { employeeId: employee.employeeId, firstName: employee.firstName, lastName: employee.lastName },
      );

      return employee;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      employeeId: z.string().min(1).max(50).optional(),
      contactId: z.string().uuid().optional(),
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      jobTitle: z.string().max(255).optional(),
      department: z.string().max(100).optional(),
      status: z.enum(['active', 'terminated', 'on_leave', 'suspended']).optional(),
      employmentType: z.enum(['full_time', 'part_time', 'contractor', 'intern']).optional(),
      payType: z.enum(['salary', 'hourly', 'commission', 'piece_rate']).optional(),
      payRate: z.string().or(z.number()).optional(),
      payFrequency: z.enum(['hourly', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annually']).optional(),
      address: z.record(z.any()).optional(),
      bankAccount: z.record(z.any()).optional(),
      withholdingFederal: z.string().or(z.number()).optional(),
      withholdingState: z.string().max(10).optional(),
      withholdingStateAmount: z.string().or(z.number()).optional(),
      withholdingLocal: z.string().or(z.number()).optional(),
      retirement401kRate: z.string().or(z.number()).optional(),
      healthInsurancePremium: z.string().or(z.number()).optional(),
      otherDeductions: z.array(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rawUpdates } = input;

      const existing = await db.query.employees.findFirst({
        where: and(eq(employees.id, id), eq(employees.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      // If employeeId is changing, validate uniqueness
      if (rawUpdates.employeeId && rawUpdates.employeeId !== existing.employeeId) {
        const duplicate = await db.query.employees.findFirst({
          where: and(eq(employees.orgId, ctx.orgId!), eq(employees.employeeId, rawUpdates.employeeId)),
        });
        if (duplicate) {
          throw new TRPCError({ code: 'CONFLICT', message: `Employee ID "${rawUpdates.employeeId}" already exists in this organization` });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const updates: Record<string, any> = { ...rawUpdates, updatedAt: new Date() };
      const numericFields = ['payRate', 'withholdingFederal', 'withholdingStateAmount', 'withholdingLocal', 'retirement401kRate', 'healthInsurancePremium'];
      for (const field of numericFields) {
        if (field in updates && updates[field] !== undefined && updates[field] !== null) {
          updates[field] = String(updates[field]);
        }
      }

      const [updated] = await db.update(employees)
        .set(updates)
        .where(eq(employees.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'employee',
        id,
        existing as Record<string, unknown>,
        rawUpdates as Record<string, unknown>,
      );

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.employees.findFirst({
        where: and(eq(employees.id, input.id), eq(employees.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      await db.update(employees)
        .set({ status: 'terminated', terminationDate: new Date().toISOString().slice(0, 10), updatedAt: new Date() })
        .where(eq(employees.id, input.id));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'employee',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  bulkImport: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        employeeId: z.string().min(1).max(50),
        contactId: z.string().uuid().optional(),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
        jobTitle: z.string().max(255).optional(),
        department: z.string().max(100).optional(),
        employmentType: z.enum(['full_time', 'part_time', 'contractor', 'intern']).default('full_time'),
        payType: z.enum(['salary', 'hourly', 'commission', 'piece_rate']).default('salary'),
        payRate: z.string().or(z.number()).optional(),
        payFrequency: z.enum(['hourly', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'annually']).optional(),
      })).min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate employee IDs within the import batch
      const idSet = new Set<string>();
      for (const item of input.items) {
        if (idSet.has(item.employeeId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Duplicate employee ID "${item.employeeId}" in import batch` });
        }
        idSet.add(item.employeeId);
      }

      // Check for existing employee IDs in the org
      const existing = await db.query.employees.findMany({
        where: and(eq(employees.orgId, ctx.orgId!), inArray(employees.employeeId, input.items.map(i => i.employeeId))),
      });
      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Employee IDs already exist: ${existing.map(e => e.employeeId).join(', ')}`,
        });
      }

      const values = input.items.map(item => ({
        orgId: ctx.orgId!,
        contactId: item.contactId || null,
        employeeId: item.employeeId,
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email || null,
        phone: item.phone || null,
        hireDate: item.hireDate,
        jobTitle: item.jobTitle || null,
        department: item.department || null,
        employmentType: item.employmentType,
        payType: item.payType,
        payRate: item.payRate !== undefined ? String(item.payRate) : null,
        payFrequency: item.payFrequency || null,
        address: {},
        bankAccount: {},
        withholdingFederal: '0',
        withholdingState: null,
        withholdingStateAmount: '0',
        withholdingLocal: '0',
        retirement401kRate: '0',
        healthInsurancePremium: '0',
        otherDeductions: [],
        metadata: {},
      }));

      const inserted = await db.insert(employees).values(values).returning();

      for (const emp of inserted) {
        await auditService.logCreate(
          ctx.orgId!,
          ctx.user.id,
          'employee',
          emp.id,
          { employeeId: emp.employeeId, firstName: emp.firstName, lastName: emp.lastName },
        );
      }

      return { inserted: inserted.length, items: inserted };
    }),

  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [
        totalResult,
        activeResult,
        terminatedResult,
        onLeaveResult,
        suspendedResult,
        fullTimeResult,
        partTimeResult,
        contractorResult,
        internResult,
      ] = await Promise.all([
        db.select({ count: count() }).from(employees).where(eq(employees.orgId, ctx.orgId!)),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.status, 'active'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.status, 'terminated'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.status, 'on_leave'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.status, 'suspended'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.employmentType, 'full_time'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.employmentType, 'part_time'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.employmentType, 'contractor'))),
        db.select({ count: count() }).from(employees).where(and(eq(employees.orgId, ctx.orgId!), eq(employees.employmentType, 'intern'))),
      ]);

      return {
        total: totalResult[0]?.count ?? 0,
        byStatus: {
          active: activeResult[0]?.count ?? 0,
          terminated: terminatedResult[0]?.count ?? 0,
          onLeave: onLeaveResult[0]?.count ?? 0,
          suspended: suspendedResult[0]?.count ?? 0,
        },
        byType: {
          fullTime: fullTimeResult[0]?.count ?? 0,
          partTime: partTimeResult[0]?.count ?? 0,
          contractor: contractorResult[0]?.count ?? 0,
          intern: internResult[0]?.count ?? 0,
        },
      };
    }),
});
