CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS printers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  location        TEXT,
  api_key         TEXT UNIQUE NOT NULL,
  is_online       BOOLEAN DEFAULT FALSE,
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      TEXT NOT NULL,
  printer_id      UUID REFERENCES printers(id) ON DELETE SET NULL,
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  pages           INTEGER NOT NULL,
  copies          INTEGER NOT NULL DEFAULT 1,
  color           BOOLEAN DEFAULT FALSE,
  double_sided    BOOLEAN DEFAULT FALSE,
  cost            NUMERIC(8, 2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','queued','printing','done','failed')),
  qr_token        TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          TEXT NOT NULL,
  job_id              UUID REFERENCES jobs(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT,
  amount              NUMERIC(8, 2) NOT NULL,
  currency            TEXT DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','paid','failed')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_printer_id   ON jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_college_id    ON jobs(college_id);
CREATE INDEX IF NOT EXISTS idx_jobs_qr_token      ON jobs(qr_token);
CREATE INDEX IF NOT EXISTS idx_payments_job_id    ON payments(job_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
