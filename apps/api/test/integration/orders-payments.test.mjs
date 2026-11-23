import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "",
});

test("CP-06 schema exposes one-order/one-initial-invoice and payment gate primitives", async () => {
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('orders','order_events','billing_accounts','invoices','invoice_items','payment_records','capacity_reservations','idempotency_keys','outbox_events') ORDER BY table_name`);
  assert.deepEqual(tables.rows.map((row) => row.table_name), ["billing_accounts", "capacity_reservations", "idempotency_keys", "invoice_items", "invoices", "order_events", "orders", "outbox_events", "payment_records"]);
  const indexes = await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('uq_initial_invoice_per_order','uq_verified_payment_per_order') ORDER BY indexname`);
  assert.deepEqual(indexes.rows.map((row) => row.indexname), ["uq_initial_invoice_per_order", "uq_verified_payment_per_order"]);
});

test("persisted orders and invoices retain exact financial equations", async () => {
  const result = await pool.query(`SELECT count(*)::int AS invalid FROM orders WHERE final_price <> base_price - discount_amount UNION ALL SELECT count(*)::int FROM invoices WHERE total <> subtotal - discount_amount + tax_amount + adjustment_amount OR amount_paid > total`);
  assert.deepEqual(result.rows.map((row) => row.invalid), [0, 0]);
});

test("verified payment evidence agrees with paid initial invoices", async () => {
  const result = await pool.query(`SELECT count(*)::int AS invalid FROM invoices i WHERE i.invoice_type = 'initial_order' AND i.status = 'paid' AND NOT EXISTS (SELECT 1 FROM payment_records p WHERE p.invoice_id = i.id AND p.order_id = i.order_id AND p.status = 'verified' AND p.amount = i.total AND p.currency = i.currency)`);
  assert.equal(result.rows[0].invalid, 0);
});

after(async () => pool.end());
