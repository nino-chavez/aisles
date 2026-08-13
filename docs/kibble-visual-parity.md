# Kibble visual parity gate

This command checks a fixed Kibble Preserve page against an explicitly named
reference page at mobile, tablet, and desktop widths. It is a release gate, not a tool
for creating or updating a baseline.

The command writes two screenshots, a pixel-difference image, and a JSON report
under `validation/kibble-parity/`. That directory is
ignored by Git. Nothing from a passing run is committed automatically.

## What must be true before a run

Both URLs must render the same three provenance markers on the Kibble page:

```text
data-reference-id
data-reference-contract-version
data-reference-fixture-sha256
```

The Aisles Kibble Preserve route and the pinned `bc-subscriptions` reference
revision both render these markers. A direct run against any older,
uninstrumented revision fails closed. Do not remove this check just to compare
screenshots.

The fixed data identity is deliberately specific:

```text
833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49
```

This is the SHA-256 of the source-owned Kibble seed fixture. The separately
required contract ID and version bind its interpretation. A page with another
fixture or contract cannot pass this gate.

## Run it

### Local fixed-data rehearsal

This repository provides one local command for the Home comparison. It starts
the canonical `bc-subscriptions` storefront and the Aisles candidate as two
separate Vite processes, supplies both with the source-owned fixed catalog, and
then invokes the 390px, 768px, and 1280px gate.

```bash
npm run test:kibble-parity:local
```

The catalog seam is process-scoped to this command. It intercepts BigCommerce
GraphQL requests, while a runner-only Vite config replaces the Postgres driver
with a no-op client. That lets the real Aisles Preserve route execute its normal
render path without opening Hyperdrive or any database.
Cloudflare's local binding receives an inert connection string only so it can
initialize; the runner-only driver cannot open a socket. The ordinary
Aisles `dev`, `build`, `preview`, and Wrangler paths have no fixture flag or
fallback. No remote database, Hyperdrive, secrets, or paid API is used.

External image requests are replaced with the same neutral local image while
the gate captures both pages. This prevents third-party CDNs from changing the
result. It does not conceal a local asset difference: fixture product images are
local deterministic data URLs, and the pixel gate still compares their rendered
positions and dimensions.

Before either endpoint starts, the runner hashes the canonical seed fixture and
checks its ID, version, and SHA against the canonical source. The gate then
checks the rendered markers before it captures screenshots. Evidence is written
to `validation/kibble-parity-local/`.

Home is the current default. A later integration can add routes without changing
the server mechanism:

```bash
KIBBLE_PARITY_LOCAL_ROUTES='[{"id":"home","path":"/"},{"id":"plp","path":"/category/dog-food"}]' \
npm run test:kibble-parity:local
```

The route matrix only runs surfaces already contracted and rendered by both
repositories. It does not make product-detail, cart, checkout, or any other
uncontracted surface into evidence.

The local command defaults to a zero pixel difference and zero structural
tolerance. Supplying either tolerance through environment variables makes the
run a non-release rehearsal; record the reason and obtain the separate approval
required by the main gate before treating it as parity evidence.

### First fixed-data result

The runner initializes the local Cloudflare binding with an inert
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` value, while its
runner-only Postgres replacement prevents any database connection. The first
complete Home capture failed the gate at both widths. This is useful evidence,
not a parity approval.

The measured differences included the page background and text colors, body
font, hero heading line height and tracking, container geometry, navigation and
link structure, and full-page height. When screenshot dimensions differ, the
pixel comparison uses the larger canvas and counts the missing area as changed
instead of suppressing the comparison. The run writes its local screenshots,
diffs, and `report.json` under
`validation/kibble-parity-local/`.

The earlier route mismatch for bundle product `3065` was a candidate-contract
bug. The canonical fixed fixture binds the stable entity ID, name, category, and
price while its product slug differs from an older bundle-content lookup key.
Because the Home CTA targets the Bundles category rather than that PDP, the
candidate no longer treats the mutable product slug as Home recipe identity.

### Existing endpoint runner

Start the approved reference and candidate URLs yourself. Then provide every
comparison input. The command has no URL, threshold, mask, or structure
defaults.

```bash
KIBBLE_PARITY_REFERENCE_URL='http://127.0.0.1:4173/' \
KIBBLE_PARITY_CANDIDATE_URL='http://127.0.0.1:5173/' \
KIBBLE_PARITY_CONTRACT_ID='kibble-shelf-native' \
KIBBLE_PARITY_CONTRACT_VERSION='1.5.0' \
KIBBLE_PARITY_FIXED_DATA_IDENTITY='833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49' \
KIBBLE_PARITY_MASKS='[]' \
KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO='0.025' \
KIBBLE_PARITY_STRUCTURE_TOLERANCES='{"header":0,"nav":0,"main":0,"footer":0,"h1":0,"h2":1,"h3":2,"section":1,"image":2,"link":3,"button":1,"pageHeight":120}' \
npm run test:kibble-parity
```

`KIBBLE_PARITY_MASKS='[]'` is required even when no regions are masked. A mask
must provide pixel coordinates, non-zero dimensions, and a reason. Treat it as
an exception list. It cannot be an unnamed way to hide a regression.

The screenshot threshold and every structural tolerance are operator choices.
The example values are not an approval. Record why a non-zero threshold or
mask is appropriate in the review evidence for that run.

## What the gate compares

At 390px, 768px, and 1280px wide, it checks:

- The three provenance markers on both pages.
- Header, navigation, main, footer, heading, section, image, link, and button
  counts, plus full-page height.
- Computed root colors and body font; h1 font family, size, weight, line height,
  and letter spacing; and header height and position. It also records numeric
  geometry for the main hero content container: its bounding edges, viewport
  gutters, content edges, and content width. The runner targets that container
  inside `main`, not the first chrome/status container on the page. These values
  are exact checks and are recorded in the report. The runner does not normalize
  typography or CSS before capture.
- Full-page screenshot dimensions and changed-pixel ratio after the declared
  masks are applied.

Both required Kibble web fonts must load before capture. A failed font load
fails the run instead of comparing two system-font fallbacks.

The runner disables motion and writes `reference.png`, `candidate.png`,
`diff.png` when comparable, and `report.json` per run. Any missing marker,
wrong identity, dimension mismatch, structural overage, or pixel overage exits
non-zero.

This gate is necessary evidence, not complete sign-off. It does not prove
catalog correctness, keyboard behavior, real cart behavior, or a human visual
review. Those remain separate release checks.
