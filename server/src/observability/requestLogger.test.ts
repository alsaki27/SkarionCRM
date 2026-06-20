import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { requestLogger } from './requestLogger.js';

function mockResponse() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    statusCode: 200,
    headers: new Map<string, string>(),
    setHeader: vi.fn(function (this: ReturnType<typeof mockResponse>, key: string, value: string) {
      this.headers.set(key, value);
    }),
  });
}

function mockRequest(headers: Record<string, string> = {}) {
  return {
    method: 'GET',
    originalUrl: '/health',
    url: '/health',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  };
}

describe('request logger', () => {
  it('sets an existing request id on the response and logs completion', () => {
    const previous = process.env.REQUEST_LOGGING_ENABLED;
    process.env.REQUEST_LOGGING_ENABLED = 'true';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = mockResponse();
    const next = vi.fn();

    requestLogger(() => 1_000)(
      mockRequest({ 'x-request-id': 'req-123', 'user-agent': 'vitest' }) as never,
      res as never,
      next
    );
    res.statusCode = 204;
    res.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers.get('X-Request-ID')).toBe('req-123');
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      event: 'http_request',
      requestId: 'req-123',
      method: 'GET',
      path: '/health',
      statusCode: 204,
      userAgent: 'vitest',
    });

    log.mockRestore();
    process.env.REQUEST_LOGGING_ENABLED = previous;
  });

  it('does not log when request logging is disabled', () => {
    const previous = process.env.REQUEST_LOGGING_ENABLED;
    process.env.REQUEST_LOGGING_ENABLED = 'false';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = mockResponse();

    requestLogger(() => 1_000)(mockRequest() as never, res as never, vi.fn());
    res.emit('finish');

    expect(log).not.toHaveBeenCalled();

    log.mockRestore();
    process.env.REQUEST_LOGGING_ENABLED = previous;
  });
});
