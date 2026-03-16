-- CampusCopy — PostgreSQL Schema
-- psql -U <user> -d campuscopy -f schema.sql
--
-- This file is the single source of truth for a fresh database.
-- Existing deployments are handled by db.js runMigrations().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Colleges (multi-college SaaS foundation) ──────────────────
CREATE TABLE IF NOT EXISTS colleges (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(200) NOT NULL,
  email               VARCHAR(200),
  razorpay_key_id     TEXT,
  razorpay_key_secret TEXT,
  platform_fee_pct    NUMERIC(5,2) DEFAULT 3.0,
  status              TEXT DEFAULT 'active',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Admins ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id    UUID REFERENCES colleges(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Printers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS printers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id     UUID REFERENCES colleges(id) ON DELETE SET NULL,
  name           VARCHAR(200) NOT NULL,
  location       VARCHAR(200),
  mac_address    TEXT,
  api_key        TEXT,
  is_online      BOOLEAN DEFAULT FALSE,
  last_heartbeat TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_mac
  ON printers(mac_address) WHERE mac_address IS NOT NULL;

-- ── Coupons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id     TEXT NOT NULL DEFAULT 'college1',
  code           VARCHAR(50) UNIQUE NOT NULL,
  discount_type  VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order      NUMERIC(10,2) DEFAULT 0,
  uses_left      INTEGER,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ── Jobs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id          UUID REFERENCES colleges(id) ON DELETE SET NULL,
  printer_id          UUID REFERENCES printers(id) ON DELETE SET NULL,
  coupon_id           UUID REFERENCES coupons(id) ON DELETE SET NULL,
  file_name           VARCHAR(300) NOT NULL,
  file_path           TEXT NOT NULL,
  pages               INTEGER NOT NULL,
  copies              INTEGER NOT NULL DEFAULT 1,
  color               BOOLEAN DEFAULT FALSE,
  double_sided        BOOLEAN DEFAULT FALSE,
  priority            BOOLEAN DEFAULT FALSE,
  page_from           INTEGER,
  page_to             INTEGER,
  cost                NUMERIC(10,2) NOT NULL,
  discount_amount     NUMERIC(10,2) DEFAULT 0,
  loyalty_points_used INTEGER DEFAULT 0,
  phone_number        VARCHAR(20),
  email               TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','queued','printing','done','failed','cancelled')),
  razorpay_order_id   VARCHAR(100),
  qr_token            UUID,
  qr_code             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_printer_id ON jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_phone      ON jobs(phone_number);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_qr_token   ON jobs(qr_token);

-- ── Coupon uses ───────────────────────────────────────────────
-- saved_amount matches the column name used in models/coupon.js
CREATE TABLE IF NOT EXISTS coupon_uses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id    UUID REFERENCES coupons(id) ON DELETE CASCADE,
  job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,
  saved_amount NUMERIC(10,2) NOT NULL,
  used_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon ON coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_job    ON coupon_uses(job_id);

-- ── Loyalty transactions (active ledger used by all routes) ───
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  college_id   TEXT NOT NULL DEFAULT 'college1',
  job_id       UUID REFERENCES jobs(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  points       INTEGER NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_transactions(phone_number);

-- ── OTP sessions (student WhatsApp login) ─────────────────────
CREATE TABLE IF NOT EXISTS otp_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      VARCHAR(20) NOT NULL,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_sessions(phone);

-- ── Push subscriptions (web push per job) ─────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
  phone      TEXT,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_job_id ON push_subscriptions(job_id);

-- ── Seed: default college ─────────────────────────────────────
INSERT INTO colleges (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Vishwakarma Institute of Technology')
ON CONFLICT DO NOTHING;

-- ── Seed: default printer ─────────────────────────────────────
INSERT INTO printers (id, college_id, name, location) VALUES
  ('5b4bedf3-3550-4faa-ac3d-d4f490772258',
   '00000000-0000-0000-0000-000000000001',
   'Main Printer', 'Ground Floor')
ON CONFLICT DO NOTHING;

-- ── Seed: default admin (password: admin123) ──────────────────
-- To regenerate: node -e "require('bcryptjs').hash('yourpass',10).then(console.log)"
INSERT INTO admins (college_id, name, email, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Admin',
   'admin@campuscopy.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOCC4MVLf7Jb3qCf1K/E3lVb.bMRsV0T2')
ON CONFLICT DO NOTHING;