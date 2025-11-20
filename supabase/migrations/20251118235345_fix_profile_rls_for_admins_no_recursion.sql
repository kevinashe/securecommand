/*
  # Fix Profile RLS Policies - Remove Recursion

  1. Problem
    - The policies added earlier cause infinite recursion
    - They check the profiles table while reading from the profiles table
    - This prevents users from reading their own profile during sign-in

  2. Solution
    - Drop the recursive policies
    - Keep only the simple "users can view own profile" policy
    - Add a service role function for admin queries if needed later

  3. Changes
    - Remove "Super admins can view all profiles" policy
    - Remove "Company admins can view profiles in their company" policy
    - Remove "Site managers can view all profiles" policy
*/

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Company admins can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Site managers can view all profiles" ON profiles;
