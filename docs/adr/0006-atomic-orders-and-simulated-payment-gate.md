# ADR 0006: Atomic order acceptance and backend-verified simulated payment

## Decision

CP-06 accepts an owned, non-expired actionable offer inside one PostgreSQL transaction. The transaction locks the idempotency row, active customer, offer, billing account, and eligible provider capacity pool in that order; inserts the order, a 24-hour held capacity reservation, initial invoice and items; transitions the offer to `accepted`; writes order/offer/audit/outbox records; stores the idempotency response; and commits. Any failure rolls back all commercial effects.

Accepted order and invoice prices are copied from the offer snapshot. The initial invoice uses `subtotal = base_price`, `discount_amount = offer.discount_amount`, zero tax and zero adjustments, so `total = final_price`. It has a coverage period beginning at acceptance and ending after the agreed rental duration; metered usage billing starts later at VM activation.

The first-release payment simulator accepts one exact full payment only. The request cannot supply verification status, customer identity, timestamps, or receipt authority. The backend compares exact four-decimal amounts and currency, records a `verified` or `failed` simulated payment, commits the held reservation, marks the invoice paid, and sets order payment/provisioning eligibility only on successful verification. No real gateway, payment credentials, refund, reversal, partial-payment accumulation, or zero-value settlement is implemented.

Provisioning derives customer and VM configuration from the persisted order and requires paid-in-full invoice evidence, verified payment, committed capacity, and eligibility timestamps. Provider routes are organization-scoped; worker execution repeats the database-backed gate immediately before simulated allocation.

## Consequences

The existing schema is sufficient; no migration after `0010` is required. Capacity is held before payment and committed at payment verification, so expired unpaid holds can be released without over-allocation. Customers may retry after a lost response, and unique constraints protect retries using a new key. CP-07 must preserve these immutable snapshots when adding recurring usage invoices.
