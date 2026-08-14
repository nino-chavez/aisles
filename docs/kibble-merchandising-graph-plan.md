# Kibble merchant merchandising graph plan

## Recommendation

Use the new graph as the merchant-meaning layer for Kibble candidate selection. Do not add a raw product now.

The 49-product catalog already covers every intended shopper job and all seven subscription demo scenarios. The missing piece was not more SKUs. It was a truthful way to distinguish merchant-authored routines, derived complements, catalog-derived alternatives, and category fallback.

One source conflict needs attention before purchase wiring. The pinned offer file contains 34 products. The provider seed creates monthly plan families for 32. It explicitly deletes monthly plans for Gift Bundle (`3070`) and Surf & Turf Limited Reserve (`3071`). The graph records those two offer rows but will not return them as catalog purchase evidence.

## What the graph contains

```text
49 exact catalog products
├── 8 current source categories
├── 35 category-specific shopper jobs
├── product roles, need states, and comparison dimensions
├── 8 merchant-authored routine sets
│   ├── 27 explicit routine memberships
│   └── 3 embedded components with no invented product ID
├── 34 complements derived from routine co-membership
├── 14 alternatives derived from exact catalog names and categories
└── subscription evidence
    ├── 34 pinned offer rows
    ├── 32 provider-plan-backed product families
    ├── 97 exact provider plan IDs
    └── 7 scenarios: 4 storefront, 3 portal

Existing capability-manifest boundary
├── 6 Aisles presentation capabilities
└── 7 configurable source models explicitly not claimed for Kibble
```

The product registry validates all 49 IDs exactly once against the existing capability manifest. Every product has at least one shopper job, need state, role, and comparison dimension. Every shopper job returns at least one current product.

## Relationship authority stays visible

The graph does not turn every useful association into a merchant-authored relationship.

| Evidence class | Meaning | Allowed claim |
| --- | --- | --- |
| `merchant-authored` | A checked-in bundle source explicitly includes the component. | “This item is in the merchant-authored routine.” |
| `derived-from-merchant-authored-routine` | Two components appear together in that routine. | “These are complementary inside this routine.” |
| `merchant-catalog-derived` | Exact product names and current category placement support a comparison set. | “These are catalog-derived alternatives.” |
| `category_sibling` / `fallback-only` | The current catalog places both products in the same category. | “Same-category fallback; no merchant relationship is claimed.” |

Every graph edge carries a source path, SHA-256, source locator, evidence class, and interpretation. Category fallback is returned by a separate function and never enters the graph edge collection.

The six Aisles presentation capabilities remain presentation-only. They may rank or present approved candidates. They cannot create a product role, relation, provider plan, eligibility fact, or portal authority. The seven configurable source models outside current Kibble intent also remain explicitly not claimed.

The bundle source names three components that do not have product IDs in the fixed catalog:

- Chicken & Salmon Freeze Dried Raw Morsels for Puppies
- Senior Daily
- Surf & Turf Air Dried Recipe for Dogs

They remain embedded routine components. The graph does not manufacture IDs or SKUs for them.

## Shopper jobs remain category-specific

The Work Library Aisles assessment found that three of ten testable behavioral rules pointed the wrong way in one cross-category offline calibration. Its Aisles-versus-Behamics comparison also treats intent inference as a weak differentiator.

The graph applies the useful part of that evidence: product meaning belongs to the merchant category, not to a global persona. A behavioral signal may rank products inside a merchant-approved set. It may not turn a durable toy into a refill product or assign a wellness role the catalog does not support.

The graph does not claim a merchant outcome. Conversion, average order value, and revenue effects remain unmeasured.

## Subscription evidence has two independent gates

A pinned offer row and a provider plan are different evidence.

| Evidence | Count | What it proves |
| --- | ---: | --- |
| Current catalog rows | 49 | Fixed catalog identity and category mapping |
| Pinned offer rows | 34 | A display offer existed in the checked-in storefront projection |
| Provider-plan-backed products | 32 | Exact monthly provider plan IDs exist in the provider seed |
| Provider plan IDs | 97 | Three monthly plans for 32 products, plus one annual plan |
| Canonical storefront registry | 10 | The older registry explicitly lists these products |
| Live-in-snapshot scenarios | 7 | The demo-state reported four storefront and three portal scenarios |

Gift Bundle and Surf & Turf are the two conflicted rows. The bundle source marks both one-time. The provider seed deletes their monthly plans. A pinned price and savings percentage are therefore not enough to present either product as subscription-purchasable.

The canonical registry and demo-state also disagree about gift capability. The June 28 registry calls gift absent because its expected gift table did not exist. The June 29 demo-state reports one live portal scenario. The graph preserves the newer record as pinned portal-review evidence. It does not claim current provider availability or catalog purchase authority.

The four storefront scenarios can return catalog purchase evidence:

- Subscribe and save: 32 provider-plan-backed product families
- Free trial: product `3035`
- Intro offer: product `3023`
- Annual: product `3038`

The three portal scenarios return service references, never PDP or catalog purchase evidence:

- Prepaid references Advanced Bundle product `3066` and its three-month provider plan
- Gift references Calm Chews product `3035` and its one-month provider plan
- Build-a-box returns the six provider-approved selection SKUs from products `3023`–`3028`

The build-a-box provider plan currently borrows product `3071` as a host. The source says this is meant to avoid polluting a browsable PDP. The graph records `3071` as the provider host but does not return it as a build-a-box purchase candidate.

## Additional products are not needed for the current scope

No current shopper job or subscription scenario has an empty candidate set. Adding products now would create catalog facts without a merchant record.

A new product becomes justified only when one of these conditions is supported by source evidence:

1. The merchant approves a storefront build-a-box flow and supplies the dedicated Build Your Box product requested by the provider seed.
2. The merchant wants an embedded routine component sold or compared independently and supplies its real catalog product ID, SKU, price, and publication state.
3. A new merchant-approved shopper job has no truthful candidate in the 49-product catalog.
4. The provider adds an active, product-matched plan family for a currently conflicted offer row.

These are also the falsifiers for the current “no additional products” conclusion.

## Integration changes belong in the next stacked slice

This PR intentionally changes only the graph, its tests, and this plan. The first wiring step should be the purchase-evidence gate:

1. Update `materializeKibbleSubscriptionOffers` in `src/lib/brand/reference/kibble-catalog-enrichment.ts` to require `getKibbleCatalogPurchaseEvidence(product.entityId)`. This will keep the 34-row source record visible while suppressing catalog purchase evidence for products `3070` and `3071`.
2. Update `resolveKibblePdpRelatedProducts` in `src/lib/server/bigcommerce.ts` to use this priority: native merchant `relatedProducts`, graph candidates, then disclosed category siblings.
3. Extend the related-candidate source and provenance contract so the route, Observe evidence, and DOM preserve `native_related`, graph authority, and `category_sibling` as different states.
4. Update PDP and catalog tests to prove portal scenarios never appear as product capabilities and that a category fallback never reports a merchant-authored relation.

No zone catalog, route, Svelte component, capability manifest, transaction path, provider account, subscription, or production system changes in this slice.

## Source receipt

| Source | SHA-256 | Used for |
| --- | --- | --- |
| `scripts/kibble-demo/data/seed-output.json` | `833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49` | Product keys, SKUs, names, brands, original offer flags |
| `scripts/kibble-demo/data/channel1-seed-output.json` | `97ddb5f9df38ab0f7372d16b93fd466c5888a0e7f61d72dcf7fec1ded6a0943c` | Current 49 product-to-category mappings |
| `apps/storefront-svelte/src/lib/subscriptions/eligible-products.json` | `affd8b0092d249e328683af00207e510248033d1cd5593c8134b956499b5a6da` | 34 pinned offer rows |
| `apps/storefront-svelte/src/lib/catalog.ts` | `76f1ff49ac117fff785df80444883cb580d0f088e22c46767a86d69cc6a00997` | Canonical 10-product registry |
| `apps/marketing/src/data/capabilities.json` | `407efaf0e9c33b948bde28c162f18d4fe3630ba7be9a3c7870045d48326b4a13` | Source capability registry and seven not-claimed models |
| `apps/storefront-svelte/src/lib/brand/bundle-contents.json` | `84eeb73ac2d81e2b796b530c876ab334ec6d613e74ff59e7ecffb6f20086bcdd` | Eight merchant-authored routines |
| `apps/api/migrations/seed/0009_kibble_demo_seed.sql` | `b8a6197715158e7f944595dd19f5480717a42a7ae1b593b0d14960bbef27bcd3` | Monthly and annual provider plan IDs; two plan deletions |
| `apps/api/migrations/seed/0010_demo_extensions_seed.sql` | `e769cdb718ac68d52bc758f26a99aa2f54baab4cb50449221a04af4c8e707e42` | Portal-only prepaid, gift, and build-a-box references |
| `apps/marketing/src/data/demo-state.json` | `a3554da7d7509c9b9fbdef6cd9a24102d05ca34f7da593e8abfc804bf942161f` | Seven live-in-snapshot scenarios |
| Work Library Aisles case, source revision `23ec6ca446e6269035bf0b7c90e78477b9c87d25` | `7e61789e2775022008d3be3c5a41a0f76ec5f62ac7655f983031381d442d1f58` | Category-specific signal guard and unmeasured-outcome boundary |

All source files were read as evidence. None authorizes a provider call, catalog write, account action, transaction, merge, or deployment.
