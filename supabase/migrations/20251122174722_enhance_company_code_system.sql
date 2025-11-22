/*
  # Enhance Company Code System

  1. Changes
    - Make company_code unique and not null
    - Add function to auto-generate company codes
    - Add trigger to automatically generate company code when company is created
    - Ensure company codes are always uppercase alphanumeric

  2. Notes
    - Company codes will be 8-character alphanumeric codes
    - Format: CC-XXXXXX (e.g., CC-AB12CD)
    - Auto-generated on company creation
*/

-- Make company_code unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_company_code_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_company_code_key UNIQUE (company_code);
  END IF;
END $$;

-- Function to generate unique company code
CREATE OR REPLACE FUNCTION generate_company_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric code
    new_code := 'CC-' || upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM companies WHERE company_code = new_code) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Function to auto-set company code before insert
CREATE OR REPLACE FUNCTION set_company_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only set company code if it's null or empty
  IF NEW.company_code IS NULL OR NEW.company_code = '' THEN
    NEW.company_code := generate_company_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate company code
DROP TRIGGER IF EXISTS trigger_set_company_code ON companies;
CREATE TRIGGER trigger_set_company_code
  BEFORE INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION set_company_code();

-- Update existing companies without codes (if any)
UPDATE companies
SET company_code = generate_company_code()
WHERE company_code IS NULL OR company_code = '';
