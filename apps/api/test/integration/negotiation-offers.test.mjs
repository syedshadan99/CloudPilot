import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "",
});

test("CP-05 schema has durable attempts, lineage and actionable-offer protection", async () => {
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('negotiation_attempts','offers') ORDER BY table_name`);
  assert.deepEqual(tables.rows.map((row) => row.table_name), ["negotiation_attempts", "offers"]);
  const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'offers' AND column_name = ANY($1::text[]) ORDER BY column_name`, [["commercial_snapshot", "negotiation_attempt_id", "parent_offer_id"]]);
  assert.deepEqual(columns.rows.map((row) => row.column_name), ["commercial_snapshot", "negotiation_attempt_id", "parent_offer_id"]);
  const index = await pool.query(`SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_offers_one_actionable_per_chat'`);
  assert.equal(index.rowCount, 1);
});

test("all persisted offer money snapshots satisfy the database equation", async () => {
  const result = await pool.query(`SELECT count(*)::int AS invalid FROM offers WHERE final_price <> base_price - discount_amount`);
  assert.equal(result.rows[0].invalid, 0);
});

test("the actionable-offer uniqueness constraint rejects a second current proposal", async () => {
  await pool.query("BEGIN");
  try {
    await assert.rejects(
      pool.query(`INSERT INTO offers
        (customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
         vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
         currency, billing_cycle, rental_duration_days, status, presented_at, expires_at)
       SELECT customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
              vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
              currency, billing_cycle, rental_duration_days, status, NOW(), NOW() + INTERVAL '30 minutes'
         FROM offers WHERE status = 'pending_provider_review' LIMIT 1`),
      (error) => error.code === "23505",
    );
  } finally {
    await pool.query("ROLLBACK");
  }
});

after(async () => pool.end());
