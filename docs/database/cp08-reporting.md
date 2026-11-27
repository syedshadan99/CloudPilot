# CP-08 database reporting notes

CP-08 adds migration `0012_cp08_reporting_indexes.sql` only. Applied migrations are unchanged. The indexes support organization/date deal and order reads, provider invoice line attribution, provisioning lookup, and pricing rule history.

## Ownership paths

- Deals: `offers.organization_id` is authoritative.
- Orders: `orders.organization_id` is authoritative.
- VMs: `virtual_machines.order_id -> orders.organization_id` is authoritative.
- Initial invoices: `invoices.order_id -> orders.organization_id` is authoritative.
- Recurring invoices: `invoice_items.charge_ledger_id -> charge_ledger_entries.vm_id -> virtual_machines.order_id -> orders.organization_id` is authoritative.
- Activity: `audit_logs.organization_id` is authoritative.
- Pricing: `pricing_versions.organization_id` is authoritative and rules are joined through `pricing_version_id`.

Provider recurring invoice queries aggregate charge lines before exposing totals. They do not join invoice headers, items and payment attempts in one ungrouped relation. A shared invoice can produce one provider allocation per provider, while verified payment allocation is reported as zero for that shared invoice because settlement ownership is not persisted.

All monetary fields remain PostgreSQL `NUMERIC(19,4)` and are serialized as decimal strings. No FX conversion is performed.

## Override history

No new override table is required. A revision is an additive offer row with `parent_offer_id`, an offer-event pair, an existing immutable audit row containing previous/new commercial values and a durable idempotency record. The source offer's money fields are not updated. Existing accepted order and invoice snapshots cannot be reached by this route.
