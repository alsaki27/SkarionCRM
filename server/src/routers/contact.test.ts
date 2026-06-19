import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

describe('Contact Router', () => {
  let testOrg: any;
  let testUser: any;
  let caller: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    caller = appRouter.createCaller(createTestContext(testUser, testOrg.id));
  });

  describe('create', () => {
    it('should create a new contact', async () => {
      const result = await caller.contact.create({
        fullName: 'John Doe',
        email: `john-${Date.now()}@example.com`,
        type: 'client',
        phone: '555-1234',
        companyName: 'Acme Corp',
      });

      expect(result).toBeDefined();
      expect(result.fullName).toBe('John Doe');
      expect(result.type).toBe('client');
      expect(result.assignedTo).toBe(testUser.id);
      expect(result.orgId).toBe(testOrg.id);
    });
  });

  describe('list with filters', () => {
    it('should list contacts with type filter', async () => {
      await caller.contact.create({
        fullName: 'Client A',
        email: `client-a-${Date.now()}@example.com`,
        type: 'client',
      });

      await caller.contact.create({
        fullName: 'Vendor B',
        email: `vendor-b-${Date.now()}@example.com`,
        type: 'vendor',
      });

      const clientList = await caller.contact.list({ type: 'client', limit: 10 });
      expect(clientList.items.length).toBeGreaterThanOrEqual(1);
      expect(clientList.total).toBeGreaterThanOrEqual(1);

      const vendorList = await caller.contact.list({ type: 'vendor', limit: 10 });
      expect(vendorList.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should search contacts', async () => {
      const uniqueName = `Searchable Contact ${Date.now()}`;
      await caller.contact.create({
        fullName: uniqueName,
        email: `search-${Date.now()}@example.com`,
        type: 'client',
      });

      const result = await caller.contact.list({ search: uniqueName, limit: 10 });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].fullName).toBe(uniqueName);
    });
  });

  describe('update', () => {
    it('should update an existing contact', async () => {
      const contact = await caller.contact.create({
        fullName: 'Original Name',
        email: `update-${Date.now()}@example.com`,
        type: 'client',
      });

      const updated = await caller.contact.update({
        id: contact.id,
        fullName: 'Updated Name',
        status: 'inactive',
      });

      expect(updated.fullName).toBe('Updated Name');
      expect(updated.status).toBe('inactive');
    });
  });

  describe('soft delete', () => {
    it('should soft delete a contact', async () => {
      const contact = await caller.contact.create({
        fullName: 'To Delete',
        email: `delete-${Date.now()}@example.com`,
        type: 'client',
      });

      const deleteResult = await caller.contact.delete({ id: contact.id });
      expect(deleteResult.success).toBe(true);

      // Verify contact is not in list
      const listResult = await caller.contact.list({ limit: 100 });
      const deletedContact = listResult.items.find((c: any) => c.id === contact.id);
      expect(deletedContact).toBeUndefined();

      // Verify contact still exists via getById with archived status
      const fetched = await caller.contact.getById({ id: contact.id });
      expect(fetched.status).toBe('archived');
    });
  });
});
