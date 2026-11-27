-- CP-08: additive indexes for organization-scoped provider reporting.
-- No business rows, accepted snapshots or applied migration are rewritten.

CREATE INDEX IF NOT EXISTS idx_offers_organization_created
  ON offers (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_organization_accepted
  ON orders (organization_id, accepted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_charge_ledger
  ON invoice_items (charge_ledger_id, invoice_id)
  WHERE charge_ledger_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_order_status
  ON provisioning_jobs (order_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_version_scope
  ON pricing_rules (pricing_version_id, rule_type, created_at);
