-- Allow a paid order to remain eligible while its provisioning attempt is in
-- a recoverable FAILED state. Pending-payment and cancelled orders remain
-- ineligible for provisioning.

ALTER TABLE orders
  DROP CONSTRAINT orders_check3,
  ADD CONSTRAINT orders_provisioning_gate_check
    CHECK (status NOT IN ('pending_payment', 'cancelled') OR provisioning_eligible_at IS NULL);
