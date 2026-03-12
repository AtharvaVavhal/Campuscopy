-- Migration: Add mac_address and api_key columns to printers table
-- Required for print-bridge auto-registration and heartbeat auth.
-- Safe to re-run (checks before adding each column).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'mac_address'
  ) THEN
    ALTER TABLE printers ADD COLUMN mac_address VARCHAR(50) UNIQUE;
    RAISE NOTICE 'Added mac_address column to printers';
  ELSE
    RAISE NOTICE 'mac_address already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE printers ADD COLUMN api_key VARCHAR(100) UNIQUE;
    RAISE NOTICE 'Added api_key column to printers';
  ELSE
    RAISE NOTICE 'api_key already exists — skipping';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_printers_mac_address ON printers(mac_address);
