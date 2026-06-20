# Security Hardening Runbook

This runbook tracks production security controls for the current Cloudflare Pages + Node API + Neon deployment path.

## HTTP Headers

The Node API sets defensive headers in `server/src/security/securityHeaders.ts`:

- `Content-Security-Policy` for API responses: `default-src 'none'`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` denying camera, geolocation, and microphone.
- `Strict-Transport-Security` in production.

Cloudflare Pages serves SPA headers from `client/public/_headers`. The CSP allows same-origin scripts, inline styles for the current React/Vite UI, HTTPS API calls, and localhost dev calls.

## CORS

Set `APP_URL` on the API host to the exact Cloudflare Pages/custom domain origin.

For temporary multi-origin deployments, use a comma-separated list:

```env
APP_URL=https://crm.skarion.com,https://skarion-crm.pages.dev
```

Do not use `*` in production.

## Cloudflare Controls

Recommended dashboard settings:

1. Enable the Cloudflare managed WAF ruleset.
2. Add a rate-limit rule for `/trpc/auth.login`, `/trpc/auth.register`, and AI/chat routes once final paths are stable.
3. Keep Bot Fight Mode or equivalent bot controls enabled where it does not block real users.
4. Require HTTPS and automatic HTTPS rewrites.
5. Review Pages preview deployments before exposing them to customers.

## API Rate Limiting

The Node API applies an in-memory per-client/per-procedure limiter before `/trpc`.

Environment variables:

```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
SENSITIVE_RATE_LIMIT_MAX=30
```

Sensitive procedures currently include login/register/password reset, chat messages, and AI provider key tests. The limiter honors `CF-Connecting-IP` and `X-Forwarded-For`, and the Express app trusts one proxy hop for Cloudflare/platform deployments.

For multi-instance API deployments, this in-memory limiter should be backed by a shared store or replaced with platform-native Cloudflare/host rate limits.

## Secrets

- Keep `.env`, `.env.local`, database URLs, AI keys, JWT secrets, and R2 keys out of git.
- Rotate `JWT_SECRET` quarterly or immediately after suspected exposure.
- Rotate `AI_KEYS_ENCRYPTION_SECRET` only with a migration plan for existing encrypted provider keys.
- Prefer platform secret managers: Cloudflare, Railway, Render, Fly, or GitHub Actions secrets.

## Verification

After deploy:

```bash
curl -I https://api.example.com/health
curl -I https://crm.example.com/
```

Confirm security headers are present and CORS only allows the configured frontend origin.
