# Organization, Brand, and Composition Autonomy Plan

**Status:** In staged implementation; reference-preservation acceptance is incomplete

**Date:** 2026-08-12

**Applies to:** `aisles`, `bealls-aisles`, and the bounded `aisles-admin` sandbox
**Canonical owner:** `aisles`

## Implementation checkpoint

The plan is not complete. The corrective implementation is integrated on the
project branches. The Home model action is merged at `426045a6`, deployed as
Cloudflare Pages deployment `1691752f-db95-402c-be7c-8d2ae9c1945b`, and was
verified live on 2026-08-13. The PDP model action is merged at `4efa5ded`,
deployed as Cloudflare Pages deployment
`3a748556-2243-4f51-b6da-63f01701278f`, and was verified live on 2026-08-13.
No database migration has been applied.

| Phase | Verified state on 2026-08-13 | Remaining gate |
|---|---|---|
| 0 — correct the record | Integrated in Aisles and Bealls Aisles | Publish the amended claims with the code |
| 1 — policy compiler | Implemented in Aisles; Bealls-family policies record observed legacy behavior | Production adoption beyond the Kibble slice |
| 2 — policy-aware resolver | Implemented and tested as an opt-in path | Migrate each contracted route and zone |
| 3 — Kibble reference package | Pinned contract, native components, CSS, recipes, fallbacks, classified route dependencies, and the final cold-review accessibility repairs are implemented. The contract records the exact 28 zone families and 36 expanded Bealls identities: 11 content-backed Kibble-native adapters and 25 Trusted Hidden terminals. | Approved route-by-route visual comparison |
| 4 — Kibble routes | Home, product listing, product detail, search, and error surfaces render Preserve. Product detail is live as a catalog-display-only route, and product cards link to it. Cart, account, subscriptions, and the three canonical checkout phase routes render source-native unavailable shells rather than functional commerce; bare `/checkout` remains the source 404. Home applies bounded signal-informed product ranking without changing its reference shell. | Complete route-by-route human visual review; do not treat the PDP or unavailable shells as functional commerce |
| 5 — bounded zone decisions | Strict policy-derived schema, trusted materialization, and fail-closed source binding implemented. Home has a live opt-in `rank_products` model action; the exact-route PDP related-products action is also live. | Add another model-capable surface only after its merchant-owned zone contract is approved; retain route-by-route visual and operational gates |
| 6 — cache and provenance | Versioned cache/log/Observe code, an additive migration, actual Home and product-listing Preserve records, and a Home decision trace implemented | Apply the migration and verify the deployed runtime |
| 7 — executable parity | The local Kibble harness covers 15 named routes at 390, 768, and 1280 pixels. It checks pinned provenance, dependency classifications, structure, and screenshots. The latest zero-tolerance run leaves all 15 routes and all 45 viewport cells open: 12,313,565 of 66,597,260 comparable pixels differ (18.4896%), with no masks. Mechanical evidence is not an approval. The Bealls internal regression harness covers its 90 brand/route/viewport cells. | Obtain named route-by-route human visual approval; no masks or tolerances are approved by this record |
| 8 — Bealls adoption | Separate brand policies and versioned internal renderer contracts are integrated for Bealls, Bealls Florida, and Home Centric. The final clean internal run at `6b7faee` mechanically passed all 90 cells per side with exact active-brand and zone coverage, zero model requests, and no provider/database traffic. Its unmasked comparison still has 62 changed cells and 27,989,468 changed pixels. All brands remain explicitly `uncontracted` for external-reference preservation. | Obtain named human review of the internal visual deltas; add approved external-reference contracts and visual gates before making a preservation claim |
| 9 — merchant control | A dedicated, authenticated, read-only Autonomy Sandbox is integrated in `aisles-admin`. It simulates organization → brand → surface → zone narrowing without loading or publishing runtime policy. | Define the runtime-owned versioned read/write contract, tenant-safe storage, audit trail, and publication workflow |

The current Kibble implementation is evidence that the new boundary can be
encoded. It is not yet evidence that Aisles can preserve every route of an
external storefront. Legacy whole-page generation remains explicitly
uncontracted rather than inheriting the Preserve claim.

## Recommendation

Aisles should separate three things that its current design blends together:

1. The **organization** that owns the commerce system.
2. Each **brand** and its approved visual system.
3. The amount and method of **Aisles authority** on each page and zone.

The merchant should choose an understandable autonomy preset. The runtime must
compile that preset into an explicit capability allow-list. Aisles may rank
products, select approved content, or arrange approved zones only when the
active policy permits it.

Aisles must never generate runtime components, CSS, arbitrary classes, URLs, or
new design-system rules. Greater autonomy means more freedom inside a
merchant-approved system. It does not mean replacing that system.

The default for onboarding an existing merchant is **Preserve**. More authority
is enabled by surface or zone after deterministic rendering and visual parity
have passed.

## Corrected product boundary

`bealls-aisles` demonstrates one merchant organization operating related brands
through a shared commerce and composition system. Bealls, Bealls Florida, and
Home Centric share an organization today while retaining separate identities
and configurations. Each must receive a separate design contract when it adopts
the preserve-mode architecture.

That demonstration does not prove that a different merchant can provide a
reference repository and receive a visually preserved storefront through theme
configuration alone. Kibble is the first acceptance case for that separate
integration problem.

The supported claims must remain distinct:

| Capability | Current evidence | Required evidence |
|---|---|---|
| Personalize catalog content in the existing Aisles renderer | Implemented | Existing functional tests |
| Run related brands for one integrated merchant | Demonstrated by `bealls-aisles` | Per-brand policy and regression coverage |
| Preserve an unrelated merchant's existing storefront | Not established | Versioned reference contract, preserve renderer, and visual parity gates |
| Let a merchant choose generation autonomy | Foundation partially exists | Executable policy, route integration, provenance, and control surface |

## Reader and decision contract

This plan is for maintainers and product owners. They should be able to assign
work without reconstructing the preceding investigation.

The following terms are precision locks:

- **Organization:** the merchant or operating company that owns one or more brands.
- **Brand:** a customer-facing identity inside an organization.
- **Design contract:** the versioned tokens, chrome, components, page recipes,
  responsive behavior, and allowed variants for one brand.
- **Surface:** a page class such as home, product listing, product detail, cart,
  checkout, or search.
- **Zone:** a named insertion point inside a surface.
- **Capability:** one specific kind of change Aisles may make.
- **Decision mode:** the mechanism that chooses an allowed change: fixed data,
  deterministic rules, or a model.
- **Publication mode:** whether an allowed result goes live, enters a holdout,
  or waits for approval.

These are separate axes. A model may operate under a narrow capability policy.
A deterministic rule may operate under a broad one. Combining them into one
"temperature" field would hide important differences.

## Alternatives considered

### One autonomy number

A scalar such as `0.0` through `1.0` is simple to present but has no reliable
runtime meaning. It cannot express a fixed Kibble hero, a rankable arrivals
grid, and a model-selected related-product rail on the same page.

**Decision:** Rejected as the enforcement model. A UI may visualize a spectrum,
but it must compile to named capabilities.

### One preset per page

Page presets make home different from checkout, but they cannot protect or open
individual zones without another exception system.

**Decision:** Use presets as defaults, not as the complete policy.

### Capability matrix with presets

An organization sets a maximum authority. A brand narrows it. A surface selects
a preset. A zone can narrow it further. The effective policy is an allow-list
that the schema, resolver, and renderer enforce.

**Decision:** Adopt.

## Merchant-facing presets

Presets are convenience bundles. The capability matrix remains the source of
truth.

| Preset | Page structure | Components | Content and products |
|---|---|---|---|
| **Preserve** | Fixed reference recipe | Fixed reference variants | Rank/select products and fill explicitly approved data slots |
| **Assist** | Fixed reference recipe | Select among approved variants | Preserve capabilities plus bounded copy or CTA selection |
| **Compose** | Choose from approved recipes; toggle/reorder eligible zones | Select approved variants | All approved merchandising decisions |
| **Explore** | Compose inside an isolated experiment | Candidate components must already be registered | Holdout or approval required before becoming a production default |

No preset permits component or CSS invention. Explore widens the set of
pre-registered choices and changes publication controls; it does not grant a
model a code-writing path.

A registered component variant is a complete bounded configuration, not merely
a component name. It declares allowed props, asset slots, link targets, copy
fields, and CSS variant IDs. The model may select that ID; it may not construct
raw prop combinations, image URLs, destinations, or display rules around it.

Recommended starting defaults for an external merchant are:

| Surface | Starting preset | Reason |
|---|---|---|
| Home | Preserve | Highest visual and campaign sensitivity during onboarding |
| Product listing | Assist | Ranking and approved merchandising variants carry value without replacing the shell |
| Product detail | Preserve | Product facts and purchase controls remain fixed; recommendation zones may opt into Assist |
| Cart | Preserve | Transaction state and checkout transition remain fixed |
| Checkout | Preserve | No generative structural authority |
| Search and empty states | Assist | Copy and rescue selections can adapt inside a fixed treatment |

Bealls-family defaults can retain broader current behavior explicitly because
those brands were built with this renderer. Kibble begins in Preserve and earns
broader authority zone by zone.

## Executable policy

The conceptual shape is:

```text
organization maximum
  └── brand maximum
      └── surface preset and overrides
          └── zone overrides
              ├── capability allow-list
              ├── decision mode
              └── publication mode
```

Each level may narrow its parent. It may not silently expand it. Effective
capabilities are the intersection of the organization, brand, surface, and zone
allow-lists.

Organization and brand identity are resolved server-side from trusted deploy or
host configuration. A browser request may not select another organization,
brand, policy version, or broader preset. Preview and experiment overrides must
be authenticated, bounded by the organization maximum, and included in cache
and provenance records.

The initial contract should remain small:

```ts
type AutonomyCapability =
  | 'rank_products'
  | 'select_products'
  | 'select_copy_variant'
  | 'generate_bounded_copy'
  | 'select_component_variant'
  | 'toggle_zone'
  | 'reorder_zones'
  | 'select_page_recipe';

type DecisionMode = 'fixed' | 'rules' | 'model';
type PublicationMode = 'live' | 'holdout' | 'approval_required';
type AutonomyPreset = 'preserve' | 'assist' | 'compose' | 'explore';
```

The organization and brand types should carry stable identifiers and contract
versions. A brand points to its design contract rather than embedding a partial
theme as proof of design fidelity.

```ts
interface OrganizationPolicy {
  organizationId: string;
  maximumCapabilities: readonly AutonomyCapability[];
  defaultPreset: AutonomyPreset;
}

interface BrandDesignContract {
  organizationId: string;
  brandId: string;
  referenceId: string;
  referenceVersion: string;
  policyVersion: string;
  componentRegistry: readonly string[];
  surfaces: Partial<Record<Surface, SurfacePolicy>>;
}

interface SurfacePolicy {
  preset: AutonomyPreset;
  orderedZones: readonly string[];
  zoneOverrides?: Record<string, ZonePolicy>;
}

interface ZonePolicy {
  capabilities?: readonly AutonomyCapability[];
  decisionMode?: DecisionMode;
  publicationMode?: PublicationMode;
  allowedComponentVariants?: readonly string[];
  allowedCssVariants?: readonly string[];
  allowedCopyVariants?: readonly string[];
}
```

## Generation contract

For contract-enabled brands, the model should stop returning an arbitrary
whole-page `sections[]` array. It should receive only zones and fields for which
the effective policy grants authority.

```ts
interface ZoneDecision {
  zoneId: string;
  productIds?: string[];
  copyVariantId?: string;
  boundedCopy?: Record<string, string>;
  componentVariantId?: string;
  visible?: boolean;
  order?: number;
}
```

The response schema must omit forbidden fields. Prompt instructions are not an
authorization mechanism.

Generated copy is also capability-bound. A `generate_bounded_copy` grant must
name the writable fields, maximum lengths, approved catalog facts, and forbidden
claim classes. It does not authorize invented prices, discounts, ingredients,
inventory, delivery promises, or health claims.

## Resolution and fallback

The current resolver prefers engine output, then admin content, then fallback.
That is incompatible with a merchant lock.

The corrected flow is policy-driven:

```text
fixed zone
  reference-owned content and renderer

rules zone
  deterministic decision → validate allowed fields → merge into reference baseline

model zone
  model decision → validate allowed fields → merge into reference baseline

any invalid or unavailable decision
  reference-owned fallback with failure provenance
```

An authorized merchant override may pin content or narrow capabilities and
therefore wins over engine output. An unknown or missing reference contract
fails closed in Preserve mode. It must not silently fall back to Haven or to a
generic homepage.

## Reference design contract

A design contract must include, at minimum:

- Organization, brand, reference repository, and pinned version
- Semantic tokens, including rules such as "mint means Auto-Refill"
- Header, navigation, footer, and responsive chrome
- Registered components and their prop schemas
- Registered component variants with bounded props, assets, link targets, copy
  fields, and CSS variant IDs
- Page recipes and ordered zones by surface
- Allowed component and copy variants
- Required product metadata
- Desktop and mobile viewports
- Reference-owned empty, error, and model-failure fallbacks
- Visual masks for intentionally dynamic content

Kibble is the first external-reference contract. It should be derived from its
actual storefront sources rather than transcribed into the existing theme
object. Bealls, Bealls Florida, and Home Centric each receive their own brand
contract under one organization policy.

## Cache and provenance

Contract-enabled cache keys must include:

- Organization and brand IDs
- Reference and policy versions
- Surface, route, and viewport class
- Effective capabilities, decision mode, and publication mode
- Catalog or content version
- Shopper context and synthetic-scenario provenance

Every rendered zone must expose operator-facing provenance:

```text
referenceId
referenceVersion
policyVersion
surface and zoneId
renderer component and variant
decision source: fixed | rules | model | merchant | fallback
input hash and catalog version
autonomy preset and effective capabilities
```

Observe should show this record. A cache hit must return the same provenance
envelope that was stored with the decision.

Policy writes require authenticated merchant authority, immutable versioning,
and an audit record containing the previous version, new version, author, and
effective capability diff. A policy update creates a new version; it does not
mutate the meaning of cached decisions produced under an older version.

## Acceptance gates

A brand cannot claim reference preservation until all gates pass.

1. **Contract gate:** the reference, design contract, routes, viewports,
   components, zones, fallbacks, and versions are present.
2. **Determinism gate:** identical fixed inputs produce the same component tree,
   tokens, and zone map in Preserve mode.
3. **Authority gate:** tests prove that every forbidden field, component, zone,
   and order change is rejected.
4. **Visual gate:** approved reference and candidate pages pass desktop and
   mobile structural and screenshot comparisons.
5. **Fallback gate:** model failure, invalid output, missing catalog data, and
   cache misses preserve the reference shell.
6. **Provenance gate:** Observe explains every rendered zone and its source.
7. **Human gate:** a named reviewer approves unmasked differences before the
   reference-preservation claim is published.

A successful build or schema-valid model response does not satisfy these gates.

## Implementation sequence

### Phase 0: Correct the record

Amend both projects so “any brand” means an integrated merchant's configured
brand family. Separate the achieved personalization claim from the unbuilt
reference-preservation claim. Link this plan and its retrospective.

**Files:**

- `aisles/README.md`
- `aisles/docs/{product-vision,multi-brand,architecture,kibble-standalone-plan}.md`
- `bealls-aisles/README.md`
- `bealls-aisles/docs/architecture/{multi-brand.md,engine/composition-taxonomy.md}`

### Phase 1: Add the policy compiler without changing live behavior

Add organization, preset, capability, decision-mode, and publication-mode
types. Compile effective policy by intersection. Add contract tests for
inheritance, narrowing, unknown identifiers, and forbidden expansion.

Legacy brands remain on an explicit compatibility policy. No route changes in
this phase.

Resolve organization and brand identity from trusted server configuration.
Reject client attempts to expand presets or select another policy version.

### Phase 2: Make zone resolution policy-aware

Teach the resolver to accept an effective policy. Fixed zones do not inspect
engine output. Rules and model decisions can change only allowed fields. Replace
the universal engine-first precedence with policy-driven resolution.

### Phase 3: Build the Kibble reference package

Port or adapt the reference tokens, chrome, hero, bundle, proof strip, routine
modules, product cards, and responsive rules. Register them under a versioned
Kibble contract. Preserve the source's semantic token meanings. Record the
source repository and exact commit in the contract. Adapt commerce actions and
data through typed Kibble adapters; do not copy reference links to routes that
Aisles does not implement.

### Phase 4: Integrate Kibble routes

Kibble route coverage is now explicit. Home, product listing, search, and error
surfaces use Preserve. Product listing includes canonical breadcrumbs, trusted
sort controls, and cursor pagination. Cart, account, subscriptions, and the three
canonical checkout phase routes use source-native unavailable shells: they
preserve the source route's anatomy without exposing purchase, account,
subscription, or checkout behavior. The bare `/checkout` path remains the
canonical source's 404.

Product detail has a deterministic catalog-only implementation in Kibble
package `1.7.0`, pinned to source reference contract `1.5.0` and canonical source
`ef122b8e17b9eb0b327c9d42491c44a61577ead4`. Its fixed publication policy is
`live`, and Home, product-listing, search, and related-product cards may link to
it. The route displays validated catalog facts and an explicit purchase-unavailable
state. No route is authorized to present it or the unavailable shells as functional commerce.
Home's ranked-products zone now uses request and session signals to infer one of
the four existing personas. Deterministic rules may rank and select only the
merchant-provided candidate shelf. Header, hero, category module, service proof,
footer, component variants, CSS, and copy remain fixed by the Kibble reference
contract. Enrichment scores stay server-side and are removed before shopper
page data is serialized.

Normal production applies that bounded decision when the Home route renders.
For a prospect-facing demo, the public launcher on every shopper route adds
`?observe=true`, starts a four-hour site-wide observability session, and shows
the current route's visible Template, Rules, and AI authority. Home previews
the latest persisted-session rules decision at
`POST /api/kibble/home-decision?observe=true`. Its separate **Run bounded AI
ranking** control is an opt-in model action, not a normal Home render. The
endpoint is server-authoritative:
it accepts no persona, score, policy, candidate, or product-order input from the
browser. It requires the active Kibble brand, the trusted Home
`reference-preserve` policy, and a valid scoped `aisles_session`; otherwise it
fails closed with `404` for an unavailable surface or `409` for a missing or
unknown session. Its no-store response is versioned and carries sanitized
inference, the score-free zone trace, a runner data-source override when set,
and contracted `rules` provenance for the current scenario. It does not create
or mutate a session, generate a layout, or read or write the layout-decision
cache. The rules preview writes no telemetry or database records. A successful
model action writes its generation telemetry to Postgres after the bounded
provider response is validated. Both read the existing scoped session from the
in-memory session cache or Redis when configured.

The only PDP model action is equally narrow. The Observe rail shows **AI-rank
related products** only on the exact approved route
`/product/puppy-starter-kit`, only while its server-reloaded related rail has
three or four candidates, and only when the demo-model flag is enabled. Its
`POST /api/kibble/pdp-related-decision?observe=true` request accepts only
`{"mode":"model"}`. It reloads that literal PDP on the server, reserves the
same Redis budget before any provider call, and can return only one exact
permutation of those related IDs. Adjacent slugs and browser-supplied route,
candidate, or product facts have no authority. The fixed PDP, heading, copy,
prices, links, actions, component, and CSS do not change.

The behavior simulator is an explicit Home signal-lab control, not a commerce
control. It emits named typed event sequences—category views, product views,
returns, dwell, and search—through `/api/signals`, then requests that
server-derived preview. The lightweight route rail and full Home panel can
collapse, show zone outlines, exit the demo, or open Observe pinned to the same
scoped session. The public launcher makes the demo discoverable without
requiring query-parameter knowledge. The
simulator uses the showcase's pinned synthetic catalog and fit fixture; it does
not create production decision authority or change the fixed Preserve shell.
Keep the current whole-page renderer as an explicit legacy path for brands that
have not adopted contracts. Select the path from trusted server-side brand and
contract data. Kibble Preserve mode server-renders its fixed shell and does not
request the whole-page layout stream. Kibble fallbacks must remain Kibble-native.
Make its navigation, mobile menu, search, cart action, and unavailable account
actions explicit rather than inheriting generic or broken URLs.

### Phase 5: Narrow generation to zone decisions

Derive the prompt and output schema from the effective policy. Support fixed,
rules, and model decision modes. Remove forbidden fields from the model schema
rather than asking the model not to use them. A model may select only exact
server-bound copy values until a separate factual-copy verifier is approved;
source-class labels alone are not authority.

The first executable contracted decision is deliberately the smaller rules case:
Kibble Home can rank and select products, while every other Home zone remains
fixed. Its opt-in model action is now live for the approved Home shelf. The
normal rules preview truthfully reports zero model calls; the model action
reports its actual provider attempts. The PDP related-products model action is
live for only `/product/puppy-starter-kit`. Its production smoke returned one
provider attempt and one exact three-product permutation; the model selected
the existing order in that run, which the inspector reported without claiming
a visible reorder. Each live preview requires a site-wide demo session that
begins with an explicit `?observe=true` request;
the route then re-derives the persisted-session decision server-side rather than
accepting browser-controlled decision data. A separate local showcase supplies
a pinned catalog and clearly labeled synthetic fit scores; its behavior controls
send real typed storefront events through `/api/signals`, are not shopper
controls, and mark the resulting preview provenance synthetic. Demo receipts bind
each control to its exact client sequence, validate the complete inference
response, and include a ten-second uncertain-delivery fail-safe rather than
letting an older response confirm the wrong control. The local transport
normally responds first: it drops an uncertain stalled batch after four seconds
and immediately drains any newer control. The preview has its own ten-second
fail-closed watchdog. The client applies a new shelf only after validating the
complete versioned preview payload, including reference and policy identity,
zone decisions, contracted rules provenance, data-source labeling, and score
absence. Receipt and preview client modules are lazy-loaded only for the opted-in
demo inspector.

### Phase 6: Version cache and provenance

Add reference and policy versions to caches, generation logs, and Observe.
Extend the existing synthetic-cache tests to cover organization, brand,
reference, viewport, and preset isolation. Add the database migration required
for the provenance fields before changing production writes. Scope signal-
session memory and Redis keys by organization and brand, and reject any stored
identity that does not match the active deployment.

### Phase 7: Make parity executable

The local Kibble harness now runs the 15 named route paths at 390px, 768px, and
1280px. It verifies provenance, classified dependencies, structure, and
screenshots. The final local run changed 12,313,565 of 66,597,260 comparable
pixels (18.4896%). All 15 routes and all 45 viewport cells remain open at zero
tolerance. No masks are approved. The ledger names one truthful approval item
for every route so a human can accept a necessary difference without silently
restoring unsupported commerce or service claims. The separate Bealls harness
covers 90 internal brand/route/viewport cells. Its final clean run at
`6b7faee` verifies all 90 active-brand cells, expected status codes, and
applicable zone terminals with zero model requests. Sixty-two cells still
differ visually, totaling 27,989,468 changed pixels, with no masks or approval
threshold. Neither harness grants visual approval; named route-by-route human
review remains the release gate.

### Phase 8: Adopt the contract in `bealls-aisles`

Declare one organization and separate contracts for Bealls, Bealls Florida, and
Home Centric. Translate current behavior into explicit surface and zone
policies before changing it. Do not infer shared visual identity from shared
ownership.

### Phase 9: Add the merchant control surface

Expose presets, per-surface settings, and zone exceptions after the policy is
stable. The control surface writes versioned policies and shows the resulting
capability diff. It cannot grant authority above the organization maximum.

The first `aisles-admin` slice is deliberately a sandbox. It runs on a dedicated
authenticated route and does not mount the legacy dashboard, Inspector, or
workspace switcher. It does not save or publish policy. Moving it into the
shared dashboard requires a tenant key for `generation_logs` plus the
runtime-owned policy storage contract described above.

## Execution map

Work proceeds in isolated worktrees. The status below records implementation
state. A row names merge or deployment only when this plan also pins that
evidence. It does not imply a database migration or human visual acceptance.

| Slice | Repository and ownership | Local state |
|---|---|---|
| A | `aisles`: policy types/compiler/tests in `src/lib/foundation` | Implemented and integrated |
| B | `aisles`: README and existing documentation amendments | Implemented and integrated |
| C | `bealls-aisles`: scope corrections, policies, and internal renderer contracts | Implemented and integrated; external-reference state remains `uncontracted` |
| D | `aisles`: Kibble reference components and CSS | Implemented and integrated; source pinned to a local canonical commit |
| E | `aisles`: Kibble route and renderer integration | Home, product listing, catalog-display-only product detail, search, and errors integrated in Preserve; cart, account, subscriptions, and the three canonical checkout phase routes are source-native unavailable shells; bare `/checkout` remains the source 404 |
| F | `aisles`: generation schema/prompt/API/cache/provenance | Implemented and integrated for live contracted surfaces, including fixed product-detail provenance |
| G | Both repos: deterministic and visual parity suites | Kibble's 15-route × 3-viewport harness and Bealls's 90-cell internal regression harness are implemented and code-reviewed; both strict visual comparisons and named human approval remain open |
| H | `aisles-admin`: merchant control surface | Dedicated read-only sandbox integrated; versioned runtime writes and audit storage remain unbuilt |
| I | `aisles`: Kibble decision proof | Home rules ranking plus the opt-in Home and exact-route PDP model rankings are deployed and live-verified. The isolated local showcase remains provider-free. |

## Compatibility and rollout

- Missing policy version means explicit `legacy_generated_v1`; it does not imply
  reference preservation.
- Existing Haven, Volt, and Ember behavior stays unchanged during Phases 1–3.
- Kibble is the first Preserve contract and the first parity acceptance case.
- Bealls-family behavior is described before it is migrated.
- Every policy or reference change bumps a version used by caches and logs.
- Deployment and public capability claims remain separate from merged code.

## Completion definition

The plan is not complete when the files compile. It is complete when:

- Both repositories state the corrected organization/brand boundary.
- Organization, brand, surface, and zone policy is executable.
- Kibble Preserve mode renders the approved reference contract.
- Model authority is absent from forbidden fields by schema construction.
- Cache and Observe carry reference and policy provenance.
- Desktop and mobile parity gates pass for the named Kibble routes.
- Bealls-family behavior is represented by explicit per-brand contracts.
- The merchant-facing autonomy control writes and explains versioned policy.

Until then, the safe claim is: Aisles personalizes inside pre-integrated
storefront systems. Reference-repository preservation is under construction.
