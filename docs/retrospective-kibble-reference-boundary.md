# Retrospective: Kibble Exposed the Missing Merchant Boundary

**Date:** 2026-08-12

**Scope:** `aisles`, `bealls-aisles`, and the Kibble reference storefront

**Outcome:** Architecture and product claims require amendment

**Baseline reviewed:** `aisles` `0067f40`; `bealls-aisles` `48cb33f`

**Follow-up plan:** [`organization-brand-autonomy-plan.md`](./organization-brand-autonomy-plan.md)

## Corrective execution checkpoint

The retrospective's finding still stands, but the missing architecture is no
longer only a proposal. Local follow-up work now includes:

- corrected capability claims in both repositories;
- an executable organization, brand, surface, and zone policy compiler;
- a trusted policy-aware resolver and bounded zone-decision schema;
- a version-pinned Kibble design contract with native chrome, components,
  page recipes, and fallbacks;
- Kibble Preserve rendering on Home, product-listing, search, and error
  surfaces, with fixed product-listing structure, trusted sorting, and cursor
  pagination;
- a deterministic catalog-only product-detail implementation in Kibble package
  `1.8.0`, pinned to source reference contract `1.5.0`, published read-only with
  purchase, cart, checkout, subscription, and savings actions disabled;
- a 15-route Kibble comparison harness at 390, 768, and 1280 pixels, plus a
  90-cell Bealls-family internal regression harness;
- an exact Kibble terminal classification for all 28 zone families and 36
  expanded Bealls identities: 11 content-backed Kibble-native adapters and 25
  Trusted Hidden terminals;
- separate Bealls-family internal renderer contracts that still label external
  reference preservation as `uncontracted`;
- a dedicated, authenticated `aisles-admin` Autonomy Sandbox that explains
  narrowing without saving or publishing policy;
- reference/policy provenance in cache values, generation logs, and Observe;
- bounded, signal-informed product ranking inside the fixed Kibble Home recipe,
  with enrichment scores kept on the server;
- an explicit demo inspector showing inference, zone authority, before
  and after product order, policy provenance, and the truthful rules/model
  call count after a persisted allowed signal; and
- an isolated local showcase using a pinned catalog and visibly labeled
  synthetic persona-fit data, with production data connections blanked.

Kibble product detail is approved for live catalog-display-only navigation, but
the corrective work still does not establish full visual parity or functional commerce. Cart, account,
subscriptions, and the three canonical checkout phase routes are contracted
source-native unavailable shells; the bare `/checkout` path remains the
canonical source's 404. They preserve route anatomy without claiming functional
commerce. The final Kibble cold-review defects are closed locally. The strict
15-route, three-viewport matrix still leaves all 15 routes and all 45 cells open:
12,313,565 of 66,597,260 comparable pixels differ (18.4896%), with no masks and
one named approval item per route. Route-by-route human visual approval,
merchant runtime policy writes and audit storage, migration/deploy/live
database-provider verification, and Bealls external-reference contracts remain
open.
The normal Home proof uses deterministic rules. Its separate **Run bounded AI
ranking** control is a live, opt-in Assist action with its own exact policy,
provider budget, and permutation validation. The only PDP Assist action is the
`pdp.related` rail on `/product/puppy-starter-kit`; it can reorder only the
three-to-four server-reloaded related candidates. Both keep the
reference-owned shell unchanged.
The PLP first-eight ranking action had one bounded production smoke on merge
`571e203`, not visual-parity acceptance. At
`/category/dog-food?sort=FEATURED&observe=true` against contract/reference
`1.8.0`, its baseline was 10 products, 5 Template zones, and 0 AI calls. One
action returned Rustic Stew, Goodbowl, Harvest Chicken Hearty Stew, Epic Blend
Salmon, RawMix Great Plains, GoodGut Wild-Caught Salmon, Harvest Chicken Air
Dried, Salmon & Cod; tail positions 9 GoodGut Harvest Chicken and 10 GoodGut
Grass-Fed Beef stayed fixed. The rail showed 4 Template / 0 Rules / 1 AI and
the grid reported `plp.product-ranking` authority `model`, one call, `live`,
adapter `kibble.zone.plp.product-ranking`, and variant
`kibble.category-listing.ranked-prefix`. `observe=false` removed the rail/action
and its POST endpoint returned `404 Not found`. The boundary remains restricted
to the exact FEATURED, null-cursor route; it is not cart or subscription
capability evidence.
Normal production applies that decision at the Home route boundary. The public
demo begins only with an explicit `?observe=true` request, then keeps a
lightweight observability rail active across shopper navigation for four hours.
The full Home signal lab can call
`POST /api/kibble/home-decision?observe=true` to preview the current scoped-session
decision. The endpoint derives inference and the approved nine-product shelf on
the server. It fails closed without the active Kibble brand, the trusted
`reference-preserve` Home policy, or a valid `aisles_session`; it accepts no
browser-supplied persona, policy, scores, candidates, or order. The no-store,
versioned preview exposes sanitized inference, a score-free zone trace, runner
data-source labeling, and contracted provenance. The normal rules preview does
not call a model and writes no telemetry. A successful opt-in model action logs
generation telemetry to Postgres after validation. Neither path generates a
layout, mutates the session, or reads or writes the layout-decision cache. Both
read the existing scoped session from the in-memory session cache or Redis when
configured.

The behavior simulator is an explicit Home signal-lab control, not a commerce control. It
emits recognizable typed event sequences through `/api/signals`, then requests
the server preview. The site-wide rail is discoverable from a public demo
storefront control, can collapse, show zone outlines, or exit, and opens Observe
pinned to the same session.
Each demo receipt is correlated to the exact client sequence and strictly
validates the returned inference. It has a
ten-second uncertain-delivery fail-safe. The showcase transport normally
restores the controls first: it drops an uncertain stalled batch after four
seconds and immediately drains a newer control. The preview request
independently fails closed after ten seconds and retains the approved shelf.
Before changing the shelf, the client validates the complete versioned preview:
reference and policy identity, data-source label, zone decisions, contracted
rules provenance, and score absence. These receipt and preview client modules
load only when the inspector is open. The local showcase catalog and
fit values are pinned synthetic fixtures. They do not change production
authority, and the Preserve
shell remains fixed.
The reference and candidate expose matching source-owned fixture markers, and
the fail-closed comparison command covers the named 15-route matrix. Its latest
strict run leaves all 45 viewport cells open at 18.4896% weighted pixel
difference. Its mechanical screenshots and structure reports are evidence, not
visual approval. No masks or tolerances have been approved, and named
route-by-route human approval is still open.

`bealls-aisles` records each family member separately and now binds its current
renderer inputs to versioned internal contracts. Those records are inventory,
not external-reference contracts. Its final clean internal run at `6b7faee`
mechanically covered all 90 brand, route, and viewport cells with exact zone
coverage, zero model requests, and no provider/database traffic. Sixty-two
cells still differ visually, totaling 27,989,468 changed pixels with no masks.
That evidence needs human review and does not change the fact that all three
brands still report external-reference preservation as `uncontracted`.

These are post-baseline corrections. They do not change what the original
repositories could claim at the commits reviewed below.

## Conclusion

Kibble did not expose a random styling defect. It exposed a missing product
boundary.

`bealls-aisles` grew into an organization-specific implementation for a family
of related retail brands. Its configuration model was then interpreted as a
general merchant-onboarding model. The generic `aisles` repository preserved
that assumption and treated Kibble as another theme, catalog, and prompt.

That was enough to produce correct pet products and plausible Kibble copy. It
was not enough to preserve Kibble's storefront. The implementation had no
runtime representation of Kibble's component anatomy, page recipes, responsive
rules, or semantic design constraints.

The correction is not “match the CSS more closely.” Aisles needs an explicit
organization boundary, a versioned design contract per brand, and a merchant-
controlled policy defining what the engine may change.

## What “any brand” meant

The operator clarified that the intended Bealls claim was narrower than the
phrase later suggested:

```text
one merchant organization
├── Bealls
├── Bealls Florida
└── Home Centric
```

Those brands share ownership, commerce infrastructure, and organization-level
patterns. They do not prove that the same runtime config can absorb an unrelated
merchant such as Kibble, Nike, or Walmart while retaining its existing site.

The repositories did not encode or consistently state that boundary. Both used
language such as “same engine can be any brand,” “a brand is configuration,” and
“no component-level changes.” A cold reader could reasonably understand those
statements as cross-merchant portability.

## What happened

The relevant sequence is visible in repository history.

1. The original storefront extracted Haven-specific values into a multi-brand
   configuration (`bealls-aisles` history, `69bcf63`).
2. The same codebase was specialized for the Bealls family and received
   Bealls-specific components, price language, incentives, zones, and chrome.
3. Haven, Volt, and Ember were later removed from that implementation
   (`bedf148`, `564eb28`), reinforcing that it had become a merchant-family
   storefront rather than a universal reference-preservation platform.
4. The public generic `aisles` repository retained the earlier multi-brand
   story and generic renderer.
5. Kibble was added as palette, fonts, copy, category mapping, catalog context,
   and prompt guidance (`09e074b`).
6. Generic sections were ported from `bealls-aisles` (`168a41b`), and the zone
   foundation followed (`10394eb`).
7. The homepage was then placed on the whole-page generation path (`cab292b`).

The result was deterministic at the architecture level: Kibble data entered a
generic Aisles renderer, so the page looked like generic Aisles.

## Intended and implemented contracts

```text
Needed
reference repository
  → versioned design contract
  → brand-native components and page recipes
  → Aisles decisions inside approved zones

Implemented
manual brand config and catalog
  → shared prompt and schema
  → generic component renderer
  → model-selected whole-page composition
```

The original Kibble release goal concentrated on standalone catalog,
enrichment, signals, data isolation, database access, observability, and
deployment. Those areas were real work and remain valid. Visual parity was not
an acceptance gate, so completing the written plan did not establish the
stronger reference-preservation capability.

## Contributing decisions

### The organization boundary stayed implicit

`bealls-aisles` described a family of brands but also claimed the same engine
could be any brand. No `organizationId` or organization policy distinguished
intra-merchant configuration from integrating another merchant's design
system.

**Consequence:** A merchant-family proof was generalized into a platform claim.

### Brand configuration represented only a slice of visual identity

The runtime config carries colors, fonts, categories, copy, prompts, and some
commercial settings. It does not carry a full type and spacing scale, radii,
shadows, responsive chrome, component anatomy, page recipes, or semantic rules.

The Kibble source includes those rules. Aisles did not ingest it. Human
transcription reduced the reference to what the existing config could hold.

**Consequence:** Kibble's colors and words survived; its design grammar did not.

### The generic component vocabulary became the design system

The model can choose only registered components, which is a useful structural
safety guarantee. But those registered components belong to Aisles's shared
renderer. Schema validity says the output can render. It does not say the output
belongs to Kibble.

**Consequence:** A valid result could still be visually wrong for the merchant.

### The zone foundation and the production route diverged

The zone system models stable slots and fallbacks. The generic Aisles production
routes do not use it. The homepage passes a model-selected `sections[]` array to
the whole-page renderer instead.

**Consequence:** The narrower mechanism that could preserve a merchant scaffold
was present but did not govern the page Kibble shipped.

### Prompt guidance carried authority it could not enforce

Kibble-specific prompt text changes product and content guidance. It does not
change the component registry, page recipe, header, product-card contract, or
responsive layout.

**Consequence:** The model could sound like Kibble while remaining structurally
generic.

### Release checks stopped at functional validity

The implementation passed type checks, builds, focused tests, security review,
and deployment checks. There was no executable comparison against the approved
Kibble storefront at desktop and mobile widths.

**Consequence:** Functional success was reported separately from a visual
capability that had never been tested.

## What worked

This retrospective does not invalidate the complete Kibble effort.

- Catalog and pet-specific enrichment became brand-aware.
- Kibble signal rules were gated from other brands.
- Database records and uniqueness became brand-scoped.
- Runtime database access, RLS, and role privileges were hardened.
- Synthetic activity was separated from real cache and learning paths.
- Observe received server-side access control.
- Paid enrichment publication became atomic and auditable.
- The storefront deployed with real Kibble catalog data.
- Kibble Home can now turn inferred intent into a bounded product-order change
  without granting layout, component, CSS, copy, or commerce authority.
- The local decision inspector makes that boundary visible and reports zero
  model calls in Preserve mode.

Those changes establish a stronger operational base. They do not establish
visual preservation.

## What failed

The failed acceptance case was:

> Given an existing storefront reference, apply Aisles while retaining the
> merchant's visual and interaction system.

The repository had no artifact that represented that promise. There was no
reference manifest, component map, deterministic page recipe, autonomy policy,
or parity gate. The system therefore could not satisfy the promise by accident
or by construction.

## Corrective decisions

1. **Organization and brand become separate concepts.** Related brands may
   share organization policy without sharing visual contracts.
2. **Reference integration becomes a named onboarding tier.** Theme config is
   not presented as reference preservation.
3. **A design contract becomes executable.** Tokens, chrome, components,
   recipes, responsive behavior, variants, and fallbacks are versioned inputs.
4. **Autonomy is an allow-list.** The merchant controls authority by surface
   and zone.
5. **Decision mechanism is a separate field.** Fixed data, deterministic rules,
   and models can operate inside the same capability envelope.
6. **Models return zone decisions, not arbitrary UI.** Forbidden fields are
   absent from the schema.
7. **Fallbacks remain merchant-native.** A failed model does not reveal a
   generic Aisles shell.
8. **Parity is a release gate.** Desktop and mobile component, token, and
   screenshot checks accompany human review.

## Repository amendments

### `aisles`

- Narrow cross-brand claims in `README.md`, `docs/product-vision.md`,
  `docs/multi-brand.md`, and `docs/architecture.md`.
- Record that the standalone Kibble plan did not prove visual parity.
- Make the existing zone foundation executable in production routes.
- Add organization, design-contract, and autonomy-policy types.
- Treat the current whole-page renderer as an explicit compatibility mode.

### `bealls-aisles`

- State that the repository is an example merchant-family implementation.
- Remove the claim that tokens and fonts eliminate component-level work for an
  external merchant.
- Record Bealls, Bealls Florida, and Home Centric as separate configurations
  under one organization, then give each an explicit design contract during
  preserve-mode adoption.
- Translate current surface latitude into explicit policies before changing
  behavior.

## Evidence reviewed

The conclusion was re-derived from current source and history, including:

- Both repositories' READMEs and multi-brand guides
- `BrandConfig` and runtime theme injection in both repositories
- Aisles layout schema, prompt, renderer, routes, zones, and resolver
- Kibble's reference tokens, header, homepage composition, and brand kit
- Commit history for multi-brand extraction, Bealls specialization, Kibble
  configuration, section ports, zone ports, and homepage generation
- The supplied side-by-side storefront screenshot

No remote deployment was changed during this retrospective. Current live
behavior remains separate from the local source findings.

## What would change this conclusion

The conclusion should be revisited if any of the following evidence appears:

- A runtime-consumed Kibble reference contract predating the current config
- Production routes that render Kibble-native recipes independently of the
  generic whole-page renderer
- Desktop and mobile parity tests that compare the approved reference with the
  generated site and already block release
- Product documentation that clearly limited “any brand” to a single merchant
  organization before Kibble was planned

The reviewed baseline commits contained none of those mechanisms. Corrective
work after those commits should be measured against the linked plan rather than
read back into this retrospective.

## Lasting lesson

A schema can prove that generated UI is valid without proving that it belongs
to the merchant. Future Aisles work must protect both properties.
