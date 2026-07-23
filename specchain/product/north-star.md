# The Unconstrained Store: Prism North Star Vision

**What BigCommerce, Makeswift, and Feedonomics would need to become to fully realize agentic commerce.**

This document is the aspirational counterpart to the constrained roadmap. The roadmap says "what we build with today's APIs." This document says "what the platforms should build so tomorrow's version of Prism has no workarounds."

---

## The Unified Thesis

An AI-native commerce platform needs three capabilities working in concert:

1. **MCP-exposed commerce primitives** — agent-readable, agent-writable, real-time
2. **Intent-aware personalization as a native layer** — not a third-party bolt-on
3. **AI-composable UI components** — a semantic component registry that agents can query and assemble

Shopify leads on #1 — they ship a full MCP server (Catalog API, Checkout MCP) and co-developed the Universal Commerce Protocol (UCP) with Google, endorsed by 20+ retailers. Bloomreach leads on #2 — Loomi AI processes intent signals in 5ms-2s, though it's a third-party integration, not a platform-native feature. #3 remains the least developed — "Generative UI" and "Infinite Storefronts" are emerging 2026 trends, but no major platform offers AI-composable component registries designed for per-visitor layout synthesis as a native feature.

**No platform unifies all three today.** Shopify has the pipes but not the per-visitor layout engine. Bloomreach has the intelligence but not the component composition. BigCommerce has neither MCP nor native intent detection. The opportunity is in the integration — and that's what Prism demonstrates.

---

## Platform 1: BigCommerce — What It Should Become

### Today's Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No semantic search in Storefront API | Agent can't query by meaning ("waterproof hiking boots for cold weather") | **Critical** |
| No GraphQL subscriptions | No real-time streaming of inventory/price to frontend; must build WebSocket relay on webhooks | **High** |
| Product descriptions are HTML blobs | Agent can't reason about structured specs | **High** |
| Metafields not queryable as filters | Can't filter by persona-fit scores or semantic tags stored in metafields | **High** |
| No delegated agent authority | Agent can't act on behalf of customer with scoped permissions | **High** |
| No per-session state storage | Agent context (persona, constraints) must live externally | **Medium** |
| No customer browsing/behavior webhooks | Can't build behavioral persona detection from platform events | **Medium** |
| No native loyalty API | Third-party apps required for points, rewards | **Medium** |
| Stored payment instruments in beta | Gateway-dependent, incomplete headless support | **Medium** |
| Checkout requires PCI scope if fully custom | Embedded Checkout SDK or redirect — no headless payment form without PCI burden | **Low** (by design) |
| Segmentation API is enterprise-only, manual | No dynamic behavior-driven persona assignment | **Medium** |

### North Star: BigCommerce as an Agentic Commerce Engine

**1. MCP Server for Commerce**
BigCommerce should expose an MCP server that AI agents can connect to. Tools exposed:
- `search_products` — semantic search with intent, persona, context parameters
- `get_product_specs` — structured, machine-readable specifications (not HTML)
- `manage_cart` — create, modify, checkout cart on behalf of authenticated user
- `get_inventory_stream` — real-time SSE/WebSocket for stock and price changes
- `get_customer_context` — purchase history, browsing behavior, loyalty status

Shopify already ships an MCP server. Stripe exposes its full API via MCP. BigCommerce should follow.

**2. Structured Product Data as First-Class**
- Replace HTML description blobs with a structured content model: features (key-value), specs (typed), use cases (tagged), and rich text (for display)
- Metafields should be typed (JSON, number, boolean), indexable, and filterable in GraphQL queries
- Product relationships should support: alternatives, compatibility graph, frequently-bought-together, and semantic bundles

**3. GraphQL Subscriptions for Real-Time**
- `inventory_updated` subscription per product/variant
- `price_changed` subscription per product/channel
- `product_updated` subscription for catalog changes
- Eliminates the WebSocket relay hack currently required for real-time UI

**4. Agent Authorization Model**
- OAuth-style scoped delegation: customer grants agent permission to browse, compare, add-to-cart, or purchase within constraints
- Scopes: `read:catalog`, `manage:cart`, `execute:checkout` (with spending limit)
- Agent identity tracked separately from customer identity for audit trail
- Trust revocation: customer can revoke agent access at any time

**5. Intent Signals as Platform Data**
- Native behavioral tracking: page views, search queries, product interactions, time-on-page
- Expose as first-party data via API (not just analytics dashboard)
- Real-time persona inference at the platform level: "this session looks like a Researcher based on 4 comparison views in 2 minutes"
- Customer Segmentation API available on all plans, with dynamic rule-based assignment

**6. Checkout for Agents**
- Agent-initiated checkout with customer-confirmed payment (the Stripe/OpenAI pattern)
- Agent builds cart via API → customer reviews → one-click confirmation
- Support for agent-set spending limits, approval thresholds
- No PCI burden on the agent — payment confirmation always in BC's secure context

---

## Platform 2: Makeswift — What It Should Become

### Today's Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No write API — read-only snapshots | AI can't programmatically create or modify pages | **Critical** |
| No component registry query API | Agent can't discover available components or their props | **Critical** |
| React-only components | SvelteKit and other frameworks excluded | **High** |
| No dynamic composition API | Pages assembled only via drag-and-drop editor | **High** |
| Only 4 built-in primitives (Box, Text, Image, Button) | All commerce components are developer-built | **Medium** |
| Content snapshots are opaque | Can't extract as portable structured data | **Medium** |
| No A/B testing or persona routing | No multi-variant pages | **Medium** |
| No structured "AI generated, human approved" workflow | Editorial override is visual-only | **Medium** |

### North Star: Makeswift as an AI-Composable Experience Layer

**1. Semantic Component Registry**
- Every registered component has machine-readable metadata: purpose ("product-card"), accepted data shape, layout constraints, responsive behavior
- AI agent can query: "give me all components that display a product with price, image, and CTA"
- Components tagged with persona affinity: "this comparison-table component is optimized for Researcher intent"
- Framework-agnostic rendering: Web Components or a render protocol that works across React, Svelte, Vue

**2. Write API for Programmatic Page Creation**
- `createPage(layout: LayoutSchema)` — AI generates a layout, Makeswift stores and renders it
- `updateSection(pageId, sectionId, components)` — delta updates for refinement
- `clonePage(sourceId, modifications)` — create persona variants from a base
- Version history maintained: "AI generated v1, merchandiser edited v2, AI refined v3"

**3. AI-Human Collaboration Workflow**
- Generated layouts enter a "draft" state visible in the editor
- Merchandiser can approve, modify, or reject
- Modifications feed back to the AI as training signal ("the human moved the CTA above the fold — learn this preference")
- Configurable automation level: fully automatic (AI publishes directly), supervised (AI drafts, human approves), or manual (human creates, AI suggests)

**4. Persona-Aware Routing**
- Multiple page variants per URL, routed by persona/intent signal
- Built-in A/B testing between AI-generated and human-designed variants
- Analytics per variant: conversion, engagement, bounce rate by persona

**5. Content as Structured Data**
- Page snapshots decomposable to structured JSON (component tree with typed props)
- Renderable by any frontend framework, not just Makeswift's React runtime
- Portable: export a page's content as a component manifest that a SvelteKit app can consume

---

## Platform 3: Feedonomics — What It Should Become

### Today's Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No LLM-powered enrichment | Can't extract structured specs from unstructured descriptions | **Critical** |
| No embedding generation | Can't produce vectors for semantic search | **Critical** |
| No persona-fit scoring | Can't rank products by shopper intent relevance | **Critical** |
| No semantic tag generation | Can't create intent-based discovery tags | **High** |
| Batch-only sync (hours, not seconds) | Can't support real-time inventory in agentic UX | **High** |
| Outputs locked to channel formats (Google/Meta XML) | Can't output structured JSON to custom destinations | **High** |
| No developer API | Agent can't query enriched data directly | **High** |
| No webhook emission | Consumers don't know when enrichment completes | **Medium** |
| No image analysis | Can't extract visual attributes (color, style, material) from photos | **Medium** |
| Enrichment rules are UI-only | Can't define enrichment programmatically | **Medium** |

### North Star: Feedonomics as an AI Data Enrichment Engine

**1. LLM-Powered Enrichment Pipeline**
- Product enters Feedonomics → LLM extracts structured specifications from title + description + images
- Persona-fit scoring: model assigns relevance scores per persona archetype (configurable archetypes per merchant)
- Semantic tag generation: intent-based discovery tags generated per product
- Configurable quality gates: enrichment only publishes when confidence exceeds threshold

**2. Embedding Generation**
- Generate vector embeddings as part of the enrichment pipeline
- Output to pgvector, Pinecone, Weaviate, or any vector store
- Embedding model configurable per merchant (OpenAI, Cohere, local)
- Re-embedding triggered automatically when product data changes

**3. Real-Time Event-Driven Architecture**
- BC webhook → Feedonomics enrichment → output event in < 30 seconds (not hours)
- Webhook emission: `enrichment.completed`, `product.enriched`, `embedding.updated`
- Streaming output to arbitrary destinations (Supabase, custom API, S3)

**4. Agent-Queryable API**
- REST/GraphQL API for querying enriched product data
- Semantic search endpoint: "find products matching 'cozy winter gift under $100' for Gifter persona"
- Structured spec endpoint: return typed specifications for cross-product comparison
- Agent can query Feedonomics directly instead of maintaining a separate vector store

**5. Visual Intelligence**
- Computer vision: extract color, material, style, setting from product images
- Auto-generate lifestyle tags from photos ("outdoor," "urban," "formal")
- Image similarity: find visually similar products across catalog

**6. Programmatic Configuration**
- Enrichment rules defined via API, not just UI
- Merchant can configure persona archetypes, quality thresholds, and output destinations programmatically
- Supports CI/CD: enrichment config lives in version control alongside storefront code

---

## The Integrated North Star Architecture

When all three platforms reach their north star, the architecture simplifies:

```
Shopper arrives
    ↓
BigCommerce detects intent signals (native behavioral tracking)
    ↓
Feedonomics has already enriched the catalog with persona-fit scores, 
semantic tags, structured specs, and embeddings (real-time, event-driven)
    ↓
Agentic Layer queries Feedonomics directly for persona-relevant products
    ↓
Agentic Layer queries Makeswift's component registry for persona-appropriate 
components (via semantic component query API)
    ↓
Agentic Layer generates layout → writes to Makeswift via page creation API
    ↓
Makeswift renders the generated page (framework-agnostic)
    ↓
Shopper refines via conversation → delta updates via Makeswift write API
    ↓
Shopper confirms → Agent initiates checkout via BC agent authorization
    ↓
BigCommerce handles payment in its secure context
    ↓
Post-purchase: BC + Feedonomics maintain digital twin (product ownership graph)
    ↓
Analytics feed back to Feedonomics for persona model refinement
```

**What disappears in this architecture:**
- The separate Supabase vector store (Feedonomics generates and serves embeddings)
- The custom WebSocket relay for real-time inventory (BC GraphQL subscriptions)
- The build-time LLM enrichment pipeline (Feedonomics does it natively)
- The SvelteKit component library (Makeswift's framework-agnostic registry)
- The custom agent state management (BC per-session state storage)
- The canonical persona hack for SEO (Makeswift's persona-aware routing)

**What remains Prism's core differentiation:**
- Persona detection and intent classification logic
- The Conversational Refinement Loop (conversational refinement UX)
- Layout generation prompt engineering and validation
- Observability / self-explaining store
- The automated delivery pipeline for rapid merchant onboarding

---

## Gap-to-Advocacy Matrix

Each gap represents a conversation with a platform team. Priority based on impact to Prism:

| Priority | Platform | Capability | Ask |
|----------|----------|-----------|-----|
| **P0** | BigCommerce | MCP server for commerce | Expose catalog, cart, checkout as MCP tools |
| **P0** | BigCommerce | Universal Commerce Protocol (UCP) support | Implement Google/Shopify UCP so AI agents (Siri, Gemini, Copilot) can read the store natively |
| **P0** | BigCommerce | Structured delivery/fulfillment data | Expose delivery estimates, shipping methods, return policies as structured API data — delivery is now a ranking signal for AI agents |
| **P0** | Feedonomics | LLM enrichment + embeddings | Add AI-powered spec extraction and vector generation |
| **P0** | Makeswift | Component registry query API | Let agents discover components and their schemas |
| **P1** | BigCommerce | Structured product data model | Replace HTML descriptions with typed specs |
| **P1** | BigCommerce | Metafield filtering in GraphQL | Enable querying products by custom metadata |
| **P1** | Makeswift | Write API for page creation | Programmatic layout generation and updates |
| **P1** | Feedonomics | Real-time event-driven sync | Sub-30s enrichment, webhook emission |
| **P2** | BigCommerce | GraphQL subscriptions | Real-time inventory/price streaming |
| **P2** | BigCommerce | Agent authorization model | Scoped OAuth delegation for AI agents |
| **P2** | Makeswift | Framework-agnostic rendering | Support Svelte/Vue/Web Components, not just React |
| **P2** | Feedonomics | Agent-queryable API | Direct semantic search over enriched data |
| **P3** | BigCommerce | Intent signals as platform data | Native behavioral tracking + persona inference |
| **P3** | Makeswift | AI-human collaboration workflow | Draft/approve/reject flow for generated layouts |
| **P3** | Feedonomics | Visual intelligence | Computer vision for product image analysis |
| **P4** | BigCommerce | Post-purchase digital twin | Product ownership graph, warranty, maintenance |

---

## How This Document Should Be Used

1. **Internal strategy** — Guides what Prism builds vs. what it works around. Every workaround in the constrained roadmap maps to a north star capability here.
2. **Platform advocacy** — Each P0-P1 gap is a product feature request to the relevant platform team. The content generation pipeline papers provide the strategic framing; this document provides the specific asks.
3. **Roadmap alignment** — As platforms ship capabilities from this list, Prism's constrained roadmap updates: workarounds get replaced with native integrations.
4. **Competitive positioning** — Any platform that implements these capabilities first gets the "agentic commerce" label. This document is the blueprint for what that means.
