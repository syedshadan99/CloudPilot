import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : { host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "" });

test("CP-07 migration exposes durable billing period and source idempotency primitives", async () => {
  const tables = await pool.query("SELECT to_regclass('public.billing_periods') AS billing_periods");
  assert.equal(tables.rows[0].billing_periods, "billing_periods");
  const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name IN ('runtime_seconds','rated_at') ORDER BY column_name");
  assert.deepEqual(columns.rows.map((row) => row.column_name), ["rated_at", "runtime_seconds"]);
});

test("CP-07 existing invoices satisfy exact accounting equation", async () => {
  const result = await pool.query("SELECT count(*)::int AS invalid FROM invoices WHERE total <> subtotal - discount_amount + tax_amount + adjustment_amount OR amount_paid > total");
  assert.equal(result.rows[0].invalid, 0);
});

after(async () => pool.end());
