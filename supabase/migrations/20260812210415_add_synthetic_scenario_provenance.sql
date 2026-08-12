
ALTER TABLE public.generation_logs
  ADD COLUMN synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN scenario_id TEXT,
  ADD CONSTRAINT generation_logs_synthetic_scenario_provenance
    CHECK ((synthetic AND scenario_id IS NOT NULL) OR (NOT synthetic AND scenario_id IS NULL));

ALTER TABLE public.session_outcomes
  ADD COLUMN synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN scenario_id TEXT,
  ADD CONSTRAINT session_outcomes_synthetic_scenario_provenance
    CHECK ((synthetic AND scenario_id IS NOT NULL) OR (NOT synthetic AND scenario_id IS NULL));
