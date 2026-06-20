import { describe, expect, it } from 'vitest';
import {
  CRM_ACTIONS,
  CRM_RECORD_ACTIONS,
  CRM_SETTINGS_ACTIONS,
  can,
  type CrmAction,
  type PermissionUser,
} from './index.js';

const outreach: PermissionUser = { id: 'u-outreach', role: 'outreach', teamIds: ['team-a'] };
const manager: PermissionUser = { id: 'u-manager', role: 'manager', teamIds: ['team-a'] };
const superadmin: PermissionUser = { id: 'u-superadmin', role: 'superadmin' };

describe('CRM permissions', () => {
  it('keeps a single explicit action vocabulary', () => {
    expect(CRM_ACTIONS).toContain('lead.read');
    expect(CRM_ACTIONS).toContain('email.export');
    expect(CRM_ACTIONS).toContain('pipeline.configure');
    expect(CRM_ACTIONS).toContain('user.deactivate');
    expect(CRM_ACTIONS).toContain('ai.bulkActions');
  });

  it('allows superadmin to perform every CRM action', () => {
    for (const action of CRM_ACTIONS) {
      expect(can(superadmin, action)).toBe(true);
    }
  });

  it('allows outreach to create base records but not bulk, export, assign, delete, or settings actions', () => {
    expect(can(outreach, 'lead.create')).toBe(true);
    expect(can(outreach, 'contact.create')).toBe(true);
    expect(can(outreach, 'lead.bulkUpdate')).toBe(false);
    expect(can(outreach, 'lead.export')).toBe(false);
    expect(can(outreach, 'lead.assign')).toBe(false);
    expect(can(outreach, 'lead.delete')).toBe(false);

    for (const action of CRM_SETTINGS_ACTIONS) {
      expect(can(outreach, action)).toBe(false);
    }
  });

  it('requires ownership or shared-team hydration for outreach record reads and updates', () => {
    expect(can(outreach, 'lead.read')).toBe('needs_owner_check');
    expect(can(outreach, 'lead.read', { ownerId: outreach.id })).toBe(true);
    expect(can(outreach, 'lead.update', { sharedWithTeamIds: ['team-a'] })).toBe(true);
    expect(can(outreach, 'lead.update', { ownerId: 'someone-else' })).toBe(false);
  });

  it('limits outreach task writes and email drafts to owned or shared work', () => {
    expect(can(outreach, 'task.create')).toBe('needs_owner_check');
    expect(can(outreach, 'task.update', { assigneeId: outreach.id })).toBe(true);
    expect(can(outreach, 'email.create', { ownerId: outreach.id })).toBe(true);
    expect(can(outreach, 'email.read', { ownerId: outreach.id })).toBe(false);
  });

  it('allows manager to manage team records and configure CRM settings', () => {
    expect(can(manager, 'lead.read')).toBe('needs_team_check');
    expect(can(manager, 'lead.delete', { teamId: 'team-a' })).toBe(true);
    expect(can(manager, 'lead.assign', { sharedWithTeamIds: ['team-a'] })).toBe(true);
    expect(can(manager, 'lead.export', { teamId: 'team-b' })).toBe(false);

    for (const action of CRM_SETTINGS_ACTIONS) {
      expect(can(manager, action)).toBe(true);
    }
  });

  it('allows manager user administration only for outreach users', () => {
    expect(can(manager, 'user.invite')).toBe('needs_owner_check');
    expect(can(manager, 'user.invite', { targetRole: 'outreach' })).toBe(true);
    expect(can(manager, 'user.changeRole', { targetRole: 'outreach' })).toBe(true);
    expect(can(manager, 'user.changeRole', { targetRole: 'manager' })).toBe(false);
    expect(can(manager, 'user.deactivate', { targetRole: 'outreach' })).toBe(false);
  });

  it('allows normal AI use but reserves bulk AI for managers and superadmins', () => {
    expect(can(outreach, 'ai.use')).toBe(true);
    expect(can(outreach, 'ai.bulkActions')).toBe(false);
    expect(can(manager, 'ai.bulkActions')).toBe(true);
    expect(can(superadmin, 'ai.bulkActions')).toBe(true);
  });

  it('has manager and superadmin coverage for every record action', () => {
    for (const action of CRM_RECORD_ACTIONS as readonly CrmAction[]) {
      const managerDecision = can(manager, action, { teamId: 'team-a' });
      expect(managerDecision, action).toBe(true);
      expect(can(superadmin, action), action).toBe(true);
    }
  });
});
