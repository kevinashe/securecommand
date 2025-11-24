/*
  # Add type column to equipment table

  1. Changes
    - Add 'type' column to equipment table to categorize equipment (radio, flashlight, baton, etc.)
    - Set default value to 'other'

  2. Notes
    - Existing equipment will have type set to 'other'
    - This allows better categorization and filtering of equipment
*/

-- Add type column to equipment table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN type text DEFAULT 'other' NOT NULL;
  END IF;
END $$;
