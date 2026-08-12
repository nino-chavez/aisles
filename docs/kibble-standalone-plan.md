# Kibble on Aisles — standalone plan

**Status:** implementation in progress, 2026-08-12. The standalone Supabase project and all additive migrations are live. Pet enrichment, Kibble subscription rules, and labeled scenario fixtures are built and verified locally. The paid catalog run and production deployment remain gated.
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

**Product IDs could collide without brand scoping.** Kibble and Bealls are
different BigCommerce stores whose product IDs are independent integers. The
implemented schema prevents that with `UNIQUE (brand_id, bc_entity_id)`; Kibble
still keeps its own project so operational data and credentials remain isolated.

**The public site would display private data.** `/observe` on the public Kibble
storefront reads `generation_logs`. Sharing the database renders Bealls personas,
categories, and per-request costs on a public page.

**The old vocabulary was furniture-shaped.** It extracted `material` ("solid
walnut", "performance velvet"), `style` ("mid-century modern"), and `dimensions`.
The replacement extracts protein source, life stage, format, dietary restriction,
pet size, replenishment cadence, and Auto-Refill fit. Legacy columns remain only
to keep the current production build compatible during the rollout.

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

The implementation uses `postgres.js` through Cloudflare Hyperdrive rather than
the Supabase browser or SSR client. That preserves the direct SQL path required by
the fitting scripts and the existing Postgres arrays and JSONB queries. The owner
credential and restricted `aisles_app` runtime credential live in the existing
`Supabase aisles-kibble` 1Password item.

## What has to be rebuilt versus ported

| Piece | Verdict | Why |
|---|---|---|
| Persona-fit scoring (four scores per product) | **Port unchanged** | Catalog-agnostic. The four personas are behavioral, not domain-specific. |
| Semantic tags | **Port the mechanism, replace the vocabulary** | The field survives; what goes in it does not. |
| Attribute extraction (`material`, `style`, `dimensions`) | **Rebuilt locally** | Pet profile and replenishment fields replace the furniture vocabulary after deployment. |
| `price_tier` | **Ported with new thresholds** | Budget/mid/premium/luxury bands now follow the observed Kibble catalog. |
| `compatible_with` | **Rebuilt locally** | Suggestions now rank shared pet profile, price tier, and replenishment cadence before the model sees candidates. |
| Inference rules (31 base + 7 Kibble) | **Port the base; gate the additions** | The seven subscription rules run only when `brand_id` is Kibble. Their hand-tuned weights remain hypotheses until real outcomes exist. |
| Generation logging, session outcomes, search | **Ported with scoping and provenance** | Every query is brand-scoped, and synthetic sessions are excluded from learning and real-traffic aggregates. |

### The Kibble enrichment schema

Add these alongside the furniture columns first. Keep the four fit scores, the
tags, and the price tier. The furniture columns stay through the deployment that
switches every reader to the pet fields; a later contract migration removes them.

- `protein` — beef, chicken, salmon, turkey, plant, mixed, none
- `life_stage` — puppy, adult, senior, all
- `format` — dry, wet, air-dried, freeze-dried, treat, supplement, grooming, hardgood
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
navigation, interaction, commerce, and refinement families are wired. Thirty-eight
weighted rules feed a Bayesian posterior over four personas: 31 base rules and
seven Kibble-only subscription rules. Session outcomes are captured at
`/api/signals/finalize`. The database path has passed a live least-privilege smoke
test, but no production session has supplied learning evidence.

### What is declared and unwired

`external` — "Server-side, from CDP/BC/third-party" — still has no authenticated
real producer. The public signal route rejects every external event so a browser
cannot spoof provider data. Deterministic demo fixtures can use the source only
inside the server and carry explicit synthetic provenance through the session,
generation logs, outcomes, and Observe screen.

### Subscription signals added locally

These are Kibble-specific and are the reason this storefront is worth building
separately rather than reskinning Haven:

- `subscription.cadence_selected` — the shopper picks 1/2/3 months
- `subscription.skip`, `subscription.swap`, `subscription.pause` — the control
  actions the whole value proposition rests on
- `subscription.due_proximity` — days until the next shipment; a shopper three
  days out behaves differently from one three weeks out
- `subscription.tenure` — months subscribed, a strong familiarity prior
- `commerce.autoship_mix` — share of cart on a standing order versus one-time

The event types, aggregation, and Kibble-gated rules are implemented. No
subscription-control UI or authenticated provider webhook exists yet, so this is
an inference contract rather than a claim about observed subscriber behavior.

A shopper reordering a known item on a standing order is not a hunter in the
Haven sense. Expect the four-persona taxonomy to strain here; treat that strain
as a finding worth writing down rather than a bug to paper over. Do not add a
fifth persona before the data says the four cannot separate the behavior.

### Injected signals, for demos

Borrow the shape of the Sleep Country work — real behavior, sanitized, used as
calibration ground truth offline — without borrowing its data, which came from a
real retailer.

Three mechanisms, in increasing order of honesty required:

1. **Scenario fixtures — built locally.** Named seeded sessions ("first-time puppy owner",
   "lapsed subscriber returning", "price-checking reorder") that replay a fixed
   signal sequence. Deterministic, demoable offline, and no claim about real
   behavior. Reseeding replaces the prior deterministic session instead of
   appending duplicate events.
2. **`?intent=` labeling**, already supported as a `label_source` in
   `session_outcomes`. Useful for forcing a persona during a walkthrough.
3. **Synthetic session generation — built locally.** The Observe seed route creates
   a labeled session without writing Postgres or calling an external provider.
   Later layout, refinement, or finalization activity preserves the label.

**Every injected signal must be labeled as injected, in the database and on
screen.** `session_outcomes.label_source` already distinguishes `intent_param`
from `conversion` and `behavior_pattern`; extend that discipline to a
`synthetic` flag on generation logs and sessions. The failure this prevents is
a demo dashboard that reads as measured traffic.

**Calibration status must never be overstated.** `learned-weights.json` is
`fittedAt: null, totalSessions: 0` — the shipped engine runs hand-tuned weights.
Synthetic outcomes are excluded from fitting, calibration, and real-traffic
aggregates by default. The current production build still has 31 rules; the local
branch has 38. Neither count is evidence that the weights learned from traffic.

## Order of work

1. **Complete, live:** provision Supabase `aisles-kibble`, store its credentials in
   1Password, connect Cloudflare Hyperdrive, and make required database paths fail
   loudly.
2. **Complete, live:** port the four brand-scoped tables and enforce a restricted
   `aisles_app` runtime role.
3. **Partially complete:** rebuild the enrichment schema and prompt for pet
   supplies. The additive schema is live and the runner publishes atomically. The
   49-product paid run still requires explicit approval to send catalog text to
   Anthropic and OpenRouter.
4. **Ready for data:** the layout prompt and Observe UI consume the pet profile and
   persona-fit fields. Real-row and score-variation verification waits on step 3.
5. **Complete locally:** add the subscription signal family and seven Kibble-gated
   rules without adding a fifth persona.
6. **Complete locally:** add three deterministic scenario fixtures with synthetic
   provenance end to end. The supporting database columns are live. Scenario
   layouts bypass the real-shopper cache, and Observe now requires a server-side
   access token in deployed environments.
7. **Not started by design:** fit weights only after enough real labeled sessions
   exist. Synthetic sessions never count toward that threshold.

Steps 1–4 restore what is currently dark. Steps 5–6 are what make the demo
argue its own thesis.

## What would change this plan

- Kibble's 49-product BigCommerce catalog has no custom fields, so structured
  attributes did not shrink step 3 to a mapping job.
- If the four-persona taxonomy cannot separate replenishment behavior once
  subscription signals exist, the taxonomy is the thing to revisit, not the
  rules.
- If a second brand is never added, the `brand_id` columns are dead weight —
  cheap insurance, but say so rather than pretending they earn their place.

## What was checked, and when

Verified 2026-08-12 against the code and live services: Supabase project
`aisles-kibble` in East US; seven ordered migrations applied; RLS and the
least-privilege `aisles_app` role; Cloudflare Hyperdrive bound to that role; live
owner/runtime database smoke and schema lint; 49 BigCommerce products with zero
custom fields, a $9–$240 price range, chicken recipes, and air-dried food; 38 local
inference rules; public rejection of external events; deterministic scenario
replay; synthetic exclusion from fitting, calibration, and the shopper layout
cache; server-side Observe authorization; atomic enrichment publication; paid-call
failure auditing; and local build, type, prompt, inference, store, schema,
provenance, and compatibility checks.

Not verified: the paid 49-product enrichment output, per-product score variation,
the production Observe surface, or the production deployment. The attempted paid
run was blocked before execution, and no catalog data was sent to Anthropic or
OpenRouter. Production Observe also needs an `OBSERVE_ACCESS_TOKEN` Pages secret
before deployment.
