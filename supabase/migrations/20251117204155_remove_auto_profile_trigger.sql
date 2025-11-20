/*
  # Remove Auto Profile Creation Trigger

  Removes the automatic profile creation trigger and allows the application
  to handle profile creation manually after signup.

  ## Changes
  1. Drops the trigger on auth.users
  2. Keeps the function for reference but disables automatic execution
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
