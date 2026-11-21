-- CloudPilot CP-02 foundation migration.
--
-- This migration completes the relational foundation around the three existing
-- chat/provisioning/VM migrations. It deliberately keeps the earlier table and
-- column names used by the current NestJS modules, then adds the missing
-- ownership, commerce, billing, lifecycle, support, audit and reliability
-- structures.
--
-- The migration runner executes this file inside one transaction. It is not a
-- destructive reset and must never be edited after it has been applied.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          TEXT NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 200),
  email              TEXT NOT NULL,
  normalized_email   TEXT NOT NULL CHECK (normalized_email = lower(btrim(normalized_email))),
  password_hash      TEXT NOT NULL CHECK (length(password_hash) >= 20),
  role               TEXT NOT NULL DEFAULT 'customer'
                     CHECK (role IN ('customer', 'provider_admin', 'provider_staff')),
  status             TEXT NOT NULL DEFAULT 'pending_verification'
                     CHECK (status IN ('pending_verification', 'active', 'suspended', 'deactivated')),
  email_verified_at  TIMESTAMPTZ,
  terms_accepted_at  TIMESTAMPTZ NOT NULL,
  last_login_at      TIMESTAMPTZ,
  deactivated_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'deactivated' OR deactivated_at IS NOT NULL),
  CHECK (status = 'deactivated' OR deactivated_at IS NULL)
);

CREATE UNIQUE INDEX uq_users_normalized_email ON users (normalized_email);
CREATE INDEX idx_users_role_status ON users (role, status);

CREATE TABLE sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  token_hash     TEXT NOT NULL CHECK (length(token_hash) >= 32),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE UNIQUE INDEX uq_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_active ON sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE email_verification_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE UNIQUE INDEX uq_email_verification_token_hash ON email_verification_tokens (token_hash);
CREATE INDEX idx_email_verification_user_active ON email_verification_tokens (user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE UNIQUE INDEX uq_password_reset_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_password_reset_user_active ON password_reset_tokens (user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  owner_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'suspended', 'deactivated')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_owner ON organizations (owner_id);

CREATE TABLE organization_members (
  organization_id  UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  user_id          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  member_role      TEXT NOT NULL DEFAULT 'member'
                   CHECK (member_role IN ('owner', 'admin', 'member')),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user ON organization_members (user_id, organization_id);

CREATE TABLE customer_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  organization_id     UUID REFERENCES organizations (id) ON DELETE SET NULL,
  company_name        TEXT,
  workload_type       TEXT,
  preferred_currency  CHAR(3) NOT NULL DEFAULT 'USD'
                      CHECK (preferred_currency = upper(preferred_currency)),
  billing_email       TEXT,
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_profiles_organization ON customer_profiles (organization_id);

CREATE TABLE onboarding_progress (
  user_id        UUID PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  current_step   TEXT NOT NULL DEFAULT 'welcome'
                 CHECK (current_step IN ('welcome', 'workload', 'duration', 'billing', 'expertise', 'recommendation', 'complete')),
  status         TEXT NOT NULL DEFAULT 'not_started'
                 CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
  responses      JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE TABLE pricing_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  version_name    TEXT NOT NULL CHECK (length(btrim(version_name)) BETWEEN 1 AND 120),
  currency        CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  effective_from  TIMESTAMPTZ NOT NULL,
  effective_to    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'retired')),
  created_by      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX uq_pricing_versions_name ON pricing_versions (organization_id, version_name);
CREATE INDEX idx_pricing_versions_effective ON pricing_versions (organization_id, effective_from DESC)
  WHERE status = 'active';

CREATE TABLE vm_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name               TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  slug               TEXT NOT NULL CHECK (slug = lower(slug)),
  description        TEXT,
  cpu_cores          INTEGER NOT NULL CHECK (cpu_cores > 0 AND cpu_cores <= 256),
  ram_gb             INTEGER NOT NULL CHECK (ram_gb > 0 AND ram_gb <= 4096),
  storage_gb         INTEGER NOT NULL CHECK (storage_gb > 0 AND storage_gb <= 65536),
  storage_type       TEXT NOT NULL DEFAULT 'ssd'
                     CHECK (storage_type IN ('hdd', 'ssd', 'nvme')),
  operating_system   TEXT NOT NULL CHECK (length(btrim(operating_system)) BETWEEN 1 AND 120),
  bandwidth_mbps     INTEGER NOT NULL DEFAULT 100 CHECK (bandwidth_mbps > 0),
  region             TEXT NOT NULL DEFAULT 'simulated-1',
  availability       TEXT NOT NULL DEFAULT 'available'
                     CHECK (availability IN ('available', 'limited', 'unavailable', 'retired')),
  active             BOOLEAN NOT NULL DEFAULT true,
  current_pricing_version_id UUID REFERENCES pricing_versions (id) ON DELETE SET NULL,
  created_by         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_vm_templates_catalog ON vm_templates (organization_id, active, availability, region);

CREATE TABLE pricing_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_version_id       UUID NOT NULL REFERENCES pricing_versions (id) ON DELETE RESTRICT,
  vm_template_id           UUID REFERENCES vm_templates (id) ON DELETE RESTRICT,
  rule_type                TEXT NOT NULL
                           CHECK (rule_type IN ('template_base', 'cpu_addon', 'ram_addon', 'storage_addon', 'bandwidth_addon', 'custom')),
  hourly_rate              NUMERIC(19,4) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  daily_rate               NUMERIC(19,4) CHECK (daily_rate IS NULL OR daily_rate >= 0),
  monthly_rate             NUMERIC(19,4) CHECK (monthly_rate IS NULL OR monthly_rate >= 0),
  unit_price               NUMERIC(19,4) CHECK (unit_price IS NULL OR unit_price >= 0),
  minimum_price            NUMERIC(19,4) CHECK (minimum_price IS NULL OR minimum_price >= 0),
  maximum_discount_percent NUMERIC(5,2) CHECK (maximum_discount_percent IS NULL OR maximum_discount_percent BETWEEN 0 AND 100),
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hourly_rate IS NOT NULL OR daily_rate IS NOT NULL OR monthly_rate IS NOT NULL OR unit_price IS NOT NULL)
);

CREATE UNIQUE INDEX uq_pricing_rules_scope ON pricing_rules
  (pricing_version_id, COALESCE(vm_template_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_type);
CREATE INDEX idx_pricing_rules_template ON pricing_rules (vm_template_id, pricing_version_id);

CREATE TABLE negotiation_policies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name                     TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  maximum_discount_percent NUMERIC(5,2) NOT NULL CHECK (maximum_discount_percent BETWEEN 0 AND 100),
  minimum_price             NUMERIC(19,4) NOT NULL CHECK (minimum_price >= 0),
  approval_threshold        NUMERIC(19,4) NOT NULL CHECK (approval_threshold >= 0),
  maximum_attempts          INTEGER NOT NULL DEFAULT 3 CHECK (maximum_attempts BETWEEN 1 AND 50),
  effective_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to              TIMESTAMPTZ,
  active                    BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX uq_active_negotiation_policy ON negotiation_policies (organization_id)
  WHERE active = true AND effective_to IS NULL;
CREATE INDEX idx_negotiation_policies_active ON negotiation_policies (organization_id, active, effective_from DESC);

ALTER TABLE chat_sessions
  ADD COLUMN session_type TEXT NOT NULL DEFAULT 'negotiation'
    CHECK (session_type IN ('negotiation', 'support', 'onboarding')),
  ADD COLUMN closed_at TIMESTAMPTZ;

ALTER TABLE chat_sessions
  ADD CONSTRAINT fk_chat_sessions_customer
  FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE chat_messages
  ADD COLUMN sequence_no BIGINT GENERATED ALWAYS AS IDENTITY;

ALTER TABLE chat_messages
  ADD CONSTRAINT uq_chat_messages_session_sequence UNIQUE (session_id, sequence_no);

CREATE INDEX idx_chat_sessions_customer_recent ON chat_sessions (customer_id, updated_at DESC);
CREATE INDEX idx_chat_messages_session_order ON chat_messages (session_id, sequence_no);

CREATE TABLE offers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  organization_id          UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  chat_session_id          UUID NOT NULL REFERENCES chat_sessions (id) ON DELETE RESTRICT,
  pricing_version_id       UUID NOT NULL REFERENCES pricing_versions (id) ON DELETE RESTRICT,
  negotiation_policy_id    UUID NOT NULL REFERENCES negotiation_policies (id) ON DELETE RESTRICT,
  vm_template_id           UUID REFERENCES vm_templates (id) ON DELETE RESTRICT,
  vm_configuration         JSONB NOT NULL,
  base_price               NUMERIC(19,4) NOT NULL CHECK (base_price >= 0),
  discount_percent         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  discount_amount          NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price              NUMERIC(19,4) NOT NULL CHECK (final_price >= 0),
  currency                 CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  billing_cycle            TEXT NOT NULL CHECK (billing_cycle IN ('hourly', 'daily', 'monthly')),
  rental_duration_days     INTEGER NOT NULL CHECK (rental_duration_days > 0),
  status                   TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'presented', 'countered', 'pending_provider_review', 'approved', 'accepted', 'declined', 'expired', 'rejected', 'cancelled')),
  provider_review_reason   TEXT,
  presented_at             TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ,
  accepted_at              TIMESTAMPTZ,
  created_by               UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (final_price = base_price - discount_amount),
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL),
  CHECK (expires_at IS NULL OR presented_at IS NULL OR expires_at > presented_at)
);

CREATE INDEX idx_offers_customer_status ON offers (customer_id, status, created_at DESC);
CREATE INDEX idx_offers_expiry ON offers (expires_at)
  WHERE status IN ('presented', 'countered', 'approved');
CREATE INDEX idx_offers_provider_review ON offers (organization_id, status, created_at)
  WHERE status = 'pending_provider_review';

CREATE TABLE offer_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     UUID NOT NULL REFERENCES offers (id) ON DELETE RESTRICT,
  actor_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  reason       TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_offer_events_offer_time ON offer_events (offer_id, created_at);

CREATE TABLE offer_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     UUID NOT NULL REFERENCES offers (id) ON DELETE RESTRICT,
  reviewer_id  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  decision     TEXT NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected')),
  reason       TEXT,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'pending' OR decided_at IS NOT NULL)
);

CREATE INDEX idx_offer_approvals_pending ON offer_approvals (decision, created_at)
  WHERE decision = 'pending';

CREATE TABLE orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  organization_id          UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  offer_id                 UUID NOT NULL UNIQUE REFERENCES offers (id) ON DELETE RESTRICT,
  order_number             TEXT NOT NULL UNIQUE,
  pricing_version_id       UUID NOT NULL REFERENCES pricing_versions (id) ON DELETE RESTRICT,
  vm_configuration         JSONB NOT NULL,
  base_price               NUMERIC(19,4) NOT NULL CHECK (base_price >= 0),
  discount_amount          NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price              NUMERIC(19,4) NOT NULL CHECK (final_price >= 0),
  currency                 CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  billing_cycle            TEXT NOT NULL CHECK (billing_cycle IN ('hourly', 'daily', 'monthly')),
  rental_duration_days     INTEGER NOT NULL CHECK (rental_duration_days > 0),
  status                   TEXT NOT NULL DEFAULT 'pending_payment'
                           CHECK (status IN ('pending_payment', 'payment_verified', 'provisioning', 'provisioning_failed', 'active', 'suspended', 'cancelled', 'completed')),
  accepted_at              TIMESTAMPTZ NOT NULL,
  payment_verified_at      TIMESTAMPTZ,
  provisioning_eligible_at TIMESTAMPTZ,
  start_at                 TIMESTAMPTZ,
  end_at                   TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  cancellation_reason      TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (final_price = base_price - discount_amount),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
  CHECK (provisioning_eligible_at IS NULL OR payment_verified_at IS NOT NULL),
  CHECK (status IN ('payment_verified', 'provisioning', 'active', 'suspended', 'completed') OR provisioning_eligible_at IS NULL)
);

CREATE INDEX idx_orders_customer_recent ON orders (customer_id, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
CREATE INDEX idx_orders_provisioning_eligible ON orders (provisioning_eligible_at)
  WHERE status IN ('payment_verified', 'provisioning_failed');

CREATE TABLE order_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  actor_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  reason       TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order_time ON order_events (order_id, created_at);

ALTER TABLE chat_sessions
  ADD COLUMN active_offer_id UUID;

ALTER TABLE chat_sessions
  ADD CONSTRAINT fk_chat_sessions_active_offer
  FOREIGN KEY (active_offer_id) REFERENCES offers (id) ON DELETE SET NULL;

CREATE TABLE billing_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  balance        NUMERIC(19,4) NOT NULL DEFAULT 0,
  currency       CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = upper(currency)),
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'closed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        TEXT NOT NULL UNIQUE,
  billing_account_id    UUID NOT NULL REFERENCES billing_accounts (id) ON DELETE RESTRICT,
  customer_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  order_id              UUID REFERENCES orders (id) ON DELETE RESTRICT,
  invoice_type          TEXT NOT NULL CHECK (invoice_type IN ('initial_order', 'recurring_usage', 'adjustment')),
  currency              CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  billing_period_start  TIMESTAMPTZ NOT NULL,
  billing_period_end    TIMESTAMPTZ NOT NULL,
  subtotal              NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount       NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount            NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  adjustment_amount     NUMERIC(19,4) NOT NULL DEFAULT 0,
  total                 NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid           NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'uncollectible')),
  issued_at             TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (billing_period_end > billing_period_start),
  CHECK (total = subtotal - discount_amount + tax_amount + adjustment_amount),
  CHECK (amount_paid <= total),
  CHECK (invoice_type = 'initial_order' OR order_id IS NOT NULL OR invoice_type = 'adjustment')
);

CREATE UNIQUE INDEX uq_initial_invoice_per_order ON invoices (order_id)
  WHERE invoice_type = 'initial_order' AND order_id IS NOT NULL;
CREATE INDEX idx_invoices_customer_status_due ON invoices (customer_id, status, due_at);
CREATE INDEX idx_invoices_order ON invoices (order_id);

CREATE TABLE charge_ledger_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  vm_id                 UUID,
  usage_record_id       UUID,
  invoice_id            UUID REFERENCES invoices (id) ON DELETE RESTRICT,
  idempotency_key       TEXT NOT NULL,
  charge_type           TEXT NOT NULL CHECK (charge_type IN ('compute', 'storage', 'network', 'setup', 'addon', 'credit', 'adjustment')),
  quantity              NUMERIC(19,6) NOT NULL CHECK (quantity >= 0),
  unit_price            NUMERIC(19,4) NOT NULL CHECK (unit_price >= 0),
  amount                NUMERIC(19,4) NOT NULL,
  currency              CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  billing_period_start  TIMESTAMPTZ NOT NULL,
  billing_period_end    TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (billing_period_end > billing_period_start)
);

CREATE UNIQUE INDEX uq_charge_ledger_idempotency ON charge_ledger_entries (idempotency_key);
CREATE INDEX idx_charge_ledger_customer_period ON charge_ledger_entries (customer_id, billing_period_start DESC);
CREATE INDEX idx_charge_ledger_invoice ON charge_ledger_entries (invoice_id);

CREATE TABLE invoice_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id         UUID NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
  line_number        INTEGER NOT NULL CHECK (line_number > 0),
  item_type          TEXT NOT NULL CHECK (item_type IN ('setup', 'compute', 'storage', 'network', 'addon', 'discount', 'tax', 'credit', 'adjustment')),
  description        TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
  quantity           NUMERIC(19,6) NOT NULL CHECK (quantity >= 0),
  unit_price         NUMERIC(19,4) NOT NULL,
  amount             NUMERIC(19,4) NOT NULL,
  charge_ledger_id   UUID REFERENCES charge_ledger_entries (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, line_number)
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id, line_number);

CREATE TABLE payment_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
  order_id            UUID REFERENCES orders (id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  payment_reference   TEXT NOT NULL UNIQUE,
  provider            TEXT NOT NULL DEFAULT 'simulated' CHECK (provider = 'simulated'),
  amount              NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  currency            CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'verified', 'failed', 'reversed')),
  failure_reason      TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at         TIMESTAMPTZ,
  reversed_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  CHECK (status <> 'reversed' OR reversed_at IS NOT NULL)
);

CREATE INDEX idx_payment_records_invoice_status ON payment_records (invoice_id, status, submitted_at DESC);
CREATE UNIQUE INDEX uq_verified_payment_per_order ON payment_records (order_id)
  WHERE order_id IS NOT NULL AND status = 'verified';

CREATE TABLE invoice_adjustments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('credit', 'debit', 'refund', 'tax_correction')),
  amount         NUMERIC(19,4) NOT NULL CHECK (amount <> 0),
  currency       CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  reason         TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  authorized_by  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_adjustments_invoice ON invoice_adjustments (invoice_id, created_at);

ALTER TABLE provisioning_jobs
  DROP CONSTRAINT provisioning_jobs_status_check,
  ADD CONSTRAINT provisioning_jobs_status_check CHECK (status IN ('QUEUED', 'ALLOCATING', 'PREPARING_OS', 'ASSIGNING_NETWORK', 'BOOTING', 'HEALTH_CHECK', 'READY', 'FAILED', 'CANCELLED', 'RETRYING')),
  ADD COLUMN eligibility_verified_at TIMESTAMPTZ,
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN claimed_at TIMESTAMPTZ;

ALTER TABLE provisioning_jobs
  ADD CONSTRAINT fk_provisioning_jobs_order
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_provisioning_jobs_customer
  FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE job_attempts
  ADD CONSTRAINT uq_job_attempt_number UNIQUE (job_id, attempt_number),
  ADD CONSTRAINT ck_job_attempt_number_positive CHECK (attempt_number > 0),
  ADD CONSTRAINT ck_job_attempt_times CHECK (completed_at IS NULL OR completed_at >= started_at);

CREATE INDEX idx_provisioning_jobs_ready_queue ON provisioning_jobs (status, next_attempt_at, created_at)
  WHERE status IN ('QUEUED', 'RETRYING');

ALTER TABLE virtual_machines
  ADD COLUMN order_id UUID,
  ADD COLUMN cpu_cores INTEGER,
  ADD COLUMN ram_gb INTEGER,
  ADD COLUMN storage_gb INTEGER,
  ADD COLUMN operating_system TEXT,
  ADD COLUMN region TEXT,
  ADD COLUMN billing_account_id UUID,
  ADD COLUMN access_granted_at TIMESTAMPTZ;

UPDATE virtual_machines vm
SET order_id = pj.order_id
FROM provisioning_jobs pj
WHERE vm.provisioning_job_id = pj.id AND vm.order_id IS NULL;

ALTER TABLE virtual_machines
  DROP CONSTRAINT virtual_machines_state_check,
  ADD CONSTRAINT virtual_machines_state_check CHECK (state IN ('CREATING', 'PROVISIONING', 'BOOTING', 'RUNNING', 'STOPPING', 'STOPPED', 'RESTARTING', 'RESIZING', 'SUSPENDED', 'TERMINATING', 'TERMINATED', 'FAILED')),
  ALTER COLUMN order_id SET NOT NULL,
  ADD CONSTRAINT fk_virtual_machines_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_virtual_machines_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_virtual_machines_billing_account FOREIGN KEY (billing_account_id) REFERENCES billing_accounts (id) ON DELETE RESTRICT,
  ADD CONSTRAINT uq_virtual_machines_order UNIQUE (order_id),
  ADD CONSTRAINT uq_virtual_machines_provisioning_job UNIQUE (provisioning_job_id),
  ADD CONSTRAINT ck_virtual_machine_resources CHECK (
    (cpu_cores IS NULL OR cpu_cores > 0) AND
    (ram_gb IS NULL OR ram_gb > 0) AND
    (storage_gb IS NULL OR storage_gb > 0)
  );

CREATE INDEX idx_virtual_machines_customer_state ON virtual_machines (customer_id, state, created_at DESC);
CREATE INDEX idx_virtual_machines_order ON virtual_machines (order_id);

ALTER TABLE vm_state_events
  DROP CONSTRAINT vm_state_events_action_check,
  ADD CONSTRAINT vm_state_events_action_check CHECK (action IN ('PROVISION', 'CREATE', 'START', 'STOP', 'RESTART', 'RESIZE', 'SUSPEND', 'RESUME', 'TERMINATE', 'FAIL', 'BOOT')),
  ADD CONSTRAINT fk_vm_state_events_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE vm_state_events
  DROP CONSTRAINT vm_state_events_vm_id_fkey,
  ADD CONSTRAINT fk_vm_state_events_vm FOREIGN KEY (vm_id) REFERENCES virtual_machines (id) ON DELETE RESTRICT;

CREATE INDEX idx_vm_state_events_vm_time ON vm_state_events (vm_id, created_at DESC);

ALTER TABLE usage_records
  ADD COLUMN runtime_seconds BIGINT NOT NULL DEFAULT 0 CHECK (runtime_seconds >= 0),
  ADD COLUMN cpu_usage NUMERIC(12,4) CHECK (cpu_usage IS NULL OR cpu_usage >= 0),
  ADD COLUMN memory_usage NUMERIC(12,4) CHECK (memory_usage IS NULL OR memory_usage >= 0),
  ADD COLUMN storage_usage NUMERIC(12,4) CHECK (storage_usage IS NULL OR storage_usage >= 0),
  ADD COLUMN bandwidth_usage NUMERIC(12,4) CHECK (bandwidth_usage IS NULL OR bandwidth_usage >= 0),
  ADD COLUMN invoiced_at TIMESTAMPTZ,
  ADD COLUMN charge_ledger_id UUID;

ALTER TABLE usage_records
  ADD CONSTRAINT ck_usage_period_valid CHECK (period_end > period_start),
  DROP CONSTRAINT usage_records_vm_id_fkey,
  ADD CONSTRAINT fk_usage_records_vm FOREIGN KEY (vm_id) REFERENCES virtual_machines (id) ON DELETE RESTRICT,
  ADD CONSTRAINT usage_records_no_overlap EXCLUDE USING gist (
    vm_id WITH =,
    tstzrange(period_start, period_end, '[)') WITH &&
  );

CREATE INDEX idx_usage_records_vm_period ON usage_records (vm_id, period_start DESC);
CREATE INDEX idx_usage_records_uninvoiced ON usage_records (period_end)
  WHERE invoiced_at IS NULL;

ALTER TABLE charge_ledger_entries
  ADD CONSTRAINT fk_charge_ledger_vm FOREIGN KEY (vm_id) REFERENCES virtual_machines (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_charge_ledger_usage FOREIGN KEY (usage_record_id) REFERENCES usage_records (id) ON DELETE RESTRICT;

ALTER TABLE usage_records
  ADD CONSTRAINT fk_usage_records_charge_ledger FOREIGN KEY (charge_ledger_id) REFERENCES charge_ledger_entries (id) ON DELETE RESTRICT;

CREATE TABLE capacity_pools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name               TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  region             TEXT NOT NULL,
  total_cpu_cores    INTEGER NOT NULL CHECK (total_cpu_cores > 0),
  total_ram_gb       INTEGER NOT NULL CHECK (total_ram_gb > 0),
  total_storage_gb   INTEGER NOT NULL CHECK (total_storage_gb > 0),
  available          BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name, region)
);

CREATE TABLE capacity_reservations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id            UUID NOT NULL REFERENCES capacity_pools (id) ON DELETE RESTRICT,
  order_id           UUID NOT NULL UNIQUE REFERENCES orders (id) ON DELETE RESTRICT,
  vm_id              UUID REFERENCES virtual_machines (id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'held'
                     CHECK (status IN ('held', 'committed', 'released', 'expired')),
  cpu_cores          INTEGER NOT NULL CHECK (cpu_cores > 0),
  ram_gb             INTEGER NOT NULL CHECK (ram_gb > 0),
  storage_gb         INTEGER NOT NULL CHECK (storage_gb > 0),
  expires_at         TIMESTAMPTZ,
  committed_at       TIMESTAMPTZ,
  released_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'held' OR expires_at IS NOT NULL),
  CHECK (status <> 'committed' OR committed_at IS NOT NULL)
);

CREATE INDEX idx_capacity_reservations_pool_status ON capacity_reservations (pool_id, status);

ALTER TABLE vm_templates
  ADD COLUMN capacity_pool_id UUID REFERENCES capacity_pools (id) ON DELETE SET NULL;

CREATE INDEX idx_vm_templates_capacity_pool ON vm_templates (capacity_pool_id);

CREATE TABLE upgrade_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  vm_id                 UUID NOT NULL REFERENCES virtual_machines (id) ON DELETE RESTRICT,
  previous_configuration JSONB NOT NULL,
  requested_configuration JSONB NOT NULL,
  status                TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'approved', 'rejected', 'processing', 'applied', 'failed', 'cancelled')),
  price_difference      NUMERIC(19,4) NOT NULL,
  currency              CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ,
  effective_at          TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES users (id) ON DELETE SET NULL,
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved', 'applied') OR approved_at IS NOT NULL),
  CHECK (status <> 'applied' OR effective_at IS NOT NULL)
);

CREATE INDEX idx_upgrade_requests_vm_status ON upgrade_requests (vm_id, status, created_at DESC);
CREATE INDEX idx_upgrade_requests_customer ON upgrade_requests (customer_id, created_at DESC);

CREATE TABLE vm_configuration_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id              UUID NOT NULL REFERENCES virtual_machines (id) ON DELETE RESTRICT,
  upgrade_request_id UUID REFERENCES upgrade_requests (id) ON DELETE RESTRICT,
  version_number     INTEGER NOT NULL CHECK (version_number > 0),
  configuration      JSONB NOT NULL,
  effective_from     TIMESTAMPTZ NOT NULL,
  effective_to       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vm_id, version_number),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX uq_current_vm_configuration ON vm_configuration_history (vm_id)
  WHERE effective_to IS NULL;

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  notification_type TEXT NOT NULL,
  title           TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  message         TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  related_entity_type TEXT,
  related_entity_id UUID,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_time ON notifications (user_id, created_at DESC);

CREATE TABLE notification_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications (id) ON DELETE RESTRICT,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);

CREATE INDEX idx_notification_deliveries_queue ON notification_deliveries (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE support_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  subject        TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  description    TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 10000),
  priority       TEXT NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to    UUID REFERENCES users (id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  related_vm_id  UUID REFERENCES virtual_machines (id) ON DELETE SET NULL,
  related_invoice_id UUID REFERENCES invoices (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ
);

CREATE INDEX idx_support_tickets_customer_status ON support_tickets (customer_id, status, created_at DESC);
CREATE INDEX idx_support_tickets_assignment ON support_tickets (assigned_to, status, updated_at DESC)
  WHERE assigned_to IS NOT NULL;

CREATE TABLE support_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES support_tickets (id) ON DELETE RESTRICT,
  author_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  visibility   TEXT NOT NULL DEFAULT 'customer'
               CHECK (visibility IN ('customer', 'internal')),
  body         TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_ticket_time ON support_messages (ticket_id, created_at);

CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations (id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  old_data       JSONB,
  new_data       JSONB,
  reason         TEXT,
  request_id     TEXT,
  ip_address     INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity_time ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_organization_time ON audit_logs (organization_id, created_at DESC);

CREATE TABLE idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope               TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 200),
  request_hash        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'succeeded', 'failed')),
  response_status     INTEGER,
  response_body      JSONB,
  resource_type       TEXT,
  resource_id         UUID,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, idempotency_key)
);

CREATE INDEX idx_idempotency_keys_expiry ON idempotency_keys (expires_at);

CREATE TABLE outbox_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  event_type     TEXT NOT NULL,
  deduplication_key TEXT,
  payload        JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  attempts       INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at      TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_outbox_deduplication_key ON outbox_events (deduplication_key)
  WHERE deduplication_key IS NOT NULL;
CREATE INDEX idx_outbox_queue ON outbox_events (available_at, created_at)
  WHERE status IN ('pending', 'failed');
