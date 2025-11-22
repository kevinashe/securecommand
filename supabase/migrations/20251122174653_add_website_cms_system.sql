/*
  # Website CMS System

  1. New Tables
    - `website_content`
      - `id` (uuid, primary key)
      - `section` (text) - Section identifier (hero, features, pricing, contact, etc.)
      - `key` (text) - Content key within section
      - `value` (jsonb) - Content value (supports text, arrays, objects)
      - `type` (text) - Content type (text, rich_text, image_url, array, etc.)
      - `updated_by` (uuid) - User who last updated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `website_content` table
    - Super admins can read, insert, update website content
    - Everyone can read website content (for public landing page)

  3. Initial Data
    - Populate with default landing page content
*/

-- Create website_content table
CREATE TABLE IF NOT EXISTS website_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  type text NOT NULL DEFAULT 'text',
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(section, key)
);

-- Enable RLS
ALTER TABLE website_content ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read website content (for public pages)
CREATE POLICY "Anyone can read website content"
  ON website_content
  FOR SELECT
  USING (true);

-- Policy: Super admins can insert website content
CREATE POLICY "Super admins can insert website content"
  ON website_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Super admins can update website content
CREATE POLICY "Super admins can update website content"
  ON website_content
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

-- Insert default landing page content
INSERT INTO website_content (section, key, value, type) VALUES
  -- Hero Section
  ('hero', 'badge_text', '"Trusted by Security Professionals Worldwide"', 'text'),
  ('hero', 'main_heading', '"Professional Solutions"', 'text'),
  ('hero', 'sub_heading', '"Built for Excellence"', 'text'),
  ('hero', 'description', '"Comprehensive software solutions designed to streamline operations, enhance productivity, and drive success across multiple industries."', 'text'),
  ('hero', 'primary_cta_text', '"Explore Our Products"', 'text'),
  ('hero', 'secondary_cta_text', '"Schedule a Demo"', 'text'),

  -- Features Section
  ('features', 'heading', '"Why Choose SecureCommand"', 'text'),
  ('features', 'subheading', '"Powerful features designed for modern security operations"', 'text'),
  ('features', 'feature_list', '[
    {"icon": "Shield", "title": "Real-Time Monitoring", "description": "Track security personnel and incidents in real-time with GPS tracking and live updates."},
    {"icon": "Users", "title": "Team Management", "description": "Efficiently manage guards, shifts, and site assignments from a centralized dashboard."},
    {"icon": "MapPin", "title": "Site Management", "description": "Organize and monitor multiple security sites with detailed analytics and reporting."},
    {"icon": "FileText", "title": "Incident Reporting", "description": "Document and track security incidents with photo evidence and detailed logs."},
    {"icon": "Clock", "title": "Shift Scheduling", "description": "Create and manage guard shifts with automated notifications and check-ins."},
    {"icon": "BarChart", "title": "Analytics & Reports", "description": "Gain insights with comprehensive analytics and automated reporting tools."}
  ]', 'array'),

  -- Products Section
  ('products', 'heading', '"Our Solutions"', 'text'),
  ('products', 'subheading', '"Comprehensive security management tools"', 'text'),

  -- Pricing Section
  ('pricing', 'heading', '"Choose Your Plan"', 'text'),
  ('pricing', 'subheading', '"Flexible pricing for companies of all sizes"', 'text'),

  -- Contact Section
  ('contact', 'heading', '"Get in Touch"', 'text'),
  ('contact', 'subheading', '"Have questions? We''re here to help."', 'text'),
  ('contact', 'email', '"info@securecommand.com"', 'text'),
  ('contact', 'phone', '"+1 (555) 123-4567"', 'text'),
  ('contact', 'address', '"123 Security Street, Suite 100, City, State 12345"', 'text'),

  -- Footer
  ('footer', 'tagline', '"Professional security management software trusted worldwide"', 'text'),
  ('footer', 'copyright', '"© 2024 SecureCommand. All rights reserved."', 'text')
ON CONFLICT (section, key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_website_content_section ON website_content(section);
