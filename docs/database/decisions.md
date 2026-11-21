# CP-02 implementation decisions and deviations

These are implementation decisions for the database foundation, not a claim
that unresolved product choices in the master roadmap have been permanently
settled.

1. **SQL-first migrations remain authoritative.** The repository already uses
   `pg` and SQL migration directories, so CP-02 does not introduce Prisma,
   TypeORM, a queue service or a separate worker. The runner is a small Node.js
   script with PostgreSQL advisory locking and checksums.
2. **UUID identifiers and exact numeric money are consistent throughout.**
   Rates and totals use `numeric(19,4)`; quantities use `numeric(19,6)` where
   fractional metering is useful. Currency is explicit on every financial
   aggregate and invoice/payment record.
3. **Payment is a first-class state boundary.** `payment_records` and invoice
   statuses are separate from `orders.status`, and `provisioning_eligible_at`
   cannot be set for pending-payment/cancelled orders. The application must
   still verify invoice amount/currency transactionally.
4. **Capacity and retry support are explicit extensions.** The original
   architecture names simulated capacity and durable jobs but leaves their
   tables open. `capacity_pools`, `capacity_reservations`, `job_attempts`,
   `idempotency_keys` and `outbox_events` provide the minimum durable records
   needed to avoid over-allocation and duplicate work.
5. **Recurring invoices are not forced to one order.** An initial-order
   invoice must reference an order and is unique per order. A recurring usage
   invoice can aggregate immutable charge-ledger entries across a billing
   period, so its `order_id` is nullable.
6. **Legacy module compatibility is preserved.** Existing migration files and
   column names used by current NestJS repositories are not rewritten. New
   migrations add missing foreign keys, normalized snapshots and lifecycle
   constraints. The eight numbered migrations are the additive history of that
   reconciliation.
7. **System actors may be null on VM events.** Worker-generated transitions
   have no human user. `vm_state_events.actor_id` remains an FK when present and
   is nullable after `0007`; `audit_logs.actor_id` is similarly nullable for
   system actions.
8. **Stopped-VM storage billing remains an application policy.** The schema
   records explicit intervals and charge types but does not choose whether
   storage is charged while stopped. The roadmap identifies this as an open
   product decision and later billing tests must make the policy explicit.

No supplied academic document or diagram was modified. The corrected Ayan/
Shadan ownership is limited to the existing backlog allocation labels as
explicitly requested for CP-02.
