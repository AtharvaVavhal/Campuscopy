const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
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

async function runMigrations() {
  const migrations = [
    // ── Push subscriptions ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
      phone      TEXT,
      endpoint   TEXT NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (job_id, endpoint)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_push_job_id ON push_subscriptions(job_id)`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS phone TEXT`,

    // ── Coupons ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS coupons (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id     TEXT NOT NULL DEFAULT 'college1',
      code           TEXT UNIQUE NOT NULL,
      discount_type  TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
      discount_value NUMERIC(8,2) NOT NULL,
      min_order      NUMERIC(8,2) DEFAULT 0,
      uses_left      INTEGER,
      expires_at     TIMESTAMPTZ,
      is_active      BOOLEAN DEFAULT TRUE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS coupon_uses (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coupon_id    UUID REFERENCES coupons(id) ON DELETE CASCADE,
      job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,
      saved_amount NUMERIC(8,2) NOT NULL,
      used_at      TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_coupons_code        ON coupons(code)`,
    `CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon  ON coupon_uses(coupon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_coupon_uses_job     ON coupon_uses(job_id)`,

    // ── Loyalty transactions ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number TEXT NOT NULL,
      college_id   TEXT NOT NULL DEFAULT 'college1',
      job_id       UUID REFERENCES jobs(id) ON DELETE SET NULL,
      type         TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
      points       INTEGER NOT NULL,
      description  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_transactions(phone_number)`,

    // ── Loyalty points ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS loyalty_points (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone      TEXT NOT NULL,
      delta      INTEGER NOT NULL,
      reason     TEXT,
      job_id     UUID REFERENCES jobs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_loyalty_points_phone ON loyalty_points(phone)`,

    // ── Admins table ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS admins (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id    TEXT NOT NULL DEFAULT 'college1',
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`,

    // ── Missing jobs columns ─────────────────────────────────
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qr_code             TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority            BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS page_from           INTEGER`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS page_to             INTEGER`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS razorpay_order_id   TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS coupon_id           UUID`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS discount_amount     NUMERIC(8,2) DEFAULT 0`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER DEFAULT 0`,

    // ── Printer auth columns (for print bridge) ────────────
    `ALTER TABLE printers ADD COLUMN IF NOT EXISTS mac_address TEXT`,
    `ALTER TABLE printers ADD COLUMN IF NOT EXISTS api_key     TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_mac ON printers(mac_address) WHERE mac_address IS NOT NULL`,

    // ── Colleges table Phase 3 columns ──────────────────────
    `ALTER TABLE colleges ADD COLUMN IF NOT EXISTS razorpay_key_id     TEXT`,
    `ALTER TABLE colleges ADD COLUMN IF NOT EXISTS razorpay_key_secret TEXT`,
    `ALTER TABLE colleges ADD COLUMN IF NOT EXISTS platform_fee_pct    NUMERIC(5,2) DEFAULT 3.0`,
    `ALTER TABLE colleges ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'active'`,
    `ALTER TABLE colleges ADD COLUMN IF NOT EXISTS email               TEXT`,

  ];

  for (const sql of migrations) {
    await pool.query(sql);
  }
}

pool.query("SELECT 1")
  .then(() => {
    console.log("✅ DB connection verified");
    return runMigrations();
  })
  .then(() => console.log("✅ Migrations applied"))
  .catch((err) => console.error("DB error:", err.message));

module.exports = pool;