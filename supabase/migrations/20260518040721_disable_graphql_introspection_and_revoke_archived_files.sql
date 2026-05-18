/*
  # Disable GraphQL Introspection and Revoke archived_files Access

  This migration addresses the remaining GraphQL schema visibility issues.

  ## Problem

  All public schema tables are visible via GraphQL introspection to both anon
  and authenticated roles. The pg_graphql extension's event trigger
  (`issue_pg_graphql_access`, owned by supabase_admin) automatically re-grants
  EXECUTE and USAGE permissions, so direct REVOKE statements are ineffective.

  ## Solution

  1. Disable GraphQL introspection on the public schema using pg_graphql's
     built-in `@graphql` comment directive. This prevents schema discovery
     through GraphQL introspection queries for all roles.

  2. Revoke access on `archived_files` table from anon and authenticated
     (only used by the data-retention-cleanup edge function via service_role).

  ## Impact

  - GraphQL introspection queries return empty results (tables not discoverable)
  - Non-introspection GraphQL queries still blocked by RLS policies
  - REST API: NOT affected at all
  - Edge Functions: NOT affected (use service_role_key)
*/

-- =============================================================================
-- 1. Disable GraphQL introspection on the public schema
-- =============================================================================
COMMENT ON SCHEMA public IS '@graphql({"inflect_names": true, "max_rows": 1000, "introspection": false})';

-- =============================================================================
-- 2. Revoke access on archived_files (only used by service_role)
-- =============================================================================
REVOKE ALL ON public.archived_files FROM anon;
REVOKE ALL ON public.archived_files FROM authenticated;
