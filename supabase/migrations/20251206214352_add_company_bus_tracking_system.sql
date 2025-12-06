/*
  # Company Bus Tracking System

  1. New Tables
    - `company_buses`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `bus_number` (text) - Bus identifier/name
      - `license_plate` (text) - Vehicle license plate
      - `capacity` (integer) - Maximum passenger capacity
      - `qr_code` (text, unique) - Unique QR code identifier
      - `route_name` (text) - Bus route name/description
      - `driver_name` (text) - Optional driver name
      - `is_active` (boolean) - Whether bus is currently in service
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `bus_check_ins`
      - `id` (uuid, primary key)
      - `bus_id` (uuid, foreign key to company_buses)
      - `user_id` (uuid, foreign key to profiles)
      - `company_id` (uuid, foreign key to companies)
      - `checked_in_at` (timestamptz) - When staff boarded
      - `checked_out_at` (timestamptz, nullable) - When staff got off
      - `location_lat` (numeric, nullable) - GPS coordinates
      - `location_lng` (numeric, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Admins can manage buses for their company
    - Staff can view buses and check in
    - Staff can only see their own check-in history
    - Admins can view all check-ins for their company
*/

-- Create company_buses table
CREATE TABLE IF NOT EXISTS company_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bus_number text NOT NULL,
  license_plate text,
  capacity integer DEFAULT 50,
  qr_code text UNIQUE NOT NULL,
  route_name text,
  driver_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bus_check_ins table
CREATE TABLE IF NOT EXISTS bus_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES company_buses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checked_in_at timestamptz DEFAULT now(),
  checked_out_at timestamptz,
  location_lat numeric,
  location_lng numeric,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_company_buses_company_id ON company_buses(company_id);
CREATE INDEX IF NOT EXISTS idx_company_buses_qr_code ON company_buses(qr_code);
CREATE INDEX IF NOT EXISTS idx_bus_check_ins_bus_id ON bus_check_ins(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_check_ins_user_id ON bus_check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_check_ins_company_id ON bus_check_ins(company_id);
CREATE INDEX IF NOT EXISTS idx_bus_check_ins_checked_in_at ON bus_check_ins(checked_in_at);

-- Enable Row Level Security
ALTER TABLE company_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_check_ins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_buses

-- Super admins can view all buses
CREATE POLICY "Super admins can view all buses"
  ON company_buses FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

-- Company staff can view their company's buses
CREATE POLICY "Company staff can view company buses"
  ON company_buses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Company admins can insert buses for their company
CREATE POLICY "Company admins can insert company buses"
  ON company_buses FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'company_admin'
    )
  );

-- Company admins can update their company's buses
CREATE POLICY "Company admins can update company buses"
  ON company_buses FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'company_admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'company_admin'
    )
  );

-- Company admins can delete their company's buses
CREATE POLICY "Company admins can delete company buses"
  ON company_buses FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'company_admin'
    )
  );

-- RLS Policies for bus_check_ins

-- Super admins can view all check-ins
CREATE POLICY "Super admins can view all bus check-ins"
  ON bus_check_ins FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

-- Company admins can view their company's check-ins
CREATE POLICY "Company admins can view company bus check-ins"
  ON bus_check_ins FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Staff can view their own check-ins
CREATE POLICY "Staff can view own bus check-ins"
  ON bus_check_ins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can insert their own check-ins
CREATE POLICY "Staff can check in to buses"
  ON bus_check_ins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Staff can update their own check-ins (for check-out)
CREATE POLICY "Staff can update own bus check-ins"
  ON bus_check_ins FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create updated_at trigger for company_buses
CREATE OR REPLACE FUNCTION update_company_buses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_buses_updated_at
  BEFORE UPDATE ON company_buses
  FOR EACH ROW
  EXECUTE FUNCTION update_company_buses_updated_at();