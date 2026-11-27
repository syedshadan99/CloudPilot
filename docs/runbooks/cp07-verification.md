# CP-07 verification runbook

1. Copy `.env.example` to a local `.env`, start PostgreSQL with `docker compose up -d db`, and verify `docker compose ps` reports healthy.
2. Run `npm run db:migrate`, `npm run db:status`, and `npm run db:seed`.
3. Build with `npm run build` and run `npm run test:phase6`. Run `npm run test:database` against the same disposable database.
4. Start the API and, when testing the scheduler, run `npm run start:worker --workspace @cloudpilot/api`.
5. Use the seeded customer to accept an offer and complete the CP-06 exact simulated payment. Wait for the VM to reach `RUNNING`; generate a deterministic usage tick.
6. Inspect `/api/v1/billing/usage`, `/api/v1/billing/charges`, `/api/v1/invoices`, `/api/v1/billing/summary`, and `/api/v1/payments`. The initial prepaid period must show usage but no duplicate recurring charge.
7. For a period outside coverage, call the billing service through the worker or a controlled development harness. Repeat the same period twice; verify one `billing_periods` row, one invoice, one ledger row per source usage, and matching invoice items.
8. Set an issued invoice due date in a disposable fixture, call the summary endpoint, and verify it becomes `overdue` without a penalty fee or VM termination.
9. Test stopped and terminated VMs: runtime is zero after the lifecycle boundary and no future compute ledger rows are created.
10. Finish with `git diff --check`, `git status --short`, and the regression commands appropriate to the current environment. Do not reset a shared database.
