/*
  # Revoke GraphQL Schema Exposure and Secure SECURITY DEFINER Functions

  This migration addresses multiple security findings where tables and functions
  are unnecessarily exposed through the GraphQL schema to anon or authenticated roles.

  ## 1. Anon Role -- Table Access

  - Revoke SELECT from `anon` on `leads` (anon only needs INSERT for the contact form)
  - Keep SELECT for `anon` on `website_content` (public CMS content for landing page -- intentional)

  ## 2. Authenticated Role -- Archive Tables (never queried from app)

  Revoke ALL from `authenticated` on archive tables that are only written to by
  the data-retention-cleanup edge function (which uses service_role_key):
    - `audit_logs_archive`
    - `chat_messages_archive`
    - `check_ins_archive`
    - `incidents_archive`
    - `sos_alerts_archive`
    - `time_clocks_archive`

  ## 3. SECURITY DEFINER Functions -- Anon Role

  Revoke EXECUTE from `anon` on ALL listed SECURITY DEFINER functions.
  None of these are called by unauthenticated users. The register-company
  edge function uses service_role_key and bypasses role grants.

  Functions affected:
    - archive_old_data
    - create_company_bypass_rls
    - create_employment_history_on_company_change
    - create_profile_bypass_rls
    - delete_old_data
    - generate_company_code
    - handle_new_user
    - process_data_retention
    - set_company_code
    - sync_role_to_jwt

  ## 4. SECURITY DEFINER Functions -- Authenticated Role

  Revoke EXECUTE from `authenticated` on trigger-only and internal functions
  that should never be called directly via RPC:
    - archive_old_data (internal helper for data retention)
    - create_employment_history_on_company_change (trigger function)
    - delete_old_data (internal helper for data retention)
    - handle_new_user (auth trigger function)
    - process_data_retention (called by edge function via service_role)
    - set_company_code (trigger function)
    - sync_role_to_jwt (trigger function)
    - generate_company_code (trigger helper)

  Keep EXECUTE for `authenticated` on:
    - create_company_bypass_rls (called by register-company edge function, but
      edge function uses service_role so revoking is safe -- revoked for safety)
    - create_profile_bypass_rls (same as above -- revoked for safety)

  ## 5. Important Notes

  - All edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses role grants
  - RLS policies remain unchanged and continue to protect data access
  - The `website_content` anon SELECT is intentional for the public landing page
  - Tables queried by the app from authenticated sessions keep their grants
    because RLS policies control actual row-level access
*/

-- =============================================================================
-- 1. ANON ROLE: Revoke SELECT on leads (keep INSERT for contact form)
-- =============================================================================
REVOKE SELECT ON public.leads FROM anon;

-- =============================================================================
-- 2. AUTHENTICATED ROLE: Revoke ALL on archive tables (only used by service_role)
-- =============================================================================
REVOKE ALL ON public.audit_logs_archive FROM authenticated;
REVOKE ALL ON public.chat_messages_archive FROM authenticated;
REVOKE ALL ON public.check_ins_archive FROM authenticated;
REVOKE ALL ON public.incidents_archive FROM authenticated;
REVOKE ALL ON public.sos_alerts_archive FROM authenticated;
REVOKE ALL ON public.time_clocks_archive FROM authenticated;

-- Also revoke anon access on archive tables
REVOKE ALL ON public.audit_logs_archive FROM anon;
REVOKE ALL ON public.chat_messages_archive FROM anon;
REVOKE ALL ON public.check_ins_archive FROM anon;
REVOKE ALL ON public.incidents_archive FROM anon;
REVOKE ALL ON public.sos_alerts_archive FROM anon;
REVOKE ALL ON public.time_clocks_archive FROM anon;

-- =============================================================================
-- 3. ANON ROLE: Revoke EXECUTE on all SECURITY DEFINER functions
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.archive_old_data(text, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_company_bypass_rls(text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_employment_history_on_company_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_bypass_rls(uuid, text, public.user_role, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_old_data(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_data_retention() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_company_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_role_to_jwt() FROM anon;

-- =============================================================================
-- 4. AUTHENTICATED ROLE: Revoke EXECUTE on trigger/internal SECURITY DEFINER functions
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.archive_old_data(text, text, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_company_bypass_rls(text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_employment_history_on_company_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile_bypass_rls(uuid, text, public.user_role, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_old_data(text, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_data_retention() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_role_to_jwt() FROM authenticated;

-- Also revoke default PUBLIC execute on these functions to prevent future role grants
REVOKE EXECUTE ON FUNCTION public.archive_old_data(text, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_company_bypass_rls(text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_employment_history_on_company_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_profile_bypass_rls(uuid, text, public.user_role, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_old_data(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_data_retention() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_company_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_role_to_jwt() FROM PUBLIC;
