# Kibble on Aisles — standalone plan

**Status:** proposed, 2026-08-12. Nothing here is built yet.
**Audience:** whoever picks this up next, including a future session with no memory of today.

## Recommendation

Give Kibble its own **Supabase Postgres** project, rebuild the product-enrichment
vocabulary for pet supplies, and add a signal layer that captures the thing this
storefront is actually about — subscription replenishment — which no previous
Aisles brand had. Budget the enrichment rebuild and the signal work separately;
the database is a day, the other two are the real project.

Do not reuse the Neon database. It is Vercel-era legacy, it belongs to
`bealls-aisles`, and sharing it is unsafe for a mechanical reason given below.

## Why Kibble cannot share the existing database

Three reasons, in order of how hard they are to argue with.

**Product IDs collide.** `enriched_products.bc_entity_id` is `INTEGER UNIQUE`
with no store or brand column (`src/lib/server/enrichment/enrich.ts`). Kibble and
Bealls are different BigCommerce stores whose product IDs are independent
integers, so the same ID means a different product in each catalog. One table for
both means rows silently overwrite each other. This alone settles it.

**The public site would display private data.** `/observe` on the public Kibble
storefront reads `generation_logs`. Sharing the database renders Bealls personas,
categories, and per-request costs on a public page.

**The vocabulary is furniture-shaped.** Enrichment extracts `material` ("solid
walnut", "performance velvet"), `style` ("mid-century modern"), and `dimensions`.
Run that over dog food and every column comes back null. What discriminates a
pet-supply catalog is protein source, life stage, format, dietary restriction,
and — because Auto-Refill is the product — how well an item suits a standing
order.

## Where the data should live

**Supabase**, one project per brand, `aisles-kibble` first.

The reason is the analytics loop, not the storefront. The inference engine is
designed to learn: `session_outcomes` feeds a weight-fitting script
(`scripts/fit-inference-lrs.ts`) and a calibration check
(`scripts/calibration-check.ts`), both of which run as local Node scripts against
the database. That workflow wants a connection string and real Postgres. The
current schema also leans on Postgres types throughout — `TEXT[]` for
`semantic_tags`, `compatible_with`, and `rule_matches`; `JSONB` for
`probabilities_final` and `prior_at_start`.

**Why not Cloudflare D1**, given Cloudflare is the default everywhere else:
D1 is SQLite, so every array becomes a JSON string, every `= ANY($1)` becomes a
generated `IN` list, and `JSONB` becomes `TEXT` — a rewrite of all 22 SQL
statements, and a worse offline story for the fitting scripts, which would have
to go through `wrangler d1 execute` or the HTTP API instead of `psql`. D1 stays
the right answer for the bc-subscriptions API, which is transactional and
edge-read-heavy. This workload is analytical.

**What D1 would have bought, and how to get it anyway:** a binding cannot be
silently absent the way `DATABASE_URL` was — that failure is exactly why
enrichment and telemetry were dark for weeks with every check green. Recover it
in Supabase by failing loudly: `getDb()` should throw at startup when the
connection string is missing, and the enrichment and logging call sites must stop
swallowing errors into empty results.

Reference implementation for the client: `photography/src/lib/supabase/server-ssr.ts`.
Credential goes in 1Password as `Supabase aisles-kibble`, field `credential`,
following the existing `<Service> <project-slug>` convention.

## What has to be rebuilt versus ported

| Piece | Verdict | Why |
|---|---|---|
| Persona-fit scoring (four scores per product) | **Port unchanged** | Catalog-agnostic. The four personas are behavioral, not domain-specific. |
| Semantic tags | **Port the mechanism, replace the vocabulary** | The field survives; what goes in it does not. |
| Attribute extraction (`material`, `style`, `dimensions`) | **Rebuild** | Furniture vocabulary. Returns null for every pet product. |
| `price_tier` | **Port with new thresholds** | Budget/mid/premium/luxury bands are catalog-relative. |
| `compatible_with` | **Rebuild** | Currently pairs furniture by style. For pet supplies it should pair by pet profile — size, life stage, dietary restriction. |
| Inference rules (67 weighted) | **Port, then gate** | Bealls established per-brand rule gating; Kibble needs the same, because rules tuned on apparel browsing do not transfer to replenishment. |
| Generation logging, session outcomes, search | **Port unchanged** | Schema is brand-neutral. Add a `brand_id` column anyway so a future second brand cannot repeat the collision above. |

### The Kibble enrichment schema

Replace the furniture columns with these. Keep the four fit scores, the tags, and
the price tier.

- `protein` — beef, chicken, salmon, turkey, plant, mixed, none
- `life_stage` — puppy, adult, senior, all
- `format` — dry, wet, air-dried, freeze-dried, treat, supplement, hardgood
- `dietary` — grain-free, limited-ingredient, prescription, none
- `pet_size` — toy, small, medium, large, any
- `replenishment_days` — typical consumption window for one unit, the field that
  makes a cadence recommendation possible at all
- `subscription_fit` — 0–1, how well the item suits a standing order. A 24-pound
  bag of kibble scores high; a chew toy does not.

`replenishment_days` and `subscription_fit` are the two fields no previous Aisles
brand had, and they are the ones that let the storefront merchandise Auto-Refill
rather than just display it.

**Catalog correction, 2026-08-12:** Kibble has chicken recipes and air-dried food,
so both are explicit enum values. The observed catalog range is $9–$240 (49
products): budget under $20, mid $20–$49.99, premium $50–$99.99, and luxury
$100 or more. These bands are calculated in code, not chosen by the model.

## Signals

### What exists and works

Six signal sources are declared (`src/lib/signals/types.ts`), and the request,
navigation, interaction, commerce, and refinement families are wired. Sixty-seven
weighted rules feed a Bayesian posterior over four personas. Session outcomes are
captured at `/api/signals/finalize`. The loop is complete in code and has never
run against a database.

### What is declared and unwired

`external` — "Server-side, from CDP/BC/third-party" — is a type with no producer.
That is the natural seam for injected demo signals, and it should stay explicitly
labeled as such so injected data can never be mistaken for observed data.

### Subscription signals to add

These are Kibble-specific and are the reason this storefront is worth building
separately rather than reskinning Haven:

- `subscription.cadence_selected` — the shopper picks 1/2/3 months
- `subscription.skip`, `subscription.swap`, `subscription.pause` — the control
  actions the whole value proposition rests on
- `subscription.due_proximity` — days until the next shipment; a shopper three
  days out behaves differently from one three weeks out
- `subscription.tenure` — months subscribed, a strong familiarity prior
- `commerce.autoship_mix` — share of cart on a standing order versus one-time

A shopper reordering a known item on a standing order is not a hunter in the
Haven sense. Expect the four-persona taxonomy to strain here; treat that strain
as a finding worth writing down rather than a bug to paper over. Do not add a
fifth persona before the data says the four cannot separate the behavior.

### Injected signals, for demos

Borrow the shape of the Sleep Country work — real behavior, sanitized, used as
calibration ground truth offline — without borrowing its data, which came from a
real retailer.

Three mechanisms, in increasing order of honesty required:

1. **Scenario fixtures.** Named seeded sessions ("first-time puppy owner",
   "lapsed subscriber returning", "price-checking reorder") that replay a fixed
   signal sequence. Deterministic, demoable offline, and no claim about real
   behavior. This is the one to build first.
2. **`?intent=` labeling**, already supported as a `label_source` in
   `session_outcomes`. Useful for forcing a persona during a walkthrough.
3. **Synthetic session generation** for populating `/observe` so the dashboard is
   not empty on first load.

**Every injected signal must be labeled as injected, in the database and on
screen.** `session_outcomes.label_source` already distinguishes `intent_param`
from `conversion` and `behavior_pattern`; extend that discipline to a
`synthetic` flag on generation logs and sessions. The failure this prevents is
a demo dashboard that reads as measured traffic.

**Calibration status must never be overstated.** `learned-weights.json` is
`fittedAt: null, totalSessions: 0` — the shipped engine runs hand-tuned weights.
The Sleep Country calibration lives on an unmerged branch and never applied to
these weights. Public copy currently says "31 weighted rules feed a Bayesian
engine", which is accurate. It stays accurate until a real fit has run.

## Order of work

1. Provision Supabase `aisles-kibble`; store the credential in 1Password; set it
   on the Pages project. Make `getDb()` fail loudly when it is missing.
2. Port the four tables, adding `brand_id` to each.
3. Rebuild the enrichment schema and prompt for pet supplies; run the pipeline
   across the Kibble catalog; verify persona-fit scores actually vary by product
   rather than defaulting to 0.5.
4. Confirm `/observe` shows real rows, and that the layout prompt receives
   per-product fit scores.
5. Add the subscription signal family and its rules, gated to the Kibble brand.
6. Build scenario fixtures for demos, labeled synthetic end to end.
7. Only then consider fitting weights from outcomes — and only if real sessions
   exist in a volume that makes fitting meaningful.

Steps 1–4 restore what is currently dark. Steps 5–6 are what make the demo
argue its own thesis.

## What would change this plan

- If Kibble's BigCommerce catalog turns out to carry usable structured
  attributes already, step 3 shrinks to a mapping job instead of an LLM
  enrichment run.
- If the four-persona taxonomy cannot separate replenishment behavior once
  subscription signals exist, the taxonomy is the thing to revisit, not the
  rules.
- If a second brand is never added, the `brand_id` columns are dead weight —
  cheap insurance, but say so rather than pretending they earn their place.

## What was checked, and when

Verified 2026-08-12 by reading the code, not prior summaries: the enrichment
table's `bc_entity_id UNIQUE` constraint and furniture vocabulary
(`src/lib/server/enrichment/enrich.ts`); 22 SQL statements across six files;
`TEXT[]` and `JSONB` usage; the six declared signal sources and the absent
`external` producer; `session_outcomes` wired at `/api/signals/finalize`;
`learned-weights.json` empty; the Pages project's environment variables, which
contain no database credential. The Neon host was read from the 1Password item
`Postgres bealls-aisles`, whose own note records it as belonging to
`bealls-aisles`.

Not checked: whether the Kibble BigCommerce catalog carries structured custom
fields that would shortcut enrichment. Worth one query before step 3.
