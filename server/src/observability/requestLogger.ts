import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export interface RequestLogEvent {
  level: 'info';
  event: 'http_request';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string;
  ip?: string;
}

function isRequestLoggingEnabled(): boolean {
  return process.env.REQUEST_LOGGING_ENABLED !== 'false';
}

function requestIdFromHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || randomUUID();
  return value || randomUUID();
}

export function requestLogger(now: () => number = Date.now): RequestHandler {
  return (req, res, next) => {
    const start = now();
    const requestId = requestIdFromHeader(req.headers['x-request-id']);
    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
      if (!isRequestLoggingEnabled()) return;

      const logEvent: RequestLogEvent = {
        level: 'info',
        event: 'http_request',
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Math.max(now() - start, 0),
        userAgent: req.header('user-agent') || undefined,
        ip: req.header('cf-connecting-ip') || req.ip || req.socket.remoteAddress,
      };

      console.log(JSON.stringify(logEvent));
    });

    next();
  };
}
