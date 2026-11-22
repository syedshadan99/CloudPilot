-- CP-05 durable negotiation attempts, offer lineage and commercial context.
-- Applied migrations are immutable; this migration is additive.

CREATE TABLE negotiation_attempts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id        UUID NOT NULL REFERENCES chat_sessions (id) ON DELETE RESTRICT,
  customer_id            UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  attempt_number         INTEGER NOT NULL CHECK (attempt_number > 0),
  request_kind           TEXT NOT NULL CHECK (request_kind IN ('start', 'counter')),
  requested_discount_percent NUMERIC(5,2),
  requested_price        NUMERIC(19,4),
  outcome                TEXT NOT NULL CHECK (outcome IN ('presented', 'countered', 'pending_provider_review', 'rejected', 'attempt_limit_reached')),
  reason                 TEXT,
  request_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  offer_id               UUID REFERENCES offers (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_session_id, attempt_number),
  CHECK (requested_discount_percent IS NULL OR requested_discount_percent BETWEEN 0 AND 100),
  CHECK (requested_price IS NULL OR requested_price >= 0)
);

CREATE INDEX idx_negotiation_attempts_customer_session
  ON negotiation_attempts (customer_id, chat_session_id, attempt_number DESC);
CREATE INDEX idx_negotiation_attempts_offer
  ON negotiation_attempts (offer_id)
  WHERE offer_id IS NOT NULL;

ALTER TABLE offers
  ADD COLUMN parent_offer_id UUID REFERENCES offers (id) ON DELETE RESTRICT,
  ADD COLUMN negotiation_attempt_id UUID REFERENCES negotiation_attempts (id) ON DELETE SET NULL,
  ADD COLUMN commercial_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_offers_parent_offer
  ON offers (parent_offer_id)
  WHERE parent_offer_id IS NOT NULL;

CREATE UNIQUE INDEX uq_offers_one_actionable_per_chat
  ON offers (chat_session_id)
  WHERE status IN ('presented', 'pending_provider_review', 'approved');

CREATE INDEX idx_offers_expiry_reconciliation
  ON offers (expires_at, id)
  WHERE status IN ('presented', 'pending_provider_review', 'approved');
