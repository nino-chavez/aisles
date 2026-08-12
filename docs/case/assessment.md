# Aisles — Competitive Position Assessment

Independent competitive assessment · v4.0 public · 2026-08-02

## Scope and boundaries

Bealls and Home Centric appear only as an example merchant family used to make the prototype concrete. This is independent research and development, not affiliated with, endorsed by, or a commercial engagement with Bealls Inc. Behamics claims are read from their public pages, cited with retrieval dates, and are vendor-reported.

## Bottom line

**Adopt the composition rules. Prove the merchant outcome. Do not fund the platform yet.**

Aisles is an R&D prototype: a storefront that reads the intent behind a visit and composes the page to match. Behamics markets a similar behavioral-intent approach. The decision is not whether to copy that product. It is which Aisles capability can guide the platform now, which merchant experiment should come next, and what should remain unfunded.

> The intent-inference engine is table stakes. Two things here are not: a principled model of where an AI may compose a page, and hard evidence that persona rules invert across retail categories. Neither has ever been measured against revenue.

Four things follow, in order of how much they should change what happens next:

- There is a commercial comparator. Behamics markets behavioral-intent optimization and publishes controlled-test medians. That is a benchmark, not proof of demand for Aisles.
- The part I invested most in is the part the market already solved. Leading with inference sophistication loses to a live demo. Leading with the two findings below does not.
- An offline diagnostic found that rules do not transfer cleanly between categories. Scored against heuristic labels from a mattress retailer's anonymized session data, three of ten testable rules pointed the wrong way. That produced per-brand rule gating — and a warning that applies to anyone building persona models.
- Nobody has measured whether any of it makes money. That is the one gap with no apparatus at all, and it is the evidence any investment decision would rest on.

## Why this memo exists

*Situation · Complication · Question*

**Situation.** Aisles is a working R&D prototype across three repositories. A storefront reads the signals behind a visit, infers one of four shopper personas from weighted rules, and has a model compose the page — blocks, product order, copy — inside a typed schema. The most developed instance composes eight canonical retail surfaces from a 36-block vocabulary and runs three distinct brands off one codebase. A separate BigCommerce embedded app gives a merchandiser the controls. Its own charter calls it an artifact for a commerce platform team to react to and pull capabilities from, not a product being sold.

**Complication.** Behamics markets behavioral-intent optimization to enterprise retail. Its current Signals page classifies live sessions using a vocabulary that maps closely to the Aisles persona set and reports results against randomized control or holdout groups.

**Question.** Which capabilities here are worth pulling into the platform, and what evidence would justify the investment?

**Answer.** Adopt the composition-latitude model as platform guidance now. Do not productize the inference engine until one bounded merchant holdout proves incremental value. An offline calibration already found category-specific rule inversions; it did not measure revenue.

## What to build and prove

The roadmap is one reusable safety contract plus one merchant experiment. It is not a shared inference-platform commitment.

| Decision | Practical meaning |
| --- | --- |
| Adopt now | Publish graduated composition latitude as platform guidance: wide on home, medium on listings, narrow on product detail, fixed through checkout. |
| Build next | One bounded merchant test with a static baseline, an adaptive variant, stable cohort assignment, outcome instrumentation, operator explanation, a kill switch, and recovery. |
| Prove | Incremental conversion, average order value, and revenue per session versus the baseline, alongside latency, operating cost, and recovery quality. |
| Do not fund yet | A generalized persona engine, a shared adaptive-storefront platform, a replatform program, or a Behamics clone. |

These steps are ordered. Each one either creates evidence or prevents the organization from mistaking activity for value.

1. **Publish the composition-latitude contract as guidance.** It is portable, understandable, and useful even if Aisles never ships. It governs where generative composition is allowed; it does not authorize an engine or implementation.

2. **Choose one merchant surface and build the holdout.** A fixed fraction of sessions get the static baseline instead of the adaptive version, decided once and remembered. Log assignment and outcomes. Give the operator an explanation, a kill switch, and a tested path back to the baseline.

3. **Judge the experiment on merchant economics.** Compare conversion, average order value, and revenue per session. Add latency, operating cost, and recovery quality. A positive result authorizes a second use case. It does not authorize a shared platform.

4. **Stabilize one review target and correct the uncalibrated extraction.** The four Worker roots are live, but liveness is not a working review journey. Pick one brand and surface, verify its catalog path, replay one anonymized journey, and make recovery visible. Separately, fix or label `@bcss/persona-core` before anyone points it at a non-apparel vertical.

5. **Stop when the proof fails.** Stop if the holdout shows no credible incremental merchant value, if operating cost erases the gain, if recovery is unsafe, or if an operator cannot explain and control the change. Behamics' self-reported single-digit medians are a comparator, not the funding threshold; merchant economics set the threshold.

---

The five supporting findings are recorded separately, as are the side-by-side reference tables and the provenance, method, and falsifiers for this assessment.

*Nino Chavez · Public edition, derived from v4.0 · 2026-08-02 · Aisles is a private prototype; all rights reserved by the author.*
