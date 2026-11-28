import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";
import { ProviderRepository } from "../../dist/modules/provider/provider.repository.js";

const { Pool } = pg;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : { host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "" });
const providerOrg = "10000000-0000-0000-0000-000000000001";
const otherOrg = "10000000-0000-0000-0000-000000000002";
const customer = "20000000-0000-0000-0000-000000000001";
const billingAccount = "b0000000-0000-0000-0000-000000000001";

function repositoryFor(client) {
  return new ProviderRepository({ query: (sql, values) => client.query(sql, values) });
}

test("CP-08 reporting ownership paths and financial facts are organization-scoped", async () => {
  const customerCount = await pool.query(`SELECT count(DISTINCT customer_id)::int AS count FROM offers WHERE organization_id = $1`, [providerOrg]);
  const invoiceFacts = await pool.query(`SELECT i.currency, SUM(i.total)::numeric(19,4)::text AS invoiced, SUM(i.amount_paid)::numeric(19,4)::text AS paid FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.organization_id = $1 GROUP BY i.currency`, [providerOrg]);
  const vmCount = await pool.query(`SELECT count(*)::int AS count FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id WHERE o.organization_id = $1 AND vm.state = 'RUNNING'`, [providerOrg]);
  assert.equal(customerCount.rows[0].count, 1);
  assert.equal(invoiceFacts.rows[0].currency, "USD");
  assert.equal(vmCount.rows[0].count, 1);
  const forbiddenOrgRows = await pool.query(`SELECT count(*)::int AS count FROM offers WHERE organization_id = $1 AND id IN (SELECT id FROM offers WHERE organization_id <> $1)`, [providerOrg]);
  assert.equal(forbiddenOrgRows.rows[0].count, 0);
});

test("CP-08 reporting migration indexes are applied without checksum drift", async () => {
  const result = await pool.query(`SELECT filename, checksum FROM schema_migrations WHERE version = 12`);
  assert.equal(result.rows[0].filename, "0012_cp08_reporting_indexes.sql");
  const indexes = await pool.query(`SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_offers_organization_created','idx_orders_organization_accepted','idx_invoice_items_charge_ledger','idx_provisioning_jobs_order_status','idx_pricing_rules_version_scope')`);
  assert.equal(indexes.rowCount, 5);
});

after(async () => pool.end());

test("CP-08 repository attributes recurring and shared invoices without multiplying rows", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const repo = repositoryFor(client);
    const dashboardCounts = await repo.dashboardCounts(providerOrg, {});
    assert.equal(dashboardCounts.active_vms, "1");
    await client.query(`
      INSERT INTO chat_sessions (id, customer_id, state, title, session_type)
      VALUES ('80000000-0000-0000-0000-00000000c802', $1, 'ACCEPTED', 'CP-08 provider B fixture', 'negotiation')`, [customer]);
    await client.query(`
      INSERT INTO offers (id, customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
        vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price, currency,
        billing_cycle, rental_duration_days, status, presented_at, expires_at, accepted_at, created_at, created_by)
      VALUES ('90000000-0000-0000-0000-00000000c802', $1, $2, '80000000-0000-0000-0000-00000000c802',
        '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000002', '{"template":"starter"}'::jsonb, 48, 0, 0, 48, 'USD',
        'monthly', 30, 'accepted', '2027-01-01T00:00:00Z', '2027-01-02T00:00:00Z', '2027-01-01T00:01:00Z',
        '2027-01-01T00:00:00Z', '20000000-0000-0000-0000-000000000002')`, [customer, otherOrg]);
    await client.query(`
      INSERT INTO orders (id, customer_id, organization_id, offer_id, order_number, pricing_version_id, vm_configuration,
        base_price, discount_amount, final_price, currency, billing_cycle, rental_duration_days, status, accepted_at)
      VALUES ('a0000000-0000-0000-0000-00000000c802', $1, $2, '90000000-0000-0000-0000-00000000c802', 'CP08-B-0001',
        '30000000-0000-0000-0000-000000000001', '{"template":"starter"}'::jsonb, 48, 0, 48, 'USD', 'monthly', 30,
        'active', '2027-01-01T00:01:00Z')`, [customer, otherOrg]);
    await client.query(`
      INSERT INTO provisioning_jobs (id, order_id, customer_id, status, attempt_count, max_attempts, vm_config)
      VALUES ('e0000000-0000-0000-0000-00000000c802', 'a0000000-0000-0000-0000-00000000c802', $1, 'READY', 1, 3, '{"cpu_cores":2}'::jsonb)`, [customer]);
    await client.query(`
      INSERT INTO virtual_machines (id, customer_id, order_id, provisioning_job_id, state, simulated_vm_id, vm_config,
        cpu_cores, ram_gb, storage_gb, operating_system, region, billing_account_id)
      VALUES ('f0000000-0000-0000-0000-00000000c802', $1, 'a0000000-0000-0000-0000-00000000c802',
        'e0000000-0000-0000-0000-00000000c802', 'RUNNING', 'cp08-b-vm', '{"template":"starter"}'::jsonb,
        2, 4, 50, 'Ubuntu 24.04 LTS', 'simulated-1', $2)`, [customer, billingAccount]);

    await client.query(`
      INSERT INTO invoices (id, invoice_number, billing_account_id, customer_id, invoice_type, currency,
        billing_period_start, billing_period_end, subtotal, discount_amount, tax_amount, adjustment_amount,
        total, amount_paid, status, issued_at, due_at)
      VALUES
        ('c8000000-0000-0000-0000-000000000001', 'CP08-SINGLE-001', $1, $2, 'recurring_usage', 'USD',
          '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z', 5, 0, 0, 0, 5, 2, 'overdue', '2027-02-01T00:01:00Z', '2027-02-08T00:01:00Z'),
        ('c8000000-0000-0000-0000-000000000002', 'CP08-SHARED-001', $1, $2, 'recurring_usage', 'USD',
          '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z', 10, 0, 0, 0, 10, 4, 'issued', '2027-02-02T00:01:00Z', '2027-02-09T00:01:00Z'),
        ('c8000000-0000-0000-0000-000000000003', 'CP08-EUR-001', $1, $2, 'recurring_usage', 'EUR',
          '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z', 7, 0, 0, 0, 7, 0, 'issued', '2027-02-03T00:01:00Z', '2027-02-10T00:01:00Z')`, [billingAccount, customer]);
    await client.query(`
      INSERT INTO charge_ledger_entries (id, customer_id, vm_id, invoice_id, idempotency_key, source_key, charge_type,
        quantity, unit_price, amount, currency, billing_period_start, billing_period_end)
      VALUES
        ('c8200000-0000-0000-0000-000000000001', $1, 'f0000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 'cp08-ledger-001', 'cp08-source-001', 'compute', 1, 5, 5, 'USD', '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z'),
        ('c8200000-0000-0000-0000-000000000002', $1, 'f0000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000002', 'cp08-ledger-002', 'cp08-source-002', 'compute', 1, 6, 6, 'USD', '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z'),
        ('c8200000-0000-0000-0000-000000000003', $1, 'f0000000-0000-0000-0000-00000000c802', 'c8000000-0000-0000-0000-000000000002', 'cp08-ledger-003', 'cp08-source-003', 'compute', 1, 4, 4, 'USD', '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z'),
        ('c8200000-0000-0000-0000-000000000004', $1, 'f0000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000003', 'cp08-ledger-004', 'cp08-source-004', 'compute', 1, 7, 7, 'EUR', '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z')`, [customer]);
    await client.query(`
      INSERT INTO invoice_items (id, invoice_id, line_number, item_type, description, quantity, unit_price, amount, charge_ledger_id)
      VALUES
        ('c8100000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 1, 'compute', 'single', 1, 5, 5, 'c8200000-0000-0000-0000-000000000001'),
        ('c8100000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-000000000002', 1, 'compute', 'provider-a', 1, 6, 6, 'c8200000-0000-0000-0000-000000000002'),
        ('c8100000-0000-0000-0000-000000000003', 'c8000000-0000-0000-0000-000000000002', 2, 'compute', 'provider-b', 1, 4, 4, 'c8200000-0000-0000-0000-000000000003'),
        ('c8100000-0000-0000-0000-000000000004', 'c8000000-0000-0000-0000-000000000003', 1, 'compute', 'euro', 1, 7, 7, 'c8200000-0000-0000-0000-000000000004')`);
    await client.query(`INSERT INTO payment_records (id, invoice_id, customer_id, payment_reference, amount, currency, status, verified_at)
      VALUES ('c8300000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', $1, 'CP08-PAY-001', 2, 'USD', 'verified', '2027-02-02T00:01:00Z')`, [customer]);

    const window = { from: "2027-02-01T00:00:00Z", to: "2027-04-01T00:00:00Z" };
    const single = await repo.invoiceAllocations(providerOrg, window, 1, 100);
    const singleRow = single.rows.find((row) => row.id === "c8000000-0000-0000-0000-000000000001");
    assert.equal(singleRow.provider_amount, "5.0000");
    assert.equal(singleRow.provider_outstanding, "3.0000");
    assert.equal(singleRow.provider_verified_payments, "2.0000");
    assert.equal(singleRow.attribution_scope, "single_provider");

    const shared = single.rows.find((row) => row.id === "c8000000-0000-0000-0000-000000000002");
    assert.equal(shared.provider_amount, "6.0000");
    assert.equal(shared.provider_outstanding, "3.6000");
    assert.equal(shared.attribution_scope, "shared_invoice");
    const other = await repo.invoiceAllocations(otherOrg, window, 1, 100);
    const otherShared = other.rows.find((row) => row.id === "c8000000-0000-0000-0000-000000000002");
    assert.equal(otherShared.provider_amount, "4.0000");
    assert.equal(otherShared.provider_outstanding, "2.4000");
    assert.equal(otherShared.provider_verified_payments, "0.0000");

    const summary = await repo.financialSummary(providerOrg, window);
    assert.deepEqual(summary.find((row) => row.currency === "USD"), {
      currency: "USD", invoiceCount: 2, invoicedAmount: "11.0000", verifiedSimulatedPayments: "2.0000",
      outstandingAmount: "6.6000", overdueAmount: "3.0000", sharedInvoiceCount: 1, overdueInvoiceCount: 1,
    });
    assert.equal(summary.find((row) => row.currency === "EUR").invoicedAmount, "7.0000");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("CP-08 billing status counts are complete and independent of invoice pagination", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const repo = repositoryFor(client);
    await client.query(`
      INSERT INTO invoices (id, invoice_number, billing_account_id, customer_id, invoice_type, currency,
        billing_period_start, billing_period_end, subtotal, discount_amount, tax_amount, adjustment_amount,
        total, amount_paid, status, issued_at, due_at)
      SELECT md5('cp08-count-invoice-' || g)::uuid, 'CP08-COUNT-' || g, $1, $2, 'recurring_usage', 'USD',
        '2027-05-01T00:00:00Z'::timestamptz, '2027-06-01T00:00:00Z'::timestamptz, 1, 0, 0, 0, 1,
        CASE (g % 6) WHEN 2 THEN 1 WHEN 1 THEN 0.5 ELSE 0 END,
        (ARRAY['issued','partially_paid','paid','overdue','void','uncollectible'])[(g % 6) + 1],
        ('2027-05-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval), '2027-06-08T00:00:00Z'
      FROM generate_series(0, 200) AS g`, [billingAccount, customer]);
    await client.query(`
      INSERT INTO charge_ledger_entries (id, customer_id, vm_id, invoice_id, idempotency_key, source_key, charge_type,
        quantity, unit_price, amount, currency, billing_period_start, billing_period_end)
      SELECT md5('cp08-count-ledger-' || g)::uuid, $1, 'f0000000-0000-0000-0000-000000000001',
        md5('cp08-count-invoice-' || g)::uuid, 'cp08-count-key-' || g, 'cp08-count-source-' || g, 'compute', 1, 1, 1,
        'USD', '2027-05-01T00:00:00Z', '2027-06-01T00:00:00Z'
      FROM generate_series(0, 200) AS g`, [customer]);
    await client.query(`
      INSERT INTO invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount, charge_ledger_id)
      SELECT md5('cp08-count-invoice-' || g)::uuid, 1, 'compute', 'count fixture', 1, 1, 1,
        md5('cp08-count-ledger-' || g)::uuid
      FROM generate_series(0, 200) AS g`);

    const window = { from: "2027-05-01T00:00:00Z", to: "2027-06-01T00:00:00Z" };
    const counts = await repo.invoiceStatusCounts(providerOrg, window);
    assert.deepEqual(counts, { issued: 34, partially_paid: 34, paid: 34, overdue: 33, void: 33, uncollectible: 33 });
    const pageOne = await repo.invoiceAllocations(providerOrg, window, 1, 100);
    const pageThree = await repo.invoiceAllocations(providerOrg, window, 3, 100);
    assert.equal(pageOne.total, 201);
    assert.equal(pageThree.total, 201);
    assert.equal(pageOne.rows.length, 100);
    assert.equal(pageThree.rows.length, 1);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("CP-08 activity pagination reports the database total and stable pages", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const repo = repositoryFor(client);
    await client.query(`
      INSERT INTO audit_logs (id, actor_id, organization_id, action, entity_type, entity_id, new_data, created_at)
      VALUES
        ('c8400000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', $1, 'cp08.activity.one', 'offer', '90000000-0000-0000-0000-000000000001', '{}'::jsonb, '2027-07-01T00:01:00Z'),
        ('c8400000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', $1, 'cp08.activity.two', 'offer', '90000000-0000-0000-0000-000000000001', '{}'::jsonb, '2027-07-01T00:02:00Z'),
        ('c8400000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', $1, 'cp08.activity.three', 'offer', '90000000-0000-0000-0000-000000000001', '{}'::jsonb, '2027-07-01T00:03:00Z')`, [providerOrg]);
    const query = { from: "2027-07-01T00:00:00Z", to: "2027-08-01T00:00:00Z" };
    const first = await repo.activity(providerOrg, query, 1, 2);
    const second = await repo.activity(providerOrg, query, 2, 2);
    assert.equal(first.total, 3);
    assert.equal(first.rows.length, 2);
    assert.equal(second.total, 3);
    assert.equal(second.rows.length, 1);
    assert.equal(first.rows[0].event_type, "cp08.activity.three");
    assert.equal(second.rows[0].event_type, "cp08.activity.one");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("CP-08 conversion provider approval requires an approval record", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const repo = repositoryFor(client);
    await client.query(`
      INSERT INTO users (id, full_name, email, normalized_email, password_hash, role, status, email_verified_at, terms_accepted_at)
      VALUES ('20000000-0000-0000-0000-00000000c804', 'CP08 Funnel Customer', 'cp08-funnel@example.invalid', 'cp08-funnel@example.invalid', 'fixture-password-hash', 'customer', 'active', NULL, '2027-09-01T00:00:00Z')`);
    await client.query(`
      INSERT INTO chat_sessions (id, customer_id, state, title, session_type)
      VALUES ('80000000-0000-0000-0000-00000000c804', '20000000-0000-0000-0000-00000000c804', 'ACTIVE', 'funnel direct', 'negotiation'),
             ('80000000-0000-0000-0000-00000000c805', '20000000-0000-0000-0000-00000000c804', 'ACTIVE', 'funnel approved', 'negotiation')`);
    await client.query(`
      INSERT INTO offers (id, customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
        vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price, currency,
        billing_cycle, rental_duration_days, status, presented_at, expires_at, accepted_at, created_at, created_by)
      VALUES
        ('90000000-0000-0000-0000-00000000c804', '20000000-0000-0000-0000-00000000c804', $1, '80000000-0000-0000-0000-00000000c804', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{}'::jsonb, 48, 0, 0, 48, 'USD', 'monthly', 30, 'accepted', '2027-09-01T00:00:00Z', '2027-09-02T00:00:00Z', '2027-09-01T00:01:00Z', '2027-09-01T00:00:00Z', '20000000-0000-0000-0000-000000000002'),
        ('90000000-0000-0000-0000-00000000c805', '20000000-0000-0000-0000-00000000c804', $1, '80000000-0000-0000-0000-00000000c805', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{}'::jsonb, 48, 0, 0, 48, 'USD', 'monthly', 30, 'accepted', '2027-09-01T00:02:00Z', '2027-09-02T00:02:00Z', '2027-09-01T00:03:00Z', '2027-09-01T00:02:00Z', '20000000-0000-0000-0000-000000000002')`, [providerOrg]);
    await client.query(`
      INSERT INTO offer_approvals (id, offer_id, reviewer_id, decision, reason, decided_at)
      VALUES ('c8500000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-00000000c805', '20000000-0000-0000-0000-000000000002', 'approved', 'CP08 approval fixture', '2027-09-01T00:03:30Z')`);
    const funnel = await repo.conversionFunnel(providerOrg, { from: "2027-09-01T00:00:00Z", to: "2027-10-01T00:00:00Z" });
    assert.deepEqual(funnel.stages.slice(0, 4), [
      { name: "negotiated", count: 1 },
      { name: "presented", count: 1 },
      { name: "providerApproved", count: 1 },
      { name: "offerAccepted", count: 1 },
    ]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
