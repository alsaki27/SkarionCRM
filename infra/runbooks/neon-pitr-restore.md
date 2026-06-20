# Neon PITR Restore Runbook

Use this for a true point-in-time rollback or investigation. Prefer Neon PITR over logical dumps when you need the database state as of an exact time.

## When to Use

- Bad migration reached production.
- Accidental destructive update/delete.
- Suspected data corruption.
- Need a forensic copy of production at a past timestamp.

## Preconditions

- Neon PITR is enabled for the production project.
- You know the approximate UTC timestamp to restore to.
- Production deploys are paused while you investigate.
- At least one person owns user/customer communication during the incident.

## Restore to a Branch

1. Open Neon Console.
2. Select the production project.
3. Go to Branches.
4. Create a branch from the production branch using the target point in time.
5. Name it with an incident-friendly label, for example `restore-2026-06-20-incident-123`.
6. Wait for the branch to become available.
7. Copy its connection string.

## Verify the Restored Branch

Run checks from a safe machine:

```bash
psql "$RESTORE_DATABASE_URL" -c "select now();"
psql "$RESTORE_DATABASE_URL" -c "select count(*) from organizations;"
psql "$RESTORE_DATABASE_URL" -c "select count(*) from users;"
```

Then point a staging backend at `RESTORE_DATABASE_URL` and smoke test:

- Login.
- Dashboard load.
- Contacts list.
- Financial list/report that was involved in the incident.
- Any affected AI/settings routes.

## Promote or Repair

Choose one path:

- Promote the restored branch if the whole production database must roll back.
- Export selected repaired data from the restored branch and apply a narrow fix to production if only a small dataset was affected.

Do not promote until the restored branch has been smoke tested and the team agrees on data loss implications.

## After Restore

1. Rotate any credentials that may have been exposed during the incident.
2. Re-run migrations against the restored branch if needed.
3. Re-enable deploys.
4. Record the restore timestamp, branch name, verification steps, and decision in the incident log.
5. Add a regression test or migration guard for the root cause.
