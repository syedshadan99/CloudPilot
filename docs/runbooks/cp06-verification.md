# CP-06 verification runbook

## Preconditions

Use a disposable development database. Start Docker Desktop and the PostgreSQL service. If Windows host access is needed, create the ignored local `compose.local.yaml` override with `127.0.0.1:5432:5432`; do not commit it. Copy `.env.example` to `.env` and use local-only credentials.

```powershell
docker compose up -d db
npm run db:migrate
npm run db:status
npm run db:seed
```

The migration runner must report versions `0001` through `0010` applied with no checksum drift. The seed command is repeatable and must not be run against important data.

## Build and tests

```powershell
npm run test:unit
npm run test:database
npm run test:phase5
npm run build
docker compose config --quiet
git diff --check
```

`test:phase5` includes CP-06 unit tests, PostgreSQL integration tests, and the HTTP test. The HTTP test requires a running API and `CP06_E2E_BASE_URL`; without it the test is reported as skipped, not passed.

## First-demo flow

1. Start the API with the seeded environment.
2. Log in as `customer.demo@cloudpilot.invalid` using the demo-only password.
3. Create a fresh eligible offer through the negotiation endpoint, then `POST /api/v1/offers/:id/confirm` with a unique `Idempotency-Key` plus the session CSRF header.
4. Verify one `orders` row, one `initial_order` invoice, line items summing to the header total, one `held` reservation, `pending_payment`, and the acceptance/order/audit/outbox records.
5. Repeat confirmation with the same key and then another valid key; both return the original order/invoice without duplicates.
6. Submit `POST /api/v1/payments/simulated` with the persisted invoice total and currency. The response must say the payment was verified in the CloudPilot simulation; the invoice becomes `paid`, the order `payment_verified`, the reservation `committed`, and provisioning eligibility timestamps are set.
7. Submit a wrong currency, underpayment, overpayment, forged `success`, or forged `paymentStatus`; each is rejected or recorded as failed and leaves provisioning locked.
8. Provider job creation accepts only the persisted order ID. It ignores removed customer/configuration fields, requires provider organization membership, and rejects unpaid orders. Worker execution repeats the same authoritative payment check.

## Recovery checks

Kill the client after a successful request and retry. The idempotency row or unique business key must return the committed result. A failed invoice insert must leave no order, reservation, invoice, or acceptance event. A failed payment must leave the invoice unpaid and the order in `pending_payment`. A provisioning failure must not rewrite the verified payment into an active VM state.
