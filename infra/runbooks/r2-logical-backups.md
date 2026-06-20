# R2 Logical Backup Runbook

This repo includes `.github/workflows/neon-backup.yml`, a manual and weekly GitHub Actions workflow that creates a compressed `pg_dump` custom-format backup and uploads it to Cloudflare R2.

Logical backups are not a replacement for Neon PITR. Use them for weekly offline retention, audits, and dev/staging restore drills.

## Required GitHub Secrets

Configure these in GitHub repository settings:

- `BACKUP_DATABASE_URL`: Neon production or staging database URL with read access.
- `R2_ACCOUNT_ID`: Cloudflare account ID.
- `R2_BACKUP_BUCKET`: R2 bucket name, for example `skarion-db-backups`.
- `R2_ACCESS_KEY_ID`: R2 S3 access key ID.
- `R2_SECRET_ACCESS_KEY`: R2 S3 secret access key.

Use a database role with the minimum permissions needed to dump the app schemas.

## Running a Backup

Manual:

1. Go to GitHub Actions.
2. Select `Neon logical backup to R2`.
3. Click `Run workflow`.
4. Optionally provide a label such as `before-release`.

Scheduled:

- Runs every Sunday at 06:00 UTC.

The workflow uploads:

- `neon-logical/skarion-YYYYMMDDTHHMMSSZ.dump`
- `neon-logical/skarion-YYYYMMDDTHHMMSSZ.dump.sha256`

## Restore Drill

Restore into a non-production database first:

```bash
createdb skarion_restore_test
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges skarion-YYYYMMDDTHHMMSSZ.dump
```

Verify:

```bash
psql "$RESTORE_DATABASE_URL" -c "select count(*) from organizations;"
psql "$RESTORE_DATABASE_URL" -c "select count(*) from users;"
```

Then point a staging backend at the restored database and smoke test login, dashboard, contacts, financial routes, and AI settings.

## Retention

Recommended R2 lifecycle rule:

- Keep weekly logical backups for 90 days.
- Keep checksum files for the same duration.

For compliance needs beyond 90 days, create a separate locked-retention bucket or Cloudflare object lifecycle policy.

## Safety Notes

- Never restore a logical backup directly over production without a written incident plan.
- Prefer Neon PITR for exact timestamp recovery.
- Do not print `DATABASE_URL`, R2 secrets, or dump contents in logs.
- Treat backup objects as sensitive production data.
