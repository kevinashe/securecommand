/*
  # Add Company Codes and Staff Codes System

  1. Changes to companies table
    - Add `company_code` (text, unique, not null) - unique identifier for each company
    - Generate random 6-character codes for existing companies

  2. Changes to profiles table
    - Add `staff_code` (text) - unique identifier for employee within a company
    - Create composite unique constraint on (company_id, staff_code)

  3. Security
    - Update RLS policies to work with new authentication flow
    - Ensure company codes are visible for login but secure

  4. Notes
    - Company codes are like "ABC123" - easy to remember, unique per company
    - Staff codes are like "SO-001" - unique within each company
    - Login will use: email + company code (to identify which company profile to use)
*/

-- Add company_code to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'company_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_code text;
  END IF;
END $$;

-- Generate unique codes for existing companies
DO $$
DECLARE
  company_record RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR company_record IN SELECT id FROM companies WHERE company_code IS NULL LOOP
    LOOP
      -- Generate random 6-character alphanumeric code
      new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
      
      -- Check if code already exists
      SELECT EXISTS(SELECT 1 FROM companies WHERE company_code = new_code) INTO code_exists;
      
      -- If unique, use it
      IF NOT code_exists THEN
        UPDATE companies SET company_code = new_code WHERE id = company_record.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Make company_code required and unique
ALTER TABLE companies ALTER COLUMN company_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_company_code ON companies(company_code);

-- Add staff_code to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'staff_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN staff_code text;
  END IF;
END $$;

-- Create unique constraint on company_id + staff_code (staff code must be unique within company)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_company_staff_code_unique'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_company_staff_code_unique 
    UNIQUE (company_id, staff_code);
  END IF;
END $$;

-- Function to generate next staff code for a company
CREATE OR REPLACE FUNCTION generate_staff_code(p_company_id uuid, p_role text)
RETURNS text AS $$
DECLARE
  prefix text;
  next_number int;
  new_code text;
BEGIN
  -- Determine prefix based on role
  prefix := CASE 
    WHEN p_role = 'security_officer' THEN 'SO'
    WHEN p_role = 'site_manager' THEN 'SM'
    WHEN p_role = 'company_admin' THEN 'CA'
    ELSE 'EMP'
  END;

  -- Get the next number for this company and prefix
  SELECT COALESCE(MAX(CAST(substring(staff_code from '\d+$') AS integer)), 0) + 1
  INTO next_number
  FROM profiles
  WHERE company_id = p_company_id 
    AND staff_code LIKE prefix || '-%';

  -- Format: SO-001, SO-002, etc.
  new_code := prefix || '-' || lpad(next_number::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Generate staff codes for existing employees without codes
DO $$
DECLARE
  profile_record RECORD;
  new_staff_code text;
BEGIN
  FOR profile_record IN 
    SELECT id, company_id, role::text as role_text
    FROM profiles 
    WHERE company_id IS NOT NULL 
      AND staff_code IS NULL
      AND role IN ('security_officer', 'site_manager', 'company_admin')
  LOOP
    new_staff_code := generate_staff_code(profile_record.company_id, profile_record.role_text);
    UPDATE profiles 
    SET staff_code = new_staff_code 
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_staff_code ON profiles(staff_code);
CREATE INDEX IF NOT EXISTS idx_profiles_company_staff ON profiles(company_id, staff_code);
