# Aisles — API Reference

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers

## Overview

All endpoints are SvelteKit route handlers deployed as Cloudflare Pages Functions. Authentication is cookie-based for user-facing endpoints. Observe uses HTTP Basic authentication against the server-side `OBSERVE_ACCESS_TOKEN` Pages secret.

The base URL varies by brand. Kibble uses `https://aisles.bcsubs.app`.

---

## Layout Endpoints

### POST /api/layout

Generate an AI layout for a persona + category combination. Returns a cached layout instantly if available; otherwise generates via Claude and caches the result.

**Request body**

```json
{
  "persona": "gatherer",
  "categorySlug": "living-room"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `persona` | `"gatherer" \| "hunter" \| "researcher" \| "gifter"` | Yes | The detected shopper persona |
| `categorySlug` | string | Yes | URL-safe category identifier (e.g., `living-room`, `headphones`) |

**Response — cache hit**

```json
{
  "layout": { ... },
  "meta": {
    "persona": "gatherer",
    "categoryName": "living-room",
    "productCount": 0,
    "generationTimeMs": 45,
    "cacheHit": true
  }
}
```

**Response — cache miss**

```json
{
  "layout": {
    "persona": "gatherer",
    "reasoning": "Gatherer persona benefits from editorial storytelling...",
    "sections": [
      {
        "component": "editorial-header",
        "props": {
          "eyebrow": "The Living Room Edit",
          "headline": "Pieces that earn their place",
          "body": "Sofas, chairs, and tables for rooms people actually use."
        }
      },
      {
        "component": "hero-product",
        "props": {
          "product": { "productId": "products/haven-linen-sofa", "role": "hero" },
          "showSpecs": false
        }
      },
      {
        "component": "product-grid",
        "props": {
          "columns": 2,
          "products": [ ... ],
          "imageRatio": "landscape",
          "showDescription": true,
          "showSpecs": false,
          "showQuickAdd": false
        }
      }
    ],
    "productOrder": ["products/haven-linen-sofa", "products/walnut-coffee-table", "..."]
  },
  "meta": {
    "persona": "gatherer",
    "categoryName": "Living Room",
    "productCount": 12,
    "generationTimeMs": 2840,
    "cacheHit": false
  }
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing `persona` or `categorySlug` |
| 404 | Category not found in brand config |
| 500 | AI generation failed |

**Model selection**: Tries Claude Haiku 4.5 first (2–4s). Falls back to Claude Sonnet 4.6 (8–15s) if Haiku returns an invalid structured output.

---

### POST /api/layout/stream

Streaming variant of layout generation using Server-Sent Events. Cache hits return `application/json` immediately (same shape as `/api/layout`). Cache misses return `text/event-stream` with partial layout objects as sections generate.

**Request body**: same as `POST /api/layout`

**Response — cache hit**: `Content-Type: application/json`, same shape as `/api/layout`

**Response — cache miss**: `Content-Type: text/event-stream`

Each SSE event is a `data:` line with a JSON payload. Three event types:

**Partial object event** (emitted repeatedly as tokens stream in):
```
data: {"sections": [{"component": "editorial-header", "props": {...}}]}
```
The partial object grows with each event. The client re-renders as sections are added.

**Done event** (final event, emitted once after the full object is validated):
```
data: {"__done": true, "layout": { ... }, "meta": { ... }}
```

**Error event** (emitted if the stream fails):
```
data: {"__error": true, "message": "...", "generationTimeMs": 3200}
```

**Client consumption pattern**:

```typescript
const res = await fetch('/api/layout/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ persona, categorySlug }),
});

if (res.headers.get('Content-Type')?.includes('application/json')) {
  // Cache hit — render immediately
  const data = await res.json();
  renderLayout(data.layout);
} else {
  // Cache miss — stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.__done) {
        renderLayout(payload.layout);
      } else if (payload.__error) {
        handleError(payload.message);
      } else if (payload.sections) {
        renderPartialLayout(payload); // progressive render
      }
    }
  }
}
```

---

## Refinement Endpoint

### POST /api/refine

Conversational layout refinement. The shopper sends a natural-language constraint ("show me options under $300" or "I need something for a small space") and the server generates a new layout honoring all accumulated constraints plus the new message.

**Request body**

```json
{
  "message": "show me options under $300",
  "currentLayout": { ... },
  "persona": "hunter",
  "categorySlug": "office",
  "constraints": ["under $300"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | The shopper's latest refinement message |
| `categorySlug` | string | Yes | Current category |
| `currentLayout` | Layout | No | The layout currently shown (used for context) |
| `persona` | string | No | Current persona label |
| `constraints` | string[] | No | Accumulated constraints from this refinement session |

**Response**

```json
{
  "layout": { ... },
  "newConstraint": "show me options under $300",
  "meta": {
    "generationTimeMs": 1850,
    "persona": "hunter",
    "constraintCount": 2
  }
}
```

**Notes**:
- Refinement results are not cached (constraints are session-specific).
- The server re-fetches products from BigCommerce on every call — it does not trust the client-sent layout's product list.
- Refinement calls are logged to `generation_logs` with `type: "refine"`.
- Model selection: Haiku first, Sonnet fallback (same as layout generation).

---

## Signal Endpoint

### POST /api/signals

Ingest batched client-side behavioral signals. Appends events to the session store, re-runs inference, and returns the updated `PersonaInference`.

Requires the `aisles_session` cookie to be set (established server-side on the first page load). Events received without a valid session cookie are acknowledged but not stored.

**Request body**

```json
{
  "events": [
    {
      "type": "nav.search",
      "source": "navigation",
      "timestamp": 1775500030000,
      "data": { "query": "dorm room desk" },
      "context": {
        "page": "/category/office",
        "category": "office",
        "viewport": "desktop"
      }
    }
  ]
}
```

**Event shape**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | SignalEventType | Yes | Event type (see below) |
| `source` | SignalSource | Yes | Origin of the signal |
| `timestamp` | number | Yes | Unix timestamp in milliseconds |
| `data` | object | No | Event-specific payload |
| `context.page` | string | Yes | Current page path |
| `context.category` | string \| null | Yes | Current category slug if on a category page |
| `context.viewport` | `"mobile" \| "tablet" \| "desktop"` | Yes | Viewport size |

**Signal event types**

| Type | Source | Description |
|---|---|---|
| `request.pageview` | request | Page load |
| `request.device` | request | Device type detection |
| `request.geo` | request | Geographic signal |
| `request.search_landing` | request | Arrived via search engine |
| `request.returning` | request | Returning visitor detected |
| `nav.category_view` | navigation | Entered a category |
| `nav.product_view` | navigation | Viewed a product |
| `nav.search` | navigation | Ran a search |
| `nav.back` | navigation | Used browser back |
| `interact.scroll_depth` | interaction | Scroll depth milestone |
| `interact.dwell_time` | interaction | Time on page |
| `interact.filter_use` | interaction | Used a filter |
| `interact.sort_change` | interaction | Changed sort order |
| `commerce.add_to_cart` | commerce | Added item to cart |
| `commerce.autoship_mix` | commerce | Cart share on Auto-Refill; `data.mix` must be a finite number from 0 through 1 |
| `subscription.cadence_selected` | interaction | Selected Auto-Refill cadence; `data.months` must be 1, 2, or 3 |
| `subscription.skip` | interaction | Skipped a scheduled shipment |
| `subscription.swap` | interaction | Swapped a subscription item |
| `subscription.pause` | interaction | Paused a subscription |
| `subscription.due_proximity` | external | Days until the next shipment; `data.days` must be non-negative |
| `subscription.tenure` | external | Months subscribed; `data.months` must be non-negative |
| `refine.message` | refinement | Sent a refinement message |

For the Kibble-only event types above, the route enforces the listed source.
The public route currently rejects **all** `external` events, including
`subscription.due_proximity` and `subscription.tenure`, until an authenticated
server-side provider producer exists. Synthetic scenarios replay those events
inside the server-side session store; browsers cannot submit them.

**Response**

```json
{
  "received": 1,
  "inference": {
    "probabilities": {
      "gatherer": 0.22,
      "hunter": 0.55,
      "researcher": 0.16,
      "gifter": 0.07
    },
    "primary": "hunter",
    "confidence": 0.33,
    "modifiers": {
      "priceSensitivity": 0.45,
      "urgency": 0.0,
      "familiarityWithStore": 0.1
    },
    "shift": {
      "detected": true,
      "from": "gatherer",
      "trigger": "search query \"dorm room desk\" conflicts with stored gatherer model"
    },
    "signalCount": 3,
    "lastUpdated": 1775500030000,
    "dominantSource": "request"
  }
}
```

If no valid session cookie exists, `inference` will be `null` and `received` will reflect the count of events in the request.

**Error responses**

| Status | Condition |
|---|---|
| 400 | Empty or missing `events` array |
| 400 | Event missing `type`, `source`, or `timestamp` |
| 400 | Public request submits an `external` event or provider-derived subscription fact |

---

## Kibble Demo Decision Endpoint

### POST /api/kibble/home-decision?observe=true

Re-derives the current Kibble Home decision from the existing scoped session.
The public demo inspector calls the rules path after a simulated behavior is
confirmed by `POST /api/signals`. An empty body or exact
`{"mode":"rules"}` selects that deterministic path. The explicit bounded-AI
control sends exact `{"mode":"model"}`. The browser supplies no persona,
product order, score, product facts, or policy identity.

The no-store response contains sanitized inference, the approved shelf order,
the Template/Rules/AI-model zone trace, exact rendered shelf adapters, and
contracted provenance. The rules path makes zero model calls. The model path
reserves the worst-case provider budget before sending sanitized inference and
bounded approved product facts to the configured model. Its response schema can
only return an exact permutation of the approved product IDs. Neither path may
generate or replace the Kibble layout, components, copy, prices, links, CSS, or
commerce actions. A successful model action writes its generation telemetry to
Postgres after response validation; the rules path writes no telemetry.

| Status | Condition |
|---|---|
| 200 | Explicit `observe=true`, active Kibble Preserve Home, and an existing scoped session |
| 400 | Invalid or oversized decision body |
| 404 | Missing demo flag, wrong brand, or unavailable Preserve policy |
| 409 | Missing or unknown scoped session |
| 429 | Session cooldown or daily provider-call budget exhausted |
| 503 | Bounded AI is disabled or its production Redis budget is unavailable |
| 500 | Server decision or catalog operation failed |

---

### POST /api/kibble/pdp-related-decision?observe=true

Runs one opt-in model ranking for the `pdp.related` rail on the single approved
route `/product/puppy-starter-kit`. The request body must be exactly
`{"mode":"model"}`. The browser cannot provide a route, candidate, product
fact, or order. The server reloads the approved PDP and refuses to call a model
unless it finds three or four unique related products. It reserves the same
session/global Redis budget as the Home action before contacting a provider.

The no-store response contains only the route identity, provenance, model-call
count, a strict permutation of the server-reloaded related IDs, and the exact
related-rail adapter. The PDP itself remains fixed: copy, prices, links,
actions, component, and CSS are unchanged.

| Status | Condition |
|---|---|
| 200 | Explicit observe session, exact approved route, eligible server-reloaded rail, and budget reservation |
| 400 | Body is not exactly `{"mode":"model"}` |
| 404 | Missing demo flag or wrong brand |
| 409 | Missing session or fewer than three related candidates |
| 429 | Session cooldown or daily provider-call budget exhausted |
| 503 | Bounded AI is disabled or its production Redis budget is unavailable |
| 500 | Catalog, provider, or output validation failed; the client retains the fixed rail |

---

## Cart Endpoints

### POST /api/cart

Add an item to the BigCommerce cart. Creates a new cart if none exists; appends to the existing cart if the `bc_cart_id` cookie is set. Expired or invalid cart IDs trigger a new cart creation.

**Request body**

```json
{
  "productEntityId": 127,
  "quantity": 1
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `productEntityId` | number | Yes | — | BigCommerce product entity ID |
| `quantity` | number | No | 1 | Quantity to add |

**Response**

```json
{
  "cart": {
    "entityId": "abc-123-cart-id",
    "lineItems": {
      "physicalItems": [
        { "entityId": "...", "productEntityId": 127, "quantity": 1, "name": "...", ... }
      ]
    }
  },
  "itemCount": 1
}
```

Sets the `bc_cart_id` cookie (httpOnly, SameSite=Lax, 30-day max age).

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing `productEntityId` |
| 500 | BigCommerce API error |

---

### GET /api/cart

Retrieve the current cart state. Returns an empty cart if no `bc_cart_id` cookie is set or if the cart has expired.

**No request body or parameters.**

**Response — cart exists**

```json
{
  "cart": { "entityId": "...", "lineItems": { "physicalItems": [...] } },
  "itemCount": 3
}
```

**Response — no cart**

```json
{
  "cart": null,
  "itemCount": 0
}
```

If the cart ID in the cookie points to an expired BigCommerce cart, the cookie is deleted and the response returns `cart: null`.

---

## Observe Endpoints

All Observe endpoints, including the scenario write endpoint, require HTTP Basic authentication. The password must match the server-side `OBSERVE_ACCESS_TOKEN` Pages secret. A deployed environment with no secret denies Observe entirely. Local `npm run dev` stays open only while no token is configured.

These endpoints are intended for the Observe dashboard (`/observe`) and are not rate-limited.

---

### GET /api/observe/session

Returns the full state of a specific session: all signal events, the current persona inference, and cross-session context.

**Query parameters**

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | Session ID (value of the `aisles_session` cookie) |

**Response**

```json
{
  "sessionId": "abc-123",
  "events": [
    {
      "id": "evt-1",
      "sessionId": "abc-123",
      "timestamp": 1775500000000,
      "sequence": 1,
      "type": "request.pageview",
      "source": "request",
      "data": { "referrer": "https://pinterest.com" },
      "context": { "page": "/category/living-room", "category": "living-room", "viewport": "desktop" }
    }
  ],
  "inference": {
    "probabilities": { "gatherer": 0.35, "hunter": 0.55, "researcher": 0.07, "gifter": 0.03 },
    "primary": "hunter",
    "confidence": 0.20,
    "modifiers": { "priceSensitivity": 0.45, "urgency": 0.0, "familiarityWithStore": 0.28 },
    "shift": { "detected": true, "from": "gatherer", "trigger": "search query \"dorm room desk\"" },
    "signalCount": 5,
    "lastUpdated": 1775500030000,
    "dominantSource": "request"
  },
  "eventCount": 5,
  "crossSession": {
    "storedPersona": "gatherer",
    "storedCategory": "living-room",
    "visitCount": 2,
    "currentCategory": "office"
  }
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing `id` parameter |
| 401 | Missing or incorrect HTTP Basic credentials |
| 404 | Session ID not found in Redis |

---

### GET /api/observe/logs

Returns recent generation log entries from Supabase Postgres. Each entry represents one layout or refinement call.

**Query parameters**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `limit` | No | 20 | Number of records to return (max 100) |
| `session` | No | — | Filter to a specific session ID |

**Response**

```json
{
  "logs": [
    {
      "type": "layout",
      "persona": "hunter",
      "categorySlug": "office",
      "cacheHit": false,
      "generationMs": 2100,
      "productCount": 12,
      "inputTokens": 892,
      "outputTokens": 340,
      "evalScore": null,
      "promptVersion": "v1",
      "model": "anthropic/claude-haiku-4.5",
      "estimatedCost": 0.000235,
      "sessionId": "abc-123",
      "createdAt": "2026-04-06T17:00:00Z"
    }
  ]
}
```

**Cost calculation**: `estimatedCost` is computed at insert time using per-model pricing (Haiku: $0.80/M input, $4.00/M output; Sonnet: $3.00/M input, $15.00/M output).

---

### GET /api/observe/sessions

Returns a list of active session IDs by scanning Redis for `aisles:session:*` keys. Used by the Observe dashboard to populate the session picker.

**Query parameters**

| Parameter | Required | Description |
|---|---|---|

**Response**

```json
{
  "sessionIds": ["abc-123", "synthetic:first-time-puppy-owner"],
  "sessions": [
    { "id": "abc-123", "scenarioId": null, "scenarioLabel": null },
    {
      "id": "synthetic:first-time-puppy-owner",
      "scenarioId": "first-time-puppy-owner",
      "scenarioLabel": "First-time puppy owner"
    }
  ]
}
```

Sessions appear here while they exist in Redis (30-minute TTL). A session with no activity for 30 minutes will not appear in this list.

The legacy `sessionIds` array remains for existing consumers. `sessions` adds
`scenarioId` and `scenarioLabel`; a non-null label means the session is synthetic.

---

### POST /api/observe/scenarios

Seeds one named deterministic synthetic session for a local Kibble demo. It
replaces that scenario's existing session rather than appending events. It does
not call external APIs, generate a layout, or write telemetry rows directly.

Available only when `BRAND_ID=kibble` and valid HTTP Basic credentials are
provided. It is an operator-only demo endpoint, not a provider integration.

**Request body**

```json
{ "scenarioId": "first-time-puppy-owner" }
```

Allowed values are `first-time-puppy-owner`, `lapsed-subscriber-returning`, and
`price-checking-reorder`.

**Response**

```json
{
  "sessionId": "synthetic:first-time-puppy-owner",
  "scenarioId": "first-time-puppy-owner",
  "scenarioLabel": "First-time puppy owner",
  "synthetic": true,
  "inference": { "primary": "researcher" }
}
```

---

### GET /api/observe/enrichment

Returns enriched product data for a category, sorted by persona-fit score. Used by the Product Enrichment panel in the Observe dashboard.

**Query parameters**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `category` | Yes | — | Category slug (e.g., `living-room`) |
| `persona` | No | `gatherer` | Persona to sort by |

**Response**

```json
{
  "products": [
    {
      "id": "harvest-chicken-air-dried-recipe",
      "entityId": 127,
      "name": "Harvest Chicken Air Dried Recipe",
      "price": 34.99,
      "salePrice": null,
      "personaFit": {
        "gatherer": 0.91,
        "hunter": 0.42,
        "researcher": 0.55,
        "gifter": 0.68
      },
      "semanticTags": ["daily-kibble", "adult-dog", "air-dried", "grain-free", "auto-refill"],
      "compatibleWith": ["chicken", "adult", "grain-free", "daily feeding"],
      "priceTier": "mid",
      "petProfile": {
        "protein": "chicken", "lifeStage": "adult", "format": "air-dried",
        "dietary": "grain-free", "petSize": "any", "replenishmentDays": 30,
        "subscriptionFit": 0.9
      }
    }
  ],
  "categoryName": "Living Room"
}
```

Products are sorted by the requested persona's `personaFit` score, descending. Products without enrichment data appear last with default fit scores of 0.5.

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing `category` parameter |
| 401 | Missing or incorrect `key` parameter |
