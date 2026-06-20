import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

describe('Employee Router', () => {
  let testOrg: any;
  let testUser: any;
  let caller: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    caller = appRouter.createCaller(createTestContext(testUser, testOrg.id));
  });

  describe('create', () => {
    it('should create a new employee', async () => {
      const result = await caller.employee.create({
        employeeId: `EMP-${Date.now()}`,
        firstName: 'Jane',
        lastName: 'Doe',
        email: `jane-${Date.now()}@example.com`,
        hireDate: '2024-01-15',
        jobTitle: 'Software Engineer',
        department: 'Engineering',
        employmentType: 'full_time',
        payType: 'salary',
      });

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Doe');
      expect(result.employeeId).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('should reject duplicate employee ID', async () => {
      const employeeId = `EMP-DUP-${Date.now()}`;
      await caller.employee.create({
        employeeId,
        firstName: 'First',
        lastName: 'Employee',
        hireDate: '2024-01-01',
      });

      await expect(
        caller.employee.create({
          employeeId,
          firstName: 'Second',
          lastName: 'Employee',
          hireDate: '2024-01-01',
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('update', () => {
    it('should update an employee', async () => {
      const employee = await caller.employee.create({
        employeeId: `EMP-UPDATE-${Date.now()}`,
        firstName: 'Original',
        lastName: 'Name',
        hireDate: '2024-01-01',
      });

      const updated = await caller.employee.update({
        id: employee.id,
        firstName: 'Updated',
        lastName: 'Name',
        jobTitle: 'Senior Engineer',
        department: 'Engineering',
      });

      expect(updated.firstName).toBe('Updated');
      expect(updated.jobTitle).toBe('Senior Engineer');
      expect(updated.department).toBe('Engineering');
    });
  });

  describe('list', () => {
    it('should list employees with filters', async () => {
      await caller.employee.create({
        employeeId: `EMP-LIST-1-${Date.now()}`,
        firstName: 'Active',
        lastName: 'Employee',
        hireDate: '2024-01-01',
        status: 'active',
      });

      await caller.employee.create({
        employeeId: `EMP-LIST-2-${Date.now()}`,
        firstName: 'Terminated',
        lastName: 'Employee',
        hireDate: '2023-01-01',
        status: 'terminated',
      });

      const allEmployees = await caller.employee.list({ limit: 10 });
      expect(allEmployees.items.length).toBeGreaterThanOrEqual(2);

      const activeEmployees = await caller.employee.list({ status: 'active', limit: 10 });
      expect(activeEmployees.items.every((e: any) => e.status === 'active')).toBe(true);
    });
  });
});
