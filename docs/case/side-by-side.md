# Side-by-side reference

Reference tables for the Aisles competitive position assessment: what actually exists in the repositories, where Aisles and Behamics genuinely diverge, and the published figures this would be measured against.

## What actually exists

"Aisles" names three repositories at very different stages. The spread matters, because the weakest one is the one most easily mistaken for the whole.

| Repository | What it is | Scale |
| --- | --- | --- |
| `bealls-aisles` (most advanced) | Full storefront composition across eight retail surfaces, three brands off one codebase, graduated composition latitude. | 36 blocks · 6 surface schemas · 28 rules |
| `aisles-admin` | BigCommerce embedded app. Seven working tabs: rules, brand voice, content authoring, inspector, persona fit, preview, analytics. Writes merchandising rules to Postgres the storefront reads at generation time. | ~2,100 lines |
| `aisles` (earliest) | Category page only. The original proof of the invariant. | 4 blocks · 31 rules |

Four Cloudflare Worker roots returned HTTP 200 on 2026-08-02. That check proves root liveness only; it does not prove catalog integrity, operator readiness, or merchant outcomes.

## Side-by-side

Where the two approaches genuinely diverge, independent of positioning.

| Dimension | Behamics | Aisles |
| --- | --- | --- |
| Deployment | One line of JavaScript. Platform-agnostic, runs isolated from the site. | Replaces the storefront. SvelteKit against BigCommerce Storefront GraphQL. |
| Who signs | CMO or head of e-commerce. No engineering migration. | CTO. A replatform decision. |
| Unit of change | Selection and ordering inside a fixed template — listing image choice, carousel order, cart sort, product suppression — plus overlay interventions. | Page structure — which blocks exist, their order, copy, and CTA pattern — across eight surfaces. |
| Where generation is allowed | Implicitly narrow everywhere. Never composes, so the question never arises. | Explicit and graduated: wide on home, medium on listings, narrow on product detail, near-fixed at checkout. |
| AI approach | Predictive and causal machine learning, self-training on session data. | Language-model generation constrained by a typed component vocabulary. |
| Operator surface | Incrementality — randomized control and holdout groups. | Explainability — which rules fired, and why the layout was chosen. |
| Commercial model | Performance-based pricing, enabled by the holdout measurement. | None. Chartered as an internal capability demo, not a product. |
| Scope | Six products spanning nudging, SEO, diagnostics, merchandising, audiences. | Bealls Aisles prototype: eight retail surfaces across multiple branded deployments. Original Aisles proof: category page. |

## Published figures

Behamics' own claimed uplift, read directly from their page markup rather than the animated counters. These set the yardstick Aisles would be measured against.

| Product | Claimed uplift | Stated basis |
| --- | --- | --- |
| Signals | +5% incremental revenue · +4% conversion | Median versus randomized control or holdout |

The Signals row is the only external number used in this decision because its page states a comparison design. It remains vendor-reported. Treat it as a benchmark for experimental discipline, not a forecast for Aisles.
