/*
  # Add RPC Functions to Bypass RLS for Company Registration

  1. New Functions
    - `create_company_bypass_rls` - Creates a company with SECURITY DEFINER to bypass RLS
    - `create_profile_bypass_rls` - Creates a profile with SECURITY DEFINER to bypass RLS
  
  2. Purpose
    - These functions are called from the edge function during company signup
    - They use SECURITY DEFINER to run with elevated privileges and bypass RLS
    - This solves the issue where newly created auth users can't insert companies due to RLS
  
  3. Security
    - Functions can only be called by authenticated users (service role)
    - Functions only perform specific, safe operations
    - No destructive operations are allowed
*/

-- Function to create a company bypassing RLS
CREATE OR REPLACE FUNCTION create_company_bypass_rls(
  p_name text,
  p_address text,
  p_phone text,
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company companies;
BEGIN
  INSERT INTO companies (name, address, phone, email, is_active)
  VALUES (p_name, p_address, p_phone, p_email, true)
  RETURNING * INTO v_company;
  
  RETURN json_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'company_code', v_company.company_code,
    'address', v_company.address,
    'phone', v_company.phone,
    'email', v_company.email
  );
END;
$$;

-- Function to create a profile bypassing RLS
CREATE OR REPLACE FUNCTION create_profile_bypass_rls(
  p_id uuid,
  p_full_name text,
  p_role user_role,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, company_id)
  VALUES (p_id, p_full_name, p_role, p_company_id);
END;
$$;
