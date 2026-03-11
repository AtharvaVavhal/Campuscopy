-- Migration: Add missing columns to jobs table
-- Adds: qr_code, priority, page_from, page_to, updated_at
-- Safe to re-run (checks before adding each column)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE jobs ADD COLUMN qr_code TEXT;
    RAISE NOTICE 'Added qr_code column';
  ELSE
    RAISE NOTICE 'qr_code already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE jobs ADD COLUMN priority BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added priority column';
  ELSE
    RAISE NOTICE 'priority already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'page_from'
  ) THEN
    ALTER TABLE jobs ADD COLUMN page_from INTEGER;
    RAISE NOTICE 'Added page_from column';
  ELSE
    RAISE NOTICE 'page_from already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'page_to'
  ) THEN
    ALTER TABLE jobs ADD COLUMN page_to INTEGER;
    RAISE NOTICE 'Added page_to column';
  ELSE
    RAISE NOTICE 'page_to already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column';
  ELSE
    RAISE NOTICE 'updated_at already exists — skipping';
  END IF;
END $$;