const { Pool } = require("pg");

// Render provides DATABASE_URL as a single connection string.
// Fall back to individual vars for local dev.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Render PostgreSQL
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || "localhost",
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || "campuscopy",
      user:     process.env.DB_USER     || "postgres",
      password: process.env.DB_PASSWORD || "",
      ssl:      false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on("connect", () => console.log("PostgreSQL connected"));
pool.on("error",   (err) => console.error("PostgreSQL error:", err.message));

pool.query("SELECT 1")
  .then(() => {
    console.log("✅ DB connection verified");
    // Auto-migrate: create push_subscriptions if it doesn't exist yet
    return pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
        phone      TEXT,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (job_id, endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_push_job_id ON push_subscriptions(job_id);
    `);
  })
  .then(() => console.log("✅ Migrations applied"))
  .catch((err) => console.error("DB error:", err.message));

module.exports = pool;