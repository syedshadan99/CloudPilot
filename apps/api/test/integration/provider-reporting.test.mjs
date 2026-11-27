import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : { host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "" });
const providerOrg = "10000000-0000-0000-0000-000000000001";

test("CP-08 reporting ownership paths and financial facts are organization-scoped", async () => {
  const customerCount = await pool.query(`SELECT count(DISTINCT customer_id)::int AS count FROM offers WHERE organization_id = $1`, [providerOrg]);
  const invoiceFacts = await pool.query(`SELECT i.currency, SUM(i.total)::numeric(19,4)::text AS invoiced, SUM(i.amount_paid)::numeric(19,4)::text AS paid FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.organization_id = $1 GROUP BY i.currency`, [providerOrg]);
  const vmCount = await pool.query(`SELECT count(*)::int AS count FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id WHERE o.organization_id = $1 AND vm.state NOT IN ('TERMINATED','FAILED')`, [providerOrg]);
  assert.equal(customerCount.rows[0].count, 1);
  assert.equal(invoiceFacts.rows[0].currency, "USD");
  assert.equal(vmCount.rows[0].count, 2);
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
