# Spec: Behavioral Signal Expansion

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers
**Status**: Planned — not yet implemented

## Purpose

Aisles currently infers persona from request-time signals only: URL parameters, referrer, UTM tags, device type, and cross-session cookies. These signals are available on the first page load but do not update as the shopper browses.

10 of 14 signal types are defined in the schema but not consumed by any inference rule. This spec describes a five-phase expansion that progressively closes that gap, adding behavioral depth, negative signals, session arc modeling, and full probability vector layout generation.

The expansion is directly motivated by what Netflix, Spotify, and Hulu learned about behavioral personalization. References to those lessons are noted per phase.

---

## Current Baseline

Before reading the expansion phases, understand what exists today:

- **Signals consumed by inference**: `request.pageview`, `request.device`, `request.search_landing`, `request.returning` (partially)
- **Signals emitted but not consumed**: `commerce.add_to_cart`, `nav.category_view` (only updates `currentCategory`, no rule reads the sequence), `nav.search` (overwrites `searchQuery`, feeds existing keyword rules)
- **Signals defined but not emitted**: `nav.product_view`, `nav.back`, `interact.scroll_depth`, `interact.dwell_time`, `interact.filter_use`, `interact.sort_change`, `request.geo`

The `toInferenceContext()` method in `src/lib/signals/store.ts` is the bottleneck: events for most signal types accumulate in the buffer but the `switch` statement has no `case` for them.

---

## Phase 1: Wire Existing Unused Signals

**Goal**: Extract more value from signals that are already being emitted before adding any new instrumentation code.

**Effort**: Low — inference rule additions only. No new emitter code, no new signal types.

### 1a. Category Sequence Rule

**Signal**: `nav.category_view`
**What it measures**: The sequence of categories visited in a session — does the shopper bounce across categories (gatherer) or revisit the same one repeatedly (hunter/researcher)?

**Current state**: `nav.category_view` events are emitted by the `afterNavigate` hook in the layout. `toInferenceContext()` reads the most recent one to update `currentCategory`. The full sequence is in the buffer but not extracted.

**Proposed change to `store.ts`**:

In `toInferenceContext()`, collect all `nav.category_view` events into a `categorySequence` array, then expose it on `InferenceContext`.

```typescript
// Add to InferenceContext interface in types.ts:
categorySequence: string[];  // ordered list of categories visited this session
```

**Proposed new rule in `inference.ts`**:

```typescript
{
  name: 'category-browsing-breadth',
  weight: 0.5,
  evaluate: (ctx) => {
    const unique = new Set(ctx.categorySequence).size;
    if (unique >= 3) {
      // Visiting 3+ categories in one session is gatherer exploration
      return { gatherer: 0.2 };
    }
    if (unique === 1 && ctx.categorySequence.length >= 2) {
      // Multiple views of the same category = focused intent
      return { hunter: 0.15, researcher: 0.1 };
    }
    return null;
  },
},
```

**Persona impact**: Gatherer boost for wide browsing, hunter/researcher boost for category focus.

**Streaming inspiration**: Netflix's watch pattern analysis — users who browse many genre thumbnails but watch few are discovery-mode (gatherer); users who rewatch in the same genre are comfort-mode (affinity exploitation).

---

### 1b. Cart Add Rule

**Signal**: `commerce.add_to_cart`
**What it measures**: Adding something to cart is the strongest available commercial intent signal. It is emitted immediately (high-priority flush) but no inference rule reads it.

**Proposed change to `store.ts`**:

Extract `commerce.add_to_cart` events in `toInferenceContext()` and count them.

```typescript
// Add to InferenceContext interface:
cartAddCount: number;
```

**Proposed new rule in `inference.ts`**:

```typescript
{
  name: 'cart-add-intent',
  weight: 0.8,
  evaluate: (ctx) => {
    if (ctx.cartAddCount === 0) return null;
    // Adding to cart = buying intent = hunter/gifter signal
    // Gifter because cart-add often happens after finding a suitable gift
    return { hunter: 0.25, gifter: 0.15, urgency: 0.3 };
  },
},
```

**Persona impact**: Urgency spike; mild hunter and gifter lift. Does not suppress gatherer/researcher since shoppers can add items while still in research mode.

**Streaming inspiration**: Spotify's "save to playlist" action — the strongest positive engagement signal, treated as high-weight in recommendation updates.

---

### 1c. In-Session Search Query History

**Signal**: `nav.search`
**What it measures**: Searches after the initial landing are in-session refinements, not landing intent. A shopper who lands on a generic page and then searches for "budget desk under $200" is revealing hunter intent through behavior, not initial URL context.

**Current state**: `nav.search` overwrites `searchQuery` in `toInferenceContext()`. The existing keyword rules (`search-hunter-keywords`, etc.) then fire on that query. This already works correctly — Phase 1c is not a new rule but a verification that this path functions end-to-end and that the high-priority flush on `nav.search` reaches the server before the next layout request.

**Action**: Integration test confirming that a `nav.search` event emitted in the browser reaches `/api/signals`, updates the session in Redis, and causes the `search-hunter-keywords` rule to fire on the next inference call.

---

## Phase 2: New Behavioral Signals

**Goal**: Add signals that measure engagement depth — how attentively the shopper interacts with content — without requiring explicit actions like searching or adding to cart.

**Effort**: Medium — new instrumentation in Svelte components, new signal types in the emitter, new rules in the engine.

### 2a. Dwell Time

**Signal**: `interact.dwell_time`
**Source**: Client
**What it measures**: Time a product card was visible in the viewport, as measured by `IntersectionObserver`. Distinct from total time-on-page.

**How to capture**: Add an `IntersectionObserver` to the `ProductCard` component. When a card enters the viewport, record the entry timestamp. When it exits (or the page unloads), compute elapsed time. If elapsed >= 3 seconds, emit the signal.

```typescript
// In ProductCard.svelte (instrumentation pseudocode):
let entryTime: number | null = null;
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entryTime = Date.now();
    } else if (entryTime !== null) {
      const elapsed = Date.now() - entryTime;
      if (elapsed >= 3000) {
        getEmitter()?.emit('interact.dwell_time', {
          productId,
          durationMs: elapsed,
          category: currentCategory,
        });
      }
      entryTime = null;
    }
  }
}, { threshold: 0.5 });
```

**Proposed InferenceContext addition**:

```typescript
longDwellProductCount: number;  // products with >= 3s dwell in this session
```

**Proposed rule**:

```typescript
{
  name: 'dwell-engagement',
  weight: 0.6,
  evaluate: (ctx) => {
    if (ctx.longDwellProductCount === 0) return null;
    if (ctx.longDwellProductCount >= 3) {
      // Reading multiple products carefully = researcher
      return { researcher: 0.2, gatherer: 0.1 };
    }
    // One product studied closely = possibly hunter zeroing in
    return { researcher: 0.1 };
  },
},
```

**Persona impact**: Researcher lift. Multiple long dwells suggest systematic evaluation.

**Streaming inspiration**: Netflix watch completion percentage. Partial completion (30–70%) is exploration; near-complete (>85%) is engagement; immediate exit (<10%) is rejection. Dwell time is the equivalent for a product card — it measures attention without requiring a click.

---

### 2b. Scroll Depth

**Signal**: `interact.scroll_depth`
**Source**: Client
**What it measures**: How far down a category page the shopper scrolled, as a percentage of page height. A shopper who scrolls to 90% read every product; one who stops at 30% may have found what they needed quickly or abandoned.

**How to capture**: Throttled scroll event listener on the category page. Emit at thresholds (25%, 50%, 75%, 100%) — emit each threshold at most once per page view to avoid flooding.

```typescript
// In category page (instrumentation pseudocode):
const emitted = new Set<number>();
const thresholds = [25, 50, 75, 100];

function onScroll() {
  const pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
  for (const t of thresholds) {
    if (pct >= t && !emitted.has(t)) {
      emitted.add(t);
      getEmitter()?.emit('interact.scroll_depth', { depth: t, category: currentCategory });
    }
  }
}
```

**Proposed InferenceContext addition**:

```typescript
maxScrollDepth: number;  // 0–100, highest threshold reached this session
```

**Proposed rule**:

```typescript
{
  name: 'deep-scroll-research',
  weight: 0.4,
  evaluate: (ctx) => {
    if (ctx.maxScrollDepth < 75) return null;
    // Scrolling through the full catalog = researcher or patient gatherer
    return { researcher: 0.15, gatherer: 0.1 };
  },
},
```

**Persona impact**: Mild researcher and gatherer lift for full-page scrollers.

**Streaming inspiration**: Spotify listening session depth — users who listen through a full playlist are different from users who skip after one song. Deep scroll maps to playlist completion.

---

### 2c. Sort and Filter Use

**Signal**: `interact.sort_change`, `interact.filter_use`
**Source**: Client
**What it measures**: A shopper who sorts by "Price: Low to High" is exhibiting hunter behavior. A shopper who filters by material, color, or style is exhibiting researcher or gatherer behavior.

**How to capture**: Event handlers on the sort dropdown and filter panel components. Emit on each change.

```typescript
// sort change:
getEmitter()?.emit('interact.sort_change', {
  sortField: 'price',
  sortDirection: 'asc',
  category: currentCategory,
});

// filter use:
getEmitter()?.emit('interact.filter_use', {
  filterField: 'material',
  filterValue: 'solid-wood',
  category: currentCategory,
});
```

**Proposed InferenceContext additions**:

```typescript
priceSortUsed: boolean;     // sorted by price (any direction)
filterCount: number;        // number of distinct filter interactions
filterFields: string[];     // which fields were filtered
```

**Proposed rules**:

```typescript
{
  name: 'price-sort-intent',
  weight: 0.7,
  evaluate: (ctx) => {
    if (!ctx.priceSortUsed) return null;
    return { hunter: 0.25, priceSensitivity: 0.2 };
  },
},
{
  name: 'filter-researcher-depth',
  weight: 0.6,
  evaluate: (ctx) => {
    if (ctx.filterCount < 2) return null;
    // Multiple filters = methodical evaluation
    return { researcher: 0.2 };
  },
},
```

**Streaming inspiration**: Netflix genre filter use. Users who actively filter the catalog (rather than accepting the curated default) are in research mode.

---

## Phase 3: Negative Signals

**Goal**: Capture signals that indicate what the shopper does NOT want. These are often more informative than positive signals because they reveal preference boundaries.

The core insight from Spotify's skip model: a skip in the first 10 seconds is a strong rejection signal. Aisles needs equivalent signals for its context.

**Effort**: Medium — new signal types, new emitter instrumentation, new rules. Requires careful threshold tuning to avoid false negatives.

### 3a. Bounce Detection

**Signal**: `nav.back`
**Source**: Client
**What it measures**: Navigating back to a category page from a product detail page quickly (< 8 seconds) suggests the PDP did not match the shopper's expectations. This is a Spotify skip.

**How to capture**: In the category page's `afterNavigate` hook, check if the navigation came from a PDP (`/product/[slug]`). If so, record the time since the `nav.product_view` event for that product. If elapsed < 8 seconds, emit `nav.back` with a `quickReturn: true` flag.

**Proposed InferenceContext addition**:

```typescript
quickReturnCount: number;  // number of fast PDP → category navigations
```

**Proposed rule**:

```typescript
{
  name: 'quick-bounce-rejection',
  weight: 0.6,
  evaluate: (ctx) => {
    if (ctx.quickReturnCount === 0) return null;
    // Multiple quick returns = shopper is filtering through options = hunter or researcher
    if (ctx.quickReturnCount >= 2) {
      return { hunter: 0.2, researcher: 0.15 };
    }
    return { hunter: 0.1 };
  },
},
```

**What it detects**: A shopper bouncing quickly through product pages is not browsing for inspiration (gatherer). They are evaluating and rejecting, which is hunter or researcher behavior.

**Streaming inspiration**: Netflix "still watching?" prompt data. Users who don't respond and let it time out are passively engaged; users who actively hit play are actively engaged. Quick returns from PDPs are passive-rejection signals.

---

### 3b. Cart Removal

**Signal**: Currently no signal type for cart removal. A new type `commerce.remove_from_cart` should be added to `SignalEventType` in `types.ts`.

**What it measures**: Removing an item from the cart is a strong negative signal. It suggests the shopper added something impulsively, then reconsidered — either because of price sensitivity, finding a better alternative, or gifting uncertainty.

**How to capture**: Cart management API calls already go through `POST /api/cart`. Add a listener on cart item deletion that emits the signal before or alongside the API call.

**Proposed InferenceContext addition**:

```typescript
cartRemovalCount: number;
```

**Proposed rule**:

```typescript
{
  name: 'cart-removal-reconsideration',
  weight: 0.7,
  evaluate: (ctx) => {
    if (ctx.cartRemovalCount === 0) return null;
    // Cart removal after cart add = price sensitivity or extended evaluation
    return { priceSensitivity: 0.3, researcher: 0.1 };
  },
},
```

**Streaming inspiration**: Spotify's "remove from playlist" action — treated as a strong negative preference signal, used to suppress similar content from future recommendations.

---

### 3c. Chat Abandonment

**Signal**: A new signal type `refine.abandon` should be added to `SignalEventType`.

**What it measures**: Opening the refinement chat panel and then closing it without sending a message suggests the shopper was uncertain enough to consider asking for help, but either found the answer elsewhere or abandoned the decision path.

**How to capture**: The refinement chat panel has open/close state. If it closes without a `refine.message` event having fired since it opened, emit `refine.abandon`.

**Proposed InferenceContext addition**:

```typescript
chatAbandonCount: number;
```

**Proposed rule**:

```typescript
{
  name: 'chat-abandon-uncertainty',
  weight: 0.4,
  evaluate: (ctx) => {
    if (ctx.chatAbandonCount === 0) return null;
    // Opening chat without asking = uncertainty, possible gifter (unsure what's right)
    return { gifter: 0.1, researcher: 0.1 };
  },
},
```

**What it detects**: Mild uncertainty signal. Not a strong discriminator on its own but adds evidence in ambiguous sessions.

---

## Phase 4: Full Probability Vector in Layout Prompts

**Goal**: Pass the complete `PersonaProbabilities` object to `buildLayoutPrompt()` instead of only the primary persona label. Enable the AI to produce blended layouts for sessions with low confidence.

**Effort**: Low — a prompt format change in `src/lib/server/layout-prompt.ts` and caller updates.

**Current call signature**:

```typescript
buildLayoutPrompt(
  persona: string,      // just 'hunter', 'gatherer', etc.
  categoryName: string,
  products: PromptProduct[],
  picksContext?: string,
  rulesContext?: string,
): string
```

**Proposed change**:

```typescript
buildLayoutPrompt(
  inference: { primary: Persona; probabilities: PersonaProbabilities; confidence: number },
  categoryName: string,
  products: PromptProduct[],
  picksContext?: string,
  rulesContext?: string,
): string
```

**Proposed prompt addition**:

When confidence is below 0.2, include probability percentages in the prompt and instruct the AI to blend:

```
PERSONA PROBABILITIES:
- gatherer: 48% (primary)
- hunter: 43% (close second)
- researcher: 6%
- gifter: 3%
CONFIDENCE: 0.05 (low — personas nearly tied)

INSTRUCTION: This shopper is between gatherer and hunter. Use an editorial header to set tone,
but keep the grid dense (3 columns) and show quick-add buttons. Do not use a hero product.
Show prices prominently. The layout should satisfy both a browser who might impulsively buy
and a goal-directed shopper who knows what they want.
```

When confidence is high (>= 0.3), the prompt remains unchanged — the primary persona fully governs the layout.

**Why this matters**: A session where `hunter: 0.51, gatherer: 0.49` currently generates an identical hunter layout to `hunter: 0.91, gatherer: 0.05`. The confidence-aware blending produces better outcomes for the large number of sessions that are genuinely ambiguous.

**Streaming inspiration**: Netflix's "comfort/discovery" axis. For users with ambiguous taste profiles, Netflix surfaces a mix of familiar genres (exploit) and recommended departures (explore) rather than fully committing to either. The blended layout is the Aisles equivalent.

---

## Phase 5: Session Arc Modeling

**Goal**: Track the persona trajectory across a full session (not just the current state) and use that trajectory to predict the terminal persona.

**Effort**: High — requires storing inference snapshots in the session store, adding trajectory analysis to the inference engine, and designing an arc classification model.

### What Session Arc Means

Current model: the inference engine runs once per request (or once per signal flush). Each run produces the best inference from all accumulated signals. The result at any point in the session is a snapshot.

Session arc model: track the sequence of `primary` persona labels over the session. A session that follows `gatherer → gatherer → researcher → researcher → hunter` has a clear trajectory. The endpoint prediction (the shopper will convert as a hunter) is more actionable than the current-state `researcher` that the engine would return at point 4 of 5.

### Signal to Capture

No new signal type needed. After each `infer()` call, store a lightweight snapshot in the session Redis key:

```typescript
interface PersonaSnapshot {
  timestamp: number;
  primary: Persona;
  confidence: number;
  signalCount: number;
}

// Added to session Redis structure:
personaHistory: PersonaSnapshot[];
```

### Arc Classification

A simple trajectory classifier over the history:

- **Stable**: all snapshots agree → confidence is high → use primary as-is
- **Converging**: snapshots move toward a single persona over time → predict the destination
- **Oscillating**: snapshots alternate between two personas → use blended layout (Phase 4)
- **Late shift**: the session's last snapshot differs from all earlier ones (a dramatic intent change) → report as a shift event, use the terminal persona

### Layout Implication

Pass the arc type as additional context to `buildLayoutPrompt()`. A "converging toward hunter" session that is currently showing `researcher` probabilities should produce a layout that anticipates the hunter endpoint — denser grid, quick-add available, price prominent — even though the current snapshot is researcher.

**Streaming inspiration**: Hulu's session-aware recommendation model. Hulu distinguishes between sessions where the user is "grazing" (flipping through episodes) vs. "committing" (starting a series). The grazing session gets variety recommendations; the committing session gets "next episode" and series depth. Session arc classification serves the same purpose — adapting to the momentum of the session, not just its current state.

---

## Implementation Order and Dependencies

| Phase | Dependencies | Blocking |
|---|---|---|
| 1a: Category sequence | No new emitter code | None |
| 1b: Cart add rule | No new emitter code | None |
| 1c: Search integration test | Existing code | None |
| 2a: Dwell time | ProductCard instrumentation | None |
| 2b: Scroll depth | Category page instrumentation | None |
| 2c: Sort/filter | Sort and filter component hooks | None |
| 3a: Bounce detection | `nav.product_view` must be emitted first | 2a or standalone PDP observer |
| 3b: Cart removal | New signal type in `types.ts`, cart UI hook | None |
| 3c: Chat abandon | New signal type in `types.ts`, chat panel hook | None |
| 4: Full probability vector | `buildLayoutPrompt` signature change | All callers must be updated |
| 5: Session arc | Phases 1–3 producing stable signal history | Redis schema change for `personaHistory` |

Phases 1a and 1b are the highest-value lowest-effort items. They require only inference rule additions and `InferenceContext` field additions — no new UI instrumentation, no new signal types, no schema changes.

---

## What Not to Build

The following ideas were considered and set aside:

**Mouse tracking / heatmaps**: Captures too much noise. The inference engine should respond to intent signals, not cursor positions. Dwell time via IntersectionObserver is a proxy that captures engagement without the instrumentation overhead.

**Explicit persona declaration** ("Tell us what you're looking for"): Contradicts the product philosophy of invisible personalization. Declared preferences are less reliable than behavioral signals. See `docs/product-vision.md`.

**Per-product refinement message analysis**: Analyzing refinement message text to extract product preferences is possible but belongs to a separate enrichment/recommendation layer, not to the session inference engine.

---

## Related Documentation

- `docs/signals-and-inference.md` — current signal and rule catalog
- `docs/product-vision.md` — streaming platform inspiration, competitive context
- `src/lib/signals/types.ts` — signal type definitions
- `src/lib/signals/inference.ts` — rule implementations
- `src/lib/signals/store.ts` — `toInferenceContext()` (the bottleneck to update)
- `src/lib/server/layout-prompt.ts` — layout prompt construction (Phase 4 target)
