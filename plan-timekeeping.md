# Skarion Timekeeping Module — Implementation Plan

## Overview
Implement the Employee Timekeeping & Workforce Monitoring module on SkarionCRM, leveraging the existing decoupled architecture (React + Vite + tRPC + Drizzle + PostgreSQL).

## What Already Exists in Skarion
- Multi-tenant schema (orgId on all tables)
- JWT auth with roles (owner, admin, accountant, bookkeeper, viewer)
- Employees table with payType, payRate, payFrequency, department, jobTitle
- Organizations, users, plans, subscriptions (SaaS foundation)
- API keys, webhooks, notifications, activity logs
- Invoices, payments, expense reports, 1099s

## New Tables to Add

### Core Timekeeping
1. **work_schedules** — shift definitions (start, end, break, working days, overtime thresholds)
2. **time_entries** — clock in/out records (web + future desktop agent)
3. **attendance_records** — daily roll call (present, absent, late, half_day, on_leave)
4. **timesheets** — weekly timesheet summaries
5. **timesheet_entries** — daily line items per timesheet

### Project & Work Allocation
6. **projects** — projects with client, budget, hourly rate, billable flag
7. **project_tasks** — tasks/subtasks within projects
8. **project_time_entries** — time allocated to specific projects/tasks

### PTO / Leave Management
9. **leave_types** — vacation, sick, personal, etc. with accrual rules
10. **leave_requests** — employee requests with approval workflow
11. **leave_balances** — current accrued balance per employee per type
12. **holiday_calendars** — company holidays per country/region

### Shift Management
13. **shift_assignments** — which employee gets which shift on which days
14. **shift_swaps** — swap requests between employees

## Build Order

### Stage 1: Database Schema (1 agent)
- Append all new tables to schema.ts
- Generate migration
- Apply migration
- Seed sample data

### Stage 2: Backend Routers (3 parallel agents)
- **timekeeping.ts** — clock in/out, timesheets, attendance, work schedules, shift management
- **pto.ts** — leave types, leave requests, leave balances, accrual engine, holiday calendars
- **projects.ts** — projects, tasks, project time entries, billable tracking, budget alerts

### Stage 3: Frontend Pages (3 parallel agents)
- **Employee Self-Service** — My Dashboard, My Timesheets, My PTO, My Projects
- **Manager Dashboard** — Team Presence, Timesheet Approval, Leave Approval, Project Burn
- **Admin Setup** — Work Schedules, Leave Policies, Holiday Calendar, Project Setup

### Stage 4: Integration & Navigation (1 agent)
- Add routes to App.tsx
- Add nav links to Sidebar
- Connect all pages together
- Commit and push

## Priority Matrix
| Feature | Priority | Why |
|---------|----------|-----|
| PTO/Leave Management | P0 | Highest value, most commonly needed across all orgs |
| Core Timekeeping (timesheets) | P0 | Foundation for everything else |
| Project & Work Allocation | P1 | Billing integration, project tracking |
| Manager Dashboard | P1 | Approval workflows, team oversight |
| Work Schedules & Shifts | P1 | Core timekeeping foundation |
| Holiday Calendar | P1 | PTO accrual depends on holidays |
| Shift Swaps | P2 | Nice to have |
| Desktop Agent API | P2 | Web clock-in first, desktop later |
| Screenshots/Activity | P3 | Desktop agent dependent |

## Key Design Decisions
- **Web clock-in first** — Desktop agent is Phase 2, web-based clock-in/out is MVP
- **Country-specific overtime** — Configurable per org, not hardcoded per country yet
- **Accrual engine** — Simple: per pay period, anniversary, or annual lump sum
- **Billable tracking** — Link to existing invoices module for client billing
- **Approval workflow** — Employee submits → Manager approves/rejects with reason
- **Team calendar** — Show who is in/out, on leave, on shift

## Data Flow
1. Employee clocks in via web → creates time_entry (clock_in)
2. Employee clocks out → updates time_entry with duration, activity score
3. End of day → auto-generates attendance_record from time_entries
4. End of week → auto-generates timesheet from daily attendance
5. Employee submits timesheet → manager reviews → approves/rejects
6. Employee requests PTO → manager approves → updates leave_balances
7. Approved PTO → blocks schedule, shows on team calendar
8. Employee allocates time to projects → project_time_entries created
9. Project budgets tracked → alerts at 80% consumption

## Schema Notes
- All tables include orgId for multi-tenancy
- All tables include createdAt, updatedAt
- Soft delete where appropriate (deletedAt)
- Indexes on: employeeId, orgId, date ranges, status fields
- Foreign keys: employee_id references employees, user_id references users

## Frontend Pages

### Employee Pages
- `/timekeeping` — My Dashboard (today's schedule, clock in/out, current project, activity)
- `/timekeeping/timesheets` — My Timesheets (view, edit pending, submit)
- `/timekeeping/pto` — My PTO (request, view history, balances)
- `/timekeeping/projects` — My Projects (assigned projects, time allocation)

### Manager Pages
- `/timekeeping/team` — Team Presence (who is in/out, on break, idle)
- `/timekeeping/approvals` — Approval Queue (timesheets + leave requests)
- `/timekeeping/team-calendar` — Team Calendar (who is off, on shift, on leave)
- `/timekeeping/project-burn` — Project Burn Dashboard (budget consumed, hours per project)

### Admin Pages
- `/timekeeping/admin/schedules` — Work Schedule Builder
- `/timekeeping/admin/leave-policies` — Leave Policy Builder
- `/timekeeping/admin/holidays` — Holiday Calendar
- `/timekeeping/admin/projects` — Project & Client Setup
- `/timekeeping/admin/monitoring` — Monitoring Policy (screenshot freq, tracking level)

## API Endpoints

### Timekeeping Router
- `timekeeping.clockIn` — POST, creates time_entry
- `timekeeping.clockOut` — POST, updates time_entry with duration
- `timekeeping.startBreak` / `timekeeping.endBreak` — lunch break toggle
- `timekeeping.listTimeEntries` — GET, paginated, filter by employee/date
- `timekeeping.getDailyAttendance` — GET, roll call for a date
- `timekeeping.listTimesheets` — GET, weekly summaries
- `timekeeping.submitTimesheet` — POST, employee submits for approval
- `timekeeping.approveTimesheet` — POST, manager approves
- `timekeeping.rejectTimesheet` — POST, manager rejects with reason
- `timekeeping.listWorkSchedules` — GET
- `timekeeping.createWorkSchedule` — POST
- `timekeeping.updateWorkSchedule` — POST
- `timekeeping.listShiftAssignments` — GET
- `timekeeping.assignShift` — POST
- `timekeeping.requestShiftSwap` — POST
- `timekeeping.approveShiftSwap` — POST

### PTO Router
- `pto.listLeaveTypes` — GET
- `pto.createLeaveType` — POST (admin)
- `pto.listLeaveRequests` — GET, filter by employee/status
- `pto.createLeaveRequest` — POST (employee)
- `pto.approveLeaveRequest` — POST (manager)
- `pto.rejectLeaveRequest` — POST (manager)
- `pto.getLeaveBalances` — GET, for current employee or any (manager)
- `pto.listHolidays` — GET
- `pto.createHoliday` — POST (admin)
- `pto.getTeamCalendar` — GET, who's off/on leave for a date range
- `pto.accrualEngine` — internal, runs on schedule to update balances

### Projects Router
- `projects.listProjects` — GET
- `projects.createProject` — POST
- `projects.updateProject` — POST
- `projects.listTasks` — GET, by project
- `projects.createTask` — POST
- `projects.listProjectTimeEntries` — GET
- `projects.createProjectTimeEntry` — POST (allocate time)
- `projects.getProjectBurn` — GET, budget consumed, hours, billable ratio
- `projects.getBillableReport` — GET, invoice-ready export

## Integration with Existing Modules
- **Invoices** — Billable project hours → invoice line items
- **Expenses** — Project-related expenses linked to projects
- **Employees** — Time entries linked to employee records
- **Notifications** — PTO request notifications, timesheet approval notifications
- **Activity Logs** — All timekeeping actions logged
- **Webhooks** — Clock in/out events, PTO approval events

## Compliance Notes
- Overtime thresholds configurable per org (not per country yet)
- Minimum break enforcement configurable
- Data retention: screenshots (when added) auto-delete after 90 days
- Activity logs: retain for 1 year
- GDPR: employee can view all their own data (already in design)

## Build Strategy
1. Schema + migration (me)
2. Backend routers (3 parallel agents)
3. Frontend pages (3 parallel agents)
4. Navigation + integration (me)
5. Seed data + test (me)
6. Commit + push (me)
