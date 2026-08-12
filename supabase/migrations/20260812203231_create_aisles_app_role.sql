-- Server-only runtime role. It cannot create objects, bypass RLS, or access
-- tables outside the explicit grants below. A password is set out-of-band from
-- 1Password after this migration; no credential belongs in source control.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aisles_app') THEN
    CREATE ROLE aisles_app
      LOGIN
      PASSWORD NULL
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO aisles_app;
GRANT USAGE ON SCHEMA public, extensions TO aisles_app;

GRANT SELECT, INSERT, UPDATE ON public.enriched_products TO aisles_app;
GRANT SELECT, INSERT ON public.generation_logs TO aisles_app;
GRANT SELECT, INSERT, UPDATE ON public.session_outcomes TO aisles_app;
GRANT SELECT ON public.merchandising_rules TO aisles_app;

GRANT USAGE, SELECT ON SEQUENCE public.enriched_products_id_seq TO aisles_app;
GRANT USAGE, SELECT ON SEQUENCE public.generation_logs_id_seq TO aisles_app;
GRANT USAGE, SELECT ON SEQUENCE public.session_outcomes_id_seq TO aisles_app;
GRANT USAGE, SELECT ON SEQUENCE public.merchandising_rules_id_seq TO aisles_app;

CREATE POLICY enriched_products_aisles_app_select
  ON public.enriched_products FOR SELECT TO aisles_app USING (true);
CREATE POLICY enriched_products_aisles_app_insert
  ON public.enriched_products FOR INSERT TO aisles_app WITH CHECK (true);
CREATE POLICY enriched_products_aisles_app_update
  ON public.enriched_products FOR UPDATE TO aisles_app USING (true) WITH CHECK (true);

CREATE POLICY generation_logs_aisles_app_select
  ON public.generation_logs FOR SELECT TO aisles_app USING (true);
CREATE POLICY generation_logs_aisles_app_insert
  ON public.generation_logs FOR INSERT TO aisles_app WITH CHECK (true);

CREATE POLICY session_outcomes_aisles_app_select
  ON public.session_outcomes FOR SELECT TO aisles_app USING (true);
CREATE POLICY session_outcomes_aisles_app_insert
  ON public.session_outcomes FOR INSERT TO aisles_app WITH CHECK (true);
CREATE POLICY session_outcomes_aisles_app_update
  ON public.session_outcomes FOR UPDATE TO aisles_app USING (true) WITH CHECK (true);

CREATE POLICY merchandising_rules_aisles_app_select
  ON public.merchandising_rules FOR SELECT TO aisles_app USING (true);
