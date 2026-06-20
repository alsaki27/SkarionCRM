import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter, rateLimitOptionsFromEnv, rateLimitTarget } from './rateLimit.js';

function mockResponse() {
  return {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: null as unknown,
    setHeader: vi.fn(function (this: ReturnType<typeof mockResponse>, key: string, value: string) {
      this.headers.set(key, value);
    }),
    status: vi.fn(function (this: ReturnType<typeof mockResponse>, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: ReturnType<typeof mockResponse>, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

function mockRequest(originalUrl: string, headers: Record<string, string> = {}) {
  return {
    originalUrl,
    url: originalUrl,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    header: (name: string) => headers[name.toLowerCase()],
  };
}

describe('rate limiting', () => {
  it('classifies sensitive tRPC procedures', () => {
    expect(rateLimitTarget('/trpc/auth.login').sensitive).toBe(true);
    expect(rateLimitTarget('/trpc/chat.sendMessage?batch=1').sensitive).toBe(true);
    expect(rateLimitTarget('/trpc/contact.list').sensitive).toBe(false);
  });

  it('uses safe defaults from env', () => {
    const previous = {
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
      SENSITIVE_RATE_LIMIT_MAX: process.env.SENSITIVE_RATE_LIMIT_MAX,
    };
    process.env.RATE_LIMIT_WINDOW_MS = 'bad';
    process.env.RATE_LIMIT_MAX = '-1';
    process.env.SENSITIVE_RATE_LIMIT_MAX = '10';

    expect(rateLimitOptionsFromEnv()).toEqual({
      windowMs: 60_000,
      max: 300,
      sensitiveMax: 10,
    });

    process.env.RATE_LIMIT_WINDOW_MS = previous.RATE_LIMIT_WINDOW_MS;
    process.env.RATE_LIMIT_MAX = previous.RATE_LIMIT_MAX;
    process.env.SENSITIVE_RATE_LIMIT_MAX = previous.SENSITIVE_RATE_LIMIT_MAX;
  });

  it('allows requests under the limit and emits rate limit headers', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 2, sensitiveMax: 1, now: () => 0 });
    const res = mockResponse();
    const next = vi.fn();

    limiter(mockRequest('/trpc/contact.list') as never, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers.get('RateLimit-Limit')).toBe('2');
    expect(res.headers.get('RateLimit-Remaining')).toBe('1');
  });

  it('blocks requests over the sensitive limit', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 5, sensitiveMax: 1, now: () => 0 });
    const first = mockResponse();
    const second = mockResponse();

    limiter(mockRequest('/trpc/auth.login') as never, first as never, vi.fn());
    limiter(mockRequest('/trpc/auth.login') as never, second as never, vi.fn());

    expect(second.status).toHaveBeenCalledWith(429);
    expect(second.headers.get('Retry-After')).toBe('1');
    expect(second.body).toEqual({ error: 'Too many requests', retryAfterSeconds: 1 });
  });

  it('uses Cloudflare client IP when available', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1, sensitiveMax: 1, now: () => 0 });
    const nextA = vi.fn();
    const nextB = vi.fn();

    limiter(
      mockRequest('/trpc/contact.list', { 'cf-connecting-ip': '203.0.113.10' }) as never,
      mockResponse() as never,
      nextA
    );
    limiter(
      mockRequest('/trpc/contact.list', { 'cf-connecting-ip': '203.0.113.11' }) as never,
      mockResponse() as never,
      nextB
    );

    expect(nextA).toHaveBeenCalledOnce();
    expect(nextB).toHaveBeenCalledOnce();
  });
});
