import assert from "node:assert/strict";
import test, { after } from "node:test";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "cloudpilot",
  user: process.env.PGUSER ?? "cloudpilot",
  password: process.env.PGPASSWORD ?? "",
});

test("seeded demo password is verifiable by the Node bcrypt implementation", async () => {
  const result = await pool.query("SELECT password_hash FROM users WHERE normalized_email = $1", ["customer.demo@cloudpilot.invalid"]);
  assert.equal(result.rowCount, 1);
  assert.equal(await bcrypt.compare("cloudpilot-demo-only", result.rows[0].password_hash), true);
  assert.equal(await bcrypt.compare("not-the-demo-password", result.rows[0].password_hash), false);
});

after(async () => pool.end());
