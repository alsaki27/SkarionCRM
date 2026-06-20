import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

describe('Auth Router', () => {
  let testOrg: any;
  let testUser: any;
  let callerWithUser: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    callerWithUser = appRouter.createCaller(createTestContext(testUser, testOrg.id));
  });

  describe('register', () => {
    it('should register a new user with organization', async () => {
      const caller = appRouter.createCaller(createTestContext());
      const result = await caller.auth.register({
        email: `register-test-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        fullName: 'Test User',
        orgName: `Test Org ${Date.now()}`,
      });

      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBeDefined();
      expect(result.user.role).toBe('owner');
    });

    it('should reject registration with invalid email', async () => {
      const caller = appRouter.createCaller(createTestContext());
      await expect(
        caller.auth.register({
          email: 'not-an-email',
          password: 'SecurePass123!',
          fullName: 'Test User',
          orgName: 'Test Org',
        })
      ).rejects.toThrow();
    });

    it('should reject registration with short password', async () => {
      const caller = appRouter.createCaller(createTestContext());
      await expect(
        caller.auth.register({
          email: `test-${Date.now()}@example.com`,
          password: 'short',
          fullName: 'Test User',
          orgName: 'Test Org',
        })
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const caller = appRouter.createCaller(createTestContext());
      const email = `login-test-${Date.now()}@example.com`;
      const password = 'SecurePass123!';
      await caller.auth.register({
        email,
        password,
        fullName: 'Login Test User',
        orgName: `Login Test Org ${Date.now()}`,
      });

      const result = await caller.auth.login({
        email,
        password,
      });

      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
    });

    it('should reject login with invalid credentials', async () => {
      const caller = appRouter.createCaller(createTestContext());
      await expect(
        caller.auth.login({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow();
    });
  });

  describe('me', () => {
    it('should return current user when authenticated', async () => {
      const result = await callerWithUser.auth.me();
      expect(result).toBeDefined();
      expect(result?.id).toBe(testUser.id);
      expect(result?.email).toBe(testUser.email);
      expect(result?.fullName).toBe(testUser.fullName);
    });
  });

  describe('protected endpoints', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const caller = appRouter.createCaller(createTestContext());
      await expect(caller.auth.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });
});
