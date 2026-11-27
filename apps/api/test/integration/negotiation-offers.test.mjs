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
  const client = await pool.connect();
  await client.query("BEGIN");
  const fixture = {
    chatSessionId: "80000000-0000-0000-0000-0000000000c5",
    offerId: "90000000-0000-0000-0000-0000000000c5",
    customerId: "20000000-0000-0000-0000-000000000001",
    organizationId: "10000000-0000-0000-0000-000000000001",
    pricingVersionId: "30000000-0000-0000-0000-000000000001",
    negotiationPolicyId: "70000000-0000-0000-0000-000000000001",
    vmTemplateId: "40000000-0000-0000-0000-000000000002",
    providerUserId: "20000000-0000-0000-0000-000000000002",
  };

  try {
    await client.query(
      `INSERT INTO chat_sessions (id, customer_id, state, title, session_type)
       VALUES ($1, $2, 'ACTIVE', 'CP-05 uniqueness fixture', 'negotiation')`,
      [fixture.chatSessionId, fixture.customerId],
    );

    const inserted = await client.query(
      `INSERT INTO offers
        (id, customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
         vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
         currency, billing_cycle, rental_duration_days, status, presented_at, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        fixture.offerId,
        fixture.customerId,
        fixture.organizationId,
        fixture.chatSessionId,
        fixture.pricingVersionId,
        fixture.negotiationPolicyId,
        fixture.vmTemplateId,
        JSON.stringify({ template: "starter", cpu_cores: 2, ram_gb: 4, storage_gb: 50 }),
        48,
        0,
        0,
        48,
        "USD",
        "monthly",
        30,
        "pending_provider_review",
        "2026-01-01T00:00:00Z",
        "2099-01-01T00:00:00Z",
        fixture.providerUserId,
      ],
    );
    assert.equal(inserted.rowCount, 1);

    await assert.rejects(
      client.query(`INSERT INTO offers
        (customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
         vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
         currency, billing_cycle, rental_duration_days, status, presented_at, expires_at)
       SELECT customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
              vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
              currency, billing_cycle, rental_duration_days, status, NOW(), NOW() + INTERVAL '30 minutes'
         FROM offers WHERE id = $1`, [fixture.offerId]),
      (error) => error.code === "23505",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

after(async () => pool.end());
