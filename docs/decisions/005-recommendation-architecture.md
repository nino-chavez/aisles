# Decision Record: Recommendation Architecture

**Date:** 2026-05-13
**Status:** Proposed
**Context:** Defining the rec/ranking layer for persona-adaptive layouts

## Question

How should Aisles produce product recommendations and persona-adaptive layouts? Specifically: frontier LLM, a trained retail rec engine (Vertex AI Search for Commerce, Algolia AI, Bloomreach), a custom-trained model, or some combination?

## Decision

**Hybrid, layered, LLM-first.** Frontier LLM handles persona inference, layout/module choice, and rationale. Vector embeddings + heuristics handle candidate retrieval. No trained retail rec engine. No custom-trained models until per-client behavioral signal justifies them.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer                    │ Mechanism                        │
├──────────────────────────┼──────────────────────────────────┤
│ Candidate retrieval      │ Vector search (embeddings + ANN) │
│                          │ + attribute filters              │
│ Persona inference        │ Frontier LLM (Claude / Gemini)   │
│ Layout / module choice   │ Frontier LLM                     │
│ Product ordering         │ LLM rerank over candidate set    │
│ Rationale + copy         │ Frontier LLM (same pass)         │
│ Behavioral reranker      │ Deferred — adopt at ~100k        │
│                          │ interactions/client              │
└─────────────────────────────────────────────────────────────┘
```

## Rationale

The thesis of Aisles is that **layout + product + rationale chosen coherently from sparse signals** is the unlock. That triplet is a reasoning task, not a scoring task. Trained retail rec engines optimize ranking accuracy over warm behavioral data — a different problem.

Three forces drive the layered choice:

1. **Cold start dominates.** New SKUs, new shoppers, new client onboardings have no behavioral data. LLM reasons from product copy + a few clicks immediately. CF/ALS-style trained models need weeks of accumulated signal we won't have.
2. **Long-tail catalog.** Most SKUs across client catalogs will have <10 interactions. Embedding-based retrieval + LLM rerank treats every product equally because both consume the product text. Trained models collapse to best-sellers.
3. **Layout choice is not a rec problem.** Picking educational vs. price-led vs. lifestyle merchandising from 3–5 clicks is reasoning. No trained retail engine ships this primitive.

## What we keep

- **Vector embeddings + ANN for retrieval.** Provider-agnostic (OpenAI / Cohere / Voyage + pgvector or Pinecone). Table stakes; not a moat.
- **Frontier LLM for the reasoning layer.** Claude / Gemini, model-fungible at the boundary so we can re-bid the inference contract annually.
- **Enrichment-derived persona-fit scores and semantic tags** (see ADR-001) as input features to candidate ranking.
- **Static fallback layout** for cold start under 100ms (see ADR-002).

## What we explicitly are not doing

### Not adopting Vertex AI Search for Commerce

Vertex Commerce is credible and well-built. It's wrong for Aisles because:

- It partially substitutes for the LLM-first thesis instead of accelerating it. We'd be paying Google to do the layer where our differentiation lives.
- The integration cost is heavy and locks rec infrastructure into GCP. Aisles infra is not GCP-centric; the colocation benefit is absent.
- Its retail priors (SKU query parsing, attribute extraction) are valuable but partially covered by the enrichment pipeline (ADR-001), and the rest can be approximated with embeddings + LLM at a fraction of the lock-in.

**Reconsider if:** a specific enterprise client is already on GCP and requires behaviorally-trained ranking at a scale our LLM rerank can't match (>1M sessions/month with dense interaction signal).

### Not adopting Algolia AI / Bloomreach / Klevu

Same shape as Vertex Commerce: trained retail rec engines built for behaviorally-rich, warm-catalog retailers. Wrong fit for an LLM-reasoning-first storefront. Reconsider per-client if signal volume and latency requirements justify it.

### Not training custom models yet

Three tiers exist:

1. **None** — LLM + vectors + heuristics. (← Aisles, today and for the foreseeable next phase.)
2. **Fine-tuned reranker** — small model trained on aggregated behavioral data to rerank LLM/vector candidates. Worth it at roughly ~100k interactions per client.
3. **Full custom rec model** — Amazon/Walmart scale. Not Aisles, not any Aisles client.

Premature training burns the team on MLOps instead of the layout/rationale layer that is the actual moat. **Trigger to revisit tier 2:** a client crosses ~100k attributable interactions and a measurable ceiling on LLM-rerank precision appears in their cohort.

## How we know it's working

Standard ranking metrics (NDCG, precision@K) and CTR understate Aisles' value because they measure product ranking, not the layout + rationale + product triplet. Evaluation must include:

- **A/B vs. a credible baseline** (BC native recs, popularity, last-viewed) — not vs. nothing.
- **Holdout cohort** (no recs shown) to measure incremental lift, not correlation.
- **Synthetic-shopper eval** (BCSS) for pre-deploy persona-attributed evidence.
- **Layout-match scoring** — did we pick the right module type, not just the right products.
- **Rationale review** — sample 50 sessions/week, read the LLM's "why." Catches charm-over-causation drift.
- **Recovery speed** — clicks-to-correction when the first persona guess was wrong.

CTR alone will report Aisles as mediocre when it's winning, or great when it's filter-bubbling. The eval contract is part of the architecture, not an afterthought.

## Cost / latency budget

- **Cold-start layout:** static fallback < 100ms, LLM stream completes 2–4s (Haiku-first, Sonnet fallback — see ADR-002).
- **Per-rec inference cost:** 1–10¢ per LLM-driven layout. Acceptable while session volume is < 10M/month per client; revisit cost model above that.
- **Candidate retrieval:** vector search < 50ms p95, fully managed.

If a client's session volume or latency SLA breaks this budget, the trigger is **introduce a fine-tuned reranker**, not "swap to Vertex Commerce." The reranker preserves the LLM reasoning layer; replacing the engine surrenders the thesis.

## Action items

- [ ] Document the embeddings provider choice in a follow-up ADR (OpenAI vs. Voyage vs. Cohere) once a benchmark on the enrichment corpus is run
- [ ] Define the eval harness contract (synthetic shopper + holdout cohort + rationale-review sampling) as a testable artifact, not a checklist
- [ ] Set the per-client interaction counter that triggers the tier-2 reranker conversation
- [ ] Decide pgvector vs. managed vector DB once the embeddings corpus crosses 1M vectors per client

## Related

- ADR-001 — Enrichment pipeline (persona-fit scoring, semantic tags) feeds candidate ranking
- ADR-002 — Streaming layout generation defines the latency budget this architecture lives inside
- ADR-004 — Vocabulary constraint invariant bounds what the rationale layer can say
