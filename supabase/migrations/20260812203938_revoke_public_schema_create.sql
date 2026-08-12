-- Older Postgres/Supabase projects may retain CREATE on public for PUBLIC.
-- Remove the inherited capability so the runtime login cannot create objects.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, aisles_app;
