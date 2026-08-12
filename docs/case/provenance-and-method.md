# Provenance, method, and what would change this

How the Aisles competitive position assessment was produced, what was checked against what, and the conditions that would overturn it.

## Provenance & method

**Assessed.** 2026-08-02

**Primary source.** Behamics official Signals, Nudge, Diagnostic, and home pages. The Signals page was fetched again on 2026-08-02; its intent labels, controlled-test note, and counter targets were read from the page itself, not search-result summaries.

**Figures.** Read from the counter target values in the page markup, because the on-screen counters animate from zero and a screenshot would have captured the wrong number.

**Not verified.** The "patented AI" claim — no corresponding register filing surfaced. Whether Nosto and Dynamic Yield remain template-bound in 2026.

**Aisles claims.** Checked against the codebases, not the documentation. The absence of holdout, control-group, or experiment-assignment logic was confirmed by search across the storefront, multi-brand instance, and admin control plane. Block counts, rule counts, and surface schemas were counted from source. Four Cloudflare Worker root URLs returned HTTP 200 on 2026-08-02; no merchant journey or catalog-integrity claim is inferred from that check.

**Session data.** The sleep-retailer calibration was done on a different machine and is not in this machine's session history — an initial search here found nothing, which was a false negative. The work was located on branch `worktree-spike-cloudflare-portkey`, fetched from origin, and read directly: the handoff document, ADR-011, the rule-transferability tables, and the referrer prior tables. Raw event data is gitignored and machine-local; every derived artifact is committed, so the conclusions transfer but re-running the analysis requires a fresh BigQuery export.

**Calibration caveat.** Carried from ADR-011 rather than smoothed over: the fingerprinter that labeled the 11,629 sessions shares low-level signals with the rules it scored, so the precision figures are internal-consistency checks, not external validation. The directional finding — three rules pointing the wrong way — survives that objection. The absolute percentages do not.

## What would change this assessment

*Limits of this read*

### Open check — not run

The composition-latitude differentiator rests on Nosto and Dynamic Yield still being template-bound in 2026. I did not re-verify that. Behamics cannot falsify it — as a JavaScript overlay it has no access to the render pipeline — but either of those two shipping graduated generative composition would collapse the third finding. That check is worth running before anyone spends real money on this direction.

### Two smaller caveats

Recorded so nobody inherits them as fact:

- Behamics claims "patented AI" and a "patented invention" on their site. I could not surface a corresponding filing in any patent register. It is their claim, not a verified one.
- Their published uplift figures are self-reported. The methodology footnote is unusually specific for marketing copy, which is why I weight it — but it is still their measurement of their own product.
