-- 0004_upgrade_requests.sql
-- Upgrade, downgrade, and resize requests with approval gating, price differences, and retry tracking.

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(64) NOT NULL,
  vm_id UUID NOT NULL REFERENCES virtual_machines(id) ON DELETE CASCADE,
  old_configuration JSONB NOT NULL,
  new_configuration JSONB NOT NULL,
  old_monthly_price NUMERIC(10, 2) NOT NULL,
  new_monthly_price NUMERIC(10, 2) NOT NULL,
  price_difference NUMERIC(10, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
  -- Statuses: PENDING_APPROVAL, APPROVED, RESIZING, COMPLETED, FAILED, REJECTED, CANCELLED
  customer_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_approved_at TIMESTAMPTZ,
  approved_by VARCHAR(64),
  rejection_reason TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for queries
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_vm_id ON upgrade_requests(vm_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_customer_id ON upgrade_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status);

-- Prevent duplicate active upgrade/resize requests for the same VM
CREATE UNIQUE INDEX IF NOT EXISTS idx_upgrade_requests_active_vm
  ON upgrade_requests(vm_id)
  WHERE status IN ('PENDING_APPROVAL', 'APPROVED', 'RESIZING');
