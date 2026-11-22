import assert from "node:assert/strict";
import test, { after } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "cloudpilot", user: process.env.PGUSER ?? "cloudpilot", password: process.env.PGPASSWORD ?? "",
});

test("seeded catalog capacity reflects committed reservations and excludes released capacity", async () => {
  const result = await pool.query(`
    SELECT p.total_cpu_cores, p.total_ram_gb, p.total_storage_gb,
           COALESCE(SUM(r.cpu_cores) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::int AS used_cpu,
           COALESCE(SUM(r.ram_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::int AS used_ram,
           COALESCE(SUM(r.storage_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::int AS used_storage
    FROM capacity_pools p LEFT JOIN capacity_reservations r ON r.pool_id = p.id
    WHERE p.id = '50000000-0000-0000-0000-000000000001'
    GROUP BY p.id`);
  assert.deepEqual(result.rows[0], { total_cpu_cores: 128, total_ram_gb: 512, total_storage_gb: 10000, used_cpu: 4, used_ram: 8, used_storage: 100 });
});

test("seeded prices and accepted commercial snapshots are separate records", async () => {
  const pricing = await pool.query(`SELECT status, currency FROM pricing_versions WHERE id = '30000000-0000-0000-0000-000000000001'`);
  assert.deepEqual(pricing.rows[0], { status: "active", currency: "USD" });
  const snapshot = await pool.query(`SELECT final_price, currency, pricing_version_id FROM orders WHERE id = 'a0000000-0000-0000-0000-000000000001'`);
  assert.equal(snapshot.rows[0].final_price, "44.0000");
  assert.equal(snapshot.rows[0].currency, "USD");
  assert.equal(snapshot.rows[0].pricing_version_id, "30000000-0000-0000-0000-000000000001");
});

test("pricing rule scope uniqueness is enforced by PostgreSQL", async () => {
  await assert.rejects(
    pool.query(`INSERT INTO pricing_rules (pricing_version_id, vm_template_id, rule_type, monthly_rate)
      VALUES ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'template_base', 1.0000)`),
    (error) => error.code === "23505",
  );
});

after(async () => pool.end());
