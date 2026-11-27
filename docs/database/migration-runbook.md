# Database migration and seed runbook

## Prerequisites

- Node.js 24 and npm 11 as required by the root `package.json`.
- PostgreSQL 17 (the repository Compose service uses `postgres:17-bookworm`).
- `npm ci` from the repository root.
- Environment variables `DATABASE_URL`, or `PGHOST`, `PGPORT`, `PGDATABASE`,
  `PGUSER`, and `PGPASSWORD`.

The commands below were verified against an isolated PostgreSQL 17 container on
2026-11-21. They do not require a repository `.env` file.

## Fresh local setup

```powershell
npm ci
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'cloudpilot'
$env:PGUSER = 'cloudpilot'
$env:PGPASSWORD = '<local-development-password>'
npm run db:migrate
npm run db:status
```

`db:migrate` creates the `schema_migrations` tracking table, takes a PostgreSQL
advisory lock, applies ordered SQL files transactionally, records SHA-256
checksums and refuses missing files or checksum drift. A failed migration is
rolled back and is not marked applied. The first three committed migrations
contain their own transaction wrappers; the runner strips only those outer
wrappers so DDL and tracking are committed atomically.

## Demo seed

```powershell
$env:NODE_ENV = 'development'
npm run db:seed
```

The seed is synthetic and deterministic. It creates provider/customer demo
accounts, four catalog templates, pricing/policy examples, conversations,
accepted and review offers, paid orders, invoices, simulated payments,
running/stopped/failed VMs, usage/ledger rows, upgrade history, support,
notifications, audit, idempotency and outbox examples. Re-running it is safe;
stable UUIDs and scoped uniqueness prevent uncontrolled duplicates.

The demo users use the non-production phrase `cloudpilot-demo-only` solely to
generate a bcrypt-compatible hash through `pgcrypto`. Never use or advertise
these accounts in production. The seed command refuses `NODE_ENV=production`.

## Status and verification

```powershell
npm run db:status
npm run test:database
npm run build
```

The integration tests require the migrated and seeded database. They verify
tracking, required tables, foreign keys, check constraints, overlapping usage
rejection, one initial invoice per order, payment-gated order states, invoice
reconciliation, seed counts and important indexes.

## Safe recovery

Do not drop schemas or volumes in normal migration/seed commands. If a
migration fails, inspect the PostgreSQL error, fix forward with a new numbered
migration, and rerun `npm run db:migrate`. Never edit an applied migration.

For a disposable local/test database, the explicit reset command can recreate
the public schema, run all migrations and seed the demo data:

```powershell
$env:NODE_ENV = 'test'
$env:CLOUDPILOT_CONFIRM_RESET = 'CLOUDPILOT_RESET'
npm run db:reset
```

The command refuses production and refuses to run without the exact
confirmation variable. It is still destructive; verify the connection points
only at the intended disposable database before invoking it.

For an isolated disposable test database only, stop the test client and reset
that explicitly named database/schema using the database administrator’s
approved procedure. Do not run it against a shared or production database.

## Adding a future migration

1. Add the next zero-padded file under `database/migrations/`, for example
   `0008_add_feature.sql`.
2. Use explicit DDL and named constraints; do not hide drift with blanket
   `IF NOT EXISTS` clauses.
3. Keep the migration transactional unless PostgreSQL requires a
   non-transactional operation; document that exception in the file and runbook.
4. Never rewrite or delete an applied migration. An un-applied duplicate file
   may be removed from the runnable directory only when its functionality is
   already provided by the canonical history and its Git history is preserved;
   add any genuinely missing behavior as a new migration.
5. Run fresh migration, repeat migration, seed twice, integration tests and
   the backend build before opening the PR.

CP-07 uses `0011_cp07_billing_periods.sql`. It is additive, preserves the
applied `0001`-`0010` checksums, and adds the durable recurring-period key,
usage rating timestamp, and deterministic ledger source key. Confirm it with
`npm run db:status` before running billing integration tests.
