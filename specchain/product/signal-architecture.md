# Signal Architecture: How Prism Understands Shoppers

**Purpose:** Define the complete system for capturing, processing, and acting on shopper signals — from the first pageview through purchase and return visits. This is the intelligence layer between raw browser events and persona-driven layout generation.

**Principle:** Design the full pipeline first, implement in layers. Every level of signal capture (from URL params to CDP integration) emits the same event format into the same inference system. No ad hoc bolt-ons.

---

## The Problem with the Current Approach

Today's persona detection:
```
URL params + cookies + regex → persona string (once, at page load)
```

This is wrong in three ways:
1. **One-shot** — checks signals at page load, never updates during the session
2. **Binary** — outputs a single persona label, not a probability distribution
3. **Stateless** — each page load is independent; no signal accumulation within a session

What it should be:
```
Continuous signal stream → enrichment → inference → probability vector → layout decisions
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Signal Sources                        │
│                                                         │
│  Request Context    Client Behavior    External Data    │
│  ─────────────     ───────────────    ──────────────    │
│  referrer           page_view          BC customer       │
│  UTM params         product_click      order history     │
│  device/viewport    scroll_depth       CDP profile       │
│  time of day        dwell_time         loyalty tier      │
│  geo (broad)        search_query       wishlist          │
│  cookies            add_to_cart                          │
│  search query       refinement_msg                      │
│                     category_switch                      │
│                     back_navigation                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Event Emitter   │
              │  (unified format)│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Signal Store    │
              │  (session-scoped)│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Inference       │
              │  Engine          │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Persona Vector  │
              │  + Context       │
              └────────┬────────┘
                       │
                       ├──► Layout Generation (AI endpoint)
                       ├──► Product Ranking (sort order)
                       ├──► Component Selection (PDP extras)
                       └──► Dev Mode Display (transparency)
```

---

## 1. The Event Schema

Every signal — whether from a URL parameter, a scroll event, or a CDP webhook — is normalized into this format before entering the system.

```typescript
interface SignalEvent {
  // Identity
  id: string;                    // UUID
  sessionId: string;             // Links events within a visit
  userId: string | null;         // BC customer ID if logged in, null if anonymous
  
  // Timing
  timestamp: number;             // Unix ms
  sequence: number;              // Event order within session (0, 1, 2...)
  
  // Classification
  type: SignalEventType;         // From the taxonomy below
  source: SignalSource;          // Where this signal originated
  
  // Payload
  data: Record<string, unknown>; // Type-specific data (see taxonomy)
  
  // Context (enriched at emit time)
  context: {
    page: string;                // Current route (/category/living-room)
    category: string | null;     // Current category slug
    persona: string | null;      // Current persona at time of event
    viewport: 'mobile' | 'tablet' | 'desktop';
  };
}

type SignalSource = 
  | 'request'      // Server-side, from HTTP request headers
  | 'navigation'   // Client-side, from page/route changes
  | 'interaction'  // Client-side, from user actions (click, scroll, type)
  | 'commerce'     // Client-side, from cart/checkout actions
  | 'refinement'   // Client-side, from the refinement chat
  | 'external'     // Server-side, from CDP/BC/third-party
  ;
```

---

## 2. The Signal Taxonomy

### Request Signals (captured server-side on page load)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `request.pageview` | request | `{ referrer, utm_source, utm_medium, utm_campaign, utm_content }` | Referrer + UTM indicate intent source |
| `request.device` | request | `{ userAgent, viewport, deviceType, screenWidth }` | Mobile late-night = impulse; desktop weekday = deliberate |
| `request.geo` | request | `{ country, region, timezone }` | Timezone → time-of-day context |
| `request.search_landing` | request | `{ query, source }` | Query keywords → persona (e.g., "cheap" = Hunter) |
| `request.returning` | request | `{ previousPersona, previousCategory, visitCount, daysSinceLastVisit }` | Continuity vs. shift detection |

### Navigation Signals (captured client-side)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `nav.category_view` | navigation | `{ category, fromCategory, timeOnPreviousPage }` | Category switching patterns |
| `nav.product_view` | navigation | `{ productId, price, category, fromPage }` | Price range of viewed products |
| `nav.search` | navigation | `{ query, resultCount }` | Search specificity indicates intent |
| `nav.back` | navigation | `{ fromPage, toPage }` | Back-and-forth = Gatherer; linear = Hunter |
| `nav.breadcrumb` | navigation | `{ level, target }` | Navigation style |

### Interaction Signals (captured client-side)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `interact.scroll_depth` | interaction | `{ depth: 25|50|75|100, page, timeToReach }` | Deep scroll = engaged Gatherer; shallow = Hunter scanning |
| `interact.dwell_time` | interaction | `{ productId, duration, page }` | Long dwell on product = Researcher; quick scan = Hunter |
| `interact.image_zoom` | interaction | `{ productId }` | Examining details = Researcher |
| `interact.spec_expand` | interaction | `{ productId, specField }` | Reading specs = Researcher |
| `interact.review_read` | interaction | `{ productId, reviewId }` | Reading reviews = Researcher |
| `interact.compare_add` | interaction | `{ productId }` | Adding to comparison = Researcher |
| `interact.filter_use` | interaction | `{ filterType, filterValue }` | Using filters = Hunter (knows what they want) |
| `interact.sort_change` | interaction | `{ sortBy }` | Sort by price = price-sensitive; sort by rating = Researcher |

### Commerce Signals (captured client-side)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `commerce.add_to_cart` | commerce | `{ productId, price, quantity, category }` | Purchase intent confirmed |
| `commerce.remove_from_cart` | commerce | `{ productId, reason? }` | Reconsidering = Researcher behavior |
| `commerce.cart_view` | commerce | `{ itemCount, totalValue }` | Checking cart = moving toward checkout |
| `commerce.checkout_start` | commerce | `{ cartValue, itemCount }` | High intent |
| `commerce.purchase` | commerce | `{ orderId, totalValue, items }` | Outcome — feeds the feedback loop |

### Refinement Signals (captured client-side)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `refine.open` | refinement | `{ page, currentPersona }` | Engaged enough to refine |
| `refine.message` | refinement | `{ message, constraintCount }` | Natural language → intent extraction |
| `refine.quick_action` | refinement | `{ action }` | Which quick action chosen |
| `refine.close` | refinement | `{ messageCount, duration }` | Engagement depth |

### External Signals (captured server-side from integrations)

| Event Type | Source | Data Fields | Persona Signal |
|-----------|--------|-------------|---------------|
| `external.bc_customer` | external | `{ customerId, orderCount, totalSpent, lastOrderDate }` | Purchase history → loyalty + price sensitivity |
| `external.bc_wishlist` | external | `{ items, priceRange }` | Wishlist contents = saved intent |
| `external.cdp_segment` | external | `{ segmentId, segmentName, traits }` | Pre-computed audience segment |
| `external.cdp_profile` | external | `{ interests, lifecycle_stage, predicted_ltv }` | Rich profile data |

---

## 3. The Signal Store

Signals accumulate in a session-scoped store. This is NOT a database — it's a short-lived buffer that the inference engine reads from.

```typescript
interface SignalStore {
  sessionId: string;
  userId: string | null;
  events: SignalEvent[];           // Ordered by sequence
  
  // Pre-computed aggregates (updated on each event)
  aggregates: {
    pageviewCount: number;
    productViewCount: number;
    uniqueProductsViewed: Set<string>;
    categoriesVisited: string[];
    averageDwellTime: number;
    priceRangeViewed: { min: number; max: number };
    scrollDepthAverage: number;
    searchQueries: string[];
    refinementCount: number;
    cartActions: number;
    timeOnSite: number;            // Total session duration in ms
  };
}
```

**Storage options by phase:**

| Phase | Store | Lifetime | Notes |
|-------|-------|----------|-------|
| Walking skeleton (now) | In-memory on server + cookies | Request-scoped | Current approach |
| Phase 2 | SvelteKit server session + client store | Session-scoped (30 min) | Svelte 5 `$state` on client, server-side session via hooks |
| Phase 3 | Upstash Redis | Session (30 min) + cross-session (30 days) | Shared across server-side requests |
| Phase 4+ | Upstash Redis + Supabase | Session + persistent profile | Long-term user profile |

---

## 4. The Inference Engine

The inference engine consumes the signal store and outputs a persona probability vector. It runs on every significant event — not just at page load.

### Output

```typescript
interface PersonaInference {
  // Probability distribution (sums to 1.0)
  probabilities: {
    gatherer: number;    // 0.0 - 1.0
    hunter: number;
    researcher: number;
    gifter: number;
  };
  
  // The winning persona (highest probability)
  primary: 'gatherer' | 'hunter' | 'researcher' | 'gifter';
  confidence: number;   // How far ahead the primary is from second place
  
  // Modifiers (cross-cutting, 0.0 - 1.0)
  modifiers: {
    priceSensitivity: number;     // 0 = price-insensitive, 1 = very price-driven
    urgency: number;              // 0 = browsing, 1 = buying now
    familiarityWithStore: number; // 0 = first visit, 1 = loyal customer
  };
  
  // Context
  shift: {
    detected: boolean;            // Persona changed significantly this session
    from: string | null;          // Previous primary persona
    trigger: string | null;       // What caused the shift (event type + data)
  };
  
  // Provenance
  signalCount: number;            // How many signals informed this inference
  lastUpdated: number;            // Timestamp
  dominantSource: SignalSource;   // Which source type contributed most
}
```

### Inference Rules (Phase 1 — heuristic)

The initial inference engine is rule-based, not ML. Rules are weighted and composable.

```typescript
// Each rule produces a partial score adjustment
interface InferenceRule {
  name: string;
  weight: number;              // 0.0 - 1.0 importance
  evaluate: (store: SignalStore) => PersonaScoreAdjustment;
}

interface PersonaScoreAdjustment {
  gatherer?: number;   // Positive = more likely, negative = less likely
  hunter?: number;
  researcher?: number;
  gifter?: number;
  priceSensitivity?: number;
  urgency?: number;
}
```

**Example rules:**

| Rule | Signal | Adjustment |
|------|--------|-----------|
| Referrer is Pinterest/Instagram | `request.pageview.referrer` | gatherer +0.3 |
| Referrer is Google Shopping | `request.pageview.referrer` | hunter +0.2 |
| UTM contains "gift" | `request.pageview.utm_campaign` | gifter +0.4 |
| Search query contains "cheap/budget/under $" | `nav.search.query` | hunter +0.3, priceSensitivity +0.4 |
| Viewed 5+ products without cart add | `aggregates.productViewCount` | gatherer +0.2 |
| Viewed < 3 products then added to cart | `aggregates` | hunter +0.3, urgency +0.3 |
| Expanded specs on 2+ products | `interact.spec_expand count` | researcher +0.4 |
| Used comparison feature | `interact.compare_add` | researcher +0.5 |
| Sorted by price | `interact.sort_change` | hunter +0.2, priceSensitivity +0.3 |
| Scroll depth > 75% on category page | `interact.scroll_depth` | gatherer +0.2 |
| Average dwell time > 30s per product | `interact.dwell_time` | researcher +0.3 |
| Back-and-forth navigation (3+ back events) | `nav.back count` | gatherer +0.3 |
| Mobile device + evening hours | `request.device + time` | hunter +0.1, urgency +0.2 |
| Returning visitor, same category | `request.returning` | continuity (boost stored persona +0.3) |
| Returning visitor, search conflicts with stored | `request.returning + nav.search` | shift detection |
| BC customer with 5+ orders | `external.bc_customer` | familiarityWithStore +0.5 |
| Refinement message mentions price | `refine.message` | priceSensitivity +0.3 |
| Refinement message mentions gift/recipient | `refine.message` | gifter +0.4 |

### Inference Timing

The engine re-evaluates on these triggers:
- Page load (request signals available)
- Product click (after 3+ product views — enough data to infer)
- Search query submitted
- Refinement message sent
- Sort/filter changed
- Cart action

It does NOT re-evaluate on every scroll event or mouse move — those are batched and aggregate.

### Persona Shift Detection

A shift is detected when:
1. The primary persona changes from the stored/previous inference
2. The new primary has confidence > 0.6 (not a weak signal)
3. The triggering signal is a strong indicator (search query, category switch, refinement message)

When a shift is detected:
- The layout generation receives the new persona
- Dev mode shows the shift with trigger explanation
- The stored persona is updated (cookie/session)
- The previous persona is NOT deleted — it's deprioritized

---

## 5. Client-Side Event Emitter

A lightweight client-side module that captures interaction and navigation signals.

```typescript
// src/lib/signals/emitter.ts

class SignalEmitter {
  private sessionId: string;
  private sequence: number = 0;
  private buffer: SignalEvent[] = [];
  private flushInterval: number;
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    // Flush buffered events to server every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }
  
  emit(type: SignalEventType, data: Record<string, unknown>) {
    const event: SignalEvent = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      userId: null, // Set if logged in
      timestamp: Date.now(),
      sequence: this.sequence++,
      type,
      source: this.inferSource(type),
      data,
      context: this.getCurrentContext(),
    };
    
    this.buffer.push(event);
    
    // Immediate flush for high-priority events
    if (['commerce.add_to_cart', 'refine.message', 'nav.search'].includes(type)) {
      this.flush();
    }
  }
  
  private async flush() {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    
    await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    }).catch(() => {
      // Re-buffer on failure
      this.buffer = [...events, ...this.buffer];
    });
  }
  
  destroy() {
    clearInterval(this.flushInterval);
    this.flush(); // Final flush
  }
}
```

**What this captures automatically (via Svelte lifecycle):**
- Page navigation (SvelteKit `afterNavigate`)
- Scroll depth (IntersectionObserver at 25/50/75/100%)
- Product dwell time (time between product_view and next navigation)
- Search submissions
- Cart actions

**What components emit explicitly:**
- `interact.spec_expand` — when specs accordion opens
- `interact.image_zoom` — when product image is zoomed
- `interact.filter_use` — when filter/sort controls change
- `refine.message` — when refinement chat sends a message

---

## 6. Server-Side Signal Endpoint

```
POST /api/signals
Body: { events: SignalEvent[] }
Response: { received: number, inference: PersonaInference }
```

The endpoint:
1. Validates events against the schema
2. Adds them to the session's signal store
3. Runs the inference engine if a trigger event is present
4. Returns the updated persona inference (so the client can react)

---

## 7. Integration Points

### BigCommerce Customer Data (Phase 3)

When a customer logs in via BC JWT:
- Fetch order history, wishlist, saved addresses
- Emit `external.bc_customer` events
- Feed into inference (familiarityWithStore, price range history)

### CDP Integration (Phase 4+)

The signal architecture supports CDP integration in two directions:

**Inbound (CDP → Prism):**
- CDP pushes segment/profile data via webhook or API
- Prism emits `external.cdp_profile` events
- Inference engine incorporates CDP signals alongside first-party data

**Outbound (Prism → CDP):**
- Prism's signal events are forwarded to the CDP
- The CDP gets real-time behavioral data enriched with persona context
- Enables: persona-aware email campaigns, retargeting, cross-channel personalization

### Supported CDPs (integration interface, not implementation):
- Segment (event API)
- mParticle (event API)
- Bloomreach Engagement (event API + Loomi)
- Klaviyo (for email/SMS)

---

## 8. The Feedback Loop

Purchase outcomes feed back into the inference model:

```
Shopper browses (signals captured)
  → Persona inferred
  → Layout generated
  → Products displayed
  → Purchase (or abandon)
  → Outcome captured
  → Model learns: "Gatherer persona on Living Room with editorial layout
     → 3.2% conversion rate, $1,847 avg order value"
```

**Phase 1 (walking skeleton):** Capture outcomes. No automated learning. Manual analysis of which persona/layout combinations convert.

**Phase 3+:** Automated weight adjustment. If Hunter layouts on Office category convert at 5.1% vs Gatherer at 2.3%, the inference engine biases toward Hunter for that category.

**Phase 5+:** Per-signal attribution. "Shoppers who used the refinement chat converted 2.4x higher than those who didn't." → Refinement chat prompt becomes more proactive.

---

## 9. Privacy and Data Handling

- **No PII in signals.** Session IDs are random UUIDs. User IDs are BC customer IDs (only if logged in).
- **No cross-site tracking.** Signals are first-party only. No third-party cookies, no fingerprinting.
- **Session data expires.** In-session signals: 30 min TTL. Cross-session summaries: 30 days. Purchase outcomes: persistent (anonymized).
- **Opt-out.** If a user clears cookies, all persona state resets. No server-side profile reconstruction from behavioral fingerprints.
- **Dev mode transparency.** Every signal and inference decision is visible in dev mode. The system never hides what it's doing.
- **GDPR/CCPA ready.** Signal store is session-scoped and can be deleted on request. No persistent behavioral profiles without consent.

---

## 10. Implementation Phases

| Phase | What's Captured | Inference | Storage |
|-------|----------------|-----------|---------|
| **Walking skeleton (done)** | URL params, cookies, search query regex | Single persona string, once at page load | Cookies |
| **Phase 2: First-party signals** | + referrer, UTM, device, time, viewport | Probability vector with modifiers, re-evaluated on key events | Svelte `$state` client + server session |
| **Phase 3: Behavioral signals** | + scroll, dwell, click, navigation patterns | Full rule-based inference, real-time updates | Upstash Redis session store |
| **Phase 4: External signals** | + BC customer data, CDP profiles | Inference incorporates purchase history + external segments | Upstash + Supabase |
| **Phase 5: Feedback loop** | + purchase outcomes, layout effectiveness | Automated weight adjustment based on conversion data | Supabase + analytics pipeline |

---

## 11. Metrics and Observability

**Signal health:**
- Events per session (target: 15-30 for a typical browse)
- Event latency (time from interaction to server receipt — target: <200ms)
- Buffer overflow rate (events lost due to flush failure — target: <0.1%)

**Inference quality:**
- Persona stability (how often does primary persona change within a session — target: <2 shifts)
- Confidence distribution (what % of sessions have confidence > 0.7 — target: >60%)
- Shift accuracy (when a shift is detected, does the new persona lead to better engagement — measured by dwell time post-shift)

**Business impact (Phase 5):**
- Conversion rate by persona × layout combination
- Average order value by persona
- Refinement engagement rate (% of sessions that open the chat)
- Refinement-to-purchase rate (% of refinement sessions that convert)

---

## Key Design Decisions

1. **Probability vector, not label.** The inference output is always a distribution. "Gatherer 0.45, Hunter 0.35, Researcher 0.15, Gifter 0.05" — not "this person is a Gatherer."

2. **Client emits, server infers.** The client captures events and sends them to the server. Inference runs server-side so it has access to the full signal store and external data. The client never runs inference logic.

3. **Buffered, not real-time for most events.** Scroll and dwell events buffer for 5 seconds then flush. Commerce and refinement events flush immediately. This balances responsiveness with network efficiency.

4. **Rules first, ML later.** Phase 1-3 use hand-tuned heuristic rules. Phase 5+ can replace rules with a trained model — the signal schema and inference interface are the same either way.

5. **Signals are append-only.** Events are never modified after emission. The inference engine re-evaluates from the full history on each trigger. This makes debugging trivial — replay the event stream and see exactly how the inference evolved.

6. **The inference result is passed to layout generation.** The AI endpoint receives the full `PersonaInference` object, not just a persona string. The AI can use confidence, modifiers, and shift context to make better layout decisions.
