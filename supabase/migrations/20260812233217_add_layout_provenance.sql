-- Additive provenance for generated layouts. Existing rows remain NULL and
-- Observe labels them as pre-provenance records; new application writes supply
-- the complete envelope. Existing RLS, aisles_app grants, and public-deny
-- posture continue to govern these columns through the table.

ALTER TABLE public.generation_logs
  ADD COLUMN organization_id TEXT,
  ADD COLUMN provenance_version TEXT,
  ADD COLUMN reference_status TEXT,
  ADD COLUMN reference_id TEXT,
  ADD COLUMN reference_version TEXT,
  ADD COLUMN policy_version TEXT,
  ADD COLUMN surface TEXT,
  ADD COLUMN route TEXT,
  ADD COLUMN viewport_class TEXT,
  ADD COLUMN renderer_component_id TEXT,
  ADD COLUMN renderer_variant_id TEXT,
  ADD COLUMN decision_source TEXT,
  ADD COLUMN input_hash TEXT,
  ADD COLUMN catalog_version TEXT,
  ADD COLUMN shopper_context_hash TEXT,
  ADD COLUMN picks_hash TEXT,
  ADD COLUMN incentive_hash TEXT,
  ADD COLUMN autonomy_preset TEXT,
  ADD COLUMN effective_capabilities JSONB,
  ADD COLUMN decision_mode TEXT,
  ADD COLUMN publication_mode TEXT,
  ADD COLUMN schema_version TEXT,
  ADD CONSTRAINT generation_logs_provenance_completeness_check CHECK (
    (
      provenance_version IS NULL
      AND organization_id IS NULL
      AND reference_status IS NULL
      AND reference_id IS NULL
      AND reference_version IS NULL
      AND policy_version IS NULL
      AND surface IS NULL
      AND route IS NULL
      AND viewport_class IS NULL
      AND renderer_component_id IS NULL
      AND renderer_variant_id IS NULL
      AND decision_source IS NULL
      AND input_hash IS NULL
      AND catalog_version IS NULL
      AND shopper_context_hash IS NULL
      AND picks_hash IS NULL
      AND incentive_hash IS NULL
      AND autonomy_preset IS NULL
      AND effective_capabilities IS NULL
      AND decision_mode IS NULL
      AND publication_mode IS NULL
      AND schema_version IS NULL
    )
    OR (
      provenance_version = 'layout-provenance-v1'
      AND organization_id IS NOT NULL
      AND reference_status IS NOT NULL
      AND policy_version IS NOT NULL
      AND surface IS NOT NULL
      AND route IS NOT NULL
      AND viewport_class IS NOT NULL
      AND renderer_component_id IS NOT NULL
      AND renderer_variant_id IS NOT NULL
      AND decision_source IS NOT NULL
      AND input_hash IS NOT NULL
      AND catalog_version IS NOT NULL
      AND shopper_context_hash IS NOT NULL
      AND effective_capabilities IS NOT NULL
      AND decision_mode IS NOT NULL
      AND publication_mode IS NOT NULL
      AND schema_version IS NOT NULL
      AND prompt_version IS NOT NULL
    )
  ),
  ADD CONSTRAINT generation_logs_reference_identity_check CHECK (
    (reference_status IS NULL AND reference_id IS NULL AND reference_version IS NULL)
    OR (reference_status = 'contracted' AND reference_id IS NOT NULL AND reference_version IS NOT NULL)
    OR (reference_status = 'uncontracted_legacy' AND reference_id IS NULL AND reference_version IS NULL)
  ),
  ADD CONSTRAINT generation_logs_surface_check CHECK (
    surface IS NULL OR surface IN (
      'home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'error-404', 'error-empty'
    )
  ),
  ADD CONSTRAINT generation_logs_viewport_class_check CHECK (
    viewport_class IS NULL OR viewport_class = 'responsive'
  ),
  ADD CONSTRAINT generation_logs_decision_source_check CHECK (
    decision_source IS NULL OR decision_source IN ('fixed', 'rules', 'model', 'merchant', 'fallback')
  ),
  ADD CONSTRAINT generation_logs_autonomy_preset_check CHECK (
    autonomy_preset IS NULL OR autonomy_preset IN ('preserve', 'assist', 'compose', 'explore')
  ),
  ADD CONSTRAINT generation_logs_effective_capabilities_check CHECK (
    effective_capabilities IS NULL OR jsonb_typeof(effective_capabilities) = 'array'
  ),
  ADD CONSTRAINT generation_logs_decision_mode_check CHECK (
    decision_mode IS NULL OR decision_mode IN ('fixed', 'rules', 'model')
  ),
  ADD CONSTRAINT generation_logs_publication_mode_check CHECK (
    publication_mode IS NULL OR publication_mode IN ('live', 'holdout', 'approval_required')
  ),
  ADD CONSTRAINT generation_logs_input_hash_check CHECK (
    input_hash IS NULL OR input_hash ~ '^[0-9a-f]{16}$'
  ),
  ADD CONSTRAINT generation_logs_catalog_version_check CHECK (
    catalog_version IS NULL OR catalog_version ~ '^catalog:[0-9a-f]{16}$'
  ),
  ADD CONSTRAINT generation_logs_shopper_context_hash_check CHECK (
    shopper_context_hash IS NULL OR shopper_context_hash ~ '^[0-9a-f]{16}$'
  ),
  ADD CONSTRAINT generation_logs_picks_hash_check CHECK (
    picks_hash IS NULL OR picks_hash ~ '^[0-9a-f]{16}$'
  ),
  ADD CONSTRAINT generation_logs_incentive_hash_check CHECK (
    incentive_hash IS NULL OR incentive_hash ~ '^[0-9a-f]{16}$'
  );
