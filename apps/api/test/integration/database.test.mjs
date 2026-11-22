import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST ?? "127.0.0.1",
        port: Number(process.env.PGPORT ?? 5432),
        database: process.env.PGDATABASE ?? "cloudpilot",
        user: process.env.PGUSER ?? "cloudpilot",
        password: process.env.PGPASSWORD ?? "",
      },
);

async function expectConstraintError(query, values = []) {
  await assert.rejects(
    pool.query(query, values),
    (error) => ["23503", "23505", "23514", "23P01"].includes(error.code),
  );
}

test("migration tracking and core tables are present", async () => {
  const migrationResult = await pool.query(
    "SELECT version FROM schema_migrations WHERE version BETWEEN 1 AND 10 ORDER BY version",
  );
  assert.deepEqual(
    migrationResult.rows.map((row) => row.version),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );

  const requiredTables = [
    "users",
    "sessions",
    "organizations",
    "vm_templates",
    "pricing_versions",
    "offers",
    "negotiation_attempts",
    "orders",
    "billing_accounts",
    "invoices",
    "invoice_items",
    "payment_records",
    "provisioning_jobs",
    "virtual_machines",
    "usage_records",
    "upgrade_requests",
    "notifications",
    "support_tickets",
    "audit_logs",
    "idempotency_keys",
    "outbox_events",
  ];
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  assert.deepEqual(
    result.rows.map((row) => row.table_name).sort(),
    [...requiredTables].sort(),
  );

  const upgradeColumns = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'upgrade_requests'
      AND column_name = ANY($1::text[])
    ORDER BY column_name
  `, [["customer_confirmed_at", "attempt_count", "max_attempts", "last_error", "started_at", "completed_at"]]);
  assert.deepEqual(
    upgradeColumns.rows.map((row) => row.column_name),
    ["attempt_count", "completed_at", "customer_confirmed_at", "last_error", "max_attempts", "started_at"],
  );
});

test("foreign keys and check constraints reject invalid records", async () => {
  await expectConstraintError(
    `INSERT INTO chat_sessions (customer_id, state) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'NEW')`,
  );
  await expectConstraintError(
    `INSERT INTO usage_records (
       id, vm_id, period_start, period_end, cpu_percent, ram_percent,
       disk_read_mb, disk_write_mb, net_in_mb, net_out_mb
     ) VALUES (
       gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001',
       '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', 10, 10, 0, 0, 0, 0
     )`,
  );
  await expectConstraintError(
    `INSERT INTO usage_records (
       id, vm_id, period_start, period_end, cpu_percent, ram_percent,
       disk_read_mb, disk_write_mb, net_in_mb, net_out_mb
     ) VALUES (
       gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001',
       '2026-01-03T00:00:00Z', '2026-01-03T12:00:00Z', 10, 10, 0, 0, 0, 0
     )`,
  );
});

test("commercial uniqueness and payment gate are represented", async () => {
  await expectConstraintError(
    `INSERT INTO invoices (
       id, invoice_number, billing_account_id, customer_id, order_id, invoice_type,
       currency, billing_period_start, billing_period_end, subtotal, total
     ) VALUES (
       gen_random_uuid(), 'INV-DUPLICATE-INITIAL',
       'b0000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'a0000000-0000-0000-0000-000000000001', 'initial_order', 'USD',
       '2026-01-02T10:20:00Z', '2026-02-01T10:20:00Z', 0, 0
     )`,
  );

  const unpaidProvisioning = await pool.query(`
    SELECT count(*)::int AS count
    FROM orders
    WHERE status IN ('payment_verified', 'provisioning', 'active', 'completed')
      AND payment_verified_at IS NULL
  `);
  assert.equal(unpaidProvisioning.rows[0].count, 0);

  const invoiceTotals = await pool.query(`
    SELECT i.invoice_number, i.total, COALESCE(sum(ii.amount), 0) AS item_total
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    GROUP BY i.id
    HAVING i.total <> COALESCE(sum(ii.amount), 0)
  `);
  assert.equal(invoiceTotals.rowCount, 0);
});

test("seed data has stable demonstration counts and required indexes", async () => {
  const counts = await pool.query(`
    SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM vm_templates) AS templates,
      (SELECT count(*) FROM orders) AS orders,
      (SELECT count(*) FROM invoices) AS invoices,
      (SELECT count(*) FROM virtual_machines) AS vms
  `);
  assert.deepEqual(counts.rows[0], {
    users: "3",
    templates: "4",
    orders: "3",
    invoices: "4",
    vms: "3",
  });

  const indexes = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY($1::text[])
  `, [[
    "uq_users_normalized_email",
    "uq_initial_invoice_per_order",
    "usage_records_no_overlap",
    "idx_outbox_queue",
  ]]);
  assert.equal(indexes.rowCount, 4);
});

after(async () => {
  await pool.end();
});
