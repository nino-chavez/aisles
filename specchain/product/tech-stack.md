# Tech Stack Decisions

## Framework: SvelteKit

**Decision:** SvelteKit 2.x with Svelte 5 (runes), not Next.js/Catalyst.

**Rationale:**
- Fine-grained reactivity is superior for streaming generative deltas (no virtual DOM diffing overhead)
- Svelte 5 runes provide cleaner state management for agent-to-UI synchronization
- Nino's native stack — deep expertise, faster iteration
- Positions as "boutique/high-performance alternative," not "fix the standard"
- BigCommerce APIs are framework-agnostic — Storefront GraphQL doesn't care what calls it

**Trade-off acknowledged:** Catalyst (Next.js) is BigCommerce's official starter. Going SvelteKit means we can't inherit Catalyst's component library or Makeswift integration. We build the BC integration layer from scratch. This is acceptable for a reference implementation that's proving a new category.

## Commerce Backend: BigCommerce (as-is)

**Constraint:** We consume BigCommerce's existing APIs without modification.

| API | Purpose | Notes |
|-----|---------|-------|
| Storefront GraphQL | Products, categories, cart, wishlists, customer auth | Primary read-side API; 1000 complexity points/request |
| REST Management v3 | Catalog CRUD, orders, webhooks, channels | Admin/enrichment operations |
| Checkout JS SDK | Embedded checkout | We embed, not rebuild |
| Webhooks | Real-time inventory, price, catalog sync | HMAC-SHA256 verification required |

**Environment:**
```
BIGCOMMERCE_STORE_HASH=
BIGCOMMERCE_ACCESS_TOKEN=
BIGCOMMERCE_CHANNEL_ID=
BIGCOMMERCE_STOREFRONT_TOKEN=
```

**Rate limits:** 150 req/30s (REST), 1000 complexity/req (GraphQL). Edge caching is mandatory.

## AI Layer

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| LLM inference | Vercel AI SDK (provider-agnostic) | Swap providers via import, not refactor |
| Default provider | Anthropic Claude (layout generation), Flash-class model (real-time composition) | Claude for deploy-time variant generation; lightweight model for sub-200ms runtime composition |
| Agent orchestration | Vercel AI SDK custom agents (Master-Worker pattern) | Supervisor agent decomposes intent; parallel workers handle inventory, styling, trends. AI SDK ToolLoopAgent + custom state. LangGraph rejected — overkill for single-session refinement. |
| Semantic search | Supabase pgvector + OpenAI embeddings | Proven in prior concept prototypes (v3-v5); meaning-based product discovery |
| Trend enrichment | Tavily Search API | Real-time web intelligence; swappable |
| Observability | Langfuse (LLM tracing) | Traces prompts, tokens, latency, decisions |

**Provider abstraction:** Commerce Agent Interface defines contracts for LLM, search, embedding, and commerce providers. Swapping any provider is a config change, not a rewrite.

## Data & Caching

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Product embeddings | Supabase PostgreSQL + pgvector | Vector similarity search with SQL fallback |
| Edge cache | Upstash Redis | Persona-aware TTL (30min–4hr); sub-200ms cached responses |
| Session state | SvelteKit server-side + Upstash | Agent state persists across refinement interactions |
| Agent session state | Upstash Redis (server-side) | Conversation history, accumulated constraints, persona confidence. 30-min TTL per session, 30-day cross-session summaries in Supabase. |

## Deployment

| Concern | Technology |
|---------|-----------|
| Hosting | Vercel (Edge + Serverless) |
| Streaming | SvelteKit streaming SSR + NDJSON API responses |
| CI/CD | GitHub → Vercel (push to deploy) |
| Domain | TBD (under Signal X Studio) |

## Styling

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| CSS framework | Tailwind CSS v4 | Nino's standard; design token integration with the design token pipeline |
| Fonts | Space Grotesk (display), Inter (body), JetBrains Mono (mono) | Consistent with Signal X Studio identity |
| Icons | Phosphor Icons | Consistent weight and style |

## Testing

| Concern | Technology |
|---------|-----------|
| Unit/integration | Vitest (SvelteKit native) |
| E2E | Playwright |
| Component | Svelte Testing Library |

## Package Manager

**npm** (Nino's standard for non-Catalyst projects)

## What We Don't Use

- **Makeswift** — Acknowledged in architecture as editorial override layer; not implemented in reference. Documented as integration point.
- **Feedonomics** — Replaced by a build-time enrichment pipeline (LLM-powered attribute extraction from raw BC catalog) for the reference implementation.
- **CopilotKit** — Prior concept prototype dependency. Rejected — Vercel AI SDK provides `useChat` equivalent via `@ai-sdk/svelte` Chat class, and custom SvelteKit patterns handle agent-to-UI sync natively. No additional framework needed.
- **Next.js** — Replaced by SvelteKit.
- **Stencil** — Legacy BC theme engine; not relevant.
