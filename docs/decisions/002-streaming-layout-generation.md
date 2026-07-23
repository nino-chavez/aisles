# Decision Record: Streaming Layout Generation

**Date:** 2026-04-06
**Status:** Implemented
**Context:** Cold start performance optimization

## Question

Should layout generation stream tokens to the client for progressive rendering?

## Original Decision (deferred)

No. The combination of static fallback + Haiku model made streaming unnecessary:

1. Static fallback renders instantly (<100ms)
2. Haiku generates in 2-4 seconds
3. AI SDK v6 structured output returns a complete, Zod-validated object

## Revised Decision (2026-04-06)

Yes. Streaming is now implemented via `/api/layout/stream`. The motivation changed:

1. **Skeleton state was jarring on cold start** — the loading skeleton (pulsing placeholder) replaced the static fallback to avoid stale cross-category layouts, but a skeleton for 2-4 seconds felt broken during demos
2. **Progressive section rendering** — sections stream in as they're generated (editorial header appears ~1s before the product grid), giving the shopper visible progress
3. **AI SDK v6 supports it cleanly** — `streamText` with `Output.object()` provides a `partialOutputStream` that emits increasingly-complete objects as tokens arrive

## Implementation

**Server** (`/api/layout/stream`):
- Cache hits return `application/json` instantly (same as before)
- Cache misses return `text/event-stream` with SSE events: partial objects as sections generate, then a final `__done` event with the validated layout + meta
- Haiku-first with Sonnet fallback preserved
- Caching and generation logging happen after the stream completes

**Client** (`/category/[slug]/+page.svelte`):
- Detects response content type: JSON → instant render, SSE → stream reader
- Each partial object with `sections` triggers a reactive layout update
- `LayoutRenderer` re-renders as sections array grows — editorial header appears first, then hero product, then grid
- Final `__done` event sets the validated layout and meta

## What we kept

- Edge caching in Redis (1hr TTL) — most requests never stream
- Cache warming script for post-deploy
- Haiku-first model selection (2-4s typical)
- Generation logging with model, tokens, cost, session attribution
