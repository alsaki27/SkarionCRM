import { sql, relations } from 'drizzle-orm';
import {
  pgSchema,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  jsonb,
  inet,
  date,
  integer,
} from 'drizzle-orm/pg-core';

function timestamps() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  };
}

function softDelete() {
  return {
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
  };
}

export const hrSchema = pgSchema('hr');

export const timeOffTypeEnum = hrSchema.enum('time_off_type', [
  'vacation',
  'sick',
  'personal',
  'bereavement',
  'other',
]);

export const timeOffStatusEnum = hrSchema.enum('time_off_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const departments = hrSchema.table(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    managerUserId: uuid('manager_user_id'),
    parentId: uuid('parent_id'),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index('idx_departments_name').on(table.name),
    index('idx_departments_manager').on(table.managerUserId),
    uniqueIndex('idx_departments_name_lower').on(sql`lower(${table.name})`),
  ]
);

export const employees = hrSchema.table(
  'employees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().unique(),
    employeeNumber: text('employee_number'),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
    position: text('position'),
    hireDate: date('hire_date'),
    salary: integer('salary'),
    salaryCurrency: text('salary_currency').default('USD'),
    employmentType: text('employment_type').default('full_time'),
    emergencyContact: jsonb('emergency_contact'),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index('idx_employees_user').on(table.userId),
    index('idx_employees_department').on(table.departmentId),
    index('idx_employees_employee_number').on(table.employeeNumber),
    uniqueIndex('idx_employees_employee_number_lower').on(sql`lower(${table.employeeNumber})`),
  ]
);

export const timeOffRequests = hrSchema.table(
  'time_off_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .notNull(),
    type: timeOffTypeEnum('type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: timeOffStatusEnum('status').default('pending').notNull(),
    reason: text('reason'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index('idx_time_off_employee').on(table.employeeId),
    index('idx_time_off_status').on(table.status),
    index('idx_time_off_dates').on(table.startDate, table.endDate),
  ]
);

export const auditLog = hrSchema.table(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id'),
    app: text('app').default('hr').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_hr_audit_actor').on(table.actorUserId),
    index('idx_hr_audit_resource').on(table.resourceType, table.resourceId),
    index('idx_hr_audit_created').on(table.createdAt),
  ]
);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'departmentHierarchy',
  }),
  children: many(departments, { relationName: 'departmentHierarchy' }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  timeOffRequests: many(timeOffRequests),
}));

export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
  employee: one(employees, { fields: [timeOffRequests.employeeId], references: [employees.id] }),
}));
