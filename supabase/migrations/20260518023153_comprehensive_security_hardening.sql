/*
  # Comprehensive Security Hardening

  This migration addresses multiple categories of security vulnerabilities.

  ## 1. RLS Policies Using user_metadata (Critical - 3 policies)
    - system_settings: Replace INSERT and UPDATE policies that check user_metadata
      with profiles-based lookups (user_metadata is editable by end users)
    - geofence_violations: Replace super admin SELECT policy that checks user_metadata

  ## 2. Function Search Path Mutable (14 functions)
    - Set search_path = public on all affected functions to prevent search_path hijacking

  ## 3. Always-True RLS INSERT Policies (5 tables)
    - audit_logs, geofence_violations, notifications: Restrict to service_role
    - companies: Require authenticated user identity
    - leads: Keep anon but add required field validation

  ## 4. Storage Bucket Listing
    - Restrict incident-photos SELECT policy to authenticated users

  ## 5. GraphQL Schema Exposure (57 tables)
    - Revoke SELECT from anon on all tables except leads and website_content

  ## 6. SECURITY DEFINER Function Execution (10 functions)
    - Revoke EXECUTE from anon and authenticated where not needed
*/

-- =============================================================================
-- 1. FIX RLS POLICIES USING user_metadata
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can insert system settings" ON system_settings;
CREATE POLICY "Super admins can insert system settings"
  ON system_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admins can update system settings" ON system_settings;
CREATE POLICY "Super admins can update system settings"
  ON system_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "Super admins can view all violations" ON geofence_violations;
CREATE POLICY "Super admins can view all violations"
  ON geofence_violations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- =============================================================================
-- 2. FIX MUTABLE SEARCH_PATH ON FUNCTIONS
-- =============================================================================

ALTER FUNCTION public.generate_company_code() SET search_path = public;
ALTER FUNCTION public.create_employment_history_on_company_change() SET search_path = public;
ALTER FUNCTION public.set_company_code() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.archive_old_data(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.delete_old_data(text, text, integer) SET search_path = public;
ALTER FUNCTION public.process_data_retention() SET search_path = public;
ALTER FUNCTION public.update_company_buses_updated_at() SET search_path = public;
ALTER FUNCTION public.calculate_total_hours() SET search_path = public;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public;
ALTER FUNCTION public.generate_staff_code(uuid, text) SET search_path = public;
ALTER FUNCTION public.update_leads_updated_at() SET search_path = public;
ALTER FUNCTION public.update_real_time_locations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_invoice_totals() SET search_path = public;

-- =============================================================================
-- 3. FIX ALWAYS-TRUE RLS INSERT POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;
CREATE POLICY "Service role can create audit logs"
  ON audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can create companies during signup" ON companies;
CREATE POLICY "Authenticated users can create companies during signup"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert violations" ON geofence_violations;
CREATE POLICY "Service role can insert violations"
  ON geofence_violations FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "Service role can create notifications"
  ON notifications FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can submit leads" ON leads;
CREATE POLICY "Anyone can submit leads with required fields"
  ON leads FOR INSERT TO anon
  WITH CHECK (
    name IS NOT NULL AND name <> ''
    AND email IS NOT NULL AND email <> ''
  );

-- =============================================================================
-- 4. RESTRICT STORAGE BUCKET LISTING
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can view incident photos" ON storage.objects;
CREATE POLICY "Authenticated users can view incident photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'incident-photos' AND auth.uid() IS NOT NULL);

-- =============================================================================
-- 5. REVOKE SELECT FROM anon ON ALL PUBLIC TABLES
-- =============================================================================

REVOKE SELECT ON public.archived_files FROM anon;
REVOKE SELECT ON public.audit_logs FROM anon;
REVOKE SELECT ON public.audit_logs_archive FROM anon;
REVOKE SELECT ON public.billing_rates FROM anon;
REVOKE SELECT ON public.billing_settings FROM anon;
REVOKE SELECT ON public.break_logs FROM anon;
REVOKE SELECT ON public.bus_check_ins FROM anon;
REVOKE SELECT ON public.chat_messages FROM anon;
REVOKE SELECT ON public.chat_messages_archive FROM anon;
REVOKE SELECT ON public.check_ins FROM anon;
REVOKE SELECT ON public.check_ins_archive FROM anon;
REVOKE SELECT ON public.checkpoints FROM anon;
REVOKE SELECT ON public.client_access FROM anon;
REVOKE SELECT ON public.companies FROM anon;
REVOKE SELECT ON public.company_buses FROM anon;
REVOKE SELECT ON public.company_growth_metrics FROM anon;
REVOKE SELECT ON public.data_retention_policies FROM anon;
REVOKE SELECT ON public.employment_history FROM anon;
REVOKE SELECT ON public.equipment FROM anon;
REVOKE SELECT ON public.geofence_violations FROM anon;
REVOKE SELECT ON public.gps_tracking FROM anon;
REVOKE SELECT ON public.guard_availability FROM anon;
REVOKE SELECT ON public.guard_qualifications FROM anon;
REVOKE SELECT ON public.incident_photos FROM anon;
REVOKE SELECT ON public.incidents FROM anon;
REVOKE SELECT ON public.incidents_archive FROM anon;
REVOKE SELECT ON public.invoice_items FROM anon;
REVOKE SELECT ON public.invoices FROM anon;
REVOKE SELECT ON public.logbook_entries FROM anon;
REVOKE SELECT ON public.messages FROM anon;
REVOKE SELECT ON public.notifications FROM anon;
REVOKE SELECT ON public.patrol_routes FROM anon;
REVOKE SELECT ON public.payment_gateways FROM anon;
REVOKE SELECT ON public.payment_methods FROM anon;
REVOKE SELECT ON public.payment_transactions FROM anon;
REVOKE SELECT ON public.payments FROM anon;
REVOKE SELECT ON public.pricing_plans FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.real_time_locations FROM anon;
REVOKE SELECT ON public.revenue_metrics FROM anon;
REVOKE SELECT ON public.scheduled_reports FROM anon;
REVOKE SELECT ON public.shift_check_ins FROM anon;
REVOKE SELECT ON public.shift_swaps FROM anon;
REVOKE SELECT ON public.shift_templates FROM anon;
REVOKE SELECT ON public.shifts FROM anon;
REVOKE SELECT ON public.site_requirements FROM anon;
REVOKE SELECT ON public.sites FROM anon;
REVOKE SELECT ON public.sos_alerts FROM anon;
REVOKE SELECT ON public.sos_alerts_archive FROM anon;
REVOKE SELECT ON public.storage_usage FROM anon;
REVOKE SELECT ON public.subscriptions FROM anon;
REVOKE SELECT ON public.system_metrics FROM anon;
REVOKE SELECT ON public.system_settings FROM anon;
REVOKE SELECT ON public.time_clocks FROM anon;
REVOKE SELECT ON public.time_clocks_archive FROM anon;
REVOKE SELECT ON public.time_off_requests FROM anon;
REVOKE SELECT ON public.user_activity_metrics FROM anon;

-- =============================================================================
-- 6. REVOKE EXECUTE ON SECURITY DEFINER FUNCTIONS
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.archive_old_data(text, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_company_bypass_rls(text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_employment_history_on_company_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_bypass_rls(uuid, text, user_role, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_old_data(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_data_retention() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_company_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_role_to_jwt() FROM anon;

REVOKE EXECUTE ON FUNCTION public.archive_old_data(text, text, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_old_data(text, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_data_retention() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_employment_history_on_company_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_role_to_jwt() FROM authenticated;
