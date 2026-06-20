// packages/db-kit/src/audit.ts
//
// withAudit() writes one row to whichever audit_log-shaped table you pass it.
// Each Postgres schema (identity, crm, hr, books) owns its own audit_log
// table (per the spec), so this helper takes the table as a parameter rather
// than importing a single hardcoded schema — keeps db-kit schema-agnostic.

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  app?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Minimal shape any "audit_log" Drizzle table must satisfy to be usable here.
 * Concrete schemas (identity.audit_log, crm.audit_log, ...) should match this.
 */
export interface AuditLogTable {
  actorUserId: unknown;
  action: unknown;
  resourceType: unknown;
  resourceId: unknown;
  before: unknown;
  after: unknown;
  app?: unknown;
  ip?: unknown;
  userAgent?: unknown;
}

// Drizzle's real `db.insert` is itself generic (`insert<TTable extends PgTable>(table: TTable)`),
// which a non-generic method signature can't structurally match exactly - `table: any` here
// keeps this loose on purpose. Callers still get full type safety on `entry` (AuditEntry) and
// on `auditTable` (whatever real Drizzle table type they pass in).
export interface InsertableDb {
  insert(table: any): { values(v: Record<string, unknown>): Promise<unknown> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function withAudit<TTable extends AuditLogTable>(
  db: InsertableDb,
  auditTable: TTable,
  entry: AuditEntry
): Promise<void> {
  await db.insert(auditTable).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    app: entry.app ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  });
}
