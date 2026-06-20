import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  sensitiveMax: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const SENSITIVE_PROCEDURES = [
  'auth.login',
  'auth.register',
  'auth.forgotPassword',
  'auth.resetPassword',
  'chat.sendMessage',
  'aiKeys.test',
];

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitOptionsFromEnv(): RateLimitOptions {
  return {
    windowMs: readPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: readPositiveInt(process.env.RATE_LIMIT_MAX, 300),
    sensitiveMax: readPositiveInt(process.env.SENSITIVE_RATE_LIMIT_MAX, 30),
  };
}

export function rateLimitTarget(url: string): { name: string; sensitive: boolean } {
  const cleanUrl = url.split('?')[0] ?? url;
  const match = cleanUrl.match(/\/trpc\/([^/?]+)/);
  const procedure = decodeURIComponent(match?.[1] ?? 'trpc');
  return {
    name: procedure,
    sensitive: SENSITIVE_PROCEDURES.includes(procedure),
  };
}

function clientKey(req: Parameters<RequestHandler>[0]): string {
  const cloudflareIp = req.header('cf-connecting-ip');
  const forwardedFor = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return cloudflareIp || forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  return (req, res, next) => {
    const target = rateLimitTarget(req.originalUrl || req.url);
    const limit = target.sensitive ? options.sensitiveMax : options.max;
    const time = now();
    const key = `${clientKey(req)}:${target.name}`;
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > time
        ? existing
        : { count: 0, resetAt: time + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(limit - bucket.count, 0);
    const resetSeconds = Math.ceil(bucket.resetAt / 1000);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > limit) {
      const retryAfter = Math.max(Math.ceil((bucket.resetAt - time) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    next();
  };
}
