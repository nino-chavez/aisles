
ALTER TABLE public.generation_logs
  ADD COLUMN synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN scenario_id TEXT;

ALTER TABLE public.session_outcomes
  ADD COLUMN synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN scenario_id TEXT;
