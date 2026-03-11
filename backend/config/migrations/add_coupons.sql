-- Migration: Coupon Codes
-- Run once: psql -h localhost -p 5432 -U atharva -d campuscopy -f backend/config/migrations/add_coupons.sql

CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      TEXT NOT NULL DEFAULT 'college1',
  code            TEXT UNIQUE NOT NULL,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value  NUMERIC(8, 2) NOT NULL,
  min_order       NUMERIC(8, 2) DEFAULT 0,
  uses_left       INTEGER,           -- NULL = unlimited
  expires_at      TIMESTAMPTZ,       -- NULL = never expires
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       UUID REFERENCES coupons(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  saved_amount    NUMERIC(8, 2) NOT NULL,
  used_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code       ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon ON coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_job    ON coupon_uses(job_id);

-- Seed a test coupon: WELCOME10 = 10% off
INSERT INTO coupons (code, discount_type, discount_value, min_order, uses_left)
VALUES ('WELCOME10', 'percent', 10, 5, 100)
ON CONFLICT (code) DO NOTHING;

-- Seed a flat coupon: FLAT2 = ₹2 off any order above ₹10
INSERT INTO coupons (code, discount_type, discount_value, min_order, uses_left)
VALUES ('FLAT2', 'flat', 2, 10, 50)
ON CONFLICT (code) DO NOTHING;