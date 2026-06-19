import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, gte, lte, desc, count, sql, sum, isNull, asc, ne } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import {
  timeEntries,
  attendanceRecords,
  timesheets,
  timesheetEntries,
  workSchedules,
  shiftAssignments,
  shiftSwaps,
  employees,
  users,
  projects,
  projectTasks,
  notifications,
} from '../db/schema.js';
import { auditService } from '../services/audit.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getEmployeeIdFromCtx = async (ctx: { user: { id: string }; orgId: string | null }, employeeId?: string) => {
  if (employeeId) return employeeId;

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.userId, ctx.user.id), eq(employees.orgId, ctx.orgId!)))
    .limit(1);

  if (!emp) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee profile not found for current user.' });
  }
  return emp.id;
};

const isAdmin = (ctx: { user: { role?: string } }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  }
};

const toISO = (d: Date) => d.toISOString();

const startOfDay = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return toISO(d);
};

const endOfDay = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return toISO(d);
};

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const optionalString = z.string().optional().nullable();

const clockInSchema = z.object({
  employeeId: z.string().optional(),
  source: z.string().optional(),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  geoLocation: z.string().optional().nullable(),
});

const clockOutSchema = z.object({
  employeeId: z.string().optional(),
  notes: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
});

const breakSchema = z.object({
  employeeId: z.string().optional(),
  breakType: z.enum(['lunch', 'break']),
});

const listTimeEntriesSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  employeeId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  entryType: z.enum(['clock_in', 'clock_out', 'lunch_start', 'lunch_end', 'break_start', 'break_end', 'project_switch']).optional(),
  projectId: z.string().optional(),
});

const dailyAttendanceSchema = z.object({
  date: z.string(),
  employeeId: z.string().optional(),
});

const listTimesheetsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  employeeId: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  weekStart: z.string().optional(),
  weekEnd: z.string().optional(),
});

const idSchema = z.object({ id: z.string() });
const idWithNotesSchema = z.object({ id: z.string(), notes: z.string().optional() });
const rejectSchema = z.object({ id: z.string(), reason: z.string() });

const createTimesheetSchema = z.object({
  employeeId: z.string(),
  weekStart: z.string(),
});

const workScheduleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  mondayStart: z.string().optional().nullable(),
  mondayEnd: z.string().optional().nullable(),
  tuesdayStart: z.string().optional().nullable(),
  tuesdayEnd: z.string().optional().nullable(),
  wednesdayStart: z.string().optional().nullable(),
  wednesdayEnd: z.string().optional().nullable(),
  thursdayStart: z.string().optional().nullable(),
  thursdayEnd: z.string().optional().nullable(),
  fridayStart: z.string().optional().nullable(),
  fridayEnd: z.string().optional().nullable(),
  saturdayStart: z.string().optional().nullable(),
  saturdayEnd: z.string().optional().nullable(),
  sundayStart: z.string().optional().nullable(),
  sundayEnd: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
});

const assignShiftSchema = z.object({
  employeeId: z.string(),
  scheduleId: z.string(),
  effectiveDate: z.string(),
  endDate: z.string().optional().nullable(),
});

const shiftSwapSchema = z.object({
  requesterId: z.string(),
  recipientId: z.string(),
  requesterScheduleId: z.string(),
  recipientScheduleId: z.string(),
  swapDate: z.string(),
  reason: z.string().optional().nullable(),
});

const shiftSwapActionSchema = z.object({ id: z.string() });

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export const timekeepingRouter = router({
  /* ================================================================ */
  /*  1. clockIn                                                       */
  /* ================================================================ */
  clockIn: protectedProcedure
    .input(clockInSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);

      const latestEntries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.employeeId, employeeId),
            eq(timeEntries.orgId, ctx.orgId!)
          )
        )
        .orderBy(desc(timeEntries.timestamp))
        .limit(1);

      const latest = latestEntries[0];
      if (latest && latest.entryType === 'clock_in') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already clocked in. Please clock out first.' });
      }

      const [entry] = await db
        .insert(timeEntries)
        .values({
          orgId: ctx.orgId!,
          employeeId,
          entryType: 'clock_in',
          timestamp: toISO(new Date()),
          source: input.source ?? 'web',
          projectId: input.projectId,
          taskId: input.taskId,
          notes: input.notes,
          ipAddress: input.ipAddress,
          geoLocation: input.geoLocation,
        })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'time_entries',
        recordId: entry.id,
        data: entry,
      });

      return entry;
    }),

  /* ================================================================ */
  /*  2. clockOut                                                      */
  /* ================================================================ */
  clockOut: protectedProcedure
    .input(clockOutSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);

      const [latestIn] = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.employeeId, employeeId),
            eq(timeEntries.orgId, ctx.orgId!),
            eq(timeEntries.entryType, 'clock_in')
          )
        )
        .orderBy(desc(timeEntries.timestamp))
        .limit(1);

      if (!latestIn) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No active clock-in found. Please clock in first.' });
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(latestIn.timestamp);
      const durationMs = clockOutTime.getTime() - clockInTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      const totalHours = Number((durationMs / 3600000).toFixed(2));

      const [clockOutEntry] = await db
        .insert(timeEntries)
        .values({
          orgId: ctx.orgId!,
          employeeId,
          entryType: 'clock_out',
          timestamp: toISO(clockOutTime),
          source: 'web',
          projectId: input.projectId ?? latestIn.projectId,
          taskId: input.taskId ?? latestIn.taskId,
          notes: input.notes,
        })
        .returning();

      const dateStr = clockInTime.toISOString().split('T')[0];
      const start = startOfDay(dateStr);
      const end = endOfDay(dateStr);

      const [existingAtt] = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, employeeId),
            eq(attendanceRecords.orgId, ctx.orgId!),
            gte(attendanceRecords.date, start),
            lte(attendanceRecords.date, end)
          )
        )
        .limit(1);

      const lateMinutes = Math.max(0, Math.floor((clockInTime.getTime() - new Date(`${dateStr}T09:00:00`).getTime()) / 60000));
      const status = lateMinutes > 0 ? 'late' : 'present';

      if (existingAtt) {
        await db
          .update(attendanceRecords)
          .set({
            clockOut: toISO(clockOutTime),
            totalHours: sql`${totalHours}`,
            status,
            lateMinutes: lateMinutes > 0 ? lateMinutes : existingAtt.lateMinutes ?? 0,
          })
          .where(and(eq(attendanceRecords.id, existingAtt.id), eq(attendanceRecords.orgId, ctx.orgId!)));
      } else {
        await db.insert(attendanceRecords).values({
          orgId: ctx.orgId!,
          employeeId,
          date: start,
          clockIn: toISO(clockInTime),
          clockOut: toISO(clockOutTime),
          totalHours,
          status,
          lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        });
      }

      await auditService.logCreate({
        ctx,
        tableName: 'time_entries',
        recordId: clockOutEntry.id,
        data: clockOutEntry,
      });

      return {
        clockIn: latestIn,
        clockOut: clockOutEntry,
        durationMinutes: durationMinutes,
        totalHours,
      };
    }),

  /* ================================================================ */
  /*  3. startBreak / endBreak                                         */
  /* ================================================================ */
  startBreak: protectedProcedure
    .input(breakSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);
      const entryType = input.breakType === 'lunch' ? 'lunch_start' : 'break_start';

      const [entry] = await db
        .insert(timeEntries)
        .values({
          orgId: ctx.orgId!,
          employeeId,
          entryType,
          timestamp: toISO(new Date()),
          source: 'web',
        })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'time_entries',
        recordId: entry.id,
        data: entry,
      });

      return entry;
    }),

  endBreak: protectedProcedure
    .input(breakSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);
      const entryType = input.breakType === 'lunch' ? 'lunch_end' : 'break_end';

      const [entry] = await db
        .insert(timeEntries)
        .values({
          orgId: ctx.orgId!,
          employeeId,
          entryType,
          timestamp: toISO(new Date()),
          source: 'web',
        })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'time_entries',
        recordId: entry.id,
        data: entry,
      });

      return entry;
    }),

  /* ================================================================ */
  /*  4. listTimeEntries                                               */
  /* ================================================================ */
  listTimeEntries: protectedProcedure
    .input(listTimeEntriesSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(timeEntries.orgId, ctx.orgId!)];
      if (input.employeeId) conditions.push(eq(timeEntries.employeeId, input.employeeId));
      if (input.entryType) conditions.push(eq(timeEntries.entryType, input.entryType));
      if (input.projectId) conditions.push(eq(timeEntries.projectId, input.projectId));
      if (input.dateFrom) conditions.push(gte(timeEntries.timestamp, startOfDay(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(timeEntries.timestamp, endOfDay(input.dateTo)));

      const rows = await db
        .select({
          entry: timeEntries,
          employeeName: employees.name,
          projectName: projects.name,
          taskName: projectTasks.name,
        })
        .from(timeEntries)
        .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
        .leftJoin(projects, eq(timeEntries.projectId, projects.id))
        .leftJoin(projectTasks, eq(timeEntries.taskId, projectTasks.id))
        .where(and(...conditions))
        .orderBy(desc(timeEntries.timestamp))
        .limit(input.limit)
        .offset(input.offset);

      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(timeEntries)
        .where(and(...conditions));

      return {
        items: rows.map(r => ({
          ...r.entry,
          employeeName: r.employeeName,
          projectName: r.projectName,
          taskName: r.taskName,
        })),
        total: totalCount ?? 0,
      };
    }),

  /* ================================================================ */
  /*  5. getDailyAttendance                                            */
  /* ================================================================ */
  getDailyAttendance: protectedProcedure
    .input(dailyAttendanceSchema)
    .query(async ({ ctx, input }) => {
      const start = startOfDay(input.date);
      const end = endOfDay(input.date);

      const attConditions = [
        eq(attendanceRecords.orgId, ctx.orgId!),
        gte(attendanceRecords.date, start),
        lte(attendanceRecords.date, end),
      ];
      if (input.employeeId) attConditions.push(eq(attendanceRecords.employeeId, input.employeeId));

      const records = await db
        .select({
          record: attendanceRecords,
          employeeName: employees.name,
        })
        .from(attendanceRecords)
        .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
        .where(and(...attConditions))
        .orderBy(asc(attendanceRecords.date));

      if (records.length > 0) {
        return records.map(r => ({
          ...r.record,
          employeeName: r.employeeName,
        }));
      }

      // Generate on the fly from time_entries
      const teConditions = [
        eq(timeEntries.orgId, ctx.orgId!),
        gte(timeEntries.timestamp, start),
        lte(timeEntries.timestamp, end),
      ];
      if (input.employeeId) teConditions.push(eq(timeEntries.employeeId, input.employeeId));

      const entries = await db
        .select()
        .from(timeEntries)
        .where(and(...teConditions))
        .orderBy(asc(timeEntries.timestamp));

      const byEmployee: Record<string, typeof entries> = {};
      for (const e of entries) {
        if (!byEmployee[e.employeeId]) byEmployee[e.employeeId] = [];
        byEmployee[e.employeeId].push(e);
      }

      const result = [];
      for (const [empId, empEntries] of Object.entries(byEmployee)) {
        const clockIn = empEntries.find(e => e.entryType === 'clock_in')?.timestamp ?? null;
        const clockOut = empEntries.find(e => e.entryType === 'clock_out')?.timestamp ?? null;
        let totalHours = 0;
        if (clockIn && clockOut) {
          totalHours = Number(((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000).toFixed(2));
        }
        const lateMinutes = clockIn
          ? Math.max(0, Math.floor((new Date(clockIn).getTime() - new Date(`${input.date}T09:00:00`).getTime()) / 60000))
          : 0;
        const status = clockIn ? (lateMinutes > 0 ? 'late' : 'present') : 'absent';

        const [emp] = await db
          .select({ name: employees.name })
          .from(employees)
          .where(and(eq(employees.id, empId), eq(employees.orgId, ctx.orgId!)))
          .limit(1);

        result.push({
          id: `generated-${empId}-${input.date}`,
          employeeId: empId,
          employeeName: emp?.name ?? 'Unknown',
          date: start,
          clockIn,
          clockOut,
          totalHours,
          status,
          lateMinutes,
          notes: null,
          createdAt: null,
          updatedAt: null,
        });
      }

      return result;
    }),

  /* ================================================================ */
  /*  6. listTimesheets                                                */
  /* ================================================================ */
  listTimesheets: protectedProcedure
    .input(listTimesheetsSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(timesheets.orgId, ctx.orgId!)];
      if (input.employeeId) conditions.push(eq(timesheets.employeeId, input.employeeId));
      if (input.status) conditions.push(eq(timesheets.status, input.status));
      if (input.weekStart) conditions.push(gte(timesheets.weekStart, input.weekStart));
      if (input.weekEnd) conditions.push(lte(timesheets.weekEnd, input.weekEnd));

      const rows = await db
        .select({
          sheet: timesheets,
          employeeName: employees.name,
          approverName: users.name,
        })
        .from(timesheets)
        .leftJoin(employees, eq(timesheets.employeeId, employees.id))
        .leftJoin(users, eq(timesheets.approvedBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(timesheets.weekStart))
        .limit(input.limit)
        .offset(input.offset);

      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(timesheets)
        .where(and(...conditions));

      return {
        items: rows.map(r => ({
          ...r.sheet,
          employeeName: r.employeeName,
          approverName: r.approverName,
        })),
        total: totalCount ?? 0,
      };
    }),

  /* ================================================================ */
  /*  7. submitTimesheet                                               */
  /* ================================================================ */
  submitTimesheet: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      const [sheet] = await db
        .select()
        .from(timesheets)
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .limit(1);

      if (!sheet) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
      }
      if (sheet.status !== 'draft' && sheet.status !== 'rejected') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Timesheet can only be submitted from draft or rejected status.' });
      }

      const [updated] = await db
        .update(timesheets)
        .set({ status: 'submitted', submittedAt: toISO(new Date()) })
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'timesheets',
        recordId: input.id,
        oldData: sheet,
        newData: updated,
      });

      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, sheet.employeeId), eq(employees.orgId, ctx.orgId!)))
        .limit(1);

      const managerId = (employee as any)?.managerId ?? (employee as any)?.supervisorId ?? null;
      if (managerId) {
        await db.insert(notifications).values({
          orgId: ctx.orgId!,
          userId: managerId,
          title: 'Timesheet Submitted',
          body: `A timesheet for week starting ${sheet.weekStart} has been submitted for approval.`,
          link: `/timekeeping/timesheets/${input.id}`,
        });
      }

      return updated;
    }),

  /* ================================================================ */
  /*  8. approveTimesheet                                              */
  /* ================================================================ */
  approveTimesheet: protectedProcedure
    .input(idWithNotesSchema)
    .mutation(async ({ ctx, input }) => {
      const [sheet] = await db
        .select()
        .from(timesheets)
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .limit(1);

      if (!sheet) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
      }
      if (sheet.status !== 'submitted') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only submitted timesheets can be approved.' });
      }

      const [updated] = await db
        .update(timesheets)
        .set({
          status: 'approved',
          approvedBy: ctx.user.id,
          approvedAt: toISO(new Date()),
          notes: input.notes ?? sheet.notes,
        })
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'timesheets',
        recordId: input.id,
        oldData: sheet,
        newData: updated,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: sheet.employeeId,
        title: 'Timesheet Approved',
        body: `Your timesheet for week starting ${sheet.weekStart} has been approved.`,
        link: `/timekeeping/timesheets/${input.id}`,
      });

      return updated;
    }),

  /* ================================================================ */
  /*  9. rejectTimesheet                                               */
  /* ================================================================ */
  rejectTimesheet: protectedProcedure
    .input(rejectSchema)
    .mutation(async ({ ctx, input }) => {
      const [sheet] = await db
        .select()
        .from(timesheets)
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .limit(1);

      if (!sheet) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
      }
      if (sheet.status !== 'submitted') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only submitted timesheets can be rejected.' });
      }

      const [updated] = await db
        .update(timesheets)
        .set({
          status: 'rejected',
          rejectionReason: input.reason,
          approvedBy: ctx.user.id,
          approvedAt: toISO(new Date()),
        })
        .where(and(eq(timesheets.id, input.id), eq(timesheets.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'timesheets',
        recordId: input.id,
        oldData: sheet,
        newData: updated,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: sheet.employeeId,
        title: 'Timesheet Rejected',
        body: `Your timesheet for week starting ${sheet.weekStart} has been rejected. Reason: ${input.reason}`,
        link: `/timekeeping/timesheets/${input.id}`,
      });

      return updated;
    }),

  /* ================================================================ */
  /*  10. createTimesheet (auto-generate from attendance)              */
  /* ================================================================ */
  createTimesheet: protectedProcedure
    .input(createTimesheetSchema)
    .mutation(async ({ ctx, input }) => {
      const weekStart = startOfDay(input.weekStart);
      const weekEnd = endOfDay(addDays(input.weekStart, 6));

      const [existing] = await db
        .select()
        .from(timesheets)
        .where(
          and(
            eq(timesheets.employeeId, input.employeeId),
            eq(timesheets.orgId, ctx.orgId!),
            eq(timesheets.weekStart, weekStart)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Timesheet already exists for this week.' });
      }

      const attendance = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, input.employeeId),
            eq(attendanceRecords.orgId, ctx.orgId!),
            gte(attendanceRecords.date, weekStart),
            lte(attendanceRecords.date, weekEnd)
          )
        )
        .orderBy(asc(attendanceRecords.date));

      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let breakHours = 0;
      let billableHours = 0;

      for (const att of attendance) {
        totalHours += Number(att.totalHours ?? 0);
        regularHours += Math.min(Number(att.totalHours ?? 0), 8);
        overtimeHours += Math.max(0, Number(att.totalHours ?? 0) - 8);
      }

      billableHours = totalHours; // default to total; adjust per business rules
      breakHours = 0; // derive from break entries if needed

      const [sheet] = await db
        .insert(timesheets)
        .values({
          orgId: ctx.orgId!,
          employeeId: input.employeeId,
          weekStart,
          weekEnd: addDays(input.weekStart, 6),
          status: 'draft',
          totalHours,
          regularHours,
          overtimeHours,
          breakHours,
          billableHours,
        })
        .returning();

      for (const att of attendance) {
        await db.insert(timesheetEntries).values({
          orgId: ctx.orgId!,
          timesheetId: sheet.id,
          date: att.date,
          clockIn: att.clockIn,
          clockOut: att.clockOut,
          totalHours: att.totalHours,
          regularHours: Math.min(Number(att.totalHours ?? 0), 8),
          overtimeHours: Math.max(0, Number(att.totalHours ?? 0) - 8),
          breakHours: 0,
          billableHours: att.totalHours,
          notes: att.notes,
        });
      }

      await auditService.logCreate({
        ctx,
        tableName: 'timesheets',
        recordId: sheet.id,
        data: sheet,
      });

      return sheet;
    }),

  /* ================================================================ */
  /*  11. listWorkSchedules                                            */
  /* ================================================================ */
  listWorkSchedules: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const rows = await db
        .select()
        .from(workSchedules)
        .where(eq(workSchedules.orgId, ctx.orgId!))
        .orderBy(asc(workSchedules.name))
        .limit(limit)
        .offset(offset);

      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(workSchedules)
        .where(eq(workSchedules.orgId, ctx.orgId!));

      return {
        items: rows,
        total: totalCount ?? 0,
      };
    }),

  /* ================================================================ */
  /*  12. create / update / delete WorkSchedule                        */
  /* ================================================================ */
  createWorkSchedule: protectedProcedure
    .input(workScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      isAdmin(ctx);
      const [schedule] = await db
        .insert(workSchedules)
        .values({ ...input, orgId: ctx.orgId! })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'work_schedules',
        recordId: schedule.id,
        data: schedule,
      });

      return schedule;
    }),

  updateWorkSchedule: protectedProcedure
    .input(z.object({ id: z.string() }).merge(workScheduleSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      isAdmin(ctx);
      const { id, ...data } = input;

      const [existing] = await db
        .select()
        .from(workSchedules)
        .where(and(eq(workSchedules.id, id), eq(workSchedules.orgId, ctx.orgId!)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found.' });

      const [updated] = await db
        .update(workSchedules)
        .set(data)
        .where(and(eq(workSchedules.id, id), eq(workSchedules.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'work_schedules',
        recordId: id,
        oldData: existing,
        newData: updated,
      });

      return updated;
    }),

  deleteWorkSchedule: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      isAdmin(ctx);
      const [existing] = await db
        .select()
        .from(workSchedules)
        .where(and(eq(workSchedules.id, input.id), eq(workSchedules.orgId, ctx.orgId!)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found.' });

      await db
        .delete(workSchedules)
        .where(and(eq(workSchedules.id, input.id), eq(workSchedules.orgId, ctx.orgId!)));

      await auditService.logDelete({
        ctx,
        tableName: 'work_schedules',
        recordId: input.id,
        oldData: existing,
      });

      return { success: true };
    }),

  /* ================================================================ */
  /*  13. listShiftAssignments                                         */
  /* ================================================================ */
  listShiftAssignments: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await db
        .select({
          assignment: shiftAssignments,
          employeeName: employees.name,
          scheduleName: workSchedules.name,
        })
        .from(shiftAssignments)
        .leftJoin(employees, eq(shiftAssignments.employeeId, employees.id))
        .leftJoin(workSchedules, eq(shiftAssignments.scheduleId, workSchedules.id))
        .where(eq(shiftAssignments.orgId, ctx.orgId!))
        .orderBy(desc(shiftAssignments.effectiveDate));

      return rows.map(r => ({
        ...r.assignment,
        employeeName: r.employeeName,
        scheduleName: r.scheduleName,
      }));
    }),

  /* ================================================================ */
  /*  14. assignShift                                                  */
  /* ================================================================ */
  assignShift: protectedProcedure
    .input(assignShiftSchema)
    .mutation(async ({ ctx, input }) => {
      const [assignment] = await db
        .insert(shiftAssignments)
        .values({
          orgId: ctx.orgId!,
          employeeId: input.employeeId,
          scheduleId: input.scheduleId,
          effectiveDate: input.effectiveDate,
          endDate: input.endDate,
        })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'shift_assignments',
        recordId: assignment.id,
        data: assignment,
      });

      return assignment;
    }),

  /* ================================================================ */
  /*  15. requestShiftSwap                                             */
  /* ================================================================ */
  requestShiftSwap: protectedProcedure
    .input(shiftSwapSchema)
    .mutation(async ({ ctx, input }) => {
      const [swap] = await db
        .insert(shiftSwaps)
        .values({
          orgId: ctx.orgId!,
          requesterId: input.requesterId,
          recipientId: input.recipientId,
          requesterScheduleId: input.requesterScheduleId,
          recipientScheduleId: input.recipientScheduleId,
          swapDate: input.swapDate,
          reason: input.reason,
          status: 'pending',
        })
        .returning();

      await auditService.logCreate({
        ctx,
        tableName: 'shift_swaps',
        recordId: swap.id,
        data: swap,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: input.recipientId,
        title: 'Shift Swap Request',
        body: `You have a new shift swap request for ${input.swapDate}.`,
        link: `/timekeeping/shift-swaps/${swap.id}`,
      });

      return swap;
    }),

  /* ================================================================ */
  /*  16. approveShiftSwap / rejectShiftSwap                             */
  /* ================================================================ */
  approveShiftSwap: protectedProcedure
    .input(shiftSwapActionSchema)
    .mutation(async ({ ctx, input }) => {
      const [swap] = await db
        .select()
        .from(shiftSwaps)
        .where(and(eq(shiftSwaps.id, input.id), eq(shiftSwaps.orgId, ctx.orgId!)))
        .limit(1);

      if (!swap) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift swap not found.' });
      if (swap.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending swaps can be approved.' });

      const [updated] = await db
        .update(shiftSwaps)
        .set({ status: 'approved' })
        .where(and(eq(shiftSwaps.id, input.id), eq(shiftSwaps.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'shift_swaps',
        recordId: input.id,
        oldData: swap,
        newData: updated,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: swap.requesterId,
        title: 'Shift Swap Approved',
        body: `Your shift swap request for ${swap.swapDate} has been approved.`,
        link: `/timekeeping/shift-swaps/${input.id}`,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: swap.recipientId,
        title: 'Shift Swap Approved',
        body: `The shift swap request for ${swap.swapDate} has been approved.`,
        link: `/timekeeping/shift-swaps/${input.id}`,
      });

      return updated;
    }),

  rejectShiftSwap: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [swap] = await db
        .select()
        .from(shiftSwaps)
        .where(and(eq(shiftSwaps.id, input.id), eq(shiftSwaps.orgId, ctx.orgId!)))
        .limit(1);

      if (!swap) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift swap not found.' });
      if (swap.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending swaps can be rejected.' });

      const [updated] = await db
        .update(shiftSwaps)
        .set({ status: 'rejected' })
        .where(and(eq(shiftSwaps.id, input.id), eq(shiftSwaps.orgId, ctx.orgId!)))
        .returning();

      await auditService.logUpdate({
        ctx,
        tableName: 'shift_swaps',
        recordId: input.id,
        oldData: swap,
        newData: updated,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: swap.requesterId,
        title: 'Shift Swap Rejected',
        body: `Your shift swap request for ${swap.swapDate} has been rejected.`,
        link: `/timekeeping/shift-swaps/${input.id}`,
      });

      await db.insert(notifications).values({
        orgId: ctx.orgId!,
        userId: swap.recipientId,
        title: 'Shift Swap Rejected',
        body: `The shift swap request for ${swap.swapDate} has been rejected.`,
        link: `/timekeeping/shift-swaps/${input.id}`,
      });

      return updated;
    }),

  /* ================================================================ */
  /*  17. getTeamPresence                                              */
  /* ================================================================ */
  getTeamPresence: protectedProcedure
    .query(async ({ ctx }) => {
      const allEmployees = await db
        .select()
        .from(employees)
        .where(eq(employees.orgId, ctx.orgId!));

      const presence = [];
      for (const emp of allEmployees) {
        const [latestEntry] = await db
          .select()
          .from(timeEntries)
          .where(and(eq(timeEntries.employeeId, emp.id), eq(timeEntries.orgId, ctx.orgId!)))
          .orderBy(desc(timeEntries.timestamp))
          .limit(1);

        let status = 'offline';
        if (latestEntry) {
          const type = latestEntry.entryType;
          if (type === 'clock_in') status = 'online';
          else if (type === 'break_start' || type === 'lunch_start') status = 'on_break';
          else if (type === 'clock_out') status = 'idle';
          else if (type === 'project_switch') status = 'online';
        }

        // override if on leave (simplified check)
        const todayStart = startOfDay(toISO(new Date()).split('T')[0]);
        const todayEnd = endOfDay(toISO(new Date()).split('T')[0]);
        const [att] = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.employeeId, emp.id),
              eq(attendanceRecords.orgId, ctx.orgId!),
              gte(attendanceRecords.date, todayStart),
              lte(attendanceRecords.date, todayEnd)
            )
          )
          .limit(1);

        if (att?.status === 'on_leave') status = 'on_leave';

        let currentProjectName: string | null = null;
        if (latestEntry?.projectId) {
          const [proj] = await db
            .select({ name: projects.name })
            .from(projects)
            .where(and(eq(projects.id, latestEntry.projectId), eq(projects.orgId, ctx.orgId!)))
            .limit(1);
          currentProjectName = proj?.name ?? null;
        }

        presence.push({
          employeeId: emp.id,
          employeeName: emp.name,
          status,
          lastActivity: latestEntry?.timestamp ?? null,
          currentProjectName,
        });
      }

      return presence;
    }),
});
