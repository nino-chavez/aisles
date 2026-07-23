# Roadmap: Prism Reference Implementation

## Guiding Principles

1. **Walking skeleton first.** Build the thinnest end-to-end slice through all architectural layers, then widen. Never build modules and integrate later.
2. **BigCommerce as-is.** We consume existing APIs. No platform modifications, no custom checkout UI, no catalog mutations from the storefront.
3. **Baseline first, intelligence second.** Every page works without AI. AI makes it dramatically better. Graceful degradation is a feature, not an afterthought.
4. **Data quality is the moat.** The intelligence layer is only as good as the product data feeding it. Enrichment is not optional.
5. **Explain the magic.** A reference implementation that doesn't explain its own decisions is just a demo. Observability is first-class.
6. **Prove, then extract.** Ship the storefront. Learn what works. Then decide what becomes reusable tooling.

---

## Build Sequence

```
Phase 0: Design Spine ← (complete)
Phase 1: Walking Skeleton ──────────────────────────────────►
Phase 2: Widen Personas ──────────────────►
Phase 3: Widen Catalog + Enrichment ──────────────────────►
Phase 4: Enrich (trends, NLP, observability) ─────────────►
Phase 5: Polish (accessibility, perf, pipeline, docs) ────►
```

Each phase delivers a working, deployable storefront. No phase produces an isolated module that must be integrated later.

---

## Phase 0: Design Spine (Complete)

**Deliverable:** `specchain/product/design-spine.md` — the 3-act user journey (Alex shopping for couches, returning for continuity, then shifting to dorm furniture) that exercises every architectural seam.

**Status:** Done. This document defines the walking skeleton's scope and acceptance criteria.

---

## Phase 1: Walking Skeleton

**Goal:** The thinnest end-to-end implementation that proves Prism's thesis across all three acts of the design spine.

**Scope:**
- 2 personas: Gatherer + Hunter
- 2 categories: Living Room + Office/Dorm
- 30 products (15 per category), manually enriched with persona-fit scores
- 3 sessions: cold start → continuity → adaptation (the full Alex journey)

### What gets built

**Baseline storefront (the 70% deterministic shell):**
- SvelteKit project scaffold with Tailwind v4 + brand-forge generated tokens
- BigCommerce Storefront GraphQL client (typed, fetch-based, following Catalyst patterns)
- Shared shell: nav bar, search, cart drawer, footer — identical on every page
- Product listing page with standard grid (the canonical baseline)
- Product detail page (deterministic structure: images, price, variants, CTA, description)
- Cart operations (add, update, remove) via BC GraphQL mutations
- Embedded checkout (BC Checkout JS SDK via `onMount`)
- SEO baseline: meta tags, Open Graph, JSON-LD product schema
- Responsive design (mobile-first)

**Generative content area (the 30% adaptive zone):**
- Persona detection from URL params, referrer, search query, cookies
- Two layout variants for category pages:
  - Gatherer: magazine-style, editorial cards, lifestyle imagery, 2-column
  - Hunter: dense grid, price-prominent, quick-add, 3-4 column
- Layout generation via Vercel AI SDK `streamObject` with Zod schema
- Component renderer: takes layout JSON, renders Svelte components
- Layout validation: Zod schema enforces CTA, price, contrast
- Canonical fallback: if generation fails, serve baseline grid

**Conversational refinement (2 constraint types):**
- Floating refinement panel (bottom-right desktop, bottom sheet mobile)
- Supports: price constraints ("under $3,000") and category/subcategory ("leather sofas" → "accessories")
- Delta-based re-generation of content area
- Agent state in Upstash Redis (30-min session TTL)

**Cross-session persona evolution:**
- Cookie-based returning user identification
- Session summary stored in Upstash (persona, category, purchase history)
- Act 2: returning visitor sees continuity (complementary products)
- Act 3: stale persona detection — search query conflicts with stored model → persona shifts
- Previous model deprioritized, not deleted

**Observability (minimal):**
- Dev mode overlay via `?dev=true` URL param
- Shows: detected persona, confidence score, layout decision, cache hit/miss
- Console logging of T_composition latency
- BC order webhook captures purchase outcome

### Constraints

- Checkout is embedded (BC iframe), not custom. No PCI compliance.
- Cart state lives in BigCommerce. We call the API, we don't replicate.
- Customer auth uses BC's JWT flow. No custom auth system.
- Rate limits (150 req/30s REST, 1000 complexity/req GraphQL) require caching.
- Product images from BC CDN. No local image pipeline.
- Enrichment is manual (persona-fit scores hand-assigned to 30 products). No LLM pipeline yet.
- Cache is simple key-value (persona:category). No persona-aware TTL optimization.
- Trends are mocked (hardcoded badges). No Tavily integration.

### Gaps

- No SvelteKit equivalent of Catalyst's component library — built from scratch.
- BC Embedded Checkout JS SDK designed for React/vanilla JS. Needs verification in Svelte `onMount`.
- BC Storefront GraphQL docs have gaps around metafields. May need REST fallbacks.
- Svelte 5 compatibility with `@ai-sdk/svelte` — may need thin `$state` wrapper.

### Risks

- Embedded Checkout CORS/CSP issues in SvelteKit. Fallback: redirect to BC-hosted checkout.
- GraphQL complexity limits may constrain deep product queries. May need split queries.
- Cold-start latency for first-time generative layout (cache miss) may exceed 3s target.

### Known Unknowns

- Actual cold-cache latency for BC Storefront GraphQL from Vercel Edge.
- Quality of layout generation from `streamObject` with Svelte component schemas.
- Whether delta generation is cheaper than full regeneration in practice.
- How reliably the system detects "stale persona" vs. "same persona, new category."

### Success Criteria

The walking skeleton succeeds when the design spine's 3-act journey works end-to-end:

- **Act 1:** Alex browses couches (Gatherer layout), refines to leather under $3,000, purchases
- **Act 2:** Alex returns next day, sees complementary products (continuity works)
- **Act 3:** Alex returns a week later, searches "dorm room desk," sees Hunter layout (adaptation works — no stale sectional recommendations)
- Dev mode shows the full story: 3 visits, persona shift, constraint history
- Baseline storefront works with AI completely disabled (kill switch)
- Lighthouse > 90 on baseline pages
- Full purchase flow: browse → PDP → cart → checkout → confirmation

**Depends On:** BigCommerce demo store provisioned with furniture catalog (30 products across 2 categories).

---

## Phase 2: Widen Personas

**Goal:** Add Researcher and Gifter layouts to the walking skeleton. Same 2 categories, same 30 products.

**What gets built:**
- Researcher layout: spec cards, comparison tables, review highlights, feature-by-feature sort
- Gifter layout: budget-tier collections, occasion filters, gift-worthiness badges, "gift this item" on PDP
- Persona detection expanded: UTM-based (gift-guide = Gifter), behavior-based (comparison views = Researcher)
- Price sensitivity modifier applied across all 4 personas
- Dev mode persona toggle: switch between all 4 layouts on any category page

**Success Criteria:**
- Same category URL renders 4 fundamentally different content areas
- Price sensitivity modulates each persona's layout (Hunter + budget vs. Hunter + premium)
- Persona toggle in dev mode demonstrates the thesis to stakeholders

**Depends On:** Phase 1 complete.

---

## Phase 3: Widen Catalog + Enrichment Pipeline

**Goal:** Move from 30 manually-enriched products to full BigCommerce catalog with automated enrichment.

**What gets built:**
- Build-time catalog sync: pull full product catalog from BC REST API
- LLM-powered enrichment pipeline:
  - Attribute extraction (material, use case, style, dimensions, price tier)
  - Persona-fit scoring per product (all 4 personas)
  - Semantic tag generation for intent-based discovery
  - Embedding generation (OpenAI text-embedding-3-small) → Supabase pgvector
- Incremental sync: BC webhooks trigger re-enrichment for changed products
- Validation: 3-layer check (schema, hallucination detection, sanitization)
- Semantic search: meaning-based product queries ("compact dorm furniture under $200")
- Edge caching: Upstash Redis with persona-aware TTL
- Full BC catalog navigation: all categories, brands, search

**Constraints:**
- Enrichment runs at build/deploy time for full catalog, webhook-triggered for incremental.
- LLM enrichment cost: ~$0.001/product. 1000-product catalog = ~$1/full run.
- Embeddings are model-specific. Switching embedding providers requires re-embedding.

**Gaps:**
- No Feedonomics integration. Enrichment quality depends on LLM extraction from BC's raw data.
- No image-based attribute extraction. Text-only enrichment.
- Category taxonomy mapping is manual for the demo store.

**Known Unknowns:**
- Quality of LLM extraction from sparse BC product descriptions.
- Optimal embedding model for commerce (text-embedding-3-small vs. alternatives).
- Enrichment pipeline runtime for catalogs > 1,000 products.

**Success Criteria:**
- 90%+ of catalog products have complete persona-fit scores
- Semantic search returns relevant results for 10 test queries
- Enrichment pipeline < 5 minutes for 500 products
- Incremental update < 10 seconds per product change
- Full catalog navigable with persona-adaptive layouts

**Market Signal (2026-03-24):** OpenAI abandoned Instant Checkout in ChatGPT after failing at merchant onboarding, tax compliance, and accurate product data. Validates Prism's "own discovery, delegate transactions" architecture. Watch for: Agentic Commerce Protocol (Stripe + OpenAI) and Shopify's Agentic Plan feed format as potential enrichment inputs. Sources: [CNBC](https://www.cnbc.com/2026/03/24/openai-revamps-shopping-experience-in-chatgpt-after-instant-checkout.html), [Forrester](https://www.forrester.com/blogs/what-it-means-that-the-leader-in-agentic-commerce-just-pulled-back/), [TechCrunch](https://techcrunch.com/2026/03/24/openais-plans-to-make-chatgpt-more-like-amazon-arent-going-so-well/).

**Depends On:** Phase 2 complete, Supabase project provisioned.

---

## Phase 4: Enrich

**Goal:** Layer trend intelligence, full natural language refinement, and production observability onto the working storefront.

**What gets built:**

**Trend enrichment:**
- Tavily Search API integration for real-time trend context
- Trend-aware product boosting (trending items, expert citations)
- Trend badges on product cards ("Trending," "Expert Pick")
- Cached per-query, 1-hour TTL. Graceful degradation if unavailable.

**Full conversational refinement:**
- Natural language understanding beyond simple constraints
- Multi-item checklist mode ("I need a desk, bed frame, and storage under $400")
- Constraint conflict negotiation ("cheaper + higher quality" → agent explains trade-off)
- Cross-category refinement (agent suggests items from different categories)
- Quick-action pills contextual to current view

**Observability dashboard:**
- Langfuse integration: full LLM tracing (prompt, response, tokens, latency)
- Dev mode overlay expanded: session history, persona evolution, latency breakdown per worker
- Analytics events: generation, refinement, cart, checkout, persona shift
- BC order webhook → feedback ingestion
- T_composition monitoring: alert if exceeding 200ms target

**Constraints:**
- Tavily free tier: ~2,300 calls/month. Cache aggressively.
- Trend data is supplementary, never required.
- Feedback loop is read-only in v1 — collect data, manual analysis. No auto-optimization.
- No PII in tracing.

**Success Criteria:**
- Trend-enriched layouts show measurably different product selection
- 5-turn refinement conversation produces coherent, non-repetitive results
- Dev mode shows full cross-session story (the State 13 view from the design spine)
- Langfuse captures 100% of LLM calls
- T_composition stays under 200ms for 95% of requests

**Depends On:** Phase 3 complete.

---

## Phase 5: Polish

**Goal:** Production readiness — accessibility, performance, pipeline integration, and documentation.

**What gets built:**

**Accessibility audit:**
- WCAG AA compliance verified per-component
- Keyboard navigation tested on all generated layouts
- Screen reader compatibility validated
- Automated accessibility checks in CI

**Performance optimization:**
- Lighthouse > 90 on all page types (baseline and generated)
- Pre-generation of top persona variants at deploy time
- Cache hit rate monitoring and TTL tuning
- Sub-200ms T_composition for 95th percentile

**Pipeline integration (the factory demo):**
- Design token pipeline generates Tailwind v4 tokens from `brand.json` (already done)
- Content generation pipeline produces product copy, hero text, CTA copy from brand + catalog
- Asset generation pipeline creates hero images, category headers, social cards
- Documented workflow: `brand.json` → pipeline → deploy → AI layouts using pipeline tokens
- Config-driven: changing `brand.json` regenerates the entire design system

**Documentation:**
- Architecture guide: how Prism works, end to end
- Integration guide: how to connect a different BC store
- Pipeline guide: how to run the automated delivery pipeline
- Design system reference: component library with persona variants
- The self-explaining store: what the dev mode overlay shows and why

**Success Criteria:**
- WCAG AA compliance on all pages and components
- Changing `brand.json` + re-running pipeline produces a visually distinct but functional storefront
- Documentation sufficient for another developer to replicate on a different BC store
- Full reference implementation deployed and demo-ready

**Depends On:** Phase 4 complete, pipeline tools working.

---

## What's Not in This Roadmap

These are acknowledged future capabilities, explicitly deferred:

| Capability | Why deferred |
|-----------|-------------|
| Agent-authorized checkout | Trust UX is unsolved design problem; needs research, not code |
| Agent cart construction | Requires agent-authorized checkout to be meaningful |
| Digital twin / product ownership graph | Post-purchase lifecycle; no infrastructure yet |
| Product compatibility graph | Requires Feedonomics-level data enrichment |
| Ambient context inference (push-based) | Requires user profile + purchase history; no data yet |
| Cross-session user profiles (account-based) | Walking skeleton uses cookies; account-based profiles need privacy design |
| Makeswift integration | Not needed for reference implementation; documented as integration point in north-star |
| Multi-storefront / multi-tenant | Engine extraction is post-validation |
| A/B testing framework | Need baseline traffic before controlled experiments |
| Voice input for refinement | Text-first; voice adds complexity without proportional value |
| Automated prompt optimization | Need conversion data first; v1 is collect-and-analyze |
| Universal Commerce Protocol (UCP) support | North star capability; BigCommerce doesn't support it yet |
