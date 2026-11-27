# CP-07 billing and payment-history API

All routes are under `/api/v1` and require an authenticated active customer. Records are filtered by the authenticated customer; client-supplied customer IDs are ignored.

| Method | Path | Purpose |
|---|---|---|
| GET | `/billing/summary` | Currency-scoped issued, verified-paid, outstanding, overdue, and invoice-count totals. |
| GET | `/billing/charges` | Paginated immutable ledger entries. Optional `vmId`, `from`, and `to` filters. |
| GET | `/billing/charges/:id` | One owned ledger entry and its source identifiers. |
| GET | `/billing/usage` | Operational usage with any related rated charge; metrics are not automatically money. |
| GET | `/vms/:id/billing` | Same usage/rating breakdown scoped to one owned VM. |
| GET | `/invoices` | Paginated invoices; optional status filter. |
| GET | `/invoices/:id` | Owned invoice, exact totals, status, dates, and itemization. |
| GET | `/payments` | Paginated payment attempts; optional `status` and `invoiceId`. |
| GET | `/payments/:id` | One owned simulated payment attempt. |
| GET | `/invoices/:id/payments` | All attempts for one owned invoice. |

Money is returned as PostgreSQL NUMERIC strings with four decimal places; quantities use six decimal places. Failed and pending simulated attempts are history only and are excluded from verified-paid totals. The simulated payment mutation still requires `Idempotency-Key` and remains restricted to CP-06 initial-order settlement.
