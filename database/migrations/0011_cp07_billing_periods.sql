-- CP-07: durable recurring billing-period identity and source-level rating state.
-- Applied migrations remain immutable; this migration is additive.

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_check3,
  DROP CONSTRAINT IF EXISTS invoices_initial_order_reference_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_order_reference_check
  CHECK (invoice_type <> 'initial_order' OR order_id IS NOT NULL);

ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

ALTER TABLE charge_ledger_entries
  ADD COLUMN IF NOT EXISTS source_key TEXT;

UPDATE charge_ledger_entries
   SET source_key = idempotency_key
 WHERE source_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_ledger_source_key
  ON charge_ledger_entries (source_key)
  WHERE source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_periods (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts (id) ON DELETE RESTRICT,
  customer_id        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  currency           CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  billing_cycle      TEXT NOT NULL CHECK (billing_cycle IN ('hourly', 'daily', 'monthly')),
  period_start       TIMESTAMPTZ NOT NULL,
  period_end         TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'processing', 'closed', 'failed')),
  invoice_id         UUID UNIQUE REFERENCES invoices (id) ON DELETE RESTRICT,
  claimed_at         TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_period_identity
  ON billing_periods (customer_id, currency, billing_cycle, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_periods_due
  ON billing_periods (status, period_end, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_periods_customer
  ON billing_periods (customer_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_usage_records_rating
  ON usage_records (rated_at, period_end)
  WHERE rated_at IS NULL;
