import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const migrationsDirectory = path.join(repositoryRoot, "database", "migrations");
const seedsDirectory = path.join(repositoryRoot, "database", "seeds");
const migrationLockKey = "cloudpilot-schema-migrations-v1";

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  return new Pool({
    ...(connectionString
      ? { connectionString }
      : {
          host: process.env.PGHOST ?? "127.0.0.1",
          port: Number(process.env.PGPORT ?? 5432),
          database: process.env.PGDATABASE ?? "cloudpilot",
          user: process.env.PGUSER ?? "cloudpilot",
          password: process.env.PGPASSWORD ?? "",
        }),
    connectionTimeoutMillis: 5000,
  });
}

function checksum(source) {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

function migrationNumber(fileName) {
  const match = /^(\d+)_.*\.sql$/u.exec(fileName);
  if (!match) {
    throw new Error(`Invalid migration filename: ${fileName}`);
  }
  return Number(match[1]);
}

async function sqlFiles(directory) {
  const names = (await fs.readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => migrationNumber(left) - migrationNumber(right));

  const seen = new Set();
  for (const name of names) {
    const version = migrationNumber(name);
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version: ${version}`);
    }
    seen.add(version);
  }
  return names;
}

function withoutExplicitTransactionBlock(source) {
  // The first three committed migrations contain BEGIN/COMMIT. Strip only
  // those outer statements so the runner can make tracking atomic with DDL.
  return source
    .replace(/^\s*BEGIN;\s*/imu, "")
    .replace(/\s*COMMIT;\s*$/imu, "\n");
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version       INTEGER PRIMARY KEY,
      filename      TEXT NOT NULL UNIQUE,
      checksum      CHAR(64) NOT NULL,
      applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      execution_ms  INTEGER NOT NULL CHECK (execution_ms >= 0)
    )
  `);
}

async function acquireMigrationLock(client) {
  await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [migrationLockKey]);
}

async function releaseMigrationLock(client) {
  await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [migrationLockKey]);
}

export async function migrate(pool = createPool()) {
  const client = await pool.connect();
  try {
    await acquireMigrationLock(client);
    await ensureMigrationTable(client);

    const files = await sqlFiles(migrationsDirectory);
    const appliedResult = await client.query(
      "SELECT version, filename, checksum FROM schema_migrations ORDER BY version",
    );
    const applied = new Map(appliedResult.rows.map((row) => [row.version, row]));
    const availableVersions = new Set(files.map(migrationNumber));

    for (const row of applied.values()) {
      if (!availableVersions.has(row.version)) {
        throw new Error(`Applied migration ${row.version} (${row.filename}) is missing from disk`);
      }
    }

    const appliedFiles = [];
    for (const fileName of files) {
      const version = migrationNumber(fileName);
      const source = await fs.readFile(path.join(migrationsDirectory, fileName), "utf8");
      const digest = checksum(source);
      const existing = applied.get(version);

      if (existing) {
        if (existing.filename !== fileName || existing.checksum !== digest) {
          throw new Error(`Migration checksum drift detected for ${fileName}`);
        }
        appliedFiles.push(fileName);
        continue;
      }

      const startedAt = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(withoutExplicitTransactionBlock(source));
        await client.query(
          `INSERT INTO schema_migrations (version, filename, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [version, fileName, digest, Date.now() - startedAt],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${fileName} failed: ${error.message}`, { cause: error });
      }

      appliedFiles.push(fileName);
      console.log(`Applied ${fileName}`);
    }

    return appliedFiles;
  } finally {
    try {
      await releaseMigrationLock(client);
    } finally {
      client.release();
    }
  }
}

async function readStatus(pool = createPool()) {
  const client = await pool.connect();
  try {
    await acquireMigrationLock(client);
    await ensureMigrationTable(client);
    const files = await sqlFiles(migrationsDirectory);
    const rows = new Map(
      (await client.query("SELECT version, filename, checksum, applied_at, execution_ms FROM schema_migrations ORDER BY version")).rows
        .map((row) => [row.version, row]),
    );
    const status = [];
    for (const fileName of files) {
      const version = migrationNumber(fileName);
      const row = rows.get(version);
      const digest = checksum(await fs.readFile(path.join(migrationsDirectory, fileName), "utf8"));
      status.push({
        version,
        filename: fileName,
        status: row ? (row.checksum === digest ? "applied" : "checksum-drift") : "pending",
        appliedAt: row?.applied_at ?? null,
        executionMs: row?.execution_ms ?? null,
      });
    }
    for (const row of rows.values()) {
      if (!files.some((fileName) => migrationNumber(fileName) === row.version)) {
        status.push({ version: row.version, filename: row.filename, status: "missing-from-disk" });
      }
    }
    return status;
  } finally {
    try {
      await releaseMigrationLock(client);
    } finally {
      client.release();
    }
  }
}

async function seed(pool = createPool()) {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error("Demo seeds are disabled when NODE_ENV=production");
  }

  await migrate(pool);
  const client = await pool.connect();
  try {
    await acquireMigrationLock(client);
    const files = await sqlFiles(seedsDirectory);
    await client.query("BEGIN");
    try {
      for (const fileName of files) {
        const source = await fs.readFile(path.join(seedsDirectory, fileName), "utf8");
        await client.query(withoutExplicitTransactionBlock(source));
        console.log(`Seeded ${fileName}`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Seed failed: ${error.message}`, { cause: error });
    }
  } finally {
    try {
      await releaseMigrationLock(client);
    } finally {
      client.release();
    }
  }
}

async function main() {
  const command = process.argv[2] ?? "migrate";
  const pool = createPool();
  try {
    if (command === "migrate") {
      await migrate(pool);
    } else if (command === "status") {
      console.table(await readStatus(pool));
    } else if (command === "seed") {
      await seed(pool);
    } else {
      throw new Error(`Unknown database command: ${command}. Use migrate, status, or seed.`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Database command failed: ${error.message}`);
    process.exitCode = 1;
  });
}
