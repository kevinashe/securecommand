/*
  # Add Offline Patrol Check-In Support

  1. Modified Tables
    - `check_ins`
      - `recorded_offline` (boolean, default false) - whether the check-in was recorded while the device was offline
      - `synced_at` (timestamptz, nullable) - when the offline check-in was synced to the server
      - `device_timestamp` (timestamptz, nullable) - the device's local timestamp at time of check-in (may differ from server time)

  2. Important Notes
    - Guards can now complete patrols without internet connectivity
    - Offline check-ins are queued locally and synced when connectivity returns
    - The `device_timestamp` preserves the exact time the guard scanned the checkpoint
    - The `checked_in_at` field will contain the device time for offline scans
    - `synced_at` indicates when the data was actually uploaded to the server
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'recorded_offline'
  ) THEN
    ALTER TABLE check_ins ADD COLUMN recorded_offline boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'synced_at'
  ) THEN
    ALTER TABLE check_ins ADD COLUMN synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'device_timestamp'
  ) THEN
    ALTER TABLE check_ins ADD COLUMN device_timestamp timestamptz;
  END IF;
END $$;
