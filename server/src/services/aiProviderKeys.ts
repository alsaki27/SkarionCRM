// server/src/services/aiProviderKeys.ts
// Data-access + business logic for admin-managed AI provider keys.
// All keys are encrypted at rest; only this module (and aiClient.ts, server-side
// only) ever sees a decrypted key.

import { eq, and, asc } from 'drizzle-orm';
import { db, type DB } from '../db/index.js';
import { aiProviderKeys } from '../db/schema.js';
import { encryptSecret, decryptSecret, fingerprintKey } from '../security/secretCrypto.js';

export type AiProviderKeyRow = typeof aiProviderKeys.$inferSelect;
export type AiProviderKeyMetadata = Omit<AiProviderKeyRow, 'encryptedKey'>;

function toMetadata(row: AiProviderKeyRow): AiProviderKeyMetadata {
  const { encryptedKey: _encryptedKey, ...metadata } = row;
  return metadata;
}

export async function listAiProviderKeys(orgId: string): Promise<AiProviderKeyMetadata[]> {
  const rows = await db.query.aiProviderKeys.findMany({
    where: eq(aiProviderKeys.orgId, orgId),
    orderBy: [asc(aiProviderKeys.priority), asc(aiProviderKeys.createdAt)],
  });
  return rows.map(toMetadata);
}

export async function listEnabledAiProviderKeys(orgId: string): Promise<AiProviderKeyMetadata[]> {
  const rows = await db.query.aiProviderKeys.findMany({
    where: and(eq(aiProviderKeys.orgId, orgId), eq(aiProviderKeys.isEnabled, true)),
    orderBy: [asc(aiProviderKeys.priority), asc(aiProviderKeys.createdAt)],
  });
  return rows.map(toMetadata);
}

export async function getAiProviderKeyDecrypted(
  orgId: string,
  id: string
): Promise<(AiProviderKeyRow & { decryptedKey: string }) | null> {
  const row = await db.query.aiProviderKeys.findFirst({
    where: and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)),
  });
  if (!row) return null;
  return { ...row, decryptedKey: decryptSecret(row.encryptedKey) };
}

export interface CreateAiProviderKeyInput {
  orgId: string;
  provider: string;
  label: string;
  apiKey: string;
  baseUrl?: string | null;
  priority?: number;
  isEnabled?: boolean;
  createdBy?: string | null;
}

export async function createAiProviderKey(
  input: CreateAiProviderKeyInput
): Promise<AiProviderKeyMetadata> {
  const [row] = await db
    .insert(aiProviderKeys)
    .values({
      orgId: input.orgId,
      provider: input.provider,
      label: input.label,
      baseUrl: input.baseUrl ?? null,
      encryptedKey: encryptSecret(input.apiKey),
      keyFingerprint: fingerprintKey(input.apiKey),
      priority: input.priority ?? 100,
      isEnabled: input.isEnabled ?? true,
      status: 'unknown',
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return toMetadata(row);
}

export interface UpdateAiProviderKeyInput {
  label?: string;
  baseUrl?: string | null;
  priority?: number;
  isEnabled?: boolean;
  apiKey?: string;
}

export async function updateAiProviderKey(
  orgId: string,
  id: string,
  input: UpdateAiProviderKeyInput
): Promise<AiProviderKeyMetadata | null> {
  const updates: Partial<typeof aiProviderKeys.$inferInsert> = { updatedAt: new Date() };
  if (input.label !== undefined) updates.label = input.label;
  if (input.baseUrl !== undefined) updates.baseUrl = input.baseUrl;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
  if (input.apiKey !== undefined) {
    updates.encryptedKey = encryptSecret(input.apiKey);
    updates.keyFingerprint = fingerprintKey(input.apiKey);
  }

  const [row] = await db
    .update(aiProviderKeys)
    .set(updates)
    .where(and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)))
    .returning();
  return row ? toMetadata(row) : null;
}

/** Soft-disable rather than hard-delete, so usage history/audit trail survives. */
export async function disableAiProviderKey(
  orgId: string,
  id: string
): Promise<AiProviderKeyMetadata | null> {
  const [row] = await db
    .update(aiProviderKeys)
    .set({ isEnabled: false, status: 'disabled', updatedAt: new Date() })
    .where(and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)))
    .returning();
  return row ? toMetadata(row) : null;
}

export async function deleteAiProviderKey(orgId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(aiProviderKeys)
    .where(and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)))
    .returning({ id: aiProviderKeys.id });
  return result.length > 0;
}

export async function recordAiProviderKeySuccess(orgId: string, id: string, _db: DB = db): Promise<void> {
  await _db
    .update(aiProviderKeys)
    .set({
      status: 'working',
      lastSuccessAt: new Date(),
      lastTestedAt: new Date(),
      usageCount: (await currentUsageCount(orgId, id, _db)) + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)));
}

export async function recordAiProviderKeyFailure(
  orgId: string,
  id: string,
  error: string,
  _db: DB = db
): Promise<void> {
  await _db
    .update(aiProviderKeys)
    .set({
      status: 'failing',
      lastFailureAt: new Date(),
      lastTestedAt: new Date(),
      lastError: error,
      failureCount: (await currentFailureCount(orgId, id, _db)) + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)));
}

async function currentUsageCount(orgId: string, id: string, _db: DB): Promise<number> {
  const row = await _db.query.aiProviderKeys.findFirst({
    where: and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)),
    columns: { usageCount: true },
  });
  return row?.usageCount ?? 0;
}

async function currentFailureCount(orgId: string, id: string, _db: DB): Promise<number> {
  const row = await _db.query.aiProviderKeys.findFirst({
    where: and(eq(aiProviderKeys.id, id), eq(aiProviderKeys.orgId, orgId)),
    columns: { failureCount: true },
  });
  return row?.failureCount ?? 0;
}
