# ADR 0007: CP-07 prepaid boundary and recurring rating

## Decision

The CP-06 initial invoice is the accepted order's prepaid commercial commitment. It covers the accepted rental duration from `orders.accepted_at`; usage records inside that interval remain visible for operations but do not create another charge. CP-07 rates only authoritative runtime outside the prepaid boundary.

The first release rates provisioned vCPU-hours, vCPU-days, or vCPU-months from the accepted order's final price divided by its compatible fixed billing periods. CPU utilization, RAM utilization, disk I/O, and network samples are not converted into money because the approved schema does not define them as billable quantities.

Monthly periods retain the CP-04 fixed 30-day convention. Partial intervals are prorated by elapsed UTC seconds. Discounts from the accepted offer apply to the initial prepaid invoice only; recurring usage has no inferred discount. Tax and penalty fees remain zero unless a later approved policy changes this.

Recurring invoices are identified by customer, billing account currency, billing cycle, and half-open period timestamps in `billing_periods`. A source usage record has a deterministic ledger key, is marked rated atomically, and is linked to its invoice in the same transaction. Repeated workers therefore reuse the period/source uniqueness constraints rather than request IDs.

## Consequences

No historical order is repriced from current pricing rules. Renewal and explicit contract amendments remain future work because CP-06 has no persisted renewal contract or component-rate snapshot. Failed or stopped runtime is not charged, and failed provisioning does not fabricate runtime.
