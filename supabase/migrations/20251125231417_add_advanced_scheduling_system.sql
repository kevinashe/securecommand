/*
  # Advanced Scheduling System

  1. New Tables
    - `guard_availability`
      - `id` (uuid, primary key)
      - `guard_id` (uuid, references profiles)
      - `day_of_week` (integer, 0-6 for Sunday-Saturday)
      - `start_time` (time)
      - `end_time` (time)
      - `is_available` (boolean)
      - `created_at` (timestamptz)
    
    - `guard_qualifications`
      - `id` (uuid, primary key)
      - `guard_id` (uuid, references profiles)
      - `qualification_type` (text) - e.g., 'armed', 'first_aid', 'k9', 'supervisor'
      - `certification_number` (text, nullable)
      - `expiry_date` (date, nullable)
      - `verified` (boolean)
      - `created_at` (timestamptz)
    
    - `site_requirements`
      - `id` (uuid, primary key)
      - `site_id` (uuid, references sites)
      - `required_qualification` (text)
      - `minimum_guards` (integer)
      - `created_at` (timestamptz)
    
    - `shift_templates`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text)
      - `site_id` (uuid, references sites, nullable)
      - `day_of_week` (integer, nullable) - for recurring weekly shifts
      - `start_time` (time)
      - `end_time` (time)
      - `required_guards` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
    
    - `shift_swaps`
      - `id` (uuid, primary key)
      - `shift_id` (uuid, references shifts)
      - `requesting_guard_id` (uuid, references profiles)
      - `target_guard_id` (uuid, references profiles, nullable)
      - `status` (text) - 'pending', 'approved', 'rejected'
      - `reason` (text, nullable)
      - `approved_by` (uuid, references profiles, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `time_off_requests`
      - `id` (uuid, primary key)
      - `guard_id` (uuid, references profiles)
      - `start_date` (date)
      - `end_date` (date)
      - `reason` (text, nullable)
      - `status` (text) - 'pending', 'approved', 'rejected'
      - `approved_by` (uuid, references profiles, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indexes
    - Add indexes for performance optimization
*/

-- Guard Availability
CREATE TABLE IF NOT EXISTS guard_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guard_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own availability"
  ON guard_availability FOR SELECT
  TO authenticated
  USING (auth.uid() = guard_id);

CREATE POLICY "Guards can manage own availability"
  ON guard_availability FOR ALL
  TO authenticated
  USING (auth.uid() = guard_id)
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Admins can view all availability"
  ON guard_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_guard_availability_guard ON guard_availability(guard_id);
CREATE INDEX idx_guard_availability_day ON guard_availability(day_of_week);

-- Guard Qualifications
CREATE TABLE IF NOT EXISTS guard_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  qualification_type text NOT NULL,
  certification_number text,
  expiry_date date,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guard_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own qualifications"
  ON guard_qualifications FOR SELECT
  TO authenticated
  USING (auth.uid() = guard_id);

CREATE POLICY "Guards can insert own qualifications"
  ON guard_qualifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Admins can manage qualifications"
  ON guard_qualifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_guard_qualifications_guard ON guard_qualifications(guard_id);
CREATE INDEX idx_guard_qualifications_type ON guard_qualifications(qualification_type);
CREATE INDEX idx_guard_qualifications_expiry ON guard_qualifications(expiry_date);

-- Site Requirements
CREATE TABLE IF NOT EXISTS site_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  required_qualification text NOT NULL,
  minimum_guards integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE site_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view site requirements"
  ON site_requirements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = site_requirements.site_id
      AND (
        sites.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
      )
    )
  );

CREATE POLICY "Admins can manage site requirements"
  ON site_requirements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sites
      JOIN profiles ON profiles.id = auth.uid()
      WHERE sites.id = site_requirements.site_id
      AND (
        (sites.company_id = profiles.company_id AND profiles.role = 'company_admin')
        OR profiles.role = 'super_admin'
      )
    )
  );

CREATE INDEX idx_site_requirements_site ON site_requirements(site_id);

-- Shift Templates
CREATE TABLE IF NOT EXISTS shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  day_of_week integer CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  start_time time NOT NULL,
  end_time time NOT NULL,
  required_guards integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company shift templates"
  ON shift_templates FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Admins can manage shift templates"
  ON shift_templates FOR ALL
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'company_admin'
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE INDEX idx_shift_templates_company ON shift_templates(company_id);
CREATE INDEX idx_shift_templates_site ON shift_templates(site_id);

-- Shift Swaps
CREATE TABLE IF NOT EXISTS shift_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  requesting_guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view related shift swaps"
  ON shift_swaps FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requesting_guard_id
    OR auth.uid() = target_guard_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Guards can create shift swap requests"
  ON shift_swaps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requesting_guard_id);

CREATE POLICY "Admins can manage shift swaps"
  ON shift_swaps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_shift_swaps_shift ON shift_swaps(shift_id);
CREATE INDEX idx_shift_swaps_requesting ON shift_swaps(requesting_guard_id);
CREATE INDEX idx_shift_swaps_status ON shift_swaps(status);

-- Time Off Requests
CREATE TABLE IF NOT EXISTS time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own time off requests"
  ON time_off_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = guard_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Guards can create time off requests"
  ON time_off_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Admins can manage time off requests"
  ON time_off_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE INDEX idx_time_off_guard ON time_off_requests(guard_id);
CREATE INDEX idx_time_off_dates ON time_off_requests(start_date, end_date);
CREATE INDEX idx_time_off_status ON time_off_requests(status);
