# Prism: AI-Native Headless Storefront — Product Definition

## The Thesis

[CONFIRMED: internal://signal-forge/six-agentic-commerce/01-strategic-vision.html] Commerce storefronts today are static templates with AI bolted on. Search is keyword-based. Personalization is segment-level. Layouts are A/B tested from a finite set of variants. The "AI-powered" label means a chatbot in the corner and auto-generated product descriptions.

[INTERNAL] Prism is a storefront where AI is the rendering engine. The layout, content hierarchy, product selection, and interaction patterns are generated in real-time based on shopper intent — not selected from pre-built templates. This is not optimization of the funnel. This is replacement of the funnel.

## Market Context

[CONFIRMED: https://hydrogen.shopify.dev] Shopify Hydrogen is a React-based headless framework. AI features (Sidekick, Magic) are merchant-facing — product description generation, inventory insights. Not shopper-facing layout generation.

[CONFIRMED: https://www.bloomreach.com/en/products/discovery] Bloomreach, Constructor, and Algolia provide AI-powered search and recommendations. They optimize within fixed templates. None generate the template itself.

[CONFIRMED: https://www.dynamicyield.com] Dynamic Yield and Nosto offer segment-level personalization (cohorts, not individuals). The gap between "we have AI" marketing and actual per-user adaptive experiences is wide.

[ASSUMPTION] As of April 2026, nobody is generating adaptive commerce layouts based on user intent in production. The industry is stuck on A/B testing predefined variants. This is the gap Prism fills.

[INTERNAL] Conversational commerce (Klarna, Shop App) provides chat-based shopping assistants but doesn't modify the page structure. The conversational interface and the storefront are separate concerns. Prism unifies them — the conversation reshapes the store.

## Architecture: Four-Platform Composition

[CONFIRMED: internal://signal-forge/six-agentic-commerce/02-application-architecture.html] The architecture composes four platforms, each owning a distinct domain:

**BigCommerce** — Commerce engine and system of record. Owns catalog, inventory, pricing, cart, checkout, orders, tax, shipping, customer accounts. Consumed via Storefront GraphQL API (read) and REST Management API (write/admin).

**Supabase** — Intelligence data layer. Hosts enriched product data with pgvector embeddings for semantic search. Stores persona-fit scores, semantic tags, and structured attributes extracted from the raw BC catalog.

**Vercel** — Deployment and edge infrastructure. SvelteKit application deployed to Vercel Edge + Serverless. Upstash Redis for persona-aware edge caching.

**Agentic Orchestration Layer** — The SvelteKit application itself. Owns intent detection, layout generation, conversational refinement, trend enrichment, and observability. This is what we build.

[INTERNAL] Feedonomics (data enrichment) and Makeswift (editorial override) are acknowledged in the architecture but not implemented in the reference. Feedonomics is replaced by a build-time LLM enrichment pipeline. Makeswift is documented as an integration point for production merchants.

## Stack Decision: SvelteKit

[INTERNAL] Chose SvelteKit 2.x with Svelte 5 over Next.js/Catalyst for three reasons: (1) fine-grained reactivity is superior for streaming generative deltas — no virtual DOM diffing overhead; (2) positions as "new paradigm" rather than "fix the standard"; (3) Nino's native stack with deep expertise for faster iteration.

[ASSUMPTION] The Vercel AI SDK works with SvelteKit streaming. This needs verification — the SDK's primary documentation targets Next.js and React, with SvelteKit as a secondary supported framework.

[CONFIRMED: https://developer.bigcommerce.com/docs/storefront/graphql] BigCommerce Storefront GraphQL API is framework-agnostic. Products, cart, wishlists, and customer authentication work identically regardless of frontend framework.

## The Four Personas

[CONFIRMED: internal://signal-forge/six-agentic-commerce/01-strategic-vision.html] Four shopper intent archetypes produce fundamentally different page structures — not different sort orders on the same grid, but different pages entirely:

**The Hunter** (goal-oriented) — Dense 4-column grids, quick-buy cards, stock indicators, price-first sorting. Interface gets out of the way.

**The Gatherer** (exploratory) — Hero sections, magazine-style editorial, lifestyle imagery. Interface tells stories and creates desire.

**The Researcher** (analytical) — Spec cards, side-by-side comparison tables, review highlights, rating breakdowns. Interface provides evidence.

**The Gifter** (occasion-focused) — Collections by recipient, budget tiers, gift bundles. Interface removes the anxiety of choosing for someone else.

## The Conversational Refinement Loop

[CONFIRMED: internal://signal-forge/six-agentic-commerce/01-strategic-vision.html] The merchandiser agent maintains state across a shopping session. When a shopper says "too expensive," the agent doesn't restart — it refines. "Something lighter?" narrows further. Each interaction accumulates constraints. This conversational constraint accumulation is fundamentally different from stateless recommendation engines.

## Token Economics

[ASSUMPTION] Full generative layout costs approximately $0.02 per generation. At a 3% conversion rate, that's ~$0.66 in inference costs per acquisition. The cached-generative hybrid strategy mitigates this: pre-generate top persona variants at deploy time, cache with persona-aware TTL, target <5% of page loads requiring live LLM inference.

[INTERNAL] Three cost tiers: (1) pre-generated + edge cached (~$0/pageview, <50ms); (2) cached-generative with Upstash (~$0.001/pageview, <200ms); (3) full generative (~$0.02/pageview, 1-3s). The system should serve from the cheapest tier that satisfies the request.

## SEO Strategy: The Canonical Persona

[INTERNAL] Generative UI creates a conflict with search engine crawling. If the AI reshapes the page for every user, Googlebot sees different content than users — technically "cloaking." The solution: a Canonical Persona — a statically generated, SEO-optimized baseline storefront. Googlebot gets the SSR canonical. Authenticated/cookied users get the adaptive version. This is standard progressive enhancement, not cloaking.

[CONFIRMED: internal://apps/website-nc] The AEO (Answer Engine Optimization) architecture from Nino's portfolio site — machine-readable APIs, JSON-LD product schema — applies directly to the canonical baseline.

## Brand Safety: Validation Guardrails

[INTERNAL] Generative UI is stochastic. In production, the AI could generate layouts where the Buy button is below the fold, contrast ratios fail WCAG AA, or legal elements are missing. A Zod validation schema enforces commerce primitives before any generated layout hits the DOM: CTA present and above fold, price visible on every product surface, WCAG AA contrast minimums, legal/compliance elements present. If validation fails, the system falls back to the cached canonical version.

## Observability: The Self-Explaining Store

[INTERNAL] A reference implementation that doesn't explain its own decisions is magic. Magic is hard to sell; logic is easy to bill for. Dev mode overlay shows: detected intent + confidence, layout decision + rationale, product selection reasoning (semantic match score, trend signal, persona-fit), token cost, cache hit/miss, latency breakdown.

[CONFIRMED: internal://signal-forge/six-agentic-commerce/03-functional-architecture.html] The feedback loop closes when BC order data and analytics events feed back into the knowledge index. "The AI realized that for the Gift Shopper persona, the Magazine layout had a 12% lower bounce rate than the Grid, so it updated prompt weights." V1 collects data; automated optimization is deferred.

## Data Quality Is the Moat

[CONFIRMED: internal://signal-forge/six-agentic-commerce/01-strategic-vision.html] In a traditional storefront, bad product data means a missing image or vague description — the consumer compensates. In an agentic model, bad data means the product doesn't exist. Unstructured attributes mean the agent can't reason. Inconsistent taxonomy returns irrelevant results. Non-real-time inventory means the agent promises what it can't deliver. The product becomes invisible to the intelligence layer.

[INTERNAL] For the reference implementation, a build-time LLM enrichment pipeline replaces Feedonomics. It pulls the full BC catalog, runs products through an LLM for attribute extraction, persona-fit scoring, and semantic tag generation, then generates embeddings and stores in Supabase pgvector. Quality depends on the raw BC catalog data — sparse descriptions produce sparse enrichment.

## Roadmap: Six Phases

**Phase 0: Design Spine** — Establish the design system foundation, component architecture, and layout primitives.

**Phase 1: Walking Skeleton** — 2 personas, 2 categories, 30 products, 3-act journey. End-to-end proof of concept demonstrating the core adaptive storefront loop.

**Phase 2: Widen Personas** — Add Researcher and Gifter personas. Four distinct shopping experiences from a single catalog.

**Phase 3: Widen Catalog** — Full BC catalog integration, enrichment pipeline, cache layer. Scale from 30 products to full inventory.

**Phase 4: Enrich** — Trends, full refinement NLP, observability dashboard. The intelligence layer matures.

**Phase 5: Polish** — Accessibility audit, performance optimization, documentation. Phase 5 includes pipeline integration — design tokens consumed by the AI-painted storefront. Demonstrates the factory: brand definition to deployed AI-native store.

## Constraints

[CONFIRMED: https://developer.bigcommerce.com/docs/storefront/graphql] BigCommerce Storefront GraphQL: 1000 complexity points per request. Rate limits scale with plan tier.

[CONFIRMED: https://developer.bigcommerce.com/docs/integrations/webhooks] BC webhooks require HMAC-SHA256 verification. Real-time sync SLAs: stock <5s, price <30s, new product <5min.

[INTERNAL] Checkout is embedded (BC Checkout JS SDK), not custom. We don't build payment forms. We don't handle PCI compliance. Cart state lives in BigCommerce.

## Gaps and Known Unknowns

[ASSUMPTION] BC Embedded Checkout JS SDK compatibility with SvelteKit is untested. Designed for React/vanilla JS. Likely works via Svelte's onMount + action pattern, but needs verification.

[ASSUMPTION] Vercel AI SDK's SvelteKit streaming support is secondary to Next.js. Need to verify structured output generation and streaming work correctly.

LangGraph JS evaluated and rejected. Using Vercel AI SDK custom agents with Master-Worker pattern instead.

[INTERNAL] Deep attribute reasoning (spec-level comparison, not just layout-level) is deferred to post-v1. The agent can select and arrange products but can't yet compare "650 fill power vs 550 fill power" — that requires structured spec extraction from enriched data.

[INTERNAL] Agent-authorized checkout (delegating purchase authority to the AI) is an unsolved UX problem industry-wide. Too permissive = fraud risk. Too cautious = back to the old funnel. Deferred — needs design research, not engineering.

## Deferred Capabilities

- Agent-authorized checkout and cart construction
- Digital twin / product ownership graph (post-purchase lifecycle)
- Product compatibility graph
- Ambient context inference (push-based discovery)
- Cross-session user profiles
- Makeswift editorial integration
- Multi-storefront / multi-tenant engine
- A/B testing framework
- Voice input for refinement
- Automated prompt optimization from conversion data

## Success Criteria

The reference implementation succeeds when:
1. A visitor can browse a real BigCommerce catalog through a persona-adaptive UI
2. The same catalog renders four fundamentally different experiences based on intent
3. Conversational refinement meaningfully reshapes the page
4. Every AI decision is traceable in dev mode
5. The baseline storefront works with AI completely disabled
6. The architecture is documented well enough that another developer could replicate it on a different BC store
