# Aisles — Observe Dashboard Guide

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers, Demo Presenters

## Overview

The Observe dashboard is a real-time telemetry view of what Aisles is doing underneath the storefront. It shows every signal the system receives, how those signals are interpreted into persona probabilities, and the layout decisions that result — model used, generation time, token usage, cost.

It is designed for side-by-side use during demos: storefront in one window, Observe in the other. The shopper sees a store that adapts to them; the observer sees exactly why and how.

---

## Accessing the Dashboard

The dashboard is gated by a URL parameter to prevent casual discovery:

```
https://aisles.bcsubs.app/observe?key=aisles-observe
```

Any brand's Observe dashboard uses the same path and key on that brand's deployed domain.

Without `?key=aisles-observe`, the page will not load the dashboard content.

---

## Dashboard Layout

The dashboard has a dark theme to visually distinguish it from the storefront. It is information-dense by design — numbers, event logs, and probability bars rather than editorial content.

### Top Bar: Session Picker

A dropdown listing all active session IDs currently stored in Redis. Sessions remain active for 30 minutes after the last signal event.

- **Session ID**: a short identifier derived from the session cookie. Not user-identifying.
- **Watch latest toggle**: when enabled, the dashboard auto-switches to the most recently active session. Useful for demos where you open the storefront in a separate private window.

To watch a session, select it from the dropdown. The dashboard polls `/api/observe/session` and `/api/observe/logs` every 2 seconds to refresh.

If no sessions appear in the dropdown, either no one has visited the storefront recently or Redis is not connected.

---

### Panel 1: Signal Timeline

A chronological list of every `SignalEvent` recorded for the selected session, newest at the top. Each event shows:

- **Timestamp**: elapsed time since the first event in the session
- **Type badge**: the event type (e.g., `nav.search`, `request.pageview`), color-coded by source:
  - Slate: `request` (server-side, from HTTP headers)
  - Blue: `navigation` (client-side page/route changes)
  - Amber: `interaction` (scroll, dwell, filter use)
  - Green: `commerce` (cart actions)
  - Purple: `refinement` (chat messages)
- **Key data**: the most relevant field from the event's `data` object (search query, category name, product ID, etc.)

New events animate in as they arrive. The timeline auto-scrolls to the newest event.

**What to look for**: the transition from `request.*` signals (fired on page load) to `nav.*` signals (fired as the shopper browses) shows the shift from static context inference to behavioral inference. A `nav.search` event with a query that conflicts with the current persona is the most dramatic signal to show during a demo.

---

### Panel 2: Persona Vector

A horizontal bar chart of the four persona probability scores, updated on every poll.

**Bars**: each of the four personas (gatherer, hunter, researcher, gifter) is displayed as a bar whose width represents its current probability. Bars animate smoothly on update.

**Primary persona**: the highest-probability persona is highlighted. This is the value driving the current layout.

**Confidence**: the gap between the primary and the second-place persona. A confidence of 0.30+ means the engine is fairly certain; below 0.15 means the personas are nearly tied and the layout choice is more arbitrary.

**Modifier gauges**: three secondary signals shown as 0–100% gauges:
- **Price sensitivity**: how budget-conscious the shopper appears to be
- **Urgency**: how close to a buying decision the shopper appears
- **Familiarity**: how well the shopper knows the store (first visit vs returning)

**Shift detection alert**: when the inference engine detects a persona shift (the primary persona changed from the stored session persona), an alert flashes showing the transition:

```
SHIFT DETECTED
gatherer → hunter
trigger: search query "dorm room desk" conflicts with stored gatherer model
```

This is the moment to highlight during a demo — it shows the engine actively reacting to shopper intent rather than guessing once and sticking with it.

---

### Panel 3: Layout Decision Log

The most recent layout or refinement generation for the selected session.

**Current generation**:
- **Type**: `layout` or `refine`
- **Model**: which model was used (`claude-haiku-4.5` or `claude-sonnet-4.6`)
- **Cache**: hit or miss
- **Generation time**: milliseconds from request to response
- **Token usage**: input tokens / output tokens
- **Estimated cost**: cost in USD for this single generation
- **Schema validation**: `first-try` (Haiku produced a valid output) or `fallback-sonnet` (Haiku failed, Sonnet recovered) or `fallback-static` (both models failed, static Svelte layout served)

**Cumulative stats** (all generations for this session):
- Total generations
- Cache hit rate (%)
- Average generation time
- Total tokens used
- Total estimated cost

**What the numbers mean**:
- Cache hit = sub-100ms, $0.00 cost — Redis returned a stored layout
- Haiku cache miss = typically 1.5–4s, $0.0002–0.0005 depending on prompt length
- Sonnet fallback = typically 8–15s, $0.001–0.003

For a typical demo session (5–10 category views, a search, and a refinement), expect total cost under $0.01.

### Panel 3a: Schema Validation Health Metric

A top-level health indicator tracking the percentage of LLM calls that produce schema-valid outputs on the first try. This is the operational measurement of the core correctness invariant (`∀I, ∀P, f(I, P) → S ∈ V`) — see `docs/decisions/004-vocabulary-constraint-invariant.md`.

**The metric**: first-try validation success rate, computed as `(generations validated on Haiku first try) / (total generations excluding cache hits)`, over a rolling 1-hour window.

**Thresholds**:
- **≥ 95%**: healthy. The prompt is working, the schema is tight, Haiku is behaving as expected.
- **90-95%**: warning. Investigate failing cases — is there a prompt regression, a schema change the model is struggling with, or a product catalog with unusual properties?
- **< 90%**: critical. The system is falling back to Sonnet too frequently, which is slower and more expensive. The invariant still holds (fallback guarantees a valid S) but the cost and latency profile is degraded.

**Why this matters**: the invariant `∀I, ∀P, f(I, P) → S ∈ V` is the foundational architectural principle of Aisles. It is enforced in code through the Zod schema, structured LLM output, and the Haiku → Sonnet → static fallback cascade. This metric is how you know the enforcement is working in production. A drop in first-try validation rate is the earliest signal that something is wrong with the prompt, the schema, or the model behavior — often before shoppers notice any impact.

**Implementation status**: the measurement requires the `generation_logs` table to distinguish between "first try valid" and "recovered by fallback." Currently the `model` field shows which model served the final output but not whether Haiku was attempted first and failed. Closing this gap is an action item from ADR-004.

---

### Panel 4: Product Enrichment View (expandable)

An expandable table showing all products in the current category with their enrichment data.

**Columns**:
- **Product name** and **price**
- **Persona-fit scores**: four scores (0.0–1.0) for gatherer, hunter, researcher, gifter
- **Semantic tags**: intent-based discovery tags as pills (e.g., "statement-piece", "dorm-friendly")

Products are sorted by the current persona's fit score, highest first. This is the same sort order the AI prompt receives, so high-fit products are more likely to appear in hero or featured positions.

**What to show during a demo**: switch the persona filter on this panel from `gatherer` to `hunter` and show how the sort order changes. A sofa with high gatherer fit (aspirational, photogenic) drops down the list while a desk with high hunter fit (clear specs, value) rises.

---

## What the Data Means

### Probability Scores

The persona probabilities are normalized — they always sum to 1.0. A score of 0.55 for `hunter` does not mean "55% chance this is a hunter" in an absolute sense; it means hunter is 55% of the total weight across all four personas after signal aggregation.

The base prior (no signals) is: `gatherer: 0.30, hunter: 0.20, researcher: 0.20, gifter: 0.10`. A gatherer score of 0.30 on a fresh session with no signals means the engine has no information and is using the prior.

### Signal Rules

The inference engine runs ~15 weighted rules. Rules fire based on:

- Search query keywords (deal/budget/dorm → hunter boost; gift/birthday → gifter boost)
- Referrer (Pinterest/Instagram → gatherer; Slickdeals → hunter; Wirecutter → researcher)
- UTM campaign keywords (gift/holiday → gifter; sale/promo → hunter)
- Device + time (mobile + late evening → mild hunter boost)
- Cross-session continuity (returning to same category → stored persona gets a boost)

Rules that don't fire contribute nothing — `signalCount` shows how many rules triggered. A `signalCount` of 0 means the engine is running on prior only.

### Cost Tracking

Cost is computed per generation at insert time using hardcoded pricing:
- Claude Haiku 4.5: $0.80/M input tokens, $4.00/M output tokens
- Claude Sonnet 4.6: $3.00/M input tokens, $15.00/M output tokens

The cumulative session cost in the Layout Decision panel sums all `estimated_cost` values for generations attributed to the selected session ID.

This is per-session cost, not per-user or per-day. It is useful for showing demo audiences that AI-native commerce is economically viable: a full demo session with multiple layout generations and a refinement typically costs under one cent.

---

## Polling Architecture

The dashboard polls two endpoints every 2 seconds:

- `GET /api/observe/session?id={sessionId}&key=aisles-observe`
- `GET /api/observe/logs?limit=20&session={sessionId}&key=aisles-observe`

This is intentionally simple — no WebSockets, no SSE, no pub/sub infrastructure. For demo sessions with low event volumes, 2-second polling latency is imperceptible to the audience. See `docs/decisions/observe-dashboard.md` (inline in `docs/specs/observe-dashboard.md`) for the full rationale.

---

## Troubleshooting

**No sessions in the dropdown**
- Verify the storefront is being visited in a separate window (the session cookie must be set by a page load, not an API call)
- Check that Redis is connected: if `KV_REST_API_URL` and `KV_REST_API_TOKEN` are not set, sessions are in-memory only and won't be visible across function instances
- Sessions expire after 30 minutes of inactivity — reload the storefront to create a fresh session

**Persona vector not updating**
- Client signals are only sent after page load actions (navigation, search, cart). Simply loading a page sends `request.*` signals server-side but no client signals until interaction.
- Check the browser console on the storefront page for errors in the signal emitter

**Layout decision panel shows no data**
- Generation logs are written synchronously. A failed write makes the layout request fail instead of silently losing telemetry.
- Verify the `HYPERDRIVE` binding and its Supabase origin in the Cloudflare Pages project.

**Cost shows $0.00 for all generations**
- This means all requests are hitting the Redis cache. Run `invalidateLayoutCache()` or wait for the 1-hour TTL to expire to force fresh generation
