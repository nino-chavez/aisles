# Organization, Brand, and Composition Autonomy Plan

**Status:** In staged implementation; reference-preservation acceptance is incomplete

**Date:** 2026-08-12

**Applies to:** `aisles`, `bealls-aisles`, and the bounded `aisles-admin` sandbox
**Canonical owner:** `aisles`

## Implementation checkpoint

The plan is not complete. The corrective implementation is integrated in the
three local main checkouts. Nothing in this execution has been pushed or
deployed, and no database migration has been applied.

| Phase | Local state on 2026-08-12 | Remaining gate |
|---|---|---|
| 0 — correct the record | Integrated in Aisles and Bealls Aisles | Publish the amended claims with the code |
| 1 — policy compiler | Implemented in Aisles; Bealls-family policies record observed legacy behavior | Production adoption beyond the Kibble slice |
| 2 — policy-aware resolver | Implemented and tested as an opt-in path | Migrate each contracted route and zone |
| 3 — Kibble reference package | Pinned contract, native components, CSS, recipes, fallbacks, PDP dependency closure, and safe bundle projection implemented | Approved route-by-route visual comparison |
| 4 — Kibble routes | Home, product listing, and error surfaces render the Preserve path locally; Home now applies bounded signal-informed product ranking without changing its reference shell; product detail is implemented for development review only | Approve product-detail visual parity and human acceptance before publication; complete search, cart, and checkout contracts |
| 5 — bounded zone decisions | Strict policy-derived schema, trusted materialization, and fail-closed source binding implemented; Kibble Home uses the approved deterministic rules path for `rank_products` and `select_products` | Enable model decisions only when a contracted model-backed zone is approved |
| 6 — cache and provenance | Versioned cache/log/Observe code, an additive migration, actual Home and product-listing Preserve records, and a Home decision trace implemented | Apply the migration and verify the deployed runtime |
| 7 — executable parity | A real zero-tolerance Home comparison now runs at 390, 768, and 1280 pixels. Reference colors, type, heading metrics, content geometry, and header geometry match. The gate still fails on named truth and accessibility differences. | Approve explicit masks and tolerances, then complete the named route matrix and human review |
| 8 — Bealls adoption | Separate brand policies and versioned internal renderer contracts are integrated for Bealls, Bealls Florida, and Home Centric. All remain explicitly `uncontracted` for external-reference preservation. | Add approved external-reference contracts and visual gates before making a preservation claim |
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

Render ordered reference zones on the Kibble home surface first. Product listing
enters Preserve only after its canonical breadcrumbs, sort controls, cursor
pagination, and load-more behavior pass the same contract gate.
Product detail now has a deterministic catalog-only implementation pinned to
Kibble contract `1.5.0` and canonical source
`ef122b8e17b9eb0b327c9d42491c44a61577ead4`. Its publication policy remains
`approval_required` while visual approval is open. Development builds may render
the fixed review surface, but live builds fail into the Preserve error shell.
Home and product-listing cards remain non-links until that acceptance and policy
gate moves to approved and live.
Home's ranked-products zone now uses request and session signals to infer one of
the four existing personas. Deterministic rules may rank and select only the
merchant-provided candidate shelf. Header, hero, category module, service proof,
footer, component variants, CSS, and copy remain fixed by the Kibble reference
contract. Enrichment scores stay server-side and are removed before shopper
page data is serialized.

Normal production applies that bounded decision when the Home route renders.
For an engineer's explicit local inspection, compile-time development mode plus
`?dev=true` may immediately preview the latest persisted-session decision at
`POST /api/kibble/home-decision?dev=true`. The endpoint is server-authoritative:
it accepts no persona, score, policy, candidate, or product-order input from the
browser. It requires the active Kibble brand, the trusted Home
`reference-preserve` policy, and a valid scoped `aisles_session`; otherwise it
fails closed with `404` for an unavailable surface or `409` for a missing or
unknown session. Its no-store response is versioned and carries sanitized
inference, the score-free zone trace, a runner data-source override when set,
and contracted `rules` provenance for the current scenario. It does not create
or mutate a session, call a model, generate a layout, read or write the
layout-decision cache, write telemetry, or write a database. It does read the
existing scoped session from the in-memory session cache or Redis when
configured.

The local synthetic rehearsal buttons are development inspector controls, not
shopper controls. They emit real allowed `nav.search` events through
`/api/signals`, then request that server-derived preview. They use the showcase's
pinned synthetic catalog and fit fixture; they do not create a production
decision authority or change the fixed Preserve shell.
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
fixed. A development-only inspector shows the inference, policy, permitted
capabilities, input and output order, and zero model calls. Its live preview
requires both compile-time development mode and an explicit `?dev=true` request;
the route then re-derives the persisted-session decision server-side rather than
accepting browser-controlled decision data. A separate local showcase supplies
a pinned catalog and clearly labeled synthetic fit scores; its rehearsal buttons
send real `nav.search` signals through `/api/signals`, are not shopper controls,
and mark the resulting preview provenance synthetic. Development receipts bind
each control to its exact client sequence, validate the complete inference
response, and fail with uncertain-delivery copy after ten seconds rather than
letting an older response confirm the wrong control.

### Phase 6: Version cache and provenance

Add reference and policy versions to caches, generation logs, and Observe.
Extend the existing synthetic-cache tests to cover organization, brand,
reference, viewport, and preset isolation. Add the database migration required
for the provenance fields before changing production writes. Scope signal-
session memory and Redis keys by organization and brand, and reject any stored
identity that does not match the active deployment.

### Phase 7: Make parity executable

Add desktop and mobile reference fixtures, component-tree assertions, computed
token checks, and screenshot comparisons. Force failure and cache-hit paths
through the same suite. Include header actions, mobile navigation, Kibble-aware
search and empty states, and fixed-shell server rendering in the acceptance
matrix; a home-only screenshot is not route parity.

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

Work proceeds in isolated worktrees. The status below records local execution,
not merge, publication, deployment, migration, or human acceptance.

| Slice | Repository and ownership | Local state |
|---|---|---|
| A | `aisles`: policy types/compiler/tests in `src/lib/foundation` | Implemented and integrated |
| B | `aisles`: README and existing documentation amendments | Implemented and integrated |
| C | `bealls-aisles`: scope corrections, policies, and internal renderer contracts | Implemented and integrated; external-reference state remains `uncontracted` |
| D | `aisles`: Kibble reference components and CSS | Implemented and integrated; source pinned to a local canonical commit |
| E | `aisles`: Kibble route and renderer integration | Home, product listing, and errors integrated; product detail implemented for development comparison but pending visual approval and unavailable in live publication; remaining routes fail closed |
| F | `aisles`: generation schema/prompt/API/cache/provenance | Implemented and integrated for live contracted surfaces and the approval-gated product-detail review path |
| G | Both repos: deterministic and visual parity suites | Real Kibble Home comparison executed and correctable geometry drift resolved; approval and remaining-route comparisons stay open |
| H | `aisles-admin`: merchant control surface | Dedicated read-only sandbox integrated; versioned runtime writes and audit storage remain unbuilt |
| I | `aisles`: Kibble Home decision proof | Bounded rules ranking, explicit dev inspector, and isolated synthetic local showcase implemented; no model-backed Preserve zone is approved |

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
