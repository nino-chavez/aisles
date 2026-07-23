# Aisles — Development Guide

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers

## Prerequisites

- Node.js 20+ (the project uses native `fetch`, ES modules, and `tsx` for scripts)
- npm (not pnpm or yarn)
- Access to the project's environment variables (ask the team for a `.env.local` file)

---

## Local Setup

```bash
# Clone and install
git clone <repo-url>
cd prism
npm install
```

Create a `.env.local` file in the project root with the following variables:

```bash
# Brand selection (defaults to "haven" if not set)
BRAND_ID=haven
VITE_BRAND_ID=haven

# BigCommerce
BIGCOMMERCE_STORE_HASH=your_store_hash
STOREFRONT_TOKEN=your_storefront_token
BIGCOMMERCE_CHANNEL_ID=1

# Upstash Redis (layout cache + session store)
KV_REST_API_URL=https://your-instance.upstash.io
KV_REST_API_TOKEN=your_upstash_token

# Neon Postgres (enrichment data + generation logs)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# AI (for layout generation — set these OR use Vercel AI Gateway)
ANTHROPIC_API_KEY=sk-ant-...

# For enrichment pipeline only
OPENROUTER_API_KEY=sk-or-...
```

**Local development without Redis**: The application runs without Redis — sessions are stored in-memory, and layouts are regenerated on every request (no caching). This is fine for development but means cold-start times are always 2–15 seconds.

**Local development without Neon**: The application runs without Postgres — enrichment data is unavailable, and generation logs are silently skipped. Products will appear in default BigCommerce order without persona-fit sorting.

---

## Running the Dev Server

```bash
npm run dev
```

The app starts at `http://localhost:5173`. The active brand is set by `VITE_BRAND_ID` in your `.env.local`.

To test a different brand locally:

```bash
VITE_BRAND_ID=volt BRAND_ID=volt npm run dev
```

Note that switching brands locally requires matching `STOREFRONT_TOKEN` and `BIGCOMMERCE_CHANNEL_ID` for the target brand's BC channel. Using a different brand with the same BC credentials will return no products if the category names don't match.

---

## Dev Mode

Dev mode enables additional UI overlays for development and debugging:

- **Layout reasoning panel**: shows the AI's `reasoning` field explaining why the current layout was chosen
- **Persona badge**: shows the detected persona and confidence score in the page header
- **Signal debug**: shows the current inference context in the console

**Activating dev mode**:

Append `?dev=true` to any URL. Dev mode persists as a cookie for the session — you don't need to add `?dev=true` to every page.

```
http://localhost:5173/category/living-room?dev=true
```

**Deactivating dev mode**: append `?dev=false` to any URL, or clear the `aisles_dev` cookie.

Dev mode works in both local development and on deployed Vercel previews. It does not work on production deployments (the cookie check is gated by environment).

---

## Running the Enrichment Pipeline

The enrichment pipeline reads products from BigCommerce, runs LLM scoring, and writes to Neon Postgres. Run it before using the app with a new channel or after adding new products.

```bash
# Enrich Haven (channel 1 / default)
BIGCOMMERCE_STORE_HASH=your_hash \
STOREFRONT_TOKEN=your_token \
BIGCOMMERCE_CHANNEL_ID=1 \
DATABASE_URL=your_neon_url \
ANTHROPIC_API_KEY=sk-ant-... \
OPENROUTER_API_KEY=sk-or-... \
npx tsx src/lib/server/enrichment/enrich.ts
```

The script will:
1. Create the `enriched_products` and `generation_logs` tables if they don't exist
2. Fetch up to 50 products from the BC channel
3. Call Claude Sonnet to extract attributes and score persona-fit for each product
4. Generate embeddings via OpenRouter (text-embedding-3-small)
5. Upsert results into Postgres

**Expected output**:

```
Creating table...
Fetching products from BigCommerce...
Found 24 products
  Enriching: Haven Linen Sofa... OK (G:0.91 H:0.42 R:0.55 Gi:0.68)
  Enriching: Walnut Coffee Table... OK (G:0.85 H:0.51 R:0.62 Gi:0.72)
  ...
Enrichment: 24 enriched, 0 failed out of 24 total
Cost: $0.0412 (28,340 in / 9,120 out tokens across 24 calls)

Generating embeddings...
Embeddings: 24 generated (1536 dimensions)

Done.
```

**Cost**: enrichment runs Claude Sonnet per product. For 24 products, expect $0.03–0.05. Run it once per channel, then only re-run when products change significantly.

**Re-running**: the script uses `ON CONFLICT (bc_entity_id) DO UPDATE` — re-running overwrites existing enrichment data. Safe to run again after product updates.

---

## Cache Warming

After deploying to Vercel, the Redis layout cache is empty. The first visitor per persona+category combination triggers a fresh generation (2–15 seconds). Cache warming pre-fills the cache so all first visitors get instant responses.

```bash
# Warm Haven (gatherer + hunter for all Haven categories)
npx tsx scripts/warm-cache.ts haven

# Warm Volt
npx tsx scripts/warm-cache.ts volt

# Warm Ember
npx tsx scripts/warm-cache.ts ember

# Warm all brands
npx tsx scripts/warm-cache.ts all
```

The script hits the deployed URLs (not localhost) and warms gatherer + hunter for each category. Researcher and gifter are not pre-warmed — they are less common cold starts and generate on demand.

**Expected output**:

```
=== HAVEN (https://aisles-signal-x-studio-labs.vercel.app) ===
12 combinations

  gatherer:living-room... GENERATED (2840ms)
  gatherer:office... GENERATED (3120ms)
  gatherer:bedroom... CACHED (62ms)
  hunter:living-room... GENERATED (1950ms)
  ...

  10 generated, 2 cached, 0 failed
```

Run after every production deploy where product catalog or enrichment data has changed. Cache TTL is 1 hour — the cache self-refreshes on demand after expiry.

---

## Product Seeding

The `tools/seed-channels/` directory contains scripts for seeding product data into BigCommerce channels. This is used when setting up a new brand channel with demo products.

```bash
npx tsx tools/seed-channels/index.ts
```

Check `tools/seed-channels/index.ts` for required environment variables and options. The seeder creates products in BigCommerce using the Admin API (requires an Admin API token, not just a Storefront token).

The brand JSON files in `brands/` (e.g., `brands/haven.json`) contain the creative brief used to generate demo product content. The seeder references these files for product descriptions, voice guidance, and category structure.

---

## TypeScript and Type Checking

```bash
# Full type check
npm run check

# Watch mode
npm run check:watch
```

The project uses strict TypeScript. Run a type check before pushing if you've modified service layer files (`src/lib/server/`, `src/lib/signals/`, `src/lib/brand/`). SvelteKit generates types for route params and load functions via `svelte-kit sync`, which runs automatically before the check.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/lib/brand/config.ts` | All brand configuration — the only file to edit when adding a brand |
| `src/lib/schema/layout.ts` | Layout schema (Zod) — the contract between AI and renderer |
| `src/lib/signals/types.ts` | Signal and inference type definitions |
| `src/lib/signals/inference.ts` | Inference engine — rule-based persona probability computation |
| `src/lib/signals/session.ts` | Session store — Redis + in-memory hybrid |
| `src/lib/server/cache.ts` | Layout cache — Redis with 1-hour TTL |
| `src/lib/server/catalog.ts` | Product loading — BC catalog + enrichment merge |
| `src/lib/server/generation-log.ts` | Generation logging to Neon Postgres |
| `src/lib/server/layout-prompt.ts` | Layout prompt builder |
| `src/lib/server/enrichment/enrich.ts` | Offline enrichment pipeline |
| `src/routes/api/layout/+server.ts` | POST /api/layout |
| `src/routes/api/layout/stream/+server.ts` | POST /api/layout/stream |
| `src/routes/api/refine/+server.ts` | POST /api/refine |
| `src/routes/api/signals/+server.ts` | POST /api/signals |
| `src/routes/api/cart/+server.ts` | GET/POST /api/cart |
| `src/routes/api/observe/` | Observe dashboard API endpoints |
| `src/routes/observe/+page.svelte` | Observe dashboard UI |
| `src/routes/category/[slug]/` | Category page with AI layout |
| `scripts/warm-cache.ts` | Cache warming script |
| `tools/seed-channels/` | Product seeding scripts |
| `brands/` | Brand identity JSON files |

---

## Environment Variables Reference

| Variable | Required | Context | Description |
|---|---|---|---|
| `BRAND_ID` | No | Server, scripts | Active brand ID. Defaults to `haven`. |
| `VITE_BRAND_ID` | No | Client (Vite) | Same as BRAND_ID — must be prefixed for Vite to expose it to the browser. |
| `BIGCOMMERCE_STORE_HASH` | Yes | Server, scripts | BC store hash (from store URL) |
| `STOREFRONT_TOKEN` | Yes | Server, scripts | BC Storefront API token (channel-specific) |
| `BIGCOMMERCE_STOREFRONT_TOKEN` | No | Scripts | Alias for `STOREFRONT_TOKEN` in enrichment scripts |
| `BIGCOMMERCE_CHANNEL_ID` | No | Scripts | BC channel ID for enrichment. Defaults to `1`. |
| `KV_REST_API_URL` | No | Server | Upstash Redis REST URL. Falls back to in-memory if unset. |
| `KV_REST_API_TOKEN` | No | Server | Upstash Redis REST token |
| `DATABASE_URL` | No | Server, scripts | Neon Postgres connection string |
| `POSTGRES_URL` | No | Server, scripts | Alias for `DATABASE_URL` |
| `ANTHROPIC_API_KEY` | Yes (enrichment) | Scripts | Anthropic API key for enrichment pipeline |
| `OPENROUTER_API_KEY` | Yes (enrichment) | Scripts | OpenRouter key for embedding generation |
| `AI_GATEWAY_URL` | Vercel only | Server | Set automatically by Vercel AI Gateway integration |
| `AI_GATEWAY_TOKEN` | Vercel only | Server | Set automatically by Vercel AI Gateway integration |

For local development, `ANTHROPIC_API_KEY` is also used for layout generation if the Vercel AI Gateway is not configured. The `gateway()` function from `@ai-sdk/gateway` falls back to direct Anthropic API access when the gateway is unavailable.

---

## Inference Debugging

The inference engine is the core of Aisles' personalization logic. When the wrong layout is generated, the issue is almost always in the inference pipeline. This section describes how to trace and debug inference behavior.

### Using Dev Mode Signal Breakdown

Dev mode adds an overlay to category pages that shows the current inference state. Activate it by appending `?dev=true` to any category URL:

```
http://localhost:5173/category/living-room?dev=true
```

The persona badge in the header shows the primary persona and confidence score. Open the browser console — the signal emitter logs each event as it fires, and the `/api/signals` response includes the full `PersonaInference` object.

To see the full inference breakdown including which rules fired, open the browser console after a page load and check for the `aisles-inference-update` CustomEvent dispatched by the signal emitter. This event contains the complete `PersonaInference` including `ruleMatches`.

### Tracing Rule Attribution via /observe

The Observe dashboard at `/observe?key=aisles-observe` shows signal and inference data in real time for any active session. To trace inference for a specific session:

1. Open the storefront in one browser window
2. Open `/observe?key=aisles-observe` in a second window
3. Enable "Watch latest" in the session picker
4. Interact with the storefront — search, navigate categories, use sort/filter

The Signal Timeline panel shows every `SignalEvent` as it arrives. The Persona Vector panel updates on each inference run. The `ruleMatches` array is exposed in the session API response at `GET /api/observe/session?id={sessionId}&key=aisles-observe`.

To inspect rule matches directly, fetch the session data from the API:

```bash
curl "http://localhost:5173/api/observe/session?id=YOUR_SESSION_ID&key=aisles-observe" | jq '.inference.ruleMatches'
```

Each entry shows which rule fired, its weight, the score adjustment it applied, and the human-readable reason from `describeRuleMatch()` in `src/lib/signals/inference.ts`.

**Example output**:

```json
[
  {
    "ruleName": "search-hunter-keywords",
    "weight": 0.9,
    "adjustment": { "hunter": 0.4, "priceSensitivity": 0.5 },
    "reason": "Search \"dorm desk under $150\" matches deal/budget keywords"
  },
  {
    "ruleName": "mobile-evening-impulse",
    "weight": 0.5,
    "adjustment": { "hunter": 0.1, "urgency": 0.2 },
    "reason": "Mobile device at 22:00 — evening impulse pattern"
  }
]
```

### Testing Inference Rules in Isolation

The `infer()` function in `src/lib/signals/inference.ts` takes a plain `InferenceContext` object. You can test any rule combination without a running server:

```typescript
import { infer } from '$lib/signals/inference';

const result = infer({
  intentParam: null,
  searchQuery: 'dorm desk under $150',
  referrer: 'https://slickdeals.net',
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  deviceType: 'mobile',
  hourOfDay: 22,
  dayOfWeek: 3,
  storedPersona: 'gatherer',
  storedCategory: 'bedroom',
  visitCount: 2,
  currentCategory: 'office',
});

console.log(result.primary);      // 'hunter'
console.log(result.confidence);   // e.g. 0.28
console.log(result.ruleMatches);  // rules that fired
console.log(result.shift);        // { detected: true, from: 'gatherer', trigger: '...' }
```

Run this as a TypeScript script with `npx tsx`:

```bash
npx tsx scripts/test-inference.ts
```

### Adding a New Inference Rule

To add a rule to the engine:

1. Open `src/lib/signals/inference.ts`
2. Add a new entry to the `rules` array. The rule must implement the `InferenceRule` interface from `src/lib/signals/types.ts`:

```typescript
{
  name: 'my-new-rule',          // Unique string identifier
  weight: 0.6,                  // Confidence multiplier (0.0–1.0)
  evaluate: (ctx) => {
    // Return null if the rule does not apply
    if (!ctx.someField) return null;
    // Return a PersonaScoreAdjustment if it does
    return { hunter: 0.2, priceSensitivity: 0.1 };
  },
},
```

3. Add a `case` for the new rule in `describeRuleMatch()` so the Observe dashboard and debug output show a meaningful reason string:

```typescript
case 'my-new-rule':
  return `Detected X because Y: ${ctx.someField}`;
```

4. If the rule reads a field that does not yet exist on `InferenceContext`, add it to:
   - The `InferenceContext` interface in `src/lib/signals/types.ts`
   - The `toInferenceContext()` method in `src/lib/signals/store.ts` (extract the value from accumulated events)

5. Run the type check to verify all changes compile:

```bash
npm run check
```

6. Test the rule with a manual `infer()` call as described above, verifying the rule fires on expected input and returns null on non-matching input.

See `docs/signals-and-inference.md` for the complete list of existing signal types and rules to avoid duplication.

---

## Architecture Decisions

See `docs/decisions/` for records of significant decisions:

- `001-enrichment-vs-feedonomics.md` — why a custom enrichment pipeline rather than Feedonomics
- `002-streaming-layout-generation.md` — why streaming was added (and how it works)
- `003-prerender-vs-cache-warming.md` — why cache warming beats static prerendering for persona-dependent pages
