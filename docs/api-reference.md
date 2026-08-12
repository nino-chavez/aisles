# Aisles — API Reference

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers

## Overview

All endpoints are SvelteKit route handlers deployed as Cloudflare Pages Functions. Authentication is cookie-based for user-facing endpoints. The Observe endpoints use a shared secret query parameter (`key=aisles-observe`).

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
| `refine.message` | refinement | Sent a refinement message |

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

All Observe endpoints require `?key=aisles-observe` in the query string. Requests without this parameter return `401 Unauthorized`.

These endpoints are intended for the Observe dashboard (`/observe`) and are not rate-limited. Do not expose them in production without proper authentication.

---

### GET /api/observe/session

Returns the full state of a specific session: all signal events, the current persona inference, and cross-session context.

**Query parameters**

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | Session ID (value of the `aisles_session` cookie) |
| `key` | Yes | Must be `aisles-observe` |

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
| 401 | Missing or incorrect `key` parameter |
| 404 | Session ID not found in Redis |

---

### GET /api/observe/logs

Returns recent generation log entries from Supabase Postgres. Each entry represents one layout or refinement call.

**Query parameters**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `key` | Yes | — | Must be `aisles-observe` |
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
| `key` | Yes | Must be `aisles-observe` |

**Response**

```json
{
  "sessionIds": ["abc-123", "def-456", "ghi-789"]
}
```

Sessions appear here while they exist in Redis (30-minute TTL). A session with no activity for 30 minutes will not appear in this list.

---

### GET /api/observe/enrichment

Returns enriched product data for a category, sorted by persona-fit score. Used by the Product Enrichment panel in the Observe dashboard.

**Query parameters**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `key` | Yes | — | Must be `aisles-observe` |
| `category` | Yes | — | Category slug (e.g., `living-room`) |
| `persona` | No | `gatherer` | Persona to sort by |

**Response**

```json
{
  "products": [
    {
      "id": "products/haven-linen-sofa",
      "entityId": 127,
      "name": "Haven Linen Sofa",
      "price": 1299,
      "salePrice": null,
      "personaFit": {
        "gatherer": 0.91,
        "hunter": 0.42,
        "researcher": 0.55,
        "gifter": 0.68
      },
      "semanticTags": ["statement-piece", "natural-material", "living-room-anchor", "photogenic", "investment-piece"]
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
