-- Migration: prevent duplicate loyalty earn/redeem rows for the same job
-- Safe to run multiple times (IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_job_type
  ON loyalty_transactions(job_id, type) WHERE job_id IS NOT NULL;