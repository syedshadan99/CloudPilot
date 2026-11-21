# CloudPilot CP-02 data dictionary

All tables are in PostgreSQL `public`. Unless noted, identifiers are `uuid`
with `gen_random_uuid()` defaults, timestamps are UTC `timestamptz`, and
financial values are `numeric(19,4)`. `ON DELETE RESTRICT` is the default for
financial, operational and audit history; token/session rows may be cascaded
from their user because they are revocable credentials, not business history.

## Identity and ownership

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `users` | Account identity, normalized email, password hash, role, account status, verification and terms timestamps. | PK `id`; unique `normalized_email`; status/role checks; role/status index. | Self-owned account; deactivation is retained. |
| `sessions` | Hashed session token, expiry, revocation, last-seen and client metadata. | FK `user_id` RESTRICT; unique token hash; active user/expiry index; expiry checks. | User-scoped credential; revoke rather than delete during normal logout. |
| `email_verification_tokens` | Hashed, expiring, single-use verification tokens. | FK user CASCADE; unique token hash; active-token partial index. | Credential lifecycle; consumed rows can be retained briefly. |
| `password_reset_tokens` | Hashed, expiring, single-use recovery tokens. | FK user CASCADE; unique token hash; active-token partial index. | Credential lifecycle; never store raw token. |
| `organizations` | Provider/customer organization boundary and owner. | FK owner RESTRICT; status check; owner index. | Organization deactivation preserves members/history. |
| `organization_members` | Membership and organization-local role. | Composite PK `(organization_id,user_id)`; both FKs RESTRICT; user lookup index. | Membership removal must not delete owned business records. |
| `customer_profiles` | Company, workload, billing email, currency and timezone preferences. | PK/FK `user_id`; optional organization FK SET NULL; organization index. | Customer-owned profile; minimize personal data. |
| `onboarding_progress` | Resumable onboarding step, status and bounded structured responses. | PK/FK user; status/completion check. | Customer-owned draft; completion is explicit. |

## Catalog, pricing and chat

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `vm_templates` | Validated CPU/RAM/storage/OS/bandwidth/region catalog template. | FKs organization/creator RESTRICT; optional pricing/capacity FKs; positive resource checks; `(organization_id,slug)` unique; catalog/capacity indexes. | Provider organization-owned; deactivate/retire instead of delete. |
| `capacity_pools` | Simulated finite CPU/RAM/storage availability by provider region. | FKs organization/creator RESTRICT; positive capacity checks; org/name/region unique. | Provider-controlled availability source. |
| `capacity_reservations` | One order’s held/committed/released resource reservation. | Unique order; pool/order FKs RESTRICT, VM SET NULL; state/timestamp checks; pool/status index. | Created during acceptance and released/committed transactionally. |
| `pricing_versions` | Effective-dated provider rate version and currency. | FKs organization/creator RESTRICT; name unique within org; active/effective index; date check. | Never update a version used by an offer/order; create a new version. |
| `pricing_rules` | Template/component rates, floors and discount ceiling for a version. | FKs pricing/template RESTRICT; expression unique scope `(version,template,rule_type)`; nonnegative money/range checks; template index. | Historical pricing input; referenced by snapshots. |
| `negotiation_policies` | Maximum discount, minimum price, review threshold and attempt limit. | FKs organization/creator RESTRICT; active policy partial unique index; range/date checks. | Provider policy history; new effective version for material change. |
| `chat_sessions` | Customer negotiation/onboarding/support conversation state and active offer link. | FKs customer RESTRICT and active offer SET NULL; state/session type checks; customer/recent indexes. | Customer-owned transcript; offer/order references remain durable. |
| `chat_messages` | Ordered user/assistant/system message content. | FK session CASCADE; identity `sequence_no`; unique `(session_id,sequence_no)` and ordered index. | Session-scoped; no secrets/system credentials. |
| `vm_requirements` | One structured requirements row per chat session. | FK session CASCADE; unique session; positive resource/duration checks. | Extracted proposal, not pricing authority. |

## Offers and orders

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `offers` | Negotiated configuration plus immutable pricing/policy references and price snapshot. | FKs customer/org/chat/pricing/policy/template; status/expiry/range checks; final = base - discount; customer/status, expiry and review indexes. | Customer-visible proposal; acceptance is explicit and time-bound. |
| `offer_events` | Append-only offer status/event journal. | FK offer RESTRICT; nullable actor SET NULL; offer/time index. | Retained commercial history. |
| `offer_approvals` | Provider review decision and reason. | FKs offer/reviewer RESTRICT; decision timestamp check; pending index. | Provider review trail; no customer authority escalation from client input. |
| `orders` | Accepted commercial commitment with configuration and price snapshot. | Unique FK `offer_id`; unique `order_number`; customer/org/pricing FKs; payment/provisioning gate checks; customer/status/eligibility indexes. | Only one order per offer; payment and provisioning remain separate states. |
| `order_events` | Append-only order lifecycle journal. | FK order RESTRICT; optional actor SET NULL; order/time index. | Retained for recovery and audit reconstruction. |

## Billing and payment

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `billing_accounts` | Per-customer currency, balance and billing status. | Unique customer FK RESTRICT; balance/currency/status checks. | Suspended accounts block new provisioning in application policy. |
| `invoices` | Initial, recurring or adjustment invoice header and exact totals. | Unique invoice number; FKs account/customer/order RESTRICT; initial-order partial unique index; total equation/period checks; customer/status/due/order indexes. | Financial history retained; recurring invoices may omit order. |
| `invoice_items` | Itemized setup/compute/storage/discount/tax/credit/adjustment lines. | FK invoice RESTRICT; unique line number per invoice; invoice order index. | Reconciliation detail; backend calculates amount. |
| `payment_records` | Simulated payment submission, verification, reversal and reference. | FKs invoice/order/customer RESTRICT; unique payment reference; verified-per-order partial unique index; status timestamp checks; invoice/status index. | No real payment credentials or settlement claims. |
| `invoice_adjustments` | Authorized signed credit/debit/refund/tax correction. | FK invoice/authorizer RESTRICT; nonzero signed amount; invoice/time index. | Explicit reason and authorization required. |
| `charge_ledger_entries` | Immutable usage/setup charge source with quantity, rate, amount and billing interval. | Unique idempotency key; usage/VM/invoice FKs RESTRICT; period and nonnegative quantity/rate checks; customer/period and invoice indexes. | Source for invoice lines and reconciliation. |

## Provisioning, VM lifecycle and usage

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `provisioning_jobs` | Durable simulated worker job, eligibility timestamp, progress, retries and provider result. | Unique order; FKs order/customer RESTRICT; bounded status; queue index. | One job per order; workers claim/retry safely. |
| `job_attempts` | Per-attempt stage/error journal. | FK job CASCADE; unique attempt number; positive number/time checks. | Retry history may be retained with job. |
| `virtual_machines` | Allocated simulated VM, order/customer/config/resource snapshot and lifecycle state. | FKs order/customer/billing RESTRICT and provisioning SET NULL; one VM per order/job; state/resource checks; customer/order indexes. | No access before ready/running application transition; termination is retained. |
| `vm_state_events` | VM state transition/event journal, including worker events with nullable actor. | FK VM RESTRICT and actor RESTRICT; expanded lifecycle/action checks; VM/time index. | Append-only operational history; prevents destructive cascade. |
| `usage_records` | Immutable simulated metering interval and resource metrics. | VM FK RESTRICT; period-end check; GiST exclusion prevents same-VM overlap; period and uninvoiced indexes. | Stop/termination policy is applied by usage worker; invoiced rows retained. |
| `vm_configuration_history` | Effective VM resource configuration versions. | FK VM/upgrade RESTRICT; unique `(vm_id,version_number)` and one-current partial index; effective date check. | Historical config remains after resize. |
| `upgrade_requests` | Requested/approved/applied/failed VM resize with old/new configuration and price delta. | FKs customer/VM RESTRICT, reviewer SET NULL; state/timestamp checks; VM/status and customer indexes. | No current VM mutation before approved successful application. |

## Notifications, support, audit and reliability

| Table | Purpose and important columns | Keys, constraints and indexes | Ownership/lifecycle |
| --- | --- | --- | --- |
| `notifications` | User-facing event notice with optional related aggregate reference. | FK user RESTRICT; content checks; unread and user/time indexes. | User-owned; mark read rather than delete for history. |
| `notification_deliveries` | Per-channel delivery state and retry metadata. | FK notification RESTRICT; unique notification/channel; pending queue index. | Delivery retry is independent of business transaction. |
| `support_tickets` | Customer support case, assignment, priority and related business records. | Customer/assignment/related FKs; customer/status and assignment indexes. | Customer sees own records; staff visibility is guarded by role. |
| `support_messages` | Customer-visible replies and internal notes. | Ticket/author FKs RESTRICT; visibility check; ticket/time index. | `visibility='internal'` must never be returned to customers. |
| `audit_logs` | Actor, organization, action, entity, safe old/new metadata, reason and request correlation. | Actor/org SET NULL; entity, actor and organization/time indexes. | Append-only application contract; never include secrets. |
| `idempotency_keys` | Scoped request hash, result and resource reference for repeat-safe commands. | Unique `(scope,idempotency_key)`; lifecycle/status checks; expiry index. | Scope must include actor or aggregate identity. |
| `outbox_events` | Transactionally stored event payload for future async consumers. | Optional unique deduplication key; queue index; status/attempt checks. | Publisher claims rows and records failures; payloads contain no secrets. |

## Existing compatibility tables

The original migrations also retain the original `vm_config`, `cpu_percent`,
`ram_percent`, disk and network metric columns. They are intentionally not
duplicated. The migration runner records filename/checksum/execution time in
`schema_migrations`.
