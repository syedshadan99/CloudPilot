# CloudPilot database architecture

CP-02 establishes PostgreSQL as the system of record for identity, customer
ownership, catalog and pricing history, AI conversation persistence, offers,
orders, invoices, simulated payments, provisioning, VM lifecycle, usage,
upgrades, notifications, support, audit and asynchronous reliability.

The schema is SQL-first and uses opaque UUID identifiers, UTC `timestamptz`
values, exact `numeric` financial amounts and explicit foreign keys. The
existing `0001_chat.sql`–`0003_vms_and_usage.sql` migrations are preserved and
completed by `0004_cloudpilot_foundation.sql` plus narrow corrective migrations
`0005`–`0008`, with CP-05 migration `0009_negotiation_offer_lifecycle.sql` and
the upgrade compatibility repair `0010_upgrade_requests_compatibility.sql`.
Applied migrations are immutable and checksum-verified by
`scripts/database.mjs`.

The repository previously contained duplicate, incompatible teammate files
named `0004_upgrade_requests.sql` and `0005_notifications_support_audit.sql`.
The canonical `0004_cloudpilot_foundation.sql` already creates those tables, so
the duplicates are no longer runnable migration files. Their Git history is
preserved; no applied migration or checksum was changed. Migration `0010` adds
only the retry and customer-confirmation columns required by the upgrade module
and a canonical active-request index.

## Domain boundaries

- Identity and organization tables own account status, roles, profiles and
  server-side ownership scope. Passwords, session tokens and recovery tokens
  are represented only as hashes.
- Catalog, capacity, pricing versions, pricing rules and negotiation policies
  are provider-owned. An offer stores the pricing and policy references plus a
  complete configuration/price snapshot.
- Offers and orders are separate aggregates. `orders.offer_id` is unique, so
  one accepted offer can produce at most one order. Order acceptance, invoice
  issuance, payment verification and VM readiness remain separate states.
- `orders.provisioning_eligible_at` is only meaningful after
  `payment_verified_at`; application transactions must lock the order and
  verify a paid invoice before enqueueing work. A VM is customer-accessible
  only after its lifecycle state is ready/running and `access_granted_at` is
  set by the provisioning workflow.
- Invoices preserve totals and price snapshots. `invoice_items` and the
  immutable `charge_ledger_entries` are the accounting detail; recurring usage
  invoices may aggregate multiple VMs and therefore may omit `order_id`.
- VM state events, usage intervals and configuration history are retained
  history. Usage intervals use a PostgreSQL exclusion constraint to reject
  overlaps for the same VM.
- `idempotency_keys` and scoped unique constraints support safe retries for
  acceptance, invoice/payment commands, provisioning and billing jobs.
  `outbox_events` provides a transactional handoff to future worker consumers.
- CP-05 adds durable negotiation attempts and normalized offer lineage. The
  actionable-offer unique index prevents two current proposals for one chat
  session, while `commercial_snapshot` preserves the policy/rule decision that
  produced each offer.
- `audit_logs` are append-only by application convention. Database roles for
  production append-only enforcement are not created by this phase; API and
  worker roles must deny ordinary update/delete access when deployment roles
  are introduced.

## Intentional compatibility decisions

The first three migrations already power the current chat/provisioning/VM
modules, so CP-02 retains their names (`state`, `vm_config`, `cpu_percent`,
etc.) and adds normalized columns and foreign keys around them. The JSONB
configuration fields are immutable snapshots, not replacements for constrained
resource columns on templates and seeded VMs. The legacy VM resource columns
are nullable during this transition so a later compatibility migration can
backfill deployed records without inventing resource values.

The source ERD and architecture list the original core entities but leave
session/token storage, payment records, capacity, outbox and idempotency
details open. The implemented additions are required by the approved first-demo
workflow and are recorded in [`decisions.md`](decisions.md). Supplied academic
diagrams remain unchanged in `supporting-documents/`.

## Application transaction contracts

The database provides the primitives; later NestJS services must implement the
following transactions:

1. Lock an offer, re-check expiry/status/policy, insert one order with an
   idempotency key, issue/reuse one initial invoice, and append events/outbox
   rows before commit.
2. Lock an invoice/order during simulated payment confirmation, verify
   currency and amount, reuse an existing verified payment on retry, and only
   then set `payment_verified_at` and `provisioning_eligible_at`.
3. Lock or claim one provisioning job with `FOR UPDATE SKIP LOCKED`; reuse the
   unique order/job and order/VM constraints after worker retries.
4. Insert usage and charge-ledger rows with deterministic idempotency keys;
   the interval exclusion constraint rejects duplicate/overlapping metering.
5. Apply resize changes only after approval and successful provider simulation;
   close the prior configuration-history row and insert the new current row in
   one transaction.

API authorization and customer/organization filtering remain application
responsibilities. The schema makes those filters explicit and indexable; it
does not claim to replace NestJS guards.
