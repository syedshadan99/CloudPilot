# CP-04 verification runbook

The implementation reuses migrations `0001` through `0008`; no SQL migration
was added. Apply the existing schema and deterministic demo seed to a
disposable PostgreSQL 17 database before running database tests:

```powershell
npm run db:migrate
npm run db:seed
npm run db:seed
npm run db:status
npm run test:database
```

The second seed run checks the existing idempotent seed behavior. The database
integration checks assert the seeded 128 CPU / 512 GB RAM / 10000 GB storage
pool has 4 CPU / 8 GB RAM / 100 GB in two committed reservations, keeps the
accepted order at `44.0000 USD`, and preserves pricing-rule uniqueness.

Run pure and regression tests with:

```powershell
npm run test:unit
npm run build
```

The local Docker Compose file does not publish PostgreSQL to the host by
default. If the API runs outside Compose, use a local-only, uncommitted
connection setting or a disposable PostgreSQL instance and never commit its
credentials. Do not use `db:reset` against shared data.

## Later reservation contract

CP-04 only performs a read-time availability check. The later order/provisioning
transaction must lock the selected `capacity_pools` row, recalculate committed
and unexpired-held usage, insert or promote exactly one reservation, and commit
the order/reservation together. A successful CP-04 availability response is a
snapshot and does not reserve capacity.
