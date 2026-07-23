-- Session outcomes for Bayesian inference calibration.
-- Each row is one finalized session: the final inference state plus the
-- observed behavioral outcomes (conversion, cart adds, dwell, etc.).
-- Used by the LR fitting script to learn empirical likelihood ratios and
-- by the calibration check to measure posterior reliability.

CREATE TABLE IF NOT EXISTS session_outcomes (
  id                      SERIAL PRIMARY KEY,
  session_id              TEXT UNIQUE NOT NULL,
  ended_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms             BIGINT NOT NULL DEFAULT 0,

  -- Final inference snapshot
  primary_final           TEXT NOT NULL CHECK (primary_final IN ('gatherer','hunter','researcher','gifter')),
  probabilities_final     JSONB NOT NULL,
  entropy_final           REAL NOT NULL,
  certainty_final         REAL NOT NULL,
  prior_at_start          JSONB NOT NULL,

  -- Observed in-session behavior (the "outcome" signal for LR fitting)
  converted               BOOLEAN NOT NULL DEFAULT FALSE,
  cart_add_count          INTEGER NOT NULL DEFAULT 0,
  cart_removal_count      INTEGER NOT NULL DEFAULT 0,
  product_view_count      INTEGER NOT NULL DEFAULT 0,
  category_view_count     INTEGER NOT NULL DEFAULT 0,
  refine_message_count    INTEGER NOT NULL DEFAULT 0,
  back_nav_count          INTEGER NOT NULL DEFAULT 0,
  max_scroll_depth        REAL NOT NULL DEFAULT 0,
  avg_dwell_ms            REAL NOT NULL DEFAULT 0,

  -- Cross-session context
  visit_count             INTEGER NOT NULL DEFAULT 1,
  current_category        TEXT,

  -- Which inference rules fired — used for per-rule LR fitting.
  -- Stored as an array of rule names. Duplicates not expected.
  rule_matches            TEXT[] NOT NULL DEFAULT '{}',

  -- Label source — how the ground-truth persona for this session was determined.
  -- 'intent_param'     : ?intent=X URL param (highest-confidence label)
  -- 'conversion'       : inferred from converted session with agreeing primary
  -- 'behavior_pattern' : strong behavioral signal matches a single persona
  -- 'unknown'          : no ground truth available; excluded from LR fitting
  label_source            TEXT NOT NULL DEFAULT 'unknown',
  label_persona           TEXT CHECK (label_persona IN ('gatherer','hunter','researcher','gifter') OR label_persona IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_ended_at ON session_outcomes(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_label_source ON session_outcomes(label_source) WHERE label_source <> 'unknown';
CREATE INDEX IF NOT EXISTS idx_outcomes_primary ON session_outcomes(primary_final);
CREATE INDEX IF NOT EXISTS idx_outcomes_current_category ON session_outcomes(current_category) WHERE current_category IS NOT NULL;
