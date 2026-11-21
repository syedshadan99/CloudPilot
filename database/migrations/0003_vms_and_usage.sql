-- Migration: 0003_vms_and_usage.sql
-- Creates virtual_machines, vm_state_events, and usage_records tables.
--
-- FK to provisioning_jobs already exists (0002).
-- FK to orders/users added as commented stubs — CP-02/CP-06 own those tables.
--
-- Run with: psql $DATABASE_URL -f database/migrations/0003_vms_and_usage.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── virtual_machines ──────────────────────────────────────────────────────────
-- One row per provisioned VM. Created when a provisioning job reaches READY.
-- State machine (CP-13 / roadmap P9):
--   PROVISIONING → RUNNING → STOPPING → STOPPED → RUNNING (restart)
--                        └──────────────────────→ TERMINATED (irreversible)
CREATE TABLE IF NOT EXISTS virtual_machines (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership — FK to users(id) added when CP-03 delivers users table.
  customer_id       UUID        NOT NULL,

  -- Link back to the provisioning job that created this VM.
  provisioning_job_id UUID      REFERENCES provisioning_jobs(id) ON DELETE SET NULL,

  -- VM state machine. TERMINATED is irreversible.
  state             TEXT        NOT NULL DEFAULT 'PROVISIONING'
                                CHECK (state IN (
                                  'PROVISIONING',
                                  'RUNNING',
                                  'STOPPING',
                                  'STOPPED',
                                  'TERMINATED'
                                )),

  -- Simulated provider identifiers (populated from provisioning job).
  simulated_vm_id   TEXT        UNIQUE,     -- e.g. "sim-vm-abc123"
  hostname          TEXT,                   -- e.g. "sim-vm-abc123.sim.cloudpilot.local"
  ip_address        TEXT,                   -- e.g. "10.18.62.69"

  -- Configuration snapshot (cpu, ram, storage, os) stored at creation.
  vm_config         JSONB       NOT NULL DEFAULT '{}',

  -- Display name editable by owner (rename — not in CP-13 scope, reserved).
  name              TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- When the VM last started / stopped (for usage metering).
  started_at        TIMESTAMPTZ,
  stopped_at        TIMESTAMPTZ,
  terminated_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vm_customer_id
  ON virtual_machines (customer_id);

CREATE INDEX IF NOT EXISTS idx_vm_state
  ON virtual_machines (state)
  WHERE state IN ('RUNNING', 'STOPPING', 'STOPPED');

CREATE INDEX IF NOT EXISTS idx_vm_simulated_id
  ON virtual_machines (simulated_vm_id);

-- ── vm_state_events ───────────────────────────────────────────────────────────
-- Append-only event log for every state transition.
-- actor_id = the customer who triggered the action (FK to users added later).
CREATE TABLE IF NOT EXISTS vm_state_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id       UUID        NOT NULL REFERENCES virtual_machines(id) ON DELETE CASCADE,
  actor_id    UUID        NOT NULL,
  from_state  TEXT        NOT NULL,
  to_state    TEXT        NOT NULL,
  action      TEXT        NOT NULL
              CHECK (action IN ('PROVISION','START','STOP','RESTART','TERMINATE')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vme_vm_id
  ON vm_state_events (vm_id);

-- ── usage_records ─────────────────────────────────────────────────────────────
-- Reproducible simulated usage snapshots generated while VM is RUNNING.
-- Immutable once written — billing reads from these rows.
-- A unique constraint on (vm_id, period_start) prevents duplicate ticks.
CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id         UUID        NOT NULL REFERENCES virtual_machines(id) ON DELETE CASCADE,

  -- The 1-hour interval this record covers.
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,

  -- Simulated resource metrics (labelled as simulated in data).
  cpu_percent   NUMERIC(5,2) NOT NULL CHECK (cpu_percent BETWEEN 0 AND 100),
  ram_percent   NUMERIC(5,2) NOT NULL CHECK (ram_percent BETWEEN 0 AND 100),
  disk_read_mb  NUMERIC(10,2) NOT NULL CHECK (disk_read_mb >= 0),
  disk_write_mb NUMERIC(10,2) NOT NULL CHECK (disk_write_mb >= 0),
  net_in_mb     NUMERIC(10,2) NOT NULL CHECK (net_in_mb >= 0),
  net_out_mb    NUMERIC(10,2) NOT NULL CHECK (net_out_mb >= 0),

  -- Source label for billing transparency.
  source        TEXT        NOT NULL DEFAULT 'simulated',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: one record per VM per period.
  UNIQUE (vm_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ur_vm_id
  ON usage_records (vm_id);

CREATE INDEX IF NOT EXISTS idx_ur_period
  ON usage_records (vm_id, period_start DESC);

COMMIT;
