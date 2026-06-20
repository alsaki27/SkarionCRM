# Health Checks

SkarionCRM exposes separate liveness and readiness checks on the Node API.

## Liveness

Use `/health` for uptime monitoring. It confirms the Express process is running and returns quickly without touching the database.

```bash
curl -fsS https://api.example.com/health
```

Expected status: `200`.

## Readiness

Use `/ready` for deploy gates, smoke tests, and load balancer readiness. It checks:

- Required env vars are present: `DATABASE_URL`, `JWT_SECRET`
- The API can execute a simple database query

```bash
curl -fsS https://api.example.com/ready
```

Expected status: `200` when ready, `503` when degraded.

The response reports only env presence and generic database failure text. It must not expose database URLs, passwords, JWT secrets, or provider keys.

## Troubleshooting

- Missing `DATABASE_URL`: set the Neon/Postgres connection string on the backend host.
- Missing `JWT_SECRET`: set a 32+ character production secret.
- Database degraded: verify Neon status, network access, SSL settings, and that migrations have been applied.
- Request IDs: use the `X-Request-ID` response header with backend logs when correlating health check failures.
