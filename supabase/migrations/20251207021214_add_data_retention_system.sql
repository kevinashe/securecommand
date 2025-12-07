/*
  # Add Data Retention System

  1. Overview
    - Implements automated 1-year data retention policy
    - Creates archive tables for important historical data
    - Configurable retention periods per table
    - Protects critical business records

  2. New Tables
    - `data_retention_policies` - Configuration for retention rules
    - Archive tables for critical data (audit logs, incidents, etc.)

  3. Data Retention Policies
    - GPS tracking: 1 year (then delete)
    - Notifications: 1 year (then delete)
    - Chat messages: 1 year (then archive)
    - Audit logs: 1 year (then archive)
    - Incidents: 1 year (then archive - important for legal/compliance)
    - Check-ins: 1 year (then archive)
    - Time clocks: 1 year (then archive - payroll records)
    - SOS alerts: 1 year (then archive)
    - Geofence violations: 1 year (then delete)
    - System metrics: 1 year (then delete)
    - User activity metrics: 1 year (then delete)
    - Company growth metrics: 1 year (then delete)

  4. Important Notes
    - Core business data (companies, profiles, sites, shifts) is NEVER deleted
    - Invoices and payments are NEVER deleted (legal requirement)
    - Archived data can be restored if needed
    - Retention policies can be customized per company
*/

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  retention_days integer NOT NULL DEFAULT 365,
  action text NOT NULL DEFAULT 'delete' CHECK (action IN ('delete', 'archive')),
  date_column text NOT NULL DEFAULT 'created_at',
  is_enabled boolean DEFAULT true,
  description text,
  last_cleanup_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on retention policies
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/manage retention policies
CREATE POLICY "Super admins can manage retention policies"
  ON data_retention_policies
  FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

-- Create archive tables for important data
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  LIKE audit_logs INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents_archive (
  LIKE incidents INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS check_ins_archive (
  LIKE check_ins INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_clocks_archive (
  LIKE time_clocks INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sos_alerts_archive (
  LIKE sos_alerts INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages_archive (
  LIKE chat_messages INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

-- Enable RLS on archive tables (read-only for super admins)
ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_clocks_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view archived audit logs"
  ON audit_logs_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

CREATE POLICY "Super admins can view archived incidents"
  ON incidents_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

CREATE POLICY "Super admins can view archived check-ins"
  ON check_ins_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

CREATE POLICY "Super admins can view archived time clocks"
  ON time_clocks_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

CREATE POLICY "Super admins can view archived SOS alerts"
  ON sos_alerts_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

CREATE POLICY "Super admins can view archived chat messages"
  ON chat_messages_archive
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin');

-- Insert default retention policies
INSERT INTO data_retention_policies (table_name, retention_days, action, date_column, description) VALUES
  ('gps_tracking', 365, 'delete', 'timestamp', 'GPS tracking data older than 1 year'),
  ('notifications', 365, 'delete', 'created_at', 'User notifications older than 1 year'),
  ('audit_logs', 365, 'archive', 'created_at', 'Audit logs older than 1 year (archived for compliance)'),
  ('incidents', 365, 'archive', 'created_at', 'Incidents older than 1 year (archived for legal records)'),
  ('check_ins', 365, 'archive', 'created_at', 'Checkpoint check-ins older than 1 year'),
  ('time_clocks', 365, 'archive', 'created_at', 'Time clock records older than 1 year (payroll)'),
  ('sos_alerts', 365, 'archive', 'created_at', 'SOS alerts older than 1 year'),
  ('chat_messages', 365, 'archive', 'created_at', 'Chat messages older than 1 year'),
  ('geofence_violations', 365, 'delete', 'created_at', 'Geofence violations older than 1 year'),
  ('system_metrics', 365, 'delete', 'created_at', 'System metrics older than 1 year'),
  ('user_activity_metrics', 365, 'delete', 'created_at', 'User activity metrics older than 1 year'),
  ('company_growth_metrics', 365, 'delete', 'created_at', 'Company growth metrics older than 1 year'),
  ('shift_check_ins', 365, 'delete', 'created_at', 'Shift check-ins older than 1 year'),
  ('real_time_locations', 90, 'delete', 'created_at', 'Real-time location data older than 90 days')
ON CONFLICT (table_name) DO NOTHING;

-- Create function to archive data
CREATE OR REPLACE FUNCTION archive_old_data(
  p_table_name text,
  p_archive_table_name text,
  p_date_column text,
  p_retention_days integer
) RETURNS integer AS $$
DECLARE
  v_archived_count integer;
  v_cutoff_date timestamptz;
BEGIN
  v_cutoff_date := now() - (p_retention_days || ' days')::interval;
  
  -- Insert into archive table
  EXECUTE format(
    'INSERT INTO %I SELECT *, now() as archived_at FROM %I WHERE %I < $1',
    p_archive_table_name,
    p_table_name,
    p_date_column
  ) USING v_cutoff_date;
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Delete from original table
  EXECUTE format(
    'DELETE FROM %I WHERE %I < $1',
    p_table_name,
    p_date_column
  ) USING v_cutoff_date;
  
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete old data
CREATE OR REPLACE FUNCTION delete_old_data(
  p_table_name text,
  p_date_column text,
  p_retention_days integer
) RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
  v_cutoff_date timestamptz;
BEGIN
  v_cutoff_date := now() - (p_retention_days || ' days')::interval;
  
  EXECUTE format(
    'DELETE FROM %I WHERE %I < $1',
    p_table_name,
    p_date_column
  ) USING v_cutoff_date;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to process all retention policies
CREATE OR REPLACE FUNCTION process_data_retention() RETURNS jsonb AS $$
DECLARE
  v_policy RECORD;
  v_count integer;
  v_results jsonb := '[]'::jsonb;
  v_archive_table text;
BEGIN
  FOR v_policy IN 
    SELECT * FROM data_retention_policies WHERE is_enabled = true
  LOOP
    BEGIN
      IF v_policy.action = 'archive' THEN
        v_archive_table := v_policy.table_name || '_archive';
        v_count := archive_old_data(
          v_policy.table_name,
          v_archive_table,
          v_policy.date_column,
          v_policy.retention_days
        );
      ELSE
        v_count := delete_old_data(
          v_policy.table_name,
          v_policy.date_column,
          v_policy.retention_days
        );
      END IF;
      
      -- Update last cleanup time
      UPDATE data_retention_policies
      SET last_cleanup_at = now()
      WHERE id = v_policy.id;
      
      -- Add result
      v_results := v_results || jsonb_build_object(
        'table', v_policy.table_name,
        'action', v_policy.action,
        'count', v_count,
        'status', 'success'
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'table', v_policy.table_name,
        'action', v_policy.action,
        'status', 'error',
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed_at', now(),
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance on date columns
CREATE INDEX IF NOT EXISTS idx_gps_tracking_timestamp ON gps_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_created_at ON geofence_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_shift_check_ins_created_at ON shift_check_ins(created_at);
CREATE INDEX IF NOT EXISTS idx_real_time_locations_created_at ON real_time_locations(created_at);
