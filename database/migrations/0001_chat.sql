-- Migration: 0001_chat.sql
-- Creates tables for chat sessions, messages, and VM requirements extraction.
-- Run with: psql $DATABASE_URL -f database/migrations/0001_chat.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── chat_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID        NOT NULL,
  state        TEXT        NOT NULL DEFAULT 'NEW'
                           CHECK (state IN (
                             'NEW',
                             'REQUIREMENTS_COLLECTION',
                             'CONFIGURATION_RECOMMENDATION',
                             'PRICE_CALCULATION',
                             'NEGOTIATION',
                             'OFFER_READY',
                             'CUSTOMER_REVIEW',
                             'ACCEPTED',
                             'ORDER_CREATED',
                             'PROVISIONING',
                             'ACTIVE',
                             'REJECTED',
                             'EXPIRED',
                             'ESCALATED',
                             'CANCELLED'
                           )),
  title        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer_id
  ON chat_sessions (customer_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_state
  ON chat_sessions (state);

-- ── chat_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages (session_id);

-- ── vm_requirements ───────────────────────────────────────────────────────────
-- One row per session. The source column records whether requirements came from
-- AI extraction ('ai') or the manual fallback form ('manual').
CREATE TABLE IF NOT EXISTS vm_requirements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL UNIQUE REFERENCES chat_sessions (id) ON DELETE CASCADE,
  cpu_cores     INT         CHECK (cpu_cores > 0),
  ram_gb        INT         CHECK (ram_gb > 0),
  storage_gb    INT         CHECK (storage_gb > 0),
  os            TEXT,
  duration_days INT         CHECK (duration_days > 0),
  billing_cycle TEXT        CHECK (billing_cycle IN ('hourly', 'daily', 'monthly')),
  use_case      TEXT,
  notes         TEXT,
  source        TEXT        NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('ai', 'manual')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
