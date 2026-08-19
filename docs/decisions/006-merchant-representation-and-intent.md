# Decision Record: Merchant Representation and Shopper Intent

**Date:** 2026-08-14  
**Status:** Accepted  
**Context:** Kibble commerce parity, bounded presentation AI, and Auto-Refill

## Question

Is the current merchant representation rich enough for Aisles to express
subscription commerce and shopper intent without making the model responsible
for facts it does not own?

## Decision

Keep five contracts separate and join them on the server:

1. **Merchant product facts** come from BigCommerce. Identity, variants,
   category, price, inventory, media, and options remain provider-owned.
2. **Merchandising relationships** are explicit, typed, and provenance-bearing.
   A bundle component is not automatically a complement. A category sibling is
   not automatically a related product.
3. **Repeat-purchase offers** are provider-confirmed records. Eligibility,
   plan ID, cadence, price, savings, and constraints do not come from
   `subscriptionFit` or a model response.
4. **Shopper state** belongs to Aisles. Persona remains a descriptive layer;
   repeat purchase, comparison, decision, hesitation, and support need are
   orthogonal decision states.
5. **Presentation decisions** may rank or select only from a server-approved
   candidate set inside a named zone. They may not create a relationship,
   claim subscription eligibility, or change commerce state.

The current four-persona taxonomy stays in place. A shopper reordering a known
item is not a new personality. It is a repeat-purchase state that can coexist
with a persona.

## Why this decision changed

The Surf & Turf PDP showed `AI zones 0` because BigCommerce returned no related
products. The bundle had four contents, but those contents came from a separate
reference manifest. Treating them as related products would have repaired the
counter by changing the meaning of the data.

The tactical resolver in PR #18 makes a sparse PDP usable by preferring native
related products and then filling from category products. That is acceptable as
a bounded candidate-set fallback. It must carry its source as
`native_related` or `category_sibling`; the UI and model contract must not call
both sources merchant-authored relationships.

## Target representation

```text
BigCommerce facts ───────┐
                          ├─> Merchant catalog projection
Merchant relations ──────┤       ├─ products and variants
                          │       ├─ relation edges + provenance
Subscription service ────┘       └─ repeat-purchase offers

Aisles session evidence ───────> Shopper decision state

Merchant candidate set + shopper state + zone policy
  └─> bounded presentation decision
```

The minimum server-owned shapes are:

```ts
type MerchandisingRelation = {
  fromProductId: string;
  toProductId: string;
  kind: 'related' | 'complement' | 'substitute' | 'bundle_component' | 'replenishment_peer';
  source: 'merchant' | 'bigcommerce' | 'subscription_service' | 'approved_derived';
  sourceVersion: string;
};

type RepeatPurchaseOffer = {
  productId: string;
  variantId: string | null;
  eligible: boolean;
  providerPlanId: string | null;
  cadenceMonths: number[];
  recurringPrice: number | null;
  savings: { kind: 'percent' | 'amount'; value: number } | null;
  source: 'subscription_service';
  confirmedAt: string;
};

type ShopperDecisionState = {
  persona: 'gatherer' | 'hunter' | 'researcher' | 'gifter';
  stage: 'discover' | 'compare' | 'decide' | 'repeat' | 'support';
  urgency: number;
  priceSensitivity: number;
  familiarity: number;
  evidenceVersion: string;
};
```

These are contracts, not permission to invent provider fields. The exact
provider schemas and source versions remain implementation decisions in the
commerce parity plan.

## Work Library cross-check: what to fold into Aisles

The Work Library's pinned Aisles Competitive Position assessment (source
revision `23ec6ca446e6269035bf0b7c90e78477b9c87d25`) changes the scope in four
ways. It treats the inference taxonomy as commercially legible but not
differentiating, and identifies the missing merchant outcome apparatus as the
larger product gap. The assessment's Behamics figures are vendor-reported; this
decision uses its structural comparison and measurement design, not its uplift
claims as an Aisles forecast.

| Finding from the assessment | Aisles implication | Fold into |
| --- | --- | --- |
| Behamics and Aisles expose similar intent states. | More persona labels are not the next moat. Keep persona as a useful input, not the product boundary. | Intent contract |
| Signal meaning inverted across retail categories in the offline calibration. | A rule and signal need merchant/category scope, calibration version, and a safe cold-start fallback. | Signal provenance and rollout gates |
| Behamics measures randomized-control or holdout lift; Aisles explains why a layout changed. | Observe must gain experiment assignment and merchant outcome reporting before adaptive commerce can be called valuable. | Observability and release gates |
| Behamics includes hesitation and support-needs states in its decision vocabulary. | Add actionable compare, hesitation, and support signals, but model them as decision stages rather than another persona. | Signal backlog after provider integration |

The first three are immediate architecture requirements. The fourth is a
calibrated functionality backlog, not permission to collect more behavioral
data without a merchant use case.

## Signals and functionality to add

### Add before expanding AI zones

- Candidate-set provenance: native relation, merchant curation, provider
  relation, or approved category fallback.
- Relation kind: related, complement, substitute, bundle component, or
  replenishment peer.
- Merchant/category calibration version on every inference decision.
- A provider-backed repeat-purchase read model with eligibility, plan, cadence,
  price, savings, and constraints.
- An experiment assignment that persists for the session and customer-safe
  cohort, plus baseline and adaptive outcome joins.

### Add when the provider-backed commerce path exists

- Repeat-state signals: known item reopened, prior order due, cadence selected,
  skip, swap, pause, failed renewal, and confirmed subscription state.
- Compare and hesitation signals: repeated product comparison, option changes,
  price or ingredient inspection, return-to-product loops, promotion lookup,
  and checkout recovery.
- Support-state signals: help, shipping, returns, order-status, payment-failure,
  and delivery-delay requests. Provider-authenticated facts must remain outside
  the anonymous signal cookie.

Each signal needs an owner, a schema, a retention rule, an actionable consumer,
and a falsifiable success measure. A signal that only makes the Observe panel
more interesting does not belong in the product.

## Explicit non-decisions

- Do not add a fifth persona solely to represent subscribers.
- Do not infer subscription eligibility, savings, or cadence from product copy,
  `subscriptionFit`, category membership, or model output.
- Do not call category siblings “related products” without retaining their
  candidate source and relation kind.
- Do not build a shared inference platform or custom recommender because
  Behamics has a comparable intent vocabulary.
- Do not treat an Observe explanation as evidence of incremental merchant value.

## Acceptance tests

1. A bundle with no related relationship remains a bundle; bundle contents do
   not silently become recommendation edges.
2. A PDP candidate set exposes its source and relation kind to the server-side
   policy and redacted Observe evidence.
3. No Auto-Refill control, price, savings claim, or cadence appears without a
   provider-confirmed `RepeatPurchaseOffer`.
4. A repeat shopper can be represented as `stage: 'repeat'` without changing
   the four-persona taxonomy.
5. A merchant experiment can compare baseline and adaptive cohorts on
   conversion, average order value, revenue per session, latency, cost, and
   recovery quality.
6. A category or merchant calibration version is visible in the decision
   provenance and can disable a rule without deleting the underlying signal.

## Falsifiers

This decision should change if the provider supplies a complete, authoritative
relationship and subscription-offer model that covers the required Kibble
flows; if a merchant demonstrates that category siblings are an approved
proxy for relatedness; if a holdout shows that the extra decision states do not
change an actionable outcome; or if the Work Library assessment's comparison
and measurement claims are superseded by newer source-backed evidence.

## Related records

- [Kibble commerce parity plan](../kibble-commerce-parity-plan.md)
- [Recommendation Architecture](005-recommendation-architecture.md)
- [Kibble standalone plan](../kibble-standalone-plan.md)
- [Aisles product vision](../product-vision.md#vs-behamics-behavioral-science-overlay-platforms)
