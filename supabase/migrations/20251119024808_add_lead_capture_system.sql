/*
  # Lead Capture System

  1. New Tables
    - `leads`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Full name of the lead
      - `email` (text) - Email address
      - `company` (text, nullable) - Company name
      - `phone` (text, nullable) - Phone number
      - `product_interest` (text, nullable) - Product they're interested in
      - `message` (text) - Their message/inquiry
      - `source` (text) - Where the lead came from (contact_form, demo_request, etc.)
      - `status` (text) - Lead status (new, contacted, qualified, converted, lost)
      - `assigned_to` (uuid, nullable) - Sales rep assigned to this lead
      - `created_at` (timestamptz) - When the lead was created
      - `updated_at` (timestamptz) - Last update timestamp
      
  2. Security
    - Enable RLS on `leads` table
    - Only super_admins can view and manage leads
    - Public insert policy for lead submissions from website

  3. Important Notes
    - This table captures all incoming leads from the marketing website
    - Separate from user profiles and company data
    - Allows tracking of the sales pipeline
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  product_interest text,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact_form',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert leads (from the website contact form)
CREATE POLICY "Anyone can submit leads"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Super admins can view all leads
CREATE POLICY "Super admins can view all leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Super admins can update leads
CREATE POLICY "Super admins can update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Super admins can delete leads
CREATE POLICY "Super admins can delete leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();
