# Decision Record: Pre-render at Build Time vs Cache Warming

**Date:** 2026-04-06
**Status:** Cache warming chosen over prerendering
**Context:** Cold start performance optimization

## Question

Should we prerender category pages at build time via SvelteKit's prerendering, or warm the Redis cache post-deploy?

## Decision

Cache warming. Prerendering bakes a single layout into static HTML, but Aisles layouts are persona-dependent — the same URL renders differently for each persona. Prerendering would only serve one persona's layout statically, defeating the thesis.

Cache warming fills the Redis cache with layouts for each persona+category combination. The runtime serves the correct cached layout based on the detected persona.

## Implementation

`scripts/warm-cache.ts` hits `/api/layout` for priority persona+category combinations after each deploy. The cache TTL is 1 hour, after which layouts regenerate on demand.

## When to revisit

If we add ISR (Incremental Static Regeneration) support for SvelteKit on Vercel, we could prerender the default (gatherer) layout as the static fallback and serve persona-specific layouts from the cache. This would eliminate the static Svelte fallback components entirely.
