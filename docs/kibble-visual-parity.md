# Kibble visual parity gate

This command checks a fixed Kibble Preserve page against an explicitly named
reference page at mobile and desktop widths. It is a release gate, not a tool
for creating or updating a baseline.

The command writes two screenshots, a pixel-difference image when dimensions
match, and a JSON report under `validation/kibble-parity/`. That directory is
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

Start the approved reference and candidate URLs yourself. Then provide every
comparison input. The command has no URL, threshold, mask, or structure
defaults.

```bash
KIBBLE_PARITY_REFERENCE_URL='http://127.0.0.1:4173/' \
KIBBLE_PARITY_CANDIDATE_URL='http://127.0.0.1:5173/' \
KIBBLE_PARITY_CONTRACT_ID='kibble-shelf-native' \
KIBBLE_PARITY_CONTRACT_VERSION='1.4.0' \
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

At 390px and 1280px wide, it checks:

- The three provenance markers on both pages.
- Header, navigation, main, footer, heading, section, image, link, and button
  counts, plus full-page height.
- Full-page screenshot dimensions and changed-pixel ratio after the declared
  masks are applied.

The runner disables motion and writes `reference.png`, `candidate.png`,
`diff.png` when comparable, and `report.json` per run. Any missing marker,
wrong identity, dimension mismatch, structural overage, or pixel overage exits
non-zero.

This gate is necessary evidence, not complete sign-off. It does not prove
catalog correctness, keyboard behavior, real cart behavior, or a human visual
review. Those remain separate release checks.
