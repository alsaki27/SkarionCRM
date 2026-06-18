import { router } from '../trpc.js';
import { orgRouter } from './org.js';
import { authRouter } from './auth.js';
import { contactRouter } from './contact.js';
import { financialRouter } from './financial.js';
import { taxRouter } from './tax.js';
import { complianceRouter } from './compliance.js';
import { employeeRouter } from './employee.js';
import { payrollRouter } from './payroll.js';
import { w2Router } from './w2.js';
import { documentRouter } from './document.js';
import { taskRouter } from './task.js';
import { reportRouter } from './report.js';
import { aiRouter } from './ai.js';

export const appRouter = router({
  auth: authRouter,
  org: orgRouter,
  contact: contactRouter,
  financial: financialRouter,
  tax: taxRouter,
  compliance: complianceRouter,
  employee: employeeRouter,
  payroll: payrollRouter,
  w2: w2Router,
  document: documentRouter,
  task: taskRouter,
  report: reportRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
