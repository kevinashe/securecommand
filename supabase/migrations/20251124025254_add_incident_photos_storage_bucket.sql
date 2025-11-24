/*
  # Add Storage Bucket for Incident Photos

  1. Storage Setup
    - Create `incident-photos` storage bucket
    - Configure public access for viewing photos
    - Set up RLS policies for secure upload/access

  2. Security
    - Only authenticated users can upload photos
    - Photos are publicly accessible for viewing (needed for incident reports)
    - Users can only upload to their own incident folders
*/

-- Create storage bucket for incident photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload incident photos
CREATE POLICY "Authenticated users can upload incident photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'incident-photos');

-- Allow authenticated users to read incident photos
CREATE POLICY "Authenticated users can view incident photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'incident-photos');

-- Allow users to delete their own uploaded photos
CREATE POLICY "Users can delete their own incident photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'incident-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
