/*
  # Add Per-Company Custom Pricing

  1. Changes
    - Add `custom_license_fee` column to companies table (nullable)
    - Add `custom_per_guard_fee` column to companies table (nullable)
    - If null, the system will use global billing_settings rates
    - If set, the company gets custom pricing (e.g., volume discounts)

  2. Security
    - No RLS changes needed - existing company policies apply
  
  3. Notes
    - Allows super admin to set custom pricing per company
    - Useful for volume discounts, special contracts, etc.
    - NULL values mean "use global default pricing"
*/

-- Add custom pricing columns to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'custom_license_fee'
  ) THEN
    ALTER TABLE companies ADD COLUMN custom_license_fee numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'custom_per_guard_fee'
  ) THEN
    ALTER TABLE companies ADD COLUMN custom_per_guard_fee numeric;
  END IF;
END $$;