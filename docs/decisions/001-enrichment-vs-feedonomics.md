# Decision Record: Enrichment Pipeline vs Feedonomics

**Date:** 2026-04-06
**Status:** Open — future integration point
**Context:** Phase 3 enrichment pipeline discussion

## Question

The LLM enrichment script (`enrich.ts`) extracts attributes and scores persona-fit for every product. Would Feedonomics (or a similar PIM/feed management platform) eventually supersede this?

## Current Approach

The enrichment script reads products from BigCommerce and calls Claude to produce:

1. **Extracted attributes** — material, style, use case, dimensions, price tier
2. **Persona-fit scores** (0.0–1.0 per persona) — how well does this product appeal to a Gatherer, Hunter, Researcher, or Gifter?
3. **Semantic tags** — intent-based discovery labels ("compact", "dorm-friendly", "statement piece", "easy-care")

This data is stored in Neon Postgres and consumed by layout generation to sort/filter products by persona relevance.

## What Feedonomics Does

Feedonomics handles product data enrichment at scale:
- Attribute extraction and normalization
- Category taxonomy mapping
- Feed optimization for channels (Google Shopping, Meta, etc.)
- Data quality validation
- Image and description enrichment

## Where They Overlap

Attribute extraction (material, style, dimensions) is common ground. If a merchant already uses Feedonomics, those attributes are already clean and structured — the LLM doesn't need to re-extract them.

## Where They Don't Overlap

Feedonomics does **not** produce:
- **Persona-fit scores** — this is Aisles-specific intelligence. "How well does this $79 planter appeal to a Gatherer vs a Hunter?" is not a standard commerce data attribute.
- **Semantic tags for intent-based discovery** — Feedonomics optimizes for channel feeds (Google Shopping categories), not for persona-driven layout generation.
- **Shopper-intent-aware product ordering** — Feedonomics doesn't know about the Gatherer/Hunter/Researcher/Gifter model.

## Recommended Future Architecture

```
Feedonomics (or PIM)          Aisles Enrichment
─────────────────────         ──────────────────
Raw BC data                   Clean attributes from Feedonomics
  → Clean attributes            → Persona-fit scoring (LLM)
  → Category mapping            → Semantic tag generation (LLM)
  → Feed optimization           → Embedding generation
                                → Intent-based discovery index
```

**Feedonomics provides the clean input. Aisles enrichment adds the persona intelligence layer on top.**

If Feedonomics is available, the enrichment script skips attribute extraction (material, style, etc. are already clean) and focuses only on persona-fit scoring and semantic tags — which is cheaper and faster.

## Action Items

- [ ] Define an enrichment input interface that can consume either raw BC data or Feedonomics-enriched data
- [ ] Investigate Feedonomics API for attribute extraction format
- [ ] Benchmark enrichment cost: full LLM extraction vs persona-fit-only (with pre-extracted attributes)
- [ ] Consider Shopify's Agentic Plan feed format as another potential enrichment input source
