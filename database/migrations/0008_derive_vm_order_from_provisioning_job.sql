-- Preserve the existing VM repository contract: it supplies a
-- provisioning_job_id and the job already identifies the order. The trigger
-- keeps order_id mandatory and prevents two independent ownership paths.

CREATE FUNCTION cloudpilot_derive_vm_order_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS NULL AND NEW.provisioning_job_id IS NOT NULL THEN
    SELECT order_id
      INTO NEW.order_id
      FROM provisioning_jobs
     WHERE id = NEW.provisioning_job_id;
  END IF;

  IF NEW.order_id IS NULL THEN
    RAISE EXCEPTION 'virtual_machines.order_id is required and must be derived from a provisioning job';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_virtual_machines_derive_order
BEFORE INSERT ON virtual_machines
FOR EACH ROW
EXECUTE FUNCTION cloudpilot_derive_vm_order_id();
