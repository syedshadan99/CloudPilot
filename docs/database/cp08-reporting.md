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

Provider invoice queries first build one provider line per invoice/provider. Initial and order-linked invoices use `invoices.order_id`; recurring invoices with a null `order_id` use `invoice_items.charge_ledger_id -> charge_ledger_entries.vm_id -> virtual_machines.order_id -> orders.organization_id`. Multiple invoice items and multiple VMs are summed before the header is allocated. Single-provider invoices receive the full issued header total; shared headers, including persisted adjustments, are allocated proportionally to provider charge-line totals. They do not join invoice headers, items and payment attempts in one ungrouped relation. A shared invoice can produce one provider allocation per provider, while verified payment allocation is reported as zero for that shared invoice because settlement ownership is not persisted. Void and uncollectible balances do not count as receivables, and void invoices contribute zero invoiced/collected amount.

`activeVirtualMachines` is the current `RUNNING` state only. Activity uses a separate organization-scoped count query for page totals. Conversion `providerApproved` is based on the latest persisted `offer_approvals` decision, not merely an accepted offer.

All monetary fields remain PostgreSQL `NUMERIC(19,4)` and are serialized as decimal strings. No FX conversion is performed.

## Override history

No new override table is required. A revision is an additive offer row with `parent_offer_id`, an offer-event pair, an existing immutable audit row containing previous/new commercial values and a durable idempotency record. The source offer's money fields are not updated. Existing accepted order and invoice snapshots cannot be reached by this route.
