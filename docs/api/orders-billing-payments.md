# CP-06 Orders, billing and simulated payments

All routes are versioned under `/api/v1`, require the existing cookie session and customer role, and use the existing session-bound CSRF guard for mutations. Customer identity is always derived from the session.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | `/offers/:id/confirm` | Atomically accepts an eligible owned offer, creates one order, holds capacity, issues one initial invoice, appends events/audit/outbox records, and returns the order and invoice. Requires `Idempotency-Key`. |
| GET | `/orders` | Lists only the authenticated customer's orders. |
| GET | `/orders/:id` | Returns an owned order and its initial invoice/items. |
| GET | `/orders/:id/events` | Returns owned order history. |
| GET | `/billing/summary` | Returns the owned billing account and invoice totals. |
| GET | `/invoices` | Lists owned invoices and line items. |
| GET | `/invoices/:id` | Returns an owned invoice and items. |
| POST | `/payments/simulated` | Records a synthetic payment attempt and runs the backend-owned exact-full-amount simulator. Requires `invoiceId`, `amount`, `currency`, and `Idempotency-Key`; client status/success/receipt fields are rejected. |
| GET | `/payments/:id` | Returns an owned payment result. |
| GET | `/invoices/:id/payments` | Returns owned payment attempts for an invoice. |

The simulator is instant but not real settlement: a payment is verified only when its amount exactly equals the persisted remaining initial-invoice total and its currency equals the persisted invoice currency. Underpayment, overpayment, currency mismatch, and expired capacity reservations create failed simulated payment records and never unlock provisioning. Partial payment accumulation and zero-value settlement are out of scope for this release.

Repeated commands with the same key and request return the stored response. A different key cannot create a second order or verified payment because `orders.offer_id`, the initial-invoice partial unique index, and the verified-payment-per-order partial unique index remain authoritative.
