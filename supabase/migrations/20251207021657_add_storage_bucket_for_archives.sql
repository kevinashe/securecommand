/*
  # Add Storage Bucket for Data Archives

  1. New Storage Bucket
    - `data-archives` - Stores exported data files
    - Organized by table name and date
    - Files in CSV/JSON format for easy access

  2. Security
    - Only super admins can access archived files
    - Files are organized: /table_name/year/month/data.csv
*/

-- Create storage bucket for data archives
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-archives', 'data-archives', false)
ON CONFLICT (id) DO NOTHING;

-- Allow super admins to upload archive files
CREATE POLICY "Super admins can upload archives"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'data-archives' AND
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- Allow super admins to read archive files
CREATE POLICY "Super admins can read archives"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'data-archives' AND
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- Allow super admins to delete old archive files
CREATE POLICY "Super admins can delete archives"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'data-archives' AND
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- Add archive_to_storage column to retention policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_retention_policies' AND column_name = 'archive_to_storage'
  ) THEN
    ALTER TABLE data_retention_policies 
    ADD COLUMN archive_to_storage boolean DEFAULT false,
    ADD COLUMN storage_format text DEFAULT 'json' CHECK (storage_format IN ('json', 'csv'));
  END IF;
END $$;

-- Update retention policies to use file storage for archives
UPDATE data_retention_policies
SET archive_to_storage = true, storage_format = 'json'
WHERE action = 'archive';

-- Create table to track archived files
CREATE TABLE IF NOT EXISTS archived_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  record_count integer,
  start_date timestamptz,
  end_date timestamptz,
  format text DEFAULT 'json',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE archived_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage archived files"
  ON archived_files
  FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_archived_files_table_date ON archived_files(table_name, created_at DESC);
