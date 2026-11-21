-- Migration: 0002_provisioning.sql
-- Creates provisioning_jobs and job_attempts tables.
--
-- NOTE: order_id and customer_id have no FK constraints here because the
-- orders and users tables are owned by CP-02/CP-06 (Shadan) and do not exist
-- yet. Add the FK constraints in a later migration once those tables land:
--
--   ALTER TABLE provisioning_jobs
--     ADD CONSTRAINT fk_pj_order    FOREIGN KEY (order_id)   REFERENCES orders(id),
--     ADD CONSTRAINT fk_pj_customer FOREIGN KEY (customer_id) REFERENCES users(id);
--
-- Run with: psql $DATABASE_URL -f database/migrations/0002_provisioning.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── provisioning_jobs ─────────────────────────────────────────────────────────
-- One row per order. UNIQUE(order_id) makes repeated creation idempotent.
CREATE TABLE IF NOT EXISTS provisioning_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References orders(id) — FK added when CP-06 orders table exists.
  order_id        UUID        NOT NULL,

  -- References users(id) — FK added when CP-03 users table exists.
  customer_id     UUID        NOT NULL,

  -- Progress stages from the roadmap (P8):
  -- Queued → Allocating → Preparing OS → Assigning Network → Booting → Health Check → Ready
  status          TEXT        NOT NULL DEFAULT 'QUEUED'
                              CHECK (status IN (
                                'QUEUED',
                                'ALLOCATING',
                                'PREPARING_OS',
                                'ASSIGNING_NETWORK',
                                'BOOTING',
                                'HEALTH_CHECK',
                                'READY',
                                'FAILED',
                                'CANCELLED'
                              )),

  attempt_count   INT         NOT NULL DEFAULT 0,
  max_attempts    INT         NOT NULL DEFAULT 3,
  last_error      TEXT,

  -- Snapshot of the VM configuration requested (cpu, ram, storage, os).
  -- Stored as JSONB so the job is self-contained and doesn't depend on
  -- vm_requirements FK until CP-02 schema is finalised.
  vm_config       JSONB       NOT NULL DEFAULT '{}',

  -- Populated by the SimulatedVmProvider once provisioning succeeds.
  simulated_vm_id TEXT,
  simulated_host  TEXT,
  simulated_ip    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  -- Idempotency: one job per order.
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_pj_order_id
  ON provisioning_jobs (order_id);

CREATE INDEX IF NOT EXISTS idx_pj_customer_id
  ON provisioning_jobs (customer_id);

CREATE INDEX IF NOT EXISTS idx_pj_status
  ON provisioning_jobs (status)
  WHERE status IN ('QUEUED', 'ALLOCATING', 'PREPARING_OS',
                   'ASSIGNING_NETWORK', 'BOOTING', 'HEALTH_CHECK');

-- ── job_attempts ──────────────────────────────────────────────────────────────
-- One row per attempt. Bounded by provisioning_jobs.max_attempts.
CREATE TABLE IF NOT EXISTS job_attempts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID        NOT NULL REFERENCES provisioning_jobs(id) ON DELETE CASCADE,
  attempt_number INT         NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  stage_reached  TEXT,
  error          TEXT
);

CREATE INDEX IF NOT EXISTS idx_ja_job_id
  ON job_attempts (job_id);

COMMIT;
