/*
  # Update Pricing Plans to Dual Fee Structure

  1. Changes to pricing_plans table
    - Rename existing price fields to license fees
    - Add per-guard fees
    - Update to support:
      * Monthly/yearly license fee (base platform fee)
      * Monthly/yearly per-guard fee (charged per active guard)
  
  2. New Columns
    - `monthly_license_fee` - base monthly platform fee
    - `yearly_license_fee` - base yearly platform fee
    - `per_guard_monthly_fee` - fee per guard per month
    - `per_guard_yearly_fee` - fee per guard per year
  
  3. Notes
    - Total monthly cost = monthly_license_fee + (per_guard_monthly_fee * number_of_guards)
    - Total yearly cost = yearly_license_fee + (per_guard_yearly_fee * number_of_guards)
    - Old price columns will be renamed for clarity
*/

-- Add new columns for per-guard fees
ALTER TABLE pricing_plans 
  ADD COLUMN IF NOT EXISTS per_guard_monthly_fee decimal(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_guard_yearly_fee decimal(10, 2) DEFAULT 0;

-- Rename existing price columns to be more specific
ALTER TABLE pricing_plans 
  RENAME COLUMN monthly_price TO monthly_license_fee;

ALTER TABLE pricing_plans 
  RENAME COLUMN yearly_price TO yearly_license_fee;

-- Update existing plans with per-guard fees
UPDATE pricing_plans 
SET 
  per_guard_monthly_fee = CASE 
    WHEN name = 'Basic' THEN 5.00
    WHEN name = 'Professional' THEN 4.00
    WHEN name = 'Enterprise' THEN 3.00
    ELSE 5.00
  END,
  per_guard_yearly_fee = CASE 
    WHEN name = 'Basic' THEN 50.00
    WHEN name = 'Professional' THEN 40.00
    WHEN name = 'Enterprise' THEN 30.00
    ELSE 50.00
  END
WHERE name IN ('Basic', 'Professional', 'Enterprise');

-- Add helpful comment
COMMENT ON COLUMN pricing_plans.monthly_license_fee IS 'Base monthly platform fee (not per-guard)';
COMMENT ON COLUMN pricing_plans.yearly_license_fee IS 'Base yearly platform fee (not per-guard)';
COMMENT ON COLUMN pricing_plans.per_guard_monthly_fee IS 'Additional fee per guard per month';
COMMENT ON COLUMN pricing_plans.per_guard_yearly_fee IS 'Additional fee per guard per year';
