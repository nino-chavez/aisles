# Five findings, in the order they matter

Supporting findings for the Aisles competitive position assessment. These are a set, not a sequence. Each carries its own verdict.

## 1. Validated — the category has a commercial comparator

*Market signal*

Behamics markets a behavioral-intent product and publishes median incremental revenue and conversion lift against randomized control or holdout groups. Those figures are vendor-reported, but the measurement design is the useful comparison.

**What it means.** Do not spend the next cycle proving that behavioral optimization exists. Use the comparator to set an experimental standard. Merchant demand for the Aisles approach remains unproven.

## 2. Commoditized — the inference engine is table stakes

Behamics describes what their Signals product detects in a live session:

> Signals interprets contextual signals to understand whether users are exploring, comparing, deciding, hesitating, price-sensitive, or likely to need support next.
>
> — behamics.com/signals, retrieved 2026-08-02

That is the Aisles model with different labels:

| Behamics decision state | Aisles equivalent |
| --- | --- |
| Exploring | Gatherer — browsing to discover |
| Comparing | Researcher — evaluating specs |
| Deciding | Hunter — buying with intent |
| Hesitating, price-sensitive | Behavioral modifiers — urgency, priceSensitivity |

Two teams reached similar taxonomies. That makes the taxonomy plausible and commercially legible. It does not make the taxonomy correct, and it makes it a weak source of differentiation. The 31-rule inference engine is the part of Aisles with the clearest external comparator.

**What it means.** Stop leading with rule counts and inference sophistication. Anyone who has seen a Behamics demo will read it as parity, not differentiation.

## 3. Defensible — composition latitude, knowing where the AI may not compose

Behamics installs as one line of JavaScript and runs isolated from the site. Their automations do change composition — which image appears in a listing, carousel order, cart sort, which products get suppressed — but always inside a template the merchant already owns. They change what fills the slots.

Aisles decides what the slots are. Two constraints make that safe rather than reckless, and the second is the one worth taking.

### Constraint one — a closed vocabulary

Every layout the model can emit is provably a member of a typed set defined in code: ∀I, ∀P · f(I,P) → S ∈ V. The model chooses blocks, orders products, and writes copy. It cannot invent a block that isn't defined. That is also why the operator dashboard can explain any page it produced.

### Constraint two — latitude graduated by surface

Not every surface should be composed to the same degree. Latitude is a function of how variable the surface is and how close it sits to conversion:

| Latitude | Surfaces | What the AI may do |
| --- | --- | --- |
| Wide | Home, empty-state rescue | Compose the entire view; only brand chrome is fixed |
| Medium | Category listing, account | Compose inside a known scaffold of zones |
| Narrow | Product detail | Insert blocks at named anchors; gallery, variant selector and add-to-cart stay fixed and ordered |
| Fixed | Cart, checkout | Personalize copy and pick upsells; may not reorder steps |

The reviewed Behamics pages do not describe an equivalent graduated composition model. That is not proof that no equivalent exists. It does show that composition safety is a separate platform question from behavioral targeting. Anyone who builds generative commerce UI eventually has to decide where a model may change structure and where it may not. Aisles has a concrete answer written down.

Build status, stated honestly: the taxonomy is draft v1. Thirty-six blocks are implemented against a stated target of 80–100, with six surface-specific schemas. Roughly a third is built. Four Cloudflare Worker root URLs returned HTTP 200 on 2026-08-02. Root liveness is not proof that catalog routes work, that a merchant can operate the system, or that the experience changes an outcome.

The cost caveat: Behamics is a pixel with no engineering involvement. Aisles is a replatform. That difference, not the AI, is what makes this hard to adopt wholesale — which is why the latitude model, portable on its own, is the part worth extracting.

**What it means.** The transferable asset is the latitude model, not the codebase. It is a design contract that could govern generative UI anywhere in the platform, independent of whether Aisles itself ever ships.

## 4. Measured — one offline calibration found three rules pointing the wrong way

The engine has been scored against production session data, exactly once. In May 2026 a seven-week anonymized BigQuery extract from a national sleep retailer — 29,870 events across 11,629 sessions — was labeled offline by a heuristic fingerprinter and used as a calibration target. Ten of the twenty-eight rules were testable against it. The rest consume signals the privacy filter stripped. This is diagnostic evidence, not external ground truth.

Three of those ten pointed in the wrong direction. Not weak — inverted, on a single hop from off-price apparel to sleep retail:

| Rule | Designed to indicate | What real sessions showed |
| --- | --- | --- |
| referrer-social | Gatherer — social is inspiration browsing | Predominantly hunter-labeled |
| in-session-search (hunter half) | Hunter — search means refining a known purchase | Predominantly researcher-labeled |
| single-category-focus | Hunter — staying put means knowing what you want | Not hunter-labeled in the tested sample |

Each inverts for a legible reason. Paid social in sleep retail is ad-click purchase intent, not browsing. Someone searching for a mattress is comparison-shopping a high-stakes purchase, not narrowing a known one. Staying inside `/mattresses/` is deliberation, not decisiveness.

That result produced the second reusable idea in this project, alongside composition latitude: per-brand rule gating. The rule set is no longer global — inference branches its adjustment vectors on brand, which is the structural admission that retail category changes what a signal means. Cold start changed too: a shopper with zero signals now gets a referrer-keyed prior instead of an even split, and for paid-social traffic that prior is near-certain. Given a median session length of one event, most traffic never gets past cold start.

The caveat, carried rather than smoothed over. The fingerprinter that labeled those sessions shares low-level signals with the rules it scored. The precision numbers are therefore internal-consistency checks, not external validation. The three overrides survive that objection because they correct rules pointing the wrong way, which is a directional claim; the absolute percentages do not.

The methodological residue is the part worth keeping: calibrate per category before assuming a persona model transfers. Three of ten rules inverted across one category hop.

One distinction, so the repository does not appear to contradict this. There are two calibration mechanisms and only one has ever run. The sleep-retailer work above was a one-off offline scoring pass, and it lives on the unmerged branch. Separately, the main line carries a continuous learning pipeline — a session-outcomes table, a beacon that finalizes each session into it, and a script that fits empirical likelihood ratios. That one has never produced anything: its output file is committed reading `totalSessions: 0`, and the reason is mechanical rather than neglectful — the table it writes to was never created in the live database, so every write silently fails. Anyone who opens the repo today sees the zero and not the sleep-retailer result.

The mechanism that makes this provable is a holdout: a slice of shoppers you deliberately do not give the new experience to. They see the plain, static page; everyone else sees the generated one. Compare the two groups — same store, same week, same traffic mix — and the difference is what the product actually did. Without it, a rise in conversion could just as easily be the season, a promotion, or a change in traffic.

Behamics publishes uplift figures with this attached:

> Behamics reports that 75% of its completed controlled Signals tests were positive and describes the published KPIs as median lift versus randomized control or holdout groups.
>
> — behamics.com/signals, retrieved 2026-08-02; vendor-reported

That measurement discipline is what makes performance-based pricing possible. It is the most credible thing on their site.

Aisles has an operator dashboard that shows every signal received, every inference rule that fired, and why the model chose the layout it chose. That answers why did the store do that. It does not answer did this make money. A merchandiser asks the second question first.

**What it means.** This is the most credible thing in the project and it is currently invisible. The work sits on an unmerged branch; the main line has none of it. Lead with it — "we tested our model against a real retailer's traffic and it told us three of our assumptions were backwards" is a stronger opening than any architecture diagram.

## 5. Missing — nobody has measured whether any of it makes money

Calibration answers whether the persona guess is right. It does not answer whether acting on that guess produces revenue, and those are different questions with different apparatus.

Behamics publishes uplift against randomized control and holdout groups — that is what makes performance-based pricing possible for them. Aisles has an operator dashboard that explains why the store behaved as it did. That answers why, never was it worth it. A merchandiser asks the second question first.

The architecture decision record specifies a holdout cohort and an evaluation harness. Both are unchecked, and I searched all three repositories — storefront, multi-brand instance, admin control plane. No holdout, no control group, no experiment logic anywhere.

| Question | Apparatus | Evidence to date |
| --- | --- | --- |
| Is the persona guess internally consistent? | Partly built | One offline diagnostic. Three of ten testable rules corrected. |
| Does the generated layout make money? | Not built | None. |

A second, narrower gap: the general-purpose extraction of this engine, `@bcss/persona-core`, was lifted from Aisles 0.3.0 before the calibration and carries no per-brand gating and no referrer priors. It still contains all three wrong-direction rules. Pointed at a non-apparel vertical, that is a live defect rather than a theoretical one.

**What it means.** The holdout is the one piece of evidence that would justify productizing any of this, and it is a modest build. Separately, the uncalibrated extraction should be corrected or labeled before anyone adopts it.
