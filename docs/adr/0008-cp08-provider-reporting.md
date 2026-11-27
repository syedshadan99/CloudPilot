# ADR 0008: CP-08 provider reporting and deal review

## Status

Accepted for CP-08.

## Decisions

1. Provider access requires both a global provider role and active membership in the requested active organization. Organization-local `owner/admin/member` membership is separate from `provider_admin/provider_staff`. Only provider administrators with owner/admin membership can create a manual deal revision.
2. Reporting reads authoritative PostgreSQL rows directly. No cache, ORM, queue, or second offer state machine is introduced.
3. Invoiced amounts, verified simulated payments, outstanding balances and usage/ledger charges remain separate metrics. The API does not label invoice totals as recognized revenue.
4. Financial results are grouped by currency. Shared recurring invoices are represented by provider-owned charge-line allocations. Their header balance is allocated proportionally for outstanding/overdue display, while payment settlement is not attributed because the schema has no payment-allocation rows.
5. Pricing history reads retained pricing versions/rules and offer/order references. Active and retired records are not rewritten by reporting. Intermediate field-edit history is not fabricated.
6. A manual override is an immutable successor `offers` row linked with `parent_offer_id`. The source offer becomes `countered`; existing orders and invoices are untouched; the customer must confirm the successor via CP-06. The existing CP-05 approval/rejection routes remain the only provider-review state transition endpoints.
7. Detail lists use bounded page/offset pagination with deterministic timestamp/UUID ordering to preserve the existing API convention. Report windows are UTC half-open intervals and are capped at 366 days.
8. Deal transcripts return only persisted `user` and `assistant` chat messages linked to the authorized offer. System messages and unrelated sessions are excluded.

## Trade-offs and deferred scope

The current schema does not persist payment allocation across shared recurring invoices, so the API exposes the limitation instead of inventing a split. It also has no approved cost-basis table, so margins are `null`. Historical VM state charts require a future event-snapshot model; current state is not projected backward into history.
