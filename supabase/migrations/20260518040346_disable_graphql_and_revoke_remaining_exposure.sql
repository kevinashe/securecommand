/*
  # Disable GraphQL Schema Exposure and Revoke Remaining Table Access

  This migration completely disables GraphQL API access for anon and authenticated
  roles, which resolves all remaining "visible in GraphQL schema" security findings.

  The application uses only the Supabase REST API (PostgREST), never GraphQL.
  Disabling GraphQL access does NOT affect REST API queries, which continue to
  work normally with RLS policies controlling data access.

  ## 1. Disable GraphQL Access

  Revoke EXECUTE on `graphql_public.graphql` function from:
    - `anon` (unauthenticated users)
    - `authenticated` (signed-in users)
    - `PUBLIC` (default grant)

  This prevents all 50+ tables from being discoverable via GraphQL introspection
  without affecting the REST API that the application uses.

  ## 2. Revoke Access on archived_files Table

  The `archived_files` table is only used by the data-retention-cleanup edge
  function (via service_role_key). Revoke all access from anon and authenticated.

  ## 3. Important Notes

  - REST API access is NOT affected by these changes
  - RLS policies continue to protect all data access via REST
  - Edge functions using service_role_key are NOT affected
  - The `website_content` table remains accessible via REST for the public landing page
*/

-- =============================================================================
-- 1. DISABLE GRAPHQL: Revoke execute on the graphql function
-- =============================================================================
REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION graphql_public.graphql(text, text, jsonb, jsonb) FROM PUBLIC;

-- Also revoke USAGE on graphql_public schema to prevent any future discovery
REVOKE USAGE ON SCHEMA graphql_public FROM anon;
REVOKE USAGE ON SCHEMA graphql_public FROM authenticated;

-- =============================================================================
-- 2. REVOKE ACCESS: archived_files table (only used by service_role)
-- =============================================================================
REVOKE ALL ON public.archived_files FROM authenticated;
REVOKE ALL ON public.archived_files FROM anon;
