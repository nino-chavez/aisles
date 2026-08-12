# Aisles — Architecture Overview

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers, Technical Stakeholders

## Overview

Aisles is an AI-native headless storefront platform that personalizes the shopping experience in real time. A persona inference engine reads client signals, computes a probability distribution across four shopper archetypes, and feeds that distribution directly into AI layout generation. The result is a category page that reorganizes itself for each visitor — editorially for a browser, functionally for a buyer.

Three brands run on a single codebase, differentiated entirely by configuration.

---

## The Core Invariant

The foundational architectural principle of Aisles is a formal correctness invariant on every AI-generated layout:

> **For all possible user inputs I and all possible personalization vectors P, the layout generation function f must produce an interface state S that is an element of the set V of valid configurations.**
>
> **∀I, ∀P, f(I, P) → S ∈ V**

The set V is defined literally by the Zod schema in `src/lib/schema/layout.ts`. Every valid layout is an object that passes Zod validation against this schema. Every invalid layout is rejected and the pipeline falls back to a more capable model (Haiku → Sonnet) or to a static Svelte layout.

This is the invariant that makes AI-generated UI work in production rather than only in demos. It is enforced in three layers:

1. **Schema as definition of V**: the Zod schema explicitly enumerates the valid component types (`editorial-header`, `hero-product`, `product-grid`, `category-header`), their allowed prop values, and their composition rules
2. **Structured LLM output**: the Vercel AI SDK passes the schema to the LLM as a token-generation constraint via `generateObject` / `streamObject`, producing schema-compliant outputs by construction
3. **Fallback cascade**: Haiku → Sonnet → static Svelte layouts guarantee a valid S always exists, even under model failure

Every other subsystem in Aisles — the inference loop, the cache, the Observe dashboard, the signal pipeline — depends on this invariant holding. See `docs/decisions/004-vocabulary-constraint-invariant.md` for the full rationale, the operational consequences (schema validation success rate as a health metric, vocabulary evolution process, cache invalidation), and the trade-off between vocabulary size and invariant strength.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 / Svelte 5 (runes) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Deployment | Cloudflare Pages (adapter-cloudflare) |
| AI Models | Claude Haiku 4.5 (primary), Claude Sonnet 4.6 (fallback) |
| AI Gateway | Cloudflare AI Gateway (optional routing and observability) |
| AI SDK | Vercel AI SDK v6 (generateText, streamText, Output.object) |
| Layout Cache | Upstash Redis (1-hour TTL) |
| Signal Sessions | Upstash Redis (30-minute TTL) |
| Enrichment Data | Supabase Postgres via Cloudflare Hyperdrive |
| Product Catalog | BigCommerce GraphQL Storefront API |
| Embeddings | OpenRouter (openai/text-embedding-3-small) |

---

## The Signal → Inference → Layout Pipeline

This is the core of Aisles. Every category page load runs through three stages.

### Stage 1: Signal Collection

Signals originate from two places:

**Request-time signals** (server-side, available on every page load):
- URL parameters (`?intent=hunter`)
- Search query text
- HTTP referrer (social, deal site, review site)
- UTM campaign and source tags
- Device type (mobile / tablet / desktop)
- Time of day and day of week
- Cross-session cookie (`aisles_session`): stored persona, stored category, visit count

**Behavioral signals** (client-side, emitted after page load):
- `nav.category_view` — shopper entered a category
- `nav.product_view` — shopper viewed a product detail
- `nav.search` — shopper ran a search
- `commerce.add_to_cart` — shopper added an item
- `refine.message` — shopper sent a refinement message

Client signals are batched and sent to `POST /api/signals`, which appends them to the session store in Redis and re-runs inference.

### Stage 2: Inference Engine

`src/lib/signals/inference.ts` consumes an `InferenceContext` and returns a `PersonaInference`.

The four personas:
- **gatherer** — exploratory, inspiration-driven, browsing aesthetics and editorial content
- **hunter** — goal-oriented, efficiency-driven, comparing prices and specs
- **researcher** — methodical, evidence-driven, reading every spec and comparison
- **gifter** — shopping for someone else, needs universal appeal and safe price points

The engine works by:
1. Starting from a prior (`gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1`)
2. Running weighted rules against the context (search keywords, referrer patterns, UTM tags, device+time combos, cross-session continuity)
3. Summing score adjustments per rule, weighted by rule confidence
4. Normalizing to a probability distribution
5. Computing the primary persona (highest probability), confidence (gap to second place), and shift detection (did the primary change from the stored persona?)

The output `PersonaInference` includes:
- `probabilities` — all four scores as fractions summing to 1.0
- `primary` — the winning persona label
- `confidence` — how far ahead the primary is from the runner-up
- `modifiers` — `priceSensitivity`, `urgency`, `familiarityWithStore` (each 0–1)
- `shift` — `detected`, `from`, `trigger` (what caused the change)
- `signalCount` — how many rules fired

### Stage 3: AI Layout Generation

The primary persona drives layout generation. `POST /api/layout` (or `/api/layout/stream` for SSE):

1. Checks Redis for a cached layout matching `persona + categorySlug`
2. On cache miss: fetches products from BigCommerce via `loadCategoryProducts`, which merges brand-scoped enrichment data from Supabase Postgres and sorts by persona-fit score
3. Builds a prompt via `buildLayoutPrompt` — includes the persona definition, brand voice, and product catalog with persona-fit scores and semantic tags
4. Calls Claude Haiku 4.5 directly or through Cloudflare AI Gateway with structured output (`Output.object({ schema: LayoutSchema })`)
5. Falls back to Claude Sonnet 4.6 if Haiku fails validation
6. Stores the result in Redis (1-hour TTL)
7. Logs to Supabase Postgres (`generation_logs` table) with model, tokens, cost, persona, category, and session ID

The AI output is a `Layout` object — a validated JSON structure defining an ordered list of sections drawn from a fixed component vocabulary. The AI selects components, orders products, and writes editorial copy. It cannot invent new components.

#### Layout Component Vocabulary

| Component | Purpose | Key Props |
|---|---|---|
| `editorial-header` | Opening editorial copy | eyebrow, headline, body text |
| `hero-product` | Single standout product | product ref, showSpecs |
| `product-grid` | Main product display | columns (2/3/4), imageRatio, showQuickAdd |
| `category-header` | Functional header | title, subtitle, showSort, showFilter |

#### Persona Layout Patterns (typical AI output)

| Persona | Layout Style |
|---|---|
| gatherer | `editorial-header` → `hero-product` → 2-column `product-grid` (landscape images, descriptions shown) |
| hunter | `category-header` with sort/filter → 4-column `product-grid` (square images, quickAdd enabled) |
| researcher | `category-header` → `product-grid` with specs shown, no hero |
| gifter | `editorial-header` → `hero-product` → 3-column grid at mid price tier |

---

## Data Flow Diagram

```
Browser (shopper)
  │
  │  GET /category/[slug]
  ▼
SvelteKit server load
  ├─ reads aisles_session cookie
  ├─ builds InferenceContext (URL params, referrer, device, time, cross-session)
  ├─ runs infer() → PersonaInference
  ├─ POST /api/layout or /api/layout/stream
  │    ├─ Redis cache check
  │    │    hit  → return cached Layout (<100ms)
  │    │    miss → loadCategoryProducts
  │    │              ├─ BigCommerce GraphQL (products)
  │    │              └─ Supabase Postgres via Hyperdrive (brand-scoped enrichment)
  │    │           → buildLayoutPrompt(persona, products)
  │    │           → Claude Haiku 4.5 via AI Gateway
  │    │           → (fallback: Claude Sonnet 4.6)
  │    │           → cache to Redis
  │    │           → log to Supabase generation_logs
  │    └─ return Layout JSON
  └─ render LayoutRenderer (Svelte components)

Browser (client-side, after load)
  ├─ emits behavioral signals (nav, search, cart)
  ├─ POST /api/signals
  │    ├─ appends to SignalStore
  │    ├─ re-runs infer()
  │    └─ persists to Redis
  └─ receives PersonaInference (may trigger layout refresh)
```

---

## Enrichment Pipeline

Before layout generation can work well, products need persona-fit scores. The enrichment pipeline (`src/lib/server/enrichment/enrich.ts`) runs as an offline script:

1. Fetches all products from BigCommerce (up to 50 per channel)
2. For each product, calls Claude Sonnet to extract:
   - Material, style, use case, dimensions, price tier
   - Persona-fit scores (0.0–1.0 for each of the four personas)
   - Semantic tags for intent-based discovery
3. Generates embeddings via OpenRouter (text-embedding-3-small)
4. Upserts results into the `enriched_products` table in Supabase Postgres by `(brand_id, bc_entity_id)`

The `loadCategoryProducts` function merges these scores at request time, sorting products by the detected persona's fit score before the AI sees them. High-fit products appear first in the prompt and tend to get hero or featured placement.

---

## Caching Strategy

Two layers of caching reduce cost and latency:

**Layout cache (Redis, `aisles:layout:{persona}:{categorySlug}`)**
- 1-hour TTL
- Cache hit: sub-100ms response, no AI call
- Cache miss: 2–15s generation, then cached for subsequent visitors
- Invalidated manually or after enrichment runs
- Design stance: serve stale-but-fast over fresh-but-slow. A recoverable wrong answer (cached layout for a slightly drifted persona) beats a delayed right answer. See "Speed Over Accuracy" in `docs/product-vision.md`.

**Session store (Redis, `aisles:session:{sessionId}`)**
- 30-minute TTL, sliding
- In-memory hot cache per function instance for zero-latency reads
- Falls back to in-memory only if Redis is not configured

**Why not prerender?** Category pages are persona-dependent — the same URL renders four different layouts. Prerendering would bake one persona into static HTML. See `docs/decisions/003-prerender-vs-cache-warming.md`.

---

## Multi-Brand Architecture

See `docs/multi-brand.md` for the full setup guide.

In brief: `BRAND_ID` (or `VITE_BRAND_ID` in the browser context) selects the active brand from `src/lib/brand/config.ts`. The brand config drives:
- BigCommerce channel ID and category prefix
- CSS theme tokens (injected into `:root` at runtime)
- Google Fonts URL
- LLM prompt context (store name, description, product domain, persona definitions, voice guidance)
- Category slug → BigCommerce category name mapping

The codebase carries multiple brand configurations. Each deployed brand uses a separate Cloudflare Pages project from the same Git repository, with a different `BRAND_ID` environment variable.

---

## Signal Pipeline Expansion

The current signal pipeline is request-time only: inference runs once per page load from URL parameters, referrer, UTM tags, device, and cross-session cookies. Client-side signals update inference after the fact but do not yet feed behavioral rules.

### The Gap

10 of 14 signal types are defined in `src/lib/signals/types.ts` but not consumed by any inference rule. The `toInferenceContext()` method in `SignalStore` has `case` branches only for `request.pageview`, `request.device`, `request.search_landing`, and `nav.search`. All interaction, navigation depth, and commerce signals accumulate in the session buffer without influencing inference output.

```
Current pipeline:
  HTTP request → SignalStore (request.* signals)
                → toInferenceContext() → infer() → PersonaInference
                → buildLayoutPrompt(primary) → AI → Layout

  After page load:
  Browser → emitter → POST /api/signals
           → SignalStore (nav.*, interact.*, commerce.* signals — stored but not consumed)
           → toInferenceContext() → infer() (still reads only request.* and nav.search)
           → returns updated PersonaInference
```

### Planned Data Flow (Post-Expansion)

The behavioral signal expansion (see `docs/specs/behavioral-signals.md`) will add feedback loops at three levels:

```
Expanded pipeline:

  HTTP request → SignalStore (request.* signals)
               → toInferenceContext() → infer() → PersonaInference
               → buildLayoutPrompt(probabilities, confidence) → AI → Layout
                                      ↑ full vector, not just label

  Session behavioral loop:
  Browser ─┬─ dwell_time events (IntersectionObserver)
           ├─ scroll_depth events (threshold listener)
           ├─ sort_change / filter_use events (component hooks)
           ├─ nav.back (quick PDP return detector)
           ├─ commerce.add_to_cart (immediate flush)
           └─ nav.category_view sequence
           ↓
  POST /api/signals
           ↓
  SignalStore.toInferenceContext()
  (now reads: categorySequence, cartAddCount, longDwellProductCount,
   maxScrollDepth, priceSortUsed, filterCount, quickReturnCount, ...)
           ↓
  infer() — 15+ rules including behavioral rules
           ↓
  PersonaInference with updated probabilities
           ↓
  If primary changed and confidence >= 0.1: trigger layout refresh
```

### Session Arc Layer (Phase 5)

Phase 5 adds a persona history to each Redis session key. After each `infer()` call, a lightweight snapshot (`PersonaSnapshot`) is appended to `personaHistory`. The inference output will include an arc classification (`stable`, `converging`, `oscillating`, `late-shift`) that can inform layout blending decisions independent of the current-state probabilities.

### Streaming Platform Context

The expansion is modeled on behavioral personalization lessons from Netflix, Spotify, and Hulu:

- **Behavior over declared intent** (Netflix watch completion %): dwell time and scroll depth replace the current over-reliance on search queries and UTM tags
- **Negative signals are most informative** (Spotify skip model): bounce detection, cart removal, and chat abandonment are the Aisles equivalent of a 10-second skip
- **Session context matters** (Hulu grazing vs. committing): session arc modeling tracks trajectory, not just instantaneous state
- **Full probability vectors, not categories** (continuous embeddings): Phase 4 passes `PersonaProbabilities` to layout generation to enable blended layouts for ambiguous sessions

See `docs/product-vision.md` for the extended analysis and `docs/specs/behavioral-signals.md` for the implementation spec.

---

## Related Documentation

- `docs/multi-brand.md` — adding and configuring brands
- `docs/api-reference.md` — all API endpoints
- `docs/observe.md` — Observe dashboard for demos
- `docs/development.md` — local setup and tooling
- `docs/signals-and-inference.md` — complete signal and rule catalog
- `docs/specs/behavioral-signals.md` — signal expansion implementation spec
- `docs/product-vision.md` — product mission and streaming platform inspiration
- `docs/specs/intent-driven-commerce.md` — intent-driven commerce features (incentives, alternatives, cross-sells)
- `docs/specs/layout-transitions.md` — layout transition animations (section fade-in, skeleton morph, persona shift swap)
- `docs/decisions/001-enrichment-vs-feedonomics.md`
- `docs/decisions/002-streaming-layout-generation.md`
- `docs/decisions/003-prerender-vs-cache-warming.md`
- `docs/decisions/004-vocabulary-constraint-invariant.md` — the core correctness invariant and its enforcement
