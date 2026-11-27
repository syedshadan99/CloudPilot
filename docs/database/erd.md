# Implemented database ERD

These three Mermaid ERDs are the maintained domain-level view of the physical
schema. Full column types, checks, foreign keys, deletion actions and indexes
are in the [data dictionary](data-dictionary.md). The diagrams are split by
domain so reviewers can read the relationships without turning the full
database into an unreadable wall of boxes.

## Identity, catalog and negotiation

```mermaid
erDiagram
  USERS ||--o| CUSTOMER_PROFILES : owns
  USERS ||--o| ONBOARDING_PROGRESS : resumes
  USERS ||--o{ ORGANIZATION_MEMBERS : joins
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : contains
  ORGANIZATIONS ||--o{ VM_TEMPLATES : publishes
  PRICING_VERSIONS ||--o{ PRICING_RULES : contains
  VM_TEMPLATES ||--o{ PRICING_RULES : prices
  ORGANIZATIONS ||--o{ PRICING_VERSIONS : versions
  ORGANIZATIONS ||--o{ NEGOTIATION_POLICIES : governs
  USERS ||--o{ CHAT_SESSIONS : starts
  CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
  CHAT_SESSIONS ||--o{ OFFERS : contextualizes
  CHAT_SESSIONS ||--o{ NEGOTIATION_ATTEMPTS : counts
  NEGOTIATION_ATTEMPTS ||--o| OFFERS : produces
  OFFERS ||--o{ OFFERS : supersedes
  USERS ||--o{ OFFERS : receives
  OFFERS ||--o{ OFFER_EVENTS : records
  OFFERS ||--o{ OFFER_APPROVALS : reviews
```

## Commerce, billing and provisioning gate

```mermaid
erDiagram
  USERS ||--o| BILLING_ACCOUNTS : has
  OFFERS ||--o| ORDERS : accepted_as
  USERS ||--o{ ORDERS : owns
  ORDERS ||--o{ ORDER_EVENTS : records
  ORDERS ||--o{ INVOICES : generates
  BILLING_ACCOUNTS ||--o{ INVOICES : receives
  INVOICES ||--|{ INVOICE_ITEMS : itemizes
  INVOICES ||--o{ PAYMENT_RECORDS : receives
  INVOICES ||--o{ INVOICE_ADJUSTMENTS : adjusts
  USERS ||--o{ PROVISIONING_JOBS : requests
  ORDERS ||--o| PROVISIONING_JOBS : gates
  PROVISIONING_JOBS ||--o{ JOB_ATTEMPTS : retries
  ORDERS ||--o| VIRTUAL_MACHINES : allocates
  VIRTUAL_MACHINES ||--o{ VM_STATE_EVENTS : journals
  CAPACITY_POOLS ||--o{ CAPACITY_RESERVATIONS : holds
  ORDERS ||--o| CAPACITY_RESERVATIONS : reserves
```

## Runtime, support and reliability

```mermaid
erDiagram
  VIRTUAL_MACHINES ||--o{ USAGE_RECORDS : meters
  USAGE_RECORDS ||--o| CHARGE_LEDGER_ENTRIES : rates
  INVOICES ||--o{ CHARGE_LEDGER_ENTRIES : settles
  VIRTUAL_MACHINES ||--o{ UPGRADE_REQUESTS : resizes
  UPGRADE_REQUESTS ||--o{ VM_CONFIGURATION_HISTORY : produces
  USERS ||--o{ NOTIFICATIONS : receives
  NOTIFICATIONS ||--o{ NOTIFICATION_DELIVERIES : delivers
  USERS ||--o{ SUPPORT_TICKETS : opens
  SUPPORT_TICKETS ||--o{ SUPPORT_MESSAGES : contains
  USERS ||--o{ AUDIT_LOGS : acts
  USERS ||--o{ SESSIONS : authenticates
  USERS ||--o{ EMAIL_VERIFICATION_TOKENS : verifies
  USERS ||--o{ PASSWORD_RESET_TOKENS : recovers
```

The diagrams are intentionally domain-level. The full physical column and
foreign-key inventory is in the data dictionary, while the actual SQL remains
authoritative in `database/migrations/`.

The CP-07 physical additions are `billing_periods` and the `rated_at` and
`source_key` fields. `billing_periods.invoice_id` links one canonical recurring
period to one invoice; usage evidence links to a composite compute ledger row.
