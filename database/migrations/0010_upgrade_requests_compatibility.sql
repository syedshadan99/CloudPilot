-- CP-05 migration-history repair: preserve the canonical upgrade_requests table
-- from 0004_cloudpilot_foundation.sql while adding the retry/confirmation fields
-- used by the upgrade module. The duplicate 0004/0005 teammate migrations were
-- never valid members of the unified numbered history and are retained in Git
-- history only, not replayed under a new version.

ALTER TABLE upgrade_requests
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE upgrade_requests
  DROP CONSTRAINT IF EXISTS upgrade_requests_attempt_count_check,
  ADD CONSTRAINT upgrade_requests_attempt_count_check CHECK (attempt_count >= 0),
  DROP CONSTRAINT IF EXISTS upgrade_requests_max_attempts_check,
  ADD CONSTRAINT upgrade_requests_max_attempts_check CHECK (max_attempts > 0);

-- The canonical status vocabulary is lowercase and must remain the authority.
-- Fail if existing data violates the invariant instead of deleting or rewriting
-- requests during migration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upgrade_requests_active_vm_canonical
  ON upgrade_requests (vm_id)
  WHERE status IN ('requested', 'approved', 'processing');
