/*
  # Fix invoices table - add missing columns

  The invoices table was missing several columns that the frontend relies on
  for proper invoice generation and display.

  ## Modified Tables
    - `invoices`
      - Add `billing_period_start` (date) - start of billing period
      - Add `billing_period_end` (date) - end of billing period
      - Add `subtotal` (numeric) - pre-tax total, default 0
      - Add `tax_amount` (numeric) - tax amount, default 0
      - Add `total_amount` (numeric) - final total including tax, default 0
      - Add `paid_date` (date) - date payment was received
      - Add `notes` (text) - optional notes on the invoice

  ## Important Notes
    - Existing `amount` column preserved for backward compatibility
    - All new numeric columns default to 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'billing_period_start'
  ) THEN
    ALTER TABLE invoices ADD COLUMN billing_period_start date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'billing_period_end'
  ) THEN
    ALTER TABLE invoices ADD COLUMN billing_period_end date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE invoices ADD COLUMN subtotal numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tax_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN paid_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE invoices ADD COLUMN notes text;
  END IF;
END $$;

-- Backfill total_amount from the existing amount column for any old rows
UPDATE invoices SET total_amount = COALESCE(amount, 0), subtotal = COALESCE(amount, 0)
WHERE total_amount = 0 AND amount IS NOT NULL AND amount > 0;
