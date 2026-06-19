import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import {
  leaveTypes,
  leaveRequests,
  leaveBalances,
  holidayCalendars,
  employees,
  users,
  attendanceRecords,
  notifications,
  leaveTypeEnum,
  leaveStatusEnum,
} from '../db/schema.js';
import { eq, and, or, gte, lte, desc, count, sql, sum, inArray } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getCurrentEmployeeId = async (ctx: { user: { id: string; email?: string }; orgId: string | null }) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, (ctx.user!).id),
  });
  if (!user?.email) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User email not found' });
  }
  const emp = await db.query.employees.findFirst({
    where: and(eq(employees.email, user.email), eq(employees.orgId, ctx.orgId!)),
  });
  if (!emp) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee profile not found for current user' });
  }
  return emp.id;
};

const isAdminRole = (role: string) => role === 'owner' || role === 'admin';

const notify = async (orgId: string, userId: string, type: string, title: string, body: string) => {
  await db.insert(notifications).values({
    orgId,
    userId,
    type: type as any,
    title,
    body,
    metadata: {},
    createdAt: new Date(),
  });
};

const getDatesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const calculateDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const toDecimal = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const listLeaveTypesSchema = z.object({
  includeInactive: z.boolean().optional(),
});

const createLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(leaveTypeEnum.enumValues),
  isPaid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  maxDaysPerYear: z.string().or(z.number()).optional(),
  accrualRate: z.string().or(z.number()).optional(),
  accrualPeriod: z.string().optional(),
  carryOverLimit: z.string().or(z.number()).optional(),
  useItOrLoseIt: z.boolean().optional(),
});

const updateLeaveTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(leaveTypeEnum.enumValues).optional(),
  isPaid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  maxDaysPerYear: z.string().or(z.number()).optional(),
  accrualRate: z.string().or(z.number()).optional(),
  accrualPeriod: z.string().optional(),
  carryOverLimit: z.string().or(z.number()).optional(),
  useItOrLoseIt: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const listLeaveRequestsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  employeeId: z.string().uuid().optional(),
  status: z.enum(leaveStatusEnum.enumValues).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysRequested: z.string().or(z.number()).optional(),
  isHalfDay: z.boolean().optional(),
  halfDayType: z.enum(['morning', 'afternoon']).optional(),
  reason: z.string().optional(),
});

const approveRejectSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1),
});

const getLeaveBalancesSchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.number().int().optional(),
});

const accrueLeaveSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
});

const listHolidaysSchema = z.object({
  year: z.number().int().optional(),
  country: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createHolidaySchema = z.object({
  name: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  isPaid: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  description: z.string().optional(),
});

const updateHolidaySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  isPaid: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  description: z.string().optional(),
});

const teamCalendarSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export const ptoRouter = router({
  /* ================================================================ */
  /*  1. listLeaveTypes                                               */
  /* ================================================================ */
  listLeaveTypes: protectedProcedure
    .input(listLeaveTypesSchema.optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(leaveTypes.orgId, ctx.orgId!)];
      if (!isAdminRole(ctx.user.role) && !input.includeInactive) {
        conditions.push(eq(leaveTypes.isActive, true));
      }
      const items = await db.query.leaveTypes.findMany({
        where: and(...conditions),
        orderBy: [desc(leaveTypes.createdAt)],
      });
      return { items };
    }),

  /* ================================================================ */
  /*  2. createLeaveType (admin)                                      */
  /* ================================================================ */
  createLeaveType: adminProcedure
    .input(createLeaveTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const [item] = await db.insert(leaveTypes).values({
        orgId: ctx.orgId!,
        name: input.name,
        type: input.type as any,
        isPaid: input.isPaid ?? true,
        requiresApproval: input.requiresApproval ?? true,
        maxDaysPerYear: input.maxDaysPerYear !== undefined ? String(input.maxDaysPerYear) : '10',
        accrualRate: input.accrualRate !== undefined ? String(input.accrualRate) : '0',
        accrualPeriod: input.accrualPeriod ?? 'monthly',
        carryOverLimit: input.carryOverLimit !== undefined ? String(input.carryOverLimit) : '5',
        useItOrLoseIt: input.useItOrLoseIt ?? false,
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_type',
        item.id,
        { name: item.name, type: item.type },
      );

      return item;
    }),

  /* ================================================================ */
  /*  3. updateLeaveType (admin)                                      */
  /* ================================================================ */
  updateLeaveType: adminProcedure
    .input(updateLeaveTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const existing = await db.query.leaveTypes.findFirst({
        where: and(eq(leaveTypes.id, id), eq(leaveTypes.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });

      const numericFields = ['maxDaysPerYear', 'accrualRate', 'carryOverLimit'];
      const setData: Record<string, any> = { ...updates, updatedAt: new Date() };
      for (const field of numericFields) {
        if (field in setData && setData[field] !== undefined && setData[field] !== null) {
          setData[field] = String(setData[field]);
        }
      }

      const [updated] = await db.update(leaveTypes)
        .set(setData)
        .where(and(eq(leaveTypes.id, id), eq(leaveTypes.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_type',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );

      return updated;
    }),

  /* ================================================================ */
  /*  4. deleteLeaveType (admin)                                      */
  /* ================================================================ */
  deleteLeaveType: adminProcedure
    .input(idSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.leaveTypes.findFirst({
        where: and(eq(leaveTypes.id, input.id), eq(leaveTypes.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });

      await db.delete(leaveTypes)
        .where(and(eq(leaveTypes.id, input.id), eq(leaveTypes.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_type',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  /* ================================================================ */
  /*  5. listLeaveRequests                                            */
  /* ================================================================ */
  listLeaveRequests: protectedProcedure
    .input(listLeaveRequestsSchema.optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(leaveRequests.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(leaveRequests.status, input.status as any));
      if (input.dateFrom) conditions.push(gte(leaveRequests.startDate, input.dateFrom));
      if (input.dateTo) conditions.push(lte(leaveRequests.endDate, input.dateTo));

      if (isAdminRole(ctx.user.role)) {
        if (input.employeeId) conditions.push(eq(leaveRequests.employeeId, input.employeeId));
      } else {
        const currentEmpId = await getCurrentEmployeeId(ctx);
        if (input.employeeId && input.employeeId !== currentEmpId) {
          // Non-admins can only query their own, or if they are the manager
          conditions.push(
            or(
              eq(leaveRequests.employeeId, input.employeeId),
              eq(leaveRequests.managerId, (ctx.user!).id)
            )!
          );
        } else {
          conditions.push(
            or(
              eq(leaveRequests.employeeId, currentEmpId),
              eq(leaveRequests.managerId, (ctx.user!).id)
            )!
          );
        }
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.leaveRequests.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(leaveRequests.createdAt)],
          with: {
            employee: { columns: { id: true, firstName: true, lastName: true, email: true, department: true } },
            leaveType: { columns: { id: true, name: true, type: true } },
            manager: { columns: { id: true, fullName: true, email: true } },
            approver: { columns: { id: true, fullName: true, email: true } },
          },
        }),
        db.select({ count: count() }).from(leaveRequests).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  /* ================================================================ */
  /*  6. createLeaveRequest                                           */
  /* ================================================================ */
  createLeaveRequest: protectedProcedure
    .input(createLeaveRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const employeeId = input.employeeId ?? await getCurrentEmployeeId(ctx);
      if (!isAdminRole(ctx.user.role) && input.employeeId) {
        const currentEmpId = await getCurrentEmployeeId(ctx);
        if (input.employeeId !== currentEmpId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only create leave requests for yourself' });
        }
      }
      const emp = await db.query.employees.findFirst({
        where: and(eq(employees.id, employeeId), eq(employees.orgId, ctx.orgId!)),
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      // Validate dates
      if (input.startDate > input.endDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Start date must be before or equal to end date' });
      }

      let daysRequested: number;
      if (input.isHalfDay) {
        if (input.startDate !== input.endDate) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Half-day requests must be for a single day' });
        }
        daysRequested = 0.5;
      } else {
        daysRequested = input.daysRequested !== undefined ? toDecimal(input.daysRequested) : calculateDays(input.startDate, input.endDate);
      }

      if (daysRequested <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Days requested must be greater than 0' });
      }

      const leaveType = await db.query.leaveTypes.findFirst({
        where: and(eq(leaveTypes.id, input.leaveTypeId), eq(leaveTypes.orgId, ctx.orgId!)),
      });
      if (!leaveType) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });

      const year = new Date().getFullYear();
      const balance = await db.query.leaveBalances.findFirst({
        where: and(
          eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.leaveTypeId, input.leaveTypeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.orgId, ctx.orgId!),
        ),
      });

      const remaining = balance ? toDecimal(balance.remaining) : 0;
      if (remaining < daysRequested) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient leave balance' });
      }

      const status = leaveType.requiresApproval ? 'pending' : 'approved';

      const [request] = await db.insert(leaveRequests).values({
        orgId: ctx.orgId!,
        employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        daysRequested: String(daysRequested),
        isHalfDay: input.isHalfDay ?? false,
        halfDayType: input.halfDayType ?? null,
        status: status as any,
        reason: input.reason ?? null,
      }).returning();

      // Update balance
      if (balance) {
        const pending = round2(toDecimal(balance.pending) + daysRequested);
        const used = round2(toDecimal(balance.used));
        const remaining = round2(toDecimal(balance.totalEntitled) + toDecimal(balance.accrued) + toDecimal(balance.carryOver) - used - pending);
        await db.update(leaveBalances)
          .set({ pending: String(pending), remaining: String(remaining), updatedAt: new Date() })
          .where(and(eq(leaveBalances.id, balance.id), eq(leaveBalances.orgId, ctx.orgId!)));
      }

      // If auto-approved, update attendance
      if (status === 'approved') {
        const dates = getDatesInRange(input.startDate, input.endDate);
        for (const dateStr of dates) {
          const existingAtt = await db.query.attendanceRecords.findFirst({
            where: and(
              eq(attendanceRecords.employeeId, employeeId),
              eq(attendanceRecords.date, dateStr),
              eq(attendanceRecords.orgId, ctx.orgId!),
            ),
          });
          if (existingAtt) {
            await db.update(attendanceRecords)
              .set({ status: 'on_leave' as any, updatedAt: new Date() })
              .where(eq(attendanceRecords.id, existingAtt.id));
          } else {
            await db.insert(attendanceRecords).values({
              orgId: ctx.orgId!,
              employeeId,
              date: dateStr,
              status: 'on_leave' as any,
            });
          }
        }
      }

      await auditService.logCreate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_request',
        request.id,
        { employeeId, leaveTypeId: input.leaveTypeId, startDate: input.startDate, endDate: input.endDate, daysRequested: String(daysRequested), status },
      );

      // Notify manager if applicable
      if (leaveType.requiresApproval) {
        if (emp.managerId) {
          const mgr = await db.query.users.findFirst({
            where: and(eq(users.id, emp.managerId), eq(users.orgId, ctx.orgId!)),
          });
          if (mgr) {
            await notify(ctx.orgId!, mgr.id, 'task', 'New leave request', `${emp.firstName} ${emp.lastName} requested ${daysRequested} day(s) of ${leaveType.name}.`);
          }
        }
      }

      return request;
    }),

  /* ================================================================ */
  /*  7. approveLeaveRequest                                          */
  /* ================================================================ */
  approveLeaveRequest: adminProcedure
    .input(approveRejectSchema)
    .mutation(async ({ input, ctx }) => {
      const request = await db.query.leaveRequests.findFirst({
        where: and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)),
        with: {
          employee: { columns: { id: true, firstName: true, lastName: true, email: true } },
          leaveType: { columns: { id: true, name: true } },
        },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be approved' });
      }

      const daysRequested = toDecimal(request.daysRequested);
      const year = request.startDate ? new Date(request.startDate).getFullYear() : new Date().getFullYear();
      const balance = await db.query.leaveBalances.findFirst({
        where: and(
          eq(leaveBalances.employeeId, request.employeeId),
          eq(leaveBalances.leaveTypeId, request.leaveTypeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.orgId, ctx.orgId!),
        ),
      });

      if (balance) {
        const used = round2(toDecimal(balance.used) + daysRequested);
        const pending = round2(toDecimal(balance.pending) - daysRequested);
        const remaining = round2(toDecimal(balance.totalEntitled) + toDecimal(balance.accrued) + toDecimal(balance.carryOver) - used - pending);
        await db.update(leaveBalances)
          .set({ used: String(used), pending: String(Math.max(0, pending)), remaining: String(remaining), updatedAt: new Date() })
          .where(and(eq(leaveBalances.id, balance.id), eq(leaveBalances.orgId, ctx.orgId!)));
      }

      const [updated] = await db.update(leaveRequests)
        .set({
          status: 'approved' as any,
          approvedBy: (ctx.user!).id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)))
        .returning();

      // Update attendance records for the date range
      const dates = getDatesInRange(request.startDate, request.endDate);
      for (const dateStr of dates) {
        const existingAtt = await db.query.attendanceRecords.findFirst({
          where: and(
            eq(attendanceRecords.employeeId, request.employeeId),
            eq(attendanceRecords.date, dateStr),
            eq(attendanceRecords.orgId, ctx.orgId!),
          ),
        });
        if (existingAtt) {
          await db.update(attendanceRecords)
            .set({ status: 'on_leave' as any, updatedAt: new Date() })
            .where(eq(attendanceRecords.id, existingAtt.id));
        } else {
          await db.insert(attendanceRecords).values({
            orgId: ctx.orgId!,
            employeeId: request.employeeId,
            date: dateStr,
            status: 'on_leave' as any,
          });
        }
      }

      await auditService.logUpdate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_request',
        input.id,
        { status: request.status } as Record<string, unknown>,
        { status: 'approved', approvedBy: (ctx.user!).id, notes: input.notes } as Record<string, unknown>,
      );

      // Notify employee
      const employeeUser = await db.query.users.findFirst({
        where: and(eq(users.email, request.employee?.email ?? ''), eq(users.orgId, ctx.orgId!)),
      });
      if (employeeUser) {
        await notify(ctx.orgId!, employeeUser.id, 'success', 'Leave request approved', `Your leave request for ${request.leaveType?.name} from ${request.startDate} to ${request.endDate} has been approved.`);
      }

      return updated;
    }),

  /* ================================================================ */
  /*  8. rejectLeaveRequest                                           */
  /* ================================================================ */
  rejectLeaveRequest: adminProcedure
    .input(rejectSchema)
    .mutation(async ({ input, ctx }) => {
      const request = await db.query.leaveRequests.findFirst({
        where: and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)),
        with: {
          employee: { columns: { id: true, firstName: true, lastName: true, email: true } },
          leaveType: { columns: { id: true, name: true } },
        },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be rejected' });
      }

      const daysRequested = toDecimal(request.daysRequested);
      const year = request.startDate ? new Date(request.startDate).getFullYear() : new Date().getFullYear();
      const balance = await db.query.leaveBalances.findFirst({
        where: and(
          eq(leaveBalances.employeeId, request.employeeId),
          eq(leaveBalances.leaveTypeId, request.leaveTypeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.orgId, ctx.orgId!),
        ),
      });

      if (balance) {
        const pending = round2(toDecimal(balance.pending) - daysRequested);
        const remaining = round2(toDecimal(balance.totalEntitled) + toDecimal(balance.accrued) + toDecimal(balance.carryOver) - toDecimal(balance.used) - Math.max(0, pending));
        await db.update(leaveBalances)
          .set({ pending: String(Math.max(0, pending)), remaining: String(remaining), updatedAt: new Date() })
          .where(eq(leaveBalances.id, balance.id));
      }

      const [updated] = await db.update(leaveRequests)
        .set({
          status: 'rejected' as any,
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_request',
        input.id,
        { status: request.status } as Record<string, unknown>,
        { status: 'rejected', rejectionReason: input.reason } as Record<string, unknown>,
      );

      // Notify employee
      const employeeUser = await db.query.users.findFirst({
        where: and(eq(users.email, request.employee?.email ?? ''), eq(users.orgId, ctx.orgId!)),
      });
      if (employeeUser) {
        await notify(ctx.orgId!, employeeUser.id, 'error', 'Leave request rejected', `Your leave request for ${request.leaveType?.name} from ${request.startDate} to ${request.endDate} was rejected. Reason: ${input.reason}`);
      }

      return updated;
    }),

  /* ================================================================ */
  /*  9. cancelLeaveRequest                                           */
  /* ================================================================ */
  cancelLeaveRequest: protectedProcedure
    .input(idSchema)
    .mutation(async ({ input, ctx }) => {
      const request = await db.query.leaveRequests.findFirst({
        where: and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)),
        with: {
          leaveType: { columns: { id: true, name: true } },
        },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'pending' && request.status !== 'approved') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending or approved requests can be cancelled' });
      }

      const daysRequested = toDecimal(request.daysRequested);
      const year = request.startDate ? new Date(request.startDate).getFullYear() : new Date().getFullYear();
      const balance = await db.query.leaveBalances.findFirst({
        where: and(
          eq(leaveBalances.employeeId, request.employeeId),
          eq(leaveBalances.leaveTypeId, request.leaveTypeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.orgId, ctx.orgId!),
        ),
      });

      if (balance) {
        let used = toDecimal(balance.used);
        let pending = toDecimal(balance.pending);
        if (request.status === 'approved') {
          used = round2(used - daysRequested);
        } else if (request.status === 'pending') {
          pending = round2(pending - daysRequested);
        }
        const remaining = round2(toDecimal(balance.totalEntitled) + toDecimal(balance.accrued) + toDecimal(balance.carryOver) - used - Math.max(0, pending));
        await db.update(leaveBalances)
          .set({ used: String(used), pending: String(Math.max(0, pending)), remaining: String(remaining), updatedAt: new Date() })
          .where(and(eq(leaveBalances.id, balance.id), eq(leaveBalances.orgId, ctx.orgId!)));
      }

      const [updated] = await db.update(leaveRequests)
        .set({ status: 'cancelled' as any, updatedAt: new Date() })
        .where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_request',
        input.id,
        { status: request.status } as Record<string, unknown>,
        { status: 'cancelled' } as Record<string, unknown>,
      );

      return updated;
    }),

  /* ================================================================ */
  /* 10. getLeaveBalances                                             */
  /* ================================================================ */
  getLeaveBalances: protectedProcedure
    .input(getLeaveBalancesSchema.optional().default({}))
    .query(async ({ input, ctx }) => {
      let employeeId: string;
      if (input.employeeId) {
        if (!isAdminRole(ctx.user.role)) {
          const currentEmpId = await getCurrentEmployeeId(ctx);
          if (input.employeeId !== currentEmpId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only view your own leave balances' });
          }
        }
        employeeId = input.employeeId;
      } else {
        employeeId = await getCurrentEmployeeId(ctx);
      }

      const year = input.year ?? new Date().getFullYear();
      const items = await db.query.leaveBalances.findMany({
        where: and(
          eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.orgId, ctx.orgId!),
        ),
        with: {
          leaveType: { columns: { id: true, name: true, type: true, isPaid: true } },
        },
        orderBy: [desc(leaveBalances.createdAt)],
      });

      return {
        items: items.map((b) => ({
          ...b,
          totalEntitled: toDecimal(b.totalEntitled),
          accrued: toDecimal(b.accrued),
          used: toDecimal(b.used),
          pending: toDecimal(b.pending),
          remaining: toDecimal(b.remaining),
          carryOver: toDecimal(b.carryOver),
        })),
      };
    }),

  /* ================================================================ */
  /* 11. accrueLeave (admin or cron)                                  */
  /* ================================================================ */
  accrueLeave: adminProcedure
    .input(accrueLeaveSchema.optional().default({}))
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      const currentYear = now.getFullYear();

      const conditions = [
        eq(leaveBalances.orgId, ctx.orgId!),
        eq(leaveBalances.year, currentYear),
      ];
      if (input.employeeId) conditions.push(eq(leaveBalances.employeeId, input.employeeId));
      if (input.leaveTypeId) conditions.push(eq(leaveBalances.leaveTypeId, input.leaveTypeId));
      const balances = await db.select().from(leaveBalances).where(and(...conditions));
      const updatedIds: string[] = [];

      for (const balance of balances) {
        const leaveType = await db.query.leaveTypes.findFirst({
          where: and(eq(leaveTypes.id, balance.leaveTypeId), eq(leaveTypes.orgId, ctx.orgId!)),
        });
        if (!leaveType || !leaveType.accrualPeriod || !leaveType.accrualRate) continue;

        const accrualRate = toDecimal(leaveType.accrualRate);
        if (accrualRate <= 0) continue;

        const lastAccrued = balance.lastAccruedAt ? new Date(balance.lastAccruedAt) : null;
        let shouldAccrue = false;
        let periods = 1;

        const period = leaveType.accrualPeriod;
        if (period === 'monthly') {
          if (!lastAccrued || lastAccrued.getMonth() !== now.getMonth() || lastAccrued.getFullYear() !== now.getFullYear()) {
            shouldAccrue = true;
          }
        } else if (period === 'biweekly') {
          if (!lastAccrued) {
            shouldAccrue = true;
          } else {
            const daysSince = Math.floor((now.getTime() - lastAccrued.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince >= 14) {
              shouldAccrue = true;
              periods = Math.floor(daysSince / 14);
            }
          }
        } else if (period === 'annual' || period === 'anniversary') {
          const employee = await db.query.employees.findFirst({
            where: and(eq(employees.id, balance.employeeId), eq(employees.orgId, ctx.orgId!)),
          });
          if (employee?.hireDate) {
            const hireDate = new Date(employee.hireDate);
            const anniversaryThisYear = new Date(currentYear, hireDate.getMonth(), hireDate.getDate());
            if (now >= anniversaryThisYear) {
              if (!lastAccrued || lastAccrued.getFullYear() < currentYear) {
                shouldAccrue = true;
              }
            }
          } else if (!lastAccrued || lastAccrued.getFullYear() < currentYear) {
            shouldAccrue = true;
          }
        }

        if (shouldAccrue) {
          const accrued = round2(toDecimal(balance.accrued) + accrualRate * periods);
          const remaining = round2(toDecimal(balance.totalEntitled) + accrued + toDecimal(balance.carryOver) - toDecimal(balance.used) - toDecimal(balance.pending));
          await db.update(leaveBalances)
            .set({
              accrued: String(accrued),
              remaining: String(remaining),
              lastAccruedAt: now,
              updatedAt: now,
            })
            .where(eq(leaveBalances.id, balance.id));
          updatedIds.push(balance.id);
        }
      }

      await auditService.logCreate(
        ctx.orgId!,
        (ctx.user!).id,
        'leave_accrual',
        'batch',
        { updatedCount: updatedIds.length, year: currentYear, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId },
      );

      return { updatedCount: updatedIds.length, updatedIds };
    }),

  /* ================================================================ */
  /* 12. listHolidays                                                 */
  /* ================================================================ */
  listHolidays: protectedProcedure
    .input(listHolidaysSchema.optional().default({}))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(holidayCalendars.orgId, ctx.orgId!)];

      if (input.year) {
        conditions.push(gte(holidayCalendars.date, `${input.year}-01-01`));
        conditions.push(lte(holidayCalendars.date, `${input.year}-12-31`));
      }
      if (input.country) conditions.push(eq(holidayCalendars.country, input.country));
      if (input.dateFrom) conditions.push(gte(holidayCalendars.date, input.dateFrom));
      if (input.dateTo) conditions.push(lte(holidayCalendars.date, input.dateTo));

      const items = await db.query.holidayCalendars.findMany({
        where: and(...conditions),
        orderBy: [desc(holidayCalendars.date)],
      });

      return { items };
    }),

  /* ================================================================ */
  /* 13. createHoliday (admin)                                        */
  /* ================================================================ */
  createHoliday: adminProcedure
    .input(createHolidaySchema)
    .mutation(async ({ input, ctx }) => {
      const [item] = await db.insert(holidayCalendars).values({
        orgId: ctx.orgId!,
        name: input.name,
        date: input.date,
        type: input.type ?? 'public',
        country: input.country ?? null,
        state: input.state ?? null,
        isPaid: input.isPaid ?? true,
        isRecurring: input.isRecurring ?? true,
        description: input.description ?? null,
      }).returning();

      await auditService.logCreate(
        ctx.orgId!,
        (ctx.user!).id,
        'holiday',
        item.id,
        { name: item.name, date: item.date },
      );

      return item;
    }),

  /* ================================================================ */
  /* 14. updateHoliday (admin)                                        */
  /* ================================================================ */
  updateHoliday: adminProcedure
    .input(updateHolidaySchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const existing = await db.query.holidayCalendars.findFirst({
        where: and(eq(holidayCalendars.id, id), eq(holidayCalendars.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Holiday not found' });

      const [updated] = await db.update(holidayCalendars)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(holidayCalendars.id, id), eq(holidayCalendars.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        (ctx.user!).id,
        'holiday',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );

      return updated;
    }),

  /* ================================================================ */
  /* 15. deleteHoliday (admin)                                        */
  /* ================================================================ */
  deleteHoliday: adminProcedure
    .input(idSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.holidayCalendars.findFirst({
        where: and(eq(holidayCalendars.id, input.id), eq(holidayCalendars.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Holiday not found' });

      await db.delete(holidayCalendars)
        .where(and(eq(holidayCalendars.id, input.id), eq(holidayCalendars.orgId, ctx.orgId!)));

      await auditService.logDelete(
        ctx.orgId!,
        (ctx.user!).id,
        'holiday',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  /* ================================================================ */
  /* 16. getTeamCalendar                                              */
  /* ================================================================ */
  getTeamCalendar: protectedProcedure
    .input(teamCalendarSchema)
    .query(async ({ input, ctx }) => {
      if (input.dateFrom > input.dateTo) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'dateFrom must be before or equal to dateTo' });
      }

      const dates = getDatesInRange(input.dateFrom, input.dateTo);
      const allEmployees = await db.query.employees.findMany({
        where: eq(employees.orgId, ctx.orgId!),
        columns: { id: true, firstName: true, lastName: true, department: true },
      });

      const holidays = await db.query.holidayCalendars.findMany({
        where: and(
          eq(holidayCalendars.orgId, ctx.orgId!),
          gte(holidayCalendars.date, input.dateFrom),
          lte(holidayCalendars.date, input.dateTo),
        ),
        columns: { id: true, name: true, date: true, country: true },
      });

      const leaveReqs = await db.query.leaveRequests.findMany({
        where: and(
          eq(leaveRequests.orgId, ctx.orgId!),
          eq(leaveRequests.status, 'approved' as any),
          or(
            and(gte(leaveRequests.startDate, input.dateFrom), lte(leaveRequests.startDate, input.dateTo)),
            and(gte(leaveRequests.endDate, input.dateFrom), lte(leaveRequests.endDate, input.dateTo)),
            and(lte(leaveRequests.startDate, input.dateFrom), gte(leaveRequests.endDate, input.dateTo)),
          )!,
        ),
        with: {
          employee: { columns: { id: true, firstName: true, lastName: true } },
          leaveType: { columns: { id: true, name: true } },
        },
      });

      const attendance = await db.query.attendanceRecords.findMany({
        where: and(
          eq(attendanceRecords.orgId, ctx.orgId!),
          gte(attendanceRecords.date, input.dateFrom),
          lte(attendanceRecords.date, input.dateTo),
        ),
        columns: { id: true, employeeId: true, date: true, status: true },
      });

      // Build maps for quick lookup
      const holidayMap = new Map<string, typeof holidays[0][]>();
      for (const h of holidays) {
        const list = holidayMap.get(h.date) ?? [];
        list.push(h);
        holidayMap.set(h.date, list);
      }

      const leaveMap = new Map<string, typeof leaveReqs>();
      for (const lr of leaveReqs) {
        const lrDates = getDatesInRange(lr.startDate, lr.endDate);
        for (const d of lrDates) {
          if (d < input.dateFrom || d > input.dateTo) continue;
          const list = leaveMap.get(d) ?? [];
          list.push(lr);
          leaveMap.set(d, list);
        }
      }

      const attendanceMap = new Map<string, Map<string, string>>();
      for (const att of attendance) {
        const dateKey = typeof att.date === 'string' ? att.date : new Date(att.date).toISOString().split('T')[0];
        const empMap = attendanceMap.get(dateKey) ?? new Map<string, string>();
        empMap.set(att.employeeId, att.status as string);
        attendanceMap.set(dateKey, empMap);
      }

      const days = dates.map((dateStr) => {
        const onLeave: { id: string; name: string; leaveType: string }[] = [];
        const holidayList: { id: string; name: string }[] = [];
        const present: { id: string; name: string }[] = [];
        const remote: { id: string; name: string }[] = [];
        const absent: { id: string; name: string }[] = [];

        const dayHolidays = holidayMap.get(dateStr) ?? [];
        for (const h of dayHolidays) {
          holidayList.push({ id: h.id, name: h.name });
        }

        const dayLeaves = leaveMap.get(dateStr) ?? [];
        const onLeaveEmpIds = new Set<string>();
        for (const lr of dayLeaves) {
          if (lr.employee) {
            onLeaveEmpIds.add(lr.employee.id);
            onLeave.push({
              id: lr.employee.id,
              name: `${lr.employee.firstName} ${lr.employee.lastName}`,
              leaveType: lr.leaveType?.name ?? 'Leave',
            });
          }
        }

        const attMap = attendanceMap.get(dateStr) ?? new Map<string, string>();
        for (const emp of allEmployees) {
          if (onLeaveEmpIds.has(emp.id)) continue;
          const status = attMap.get(emp.id);
          if (status === 'present') {
            present.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` });
          } else if (status === 'remote') {
            remote.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` });
          } else if (status === 'absent') {
            absent.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` });
          }
        }

        return {
          date: dateStr,
          isHoliday: holidayList.length > 0,
          holidays: holidayList,
          onLeave,
          present,
          remote,
          absent,
        };
      });

      return { days, dateFrom: input.dateFrom, dateTo: input.dateTo };
    }),
});
