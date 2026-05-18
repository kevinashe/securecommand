/*
  # Add Recurring Shift Support

  1. Modified Tables
    - `shifts`
      - `recurring_group_id` (uuid, nullable) - groups shifts that were created together as a recurring series, allowing bulk edit/delete of the entire series

  2. New Indexes
    - Index on `recurring_group_id` for fast lookups of all shifts in a recurring group

  3. Important Notes
    - Shifts with the same recurring_group_id were created as part of one recurring schedule action
    - NULL recurring_group_id means the shift was created individually (not recurring)
    - This does not change existing shifts -- they remain individual (null group id)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'recurring_group_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN recurring_group_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_recurring_group_id
  ON shifts (recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;
