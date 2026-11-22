# CP-05 negotiation and offers verification runbook

CP-05 adds migration `0009_negotiation_offer_lifecycle.sql`. Never edit an
applied migration. Apply it only to a disposable or approved development
database:

```powershell
npm run db:migrate
npm run db:status
npm run db:seed
npm run db:seed
npm run test:unit
npm run build
```

The second seed run checks repeat-safe seed behavior. Live PostgreSQL
integration and HTTP tests must use a disposable PostgreSQL 17 database with
`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` and `PGPASSWORD` available to the
Node.js process. The root Compose file does not publish the database port; use
an uncommitted local Compose override or run the API inside Compose. Do not
print credentials or reset a shared volume.

## Manual workflow

1. Authenticate an active customer and create an owned negotiation chat session.
2. `POST /api/v1/negotiations` with an idempotency key and a template or valid
   custom configuration.
3. Verify the offer contains the complete configuration and exact base,
   discount and final-price snapshot, plus pricing/policy references.
4. Repeat the same request with the same key and verify no second attempt or
   offer is created.
5. Submit a counter request. Verify the previous offer is `countered`, the
   successor has `parent_offer_id`, and only one actionable offer exists.
6. Request terms below the automatic approval threshold but above the floor.
   Verify `pending_provider_review`, then approve/reject as an organization
   member and inspect `offer_approvals` and `offer_events`.
7. Advance `expires_at` in a disposable database or use a controlled test
   clock, then verify customer/provider actions reject the stale offer even
   before the worker runs.
8. Run the worker and verify expired rows, chat-session linkage and events are
   reconciled. Run it again and verify no duplicate expiry events.

## Recovery and concurrency

The worker runs a bounded batch using PostgreSQL row locks and
`FOR UPDATE SKIP LOCKED`. After downtime, overdue offers are already excluded
by service eligibility checks; the next worker tick reconciles their durable
status. If two workers run together, one locks each row and the other skips or
observes the terminal update.

The lock order for negotiation commands is idempotency key, chat session, then
current offer. Provider decisions lock the offer after organization membership
has been checked. CP-06 must lock the offer before checking or inserting the
unique `orders.offer_id` row. This prevents conflicting counter, review,
expiry and future acceptance outcomes.

## CP-06 acceptance contract

CP-06 must call `OffersService.assertAcceptanceEligibility` inside one
PostgreSQL transaction, then lock the offer, recheck expiry and state, insert
exactly one order using the persisted snapshot, append the offer/order events,
and issue/reuse exactly one initial invoice. Only after payment verification
may provisioning become eligible. CP-05 intentionally does not mark an offer
accepted, create an order, issue an invoice, verify payment or provision a VM.
