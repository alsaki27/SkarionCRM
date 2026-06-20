import { sql } from 'drizzle-orm';
import type { DB } from '../db/index.js';

export type HealthStatus = 'ok' | 'degraded';

export interface EnvPresenceCheck {
  name: string;
  present: boolean;
}

export interface DatabaseReadinessCheck {
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
}

export interface ReadinessReport {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: DatabaseReadinessCheck;
    env: EnvPresenceCheck[];
  };
}

export const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function checkEnvPresence(names: readonly string[] = REQUIRED_ENV): EnvPresenceCheck[] {
  return names.map((name) => ({
    name,
    present: Boolean(process.env[name]?.trim()),
  }));
}

export async function checkDatabase(db: Pick<DB, 'execute'>, now = Date.now): Promise<DatabaseReadinessCheck> {
  const startedAt = now();

  try {
    await db.execute(sql`select 1`);
    return {
      status: 'ok',
      latencyMs: Math.max(0, now() - startedAt),
    };
  } catch {
    return {
      status: 'degraded',
      error: 'Database connectivity check failed',
    };
  }
}

export async function buildReadinessReport(
  db: Pick<DB, 'execute'>,
  options: {
    now?: () => number;
    timestamp?: () => string;
    requiredEnv?: readonly string[];
  } = {}
): Promise<ReadinessReport> {
  const env = checkEnvPresence(options.requiredEnv);
  const database = await checkDatabase(db, options.now);
  const status: HealthStatus = database.status === 'ok' && env.every((check) => check.present) ? 'ok' : 'degraded';

  return {
    status,
    timestamp: options.timestamp?.() ?? new Date().toISOString(),
    checks: {
      database,
      env,
    },
  };
}

export function readinessStatusCode(report: Pick<ReadinessReport, 'status'>): 200 | 503 {
  return report.status === 'ok' ? 200 : 503;
}
