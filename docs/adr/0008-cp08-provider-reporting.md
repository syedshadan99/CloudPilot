# ADR 0008: CP-08 provider reporting and deal review

## Status

Accepted for CP-08.

## Decisions

1. Provider access requires both a global provider role and active membership in the requested active organization. Organization-local `owner/admin/member` membership is separate from `provider_admin/provider_staff`. Only provider administrators with owner/admin membership can create a manual deal revision.
2. Reporting reads authoritative PostgreSQL rows directly. No cache, ORM, queue, or second offer state machine is introduced.
3. Invoiced amounts, verified simulated payments, outstanding balances and usage/ledger charges remain separate metrics. The API does not label invoice totals as recognized revenue.
4. Financial results are grouped by currency. Shared recurring invoices are represented by provider-owned charge-line allocations. Their invoice total and header balance are allocated proportionally to those charge lines, while payment settlement is not attributed because the schema has no payment-allocation rows.
   Initial invoices and order-linked adjustments use the owning order. Recurring invoices with a null `order_id` use `invoice_items.charge_ledger_id -> virtual_machines -> orders`; provider lines are aggregated before any header amount is allocated, so multiple invoice items do not multiply totals. A single-provider invoice receives its full header total, including persisted credits/debits. Void invoices are visible in status/list reporting but contribute zero invoiced, collected or outstanding amounts.
5. Pricing history reads retained pricing versions/rules and offer/order references. Active and retired records are not rewritten by reporting. Intermediate field-edit history is not fabricated.
6. A manual override is an immutable successor `offers` row linked with `parent_offer_id`. The source offer becomes `countered`; existing orders and invoices are untouched; the customer must confirm the successor via CP-06. The existing CP-05 approval/rejection routes remain the only provider-review state transition endpoints.
7. Detail lists use bounded page/offset pagination with deterministic timestamp/UUID ordering to preserve the existing API convention. Activity totals use a separate organization-scoped count query. Report windows are UTC half-open intervals, require both endpoints for custom ranges, and are capped at 366 days; pricing history without a range remains all-history.
8. Deal transcripts return only persisted `user` and `assistant` chat messages linked to the authorized offer. System messages and unrelated sessions are excluded.
9. `activeVirtualMachines` means current `RUNNING` state only. Conversion funnel `providerApproved` requires a persisted approved offer-approval row and is distinct from acceptance.

## Trade-offs and deferred scope

The current schema does not persist payment allocation across shared recurring invoices, so the API exposes the limitation instead of inventing a split. It also has no approved cost-basis table, so margins are `null`. Historical VM state charts require a future event-snapshot model; current state is not projected backward into history.
