/*
  # Add Incident Photos and Real-time Features

  1. New Tables
    - `incident_photos`
      - `id` (uuid, primary key) - Unique identifier
      - `incident_id` (uuid) - Reference to incidents table
      - `photo_url` (text) - URL to the stored photo
      - `caption` (text, nullable) - Optional photo caption
      - `uploaded_by` (uuid) - User who uploaded the photo
      - `created_at` (timestamptz) - Upload timestamp
      
    - `real_time_locations`
      - `id` (uuid, primary key) - Unique identifier  
      - `user_id` (uuid) - Reference to profiles/users
      - `latitude` (numeric) - GPS latitude
      - `longitude` (numeric) - GPS longitude
      - `accuracy` (numeric, nullable) - Location accuracy in meters
      - `heading` (numeric, nullable) - Direction of travel
      - `speed` (numeric, nullable) - Speed in m/s
      - `battery_level` (numeric, nullable) - Device battery percentage
      - `is_active` (boolean) - Whether user is currently active/on duty
      - `updated_at` (timestamptz) - Last location update
      - `created_at` (timestamptz) - First location recorded
      
    - `chat_messages`
      - `id` (uuid, primary key) - Unique identifier
      - `company_id` (uuid) - Company context
      - `sender_id` (uuid) - User who sent the message
      - `recipient_id` (uuid, nullable) - Direct message recipient (null for group)
      - `message` (text) - Message content
      - `is_read` (boolean) - Read status
      - `created_at` (timestamptz) - Message timestamp
      
  2. Security
    - Enable RLS on all new tables
    - Incident photos viewable by company members
    - Real-time locations viewable by company managers and admins
    - Chat messages viewable by sender, recipient, and company admins
    
  3. Important Notes
    - Real-time location tracking for live GPS monitoring
    - Chat system for guard-manager communication
    - Incident photos for better documentation
    - All tables support real-time subscriptions via Supabase
*/

-- Create incident_photos table
CREATE TABLE IF NOT EXISTS incident_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create real_time_locations table
CREATE TABLE IF NOT EXISTS real_time_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  accuracy numeric,
  heading numeric,
  speed numeric,
  battery_level numeric,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  recipient_id uuid REFERENCES auth.users(id),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE incident_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Incident Photos Policies
CREATE POLICY "Users can view incident photos in their company"
  ON incident_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      JOIN sites s ON s.id = i.site_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = incident_photos.incident_id
      AND (s.company_id = p.company_id OR p.role = 'super_admin')
    )
  );

CREATE POLICY "Users can upload incident photos"
  ON incident_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      JOIN sites s ON s.id = i.site_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = incident_photos.incident_id
      AND (s.company_id = p.company_id OR p.role = 'super_admin')
    )
    AND uploaded_by = auth.uid()
  );

-- Real-time Locations Policies
CREATE POLICY "Users can view locations in their company"
  ON real_time_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles user_profile ON user_profile.id = real_time_locations.user_id
      WHERE p.id = auth.uid()
      AND (
        p.company_id = user_profile.company_id
        OR p.role = 'super_admin'
        OR real_time_locations.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own location"
  ON real_time_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own location records"
  ON real_time_locations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Chat Messages Policies
CREATE POLICY "Users can view messages in their company"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = chat_messages.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Users can send messages in their company"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = chat_messages.company_id
    )
  );

CREATE POLICY "Users can mark own messages as read"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_incident_photos_incident_id ON incident_photos(incident_id);
CREATE INDEX IF NOT EXISTS idx_real_time_locations_user_id ON real_time_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_real_time_locations_updated_at ON real_time_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_time_locations_is_active ON real_time_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_messages_company_id ON chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_id ON chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Create updated_at trigger for real_time_locations
CREATE OR REPLACE FUNCTION update_real_time_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'real_time_locations_updated_at'
  ) THEN
    CREATE TRIGGER real_time_locations_updated_at
      BEFORE UPDATE ON real_time_locations
      FOR EACH ROW
      EXECUTE FUNCTION update_real_time_locations_updated_at();
  END IF;
END $$;
