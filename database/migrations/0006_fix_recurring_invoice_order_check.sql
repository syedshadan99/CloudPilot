-- Recurring usage invoices may aggregate metered charges from multiple VM
-- periods and therefore do not require one order_id. Initial-order invoices
-- remain tied to exactly one accepted order by the partial unique index.

ALTER TABLE invoices
  DROP CONSTRAINT invoices_check3,
  ADD CONSTRAINT invoices_initial_order_reference_check
    CHECK (invoice_type <> 'initial_order' OR order_id IS NOT NULL);
