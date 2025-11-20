/*
  # Fix Profile RLS for Signup

  Allows users to insert their own profile during signup process.

  ## Changes
  1. Adds INSERT policy for users to create their own profile
*/

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can create own profile during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
