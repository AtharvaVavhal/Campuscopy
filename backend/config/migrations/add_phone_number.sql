-- Migration: Add phone_number to jobs table
-- Run this once against your existing database.
-- Safe to re-run (uses IF NOT EXISTS equivalent via DO block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE jobs ADD COLUMN phone_number TEXT;
    RAISE NOTICE 'Added phone_number column to jobs table';
  ELSE
    RAISE NOTICE 'phone_number column already exists — skipping';
  END IF;
END $$;

-- Optional: index for order history lookup by phone
CREATE INDEX IF NOT EXISTS idx_jobs_phone_number ON jobs(phone_number);