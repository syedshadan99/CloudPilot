# CP-02 database traceability

| Requirement/workflow source | Implemented database elements | Migration(s) | Verification |
| --- | --- | --- | --- |
| Architecture §9 identity, account and profile tables; FR-06–FR-15 | `users`, `sessions`, verification/reset tokens, organizations, memberships, profiles | `0004` | Table/FK and account constraint integration tests |
| Architecture §9 onboarding; FR-16–FR-20 | `onboarding_progress` | `0004` | Migration catalog; seeded completed progress |
| Architecture VM catalog, capacity and pricing; P5 | `vm_templates`, `capacity_pools`, `capacity_reservations`, `pricing_versions`, `pricing_rules`, `negotiation_policies` | `0004` | Resource/rate checks; four seeded templates; status/index checks |
| CP-11 chat persistence and controlled AI boundary | `chat_sessions`, `chat_messages`, `vm_requirements`, offer linkage | `0001`, `0004` | Existing chat compatibility; FK and sequence constraints |
| First-demo workflow steps 2–3; P7 offers | `offers`, `offer_events`, `offer_approvals` | `0004` | Price equation, status/expiry checks; accepted/review examples |
| First-demo workflow step 3; P8 order confirmation | `orders`, `order_events`, unique offer/order mapping, `idempotency_keys` | `0004`, `0005` | Duplicate order/invoice uniqueness and gate test |
| First-demo workflow step 3; P10 billing | `billing_accounts`, `invoices`, `invoice_items`, `invoice_adjustments`, `charge_ledger_entries` | `0004`, `0006` | Invoice line reconciliation and exact numeric totals |
| First-demo workflow steps 4–5; simulated payment gate | `payment_records`, order payment/provisioning timestamps | `0004` | Payment-gated state query; unique verified order payment |
| P8 durable provisioning and CP-12 worker | `provisioning_jobs`, `job_attempts`, `outbox_events` | `0002`, `0004` | Migration tracking; one job/order; ready/failure jobs |
| P9 VM lifecycle and usage; CP-13 | `virtual_machines`, `vm_state_events`, `usage_records` | `0003`, `0004`, `0007`, `0008` | VM ownership, state/action checks, overlap rejection |
| P11 upgrade/downgrade and resize recovery | `upgrade_requests`, `vm_configuration_history` | `0004` | One current configuration; applied history |
| Architecture notifications/support; CP-15 | `notifications`, `notification_deliveries`, `support_tickets`, `support_messages` | `0004` | Foreign key/content constraints; seeded examples |
| Architecture audit/security; FR-15, NFR-71, NFR-77 | `audit_logs`, request/correlation metadata | `0004` | Audit indexes and no-secret seed review |
| Backlog CP-02 acceptance: migrations, reset/seed, ERD | CLI runner, checksum tracking, reproducible seed, ERDs, dictionary, runbook | `scripts/database.mjs`, `0001`–`0008`, `001_demo.sql` | `db:migrate`, `db:status`, `db:seed` twice, tests, build |

The supplied academic ERD remains preserved. CP-02 extends it with the tables
needed for the explicit payment-before-provisioning workflow and safe retries;
the rationale is recorded in `decisions.md`.
