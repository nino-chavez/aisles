-- Enriched product data from the LLM enrichment pipeline.
-- Stores persona-fit scores, semantic tags, and extracted attributes.

CREATE TABLE IF NOT EXISTS enriched_products (
  id              SERIAL PRIMARY KEY,
  bc_entity_id    INTEGER UNIQUE NOT NULL,
  bc_product_path TEXT NOT NULL,

  -- LLM-extracted attributes
  material        TEXT,
  style           TEXT,
  use_case        TEXT,
  dimensions      TEXT,
  price_tier      TEXT CHECK (price_tier IN ('budget', 'mid', 'premium', 'luxury')),

  -- Persona-fit scores (0.0 - 1.0)
  fit_gatherer    REAL NOT NULL DEFAULT 0.5,
  fit_hunter      REAL NOT NULL DEFAULT 0.5,
  fit_researcher  REAL NOT NULL DEFAULT 0.5,
  fit_gifter      REAL NOT NULL DEFAULT 0.5,

  -- Semantic tags for intent-based discovery
  semantic_tags   TEXT[] DEFAULT '{}',

  -- Metadata
  enriched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrichment_model TEXT NOT NULL,

  -- Future: embedding vector for semantic search
  -- embedding vector(1536)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups by BC entity ID
CREATE INDEX IF NOT EXISTS idx_enriched_bc_entity_id ON enriched_products(bc_entity_id);

-- Index for semantic tag searches
CREATE INDEX IF NOT EXISTS idx_enriched_semantic_tags ON enriched_products USING GIN(semantic_tags);
