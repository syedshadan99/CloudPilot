# CloudPilot database assets

This folder contains the SQL-first PostgreSQL source of truth for CloudPilot.

- `migrations/` contains ordered, checksum-tracked schema changes.
- `seeds/` contains deterministic local/demo data; it is never enabled for production.

The migration and seed commands are implemented in `scripts/database.mjs`:

```powershell
npm run db:migrate
npm run db:status
npm run db:seed # development/test only
```

Set `DATABASE_URL` or the standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and
`PGPASSWORD` variables before running the commands. NestJS connection and
health-check code stays in `apps/api/src/database/`. No ORM is selected for this
project.

See [`docs/database/README.md`](../docs/database/README.md) for the architecture,
[`docs/database/erd.md`](../docs/database/erd.md) for the implemented diagrams,
and [`docs/database/migration-runbook.md`](../docs/database/migration-runbook.md)
for verified setup and recovery commands.
