/*
  # Logbook Photos, Visitor Management, Training/Certifications, Digital Signatures

  1. Modified Tables
    - `logbook_entries` - Added `photo_urls` (text array) for photo attachments

  2. New Tables
    - `visitors`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `site_id` (uuid, references sites)
      - `logged_by` (uuid, references profiles - the guard who logged the visitor)
      - `visitor_name` (text) - full name of visitor
      - `visitor_company` (text, nullable) - company the visitor represents
      - `visitor_phone` (text, nullable)
      - `visitor_email` (text, nullable)
      - `purpose` (text) - reason for visit
      - `host_name` (text, nullable) - person they are visiting
      - `id_type` (text) - type of ID presented (drivers_license, passport, national_id, employee_badge, other)
      - `id_number` (text, nullable) - ID document number
      - `id_photo_url` (text, nullable) - photo of the ID
      - `visitor_photo_url` (text, nullable) - photo of the visitor
      - `badge_number` (text, nullable) - visitor badge assigned
      - `checked_in_at` (timestamptz) - arrival time
      - `checked_out_at` (timestamptz, nullable) - departure time
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

    - `guard_certifications`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `guard_id` (uuid, references profiles)
      - `certification_name` (text) - e.g., PSIRA Grade A, First Aid, Firearm Competency
      - `certification_type` (text) - license, certification, training, permit
      - `issuing_authority` (text, nullable)
      - `certificate_number` (text, nullable)
      - `issued_date` (date, nullable)
      - `expiry_date` (date, nullable)
      - `status` (text) - active, expired, expiring_soon, revoked
      - `document_url` (text, nullable) - uploaded certificate document
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `digital_signatures`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `signer_id` (uuid, references profiles)
      - `signature_data` (text) - base64 encoded signature image
      - `context_type` (text) - shift_handover, incident_acknowledgment, visitor_signoff, logbook_entry, custom
      - `context_id` (uuid, nullable) - ID of the related record
      - `context_description` (text, nullable)
      - `ip_address` (text, nullable)
      - `signed_at` (timestamptz)
      - `created_at` (timestamptz)

    - `notification_preferences`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `user_id` (uuid, references profiles)
      - `notify_missed_checkin` (boolean, default true)
      - `notify_sos` (boolean, default true)
      - `notify_shift_reminder` (boolean, default true)
      - `notify_incident` (boolean, default true)
      - `notify_certification_expiry` (boolean, default true)
      - `reminder_minutes_before` (integer, default 30)
      - `email_enabled` (boolean, default true)
      - `sms_enabled` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Storage Buckets
    - `logbook-photos` - for logbook entry photos
    - `visitor-photos` - for visitor ID and face photos
    - `certification-docs` - for certification documents
    - `signatures` - for digital signature images

  4. Security
    - RLS enabled on all new tables
    - Policies restrict access by company_id and role
*/

-- Add photo_urls array to logbook_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logbook_entries' AND column_name = 'photo_urls'
  ) THEN
    ALTER TABLE logbook_entries ADD COLUMN photo_urls text[] DEFAULT '{}';
  END IF;
END $$;

-- Add signature_id to logbook_entries for digital signatures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logbook_entries' AND column_name = 'signature_id'
  ) THEN
    ALTER TABLE logbook_entries ADD COLUMN signature_id uuid;
  END IF;
END $$;

-- ========================
-- VISITORS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  logged_by uuid NOT NULL REFERENCES profiles(id),
  visitor_name text NOT NULL,
  visitor_company text,
  visitor_phone text,
  visitor_email text,
  purpose text NOT NULL DEFAULT '',
  host_name text,
  id_type text NOT NULL DEFAULT 'other',
  id_number text,
  id_photo_url text,
  visitor_photo_url text,
  badge_number text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can insert visitors for their company"
  ON visitors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company members can view visitors"
  ON visitors FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company admins and guards can update visitors"
  ON visitors FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can delete visitors"
  ON visitors FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_visitors_company_id ON visitors(company_id);
CREATE INDEX IF NOT EXISTS idx_visitors_site_id ON visitors(site_id);
CREATE INDEX IF NOT EXISTS idx_visitors_checked_in_at ON visitors(checked_in_at);

-- ========================
-- GUARD CERTIFICATIONS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS guard_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  certification_type text NOT NULL DEFAULT 'certification',
  issuing_authority text,
  certificate_number text,
  issued_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active',
  document_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guard_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards can view own certifications"
  ON guard_certifications FOR SELECT
  TO authenticated
  USING (
    guard_id = auth.uid()
    OR company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert certifications"
  ON guard_certifications FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'site_manager', 'hr_manager', 'super_admin')
  );

CREATE POLICY "Admins can update certifications"
  ON guard_certifications FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'site_manager', 'hr_manager', 'super_admin')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete certifications"
  ON guard_certifications FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'hr_manager', 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_guard_certifications_guard_id ON guard_certifications(guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_certifications_company_id ON guard_certifications(company_id);
CREATE INDEX IF NOT EXISTS idx_guard_certifications_expiry_date ON guard_certifications(expiry_date);

-- ========================
-- DIGITAL SIGNATURES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS digital_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES profiles(id),
  signature_data text NOT NULL,
  context_type text NOT NULL DEFAULT 'custom',
  context_id uuid,
  context_description text,
  ip_address text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own signatures"
  ON digital_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    signer_id = auth.uid()
  );

CREATE POLICY "Company members can view signatures"
  ON digital_signatures FOR SELECT
  TO authenticated
  USING (
    signer_id = auth.uid()
    OR company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_digital_signatures_signer_id ON digital_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_context ON digital_signatures(context_type, context_id);

-- ========================
-- NOTIFICATION PREFERENCES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notify_missed_checkin boolean NOT NULL DEFAULT true,
  notify_sos boolean NOT NULL DEFAULT true,
  notify_shift_reminder boolean NOT NULL DEFAULT true,
  notify_incident boolean NOT NULL DEFAULT true,
  notify_certification_expiry boolean NOT NULL DEFAULT true,
  reminder_minutes_before integer NOT NULL DEFAULT 30,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ========================
-- STORAGE BUCKETS
-- ========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('logbook-photos', 'logbook-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('visitor-photos', 'visitor-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certification-docs', 'certification-docs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for logbook-photos
CREATE POLICY "Authenticated users can upload logbook photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logbook-photos');

CREATE POLICY "Anyone can view logbook photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'logbook-photos');

-- Storage policies for visitor-photos
CREATE POLICY "Authenticated users can upload visitor photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'visitor-photos');

CREATE POLICY "Anyone can view visitor photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'visitor-photos');

-- Storage policies for certification-docs
CREATE POLICY "Authenticated users can upload certification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certification-docs');

CREATE POLICY "Anyone can view certification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certification-docs');

-- Storage policies for signatures
CREATE POLICY "Authenticated users can upload signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can view signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'signatures');
