-- Supabase projects may grant table and sequence privileges to Data API roles
-- by default. These tables are server-only and must remain unreachable through
-- anon/authenticated even if a policy is added accidentally later.
REVOKE ALL PRIVILEGES ON TABLE
  public.enriched_products,
  public.generation_logs,
  public.session_outcomes,
  public.merchandising_rules
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE
  public.enriched_products_id_seq,
  public.generation_logs_id_seq,
  public.session_outcomes_id_seq,
  public.merchandising_rules_id_seq
FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
