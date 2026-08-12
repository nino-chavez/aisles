# Aisles — Signals and Inference

**Version**: 0.3.0
**Last Updated**: 2026-08-12
**Audience**: Developers

## Overview

The Aisles persona inference system is a continuous signal stream → probability vector pipeline. It reads server-side request data and client-side behavioral events, evaluates weighted rules against the accumulated context, and produces a `PersonaInference` object that drives layout generation.

This document covers all typed signal families, their inference rules, the `InferenceContext` field reference, the probability vector, modifier system, shift detection, and rule attribution.

---

## The Four Personas

Everything in the inference engine maps to four shopper archetypes. All types are defined in `src/lib/signals/types.ts`.

| Persona | Description |
|---|---|
| `gatherer` | Exploratory, inspiration-driven. Browsing aesthetics and editorial content. Not ready to buy — wants to discover. |
| `hunter` | Goal-oriented, efficiency-driven. Knows what they need, wants the specs and price fast. |
| `researcher` | Methodical, evidence-driven. Comparing options systematically. Wants data, not stories. |
| `gifter` | Shopping for someone else. Needs curation, universal appeal, and safe price points. |

The `PersonaProbabilities` type is always a normalized distribution summing to 1.0:

```typescript
interface PersonaProbabilities {
  gatherer: number;
  hunter: number;
  researcher: number;
  gifter: number;
}
```

---

## Signal Types

Signals are typed events with a fixed schema. Each event has a `type`, a `source`, a `data` payload, and a `context` (current page, category, viewport).

```typescript
type SignalEventType =
  // Request signals — server-side, emitted on every page load
  | 'request.pageview'
  | 'request.device'
  | 'request.geo'
  | 'request.search_landing'
  | 'request.returning'
  // Navigation signals — client-side
  | 'nav.category_view'
  | 'nav.product_view'
  | 'nav.search'
  | 'nav.back'
  // Interaction signals — client-side
  | 'interact.scroll_depth'
  | 'interact.dwell_time'
  | 'interact.filter_use'
  | 'interact.sort_change'
  // Commerce signals — client-side
  | 'commerce.add_to_cart'
  | 'commerce.remove_from_cart'
  | 'commerce.autoship_mix'
  // Subscription signals — Kibble only
  | 'subscription.cadence_selected'
  | 'subscription.skip'
  | 'subscription.swap'
  | 'subscription.pause'
  | 'subscription.due_proximity'
  | 'subscription.tenure'
  // Refinement signals — client-side
  | 'refine.message';
```

### Signal Status

| Signal Type | Source | What It Captures | Inference Status |
|---|---|---|---|
| `request.pageview` | Server | Referrer, UTM params, intent param | **Consumed** — feeds referrer, UTM, and intent rules |
| `request.device` | Server | User-agent → device type | **Consumed** — feeds device+time rules |
| `request.geo` | Server | Visitor geography | **Not emitted, not consumed** |
| `request.search_landing` | Server | `?q=` query string on landing | **Consumed** — feeds search keyword rules |
| `request.returning` | Server | Previous persona, previous category, visit count | **Consumed** — visitCount and storedPersona/Category feed cross-session rules |
| `nav.category_view` | Client | Category entered | **Consumed** — updates `categoryViewCount` and `uniqueCategoriesViewed` |
| `nav.product_view` | Client | Product detail page viewed | **Consumed** — increments `productViewCount` |
| `nav.search` | Client | Search query from in-page search | **Consumed** — updates `searchQuery`, increments `searchCount` |
| `nav.back` | Client | Browser back-navigation | **Consumed** — increments `backNavigationCount` |
| `interact.scroll_depth` | Client | Deepest scroll % on any category page | **Consumed** — updates `maxScrollDepth` |
| `interact.dwell_time` | Client | Time spent on product pages (ms) | **Consumed** — feeds `avgDwellTimeMs`, `longDwellCount`, `quickBounceCount` |
| `interact.filter_use` | Client | Filter panel interactions | **Not consumed** — no rule reads this yet |
| `interact.sort_change` | Client | Sort order changes | **Not consumed** — no rule reads this yet |
| `commerce.add_to_cart` | Client | Product added to cart | **Consumed** — increments `cartAddCount` |
| `commerce.remove_from_cart` | Client | Product removed from cart | **Consumed** — increments `cartRemovalCount` |
| `commerce.autoship_mix` | Commerce | Share of cart on Auto-Refill, `0..1` | **Consumed for Kibble only** — adds store familiarity, not a fifth persona |
| `subscription.cadence_selected` | Interaction | Selected cadence, `months: 1 \| 2 \| 3` | **Consumed for Kibble only** |
| `subscription.skip` | Interaction | Shipment skip action | **Consumed for Kibble only** |
| `subscription.swap` | Interaction | Subscription product swap action | **Consumed for Kibble only** |
| `subscription.pause` | Interaction | Subscription pause action | **Consumed for Kibble only** |
| `subscription.due_proximity` | External | Days to next shipment, `days >= 0` | **Consumed for Kibble only** |
| `subscription.tenure` | External | Months subscribed, `months >= 0` | **Consumed for Kibble only** |
| `refine.message` | Client | Refinement chat message sent | **Consumed** — increments `refineMessageCount` |

---

## Signal Collection Architecture

### Server-Side: `request.ts`

`src/lib/signals/request.ts` runs on every SvelteKit server load. It:

1. Reads or creates the `aisles_session` cookie (UUID, 30-day TTL)
2. Retrieves or creates the session's `SignalStore` from Redis (via `getSessionStore`)
3. Reads cross-session cookies: `aisles_persona`, `aisles_last_category`, `aisles_visits`
4. Emits `request.pageview`, `request.device`, and (conditionally) `request.search_landing` and `request.returning`
5. Persists the updated store back to Redis

### Client-Side: `emitter.ts`

`src/lib/signals/emitter.ts` runs in the browser after page load. `SignalEmitter`:

- Buffers events in memory
- Flushes to `POST /api/signals` every 5 seconds
- Flushes immediately for high-priority events: `commerce.add_to_cart`, `commerce.remove_from_cart`, `refine.message`, `nav.search`
- On a successful flush, receives the updated `PersonaInference` in the response body and dispatches an `aisles-inference-update` CustomEvent

### The Store: `store.ts`

`SignalStore` is the session-scoped event buffer. It accumulates `SignalEvent` objects from both server-side and client-side sources. `toInferenceContext()` is the bridge to the inference engine — it loops over all accumulated events and computes every field the rules consume.

Key computations in `toInferenceContext()`:

- `categoryViewCount` / `uniqueCategoriesViewed` — incremented on every `nav.category_view`
- `productViewCount` — incremented on every `nav.product_view`
- `cartAddCount` — incremented on every `commerce.add_to_cart`
- `searchCount` — incremented on `request.search_landing` and `nav.search`
- `refineMessageCount` — incremented on every `refine.message`
- `backNavigationCount` — incremented on every `nav.back`
- `maxScrollDepth` — rolling maximum across all `interact.scroll_depth` events
- `avgDwellTimeMs` — mean of all `interact.dwell_time` values
- `longDwellCount` — count of dwell events >= 15000 ms
- `quickBounceCount` — count of dwell events < 3000 ms
- `cartRemovalCount` — incremented on every `commerce.remove_from_cart`

### Kibble subscription path and producer boundary

The implemented path is intentionally short and real:

```text
storefront control (interaction) or authenticated subscription API (external)
  -> SignalEmitter.emit(...) or POST /api/signals with that provenance
  -> SignalStore.emit(...) -> toInferenceContext()
  -> infer() Kibble-gated rule -> PersonaInference
```

`POST /api/signals` already stores typed client events for an existing
`aisles_session`; the subscription event types use that same route. Server-side
request loads and `POST /api/signals` both set the session's `brandId` from
`BRAND_ID`; the API assignment is authoritative and upgrades legacy Redis
snapshots that predate this field. The value is persisted so events remain
brand-gated between requests.

The route rejects a subscription control with any source other than
`interaction`, and rejects `subscription.due_proximity` or
`subscription.tenure` unless their source is `external`. `SignalEmitter` also
rejects those provider-derived event types in the browser.

There is **no subscription-control UI or provider webhook in this repository
today**. The public route rejects `external` events, so provider facts need a
future server-only authenticated producer. The included named demo fixtures are
explicitly marked synthetic in the session, logs, outcomes, and Observe screen;
fitting and calibration queries exclude them by default.

For local demos, `POST /api/observe/scenarios?key=aisles-observe` accepts one
of the named scenario IDs and replaces that deterministic session. This fixed
Observe key is demo-only routing protection, **not production authentication**;
the route is limited to the Kibble brand and must not be exposed as an operator
or provider integration endpoint.

---

## InferenceContext Field Reference

`InferenceContext` is the struct passed to every rule's `evaluate` function. It is populated exclusively by `SignalStore.toInferenceContext()`.

### Request-time fields

| Field | Type | Source | Description |
|---|---|---|---|
| `intentParam` | `string \| null` | `request.pageview` | Value of `?intent=` URL parameter |
| `searchQuery` | `string \| null` | `request.search_landing`, `nav.search` | Most recent search query |
| `referrer` | `string \| null` | `request.pageview` | HTTP Referer header |
| `utmSource` | `string \| null` | `request.pageview` | `utm_source` query param |
| `utmMedium` | `string \| null` | `request.pageview` | `utm_medium` query param |
| `utmCampaign` | `string \| null` | `request.pageview` | `utm_campaign` query param |
| `deviceType` | `'mobile' \| 'tablet' \| 'desktop'` | `request.device` | Parsed from User-Agent |
| `hourOfDay` | `number` (0–23) | Derived from most recent event timestamp | Local hour at time of most recent event |
| `dayOfWeek` | `number` (0–6) | Derived from most recent event timestamp | 0 = Sunday |

### Cross-session fields (from cookies)

| Field | Type | Description |
|---|---|---|
| `storedPersona` | `Persona \| null` | Persona inferred in the shopper's previous session |
| `storedCategory` | `string \| null` | Category last visited in the previous session |
| `visitCount` | `number` | Number of sessions this cookie has seen |
| `currentCategory` | `string` | Current category (updated as `nav.category_view` events arrive) |

### Behavioral fields (accumulated in-session)

| Field | Type | Threshold / Notes |
|---|---|---|
| `categoryViewCount` | `number` | Total `nav.category_view` events (includes revisits to same category) |
| `uniqueCategoriesViewed` | `string[]` | Deduplicated list of categories visited this session |
| `productViewCount` | `number` | Total `nav.product_view` events |
| `cartAddCount` | `number` | Total `commerce.add_to_cart` events |
| `searchCount` | `number` | Total searches (landing + in-session) |
| `refineMessageCount` | `number` | Total `refine.message` events |
| `backNavigationCount` | `number` | Total `nav.back` events |
| `maxScrollDepth` | `number` (0–100) | Deepest scroll percentage on any category page this session |
| `avgDwellTimeMs` | `number` | Mean of all `interact.dwell_time` values; 0 if no dwell events |
| `longDwellCount` | `number` | Count of dwell events >= 15,000 ms |
| `quickBounceCount` | `number` | Count of dwell events < 3,000 ms |
| `cartRemovalCount` | `number` | Total `commerce.remove_from_cart` events |
| `selectedCadenceMonths` | `1 \| 2 \| 3 \| null` | Latest valid `subscription.cadence_selected.data.months` |
| `subscriptionSkipCount` | `number` | Total `subscription.skip` events |
| `subscriptionSwapCount` | `number` | Total `subscription.swap` events |
| `subscriptionPauseCount` | `number` | Total `subscription.pause` events |
| `dueProximityDays` | `number \| null` | Latest valid non-negative `subscription.due_proximity.data.days` |
| `subscriptionTenureMonths` | `number \| null` | Latest valid non-negative `subscription.tenure.data.months` |
| `autoshipMix` | `number \| null` | Latest valid `commerce.autoship_mix.data.mix`, bounded `0..1` |

---

## Inference Rules

All rules are defined in `src/lib/signals/inference.ts`. Each rule has a `name`, a `weight` (confidence multiplier, 0.0–1.0), and an `evaluate` function that takes an `InferenceContext` and returns a `PersonaScoreAdjustment | null`.

A `PersonaScoreAdjustment` can contain any combination of:
- Persona score boosts (`gatherer`, `hunter`, `researcher`, `gifter`)
- Modifier adjustments (`priceSensitivity`, `urgency`, `familiarityWithStore`)

### Base Prior

The engine computes a Bayesian posterior:

```
log P(persona | signals) = log P(persona) + Σ log P(signal_i | persona) + C
```

where each rule's `weight × adjustment` contributes a log-likelihood-ratio for the named persona(s), and the persona-independent evidence term `C` cancels under softmax normalization at the end. The cold-start prior is:

```typescript
const BASE_PRIOR: PersonaProbabilities = {
  gatherer: 0.375,
  hunter: 0.25,
  researcher: 0.25,
  gifter: 0.125,
};
```

The prior leans toward gatherer because the exploratory layout is a safer default than efficiency-first for an unknown shopper.

Two calibration constants account for the fact that current rule weights are hand-tuned rather than empirically fitted:

- `PRIOR_STRENGTH = 0.3` damps `log(BASE_PRIOR)` so a single strong behavioral rule can still overturn the prior. Without this, log-prior gaps (≈0.4 nats between adjacent personas) would dominate most rule magnitudes (≈0.1–0.4).
- `TEMPERATURE = 0.5` sharpens the softmax so the posterior is as decisive as the old linear-additive normalization was.

Both move to 1.0 once session outcomes are logged and real likelihood ratios are fit from data.

### Request-Time Rules (15)

These rules fire from signals available at the moment the first server-side inference runs.

| Rule Name | Weight | Signals Used | Condition | Output |
|---|---|---|---|---|
| `intent-param` | 1.0 | `intentParam` | `?intent=` equals a valid persona name | `+0.8` to named persona |
| `search-hunter-keywords` | 0.9 | `searchQuery` | Query matches `cheap\|budget\|deal\|dorm\|under \$\|affordable\|sale\|discount\|clearance` | `+0.4 hunter`, `+0.5 priceSensitivity` |
| `search-researcher-keywords` | 0.9 | `searchQuery` | Query matches `review\|compare\|spec\|vs\b\|rating\|best\|versus\|dimension\|material` | `+0.4 researcher` |
| `search-gifter-keywords` | 0.9 | `searchQuery` | Query matches `gift\|birthday\|anniversary\|present\|for him\|for her\|housewarming\|wedding` | `+0.5 gifter` |
| `search-gatherer-keywords` | 0.8 | `searchQuery` | Query matches `browse\|explore\|inspiration\|ideas\|modern\|style\|aesthetic\|cozy` | `+0.3 gatherer` |
| `referrer-social` | 0.7 | `referrer` | Referrer matches `pinterest\|instagram\|houzz` | `+0.3 gatherer` |
| `referrer-deal-site` | 0.7 | `referrer` | Referrer matches `slickdeals\|retailmenot\|honey\|google.com/shopping` | `+0.3 hunter`, `+0.3 priceSensitivity` |
| `referrer-review-site` | 0.7 | `referrer` | Referrer matches `wirecutter\|consumerreports\|reddit` | `+0.3 researcher` |
| `utm-gift-campaign` | 0.8 | `utmCampaign`, `utmSource` | Campaign matches `gift\|holiday\|mother\|father\|wedding` | `+0.4 gifter` |
| `utm-sale-campaign` | 0.7 | `utmCampaign` | Campaign matches `sale\|clearance\|deal\|promo` | `+0.2 hunter`, `+0.3 priceSensitivity` |
| `mobile-evening-impulse` | 0.5 | `deviceType`, `hourOfDay` | Mobile, hour >= 20 or <= 5 | `+0.1 hunter`, `+0.2 urgency` |
| `desktop-weekday-deliberate` | 0.4 | `deviceType`, `dayOfWeek`, `hourOfDay` | Desktop, Mon–Fri, 9:00–17:00 | `+0.1 researcher` |
| `returning-same-category` | 0.7 | `storedPersona`, `storedCategory`, `currentCategory` | Returning visitor, same category as last session | `+0.3` to stored persona, `+0.2 familiarityWithStore` |
| `returning-different-category` | 0.5 | `storedPersona`, `storedCategory`, `currentCategory` | Returning visitor, different category than last session | `+0.1` to stored persona, `+0.1 familiarityWithStore` |
| `repeat-visitor-familiarity` | 0.5 | `visitCount` | `visitCount > 1` | `+familiarityWithStore` scaled by `min(visitCount / 10, 1.0) * 0.3` |

### Behavioral Rules (10)

These rules fire from signals accumulated during the current session. They become available as the client-side emitter flushes events and the server re-runs inference.

| Rule Name | Weight | Signals Used | Condition | Output |
|---|---|---|---|---|
| `broad-category-browsing` | 0.6 | `uniqueCategoriesViewed` | 3+ distinct categories visited | `+0.3 gatherer` |
| `rapid-cart-adds` | 0.7 | `cartAddCount` | 2+ items added to cart | `+0.3 hunter`, `+0.2 urgency` |
| `comparison-browsing` | 0.6 | `backNavigationCount` | 2+ back-navigations (grid → product → grid) | `+0.3 researcher` |
| `in-session-search` | 0.6 | `searchCount` | 2+ searches in this session | `+0.15 hunter`, `+0.15 researcher` |
| `deep-product-exploration` | 0.5 | `productViewCount` | 4+ product detail pages viewed | `+0.25 researcher` |
| `refinement-chat-engaged` | 0.6 | `refineMessageCount` | Any messages sent; 3+ triggers higher adjustment | `+0.2 researcher, +0.1 priceSensitivity` (if >= 3 messages); `+0.1 hunter` (if 1–2 messages) |
| `deep-scroll-exploration` | 0.5 | `maxScrollDepth` | `maxScrollDepth >= 75` | `+0.15 gatherer`, `+0.15 researcher` |
| `long-product-dwell` | 0.6 | `longDwellCount` | Any product pages with 15s+ dwell time | `+0.25 researcher` |
| `quick-product-scanning` | 0.5 | `productViewCount`, `avgDwellTimeMs` | 3+ product views, average dwell < 8 seconds | `+0.2 hunter`, `+0.1 urgency` |
| `single-category-focus` | 0.5 | `categoryViewCount`, `uniqueCategoriesViewed` | 3+ category views but all in the same category | `+0.2 hunter` |

### Negative Rules (2)

Negative rules detect behaviors that disconfirm a persona. They act as corrective signals — the Spotify-skip equivalent of the inference system.

| Rule Name | Weight | Signals Used | Condition | Output |
|---|---|---|---|---|
| `quick-bounce-pattern` | 0.6 | `quickBounceCount` | 2+ product pages with < 3s dwell time | `+0.2 gatherer` (reduces hunter confidence relatively) |
| `cart-removal-indecision` | 0.7 | `cartRemovalCount` | Any items removed from cart | `+0.2 researcher`, `+0.15 priceSensitivity` |

---

### Kibble subscription rules

These hand-tuned rules run only when the persisted session `brandId` is
`kibble`. They preserve the existing four personas. In particular, Auto-Refill
is evidence of familiarity with the store, not proof that a shopper is a
Haven-style `hunter`. The mappings need calibration from real Kibble outcomes
before their weights should be treated as behavioral facts.

| Rule | Event/context | Condition | Output |
|---|---|---|---|
| `kibble-subscription-cadence-selected` | `selectedCadenceMonths` | Cadence is 1, 2, or 3 months | Modest `hunter` + familiarity; 1 month also adds urgency |
| `kibble-subscription-skip` | `subscriptionSkipCount` | At least one skip | `researcher`, price sensitivity, familiarity |
| `kibble-subscription-swap` | `subscriptionSwapCount` | At least one swap | `researcher`, familiarity |
| `kibble-subscription-pause` | `subscriptionPauseCount` | At least one pause | `researcher`, price sensitivity, familiarity |
| `kibble-subscription-due-proximity` | `dueProximityDays` | Shipment is due within 7 days | `hunter`, urgency, familiarity; stronger within 3 days |
| `kibble-subscription-tenure` | `subscriptionTenureMonths` | At least one month subscribed | Familiarity scaled to a 12-month cap |
| `kibble-commerce-autoship-mix` | `autoshipMix` | Any Auto-Refill share in the cart | Familiarity scaled by the `0..1` mix |

No Kibble subscription rule fires for Haven, Volt, Ember, or another brand.

---

## Posterior Computation

The engine runs every rule against the current `InferenceContext`. For each rule that returns a non-null adjustment:

1. Each persona's `adjustment × rule.weight` is added to the running **log-posterior** for that persona.
2. Each modifier value (if any) is multiplied by `rule.weight` and clamped to `[0, 1]`.
3. A `RuleMatch` entry is appended to `ruleMatches` with a human-readable reason from `describeRuleMatch()`.

After all rules are evaluated, the log-posterior is converted to a probability distribution via temperature-scaled softmax:

```typescript
// logPosterior[p] = log(BASE_PRIOR[p]) * PRIOR_STRENGTH + Σ rule.weight * adj[p]
const probabilities = softmax(logPosterior, TEMPERATURE);
```

Since softmax is monotone in its input, the relative ordering of personas only depends on differences in the log-posterior — absolute magnitudes do not matter. A single high-weight rule (e.g., `intent-param` at weight 1.0 adding +0.8 log-LR to hunter) will dominate a cold-start session; multiple lower-weight rules can collectively overcome a single strong signal by additive accumulation in log-space.

---

## The `PersonaInference` Output

The `infer()` function returns:

```typescript
interface PersonaInference {
  probabilities: PersonaProbabilities; // Normalized, sums to 1.0
  primary: Persona;                    // Highest probability persona
  confidence: number;                  // Gap: primary.prob - second.prob
  modifiers: PersonaModifiers;
  shift: PersonaShift;
  signalCount: number;                 // How many rules fired
  lastUpdated: number;                 // Unix ms timestamp
  dominantSource: SignalSource;
  ruleMatches: RuleMatch[];            // Which rules fired and why
}
```

### Confidence

Confidence is the probability gap between the primary persona and the runner-up. A confidence of 0.30 means the primary is 30 percentage points ahead of second place. Below 0.10, shift detection will not flag a change even if the primary differs from the stored persona.

### Modifiers

```typescript
interface PersonaModifiers {
  priceSensitivity: number;     // 0 = indifferent to price, 1 = very budget-driven
  urgency: number;              // 0 = browsing, 1 = buying now
  familiarityWithStore: number; // 0 = first visit, 1 = loyal returning customer
}
```

Modifiers are computed alongside persona scores but are not part of the normalization. They appear in the Observe dashboard's gauge row.

### Shift Detection

If the current session has a `storedPersona` (from the `aisles_persona` cookie) and the newly inferred `primary` differs from it, and the confidence gap is >= 0.10, a shift is detected:

```typescript
interface PersonaShift {
  detected: boolean;
  from: Persona | null;  // The stored persona
  trigger: string | null; // Human-readable cause
}
```

The trigger description is derived from whichever signal caused the shift: search query, intent param, UTM campaign, or referrer.

### Rule Attribution

Every `PersonaInference` includes a `ruleMatches` array documenting which rules fired:

```typescript
interface RuleMatch {
  ruleName: string;
  weight: number;
  adjustment: PersonaScoreAdjustment;
  reason: string; // e.g. 'Search "dorm desk" matches deal/budget keywords'
}
```

The `reason` string is generated by `describeRuleMatch()` in `inference.ts`, which produces human-readable descriptions for every rule name. This is the primary tool for debugging inference behavior. The Observe dashboard's signal timeline surfaces these matches, and the `/observe` endpoint exposes them directly.

---

## How Inference Feeds Layout Generation

`buildLayoutPrompt()` in `src/lib/server/layout-prompt.ts` receives both the `primary` persona label and the full `PersonaProbabilities` vector:

```typescript
buildLayoutPrompt(
  inference.primary,       // e.g. 'hunter'
  categoryName,
  products,
  picksContext,
  rulesContext,
  inference.probabilities, // Full vector passed to the AI
)
```

The prompt template includes the probability vector when present:

```
PROBABILITY VECTOR: gatherer 12% | hunter 61% | researcher 22% | gifter 5%
The primary persona is hunter, but blend in elements from secondary personas
if their score is above 25%.
```

This allows the AI to blend layout styles for ambiguous sessions. A session where `hunter: 0.51, researcher: 0.49` will produce a different layout than one where `hunter: 0.90, researcher: 0.05`, even though both have `hunter` as the primary persona.

---

## Known Limitations

### Signal independence is violated

The posterior computation assumes each rule's evidence is conditionally independent given the persona — the naive-Bayes assumption. In Aisles' signals, several pairs are correlated:

| Correlated pair | Why they correlate |
|---|---|
| `interact.scroll_depth` × `interact.dwell_time` | Long dwell usually coincides with deep scroll (reading) |
| `referrer` × `utm_source` | Campaign links carry both the referrer and UTM params |
| `request.search_landing` × `intent_param` | Campaigns that set `?intent=X` often also set `?q=Y` |
| `rapid-cart-adds` × `quick-product-scanning` | A hunter who adds fast also dwells briefly |
| `deep-product-exploration` × `long-product-dwell` | Both are measures of "reading carefully" |

**Consequence**: naive Bayes double-counts the evidence from correlated signals, so posteriors are overconfident — they assign more probability mass to the winning persona than the true P(persona | signals) would warrant.

**Accepted mitigation**: the `TEMPERATURE = 0.5` sharpening in `infer()` is working in the opposite direction (making the posterior *more* decisive), and once empirical likelihood ratios are fit from real outcomes (`scripts/fit-inference-lrs.ts`), the learned values will partially correct for correlation by measuring actual co-occurrence rather than assumed independence. This is a known trade-off, not a bug.

**Not fixing**: explicit dependency modeling (factor graphs, TAN Bayes, etc.) is overkill for the current rule set. Revisit only if calibration checks show >15% systematic overconfidence that empirical LRs can't correct.

### Labels are biased

The LR fitting pipeline only uses high-confidence labeled sessions (explicit intent-param, confident conversion, strong single-persona behavior). Unlabeled sessions — the majority — don't contribute. Learned LRs are therefore calibrated against the *labelable* distribution, not the full visitor distribution. Expect better accuracy on sessions that look like explicit intent-param sessions and worse accuracy on ambiguous mid-funnel visitors.

### Sequential updates recompute from scratch

`infer()` is called fresh on every signal flush and rebuilds the full log-posterior from the stored event log. This is correct but not optimal — a true sequential Bayesian update would only process new events since the last inference. Optimization deferred; not a correctness issue.

---

## Related Documentation

- `src/lib/signals/types.ts` — all type definitions
- `src/lib/signals/inference.ts` — rule implementations and `infer()` function
- `src/lib/signals/store.ts` — `SignalStore` and `toInferenceContext()`
- `src/lib/signals/emitter.ts` — client-side signal emission
- `src/lib/signals/request.ts` — server-side signal extraction
- `src/lib/server/layout-prompt.ts` — how inference output feeds layout generation
- `docs/architecture.md` — system-level data flow
- `docs/observe.md` — how to observe inference in real time
- `docs/development.md` — debugging inference during development
