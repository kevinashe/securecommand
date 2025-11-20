/*
  # Enhance SOS Alerts with Photo Capture
  
  1. Changes to Existing Tables
    - `sos_alerts` table: Add photo_url for automatic photo capture during panic button press
  
  2. Notes
    - Photos will be captured automatically when SOS button is pressed
    - Location is already captured, this adds visual evidence
*/

-- Add photo_url to sos_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sos_alerts' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE sos_alerts ADD COLUMN photo_url text;
  END IF;
END $$;

COMMENT ON COLUMN sos_alerts.photo_url IS 'Photo captured automatically during SOS alert';