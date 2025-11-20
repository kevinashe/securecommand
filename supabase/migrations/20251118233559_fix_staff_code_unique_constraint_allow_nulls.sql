/*
  # Fix Staff Code Unique Constraint to Allow NULLs

  1. Problem
    - The unique constraint on (company_id, staff_code) treats multiple NULL values as duplicates
    - This prevents creating profiles without company_id (like super_admin)
    - PostgreSQL treats NULL values in unique constraints as equal by default

  2. Solution
    - Drop the existing constraint
    - Create a partial unique index that only applies when both values are NOT NULL
    - This allows multiple profiles with NULL values while ensuring uniqueness for actual staff codes

  3. Impact
    - Super admins and profiles without companies can be created without constraint violations
    - Staff codes remain unique within each company when assigned
*/

-- Drop the existing constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_company_staff_code_unique;

-- Create a partial unique index that only applies when both fields are NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_company_staff_code_unique 
ON profiles(company_id, staff_code) 
WHERE company_id IS NOT NULL AND staff_code IS NOT NULL;
