import { describe, expect, it, vi } from 'vitest';
import {
  buildReadinessReport,
  checkDatabase,
  checkEnvPresence,
  readinessStatusCode,
} from './health.js';

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));

  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

describe('health readiness checks', () => {
  it('reports required env presence without exposing values', () => {
    withEnv({ DATABASE_URL: 'postgres://secret@example/db', JWT_SECRET: undefined }, () => {
      expect(checkEnvPresence()).toEqual([
        { name: 'DATABASE_URL', present: true },
        { name: 'JWT_SECRET', present: false },
      ]);
    });
  });

  it('checks database connectivity and records latency', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(117);

    await expect(checkDatabase({ execute } as never, now)).resolves.toEqual({
      status: 'ok',
      latencyMs: 17,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('returns a generic database error on readiness failure', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('password=super-secret host=db.example.com'));

    await expect(checkDatabase({ execute } as never)).resolves.toEqual({
      status: 'degraded',
      error: 'Database connectivity check failed',
    });
  });

  it('combines database and env checks into a readiness report', async () => {
    const execute = vi.fn().mockResolvedValue([]);

    await expect(
      buildReadinessReport(
        { execute } as never,
        {
          now: () => 1,
          timestamp: () => '2026-06-20T00:00:00.000Z',
          requiredEnv: ['DATABASE_URL'],
        }
      )
    ).resolves.toEqual({
      status: process.env.DATABASE_URL?.trim() ? 'ok' : 'degraded',
      timestamp: '2026-06-20T00:00:00.000Z',
      checks: {
        database: { status: 'ok', latencyMs: 0 },
        env: [{ name: 'DATABASE_URL', present: Boolean(process.env.DATABASE_URL?.trim()) }],
      },
    });
  });

  it('maps readiness status to HTTP status codes', () => {
    expect(readinessStatusCode({ status: 'ok' })).toBe(200);
    expect(readinessStatusCode({ status: 'degraded' })).toBe(503);
  });
});
