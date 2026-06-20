import { describe, expect, it, vi } from 'vitest';
import { parseAllowedOrigins, securityHeaders } from './securityHeaders.js';

describe('security headers', () => {
  it('parses a single CORS origin', () => {
    expect(parseAllowedOrigins('https://crm.skarion.com')).toBe('https://crm.skarion.com');
  });

  it('parses comma-separated CORS origins', () => {
    expect(parseAllowedOrigins('https://crm.skarion.com, http://localhost:5173')).toEqual([
      'https://crm.skarion.com',
      'http://localhost:5173',
    ]);
  });

  it('sets defensive API headers without HSTS outside production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const setHeader = vi.fn();
    const next = vi.fn();

    securityHeaders()({} as never, { setHeader } as never, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    );
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String)
    );
    expect(next).toHaveBeenCalledOnce();

    process.env.NODE_ENV = previousNodeEnv;
  });

  it('sets HSTS in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const setHeader = vi.fn();

    securityHeaders()({} as never, { setHeader } as never, vi.fn());

    expect(setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );

    process.env.NODE_ENV = previousNodeEnv;
  });
});
