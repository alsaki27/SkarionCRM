export type CrmRole = 'outreach' | 'manager' | 'superadmin';

export type PermissionDecision = boolean | 'needs_owner_check' | 'needs_team_check';

export type RecordType =
  | 'lead'
  | 'contact'
  | 'company'
  | 'opportunity'
  | 'task'
  | 'activity'
  | 'note'
  | 'email';

export type RecordVerb =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'bulkUpdate'
  | 'export';

export type SettingsAction =
  | 'pipeline.configure'
  | 'tag.configure'
  | 'customField.configure'
  | 'template.configure'
  | 'workflow.configure'
  | 'integration.configure';

export type UserAction = 'user.invite' | 'user.changeRole' | 'user.deactivate';
export type AiAction = 'ai.use' | 'ai.bulkActions';
export type CrmAction = `${RecordType}.${RecordVerb}` | SettingsAction | UserAction | AiAction;

export interface PermissionUser {
  id: string;
  role: CrmRole;
  teamIds?: readonly string[];
}

export interface PermissionResource {
  ownerId?: string | null;
  assigneeId?: string | null;
  createdBy?: string | null;
  teamId?: string | null;
  sharedWithTeamIds?: readonly string[];
  targetRole?: CrmRole | string | null;
}

const RECORD_TYPES = [
  'lead',
  'contact',
  'company',
  'opportunity',
  'task',
  'activity',
  'note',
  'email',
] as const satisfies readonly RecordType[];

const RECORD_VERBS = [
  'read',
  'create',
  'update',
  'delete',
  'assign',
  'bulkUpdate',
  'export',
] as const satisfies readonly RecordVerb[];

export const CRM_RECORD_ACTIONS = RECORD_TYPES.flatMap((record) =>
  RECORD_VERBS.map((verb) => `${record}.${verb}` as const)
) satisfies readonly `${RecordType}.${RecordVerb}`[];

export const CRM_SETTINGS_ACTIONS = [
  'pipeline.configure',
  'tag.configure',
  'customField.configure',
  'template.configure',
  'workflow.configure',
  'integration.configure',
] as const satisfies readonly SettingsAction[];

export const CRM_USER_ACTIONS = [
  'user.invite',
  'user.changeRole',
  'user.deactivate',
] as const satisfies readonly UserAction[];

export const CRM_AI_ACTIONS = ['ai.use', 'ai.bulkActions'] as const satisfies readonly AiAction[];

export const CRM_ACTIONS = [
  ...CRM_RECORD_ACTIONS,
  ...CRM_SETTINGS_ACTIONS,
  ...CRM_USER_ACTIONS,
  ...CRM_AI_ACTIONS,
] as const satisfies readonly CrmAction[];

const OUTREACH_OWNED_RECORD_VERBS = new Set<RecordVerb>(['read', 'create', 'update']);
const MANAGER_CONFIGURE_ACTIONS = new Set<CrmAction>(CRM_SETTINGS_ACTIONS);

function parseRecordAction(action: CrmAction): { record: RecordType; verb: RecordVerb } | null {
  const [record, verb] = action.split('.') as [RecordType, RecordVerb | undefined];
  if (!verb) return null;
  if (!RECORD_TYPES.includes(record) || !RECORD_VERBS.includes(verb)) return null;
  return { record, verb };
}

function isOwnedByUser(user: PermissionUser, resource: PermissionResource): boolean {
  return [resource.ownerId, resource.assigneeId, resource.createdBy].includes(user.id);
}

function sharesUserTeam(user: PermissionUser, resource: PermissionResource): boolean {
  const userTeamIds = new Set(user.teamIds ?? []);
  if (userTeamIds.size === 0) return false;

  if (resource.teamId && userTeamIds.has(resource.teamId)) return true;
  return (resource.sharedWithTeamIds ?? []).some((teamId) => userTeamIds.has(teamId));
}

function canAccessOwnOrShared(
  user: PermissionUser,
  resource?: PermissionResource
): PermissionDecision {
  if (!resource) return 'needs_owner_check';
  return isOwnedByUser(user, resource) || sharesUserTeam(user, resource);
}

function canAccessTeam(user: PermissionUser, resource?: PermissionResource): PermissionDecision {
  if (!resource) return 'needs_team_check';
  return isOwnedByUser(user, resource) || sharesUserTeam(user, resource);
}

function canManageOutreachUser(resource?: PermissionResource): PermissionDecision {
  if (!resource) return 'needs_owner_check';
  return resource.targetRole === 'outreach';
}

export function can(
  user: PermissionUser,
  action: CrmAction,
  resource?: PermissionResource
): PermissionDecision {
  if (user.role === 'superadmin') return true;

  if (action === 'ai.use') return true;
  if (action === 'ai.bulkActions') return user.role === 'manager';

  const recordAction = parseRecordAction(action);
  if (recordAction) {
    const { record, verb } = recordAction;

    if (user.role === 'outreach') {
      if (record === 'email') return verb === 'create' ? canAccessOwnOrShared(user, resource) : false;
      if (record === 'task' && (verb === 'create' || verb === 'update')) {
        return canAccessOwnOrShared(user, resource);
      }
      if (!OUTREACH_OWNED_RECORD_VERBS.has(verb)) return false;
      return verb === 'create' ? true : canAccessOwnOrShared(user, resource);
    }

    if (user.role === 'manager') {
      return verb === 'create' ? true : canAccessTeam(user, resource);
    }
  }

  if (user.role === 'manager') {
    if (MANAGER_CONFIGURE_ACTIONS.has(action)) return true;
    if (action === 'user.invite' || action === 'user.changeRole') {
      return canManageOutreachUser(resource);
    }
  }

  return false;
}
