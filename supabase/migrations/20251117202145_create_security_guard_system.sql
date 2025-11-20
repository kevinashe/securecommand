/*
  # Security Guard Management System - Complete Database Schema

  ## Overview
  Multi-tenant security guard management system with GPS tracking, patrol management,
  incident reporting, and comprehensive role-based access control.

  ## Tables Created
  
  ### Core Tables
  1. **profiles** - User profiles linked to auth.users
     - id (uuid, primary key, references auth.users)
     - full_name (text)
     - role (enum: super_admin, company_admin, site_manager, security_officer)
     - company_id (uuid, nullable for super_admin)
     - avatar_url (text)
     - phone (text)
     - created_at, updated_at (timestamptz)

  2. **companies** - Company/Organization management
     - id (uuid, primary key)
     - name, address, phone, email (text)
     - logo_url (text)
     - subscription_tier (text)
     - is_active (boolean)
     - created_at, updated_at (timestamptz)

  3. **sites** - Security sites/locations
     - id (uuid, primary key)
     - company_id (uuid, foreign key)
     - name, address (text)
     - latitude, longitude (numeric)
     - is_active (boolean)
     - contact_name, contact_phone (text)
     - created_at, updated_at (timestamptz)

  4. **shifts** - Guard shift scheduling
     - id (uuid, primary key)
     - site_id (uuid, foreign key)
     - guard_id (uuid, foreign key to profiles)
     - start_time, end_time (timestamptz)
     - status (enum: scheduled, active, completed, cancelled)
     - notes (text)
     - created_at, updated_at (timestamptz)

  5. **patrol_routes** - Defined patrol routes
     - id (uuid, primary key)
     - site_id (uuid, foreign key)
     - name, description (text)
     - is_active (boolean)
     - created_at, updated_at (timestamptz)

  6. **checkpoints** - Physical checkpoint locations
     - id (uuid, primary key)
     - patrol_route_id (uuid, foreign key)
     - name, description (text)
     - qr_code (text, unique)
     - latitude, longitude (numeric)
     - order_index (integer)
     - created_at, updated_at (timestamptz)

  7. **check_ins** - Guard check-in records
     - id (uuid, primary key)
     - checkpoint_id (uuid, foreign key)
     - guard_id (uuid, foreign key)
     - shift_id (uuid, foreign key)
     - checked_in_at (timestamptz)
     - latitude, longitude (numeric)
     - notes (text)
     - photo_url (text)
     - created_at (timestamptz)

  8. **incidents** - Incident reports
     - id (uuid, primary key)
     - site_id (uuid, foreign key)
     - reported_by (uuid, foreign key to profiles)
     - shift_id (uuid, nullable, foreign key)
     - title, description (text)
     - severity (enum: low, medium, high, critical)
     - status (enum: open, investigating, resolved, closed)
     - occurred_at (timestamptz)
     - latitude, longitude (numeric)
     - media_urls (jsonb array)
     - created_at, updated_at (timestamptz)

  9. **equipment** - Equipment tracking
     - id (uuid, primary key)
     - company_id (uuid, foreign key)
     - site_id (uuid, nullable, foreign key)
     - name, description (text)
     - serial_number (text)
     - assigned_to (uuid, nullable, foreign key to profiles)
     - status (enum: available, assigned, maintenance, retired)
     - purchase_date (date)
     - last_maintenance_date (date)
     - created_at, updated_at (timestamptz)

  10. **sos_alerts** - Emergency SOS alerts
      - id (uuid, primary key)
      - guard_id (uuid, foreign key to profiles)
      - site_id (uuid, nullable, foreign key)
      - shift_id (uuid, nullable, foreign key)
      - latitude, longitude (numeric)
      - message (text)
      - status (enum: active, acknowledged, resolved)
      - acknowledged_by (uuid, nullable, foreign key to profiles)
      - acknowledged_at (timestamptz, nullable)
      - resolved_at (timestamptz, nullable)
      - created_at (timestamptz)

  11. **messages** - Real-time messaging
      - id (uuid, primary key)
      - from_user_id (uuid, foreign key to profiles)
      - to_user_id (uuid, nullable, foreign key to profiles)
      - company_id (uuid, nullable, foreign key)
      - site_id (uuid, nullable, foreign key)
      - message (text)
      - is_read (boolean)
      - read_at (timestamptz, nullable)
      - created_at (timestamptz)

  12. **subscriptions** - Company subscription plans
      - id (uuid, primary key)
      - company_id (uuid, foreign key)
      - plan_name (text)
      - price (numeric)
      - billing_cycle (enum: monthly, yearly)
      - start_date, end_date (date)
      - is_active (boolean)
      - max_guards (integer)
      - max_sites (integer)
      - created_at, updated_at (timestamptz)

  13. **invoices** - Billing invoices
      - id (uuid, primary key)
      - company_id (uuid, foreign key)
      - subscription_id (uuid, foreign key)
      - invoice_number (text, unique)
      - amount (numeric)
      - due_date (date)
      - status (enum: pending, paid, overdue, cancelled)
      - created_at, updated_at (timestamptz)

  14. **payments** - Payment records
      - id (uuid, primary key)
      - invoice_id (uuid, foreign key)
      - amount (numeric)
      - payment_method (text)
      - payment_date (timestamptz)
      - transaction_id (text)
      - created_at (timestamptz)

  15. **gps_tracking** - Real-time GPS locations
      - id (uuid, primary key)
      - guard_id (uuid, foreign key to profiles)
      - shift_id (uuid, nullable, foreign key)
      - latitude, longitude (numeric)
      - accuracy (numeric)
      - speed (numeric, nullable)
      - heading (numeric, nullable)
      - battery_level (integer, nullable)
      - timestamp (timestamptz)
      - created_at (timestamptz)

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies based on user roles and company membership
  - Super admins have full access
  - Company admins can access their company data
  - Site managers can access their assigned sites
  - Security officers can access their own data and assigned resources

  ## Triggers
  - Auto-create profile on user signup
  - Auto-update timestamps
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'company_admin', 'site_manager', 'security_officer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('open', 'investigating', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE equipment_status AS ENUM ('available', 'assigned', 'maintenance', 'retired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sos_status AS ENUM ('active', 'acknowledged', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  logo_url text,
  subscription_tier text DEFAULT 'basic',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'security_officer',
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  is_active boolean DEFAULT true,
  contact_name text,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status shift_status DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create patrol_routes table
CREATE TABLE IF NOT EXISTS patrol_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patrol_route_id uuid NOT NULL REFERENCES patrol_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  qr_code text UNIQUE NOT NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create check_ins table
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity incident_severity DEFAULT 'medium',
  status incident_status DEFAULT 'open',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  media_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  serial_number text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status equipment_status DEFAULT 'available',
  purchase_date date,
  last_maintenance_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sos_alerts table
CREATE TABLE IF NOT EXISTS sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  message text,
  status sos_status DEFAULT 'active',
  acknowledged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  price numeric(10, 2) NOT NULL,
  billing_cycle billing_cycle DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  max_guards integer DEFAULT 10,
  max_sites integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_number text UNIQUE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  due_date date NOT NULL,
  status invoice_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  payment_method text,
  payment_date timestamptz NOT NULL DEFAULT now(),
  transaction_id text,
  created_at timestamptz DEFAULT now()
);

-- Create gps_tracking table
CREATE TABLE IF NOT EXISTS gps_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  accuracy numeric(8, 2),
  speed numeric(8, 2),
  heading numeric(6, 2),
  battery_level integer,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Company admins can view company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager')
      AND p.company_id = profiles.company_id
    )
  );

-- Create RLS Policies for companies
CREATE POLICY "Super admins can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Company admins can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = companies.id
    )
  );

-- Create RLS Policies for sites
CREATE POLICY "Super admins can manage all sites"
  ON sites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Company users can view company sites"
  ON sites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = sites.company_id
    )
  );

CREATE POLICY "Company admins can manage company sites"
  ON sites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'site_manager')
      AND profiles.company_id = sites.company_id
    )
  );

-- Create RLS Policies for shifts
CREATE POLICY "Guards can view own shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (auth.uid() = guard_id);

CREATE POLICY "Company users can view company shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = shifts.site_id
      WHERE p.id = auth.uid()
      AND p.company_id = s.company_id
    )
  );

CREATE POLICY "Site managers can manage site shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = shifts.site_id
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for patrol_routes
CREATE POLICY "Company users can view patrol routes"
  ON patrol_routes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = patrol_routes.site_id
      WHERE p.id = auth.uid()
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

CREATE POLICY "Site managers can manage patrol routes"
  ON patrol_routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = patrol_routes.site_id
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for checkpoints
CREATE POLICY "Company users can view checkpoints"
  ON checkpoints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN patrol_routes pr ON pr.id = checkpoints.patrol_route_id
      JOIN sites s ON s.id = pr.site_id
      WHERE p.id = auth.uid()
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

CREATE POLICY "Site managers can manage checkpoints"
  ON checkpoints FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN patrol_routes pr ON pr.id = checkpoints.patrol_route_id
      JOIN sites s ON s.id = pr.site_id
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for check_ins
CREATE POLICY "Guards can create own check-ins"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Company users can view check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (
    auth.uid() = guard_id OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN checkpoints cp ON cp.id = check_ins.checkpoint_id
      JOIN patrol_routes pr ON pr.id = cp.patrol_route_id
      JOIN sites s ON s.id = pr.site_id
      WHERE p.id = auth.uid()
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for incidents
CREATE POLICY "Guards can create incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Company users can view incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reported_by OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = incidents.site_id
      WHERE p.id = auth.uid()
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

CREATE POLICY "Site managers can update incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN sites s ON s.id = incidents.site_id
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
      AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for equipment
CREATE POLICY "Company users can view equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.company_id = equipment.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Company admins can manage equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
      AND (profiles.company_id = equipment.company_id OR profiles.role = 'super_admin')
    )
  );

-- Create RLS Policies for sos_alerts
CREATE POLICY "Guards can create SOS alerts"
  ON sos_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Company users can view SOS alerts"
  ON sos_alerts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = guard_id OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles guard ON guard.id = sos_alerts.guard_id
      WHERE p.id = auth.uid()
      AND (p.company_id = guard.company_id OR p.role = 'super_admin')
    )
  );

CREATE POLICY "Managers can update SOS alerts"
  ON sos_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles guard ON guard.id = sos_alerts.guard_id
      WHERE p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
      AND (p.company_id = guard.company_id OR p.role = 'super_admin')
    )
  );

-- Create RLS Policies for messages
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = from_user_id OR 
    auth.uid() = to_user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.company_id = messages.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user_id);

-- Create RLS Policies for subscriptions
CREATE POLICY "Company users can view subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.company_id = subscriptions.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Super admins can manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create RLS Policies for invoices
CREATE POLICY "Company users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.company_id = invoices.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Super admins can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create RLS Policies for payments
CREATE POLICY "Company users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN invoices ON invoices.id = payments.invoice_id
      WHERE profiles.id = auth.uid()
      AND (profiles.company_id = invoices.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Company admins can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN invoices ON invoices.id = payments.invoice_id
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('company_admin', 'super_admin')
      AND (profiles.company_id = invoices.company_id OR profiles.role = 'super_admin')
    )
  );

-- Create RLS Policies for gps_tracking
CREATE POLICY "Guards can create GPS tracking"
  ON gps_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Company users can view GPS tracking"
  ON gps_tracking FOR SELECT
  TO authenticated
  USING (
    auth.uid() = guard_id OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles guard ON guard.id = gps_tracking.guard_id
      WHERE p.id = auth.uid()
      AND (p.company_id = guard.company_id OR p.role = 'super_admin')
    )
  );

-- Create trigger function for auto-creating profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, company_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'security_officer'),
    (new.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creating profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_sites_company_id ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_guard_id ON shifts(guard_id);
CREATE INDEX IF NOT EXISTS idx_shifts_site_id ON shifts(site_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_check_ins_guard_id ON check_ins(guard_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_checkpoint_id ON check_ins(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_incidents_site_id ON incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_guard_id ON sos_alerts(guard_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_company ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_guard_id ON gps_tracking(guard_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_timestamp ON gps_tracking(timestamp);