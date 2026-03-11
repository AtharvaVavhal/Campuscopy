CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS colleges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(200) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id    UUID REFERENCES colleges(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS printers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id     UUID REFERENCES colleges(id) ON DELETE SET NULL,
  name           VARCHAR(200) NOT NULL,
  location       VARCHAR(200),
  is_online      BOOLEAN DEFAULT FALSE,
  last_heartbeat TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(50) UNIQUE NOT NULL,
  discount_type  VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order      NUMERIC(10,2) DEFAULT 0,
  max_uses       INTEGER DEFAULT 9999,
  uses_left      INTEGER DEFAULT 9999,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS coupon_uses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id       UUID REFERENCES coupons(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10,2),
  used_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      VARCHAR(20) NOT NULL,
  delta      INTEGER NOT NULL,
  reason     VARCHAR(30) DEFAULT 'earned',
  job_id     UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_points(phone);

INSERT INTO colleges (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Vishwakarma Institute of Technology')
ON CONFLICT DO NOTHING;

INSERT INTO printers (id, college_id, name, location) VALUES
  ('5b4bedf3-3550-4faa-ac3d-d4f490772258',
   '00000000-0000-0000-0000-000000000001',
   'Main Printer', 'Ground Floor')
ON CONFLICT DO NOTHING;

INSERT INTO admins (college_id, name, email, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Admin',
   'admin@campuscopy.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOCC4MVLf7Jb3qCf1K/E3lVb.bMRsV0T2')
ON CONFLICT DO NOTHING;
