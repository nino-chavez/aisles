# Kibble merchant-scale demonstration

## Recommendation

Demonstrate merchant scale through operating complexity, not SKU counts.

The rendered `/merchant-scale` route uses one evidence base to prove three different jobs:

- an owner-led merchant reviews catalog expansion without publishing research;
- a regional team applies location constraints without rewriting product facts;
- an enterprise network preserves channel and provider authority while assembling a personalized experience.

The 49 current catalog rows and 33 multi-pet research candidates support the demonstration. They do not define merchant size.

## Reader contract

- **Reader:** a merchant leader or prospect evaluating Aisles
- **Job:** decide whether Aisles addresses a real problem at the reader's operating scale
- **Assumed knowledge:** understands commerce and personalization, but not the Kibble source tree
- **Plainness:** lay language on the front door; exact product, capability, and authority terms in evidence sections
- **Precision locks:** 49 current catalog rows, 33 research-only rows, four shared reptile rows, synthetic scenario labels, provider-plan boundaries, and no implied publication, transaction, or approval state
- **Copy sources:** the checked-in catalog graph, multi-pet research manifest, and provider-plan references

## Three structures considered

### Product-count bands

Small, medium, and enterprise would be represented by progressively larger catalogs.

This is easy to understand and wrong for the job. Catalog size alone does not demonstrate location rules, team ownership, channel policy, or provider boundaries.

### Merchant operating models

The selected structure separates an owner-led specialist, a regional merchandising team, and a multi-channel policy network.

This structure changes the decision Aisles must help make. It also lets the same source-backed products expose different constraints without inventing a giant catalog.

### Personalization maturity

Assist, orchestrate, and govern describe how much coordination the demonstration performs.

This remains a separate field. A small merchant can have mature automation, and an enterprise merchant can still be early. Folding maturity into merchant size would combine two axes in one label.

## Structure

```text
Mobile
┌────────────────────────────┐
│ Read-only status           │
│ Headline + evidence counts │
├────────────────────────────┤
│ Small merchant             │
│ Medium merchant            │
│ Enterprise merchant        │
├────────────────────────────┤
│ Visible outcome            │
│ Shopper story              │
│ Owned inputs               │
│ Changed / kept / withheld  │
│ Proven / still needed      │
│ Ownership boundaries       │
│ Exact catalog ledgers      │
└────────────────────────────┘

Desktop
┌────────────────────────────────────────────────────┐
│ Headline                         Evidence counts   │
├────────────────────────────────────────────────────┤
│ Small             Medium             Enterprise    │
├──────────────────────────┬─────────────────────────┤
│ Merchant job             │ Visible outcome         │
├──────────────────────────┴─────────────────────────┤
│ Inputs owned by merchant / shopper / Aisles       │
├──────────────┬────────────┬────────────┬───────────┤
│ Candidate    │ Before     │ After      │ Reason    │
├──────────────┴────────────┴────────────┴───────────┤
│ Proof now          │ Missing integration           │
├────────────────────┴───────────────────────────────┤
│ Five ownership boundaries + exact row ledgers      │
└────────────────────────────────────────────────────┘
```

The semantic structure is a header, model navigation, main comparison sections, exact data tables, and footer. Tier controls are real buttons with `aria-pressed`. Dynamic outcome text uses a polite live region. Focus remains visible, controls meet the 44-pixel target, and reduced-motion preferences remove transitions.

## What each model proves

| Model | Merchant decision | Aisles action | Visible proof | Missing live input |
|---|---|---|---|---|
| Owner-led specialist | Which researched products should enter the catalog? | Group, compare, and hold every unapproved row | 49 current catalog rows stay eligible in the demo; 33 research rows stay withheld | Approval UI and authoritative commerce fields |
| Regional merchandising team | Which current-catalog products are relevant and available here? | Filter supplied availability, then rank the current-catalog remainder | One mock location changes an exact four-product shelf with a reason per row | Location, price, inventory, and fulfillment feeds |
| Multi-channel policy network | Which experience is allowed on this channel? | Compose eligible choices and withhold authority mismatches | Storefront plan evidence stays separate from portal service references | Live policy, identity, entitlement, provider, and audit services |

## Visual direction

The route extends the existing Kibble system: Plus Jakarta Sans for the product voice, IBM Plex Mono for evidence labels, ink blue for identity, teal for proven states, orange for withheld states, and amber for mock or missing inputs.

The page is a decision instrument, not a dashboard. Counts stay below the controlling point. The primary visual is the changed, kept, and withheld comparison because that is the outcome a merchant can inspect.

## Evidence boundary

The 49-row ledger comes from the current Kibble merchandising graph. The 33-row ledger comes from the multi-pet research manifest. Shared snake and bearded-dragon applicability does not duplicate the four shared product rows.

Medium-merchant location data is entirely synthetic. Enterprise market, channel, consent, and policy inputs are also synthetic. The route labels mock data in the scenario note and at each input. Those values must not be quoted as merchant reality.

Provider-plan references are pinned source evidence only. They do not prove current provider availability and do not authorize account, cart, checkout, order, catalog, or subscription changes.

## Falsifiers

This structure should change if one of these becomes true:

1. Merchant research shows catalog size, rather than operating model, is the primary decision a prospect needs to see.
2. A real regional merchant cannot supply location-level assortment or availability.
3. A real enterprise implementation has no meaningful channel, market, entitlement, or provider boundary.
4. A prospect cannot explain the difference between current catalog, research-only, mock, storefront, and portal evidence after viewing the route.

## Provenance

The implementation was re-derived from current `origin/main` after the multi-pet research catalog entered main through PR #20. PR #23 remains open but is stale relative to main and is not a safe base for this work.

No product source was promoted from research to merchant approval. No product, price, inventory record, provider plan, account, cart, order, or subscription was created or changed.
