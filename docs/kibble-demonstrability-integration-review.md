# Kibble demonstrability integration review

Status: independent integration and adversarial review
Date: 2026-08-14
Worktree: `/Users/nino/Workspace/dev/apps/aisles/aisles/.worktrees/kibble-demonstrability-redteam`
Branch: `codex/kibble-demonstrability-redteam`
Base: `origin/codex/kibble-catalog-capability-enrichment` at `0a29d4a`

## Decision

Catalog enrichment helps Kibble become more demonstrable. It gives Aisles a hash-pinned, display-safe capability manifest and enough product/category/subscription context to explain why a route can change presentation without inventing commerce.

It does not make Kibble fully demonstrable by itself.

The AI-zone expansion can stay inside Aisles' intent only if it keeps the existing contract: the model selects approved IDs inside approved zones, Aisles materializes merchant-owned facts, and the evidence names the exact Before, After, changed, and kept outcomes. No subscription action, account action, payment action, order action, new SKU, or provider mutation is justified by the current sources.

The current integration state is not build-ready because the two requested dependency branches are not observable as remote deltas. `codex/kibble-merchandising-graph` and `codex/kibble-ai-zone-demonstrability` both resolve locally to the base commit and were not present under `origin/codex/kibble-*` during this review. That makes any merge-order claim hypothetical until those branches exist and carry their intended runtime changes.

## Source ledger

Current Aisles sources:

- `docs/generative-commerce-mvp.md`: bounded commerce AI contract, authority ceilings, provider path, evidence requirements, and legacy `/api/layout` boundary.
- `docs/kibble-commerce-parity-plan.md`: commerce ownership split, one-time-purchase slice, known Aisles gaps, and subscription capability projection.
- `src/lib/brand/reference/kibble-catalog-enrichment.ts`: Kibble manifest, source hashes, catalog coverage, seven subscription capabilities, six Aisles capabilities, and stated contradictions.
- `src/lib/foundation/zone-catalog.ts` and `src/lib/foundation/zones.ts`: model approvals and named zone catalog.
- `src/lib/brand/composition-policy.ts`: Preserve and Observe route policies.
- `src/lib/brand/reference/kibble-presentation-decisions.ts`: approved presentation IDs, snapshots, and changed/kept dimensions.
- Route and API handlers under `src/routes/`: actual triggers, environment gates, session/observe gates, and provider-call boundaries.

Internal reference sources:

- `/Users/nino/Workspace/dev/labs/bc-subscriptions` at `ef122b8e`. The Aisles manifest hashes matched the local files for `eligible-products.json`, `apps/storefront-svelte/src/lib/data/catalog.ts`, `apps/marketing/src/data/capabilities.json`, `apps/marketing/src/data/demo-state.json`, and `apps/api/scripts/output/channel1-seed-output.json`.
- `bc-subscriptions/apps/storefront-svelte/src/lib/server/cart.ts`, `customer-auth.ts`, and `cart-intents.ts`: cart redirect, customer token, and subscription-intent ownership.
- `bc-subscriptions/apps/api/src/routes/storefront/checkout/gift.ts` and `prepaid.ts`, plus API payment/order/subscription services as provider-owned boundaries.

Work Library source:

- `/Users/nino/Workspace/dev/apps/work-library/work/library-import-N7kRxJ/cases/aisles-competitive-position/content.json`
- `/Users/nino/Workspace/dev/apps/work-library/work/library-import-N7kRxJ/assets/aisles-competitive-position/presentation/index.html`
- The case is draft/protected preview, with human review pending. It supports bounded composition latitude as the asset to test. It does not prove revenue lift or production readiness.

External primary sources verified on 2026-08-14:

- [BigCommerce GraphQL Storefront API authentication](https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/authentication): customer access tokens and private tokens are server-side credentials and must not be exposed to browser code.
- [BigCommerce redirected checkout](https://docs.bigcommerce.com/developer/learn/courses/composable-core/checkout/redirected-checkout): `cart.createCartRedirectUrls` returns checkout redirect URLs for an existing cart.
- [BigCommerce headless customers](https://docs.bigcommerce.com/developer/docs/storefront/headless/customers): headless sign-in uses customer access tokens/private tokens and redirects synchronize customer/cart state to hosted checkout.
- [Behamics Signals](https://behamics.com/signals/): Behamics publicly frames its product around real-time intent and reports randomized control or holdout test medians. Those are vendor-reported comparator claims, not proof for Aisles.

Safely observable public reference behavior, read-only GET only, verified on 2026-08-14:

- `https://storefront.bcsubs.app/cart`: renders an empty cart page and a public header claiming 26 active subscription SKUs.
- `https://storefront.bcsubs.app/checkout/gift`: renders a gift checkout form, including recipient email fields and sign-in options.
- `https://storefront.bcsubs.app/checkout/prepaid`: renders a prepaid checkout form and sign-in options.
- `https://storefront.bcsubs.app/account/orders` and `https://storefront.bcsubs.app/account/subscriptions`: redirect to sign-in.
- `https://storefront.bcsubs.app/portal/subscriptions/demo`: renders a subscription detail page, but this is not account-auth proof by itself.

## Capability matrix - subscription service capabilities

These seven rows are source capabilities projected into Aisles. They are not Aisles-owned commerce actions.

| Capability | Route and trigger | Candidate source | Before | Changed or kept result | Expected AI zones and calls | Fixed facts | Provider owner | Required environment | Current proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `subscribe-and-save` | `/subscriptions#kibble-capability-subscribe-and-save`; PDP/catalog cards when a live product supports the pinned offer. Trigger is normal read-only render. | `KIBBLE_CATALOG_CAPABILITIES`, 34 pinned offer rows, product 3023 as demo anchor, current catalog price check. | Aisles has catalog presentation but no subscription signup. | Kept as display-only Auto-Refill evidence. Hidden if current catalog price no longer supports the rounded savings claim. | Capability proof: 0 AI zones / 0 provider calls. Incidental route model calls must be counted separately. | Product identity, price, savings percent, cadence, product link, and all purchase actions stay merchant/provider-owned. | `bc-subscriptions` owns recurring plan/action; BigCommerce owns current product/catalog price. | Catalog read environment only. No AI env required. No transaction env authorized. | Manifest row, offer materializer, parity plan, and public `bcsubs` storefront showing active Auto-Refill context with live count drift. |
| `free-trial` | `/subscriptions#kibble-capability-free-trial`; projected from product 3035. Trigger is normal read-only render. | Pinned demo-state and canonical registry evidence. | Aisles has no trial enrollment path. | Kept as evidence label only. No trial term can become an action. | 0 / 0. | Trial existence, plan timing, charge timing, signup, and eligibility remain provider facts. | `bc-subscriptions`. | Catalog/read-only projection. | Manifest says canonical PDP registry lists free trial; source hashes matched local `bc-subscriptions`. |
| `intro-offer` | `/subscriptions#kibble-capability-intro-offer`; projected from product 3023. Trigger is normal read-only render. | Pinned demo-state and canonical registry evidence. | Aisles has no offer redemption or checkout path. | Kept as display evidence. No price rewrite beyond pinned offer display. | 0 / 0. | Intro price, later recurring price, taxes, promotions, and redemption stay outside Aisles. | `bc-subscriptions` plus commerce price/tax systems. | Catalog/read-only projection. | Manifest says canonical PDP registry lists intro offer. |
| `annual` | `/subscriptions#kibble-capability-annual`; projected from product 3038. Trigger is normal read-only render. | Pinned 2026-06-29 demo-state; not listed in the 2026-06-28 canonical PDP registry. | Aisles has no yearly-plan selection or checkout. | Kept as evidence with contradiction. It cannot be promoted to current provider truth until reconciled. | 0 / 0. | Annual cadence, savings, eligibility, and billing remain provider facts. | `bc-subscriptions`. | Catalog/read-only projection, plus reconciliation before stronger claims. | Manifest explicitly marks annual as live in demo-state but not named in canonical registry. |
| `prepaid` | `/checkout/prepaid`; trigger is route view. Observe copy can be requested only through the gated model API. | Pinned demo-state portal scenario, product 3066, public prepaid route. | Aisles had checkout unavailable. | Kept as fixed service-boundary preview. With Observe, only approved assurance copy may change. | Preserve: 0 / 0. Observe API: `checkout.assurance-strip`, 1 action, reserves 2 provider calls, actual `modelCallCount` must be 1 or 2. | Prepaid term, totals, taxes, payment, order, subscription creation, and account state stay fixed/unavailable in Aisles. | `bc-subscriptions` owns prepaid subscription flow; BigCommerce/payment processor owns checkout/payment. | Observe cookie, session id, `KIBBLE_DEMO_AI_ENABLED=true`, provider key, KV budget store in production-like env. No paid calls unless explicitly authorized. | Manifest row, checkout route/API, public `bcsubs` prepaid form, parity plan. |
| `gift` | `/checkout/gift`; trigger is route view. Observe copy can be requested only through the gated model API. | Pinned demo-state portal scenario, product 3035, public gift route. | Aisles had checkout unavailable. | Kept as fixed service-boundary preview. Gift remains a contradiction because canonical registry says absent while later demo-state says live. | Preserve: 0 / 0. Observe API: `checkout.assurance-strip`, 1 action, reserves 2 provider calls, actual `modelCallCount` must be 1 or 2. | Recipient email, payer/recipient split, payment, token issuance, account state, and subscription creation stay provider-owned. | `bc-subscriptions` and payment provider. | Same as prepaid; no email or shopper PII may enter model prompts/logs. | Manifest contradiction, checkout route/API, public `bcsubs` gift form. |
| `build-a-box` | `/subscriptions#kibble-capability-build-a-box`; trigger is fixed overview/portal boundary. | Pinned demo-state portal scenario. No product entity id in Aisles manifest. | Aisles has no box builder. | Kept as portal-only capability evidence. No builder UI or item selection in Aisles. | 0 / 0. | Product set, substitutions, allocation, pricing, fulfillment, and subscription mutation stay provider-owned. | `bc-subscriptions`. | Catalog/read-only projection. Portal integration would need separate authorization. | Manifest row says portal-only; parity plan keeps portal actions outside Aisles. |

## Capability matrix - Aisles presentation capabilities

These six rows are Aisles-owned presentation capabilities. They can be demonstrated only when evidence proves what changed and what stayed fixed.

| Capability | Route and trigger | Candidate source | Before | Changed or kept result | Expected AI zones and calls | Fixed facts | Provider owner | Required environment | Current proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `select_products` | Home `/` and `/?observe=true`; trigger is Preserve rules, not a provider call. | `loadReferenceHomeProducts(9)` and the merchant candidate set in Home decision code. | Merchant catalog candidates in source order. | Changed/kept product set selected by rules. Catalog membership remains fixed. | `home.featured-row` rules path; 0 provider calls. | Product identity, facts, prices, links, actions, page recipe, and checkout/account state. | Aisles rules over merchant catalog data. | Normal catalog env. Observe only exposes inspector evidence. | Manifest row, Home policy with `rank_products` and `select_products`, Home route/API rules mode. |
| `rank_products` | Home `/?observe=true`, PLP `/category/dog-food?observe=true` with `FEATURED` and no cursor, PDP `/product/[slug]?observe=true` when 3-4 related candidates exist. Trigger is gated Observe API POST for model mode. | Home products; PLP server-reloaded prefix plus fixed tail; PDP `resolveKibblePdpRelatedProducts` with `native_related` or `category_sibling` provenance. | Approved input order. | Product order may change, or be kept. Evidence must list moved/unchanged IDs and tail behavior. | Preserve Home rules: 0 calls. Observe Home/PLP/PDP: one approved zone per route; each action reserves 2 provider calls; actual `modelCallCount` must be 1 or 2. PDP with fewer than 3 related candidates must prove 0 calls. | Product set, product facts, prices, links, actions, sort, cursor, page recipe, and relationship provenance. | Aisles owns candidate set/materializer; model provider ranks only approved IDs. | Observe cookie, valid session, `KIBBLE_DEMO_AI_ENABLED=true`, provider key, budget store, no production deploy. | Manifest row, composition policy, Home/PLP/PDP model wrappers, route/API handlers, PDP zero-candidate guard. |
| `select_copy_variant` | Home, PLP, PDP bundled with their model actions; Search `/search?q=zzzz-kibble-no-match&observe=true`; Cart `/cart?observe=true`; Checkout `/checkout/gift?observe=true` or `/checkout/prepaid?observe=true`. Trigger is gated model API. | Approved copy variant IDs in `kibble-presentation-decisions.ts`. Search intentionally omits the raw query from the prompt. | Merchant baseline copy. | Approved copy variant ID may change or be kept. The model does not write prose. | Home/PLP/PDP: bundled inside the ranking action counts above. Search/cart/checkout: one copy-only zone, reserves 2 provider calls, actual 1 or 2. | Search results, cart contents, totals, checkout terms, policies, links, prices, and actions. | Aisles owns variant catalog/materializer; model provider selects ID only. | Observe cookie/session, `KIBBLE_DEMO_AI_ENABLED=true`, provider key, budget store. | Presentation policy, bounded copy model, bounded-copy API, live-preview tests. |
| `select_component_variant` | Home `/?observe=true`; trigger is Home model action. | Approved Home component IDs, currently `four-column` or `two-column` category grid. | Merchant baseline component treatment. | Component variant may change or be kept inside the existing Home recipe. | Bundled inside Home model action; no extra provider call beyond Home action. | Component registry, CSS registry, product facts, links, actions, root chrome, checkout/account structure. | Aisles materializer; model provider selects approved ID only. | Same Home Observe env. | Presentation policy/schema includes `catalogComponentVariantId`; snapshot tests verify component changed/kept evidence. |
| `toggle_zone` | PLP and PDP Observe model actions. Trigger is PLP/PDP model API. | Approved `marketingBlockVariantId` values: `none`, `routine-builder`, `compare-current`. | Optional marketing block not shown. | Marketing block may be added or kept absent. It must be reported as a bounded presentation field unless registered as a real foundation zone. | Bundled inside PLP/PDP model action; no extra provider call beyond that action. | Product list, related candidates, prices, claims, links, actions, category, PDP structure. | Aisles materializer; model provider selects approved ID only. | Same PLP/PDP Observe env. | Presentation policy and tests support it, but foundation zone catalog does not currently register `plp.marketing-block` or `pdp.marketing-block` as live model-approved zones. |
| `reorder_zones` | Home `/?observe=true`; trigger is Home model action. | Approved Home section order IDs: `featured-then-catalog` or `catalog-then-featured`. | Baseline Home section pair order. | Approved section pair may reorder or stay fixed. Root chrome and checkout/account routes do not move. | Bundled inside Home model action; no extra provider call beyond Home action. | Home recipe boundaries, product facts, prices, links, actions, account/checkout surfaces. | Aisles materializer; model provider selects approved ID only. | Same Home Observe env. | Presentation schema includes `sectionOrderId`; snapshot tests report changed section order. |

## Integration order

Current observable branch state:

1. `origin/codex/kibble-catalog-capability-enrichment` exists at `0a29d4a`.
2. `codex/kibble-merchandising-graph` resolves locally to `0a29d4a`, but `origin/codex/kibble-merchandising-graph` was not present.
3. `codex/kibble-ai-zone-demonstrability` resolves locally to `0a29d4a`, but `origin/codex/kibble-ai-zone-demonstrability` was not present.
4. Diffs from base to both local branches were empty.

Required merge order once the dependent branches exist:

1. Keep `codex/kibble-catalog-capability-enrichment` as the base. It owns the manifest and display-safe catalog capability projection.
2. Merge `codex/kibble-merchandising-graph` next. It must own candidate-source provenance and graph semantics: `native_related` versus `category_sibling`, category job profiles, offer suppression on price drift, registry/demo-state contradictions, and the exact products eligible for each route.
3. Merge `codex/kibble-ai-zone-demonstrability` after the merchandising graph. It must consume the graph, not redefine it, and must prove each model action through route-level Before/After evidence and fixed-fact evidence.
4. Re-run this integration review after both branches are real remote deltas and before any staging/provider enablement.

First integration gate:

```bash
git fetch origin codex/kibble-merchandising-graph codex/kibble-ai-zone-demonstrability
git diff --name-status origin/codex/kibble-catalog-capability-enrichment...origin/codex/kibble-merchandising-graph
git diff --name-status origin/codex/kibble-merchandising-graph...origin/codex/kibble-ai-zone-demonstrability
```

The first command must succeed. Both diffs must be non-empty and scoped. If either branch is absent or still equal to `0a29d4a`, the integration is blocked.

## Required tests and rendered gates

Minimum static/unit gates:

- `npm run check`
- `npx vitest run src/lib/brand/reference/kibble-catalog-enrichment.test.ts src/lib/brand/reference/kibble-presentation-decisions.test.ts src/lib/brand/reference/kibble-home-model.server.test.ts src/lib/brand/reference/kibble-plp-model.server.test.ts src/lib/brand/reference/kibble-pdp-related-model.server.test.ts`
- `npx vitest run src/routes/kibble-route-authority.test.ts src/routes/kibble-direct-ai-session.test.ts src/routes/api/kibble/home-decision/home-decision.test.ts src/routes/api/kibble/plp-product-ranking-decision/plp-product-ranking-decision.test.ts src/routes/api/kibble/pdp-related-decision/pdp-related-decision.test.ts src/routes/api/kibble/bounded-copy-decision/bounded-copy-decision.test.ts`
- `npx vitest run src/lib/components/kibble/kibble-live-preview.test.ts src/lib/components/kibble/kibble-plp-live-preview.test.ts src/lib/components/kibble/kibble-pdp-live-preview.test.ts src/lib/components/kibble/kibble-bounded-copy-live-preview.test.ts src/lib/components/kibble/kibble-dev-inspector.test.ts`

Rendered Preserve gates with `KIBBLE_DEMO_AI_ENABLED=false`:

- `/`: renders Kibble Preserve Home, displays catalog/subscription evidence, and records 0 model calls.
- `/category/dog-food`: renders category facts and fixed sort/cursor behavior with 0 model calls.
- A PDP with native related products: renders related shelf provenance and 0 model calls in Preserve.
- A PDP with no eligible related products: renders no AI marker/call. This is a valid outcome, not a failure.
- `/subscriptions`: shows all seven source capabilities as evidence, with portal/storefront ownership labels.
- `/cart`, `/checkout/gift`, `/checkout/prepaid`, account routes, and portal routes: render fixed unavailable or service-boundary states without cart/account/payment/subscription mutation.

Rendered Observe gates with a mocked provider first:

- Home model preview proves product ranking, copy variant, component variant, section-order Before/After, fixed facts, provider, model id, actual call count, and fallback behavior.
- PLP model preview proves prefix-only ranking, fixed tail, copy variant, optional marketing block, provider, model id, actual call count, and fallback behavior.
- PDP model preview proves related-product ranking only when 3-4 related candidates exist; the zero-candidate route proves 0 calls.
- Search empty-state copy preview proves no raw query reaches the model and no result set changes.
- Cart empty-state copy preview proves no cart contents, totals, or checkout URL are invented.
- Checkout gift/prepaid copy preview proves no recipient email, payment field, total, order id, or subscription id reaches the model.

Rendered Observe gates with a live provider may run only in staging-like infrastructure after owner authorization. They need `KIBBLE_DEMO_AI_ENABLED=true`, a valid provider key, a session cookie, `aisles_observe_demo=1`, budget storage, redacted logs, and an explicit no-production-deploy boundary.

## New SKU, zone, and action-type decisions

New SKUs: not justified. The pinned manifest already covers 49 catalog rows, 34 offer rows, 10 canonical storefront registry products, and seven source capability rows. Adding SKUs would hide the source-drift problem instead of solving it.

New action types: not justified. Aisles should not add `subscribe`, `trial`, `gift`, `prepaid`, `build_box`, `checkout`, `order`, `account`, or payment actions in this integration. The current intent is presentation demonstrability, not transaction ownership.

New zones: not justified yet. The foundation zone catalog already has model approvals for Home, PLP product ranking, PDP related products, search empty state, cart empty state, and checkout assurance. The exception is naming: `KIBBLE_PLP_PRESENTATION_POLICY` and `KIBBLE_PDP_PRESENTATION_POLICY` include `plp.marketing-block` and `pdp.marketing-block`, but those exact IDs are not foundation zones in `zones.ts` or live approvals in `zone-catalog.ts`. The next branch must either:

1. Treat those as presentation-field IDs inside `plp.product-ranking` and `pdp.related`, then stop calling them zones in evidence, or
2. Register them as real foundation zones with approvals, route mappings, tests, and rendered gates.

Until that is resolved, marketing-block evidence can be accepted as bounded presentation evidence, not as separate AI-zone coverage.

## Contradictions and adverse findings

- The requested dependency branches are absent from `origin` and have no local diff from base. This blocks integration review of their implementation.
- Public `bcsubs` pages now claim 26 active subscription SKUs, while the pinned Aisles manifest projects 34 offer rows and 49 catalog rows from older source files. Those are different evidence classes. Do not reconcile them by averaging or by choosing the larger number.
- Gift is unresolved: the 2026-06-28 canonical registry says gift is absent because no `gift_tokens` table exists; the 2026-06-29 demo-state says one live gift portal scenario exists.
- Annual is live in the 2026-06-29 demo-state but not listed in the 2026-06-28 canonical PDP registry.
- The Work Library Aisles-vs-Behamics case is draft/protected preview with human review pending. It supports a bounded experiment shape, not a shipping claim.
- Behamics' public uplift language is vendor-reported. It can be a comparator for what evidence buyers expect, but it is not outcome proof for Aisles.
- The manifest declares six Aisles capabilities, but some are bundled under one model action. Evidence must count capabilities independently from provider calls.
- Kibble currently uses `KIBBLE_DEMO_AI_ENABLED`; prior bounded-AI docs and adjacent branches may refer to different enablement names. The integrated branch must standardize or explicitly document the Kibble-specific flag.

## Security, PII, and PCI risks

- BigCommerce private tokens and customer access tokens must remain server-side. Aisles must not expose them to browser code or model prompts.
- Customer account state, order history, addresses, payment methods, and subscription details must not be read until an explicit account/subscription integration is authorized.
- Gift recipient email, customer email, passwords, magic-link state, payment fields, totals, stored instruments, transaction IDs, subscription IDs, and order IDs must not enter model prompts or generation logs.
- Checkout should remain hosted/provider-owned. If the one-time-purchase slice resumes, the safe path is server cart creation followed by `cart.createCartRedirectUrls`, not a hand-built checkout URL.
- Search copy currently omits the raw query from the model prompt. Keep that property unless the query is explicitly classified, redacted, and authorized.
- Budgeting and cooldowns must stay fail-closed. A disabled env flag, missing session, missing observe cookie, invalid route, exhausted budget, provider timeout, invalid output, or missing related candidates should produce fixed fallback evidence, not a hidden partial model decision.
- No paid provider calls, production deployment, production data, customer account creation, order creation, subscription creation, or payment mutation is authorized by this review.

## Staging and provider decisions

Required before live-provider demonstrability:

1. Decide whether the next evidence pass is mock-provider only or staging live-provider. Mock-provider comes first.
2. If staging live-provider is approved, use a non-production environment with `KIBBLE_DEMO_AI_ENABLED=true`, provider credentials, KV budget state, redacted generation logs, and an explicit call budget.
3. Name the owner of provider spend and model failure triage before enabling live calls.
4. Decide whether public `bcsubs` is a current source of truth or a reference behavior sample. Its current 26-SKU public claim conflicts with the pinned Aisles manifest classes.
5. Decide whether portal capability proof requires a controlled seeded login. Public portal pages are useful reference behavior, but sign-in and demo-detail pages alone do not prove account authorization or subscriber lifecycle.

## Unknowns

- The exact implementation contents of `codex/kibble-merchandising-graph` and `codex/kibble-ai-zone-demonstrability` are unknown because the remote branches were not present.
- The current provider truth behind `bcsubs` is unknown without owner-authorized source/API access. Public pages are safe observations only.
- Whether gift should be treated as current, roadmap, or contradicted remains unresolved.
- Whether annual should graduate from demo-state-only to canonical storefront registry evidence remains unresolved.
- Whether PLP/PDP marketing blocks are presentation fields or true AI zones remains unresolved.
- Whether a merchant/operator can understand and control the evidence surfaced by the inspector has not been tested with a human reviewer.
- Incremental revenue, conversion, engagement, and operating-cost outcomes are not measured.

## Falsifiers

Treat the integration as failed if any of these happen:

- A model can add a product, price, URL, component, CSS class, purchase action, checkout state, order state, account state, or subscription state outside an allow-list.
- A route can produce a provider call without `observe=true`, the observe cookie, a valid session, enabled env flag, and budget reservation.
- PDP related-product fallback is represented as merchant-authored related products when it is only a category-sibling fallback.
- A PDP with fewer than three related candidates still calls the provider.
- A subscription capability row becomes an Aisles-owned action without provider authorization.
- Public/live provider data contradicts the pinned manifest and the UI does not label the evidence class.
- Rendered evidence lacks Before, After, changed/kept result, provider, model id, call count, fallback state, or fixed-fact list.
- The first real branch merge requires new SKUs, new action types, or unregistered zones to make the demo look complete.
- A holdout or controlled merchant test shows no incremental value, unsafe recovery behavior, or operator inability to explain/control the changes.

## Final verdict

NOT BUILD-READY

Actionable blockers:

1. Make `codex/kibble-merchandising-graph` and `codex/kibble-ai-zone-demonstrability` real remote branches with non-empty, scoped diffs from the expected base.
2. Land the merchandising graph first and prove candidate-source provenance, especially `native_related` versus `category_sibling`, offer suppression on price drift, and registry/demo-state contradictions.
3. Land AI-zone demonstrability second and prove every declared Aisles capability with rendered Before/After, changed/kept, fixed-fact, provider, model id, and actual call-count evidence.
4. Resolve whether PLP/PDP marketing blocks are presentation fields or registered foundation zones.
5. Reconcile the pinned manifest with current public `bcsubs` behavior before making any "current provider" claim.
6. Keep all subscription, account, checkout, payment, order, and provider-spend behavior disabled until staging ownership and authorization are explicit.
