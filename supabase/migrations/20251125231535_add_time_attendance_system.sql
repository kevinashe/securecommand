/*
  # Time & Attendance System with Geofencing

  1. New Tables
    - `time_clocks`
      - `id` (uuid, primary key)
      - `guard_id` (uuid, references profiles)
      - `shift_id` (uuid, references shifts, nullable)
      - `clock_in_time` (timestamptz)
      - `clock_out_time` (timestamptz, nullable)
      - `clock_in_latitude` (numeric, nullable)
      - `clock_in_longitude` (numeric, nullable)
      - `clock_out_latitude` (numeric, nullable)
      - `clock_out_longitude` (numeric, nullable)
      - `clock_in_photo_url` (text, nullable)
      - `clock_out_photo_url` (text, nullable)
      - `is_within_geofence` (boolean)
      - `total_hours` (numeric, nullable)
      - `overtime_hours` (numeric, nullable)
      - `created_at` (timestamptz)
    
    - `break_logs`
      - `id` (uuid, primary key)
      - `time_clock_id` (uuid, references time_clocks)
      - `break_start` (timestamptz)
      - `break_end` (timestamptz, nullable)
      - `break_type` (text) - 'meal', 'rest', 'other'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for guards and admins

  3. Indexes
    - Performance optimization for queries
*/

-- Time Clocks
CREATE TABLE IF NOT EXISTS time_clocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in_time timestamptz NOT NULL,
  clock_out_time timestamptz,
  clock_in_latitude numeric(10, 7),
  clock_in_longitude numeric(10, 7),
  clock_out_latitude numeric(10, 7),
  clock_out_longitude numeric(10, 7),
  clock_in_photo_url text,
  clock_out_photo_url text,
  is_within_geofence boolean DEFAULT false,
  total_hours numeric(5, 2),
  overtime_hours numeric(5, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_clocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own time clocks"
  ON time_clocks FOR SELECT
  TO authenticated
  USING (
    auth.uid() = guard_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Guards can insert own clock-ins"
  ON time_clocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Guards can update own time clocks"
  ON time_clocks FOR UPDATE
  TO authenticated
  USING (auth.uid() = guard_id)
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Admins can manage all time clocks"
  ON time_clocks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_time_clocks_guard ON time_clocks(guard_id);
CREATE INDEX idx_time_clocks_shift ON time_clocks(shift_id);
CREATE INDEX idx_time_clocks_date ON time_clocks(clock_in_time);

-- Break Logs
CREATE TABLE IF NOT EXISTS break_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_clock_id uuid REFERENCES time_clocks(id) ON DELETE CASCADE NOT NULL,
  break_start timestamptz NOT NULL,
  break_end timestamptz,
  break_type text DEFAULT 'rest' CHECK (break_type IN ('meal', 'rest', 'other')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own breaks"
  ON break_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM time_clocks
      WHERE time_clocks.id = break_logs.time_clock_id
      AND time_clocks.guard_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Guards can manage own breaks"
  ON break_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM time_clocks
      WHERE time_clocks.id = break_logs.time_clock_id
      AND time_clocks.guard_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all breaks"
  ON break_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_break_logs_time_clock ON break_logs(time_clock_id);

-- Function to calculate total hours when clocking out
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
    
    IF NEW.total_hours > 8 THEN
      NEW.overtime_hours := NEW.total_hours - 8;
    ELSE
      NEW.overtime_hours := 0;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_hours
  BEFORE UPDATE ON time_clocks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();
