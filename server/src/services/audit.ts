import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import type { auditActionEnum } from '../db/schema.js';

export interface AuditEntry {
  orgId: string;
  userId?: string;
  action: typeof auditActionEnum.enumValues[number];
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    await db.insert(auditLog).values({
      orgId: entry.orgId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValues: entry.oldValues || {},
      newValues: entry.newValues || {},
      ipAddress: entry.ipAddress ? entry.ipAddress as any : null,
      userAgent: entry.userAgent,
      metadata: entry.metadata || {},
    });
  }

  async logCreate(
    orgId: string,
    userId: string | undefined,
    entityType: string,
    entityId: string,
    newValues: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      orgId,
      userId,
      action: 'create',
      entityType,
      entityId,
      newValues,
      ipAddress,
    });
  }

  async logUpdate(
    orgId: string,
    userId: string | undefined,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      orgId,
      userId,
      action: 'update',
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress,
    });
  }

  async logDelete(
    orgId: string,
    userId: string | undefined,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      orgId,
      userId,
      action: 'delete',
      entityType,
      entityId,
      oldValues,
      ipAddress,
    });
  }

  async logLogin(
    orgId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      orgId,
      userId,
      action: 'login',
      entityType: 'user',
      entityId: userId,
      ipAddress,
      userAgent,
    });
  }
}

export const auditService = new AuditService();
