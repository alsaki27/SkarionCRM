import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, gte, lte, desc, count, sql, sum, inArray, ilike } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db/index.js';
import { projects, projectTasks, projectTimeEntries, employees, contacts, users } from '../db/schema.js';
import { auditService } from '../services/audit.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getEmployeeIdFromCtx = async (ctx: { user: { id: string; email: string }; orgId: string | null }, employeeId?: string) => {
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

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const listProjectsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  clientId: z.string().optional(),
  managerId: z.string().optional(),
  search: z.string().optional(),
  isBillable: z.boolean().optional(),
});

const getProjectByIdSchema = z.object({ id: z.string() });

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  clientId: z.string().optional(),
  managerId: z.string().optional(),
  budgetHours: z.number().optional(),
  hourlyRate: z.number().optional(),
  isBillable: z.boolean().optional().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  color: z.string().optional(),
});

const updateProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  managerId: z.string().optional(),
  budgetHours: z.number().optional(),
  hourlyRate: z.number().optional(),
  isBillable: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
});

const deleteProjectSchema = z.object({ id: z.string() });

const listTasksSchema = z.object({
  projectId: z.string(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
});

const createTaskSchema = z.object({
  projectId: z.string(),
  parentTaskId: z.string().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.string().optional().default('active'),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});

const updateTaskSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});

const deleteTaskSchema = z.object({ id: z.string() });

const listProjectTimeEntriesSchema = z.object({
  projectId: z.string(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  employeeId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const createProjectTimeEntrySchema = z.object({
  employeeId: z.string().optional(),
  projectId: z.string(),
  taskId: z.string().optional(),
  date: z.string(),
  hours: z.number().min(0).max(24),
  isBillable: z.boolean().optional(),
  hourlyRate: z.number().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const getProjectBurnSchema = z.object({ projectId: z.string() });

const getBillableReportSchema = z.object({
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const getEmployeeProjectsSchema = z.object({
  employeeId: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export const projectsRouter = router({
  /* ================================================================ */
  /*  1. listProjects                                                  */
  /* ================================================================ */
  listProjects: protectedProcedure
    .input(listProjectsSchema)
    .query(async ({ input, ctx }) => {
      const conditions = [eq(projects.orgId, ctx.orgId!)];

      if (input.status) conditions.push(eq(projects.status, input.status));
      if (input.clientId) conditions.push(eq(projects.clientId, input.clientId));
      if (input.managerId) conditions.push(eq(projects.managerId, input.managerId));
      if (input.isBillable !== undefined) conditions.push(eq(projects.isBillable, input.isBillable));
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(projects.name, pattern),
            ilike(projects.description, pattern)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.projects.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(projects.createdAt)],
          with: {
            client: { columns: { id: true, fullName: true } },
            manager: { columns: { id: true, fullName: true } },
          },
        }),
        db.select({ count: count() }).from(projects).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  /* ================================================================ */
  /*  2. getProjectById                                                */
  /* ================================================================ */
  getProjectById: protectedProcedure
    .input(getProjectByIdSchema)
    .query(async ({ input, ctx }) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.id), eq(projects.orgId, ctx.orgId!)),
        with: {
          client: { columns: { id: true, fullName: true } },
          manager: { columns: { id: true, fullName: true } },
          tasks: {
            with: {
              assignee: { columns: { id: true, firstName: true, lastName: true } },
            },
          },
          timeEntries: {
            limit: 10,
            orderBy: [desc(projectTimeEntries.date)],
            with: {
              employee: { columns: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const [agg] = await db
        .select({
          totalHours: sql<number>`COALESCE(SUM(${projectTimeEntries.hours}), 0)`,
          billableHours: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.isBillable} THEN ${projectTimeEntries.hours} ELSE 0 END), 0)`,
        })
        .from(projectTimeEntries)
        .where(and(eq(projectTimeEntries.projectId, input.id), eq(projectTimeEntries.orgId, ctx.orgId!)));

      const totalHours = Number(agg?.totalHours ?? 0);
      const billableHours = Number(agg?.billableHours ?? 0);
      const budgetHours = project.budgetHours ? Number(project.budgetHours) : null;
      const budgetConsumed = budgetHours && budgetHours > 0 ? (totalHours / budgetHours) * 100 : null;
      const remainingBudget = budgetHours ? budgetHours - totalHours : null;

      return {
        ...project,
        totalHours,
        billableHours,
        budgetConsumed,
        remainingBudget,
      };
    }),

  /* ================================================================ */
  /*  3. createProject                                                 */
  /* ================================================================ */
  createProject: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.clientId) {
        const client = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, input.clientId), eq(contacts.orgId, ctx.orgId!)),
        });
        if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      if (input.managerId) {
        const manager = await db.query.users.findFirst({
          where: and(eq(users.id, input.managerId), eq(users.orgId, ctx.orgId!)),
        });
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'Manager not found' });
      }

      const [project] = await db
        .insert(projects)
        .values({
          orgId: ctx.orgId!,
          name: input.name,
          description: input.description || null,
          clientId: input.clientId || null,
          managerId: input.managerId || null,
          budgetHours: input.budgetHours !== undefined ? String(input.budgetHours) : null,
          hourlyRate: input.hourlyRate !== undefined ? String(input.hourlyRate) : null,
          isBillable: input.isBillable ?? true,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          color: input.color || '#3b82f6',
          status: 'active',
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'project',
        project.id,
        { name: project.name, clientId: project.clientId, managerId: project.managerId }
      );

      return project;
    }),

  /* ================================================================ */
  /*  4. updateProject                                                 */
  /* ================================================================ */
  updateProject: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      if (updates.clientId) {
        const client = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, updates.clientId), eq(contacts.orgId, ctx.orgId!)),
        });
        if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      if (updates.managerId) {
        const manager = await db.query.users.findFirst({
          where: and(eq(users.id, updates.managerId), eq(users.orgId, ctx.orgId!)),
        });
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'Manager not found' });
      }

      const updateData: any = { ...updates };
      if (updates.budgetHours !== undefined) updateData.budgetHours = String(updates.budgetHours);
      if (updates.hourlyRate !== undefined) updateData.hourlyRate = String(updates.hourlyRate);
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'project',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );

      return updated;
    }),

  /* ================================================================ */
  /*  5. deleteProject                                                 */
  /* ================================================================ */
  deleteProject: protectedProcedure
    .input(deleteProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.id), eq(projects.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      await db
        .update(projects)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(projects.id, input.id));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'project',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  /* ================================================================ */
  /*  6. listTasks                                                     */
  /* ================================================================ */
  listTasks: protectedProcedure
    .input(listTasksSchema)
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(projectTasks.orgId, ctx.orgId!),
        eq(projectTasks.projectId, input.projectId),
      ];
      if (input.status) conditions.push(eq(projectTasks.status, input.status));
      if (input.assignedTo) conditions.push(eq(projectTasks.assignedTo, input.assignedTo));

      const whereClause = and(...conditions);

      const [tasksResult, totalResult] = await Promise.all([
        db.query.projectTasks.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(projectTasks.createdAt)],
          with: {
            assignee: { columns: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.select({ count: count() }).from(projectTasks).where(whereClause),
      ]);

      // Count subtasks for each task
      let subtaskCounts: { parentTaskId: string | null; count: number }[] = [];
      if (tasksResult.length > 0) {
        const taskIds = tasksResult.map(t => t.id);
        subtaskCounts = await db
          .select({
            parentTaskId: projectTasks.parentTaskId,
            count: count(),
          })
          .from(projectTasks)
          .where(
            and(
              eq(projectTasks.orgId, ctx.orgId!),
              inArray(projectTasks.parentTaskId, taskIds)
            )
          )
          .groupBy(projectTasks.parentTaskId);
      }

      const subtaskMap = new Map(subtaskCounts.map(s => [s.parentTaskId!, s.count]));

      return {
        items: tasksResult.map(t => ({
          ...t,
          subtaskCount: subtaskMap.get(t.id) ?? 0,
        })),
        total: totalResult[0]?.count ?? 0,
      };
    }),

  /* ================================================================ */
  /*  7. createTask                                                    */
  /* ================================================================ */
  createTask: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, ctx.orgId!)),
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const [task] = await db
        .insert(projectTasks)
        .values({
          orgId: ctx.orgId!,
          projectId: input.projectId,
          parentTaskId: input.parentTaskId || null,
          name: input.name,
          description: input.description || null,
          estimatedHours: input.estimatedHours !== undefined ? String(input.estimatedHours) : null,
          status: input.status || 'active',
          assignedTo: input.assignedTo || null,
          dueDate: input.dueDate || null,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'project_task',
        task.id,
        { name: task.name, projectId: task.projectId },
      );

      return task;
    }),

  /* ================================================================ */
  /*  8. updateTask                                                    */
  /* ================================================================ */
  updateTask: protectedProcedure
    .input(updateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const existing = await db.query.projectTasks.findFirst({
        where: and(eq(projectTasks.id, id), eq(projectTasks.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const updateData: any = { ...updates };
      if (updates.estimatedHours !== undefined) updateData.estimatedHours = String(updates.estimatedHours);
      if (updates.status === 'completed') updateData.completedAt = new Date();
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(projectTasks)
        .set(updateData)
        .where(eq(projectTasks.id, id))
        .returning();

      await auditService.logUpdate(
        ctx.orgId!,
        ctx.user.id,
        'project_task',
        id,
        existing as Record<string, unknown>,
        updates as Record<string, unknown>,
      );

      return updated;
    }),

  /* ================================================================ */
  /*  9. deleteTask                                                    */
  /* ================================================================ */
  deleteTask: protectedProcedure
    .input(deleteTaskSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.projectTasks.findFirst({
        where: and(eq(projectTasks.id, input.id), eq(projectTasks.orgId, ctx.orgId!)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      await db.delete(projectTasks).where(eq(projectTasks.id, input.id));

      await auditService.logDelete(
        ctx.orgId!,
        ctx.user.id,
        'project_task',
        input.id,
        existing as Record<string, unknown>,
      );

      return { success: true };
    }),

  /* ================================================================ */
  /*  10. listProjectTimeEntries                                       */
  /* ================================================================ */
  listProjectTimeEntries: protectedProcedure
    .input(listProjectTimeEntriesSchema)
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(projectTimeEntries.orgId, ctx.orgId!),
        eq(projectTimeEntries.projectId, input.projectId),
      ];
      if (input.employeeId) conditions.push(eq(projectTimeEntries.employeeId, input.employeeId));
      if (input.dateFrom) conditions.push(gte(projectTimeEntries.date, input.dateFrom));
      if (input.dateTo) conditions.push(lte(projectTimeEntries.date, input.dateTo));

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.query.projectTimeEntries.findMany({
          where: whereClause,
          limit: input.limit,
          offset: input.offset,
          orderBy: [desc(projectTimeEntries.date)],
          with: {
            employee: { columns: { id: true, firstName: true, lastName: true } },
            task: { columns: { id: true, name: true } },
          },
        }),
        db.select({ count: count() }).from(projectTimeEntries).where(whereClause),
      ]);

      return { items, total: totalResult[0]?.count ?? 0 };
    }),

  /* ================================================================ */
  /*  11. createProjectTimeEntry                                       */
  /* ================================================================ */
  createProjectTimeEntry: protectedProcedure
    .input(createProjectTimeEntrySchema)
    .mutation(async ({ input, ctx }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);

      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, ctx.orgId!)),
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const rate = input.hourlyRate !== undefined
        ? input.hourlyRate
        : (project.hourlyRate ? Number(project.hourlyRate) : null);

      if (rate === null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hourly rate is required' });
      }

      const totalAmount = (input.hours * rate).toFixed(2);

      let budgetWarning: string | null = null;
      if (project.budgetHours) {
        const [totalHoursAgg] = await db
          .select({ total: sum(projectTimeEntries.hours) })
          .from(projectTimeEntries)
          .where(
            and(
              eq(projectTimeEntries.projectId, input.projectId),
              eq(projectTimeEntries.orgId, ctx.orgId!)
            )
          );
        const totalHours = Number(totalHoursAgg?.total ?? 0);
        const budgetHours = Number(project.budgetHours);
        if (totalHours + input.hours > budgetHours) {
          budgetWarning = `Total hours (${totalHours + input.hours}) exceed project budget (${budgetHours})`;
        }
      }

      const [entry] = await db
        .insert(projectTimeEntries)
        .values({
          orgId: ctx.orgId!,
          employeeId,
          projectId: input.projectId,
          taskId: input.taskId || null,
          date: input.date,
          hours: String(input.hours),
          isBillable: input.isBillable ?? true,
          hourlyRate: String(rate),
          totalAmount,
          description: input.description || null,
          notes: input.notes || null,
        })
        .returning();

      await auditService.logCreate(
        ctx.orgId!,
        ctx.user.id,
        'project_time_entry',
        entry.id,
        { projectId: entry.projectId, employeeId: entry.employeeId, hours: entry.hours, totalAmount: entry.totalAmount },
      );

      return { entry, budgetWarning };
    }),

  /* ================================================================ */
  /*  12. getProjectBurn                                               */
  /* ================================================================ */
  getProjectBurn: protectedProcedure
    .input(getProjectBurnSchema)
    .query(async ({ input, ctx }) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.orgId, ctx.orgId!)),
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const [agg] = await db
        .select({
          totalHours: sql<number>`COALESCE(SUM(${projectTimeEntries.hours}), 0)`,
          billableHours: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.isBillable} THEN ${projectTimeEntries.hours} ELSE 0 END), 0)`,
          totalAmount: sql<number>`COALESCE(SUM(${projectTimeEntries.totalAmount}), 0)`,
        })
        .from(projectTimeEntries)
        .where(
          and(
            eq(projectTimeEntries.projectId, input.projectId),
            eq(projectTimeEntries.orgId, ctx.orgId!)
          )
        );

      const totalHours = Number(agg?.totalHours ?? 0);
      const billableHours = Number(agg?.billableHours ?? 0);
      const nonBillableHours = totalHours - billableHours;
      const totalAmount = Number(agg?.totalAmount ?? 0);
      const budgetHours = project.budgetHours ? Number(project.budgetHours) : null;
      const budgetConsumed = budgetHours && budgetHours > 0 ? (totalHours / budgetHours) * 100 : null;
      const remainingBudgetHours = budgetHours ? budgetHours - totalHours : null;

      // Cost estimate: hours * employee payRate
      const [costAgg] = await db
        .select({
          cost: sql<number>`COALESCE(SUM(${projectTimeEntries.hours} * COALESCE(${employees.payRate}, 0)), 0)`,
        })
        .from(projectTimeEntries)
        .leftJoin(employees, eq(projectTimeEntries.employeeId, employees.id))
        .where(
          and(
            eq(projectTimeEntries.projectId, input.projectId),
            eq(projectTimeEntries.orgId, ctx.orgId!)
          )
        );

      const costEstimate = Number(costAgg?.cost ?? 0);

      // Employee breakdown
      const employeeBreakdown = await db
        .select({
          employeeId: projectTimeEntries.employeeId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          hours: sum(projectTimeEntries.hours),
          billableHours: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.isBillable} THEN ${projectTimeEntries.hours} ELSE 0 END), 0)`,
        })
        .from(projectTimeEntries)
        .leftJoin(employees, eq(projectTimeEntries.employeeId, employees.id))
        .where(
          and(
            eq(projectTimeEntries.projectId, input.projectId),
            eq(projectTimeEntries.orgId, ctx.orgId!)
          )
        )
        .groupBy(projectTimeEntries.employeeId, employees.firstName, employees.lastName);

      const employeeBreakdownFormatted = employeeBreakdown.map((e) => ({
        employeeId: e.employeeId,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unknown',
        hours: Number(e.hours),
        billableHours: Number(e.billableHours),
        billableRatio: e.hours ? (Number(e.billableHours) / Number(e.hours)) * 100 : 0,
      }));

      // Task breakdown
      const taskBreakdown = await db
        .select({
          taskId: projectTimeEntries.taskId,
          taskName: projectTasks.name,
          hours: sum(projectTimeEntries.hours),
        })
        .from(projectTimeEntries)
        .leftJoin(projectTasks, eq(projectTimeEntries.taskId, projectTasks.id))
        .where(
          and(
            eq(projectTimeEntries.projectId, input.projectId),
            eq(projectTimeEntries.orgId, ctx.orgId!)
          )
        )
        .groupBy(projectTimeEntries.taskId, projectTasks.name);

      const taskBreakdownFormatted = taskBreakdown.map((t) => ({
        taskId: t.taskId,
        name: t.taskName || 'Untasked',
        hours: Number(t.hours),
      }));

      // Timeline: hours per week
      const timeline = await db
        .select({
          week: sql<string>`TO_CHAR(${projectTimeEntries.date}, 'IYYY-IW')`,
          hours: sum(projectTimeEntries.hours),
        })
        .from(projectTimeEntries)
        .where(
          and(
            eq(projectTimeEntries.projectId, input.projectId),
            eq(projectTimeEntries.orgId, ctx.orgId!)
          )
        )
        .groupBy(sql`TO_CHAR(${projectTimeEntries.date}, 'IYYY-IW')`)
        .orderBy(sql`TO_CHAR(${projectTimeEntries.date}, 'IYYY-IW')`);

      const timelineFormatted = timeline.map((t) => ({
        week: t.week,
        hours: Number(t.hours),
      }));

      return {
        totalHours,
        billableHours,
        nonBillableHours,
        budgetHours,
        budgetConsumed,
        remainingBudgetHours,
        totalAmount,
        costEstimate,
        employeeBreakdown: employeeBreakdownFormatted,
        taskBreakdown: taskBreakdownFormatted,
        timeline: timelineFormatted,
      };
    }),

  /* ================================================================ */
  /*  13. getBillableReport                                            */
  /* ================================================================ */
  getBillableReport: protectedProcedure
    .input(getBillableReportSchema)
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(projectTimeEntries.orgId, ctx.orgId!),
        eq(projectTimeEntries.isBillable, true),
      ];
      if (input.projectId) conditions.push(eq(projectTimeEntries.projectId, input.projectId));
      if (input.dateFrom) conditions.push(gte(projectTimeEntries.date, input.dateFrom));
      if (input.dateTo) conditions.push(lte(projectTimeEntries.date, input.dateTo));
      if (input.clientId) conditions.push(eq(projects.clientId, input.clientId));

      const rows = await db
        .select({
          projectId: projectTimeEntries.projectId,
          projectName: projects.name,
          clientName: contacts.fullName,
          employeeId: projectTimeEntries.employeeId,
          employeeName: sql<string>`COALESCE(${employees.firstName} || ' ' || ${employees.lastName}, 'Unknown')`,
          hours: sum(projectTimeEntries.hours),
          rate: projectTimeEntries.hourlyRate,
          amount: sum(projectTimeEntries.totalAmount),
        })
        .from(projectTimeEntries)
        .innerJoin(projects, eq(projectTimeEntries.projectId, projects.id))
        .leftJoin(contacts, eq(projects.clientId, contacts.id))
        .leftJoin(employees, eq(projectTimeEntries.employeeId, employees.id))
        .where(and(...conditions))
        .groupBy(
          projectTimeEntries.projectId,
          projects.name,
          contacts.fullName,
          projectTimeEntries.employeeId,
          employees.firstName,
          employees.lastName,
          projectTimeEntries.hourlyRate
        )
        .orderBy(projects.name, sql`${employees.firstName} || ' ' || ${employees.lastName}`);

      const grandTotal = rows.reduce((acc, r) => acc + Number(r.amount), 0);

      return {
        items: rows.map((r) => ({
          projectName: r.projectName,
          clientName: r.clientName,
          employeeName: r.employeeName,
          hours: Number(r.hours),
          rate: Number(r.rate),
          amount: Number(r.amount),
        })),
        grandTotal,
      };
    }),

  /* ================================================================ */
  /*  14. getEmployeeProjects                                          */
  /* ================================================================ */
  getEmployeeProjects: protectedProcedure
    .input(getEmployeeProjectsSchema)
    .query(async ({ input, ctx }) => {
      const employeeId = await getEmployeeIdFromCtx(ctx, input.employeeId);

      // Get project IDs from tasks
      const taskProjects = await db
        .selectDistinct({ projectId: projectTasks.projectId })
        .from(projectTasks)
        .where(
          and(
            eq(projectTasks.orgId, ctx.orgId!),
            eq(projectTasks.assignedTo, employeeId)
          )
        );

      // Get project IDs from time entries
      const timeProjects = await db
        .selectDistinct({ projectId: projectTimeEntries.projectId })
        .from(projectTimeEntries)
        .where(
          and(
            eq(projectTimeEntries.orgId, ctx.orgId!),
            eq(projectTimeEntries.employeeId, employeeId)
          )
        );

      const projectIdSet = new Set<string>();
      for (const row of taskProjects) {
        if (row.projectId) projectIdSet.add(row.projectId);
      }
      for (const row of timeProjects) {
        if (row.projectId) projectIdSet.add(row.projectId);
      }

      const projectIds = Array.from(projectIdSet);
      if (projectIds.length === 0) {
        return { items: [], total: 0 };
      }

      // Get project details
      const projectList = await db.query.projects.findMany({
        where: and(
          eq(projects.orgId, ctx.orgId!),
          inArray(projects.id, projectIds)
        ),
        with: {
          client: { columns: { id: true, fullName: true } },
          manager: { columns: { id: true, fullName: true } },
        },
        orderBy: [desc(projects.createdAt)],
      });

      // Get hours and last activity per project
      const hoursResult = await db
        .select({
          projectId: projectTimeEntries.projectId,
          totalHours: sum(projectTimeEntries.hours),
          lastDate: sql<string>`MAX(${projectTimeEntries.date})`,
        })
        .from(projectTimeEntries)
        .where(
          and(
            eq(projectTimeEntries.orgId, ctx.orgId!),
            eq(projectTimeEntries.employeeId, employeeId),
            inArray(projectTimeEntries.projectId, projectIds)
          )
        )
        .groupBy(projectTimeEntries.projectId);

      const hoursMap = new Map(hoursResult.map((r) => [r.projectId, r]));

      const items = projectList.map((p) => {
        const h = hoursMap.get(p.id);
        return {
          ...p,
          hoursContributed: h ? Number(h.totalHours) : 0,
          lastActivityDate: h?.lastDate ?? null,
        };
      });

      return { items, total: items.length };
    }),
});
